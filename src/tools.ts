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

  server.registerPrompt("debug_indexing_issue", {
    title: "Debug Indexing Issue",
    description: "Guide the model through a Search Console indexing diagnosis for one URL.",
    argsSchema: {
      siteUrl: siteUrlSchema,
      inspectionUrl: urlSchema,
      languageCode: z.string().min(2).max(20).optional()
    }
  }, async ({ siteUrl, inspectionUrl, languageCode }) => ({
    description: `Diagnose why ${inspectionUrl} is or is not indexed in Search Console.`,
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: [
          `Investigate an indexing issue for ${inspectionUrl} under the Search Console property ${siteUrl}.`,
          "",
          "Workflow:",
          "1. Call get_connection_status first. If the account is not connected, stop and tell the user to connect Google Search Console.",
          `2. Call inspect_url with siteUrl=${siteUrl}, inspectionUrl=${inspectionUrl}${languageCode ? `, languageCode=${languageCode}` : ""}.`,
          "3. If the inspection result suggests sitemap, coverage, or canonical problems, call list_sitemaps for the same property and inspect the relevant sitemap with get_sitemap when useful.",
          "4. Summarize the exact Search Console findings before giving advice.",
          "",
          "Output requirements:",
          "- State whether the URL is indexed, excluded, or unclear based on the API result.",
          "- Quote the most important inspection fields and issue labels verbatim where possible.",
          "- Separate observed facts from your recommendations.",
          "- Give the user the next 3 highest-signal actions only.",
          "",
          "Important caveat:",
          "- The URL Inspection API reports the status of the version in the Google index. It does not test live indexability."
        ].join("\n")
      }
    }]
  }));

  server.registerPrompt("summarize_search_performance", {
    title: "Summarize Search Performance",
    description: "Build a Search Console performance summary for a site and date range.",
    argsSchema: {
      siteUrl: siteUrlSchema,
      startDate: z.string().min(1),
      endDate: z.string().min(1),
      searchType: z.enum(["web", "image", "video", "news", "discover", "googleNews"]).optional(),
      focus: z.enum(["overview", "queries", "pages", "devices", "countries"]).optional()
    }
  }, async ({ siteUrl, startDate, endDate, searchType, focus }) => ({
    description: `Summarize Search Console performance for ${siteUrl} from ${startDate} to ${endDate}.`,
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: [
          `Prepare a Search Console performance summary for ${siteUrl} covering ${startDate} through ${endDate}.`,
          "",
          "Workflow:",
          "1. Call get_connection_status first. If disconnected, stop and ask the user to connect Google Search Console.",
          `2. Call query_search_analytics for the main summary with siteUrl=${siteUrl}, startDate=${startDate}, endDate=${endDate}${searchType ? `, searchType=${searchType}` : ""}.`,
          "3. Run follow-up query_search_analytics calls with dimensions that match the requested focus. Use query, page, device, and country when relevant.",
          "4. Keep the analysis tied to returned data. Do not invent causes that the API does not show.",
          "",
          "Output requirements:",
          "- Lead with clicks, impressions, CTR, and average position.",
          `- Focus area: ${focus ?? "overview"}.`,
          "- Highlight the strongest winners, biggest declines, and the clearest opportunities.",
          "- If data is sparse, say so plainly.",
          "- End with a short action list based on the observed numbers."
        ].join("\n")
      }
    }]
  }));

  server.registerPrompt("find_ctr_opportunities", {
    title: "Find CTR Opportunities",
    description: "Use Search Console data to find high-impression, low-CTR query and page opportunities.",
    argsSchema: {
      siteUrl: siteUrlSchema,
      startDate: z.string().min(1),
      endDate: z.string().min(1)
    }
  }, async ({ siteUrl, startDate, endDate }) => ({
    description: `Find high-impression, low-CTR opportunities for ${siteUrl}.`,
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: [
          `Find CTR opportunities in Search Console for ${siteUrl} from ${startDate} to ${endDate}.`,
          "",
          "Workflow:",
          "1. Call get_connection_status first. If disconnected, stop and ask the user to connect Google Search Console.",
          `2. Call query_search_analytics with dimensions=[\"query\"] and then with dimensions=[\"page\"], using siteUrl=${siteUrl}, startDate=${startDate}, endDate=${endDate}.`,
          "3. Prioritize rows with meaningful impressions, weak CTR, and positions where snippet or title improvements could realistically help.",
          "4. When useful, connect promising queries to promising pages instead of listing disconnected rows.",
          "",
          "Output requirements:",
          "- Return the best opportunities first, not a raw dump.",
          "- For each opportunity, include impressions, clicks, CTR, and position from the API output.",
          "- Explain why each item looks fixable.",
          "- Suggest a likely optimization angle such as title rewrite, intent mismatch, richer snippet targeting, or consolidation.",
          "- Avoid giving advice on rows with too little data."
        ].join("\n")
      }
    }]
  }));

  server.registerPrompt("review_sitemap_health", {
    title: "Review Sitemap Health",
    description: "Inspect sitemap coverage and submission state for a Search Console property.",
    argsSchema: {
      siteUrl: siteUrlSchema,
      sitemapIndex: urlSchema.optional()
    }
  }, async ({ siteUrl, sitemapIndex }) => ({
    description: `Review sitemap health for ${siteUrl}.`,
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: [
          `Review sitemap health for the Search Console property ${siteUrl}.`,
          "",
          "Workflow:",
          "1. Call get_connection_status first. If disconnected, stop and ask the user to connect Google Search Console.",
          `2. Call list_sitemaps with siteUrl=${siteUrl}${sitemapIndex ? ` and sitemapIndex=${sitemapIndex}` : ""}.`,
          "3. If any sitemap looks stale, errored, or important, inspect it with get_sitemap.",
          "4. Use submit_sitemap or delete_sitemap only if the user explicitly asks for a change; otherwise stay in review mode.",
          "",
          "Output requirements:",
          "- Group findings into healthy, warning, and needs-attention buckets.",
          "- Mention last submitted or status details when the API returns them.",
          "- Flag missing or suspicious sitemap coverage patterns conservatively.",
          "- Finish with the smallest safe set of next actions."
        ].join("\n")
      }
    }]
  }));

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
