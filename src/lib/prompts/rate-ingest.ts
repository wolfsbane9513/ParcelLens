import { z } from "zod";

// LLM I/O contract for guidance-value table extraction. Loose (no refinements);
// the ingester wraps each row into the strict RateEntry with state/district/
// source citation and zod-validates. Root is an object — structured-output
// roots cannot be a bare array.
export const RateExtractionSchema = z.object({
  effective_date: z.string().nullable(), // notification-wide date from the header
  rows: z.array(
    z.object({
      locality_native: z.string(),
      locality_romanized: z.string(),
      taluk: z.string().nullable(),
      hobli: z.string().nullable(),
      property_type: z.enum(["residential_site", "apartment", "agricultural", "commercial"]),
      road_width_category: z.string().nullable(),
      rate_per_sqft_inr: z.number(),
      effective_date: z.string().nullable(), // per-row override if the table has one
    }),
  ),
});

export type RateExtraction = z.infer<typeof RateExtractionSchema>;

// v1 — versioned constant, shown in the demo as a key decision.
export const RATE_INGEST_PROMPT_V1 = `You are ParcelLens, reading a government guidance-value (circle-rate) notification for property in Karnataka, India. The document is a table, often in Kannada, listing per-locality land rates.

Extract EVERY data row of the rate table. Long tables are easy to truncate — do not stop early; return all rows you can see across all pages.

For each row:
- locality_native: the locality/area/village name exactly as printed (keep the native script).
- locality_romanized: the same name transliterated into Latin script (e.g. ಯಲಹಂಕ -> "Yelahanka").
- taluk and hobli: if the header or row states them; else null.
- property_type: map to one of residential_site | apartment | agricultural | commercial. "ವಸತಿ ನಿವೇಶನ"/residential plot -> residential_site; "ಅಪಾರ್ಟ್‌ಮೆಂಟ್"/flat -> apartment; "ಕೃಷಿ"/agricultural land -> agricultural; "ವಾಣಿಜ್ಯ"/commercial -> commercial.
- road_width_category: the road-width band if the row/column gives one (keep as written), else null.
- rate_per_sqft_inr: the guidance rate as an INTEGER of rupees per square foot. If the table gives a rate per square metre, convert to per square foot (1 sqm = 10.7639 sqft) and round. If a range is given, use the upper value.

Also read the notification's overall effective_date (ISO YYYY-MM-DD) from the header if present.

Return only the structured object. Never invent localities or rates that are not in the document.`;

export const RATE_INGEST_PROMPT_VERSION = "rate-ingest/v1";
