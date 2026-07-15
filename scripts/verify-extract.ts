// Thin end-to-end slice: one sample document -> gpt-5.6 -> ParcelRecord.
// Run: pnpm verify:extract  (needs OPENAI_API_KEY in .env)
// Optional arg: path to a sample. Defaults to the clean Kannada sale deed.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractParcels } from "../src/lib/extraction";

async function main() {
  const rel = process.argv[2] ?? "data/samples/kn-clean-sale-deed.png";
  const abs = path.resolve(rel);
  const buf = await readFile(abs);
  const mimeType = rel.endsWith(".pdf") ? "application/pdf" : rel.endsWith(".png") ? "image/png" : "image/jpeg";

  console.log(`Extracting ${rel} with gpt-5.6 …`);
  const result = await extractParcels([{ filename: path.basename(rel), mimeType, base64: buf.toString("base64") }]);
  console.log(JSON.stringify(result, null, 2));

  if (result.status === "ok") {
    for (const p of result.parcels) {
      console.log(
        `\n✓ ${p.identifiers.survey_number ?? "?"} · ${p.identifiers.village ?? "?"} · ` +
          `${p.extent.value} ${p.extent.unit} (${p.extent.sqft_normalized} sqft) · ` +
          `₹${p.consideration.amount_inr.toLocaleString("en-IN")} · flags: ${p.risk_flags.map((f) => f.code).join(", ") || "none"}`,
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
