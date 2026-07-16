// Live check for the three-tier locality matcher against the built index.
// Run: npm run verify:match   (needs OPENAI_API_KEY in .env and data/localities/index.json)
import { readFile } from "node:fs/promises";
import path from "node:path";
import { matchLocality, type LocalityIndexEntry } from "../src/lib/locality-match";
import type { ParcelRecord } from "../src/lib/schemas";

const cases: { label: string; village?: string; hobli?: string; expect: string }[] = [
  { label: "native hobli (exact)", hobli: "ಯಲಹಂಕ", expect: "Yelahanka" },
  { label: "romanized village (exact)", village: "Yelahanka", expect: "Yelahanka" },
  { label: "typo (embedding)", village: "Elahanka", expect: "Yelahanka" },
  { label: "misspelling (embedding)", village: "Whitefeild", expect: "Whitefield" },
  { label: "nonsense (none)", village: "Shangri-La Fictional Nagar", expect: "none" },
];

function parcelWith(village: string | null, hobli: string | null): ParcelRecord {
  return {
    identifiers: {
      survey_number: "45/2", site_number: null, khata_number: null, village, hobli,
      taluk: null, district: null, state: "KA", pin_code: null,
    },
  } as unknown as ParcelRecord;
}

async function main() {
  const index = JSON.parse(
    await readFile(path.resolve("data/localities/index.json"), "utf8"),
  ) as LocalityIndexEntry[];
  console.log(`Loaded ${index.length} localities.\n`);

  let ok = 0;
  for (const c of cases) {
    const match = await matchLocality(parcelWith(c.village ?? null, c.hobli ?? null), index);
    const got = match?.locality_romanized ?? "none";
    const pass = got === c.expect;
    if (pass) ok += 1;
    console.log(
      `${pass ? "✓" : "✗"} ${c.label.padEnd(26)} → ${got.padEnd(14)} [${match?.method ?? "none"}${
        match ? ` ${match.confidence.toFixed(2)}` : ""
      }]  expected ${c.expect}`,
    );
  }
  console.log(`\n${ok}/${cases.length} cases passed.`);
  if (ok < cases.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
