import { describe, expect, it, vi } from "vitest";
import { formatGoogleError, shouldSuggestReauth, withGoogleClient, type ToolContext } from "../src/toolHelpers.js";

function createContext(): ToolContext {
  return {
    subscriberId: "subscriber-123",
    config: {
      PORT: 3000,
      HOST: "0.0.0.0",
      PUBLIC_BASE_URL: "https://google-search-console-mcp-server.irensaltali.com",
      MCPIZE_SUBSCRIBER_HEADER: "x-mcpize-user-id",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SECRET_KEY: "secret-key",
      GOOGLE_CLIENT_ID: "client-id.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "client-secret",
      TOKEN_ENCRYPTION_KEY: "1234567890123456",
      OAUTH_STATE_SECRET: "1234567890123456"
    },
    accountStore: {
      getAccount: vi.fn(async () => ({
        providerRefreshToken: "refresh-token",
        googleEmail: "user@example.com",
        scopes: []
      }))
    } as never
  };
}

describe("Google auth error formatting", () => {
  it("detects reconnect-worthy auth errors", () => {
    expect(shouldSuggestReauth("Google Search Console API error: unauthorized_client")).toBe(true);
    expect(shouldSuggestReauth("Google Search Console API error (401): Token has been expired or revoked.")).toBe(true);
    expect(shouldSuggestReauth("Google Search Console API error (403) [insufficientPermissions]: Request had insufficient authentication scopes.")).toBe(true);
    expect(shouldSuggestReauth("Google Search Console API error (403): quotaExceeded")).toBe(false);
  });

  it("adds a reconnect URL for auth failures", () => {
    const message = formatGoogleError("Google Search Console API error: unauthorized_client", createContext());
    expect(message).toContain("unauthorized_client");
    expect(message).toContain("/auth/google/start?subscriber_id=subscriber-123");
  });

  it("returns a reconnect URL from tool execution when auth fails", async () => {
    const result = await withGoogleClient(createContext(), async () => {
      throw new Error("Google Search Console API error: unauthorized_client");
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("unauthorized_client");
    expect(result.content[0]?.text).toContain("/auth/google/start?subscriber_id=subscriber-123");
  });
});
