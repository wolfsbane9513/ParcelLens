// Full pipeline over the bundled samples -> data/samples/sample-portfolio.json.
// Deed + EC are grouped so they merge into one parcel. This fixture lets the UI
// (map, table, detail, toggle) be demoed/verified via Import without re-running
// extraction. Run: npm run build:sample-portfolio  (needs OPENAI_API_KEY)
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { RateEntrySchema, type ParcelRecord } from "../src/lib/schemas";
import { extractParcels, type UploadFile } from "../src/lib/extraction";
import { valuateParcel } from "../src/lib/valuate-parcel";
import type { LocalityIndexEntry } from "../src/lib/locality-match";

const SAMPLES = path.resolve("data/samples");
const OUT = path.resolve("data/samples/sample-portfolio.json");

// Each inner array is one parcel's documents (uploaded together).
const GROUPS: string[][] = [
  ["kn-clean-sale-deed.pdf", "kn-clean-encumbrance-certificate.pdf"],
  ["kn-flawed-sale-deed.pdf", "kn-flawed-encumbrance-certificate.pdf"],
  ["hi-sale-deed.pdf"],
  ["en-sale-deed.pdf"],
];

async function file(name: string): Promise<UploadFile> {
  return { filename: name, mimeType: "application/pdf", base64: (await readFile(path.join(SAMPLES, name))).toString("base64") };
}

async function main() {
  const rates = RateEntrySchema.array().parse(JSON.parse(await readFile(path.resolve("data/rates/ka_bengaluru_urban.json"), "utf8")));
  const index = JSON.parse(await readFile(path.resolve("data/localities/index.json"), "utf8")) as LocalityIndexEntry[];

  const portfolio: ParcelRecord[] = [];
  for (const group of GROUPS) {
    console.log(`• ${group.join(" + ")}`);
    const files = await Promise.all(group.map(file));
    const result = await extractParcels(files);
    if (result.status !== "ok") {
      console.warn(`    ⚠ ${result.status}${"message" in result ? `: ${result.message}` : ""}`);
      continue;
    }
    for (const parcel of result.parcels) {
      await valuateParcel(parcel, rates, index);
      const flags = parcel.risk_flags.map((f) => f.code).join(", ") || "none";
      console.log(`    → ${parcel.identifiers.hobli || parcel.identifiers.village} · gap ${((parcel.valuation?.gap_pct ?? 0) * 100).toFixed(1)}% · flags: ${flags}`);
      portfolio.push(parcel);
    }
  }

  await writeFile(OUT, JSON.stringify(portfolio, null, 2) + "\n");
  console.log(`\n✓ Wrote ${portfolio.length} parcels to ${path.relative(process.cwd(), OUT)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
