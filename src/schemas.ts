import { z } from "zod";

export const siteUrlSchema = z.string().min(1).refine((value) => {
  if (value.startsWith("sc-domain:")) {
    return value.length > "sc-domain:".length;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}, "Use a URL-prefix property such as https://example.com/ or a domain property such as sc-domain:example.com");

export const urlSchema = z.string().url();

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const dimensionSchema = z.enum(["date", "query", "page", "country", "device", "searchAppearance"]);

const dimensionFilterSchema = z.object({
  dimension: dimensionSchema,
  operator: z.enum(["equals", "notEquals", "contains", "notContains", "includingRegex", "excludingRegex"]),
  expression: z.string().min(1)
});

export const searchAnalyticsShape = {
  siteUrl: siteUrlSchema,
  startDate: dateSchema,
  endDate: dateSchema,
  dimensions: z.array(dimensionSchema).max(5).optional(),
  searchType: z.enum(["web", "image", "video", "news", "discover", "googleNews"]).optional(),
  aggregationType: z.enum(["auto", "byPage", "byProperty", "byNewsShowcasePanel"]).optional(),
  dataState: z.enum(["final", "all", "hourly_all"]).optional(),
  rowLimit: z.number().int().positive().max(25000).optional(),
  startRow: z.number().int().nonnegative().optional(),
  dimensionFilterGroups: z.array(z.object({
    groupType: z.enum(["and"]).optional(),
    filters: z.array(dimensionFilterSchema).min(1)
  })).optional()
};

export const searchAnalyticsSchema = z.object(searchAnalyticsShape).refine(({ startDate, endDate }) => startDate <= endDate, {
  message: "startDate must be before or equal to endDate",
  path: ["startDate"]
});

export const confirmSchema = z.object({
  confirm: z.boolean().optional()
});
