import { describe, expect, it } from "vitest";
import { evaluateRiskFlags } from "../src/lib/risk-flags";
import type { ParcelRecord } from "../src/lib/schemas";

function baseParcel(overrides: Partial<ParcelRecord> = {}): ParcelRecord {
  return {
    parcel_id: "p1",
    created_at: "2026-07-15T00:00:00Z",
    source_documents: [
      { doc_id: "d1", doc_type: "sale_deed", language: "kn", filename: "deed.pdf", extraction_confidence: 0.9 },
    ],
    identifiers: {
      survey_number: "45/2", site_number: null, khata_number: null, village: "Yelahanka",
      hobli: null, taluk: "Bengaluru North", district: "Bengaluru Urban", state: "KA", pin_code: null,
    },
    extent: { value: 1200, unit: "sqft", sqft_normalized: 1200 },
    parties: { sellers: ["Ravi Kumar"], buyers: ["Meera Rao"] },
    consideration: { amount_inr: 7200000, date: "2026-06-10" },
    chain_of_title: [],
    encumbrances: [],
    boundaries: { north: null, south: null, east: null, west: null },
    geo: { lat: 13.1, lng: 77.6, precision: "locality", source: "geocode" },
    risk_flags: [],
    valuation: null,
    ...overrides,
  };
}

const codes = (p: ParcelRecord, opts?: Parameters<typeof evaluateRiskFlags>[1]) =>
  evaluateRiskFlags(p, opts).map((f) => f.code);

describe("evaluateRiskFlags", () => {
  it("clean parcel raises no flags", () => {
    expect(evaluateRiskFlags(baseParcel())).toEqual([]);
  });

  it("flags an active encumbrance", () => {
    const p = baseParcel({
      encumbrances: [{ type: "mortgage", holder: "HDFC Bank", amount_inr: 3000000, status: "active", date: "2020-01-01" }],
    });
    expect(codes(p)).toContain("ACTIVE_ENCUMBRANCE");
  });

  it("ignores a discharged encumbrance", () => {
    const p = baseParcel({
      encumbrances: [{ type: "mortgage", holder: "HDFC Bank", amount_inr: 0, status: "discharged", date: "2015-01-01" }],
    });
    expect(codes(p)).not.toContain("ACTIVE_ENCUMBRANCE");
  });

  it("flags a broken title chain (to not carried forward)", () => {
    const p = baseParcel({
      parties: { sellers: ["Suresh Gowda"], buyers: ["Meera Rao"] },
      chain_of_title: [
        { from: "Anand", to: "Bhavani", instrument: "sale", date: "2000-01-01", registration_number: "R1" },
        { from: "Kishore", to: "Suresh Gowda", instrument: "sale", date: "2010-01-01", registration_number: "R2" },
      ],
    });
    expect(codes(p)).toContain("CHAIN_GAP");
  });

  it("flags a > 13-year unbridged gap", () => {
    const p = baseParcel({
      parties: { sellers: ["Bhavani"], buyers: ["Meera Rao"] },
      chain_of_title: [
        { from: "Anand", to: "Bhavani", instrument: "sale", date: "2000-01-01", registration_number: "R1" },
        { from: "Bhavani", to: "Bhavani", instrument: "inheritance", date: "2020-01-01", registration_number: "R2" },
      ],
    });
    expect(codes(p)).toContain("CHAIN_GAP");
  });

  it("accepts a well-linked chain", () => {
    const p = baseParcel({
      parties: { sellers: ["Bhavani"], buyers: ["Meera Rao"] },
      chain_of_title: [
        { from: "Anand", to: "Bhavani", instrument: "sale", date: "2015-01-01", registration_number: "R1" },
        { from: "Bhavani", to: "Bhavani", instrument: "partition", date: "2020-01-01", registration_number: "R2" },
      ],
    });
    expect(codes(p)).not.toContain("CHAIN_GAP");
  });

  it("flags extent mismatch across two documents", () => {
    const p = baseParcel();
    const opts = { docExtents: [
      { doc_id: "d1", sqft_normalized: 1200 },
      { doc_id: "d2", sqft_normalized: 1400 },
    ] };
    expect(codes(p, opts)).toContain("EXTENT_MISMATCH");
  });

  it("tolerates extent within 5%", () => {
    const opts = { docExtents: [
      { doc_id: "d1", sqft_normalized: 1200 },
      { doc_id: "d2", sqft_normalized: 1230 },
    ] };
    expect(codes(baseParcel(), opts)).not.toContain("EXTENT_MISMATCH");
  });

  it("flags seller not matching last recorded owner", () => {
    const p = baseParcel({
      parties: { sellers: ["Someone Else"], buyers: ["Meera Rao"] },
      chain_of_title: [
        { from: "Anand", to: "Bhavani", instrument: "sale", date: "2015-01-01", registration_number: "R1" },
      ],
    });
    expect(codes(p)).toContain("NAME_MISMATCH");
  });

  it("matches seller to owner despite minor spelling/case", () => {
    const p = baseParcel({
      parties: { sellers: ["bhavani  "], buyers: ["Meera Rao"] },
      chain_of_title: [
        { from: "Anand", to: "Bhavani", instrument: "sale", date: "2015-01-01", registration_number: "R1" },
      ],
    });
    expect(codes(p)).not.toContain("NAME_MISMATCH");
  });

  it("does not flag a clean sale deed whose only chain entry is its own sale", () => {
    // Regression: GPT extracts a standalone deed's transaction as seller -> buyer.
    // The buyer is the latest "to" but that must not read as a name mismatch.
    const p = baseParcel({
      parties: { sellers: ["Ravi Kumar", "Asha Kumar"], buyers: ["Meera Rao"] },
      chain_of_title: [
        { from: "Ravi Kumar and Asha Kumar", to: "Meera Rao", instrument: "sale", date: "2026-06-10", registration_number: null },
      ],
    });
    expect(codes(p)).not.toContain("NAME_MISMATCH");
    expect(evaluateRiskFlags(p)).toEqual([]);
  });

  it("raises LOW_EXTRACTION_CONFIDENCE for a weak read", () => {
    const p = baseParcel({
      source_documents: [
        { doc_id: "d1", doc_type: "sale_deed", language: "kn", filename: "blurry.pdf", extraction_confidence: 0.5 },
      ],
    });
    const flags = evaluateRiskFlags(p);
    const low = flags.find((f) => f.code === "LOW_EXTRACTION_CONFIDENCE");
    expect(low?.severity).toBe("info");
    expect(low?.evidence_doc_id).toBe("d1");
  });

  it("reproduces the flawed sample: CHAIN_GAP + ACTIVE_ENCUMBRANCE together", () => {
    const p = baseParcel({
      parties: { sellers: ["Prakash Reddy"], buyers: ["Meera Rao"] },
      chain_of_title: [
        { from: "Original Grantor", to: "Lakshmi Devi", instrument: "sale", date: "1998-01-01", registration_number: "R1" },
        { from: "Prakash Reddy", to: "Prakash Reddy", instrument: "sale", date: "2021-01-01", registration_number: "R2" },
      ],
      encumbrances: [{ type: "mortgage", holder: "Canara Bank", amount_inr: 4500000, status: "active", date: "2019-05-01" }],
    });
    const c = codes(p);
    expect(c).toContain("CHAIN_GAP");
    expect(c).toContain("ACTIVE_ENCUMBRANCE");
  });
});
