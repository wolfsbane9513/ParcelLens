import { z } from "zod";

// The model's I/O contract. Deliberately looser than ParcelRecordSchema:
// - no .min()/.nonnegative() refinements (structured-output JSON schema can't
//   express them and the SDK would reject the format)
// - raw facts only — the server assigns ids, computes sqft_normalized, and
//   merges documents. The model never guesses derived values.
// Per-field confidence is an intermediate signal used to drive null-vs-value
// and the overall score; it is NOT persisted (see AGENTS §3 on schema changes).

export const DocExtractionSchema = z.object({
  is_property_document: z.boolean(),
  doc_type: z.enum(["sale_deed", "encumbrance_certificate", "khata", "rtc", "other"]),
  language: z.enum(["kn", "hi", "ta", "te", "mr", "en"]),
  overall_confidence: z.number(),
  identifiers: z.object({
    survey_number: z.string().nullable(),
    site_number: z.string().nullable(),
    khata_number: z.string().nullable(),
    village: z.string().nullable(),
    hobli: z.string().nullable(),
    taluk: z.string().nullable(),
    district: z.string().nullable(),
    state: z.string().nullable(),
    pin_code: z.string().nullable(),
  }),
  extent: z.object({
    value: z.number().nullable(),
    unit: z.enum(["sqft", "sqm", "acre", "gunta", "cent"]).nullable(),
  }),
  parties: z.object({
    sellers: z.array(z.string()),
    buyers: z.array(z.string()),
  }),
  consideration: z.object({
    amount_inr: z.number().nullable(),
    date: z.string().nullable(),
  }),
  chain_of_title: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      instrument: z.enum(["sale", "gift", "partition", "inheritance", "court_order"]),
      date: z.string().nullable(),
      registration_number: z.string().nullable(),
    }),
  ),
  encumbrances: z.array(
    z.object({
      type: z.enum(["mortgage", "lien", "lease", "court_attachment"]),
      holder: z.string(),
      amount_inr: z.number().nullable(),
      status: z.enum(["active", "discharged"]),
      date: z.string().nullable(),
    }),
  ),
  boundaries: z.object({
    north: z.string().nullable(),
    south: z.string().nullable(),
    east: z.string().nullable(),
    west: z.string().nullable(),
  }),
});

export type DocExtraction = z.infer<typeof DocExtractionSchema>;

// v1 — shown in the demo video as a "key decision". Bump the version suffix on
// any material change so the prompt history is auditable.
export const EXTRACTION_PROMPT_V1 = `You are ParcelLens, an expert at reading Indian property documents (sale deeds, encumbrance certificates, khata/RTC extracts) written in regional languages — Kannada, Hindi, Tamil, Telugu, Marathi — as well as English.

First decide whether the image/PDF is actually a property document. If it is a cat photo, a receipt, a random screenshot, or anything that is not a land/property record, set is_property_document to false and return empty/null values for everything else. Do NOT invent property data.

If it is a property document:
- Classify doc_type and language.
- Extract every field that is explicitly present. Return null (for scalars) or an empty array for anything NOT present in the document. NEVER guess, infer, or fabricate a value. A blank field is more useful than a wrong one.
- Names and localities: transcribe as written; you may keep the native script.
- Amounts: return integer rupees. Convert Indian notation correctly — "72,00,000" is 7200000; "₹45 lakh" is 4500000; "1.2 crore" is 12000000.
- Dates: ISO format YYYY-MM-DD, or null if absent or unparseable. Interpret DD-MM-YYYY as day-month-year (Indian convention).
- extent.value and extent.unit: the area exactly as stated (e.g. 1200 sqft, 2 acre, 40 gunta). Leave both null if no extent is stated. Do not convert units yourself.
- chain_of_title: each recorded transfer as {from, to, instrument, date, registration_number}. Encumbrance certificates list these transactions — extract them in order.
- encumbrances: mortgages, liens, leases, court attachments. status is "active" unless the document clearly shows it discharged/closed.
- boundaries: the N/S/E/W abutting descriptions if present.
- overall_confidence: 0.0–1.0 reflecting how legible the document was and how sure you are of the extraction. Lower it for blurry scans, ambiguous handwriting, or partial pages.

Return only the structured object.`;

export const EXTRACTION_PROMPT_VERSION = "extraction/v1";
