import { describe, expect, it } from "vitest";
import { normalizeDate, toRateEntries } from "../src/lib/rate-ingest";
import type { RateExtraction } from "../src/lib/prompts/rate-ingest";

describe("normalizeDate", () => {
  it("passes ISO through", () => expect(normalizeDate("2024-04-01")).toBe("2024-04-01"));
  it("converts DD-MM-YYYY", () => expect(normalizeDate("01-04-2024")).toBe("2024-04-01"));
  it("pads single digits", () => expect(normalizeDate("1/4/2024")).toBe("2024-04-01"));
  it("returns null for junk", () => expect(normalizeDate("April 2024")).toBeNull());
  it("returns null for null", () => expect(normalizeDate(null)).toBeNull());
});

function extraction(rows: RateExtraction["rows"], effective_date: string | null = "2024-04-01"): RateExtraction {
  return { effective_date, rows };
}

const goodRow = {
  locality_native: "ಯಲಹಂಕ",
  locality_romanized: "Yelahanka",
  taluk: "Bengaluru North",
  hobli: null,
  property_type: "residential_site" as const,
  road_width_category: "12 ಮೀ ವರೆಗೆ",
  rate_per_sqft_inr: 6500,
  effective_date: null,
};

describe("toRateEntries", () => {
  it("wraps a valid row into a strict RateEntry with citation", () => {
    const { entries, warnings } = toRateEntries(extraction([goodRow]), "ka_north.pdf");
    expect(warnings).toEqual([]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      state: "KA",
      district: "Bengaluru Urban",
      taluk: "Bengaluru North",
      locality_romanized: "Yelahanka",
      property_type: "residential_site",
      rate_per_sqft_inr: 6500,
      effective_date: "2024-04-01",
      source_notification: "ka_north.pdf",
    });
  });

  it("falls back to the file-level effective date", () => {
    const { entries } = toRateEntries(extraction([{ ...goodRow, effective_date: null }], "2024-04-01"), "f.pdf");
    expect(entries[0].effective_date).toBe("2024-04-01");
  });

  it("skips a row with no resolvable date and warns", () => {
    const { entries, warnings } = toRateEntries(extraction([goodRow], null), "f.pdf");
    expect(entries).toHaveLength(0);
    expect(warnings[0]).toMatch(/no effective date/);
  });

  it("skips a non-positive rate", () => {
    const { entries, warnings } = toRateEntries(extraction([{ ...goodRow, rate_per_sqft_inr: 0 }]), "f.pdf");
    expect(entries).toHaveLength(0);
    expect(warnings[0]).toMatch(/non-positive/);
  });

  it("rounds fractional rates and preserves native + romanized", () => {
    const { entries } = toRateEntries(extraction([{ ...goodRow, rate_per_sqft_inr: 6499.6 }]), "f.pdf");
    expect(entries[0].rate_per_sqft_inr).toBe(6500);
    expect(entries[0].locality_native).toBe("ಯಲಹಂಕ");
  });
});
