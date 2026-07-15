// Guidance-value ingestion: data/rates/raw/*.pdf -> GPT-5.6 vision ->
// data/rates/ka_bengaluru_urban.json (validated RateEntry[]).
// Run: pnpm ingest:rates          (skips files already in the JSON)
//      pnpm ingest:rates --force  (re-extract everything)
// Needs OPENAI_API_KEY in .env.
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { RateEntrySchema, type RateEntry } from "../src/lib/schemas";
import { ingestRatePdf } from "../src/lib/rate-ingest";

const RAW_DIR = path.resolve("data/rates/raw");
const OUT_FILE = path.resolve("data/rates/ka_bengaluru_urban.json");
const MIN_TOTAL_ROWS = 40; // acceptance floor
const SUSPECT_ROWS_PER_FILE = 15; // below this, a dense table was likely truncated

// Deterministic ordering so re-runs produce a stable diff.
function sortEntries(entries: RateEntry[]): RateEntry[] {
  return [...entries].sort(
    (a, b) =>
      a.source_notification.localeCompare(b.source_notification) ||
      a.locality_romanized.localeCompare(b.locality_romanized) ||
      a.property_type.localeCompare(b.property_type) ||
      (a.road_width_category ?? "").localeCompare(b.road_width_category ?? ""),
  );
}

async function main() {
  const force = process.argv.includes("--force");
  if (!existsSync(RAW_DIR)) {
    console.error(`No raw rate PDFs at ${RAW_DIR}. Run 'pnpm generate:rates' first.`);
    process.exit(1);
  }
  const pdfs = (await readdir(RAW_DIR)).filter((f) => f.toLowerCase().endsWith(".pdf")).sort();
  if (pdfs.length === 0) {
    console.error(`No .pdf files in ${RAW_DIR}.`);
    process.exit(1);
  }

  // Load existing output for idempotent skips.
  let existing: RateEntry[] = [];
  if (existsSync(OUT_FILE) && !force) {
    const parsed = RateEntrySchema.array().safeParse(JSON.parse(await readFile(OUT_FILE, "utf8")));
    if (parsed.success) existing = parsed.data;
  }
  const alreadyIngested = new Set(existing.map((e) => e.source_notification));

  const kept = force ? [] : existing;
  for (const filename of pdfs) {
    if (!force && alreadyIngested.has(filename)) {
      console.log(`• ${filename}: already ingested, skipping (use --force to re-extract)`);
      continue;
    }
    const buf = await readFile(path.join(RAW_DIR, filename));
    console.log(`• ${filename}: reading with gpt-5.6 …`);
    const { entries, warnings } = await ingestRatePdf({
      filename,
      mimeType: "application/pdf",
      base64: buf.toString("base64"),
    });
    for (const w of warnings) console.warn(`    ⚠ ${w}`);
    if (entries.length < SUSPECT_ROWS_PER_FILE) {
      console.warn(`    ⚠ only ${entries.length} rows from ${filename} — possible truncation, inspect the PDF.`);
    }
    console.log(`    → ${entries.length} rows`);
    kept.push(...entries);
  }

  const out = sortEntries(kept);

  // Summary table + acceptance check.
  const byLocality = new Map<string, number>();
  for (const e of out) byLocality.set(e.locality_romanized, (byLocality.get(e.locality_romanized) ?? 0) + 1);
  console.log(`\nLocalities: ${byLocality.size} · rows: ${out.length}`);
  for (const [loc, n] of [...byLocality].sort()) console.log(`  ${loc.padEnd(24)} ${n}`);

  if (out.length < MIN_TOTAL_ROWS || byLocality.size < 2) {
    console.error(`\n✗ Below acceptance floor (need ≥${MIN_TOTAL_ROWS} rows across ≥2 localities, got ${out.length} / ${byLocality.size}).`);
    process.exit(1);
  }

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(out, null, 2) + "\n");
  console.log(`\n✓ Wrote ${out.length} rows to ${path.relative(process.cwd(), OUT_FILE)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
