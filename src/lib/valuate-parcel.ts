import type { ParcelRecord, RateEntry } from "@/lib/schemas";
import { matchLocality, type LocalityIndexEntry } from "@/lib/locality-match";
import { calculateValuation, pickRate } from "@/lib/valuation";
import { valuationRiskFlags } from "@/lib/risk-flags";

// Match locality -> pick rate -> value -> attach ValuationResult, centroid geo,
// and valuation-derived flags. Shared by POST /api/valuate and the fixture
// builder. Mutates and returns the parcel.
export async function valuateParcel(
  parcel: ParcelRecord,
  rates: RateEntry[],
  index: LocalityIndexEntry[],
): Promise<ParcelRecord> {
  const match = await matchLocality(parcel, index);
  const rate = match ? pickRate(rates, match.locality_romanized) : null;

  parcel.valuation = calculateValuation({
    rate,
    match_method: match?.method ?? "none",
    match_confidence: match?.confidence ?? 0,
    deal_price_inr: parcel.consideration.amount_inr,
    sqft_normalized: parcel.extent.sqft_normalized,
  });
  if (match) parcel.geo = match.geo;

  const base = parcel.risk_flags.filter((f) => f.code !== "BELOW_GUIDANCE" && f.code !== "MISSING_CONVERSION");
  parcel.risk_flags = [...base, ...valuationRiskFlags(parcel)];
  return parcel;
}
