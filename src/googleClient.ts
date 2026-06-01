import { google, searchconsole_v1 } from "googleapis";
import type { AppConfig } from "./config.js";

export type SearchAnalyticsRequest = searchconsole_v1.Schema$SearchAnalyticsQueryRequest;

export class GoogleSearchConsoleClient {
  private readonly service: searchconsole_v1.Searchconsole;

  constructor(config: AppConfig, providerRefreshToken: string) {
    const auth = new google.auth.OAuth2(
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials({ refresh_token: providerRefreshToken });
    this.service = google.searchconsole({ version: "v1", auth });
  }

  async listSites() {
    const response = await this.service.sites.list();
    return response.data.siteEntry ?? [];
  }

  async getSite(siteUrl: string) {
    const response = await this.service.sites.get({ siteUrl });
    return response.data;
  }

  async addSite(siteUrl: string) {
    await this.service.sites.add({ siteUrl });
    return { siteUrl, added: true };
  }

  async deleteSite(siteUrl: string) {
    await this.service.sites.delete({ siteUrl });
    return { siteUrl, deleted: true };
  }

  async querySearchAnalytics(siteUrl: string, requestBody: SearchAnalyticsRequest) {
    const response = await this.service.searchanalytics.query({
      siteUrl,
      requestBody
    });
    return response.data;
  }

  async inspectUrl(siteUrl: string, inspectionUrl: string, languageCode?: string) {
    const response = await this.service.urlInspection.index.inspect({
      requestBody: {
        siteUrl,
        inspectionUrl,
        languageCode
      }
    });
    return response.data;
  }

  async listSitemaps(siteUrl: string, sitemapIndex?: string) {
    const response = await this.service.sitemaps.list({ siteUrl, sitemapIndex });
    return response.data;
  }

  async getSitemap(siteUrl: string, feedpath: string) {
    const response = await this.service.sitemaps.get({ siteUrl, feedpath });
    return response.data;
  }

  async submitSitemap(siteUrl: string, feedpath: string) {
    await this.service.sitemaps.submit({ siteUrl, feedpath });
    return { siteUrl, feedpath, submitted: true };
  }

  async deleteSitemap(siteUrl: string, feedpath: string) {
    await this.service.sitemaps.delete({ siteUrl, feedpath });
    return { siteUrl, feedpath, deleted: true };
  }
}

export function normalizeGoogleError(error: unknown): Error {
  if (error instanceof Error) {
    const maybeApiError = error as Error & {
      code?: number;
      errors?: Array<{ reason?: string; message?: string }>;
      response?: { data?: { error?: { message?: string; status?: string } } };
    };
    const status = maybeApiError.code ?? maybeApiError.response?.data?.error?.status;
    const reason = maybeApiError.errors?.[0]?.reason;
    const message = maybeApiError.response?.data?.error?.message ?? maybeApiError.message;
    return new Error(`Google Search Console API error${status ? ` (${status})` : ""}${reason ? ` [${reason}]` : ""}: ${message}`);
  }

  return new Error("Unknown Google Search Console API error");
}
