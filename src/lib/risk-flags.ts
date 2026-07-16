import type { ParcelRecord, RiskFlag } from "@/lib/schemas";

// §7.4 rule engine over a merged ParcelRecord. BELOW_GUIDANCE lives in the
// valuation path (Phase 4), so it is intentionally not here.

// Per-document extent, supplied by the extraction merge so EXTENT_MISMATCH can
// compare two source docs — the merged record only keeps one extent.
export type DocExtent = { doc_id: string; sqft_normalized: number };

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\sऀ-ൿ]/g, "") // keep latin, digits, Indic scripts
    .replace(/\s+/g, " ")
    .trim();
}

// ponytail: normalized-equality + containment + Levenshtein ratio. Good enough
// for name-vs-chain fuzzy compare; swap for a transliteration-aware matcher if
// cross-script name matching becomes a demo requirement.
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[n];
}

function namesMatch(a: string, b: string): boolean {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const dist = levenshtein(x, y);
  return 1 - dist / Math.max(x.length, y.length) >= 0.8;
}

export function evaluateRiskFlags(
  parcel: ParcelRecord,
  opts: { docExtents?: DocExtent[] } = {},
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  // CHAIN_GAP — broken linkage (to → next from) or an unbridged > 13-year gap.
  const chain = [...parcel.chain_of_title].sort((p, q) => {
    if (!p.date || !q.date) return 0; // keep extraction order when undated
    return Date.parse(p.date) - Date.parse(q.date);
  });
  for (let i = 0; i < chain.length - 1; i++) {
    const cur = chain[i];
    const next = chain[i + 1];
    if (!namesMatch(cur.to, next.from)) {
      flags.push({
        code: "CHAIN_GAP",
        severity: "red",
        message: `Title chain breaks: "${cur.to}" is not carried forward as the transferor in the next instrument ("${next.from}").`,
        evidence_doc_id: null,
      });
      break; // one flag is enough to block; don't spam the card
    }
    if (cur.date && next.date && Date.parse(next.date) - Date.parse(cur.date) > 13 * YEAR_MS) {
      flags.push({
        code: "CHAIN_GAP",
        severity: "red",
        message: `Title chain has an unexplained ${Math.round((Date.parse(next.date) - Date.parse(cur.date)) / YEAR_MS)}-year gap with no recorded instrument.`,
        evidence_doc_id: null,
      });
      break;
    }
  }

  // ACTIVE_ENCUMBRANCE — any live mortgage/lien/lease/attachment.
  for (const enc of parcel.encumbrances) {
    if (enc.status === "active") {
      flags.push({
        code: "ACTIVE_ENCUMBRANCE",
        severity: "red",
        message: `Active ${enc.type.replace("_", " ")} held by ${enc.holder}${enc.amount_inr ? ` (₹${enc.amount_inr.toLocaleString("en-IN")})` : ""}.`,
        evidence_doc_id: null,
      });
    }
  }

  // EXTENT_MISMATCH — extent differs > 5% between two source documents.
  const extents = (opts.docExtents ?? []).filter((d) => d.sqft_normalized > 0);
  if (extents.length >= 2) {
    const min = Math.min(...extents.map((d) => d.sqft_normalized));
    const max = Math.max(...extents.map((d) => d.sqft_normalized));
    if ((max - min) / min > 0.05) {
      flags.push({
        code: "EXTENT_MISMATCH",
        severity: "amber",
        message: `Extent disagrees across documents: ${min.toLocaleString("en-IN")} vs ${max.toLocaleString("en-IN")} sqft.`,
        evidence_doc_id: null,
      });
    }
  }

  // NAME_MISMATCH — the current seller should be the most recent *prior* owner.
  // A standalone sale deed records its own transaction as seller -> buyer, so we
  // exclude entries whose "to" is a current buyer before checking; with no prior
  // history there is nothing to contradict, so we don't flag.
  const priorChain = chain.filter((c) => !parcel.parties.buyers.some((b) => namesMatch(b, c.to)));
  const lastPriorOwner = priorChain[priorChain.length - 1];
  if (lastPriorOwner && parcel.parties.sellers.length > 0) {
    const sellerMatches = parcel.parties.sellers.some((s) => namesMatch(s, lastPriorOwner.to));
    if (!sellerMatches) {
      flags.push({
        code: "NAME_MISMATCH",
        severity: "amber",
        message: `Selling party (${parcel.parties.sellers.join(", ")}) does not match the last recorded owner in the title chain (${lastPriorOwner.to}).`,
        evidence_doc_id: null,
      });
    }
  }

  // LOW_EXTRACTION_CONFIDENCE — any doc read with low confidence.
  for (const doc of parcel.source_documents) {
    if (doc.extraction_confidence < 0.7) {
      flags.push({
        code: "LOW_EXTRACTION_CONFIDENCE",
        severity: "info",
        message: `Low confidence reading ${doc.filename} — verify extracted fields manually.`,
        evidence_doc_id: doc.doc_id,
      });
    }
  }

  return flags;
}

// Flags that only exist once a valuation is attached (Phase 4). Kept separate so
// re-running them doesn't require the extract-time per-doc extents.
export function valuationRiskFlags(parcel: ParcelRecord): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const v = parcel.valuation;
  if (!v) return flags;

  // BELOW_GUIDANCE — registration-blocking in Karnataka.
  if (v.flags.includes("BELOW_GUIDANCE")) {
    flags.push({
      code: "BELOW_GUIDANCE",
      severity: "red",
      message: `Deal price ₹${v.deal_price_inr.toLocaleString("en-IN")} is below the guidance value ₹${v.guidance_value_total_inr.toLocaleString("en-IN")} — registration is blocked in Karnataka until duty is paid on the higher value.`,
      evidence_doc_id: null,
    });
  }

  // MISSING_CONVERSION — rate match is agricultural but the parcel is a site.
  if (v.matched_rate?.property_type === "agricultural") {
    flags.push({
      code: "MISSING_CONVERSION",
      severity: "amber",
      message: "Guidance rate is agricultural but the parcel is used as a residential site — check for land-use conversion (DC conversion).",
      evidence_doc_id: null,
    });
  }

  return flags;
}
