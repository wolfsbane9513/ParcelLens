import { z } from "zod";

const dateValue = z.string().min(10);
const confidence = z.number().min(0).max(1);

export const DocumentTypeSchema = z.enum(["sale_deed", "encumbrance_certificate", "khata", "rtc", "other"]);
export const LanguageSchema = z.enum(["kn", "hi", "ta", "te", "mr", "en"]);

export const SourceDocumentSchema = z.object({
  doc_id: z.string().min(1),
  doc_type: DocumentTypeSchema,
  language: LanguageSchema,
  filename: z.string().min(1),
  extraction_confidence: confidence,
});

export const ParcelIdentifiersSchema = z.object({
  survey_number: z.string().nullable(),
  site_number: z.string().nullable(),
  khata_number: z.string().nullable(),
  village: z.string().nullable(),
  hobli: z.string().nullable(),
  taluk: z.string().nullable(),
  district: z.string().nullable(),
  state: z.string().min(2).max(3),
  pin_code: z.string().nullable(),
});

export const ExtentSchema = z.object({
  value: z.number().nonnegative(),
  unit: z.enum(["sqft", "sqm", "acre", "gunta", "cent"]),
  sqft_normalized: z.number().nonnegative(),
});

export const ChainEntrySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  instrument: z.enum(["sale", "gift", "partition", "inheritance", "court_order"]),
  date: dateValue.nullable(),
  registration_number: z.string().nullable(),
});

export const EncumbranceSchema = z.object({
  type: z.enum(["mortgage", "lien", "lease", "court_attachment"]),
  holder: z.string().min(1),
  amount_inr: z.number().nonnegative(),
  status: z.enum(["active", "discharged"]),
  date: dateValue.nullable(),
});

export const RiskFlagSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["red", "amber", "info"]),
  message: z.string().min(1),
  evidence_doc_id: z.string().nullable(),
});

export const RateEntrySchema = z.object({
  state: z.string().min(2).max(3),
  district: z.string().min(1),
  taluk: z.string().min(1),
  hobli: z.string().nullable(),
  locality_native: z.string().min(1),
  locality_romanized: z.string().min(1),
  property_type: z.enum(["residential_site", "apartment", "agricultural", "commercial"]),
  road_width_category: z.string().nullable(),
  rate_per_sqft_inr: z.number().nonnegative(),
  effective_date: dateValue,
  source_notification: z.string().min(1),
});

export const ValuationResultSchema = z.object({
  matched_rate: RateEntrySchema.nullable(),
  match_confidence: confidence,
  match_method: z.enum(["exact", "embedding", "llm_adjudicated", "none"]),
  guidance_value_total_inr: z.number().nonnegative(),
  deal_price_inr: z.number().nonnegative(),
  gap_pct: z.number(),
  duty_basis_inr: z.number().nonnegative(),
  stamp_duty_inr: z.number().nonnegative(),
  cess_inr: z.number().nonnegative(),
  surcharge_inr: z.number().nonnegative(),
  registration_fee_inr: z.number().nonnegative(),
  total_transaction_cost_inr: z.number().nonnegative(),
  flags: z.array(z.string()),
});

export const ParcelRecordSchema = z.object({
  parcel_id: z.string().min(1),
  created_at: dateValue,
  source_documents: z.array(SourceDocumentSchema),
  identifiers: ParcelIdentifiersSchema,
  extent: ExtentSchema,
  parties: z.object({ sellers: z.array(z.string()), buyers: z.array(z.string()) }),
  consideration: z.object({ amount_inr: z.number().nonnegative(), date: dateValue.nullable() }),
  chain_of_title: z.array(ChainEntrySchema),
  encumbrances: z.array(EncumbranceSchema),
  boundaries: z.object({ north: z.string().nullable(), south: z.string().nullable(), east: z.string().nullable(), west: z.string().nullable() }),
  geo: z.object({ lat: z.number(), lng: z.number(), precision: z.enum(["parcel", "locality", "village", "manual"]), source: z.enum(["geocode", "manual"]) }),
  risk_flags: z.array(RiskFlagSchema),
  valuation: ValuationResultSchema.nullable(),
});

export type DocumentType = z.infer<typeof DocumentTypeSchema>;
export type Language = z.infer<typeof LanguageSchema>;
export type SourceDocument = z.infer<typeof SourceDocumentSchema>;
export type ParcelRecord = z.infer<typeof ParcelRecordSchema>;
export type RateEntry = z.infer<typeof RateEntrySchema>;
export type RiskFlag = z.infer<typeof RiskFlagSchema>;
export type ValuationResult = z.infer<typeof ValuationResultSchema>;
