import { GoogleSearchConsoleClient, normalizeGoogleError } from "./googleClient.js";
import type { AppConfig } from "./config.js";
import type { AccountStore } from "./accountStore.js";

export type ToolContext = {
  subscriberId?: string;
  config: AppConfig;
  accountStore: AccountStore;
};

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export function jsonResult(value: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }]
  };
}

export function errorResult(message: string): ToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: message }]
  };
}

export function connectionUrl(ctx: ToolContext): string {
  const url = new URL("/auth/google/start", ctx.config.PUBLIC_BASE_URL);
  if (ctx.subscriberId) {
    url.searchParams.set("subscriber_id", ctx.subscriberId);
  }
  return url.toString();
}

export async function withGoogleClient<T>(
  ctx: ToolContext,
  action: (client: GoogleSearchConsoleClient, subscriberId: string) => Promise<T>
): Promise<ToolResult> {
  if (!ctx.subscriberId) {
    return errorResult(`Missing MCP subscriber identity. Configure MCPize to send the ${ctx.config.MCPIZE_SUBSCRIBER_HEADER} header, then reconnect this server.`);
  }

  const account = await ctx.accountStore.getAccount(ctx.subscriberId);
  if (!account) {
    return errorResult(`Google Search Console is not connected. Open this URL to connect: ${connectionUrl(ctx)}`);
  }

  try {
    const client = new GoogleSearchConsoleClient(ctx.config, account.providerRefreshToken);
    return jsonResult(await action(client, ctx.subscriberId));
  } catch (error) {
    return errorResult(normalizeGoogleError(error).message);
  }
}
