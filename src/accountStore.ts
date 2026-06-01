import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptText, encryptText } from "./crypto.js";
import type { AppConfig } from "./config.js";

export type GoogleAccount = {
  subscriberId: string;
  supabaseUserId?: string;
  googleUserId?: string;
  googleEmail?: string;
  providerRefreshToken: string;
  scopes: string[];
};

type AccountRow = {
  subscriber_id: string;
  supabase_user_id: string | null;
  google_user_id: string | null;
  google_email: string | null;
  provider_refresh_token_ciphertext: string;
  scopes: string[];
};

export class AccountStore {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly config: AppConfig
  ) {}

  async upsertAccount(account: GoogleAccount): Promise<void> {
    const encryptedRefreshToken = encryptText(
      account.providerRefreshToken,
      this.config.TOKEN_ENCRYPTION_KEY,
      account.subscriberId
    );

    const { error } = await this.supabase
      .from("gsc_google_accounts")
      .upsert({
        subscriber_id: account.subscriberId,
        supabase_user_id: account.supabaseUserId ?? null,
        google_user_id: account.googleUserId ?? null,
        google_email: account.googleEmail ?? null,
        provider_refresh_token_ciphertext: encryptedRefreshToken,
        scopes: account.scopes,
        updated_at: new Date().toISOString(),
        last_connected_at: new Date().toISOString()
      }, { onConflict: "subscriber_id" });

    if (error) {
      throw new Error(`Failed to store Google account: ${error.message}`);
    }
  }

  async getAccount(subscriberId: string): Promise<GoogleAccount | null> {
    const { data, error } = await this.supabase
      .from("gsc_google_accounts")
      .select("subscriber_id,supabase_user_id,google_user_id,google_email,provider_refresh_token_ciphertext,scopes")
      .eq("subscriber_id", subscriberId)
      .maybeSingle<AccountRow>();

    if (error) {
      throw new Error(`Failed to load Google account: ${error.message}`);
    }
    if (!data) {
      return null;
    }

    return {
      subscriberId: data.subscriber_id,
      supabaseUserId: data.supabase_user_id ?? undefined,
      googleUserId: data.google_user_id ?? undefined,
      googleEmail: data.google_email ?? undefined,
      providerRefreshToken: decryptText(
        data.provider_refresh_token_ciphertext,
        this.config.TOKEN_ENCRYPTION_KEY,
        subscriberId
      ),
      scopes: data.scopes ?? []
    };
  }

  async deleteAccount(subscriberId: string): Promise<void> {
    const { error } = await this.supabase
      .from("gsc_google_accounts")
      .delete()
      .eq("subscriber_id", subscriberId);

    if (error) {
      throw new Error(`Failed to disconnect Google account: ${error.message}`);
    }
  }

  async recordMutation(subscriberId: string, toolName: string, target: string, payload: unknown): Promise<void> {
    const { error } = await this.supabase
      .from("gsc_mutation_audit_logs")
      .insert({
        subscriber_id: subscriberId,
        tool_name: toolName,
        target,
        payload
      });

    if (error) {
      throw new Error(`Failed to write mutation audit log: ${error.message}`);
    }
  }
}
