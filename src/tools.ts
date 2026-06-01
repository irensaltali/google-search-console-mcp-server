import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GOOGLE_WEBMASTERS_SCOPE } from "./constants.js";
import { confirmSchema, searchAnalyticsSchema, searchAnalyticsShape, siteUrlSchema, urlSchema } from "./schemas.js";
import { connectionUrl, errorResult, jsonResult, withGoogleClient, type ToolContext } from "./toolHelpers.js";

export function createMcpServer(ctx: ToolContext): McpServer {
  const server = new McpServer({
    name: "google-search-console-mcp-server",
    version: "0.1.0"
  });

  server.tool("connect_google_account", "Return the Google OAuth connection URL for this MCP subscriber.", {}, async () => {
    if (!ctx.subscriberId) {
      return errorResult(`Missing MCP subscriber identity. Configure MCPize to send the ${ctx.config.MCPIZE_SUBSCRIBER_HEADER} header.`);
    }

    return jsonResult({
      connected: false,
      authUrl: connectionUrl(ctx),
      scope: GOOGLE_WEBMASTERS_SCOPE
    });
  });

  server.tool("get_connection_status", "Check whether the current MCP subscriber has connected Google Search Console.", {}, async () => {
    if (!ctx.subscriberId) {
      return errorResult(`Missing MCP subscriber identity. Configure MCPize to send the ${ctx.config.MCPIZE_SUBSCRIBER_HEADER} header.`);
    }

    const account = await ctx.accountStore.getAccount(ctx.subscriberId);
    return jsonResult({
      connected: Boolean(account),
      googleEmail: account?.googleEmail,
      scopes: account?.scopes ?? [],
      authUrl: account ? undefined : connectionUrl(ctx)
    });
  });

  server.tool("disconnect_google_account", "Remove the stored Google Search Console connection for this MCP subscriber.", {}, async () => {
    if (!ctx.subscriberId) {
      return errorResult(`Missing MCP subscriber identity. Configure MCPize to send the ${ctx.config.MCPIZE_SUBSCRIBER_HEADER} header.`);
    }

    await ctx.accountStore.deleteAccount(ctx.subscriberId);
    return jsonResult({ disconnected: true });
  });

  server.tool("list_sites", "List Search Console properties available to the connected Google account.", {}, async () =>
    withGoogleClient(ctx, (client) => client.listSites())
  );

  server.tool("get_site", "Get a Search Console property and its permission level.", { siteUrl: siteUrlSchema }, async ({ siteUrl }) =>
    withGoogleClient(ctx, (client) => client.getSite(siteUrl))
  );

  server.tool("add_site", "Add a Search Console property to the connected Google account.", { siteUrl: siteUrlSchema }, async ({ siteUrl }) =>
    withGoogleClient(ctx, async (client, subscriberId) => {
      const result = await client.addSite(siteUrl);
      await ctx.accountStore.recordMutation(subscriberId, "add_site", siteUrl, { siteUrl });
      return result;
    })
  );

  server.tool("delete_site", "Delete a Search Console property from the connected Google account. Requires confirm=true.", {
    siteUrl: siteUrlSchema,
    ...confirmSchema.shape
  }, async ({ siteUrl, confirm }) => {
    if (!confirm) {
      return jsonResult({
        dryRun: true,
        destructive: true,
        message: "Pass confirm=true to delete this Search Console property.",
        siteUrl
      });
    }

    return withGoogleClient(ctx, async (client, subscriberId) => {
      const result = await client.deleteSite(siteUrl);
      await ctx.accountStore.recordMutation(subscriberId, "delete_site", siteUrl, { siteUrl });
      return result;
    });
  });

  server.tool("query_search_analytics", "Query Google Search Console performance data.", searchAnalyticsShape, async (input) => {
    const parsed = searchAnalyticsSchema.parse(input);
    return withGoogleClient(ctx, (client) => client.querySearchAnalytics(parsed.siteUrl, {
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      dimensions: parsed.dimensions,
      type: parsed.searchType,
      aggregationType: parsed.aggregationType,
      dataState: parsed.dataState,
      rowLimit: parsed.rowLimit,
      startRow: parsed.startRow,
      dimensionFilterGroups: parsed.dimensionFilterGroups
    }));
  });

  server.tool("inspect_url", "Inspect Google index status for a URL in a Search Console property.", {
    siteUrl: siteUrlSchema,
    inspectionUrl: urlSchema,
    languageCode: z.string().min(2).max(20).optional()
  }, async ({ siteUrl, inspectionUrl, languageCode }) =>
    withGoogleClient(ctx, (client) => client.inspectUrl(siteUrl, inspectionUrl, languageCode))
  );

  server.tool("list_sitemaps", "List submitted sitemaps for a Search Console property.", {
    siteUrl: siteUrlSchema,
    sitemapIndex: urlSchema.optional()
  }, async ({ siteUrl, sitemapIndex }) =>
    withGoogleClient(ctx, (client) => client.listSitemaps(siteUrl, sitemapIndex))
  );

  server.tool("get_sitemap", "Get one submitted sitemap from a Search Console property.", {
    siteUrl: siteUrlSchema,
    feedpath: urlSchema
  }, async ({ siteUrl, feedpath }) =>
    withGoogleClient(ctx, (client) => client.getSitemap(siteUrl, feedpath))
  );

  server.tool("submit_sitemap", "Submit a sitemap for a Search Console property.", {
    siteUrl: siteUrlSchema,
    feedpath: urlSchema
  }, async ({ siteUrl, feedpath }) =>
    withGoogleClient(ctx, async (client, subscriberId) => {
      const result = await client.submitSitemap(siteUrl, feedpath);
      await ctx.accountStore.recordMutation(subscriberId, "submit_sitemap", feedpath, { siteUrl, feedpath });
      return result;
    })
  );

  server.tool("delete_sitemap", "Delete a sitemap from a Search Console property. Requires confirm=true.", {
    siteUrl: siteUrlSchema,
    feedpath: urlSchema,
    ...confirmSchema.shape
  }, async ({ siteUrl, feedpath, confirm }) => {
    if (!confirm) {
      return jsonResult({
        dryRun: true,
        destructive: true,
        message: "Pass confirm=true to delete this sitemap.",
        siteUrl,
        feedpath
      });
    }

    return withGoogleClient(ctx, async (client, subscriberId) => {
      const result = await client.deleteSitemap(siteUrl, feedpath);
      await ctx.accountStore.recordMutation(subscriberId, "delete_sitemap", feedpath, { siteUrl, feedpath });
      return result;
    });
  });

  return server;
}
