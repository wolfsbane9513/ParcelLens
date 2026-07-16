import type { RateEntry, ValuationResult } from "@/lib/schemas";
import { normalizeLocality, type MatchMethod } from "@/lib/locality-match";

// Karnataka stamp-duty / fee constants. verify_before_use: these change with
// state budgets — the UI shows a "rates as configured; verify at SRO" footnote.
// ponytail: single 5% slab per plan §7.3 (residential > ₹45L); the < ₹45L
// concessional slabs exist but the demo parcels are all above the threshold.
export const KA_COST_CONFIG = {
  verify_before_use: true,
  stamp_duty_pct: 0.05, // of duty basis
  cess_pct_of_stamp: 0.1,
  surcharge_pct_of_stamp: 0.02,
  registration_fee_pct: 0.02, // of duty basis
} as const;

// Which rate row applies. The ParcelRecord has no explicit property type, so the
// demo assumes a residential site (the sample deeds are sites). When road width
// is unknown we take the base (lowest) category for that locality.
// ponytail: default property_type is a demo assumption; surface a property-type
// selector on the parcel card if valuation ever needs to cover apartments/commercial.
export function pickRate(
  rates: RateEntry[],
  localityRomanized: string,
  opts: { propertyType?: RateEntry["property_type"] } = {},
): RateEntry | null {
  const loc = normalizeLocality(localityRomanized);
  const propertyType = opts.propertyType ?? "residential_site";
  const candidates = rates.filter(
    (r) => normalizeLocality(r.locality_romanized) === loc && r.property_type === propertyType,
  );
  if (candidates.length === 0) return null;
  // Lowest rate = base road-width category when width is unspecified.
  return candidates.reduce((lo, r) => (r.rate_per_sqft_inr < lo.rate_per_sqft_inr ? r : lo));
}

export type ValuationInput = {
  rate: RateEntry | null;
  match_method: MatchMethod;
  match_confidence: number;
  deal_price_inr: number;
  sqft_normalized: number;
};

// Pure §7.3 computation. No-match and zero-extent both produce a graceful result
// (guidance 0, no BELOW_GUIDANCE) rather than throwing.
export function calculateValuation(input: ValuationInput): ValuationResult {
  const { rate, deal_price_inr, sqft_normalized } = input;
  const c = KA_COST_CONFIG;

  const guidance_value_total_inr = rate ? Math.round(rate.rate_per_sqft_inr * Math.max(0, sqft_normalized)) : 0;
  const duty_basis_inr = Math.max(deal_price_inr, guidance_value_total_inr);

  const stamp_duty_inr = Math.round(duty_basis_inr * c.stamp_duty_pct);
  const cess_inr = Math.round(stamp_duty_inr * c.cess_pct_of_stamp);
  const surcharge_inr = Math.round(stamp_duty_inr * c.surcharge_pct_of_stamp);
  const registration_fee_inr = Math.round(duty_basis_inr * c.registration_fee_pct);
  const total_transaction_cost_inr = stamp_duty_inr + cess_inr + surcharge_inr + registration_fee_inr;

  // gap only meaningful when we have a guidance value to compare against.
  const gap_pct = guidance_value_total_inr > 0 ? (deal_price_inr - guidance_value_total_inr) / guidance_value_total_inr : 0;

  const flags: string[] = [];
  // BELOW_GUIDANCE — registration-blocking in Karnataka. Only when we have both.
  if (guidance_value_total_inr > 0 && deal_price_inr > 0 && deal_price_inr < guidance_value_total_inr) {
    flags.push("BELOW_GUIDANCE");
  }

  return {
    matched_rate: rate,
    match_confidence: input.match_confidence,
    match_method: input.match_method,
    guidance_value_total_inr,
    deal_price_inr,
    gap_pct,
    duty_basis_inr,
    stamp_duty_inr,
    cess_inr,
    surcharge_inr,
    registration_fee_inr,
    total_transaction_cost_inr,
    flags,
  };
}
