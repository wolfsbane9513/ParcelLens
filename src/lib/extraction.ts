import { zodTextFormat } from "openai/helpers/zod";
import { randomUUID } from "node:crypto";
import { ParcelRecordSchema, type ParcelRecord, type SourceDocument } from "@/lib/schemas";
import {
  DocExtractionSchema,
  EXTRACTION_PROMPT_V1,
  type DocExtraction,
} from "@/lib/prompts/extraction";
import { evaluateRiskFlags, type DocExtent } from "@/lib/risk-flags";
import { getOpenAI, fileContentPart, EXTRACTION_MODEL, type UploadFile } from "@/lib/openai";

export { EXTRACTION_MODEL, type UploadFile };

// One document read result, kept alongside the raw extraction so the merge step
// can weigh confidence and diff per-doc extents.
type ReadDoc = { file: UploadFile; doc_id: string; extraction: DocExtraction };

// sqft per one unit. gunta/cent are Karnataka land units.
const SQFT_PER: Record<string, number> = {
  sqft: 1,
  sqm: 10.7639,
  acre: 43560,
  gunta: 1089,
  cent: 435.6,
};

// Call the model for one document. One retry with the parse error appended, per
// AGENTS §5; never returns unvalidated output.
async function readDocument(file: UploadFile): Promise<DocExtraction> {
  const openai = getOpenAI();
  const input = (extra?: string) => [
    { role: "system" as const, content: EXTRACTION_PROMPT_V1 + (extra ? `\n\n${extra}` : "") },
    {
      role: "user" as const,
      content: [fileContentPart(file), { type: "input_text" as const, text: "Extract this document." }],
    },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await openai.responses.parse({
        model: EXTRACTION_MODEL,
        input: input(attempt === 0 ? undefined : "The previous response was not valid. Return ONLY the structured object exactly matching the schema."),
        text: { format: zodTextFormat(DocExtractionSchema, "doc_extraction") },
      });
      if (res.output_parsed) return res.output_parsed;
    } catch (err) {
      if (attempt === 1) throw err;
    }
  }
  throw new Error(`Could not extract a valid record from ${file.filename}.`);
}

function normKey(s: string | null): string {
  return (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Group documents that describe the same parcel: survey number + village.
function groupByParcel(docs: ReadDoc[]): ReadDoc[][] {
  const groups = new Map<string, ReadDoc[]>();
  for (const d of docs) {
    const id = d.extraction.identifiers;
    // Survey number is the strong parcel identifier; a deed and its EC share it
    // even when one calls the locality a "village" and the other a "hobli".
    // ponytail: same-survey docs in one upload are assumed to be the same parcel.
    const key = normKey(id.survey_number) || normKey(id.village) || normKey(id.site_number) || d.doc_id;
    const bucket = groups.get(key) ?? [];
    bucket.push(d);
    groups.set(key, bucket);
  }
  return [...groups.values()];
}

function firstNonNull<T>(values: (T | null)[]): T | null {
  for (const v of values) if (v !== null && v !== undefined && v !== "") return v;
  return null;
}

// Merge a group of same-parcel documents into one strict ParcelRecord.
function mergeGroup(group: ReadDoc[]): ParcelRecord {
  // Prefer higher-confidence docs when picking a single value.
  const byConfidence = [...group].sort(
    (a, b) => b.extraction.overall_confidence - a.extraction.overall_confidence,
  );
  const saleDeed = group.find((d) => d.extraction.doc_type === "sale_deed") ?? byConfidence[0];

  const source_documents: SourceDocument[] = group.map((d) => ({
    doc_id: d.doc_id,
    doc_type: d.extraction.doc_type,
    language: d.extraction.language,
    filename: d.file.filename,
    extraction_confidence: clamp01(d.extraction.overall_confidence),
  }));

  const ids = byConfidence.map((d) => d.extraction.identifiers);
  const identifiers = {
    survey_number: firstNonNull(ids.map((i) => i.survey_number)),
    site_number: firstNonNull(ids.map((i) => i.site_number)),
    khata_number: firstNonNull(ids.map((i) => i.khata_number)),
    village: firstNonNull(ids.map((i) => i.village)),
    hobli: firstNonNull(ids.map((i) => i.hobli)),
    taluk: firstNonNull(ids.map((i) => i.taluk)),
    district: firstNonNull(ids.map((i) => i.district)),
    state: firstNonNull(ids.map((i) => i.state)) ?? "KA", // Karnataka-focused demo default
    pin_code: firstNonNull(ids.map((i) => i.pin_code)),
  };

  // Extent: take the first doc that reports one (sale deed preferred), normalize.
  const extentDoc = [saleDeed, ...byConfidence].find(
    (d) => d.extraction.extent.value !== null && d.extraction.extent.unit !== null,
  );
  const rawExtent = extentDoc?.extraction.extent;
  const unit = rawExtent?.unit ?? "sqft";
  const value = rawExtent?.value ?? 0;
  const extent = { value, unit, sqft_normalized: Math.round(value * SQFT_PER[unit]) };

  // Parties/consideration/boundaries from the sale deed (it carries the transaction).
  const deed = saleDeed.extraction;
  const parties = {
    sellers: deed.parties.sellers.length ? deed.parties.sellers : firstList(group, (e) => e.parties.sellers),
    buyers: deed.parties.buyers.length ? deed.parties.buyers : firstList(group, (e) => e.parties.buyers),
  };
  const consideration = {
    amount_inr: firstNonNull(byConfidence.map((d) => d.extraction.consideration.amount_inr)) ?? 0,
    date: firstNonNull(byConfidence.map((d) => d.extraction.consideration.date)),
  };

  // Chain + encumbrances: union across docs (the EC usually holds these), deduped.
  const chain_of_title = dedupe(
    group.flatMap((d) => d.extraction.chain_of_title),
    (c) => `${normKey(c.from)}|${normKey(c.to)}|${c.date ?? ""}`,
  );
  const encumbrances = dedupe(
    group.flatMap((d) => d.extraction.encumbrances.map((e) => ({ ...e, amount_inr: e.amount_inr ?? 0 }))),
    (e) => `${e.type}|${normKey(e.holder)}|${e.date ?? ""}`,
  );

  const boundaries = {
    north: firstNonNull(byConfidence.map((d) => d.extraction.boundaries.north)),
    south: firstNonNull(byConfidence.map((d) => d.extraction.boundaries.south)),
    east: firstNonNull(byConfidence.map((d) => d.extraction.boundaries.east)),
    west: firstNonNull(byConfidence.map((d) => d.extraction.boundaries.west)),
  };

  const parcel: ParcelRecord = {
    parcel_id: randomUUID(),
    created_at: new Date().toISOString(),
    source_documents,
    identifiers,
    extent,
    parties,
    consideration,
    chain_of_title,
    encumbrances,
    boundaries,
    // geo is assigned in Phase 3 (locality match); placeholder until then.
    geo: { lat: 0, lng: 0, precision: "manual", source: "manual" },
    risk_flags: [],
    valuation: null,
  };

  // Per-doc extents let EXTENT_MISMATCH compare documents.
  const docExtents: DocExtent[] = group
    .filter((d) => d.extraction.extent.value !== null && d.extraction.extent.unit !== null)
    .map((d) => ({
      doc_id: d.doc_id,
      sqft_normalized: Math.round(d.extraction.extent.value! * SQFT_PER[d.extraction.extent.unit!]),
    }));
  parcel.risk_flags = evaluateRiskFlags(parcel, { docExtents });

  return ParcelRecordSchema.parse(parcel); // strict validation — assembled by us, should always pass
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function firstList(group: ReadDoc[], pick: (e: DocExtraction) => string[]): string[] {
  for (const d of group) {
    const v = pick(d.extraction);
    if (v.length) return v;
  }
  return [];
}

function dedupe<T>(items: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const k = key(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

export type ExtractResult =
  | { status: "ok"; parcels: ParcelRecord[] }
  | { status: "not_a_property_document" }
  | { status: "error"; message: string };

// Public entry: read every uploaded file, drop non-property docs, and merge the
// rest into one ParcelRecord per parcel. Never throws — returns a result union.
export async function extractParcels(files: UploadFile[]): Promise<ExtractResult> {
  if (files.length === 0) return { status: "error", message: "No files uploaded." };
  try {
    const read: ReadDoc[] = [];
    for (const file of files) {
      const extraction = await readDocument(file);
      if (extraction.is_property_document) {
        read.push({ file, doc_id: randomUUID(), extraction });
      }
    }
    if (read.length === 0) return { status: "not_a_property_document" };
    const parcels = groupByParcel(read).map(mergeGroup);
    return { status: "ok", parcels };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Extraction failed." };
  }
}
