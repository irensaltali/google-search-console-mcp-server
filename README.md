# Google Search Console MCP Server

[![MCPize](https://mcpize.com/badge/@iren/google-search-console-mcp-server)](https://mcpize.com/mcp/google-search-console-mcp-server)

Google Search Console MCP server for SEO analytics, URL inspection, sitemap management, and property administration through secure OAuth.

## Connect via MCPize

Use this MCP server instantly with no local installation:

```bash
npx -y mcpize connect @iren/google-search-console-mcp-server --client claude
```

Or connect at: **https://mcpize.com/mcp/google-search-console-mcp-server**

## Overview

This remote MCP server gives AI clients direct access to Google Search Console without requiring local server setup. After a one-time Google OAuth connection, agents can inspect index coverage, query search performance, manage sitemap submissions, and administer Search Console properties from the same workflow.

It is built for technical SEO, growth, content, and engineering teams that want Search Console data and actions available inside MCP-native tools such as Codex and Claude Code.

## Key Capabilities

- Google OAuth account connection with encrypted per-subscriber token storage.
- Search Analytics reporting for clicks, impressions, CTR, position, and dimension-based breakdowns.
- URL Inspection checks for index status, crawl state, and page-specific issues.
- Search Console property operations including list, get, add, and delete.
- Sitemap operations including list, get, submit, and delete.
- Confirmation guards for destructive tools and audit logging for mutations.

## Included Tools

- `connect_google_account`
- `get_connection_status`
- `disconnect_google_account`
- `list_sites`
- `get_site`
- `add_site`
- `delete_site`
- `query_search_analytics`
- `inspect_url`
- `list_sitemaps`
- `get_sitemap`
- `submit_sitemap`
- `delete_sitemap`

## Included Prompts

- `debug_indexing_issue`
- `summarize_search_performance`
- `find_ctr_opportunities`
- `review_sitemap_health`

## Use Cases

- Pull Search Console performance data into agent workflows for SEO reporting and content prioritization.
- Check whether specific URLs are indexed and diagnose crawl or coverage problems without leaving the coding client.
- Submit or clean up sitemaps during deployments, migrations, or recovery workflows.
- Manage Search Console properties programmatically for multi-site teams and internal tools.

## Required Setup

1. Enable the Google Search Console API in Google Cloud.
2. Configure the Google OAuth web client in Supabase Auth.
3. Use this Google OAuth web client:

   ```text
   219391673793-bd9k06kvocj4i5i4820srffv7s838arm.apps.googleusercontent.com
   ```

4. Add these authorized redirect URIs in Google Cloud:

   ```text
   https://google-search-console-mcp-server.irensaltali.com
   https://google-search-console-mcp-server.irensaltali.com/auth/google/complete
   https://bbihthevyhrjemiwqzwh.supabase.co/auth/v1/callback
   ```

5. Add these authorized JavaScript origins in Google Cloud:

   ```text
   https://google-search-console-mcp-server.irensaltali.com
   https://bbihthevyhrjemiwqzwh.supabase.co
   ```

6. Apply the SQL in [`supabase/schema.sql`](supabase/schema.sql).
7. Copy `.env.example` to `.env` and fill server-only secrets:
   - `SUPABASE_SECRET_KEY`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `TOKEN_ENCRYPTION_KEY`
   - `OAUTH_STATE_SECRET`

Do not commit the Google client secret. Keep it only in runtime secrets or ignored local env files.

Generate secrets with:

```bash
openssl rand -base64 32
```

## Development

```bash
npm install
npm run dev
```

The MCP endpoint is:

```text
POST /mcp
```

Health check:

```text
GET /healthz
```

MCPize dashboard health checks can also use:

```text
GET /ping
```

OAuth start URL:

```text
GET /auth/google/start?subscriber_id=<mcpize-subscriber-id>
```

## MCPize Notes

Configure MCPize to forward a stable subscriber identity header. The default expected header is:

```text
x-mcpize-user-id
```

Override it with `MCPIZE_SUBSCRIBER_HEADER` if MCPize uses a different header.

For local/developer testing, use this subscriber header value:

```text
x-mcpize-user-id: d206a003-8073-48db-aee3-84ae53104f99
```

Set the MCPize dashboard Endpoint URL to the deployed server base URL:

```text
https://google-search-console-mcp-server.mcpize.run
```

The MCP transport path is `/mcp`, so discovery should initialize against:

```text
https://google-search-console-mcp-server.mcpize.run/mcp
```

If MCPize asks for the base/server URL, use the first URL. If it asks for the full MCP endpoint URL, use the second URL.

Deployment is expected to run automatically from GitHub `main`. The deploy build command should be:

```bash
npm run build
```

The runtime start command is `npm start`.

This repo includes a `Dockerfile` because MCPize's TypeScript auto-detection may otherwise try to run `src/index.ts` directly. The Dockerfile builds TypeScript first and starts `dist/index.js`, which is required for Cloud Run.

## Tests

```bash
npm test
npm run typecheck
npm run build
