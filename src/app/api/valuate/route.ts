import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ParcelRecordSchema, RateEntrySchema, type RateEntry } from "@/lib/schemas";
import { matchLocality, type LocalityIndexEntry } from "@/lib/locality-match";
import { calculateValuation, pickRate } from "@/lib/valuation";
import { valuationRiskFlags } from "@/lib/risk-flags";

export const runtime = "nodejs";
export const maxDuration = 60;

let cache: { rates: RateEntry[]; index: LocalityIndexEntry[] } | null = null;
async function loadData() {
  if (cache) return cache;
  const [ratesRaw, indexRaw] = await Promise.all([
    readFile(path.resolve("data/rates/ka_bengaluru_urban.json"), "utf8"),
    readFile(path.resolve("data/localities/index.json"), "utf8"),
  ]);
  cache = {
    rates: RateEntrySchema.array().parse(JSON.parse(ratesRaw)),
    index: JSON.parse(indexRaw) as LocalityIndexEntry[],
  };
  return cache;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Expected JSON body { parcel }." }, { status: 400 });
  }

  const parsed = ParcelRecordSchema.safeParse((body as { parcel?: unknown })?.parcel);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Invalid parcel payload." }, { status: 400 });
  }
  const parcel = parsed.data;

  try {
    const { rates, index } = await loadData();
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

    // Refresh valuation-derived flags without disturbing extract-time flags.
    const base = parcel.risk_flags.filter((f) => f.code !== "BELOW_GUIDANCE" && f.code !== "MISSING_CONVERSION");
    parcel.risk_flags = [...base, ...valuationRiskFlags(parcel)];

    return NextResponse.json({ status: "ok", parcel });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: err instanceof Error ? err.message : "Valuation failed." },
      { status: 500 },
    );
  }
}
