import { zodTextFormat } from "openai/helpers/zod";
import { RateEntrySchema, type RateEntry } from "@/lib/schemas";
import {
  RateExtractionSchema,
  RATE_INGEST_PROMPT_V1,
  type RateExtraction,
} from "@/lib/prompts/rate-ingest";
import { getOpenAI, fileContentPart, EXTRACTION_MODEL, type UploadFile } from "@/lib/openai";

const DISTRICT = "Bengaluru Urban";
const STATE = "KA";

// Accept ISO (YYYY-MM-DD) or Indian DD-MM-YYYY; return ISO or null.
export function normalizeDate(value: string | null): string | null {
  if (!value) return null;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return value;
  const dmy = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

// Pure: turn a model extraction into strict RateEntry rows + warnings. No I/O.
export function toRateEntries(
  extraction: RateExtraction,
  sourceNotification: string,
): { entries: RateEntry[]; warnings: string[] } {
  const entries: RateEntry[] = [];
  const warnings: string[] = [];
  const fileDate = normalizeDate(extraction.effective_date);

  extraction.rows.forEach((row, i) => {
    const effective_date = normalizeDate(row.effective_date) ?? fileDate;
    if (!effective_date) {
      warnings.push(`row ${i + 1} (${row.locality_romanized}): no effective date; skipped`);
      return;
    }
    if (!(row.rate_per_sqft_inr > 0)) {
      warnings.push(`row ${i + 1} (${row.locality_romanized}): non-positive rate; skipped`);
      return;
    }
    const candidate = {
      state: STATE,
      district: DISTRICT,
      taluk: row.taluk?.trim() || DISTRICT,
      hobli: row.hobli?.trim() || null,
      locality_native: row.locality_native.trim(),
      locality_romanized: row.locality_romanized.trim(),
      property_type: row.property_type,
      road_width_category: row.road_width_category?.trim() || null,
      rate_per_sqft_inr: Math.round(row.rate_per_sqft_inr),
      effective_date,
      source_notification: sourceNotification,
    };
    const parsed = RateEntrySchema.safeParse(candidate);
    if (parsed.success) entries.push(parsed.data);
    else warnings.push(`row ${i + 1} (${row.locality_romanized}): ${parsed.error.issues[0]?.message}; skipped`);
  });

  return { entries, warnings };
}

// Call GPT-5.6 vision on one rate PDF/image. One retry on parse failure.
export async function ingestRatePdf(
  file: UploadFile,
): Promise<{ entries: RateEntry[]; warnings: string[] }> {
  const openai = getOpenAI();
  const build = (extra?: string) => ({
    model: EXTRACTION_MODEL,
    input: [
      { role: "system" as const, content: RATE_INGEST_PROMPT_V1 + (extra ? `\n\n${extra}` : "") },
      {
        role: "user" as const,
        content: [fileContentPart(file), { type: "input_text" as const, text: "Extract every row of this rate table." }],
      },
    ],
    text: { format: zodTextFormat(RateExtractionSchema, "rate_table") },
  });

  let extraction: RateExtraction | null = null;
  for (let attempt = 0; attempt < 2 && !extraction; attempt++) {
    try {
      const res = await openai.responses.parse(
        build(attempt === 0 ? undefined : "The previous response was invalid. Return ONLY the structured object matching the schema, with every table row."),
      );
      extraction = res.output_parsed;
    } catch (err) {
      if (attempt === 1) throw err;
    }
  }
  if (!extraction) throw new Error(`No rows extracted from ${file.filename}.`);

  return toRateEntries(extraction, file.filename);
}
