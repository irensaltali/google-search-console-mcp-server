# Google Search Console MCP Server

[![MCPize](https://mcpize.com/badge/@iren/google-search-console-mcp-server)](https://mcpize.com/mcp/google-search-console-mcp-server)

Remote MCP server for Google Search Console, designed for MCPize deployment and monetization.

## Connect via MCPize

Use this MCP server instantly with no local installation:

```bash
npx -y mcpize connect @iren/google-search-console-mcp-server --client claude
```

Or connect at: **https://mcpize.com/mcp/google-search-console-mcp-server**

## Features

- Supabase Auth Google OAuth connection flow.
- Encrypted per-subscriber Google refresh-token storage in Supabase.
- Full Search Console admin/read tool surface:
  - properties
  - search analytics
  - URL inspection
  - sitemaps
- Confirm guards for destructive delete tools.
- Mutation audit logs for write/delete actions.

## Required Setup

1. Enable the Google Search Console API in Google Cloud.
2. Configure the Google OAuth web client in Supabase Auth.
3. Add this authorized redirect URI in Google Cloud:

   ```text
   https://bbihthevyhrjemiwqzwh.supabase.co/auth/v1/callback
   ```

4. Apply the SQL in [`supabase/schema.sql`](supabase/schema.sql).
5. Copy `.env.example` to `.env` and fill server-only secrets:
   - `SUPABASE_SECRET_KEY`
   - `GOOGLE_CLIENT_SECRET`
   - `TOKEN_ENCRYPTION_KEY`
   - `OAUTH_STATE_SECRET`

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
