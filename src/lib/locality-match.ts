import type { ParcelRecord, RateEntry } from "@/lib/schemas";

export function matchLocality(_parcel: ParcelRecord, _rates: RateEntry[]): never {
  throw new Error("Locality matching is implemented in Phase 3.");
}
