import type { ParcelRecord } from "@/lib/schemas";

export type Severity = "red" | "amber" | "green";

// Single source of truth for a parcel's overall risk colour — used by both the
// map pins and the parcel card so they can never disagree.
export function parcelSeverity(parcel: ParcelRecord): Severity {
  if (parcel.risk_flags.some((f) => f.severity === "red")) return "red";
  if (parcel.risk_flags.some((f) => f.severity === "amber")) return "amber";
  return "green";
}

export const SEVERITY_COLOR: Record<Severity, string> = {
  red: "#b91c1c",
  amber: "#b45309",
  green: "#2f7d4f",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  red: "Blocking issues",
  amber: "Needs review",
  green: "Clear",
};
