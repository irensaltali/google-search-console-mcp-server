import { loadConfig } from "./config.js";
import { createSupabaseAdmin } from "./supabaseClient.js";
import { AccountStore } from "./accountStore.js";
import { createHttpApp } from "./httpServer.js";

const config = loadConfig();
const supabase = createSupabaseAdmin(config);
const accountStore = new AccountStore(supabase, config);
const app = createHttpApp(config, accountStore);

const server = app.listen(config.PORT, config.HOST, () => {
  console.log(`Google Search Console MCP server listening on ${config.HOST}:${config.PORT}`);
});
server.ref();

server.on("error", (error) => {
  console.error("Failed to start Google Search Console MCP server", error);
  process.exitCode = 1;
});
