// Locality index: distinct localities in data/rates/ka_bengaluru_urban.json ->
// text-embedding-3-large vectors + static centroid -> data/localities/index.json.
// Run: npm run build:index   (needs OPENAI_API_KEY in .env)
//
// Geocoding is a static table, not a live API call: these are 12 fixed, known
// Bengaluru localities. The plan's risk register anticipates Maps-key friction;
// keeping centroids static means the index (and the map demo) needs only the
// OpenAI key. Swap in a Geocoding-API call here if precise pins ever matter.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { RateEntrySchema } from "../src/lib/schemas";
import { EMBEDDING_MODEL, normalizeLocality, type LocalityIndexEntry } from "../src/lib/locality-match";
import { getOpenAI } from "../src/lib/openai";

const RATES_FILE = path.resolve("data/rates/ka_bengaluru_urban.json");
const OUT_FILE = path.resolve("data/localities/index.json");
const BENGALURU = { lat: 12.9716, lng: 77.5946 }; // fallback centroid

// Approx centroids for the demo localities. Keyed by normalized romanized name.
const CENTROIDS: Record<string, { lat: number; lng: number }> = {
  yelahanka: { lat: 13.1007, lng: 77.5963 },
  "yelahanka new town": { lat: 13.0985, lng: 77.596 },
  jakkur: { lat: 13.0776, lng: 77.606 },
  hebbal: { lat: 13.0358, lng: 77.597 },
  bagalur: { lat: 13.1322, lng: 77.6656 },
  vidyaranyapura: { lat: 13.08, lng: 77.557 },
  whitefield: { lat: 12.9698, lng: 77.75 },
  varthur: { lat: 12.94, lng: 77.747 },
  marathahalli: { lat: 12.956, lng: 77.701 },
  kadugodi: { lat: 12.995, lng: 77.76 },
  hoodi: { lat: 12.992, lng: 77.716 },
  brookfield: { lat: 12.966, lng: 77.718 },
};

async function main() {
  const rates = RateEntrySchema.array().parse(JSON.parse(await readFile(RATES_FILE, "utf8")));

  // Distinct localities by romanized name (keep the first native spelling seen).
  const distinct = new Map<string, { romanized: string; native: string }>();
  for (const r of rates) {
    const key = normalizeLocality(r.locality_romanized);
    if (!distinct.has(key)) distinct.set(key, { romanized: r.locality_romanized, native: r.locality_native });
  }
  console.log(`Embedding ${distinct.size} distinct localities with ${EMBEDDING_MODEL} …`);

  const openai = getOpenAI();
  const index: LocalityIndexEntry[] = [];
  for (const { romanized, native } of distinct.values()) {
    const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: `${romanized}, ${native}` });
    const centroid = CENTROIDS[normalizeLocality(romanized)];
    if (!centroid) console.warn(`    ⚠ no centroid for "${romanized}" — using Bengaluru fallback`);
    index.push({
      locality_romanized: romanized,
      locality_native: native,
      embedding: res.data[0].embedding,
      geo: { ...(centroid ?? BENGALURU), precision: "locality", source: "geocode" },
    });
    console.log(`  ${romanized.padEnd(24)} dim=${res.data[0].embedding.length}`);
  }

  index.sort((a, b) => a.locality_romanized.localeCompare(b.locality_romanized));
  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(index, null, 2) + "\n");
  console.log(`\n✓ Wrote ${index.length} localities to ${path.relative(process.cwd(), OUT_FILE)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
