import type { ParcelRecord, RiskFlag } from "@/lib/schemas";

export function evaluateRiskFlags(_parcel: ParcelRecord): RiskFlag[] {
  throw new Error("Risk flags are implemented in Phase 1.");
}
