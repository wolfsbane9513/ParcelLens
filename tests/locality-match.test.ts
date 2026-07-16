import { describe, expect, it } from "vitest";
import {
  cosineSim,
  decideEmbedding,
  exactMatch,
  localityQueries,
  rankByEmbedding,
  type LocalityIndexEntry,
} from "../src/lib/locality-match";

const geo = { lat: 0, lng: 0, precision: "locality" as const, source: "geocode" as const };
const entry = (romanized: string, native: string, embedding: number[] = []): LocalityIndexEntry => ({
  locality_romanized: romanized,
  locality_native: native,
  embedding,
  geo,
});

const ids = (o: Partial<Record<"village" | "hobli", string | null>>) => ({
  survey_number: "45/2", site_number: null, khata_number: null,
  village: o.village ?? null, hobli: o.hobli ?? null, taluk: null, district: null,
  state: "KA", pin_code: null,
});

describe("cosineSim", () => {
  it("is 1 for identical vectors", () => expect(cosineSim([1, 2, 3], [1, 2, 3])).toBeCloseTo(1));
  it("is 0 for orthogonal vectors", () => expect(cosineSim([1, 0], [0, 1])).toBeCloseTo(0));
});

describe("localityQueries", () => {
  it("reads the locality from hobli when village is null", () => {
    expect(localityQueries(ids({ hobli: "ಯಲಹಂಕ" }))).toEqual(["ಯಲಹಂಕ"]);
  });
  it("dedupes village and hobli that normalize the same", () => {
    expect(localityQueries(ids({ village: "Yelahanka", hobli: "Yelahanka Hobli" }))).toHaveLength(1);
  });
  it("returns nothing when no locality fields are set", () => {
    expect(localityQueries(ids({}))).toEqual([]);
  });
});

describe("exactMatch", () => {
  const index = [
    entry("Yelahanka", "ಯಲಹಂಕ"),
    entry("Yelahanka New Town", "ಯಲಹಂಕ ನ್ಯೂ ಟೌನ್"),
    entry("Whitefield", "ವೈಟ್‌ಫೀಲ್ಡ್"),
  ];
  it("matches a romanized name case-insensitively", () => {
    expect(exactMatch(["yelahanka"], index)?.locality_romanized).toBe("Yelahanka");
  });
  it("matches on the native script", () => {
    expect(exactMatch(["ವೈಟ್‌ಫೀಲ್ಡ್"], index)?.locality_romanized).toBe("Whitefield");
  });
  it("disambiguates Yelahanka from Yelahanka New Town by native string", () => {
    expect(exactMatch(["ಯಲಹಂಕ"], index)?.locality_romanized).toBe("Yelahanka");
  });
  it("returns null for an unknown locality", () => {
    expect(exactMatch(["Xyzville"], index)).toBeNull();
  });
});

describe("rankByEmbedding + decideEmbedding", () => {
  const index = [entry("A", "A", [1, 0, 0]), entry("B", "B", [0, 1, 0]), entry("C", "C", [0, 0, 1])];

  it("ranks the nearest vector first", () => {
    const ranked = rankByEmbedding([0.9, 0.1, 0], index);
    expect(ranked[0].entry.locality_romanized).toBe("A");
  });
  it("accepts a clear winner (high score + margin)", () => {
    const ranked = [
      { entry: entry("A", "A"), score: 0.92 },
      { entry: entry("B", "B"), score: 0.8 },
    ];
    expect(decideEmbedding(ranked)?.entry.locality_romanized).toBe("A");
  });
  it("rejects when the top score is below threshold", () => {
    expect(decideEmbedding([{ entry: entry("A", "A"), score: 0.8 }])).toBeNull();
  });
  it("rejects a near-tie (routes to adjudication)", () => {
    const ranked = [
      { entry: entry("A", "A"), score: 0.9 },
      { entry: entry("B", "B"), score: 0.88 },
    ];
    expect(decideEmbedding(ranked)).toBeNull();
  });
});
