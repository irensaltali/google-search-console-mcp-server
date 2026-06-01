import { describe, expect, it } from "vitest";
import { searchAnalyticsSchema, siteUrlSchema } from "../src/schemas.js";

describe("schemas", () => {
  it("accepts URL-prefix and domain Search Console properties", () => {
    expect(siteUrlSchema.safeParse("https://example.com/").success).toBe(true);
    expect(siteUrlSchema.safeParse("sc-domain:example.com").success).toBe(true);
  });

  it("caps Search Analytics rowLimit at Google's maximum", () => {
    expect(searchAnalyticsSchema.safeParse({
      siteUrl: "https://example.com/",
      startDate: "2026-05-01",
      endDate: "2026-05-31",
      rowLimit: 25001
    }).success).toBe(false);
  });

  it("rejects inverted date ranges", () => {
    expect(searchAnalyticsSchema.safeParse({
      siteUrl: "https://example.com/",
      startDate: "2026-05-31",
      endDate: "2026-05-01"
    }).success).toBe(false);
  });
});
