import type { ParcelRecord, RateEntry, ValuationResult } from "@/lib/schemas";

export function calculateValuation(_parcel: ParcelRecord, _rates: RateEntry[]): ValuationResult {
  throw new Error("Valuation is implemented in Phase 4.");
}
