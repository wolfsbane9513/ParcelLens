import { describe, expect, it } from "vitest";
import { calculateValuation, pickRate, KA_COST_CONFIG } from "../src/lib/valuation";
import type { RateEntry } from "../src/lib/schemas";

const rate = (over: Partial<RateEntry> = {}): RateEntry => ({
  state: "KA", district: "Bengaluru Urban", taluk: "Bengaluru North", hobli: null,
  locality_native: "ಯಲಹಂಕ", locality_romanized: "Yelahanka",
  property_type: "residential_site", road_width_category: "12 ಮೀ ವರೆಗೆ",
  rate_per_sqft_inr: 6500, effective_date: "2024-04-01", source_notification: "ka_north.pdf",
  ...over,
});

describe("pickRate", () => {
  const rates = [
    rate({ rate_per_sqft_inr: 6500, road_width_category: "12 ಮೀ ವರೆಗೆ" }),
    rate({ rate_per_sqft_inr: 7670, road_width_category: "12–24 ಮೀ" }),
    rate({ property_type: "apartment", rate_per_sqft_inr: 5980, road_width_category: null }),
    rate({ locality_romanized: "Whitefield", rate_per_sqft_inr: 8800 }),
  ];
  it("picks the base (lowest) residential rate for the locality", () => {
    expect(pickRate(rates, "Yelahanka")?.rate_per_sqft_inr).toBe(6500);
  });
  it("respects an explicit property type", () => {
    expect(pickRate(rates, "Yelahanka", { propertyType: "apartment" })?.rate_per_sqft_inr).toBe(5980);
  });
  it("returns null for an unknown locality", () => {
    expect(pickRate(rates, "Nowhere")).toBeNull();
  });
});

describe("calculateValuation", () => {
  it("computes a below-guidance deal to the rupee", () => {
    const v = calculateValuation({
      rate: rate({ rate_per_sqft_inr: 6500 }),
      match_method: "exact", match_confidence: 1,
      deal_price_inr: 7_200_000, sqft_normalized: 1200,
    });
    expect(v.guidance_value_total_inr).toBe(7_800_000); // 6500 * 1200
    expect(v.duty_basis_inr).toBe(7_800_000); // max(deal, guidance)
    expect(v.stamp_duty_inr).toBe(390_000); // 5%
    expect(v.cess_inr).toBe(39_000); // 10% of stamp
    expect(v.surcharge_inr).toBe(7_800); // 2% of stamp
    expect(v.registration_fee_inr).toBe(156_000); // 2% of basis
    expect(v.total_transaction_cost_inr).toBe(592_800);
    expect(v.gap_pct).toBeCloseTo(-0.076923, 5);
    expect(v.flags).toContain("BELOW_GUIDANCE");
  });

  it("does not flag a deal at or above guidance and computes duty on the deal", () => {
    const v = calculateValuation({
      rate: rate({ rate_per_sqft_inr: 5000 }),
      match_method: "exact", match_confidence: 1,
      deal_price_inr: 7_200_000, sqft_normalized: 1200,
    });
    expect(v.guidance_value_total_inr).toBe(6_000_000);
    expect(v.duty_basis_inr).toBe(7_200_000); // deal is higher
    expect(v.stamp_duty_inr).toBe(360_000);
    expect(v.total_transaction_cost_inr).toBe(360_000 + 36_000 + 7_200 + 144_000);
    expect(v.gap_pct).toBeCloseTo(0.2, 5);
    expect(v.flags).not.toContain("BELOW_GUIDANCE");
  });

  it("handles a missing rate gracefully (no guidance, no BELOW_GUIDANCE)", () => {
    const v = calculateValuation({
      rate: null, match_method: "none", match_confidence: 0,
      deal_price_inr: 7_200_000, sqft_normalized: 1200,
    });
    expect(v.matched_rate).toBeNull();
    expect(v.match_method).toBe("none");
    expect(v.guidance_value_total_inr).toBe(0);
    expect(v.gap_pct).toBe(0);
    expect(v.duty_basis_inr).toBe(7_200_000); // still estimable from the deal
    expect(v.stamp_duty_inr).toBe(360_000);
    expect(v.flags).toEqual([]);
  });

  it("handles zero/absent extent gracefully", () => {
    const v = calculateValuation({
      rate: rate({ rate_per_sqft_inr: 6500 }),
      match_method: "exact", match_confidence: 1,
      deal_price_inr: 7_200_000, sqft_normalized: 0,
    });
    expect(v.guidance_value_total_inr).toBe(0);
    expect(v.gap_pct).toBe(0);
    expect(v.flags).toEqual([]);
  });

  it("uses the documented Karnataka config percentages", () => {
    expect(KA_COST_CONFIG.stamp_duty_pct).toBe(0.05);
    expect(KA_COST_CONFIG.verify_before_use).toBe(true);
  });
});
