import { describe, expect, it } from "vitest";
import { ParcelRecordSchema } from "../src/lib/schemas";

describe("ParcelRecordSchema", () => {
  it("parses a minimal parcel fixture", () => {
    const result = ParcelRecordSchema.safeParse({
      parcel_id: "parcel-001",
      created_at: "2026-07-15T10:00:00Z",
      source_documents: [{ doc_id: "doc-001", doc_type: "sale_deed", language: "kn", filename: "sale-deed-kn.pdf", extraction_confidence: 0.92 }],
      identifiers: { survey_number: "45/2", site_number: null, khata_number: null, village: "Yelahanka", hobli: null, taluk: "Bengaluru North", district: "Bengaluru Urban", state: "KA", pin_code: "560064" },
      extent: { value: 1200, unit: "sqft", sqft_normalized: 1200 },
      parties: { sellers: ["Ravi Kumar"], buyers: ["Meera Rao"] },
      consideration: { amount_inr: 7200000, date: "2026-06-10" },
      chain_of_title: [],
      encumbrances: [],
      boundaries: { north: null, south: null, east: null, west: null },
      geo: { lat: 13.1007, lng: 77.5963, precision: "locality", source: "geocode" },
      risk_flags: [],
      valuation: null,
    });

    expect(result.success).toBe(true);
  });
});
