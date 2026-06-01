import express, { type Request } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { AppConfig } from "./config.js";
import { DEFAULT_MCP_PATH } from "./constants.js";
import { AccountStore } from "./accountStore.js";
import { createAuthRouter } from "./authRoutes.js";
import { createMcpServer } from "./tools.js";

export function createHttpApp(config: AppConfig, accountStore: AccountStore) {
  const app = express();

  app.get("/", (_req, res) => {
    const mcpEndpoint = new URL(DEFAULT_MCP_PATH, config.PUBLIC_BASE_URL).toString();

    res.json({
      name: "google-search-console-mcp-server",
      status: "ok",
      mcp: DEFAULT_MCP_PATH,
      mcpEndpoint
    });
  });

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/ping", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/auth", createAuthRouter(config, accountStore));

  app.all(DEFAULT_MCP_PATH, express.json({ limit: "1mb" }), async (req, res) => {
    const subscriberId = extractSubscriberId(req, config.MCPIZE_SUBSCRIBER_HEADER);
    const server = createMcpServer({
      subscriberId,
      config,
      accountStore
    });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    res.on("close", () => {
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  return app;
}

export function extractSubscriberId(req: Request, configuredHeader: string): string | undefined {
  const candidates = [
    configuredHeader,
    "x-mcpize-user-id",
    "x-mcpize-subscriber-id",
    "x-mcp-user-id",
    "x-user-id"
  ];

  for (const headerName of candidates) {
    const value = req.header(headerName);
    if (value?.trim()) {
      return value.trim();
    }
  }

  return undefined;
}
