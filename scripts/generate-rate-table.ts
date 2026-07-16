import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";

// Synthetic Kannada guidance-value (circle-rate) notifications. Deterministic —
// no model call. This is the *ground truth* for the "spot-check 5 rows" check;
// the ingester re-reads these PDFs with GPT-5.6 vision (that round-trip is the
// demo). Substitutes for real Kaveri-portal PDFs (see PARCELLENS_BUILD_PLAN §9).

const outputDir = join(process.cwd(), "data", "rates", "raw");

type Locality = { native: string; romanized: string; base: number };
type Category = { native: string; type: string; road: string; mult: number };

const CATEGORIES: Category[] = [
  { native: "ವಸತಿ ನಿವೇಶನ", type: "residential_site", road: "12 ಮೀ ವರೆಗೆ", mult: 1.0 },
  { native: "ವಸತಿ ನಿವೇಶನ", type: "residential_site", road: "12–24 ಮೀ", mult: 1.18 },
  { native: "ಅಪಾರ್ಟ್‌ಮೆಂಟ್", type: "apartment", road: "—", mult: 0.92 },
  { native: "ವಾಣಿಜ್ಯ", type: "commercial", road: "24 ಮೀ ಮೇಲ್ಪಟ್ಟು", mult: 1.65 },
];

type Table = {
  slug: string;
  taluk: string;
  taluk_native: string;
  notification: string;
  effective: string; // DD-MM-YYYY as printed
  localities: Locality[];
};

const TABLES: Table[] = [
  {
    slug: "ka_bengaluru_north_guidance",
    taluk: "Bengaluru North",
    taluk_native: "ಬೆಂಗಳೂರು ಉತ್ತರ ತಾಲೂಕು",
    notification: "KA/SRO/2024/BNG-N/17",
    effective: "01-04-2024",
    localities: [
      { native: "ಯಲಹಂಕ", romanized: "Yelahanka", base: 5500 },
      { native: "ಯಲಹಂಕ ನ್ಯೂ ಟೌನ್", romanized: "Yelahanka New Town", base: 7200 },
      { native: "ಜಕ್ಕೂರು", romanized: "Jakkur", base: 5800 },
      { native: "ಹೆಬ್ಬಾಳ", romanized: "Hebbal", base: 9500 },
      { native: "ಬಾಗಲೂರು", romanized: "Bagalur", base: 4200 },
      { native: "ವಿದ್ಯಾರಣ್ಯಪುರ", romanized: "Vidyaranyapura", base: 6800 },
    ],
  },
  {
    slug: "ka_bengaluru_east_guidance",
    taluk: "Bengaluru East",
    taluk_native: "ಬೆಂಗಳೂರು ಪೂರ್ವ ತಾಲೂಕು",
    notification: "KA/SRO/2024/BNG-E/23",
    effective: "01-04-2024",
    localities: [
      { native: "ವೈಟ್‌ಫೀಲ್ಡ್", romanized: "Whitefield", base: 6000 },
      { native: "ವರ್ತೂರು", romanized: "Varthur", base: 6200 },
      { native: "ಮಾರತಹಳ್ಳಿ", romanized: "Marathahalli", base: 7600 },
      { native: "ಕಾಡುಗೋಡಿ", romanized: "Kadugodi", base: 5400 },
      { native: "ಹೂಡಿ", romanized: "Hoodi", base: 7000 },
      { native: "ಬ್ರೂಕ್‌ಫೀಲ್ಡ್", romanized: "Brookefield", base: 9200 },
    ],
  },
];

function rate(base: number, mult: number): number {
  return Math.round((base * mult) / 50) * 50;
}

function esc(v: string): string {
  return v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function buildSvg(t: Table): string {
  const W = 794;
  const H = 1123;
  const left = 48;
  const cols = { locality: 48, type: 300, road: 470, rate: 700 }; // rate right-aligned at 700
  const headerBottom = 176;
  const rowH = 34;

  const parts: string[] = [];
  parts.push(`<rect width="100%" height="100%" fill="#fffdf8"/>`);
  parts.push(`<text x="${left}" y="60" font-size="24" font-weight="700" fill="#17382a">ಮಾರ್ಗಸೂಚಿ ಮೌಲ್ಯ / GUIDANCE VALUE</text>`);
  parts.push(`<text x="${left}" y="92" font-size="15" fill="#38423b">ಕರ್ನಾಟಕ ಸರ್ಕಾರ · ನೋಂದಣಿ ಮತ್ತು ಮುದ್ರಾಂಕ ಇಲಾಖೆ · ${esc(t.taluk_native)}</text>`);
  parts.push(`<text x="${left}" y="116" font-size="13" fill="#65736a">District: Bengaluru Urban · Taluk: ${esc(t.taluk)}</text>`);
  parts.push(`<text x="${left}" y="138" font-size="13" fill="#65736a">ಅಧಿಸೂಚನೆ ಸಂ: ${esc(t.notification)} · ಜಾರಿ ದಿನಾಂಕ: ${esc(t.effective)}</text>`);

  // column header
  parts.push(`<rect x="${left - 12}" y="${headerBottom - 24}" width="${W - 2 * (left - 12)}" height="30" fill="#e8f0da"/>`);
  parts.push(`<text x="${cols.locality}" y="${headerBottom - 3}" font-size="13" font-weight="700" fill="#2c3a30">ಸ್ಥಳ / Locality</text>`);
  parts.push(`<text x="${cols.type}" y="${headerBottom - 3}" font-size="13" font-weight="700" fill="#2c3a30">ಆಸ್ತಿ ಪ್ರಕಾರ</text>`);
  parts.push(`<text x="${cols.road}" y="${headerBottom - 3}" font-size="13" font-weight="700" fill="#2c3a30">ರಸ್ತೆ ಅಗಲ</text>`);
  parts.push(`<text x="${cols.rate}" y="${headerBottom - 3}" font-size="13" font-weight="700" fill="#2c3a30" text-anchor="end">ದರ ₹/ಚ.ಅಡಿ</text>`);

  let y = headerBottom + rowH - 8;
  let i = 0;
  for (const loc of t.localities) {
    for (const cat of CATEGORIES) {
      if (i % 2 === 1) parts.push(`<rect x="${left - 12}" y="${y - 22}" width="${W - 2 * (left - 12)}" height="${rowH}" fill="#f3f0e6"/>`);
      parts.push(`<text x="${cols.locality}" y="${y}" font-size="15" fill="#17211c">${esc(loc.native)}</text>`);
      parts.push(`<text x="${cols.type}" y="${y}" font-size="14" fill="#17211c">${esc(cat.native)}</text>`);
      parts.push(`<text x="${cols.road}" y="${y}" font-size="14" fill="#38423b">${esc(cat.road)}</text>`);
      parts.push(`<text x="${cols.rate}" y="${y}" font-size="15" fill="#17211c" text-anchor="end">${rate(loc.base, cat.mult).toLocaleString("en-IN")}</text>`);
      y += rowH;
      i += 1;
    }
  }

  parts.push(`<text x="${left}" y="${H - 30}" font-size="12" fill="#8a9389">Synthetic guidance-value table for hackathon demonstration. Not an official notification.</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join("")}</svg>`;
}

async function writeTable(t: Table) {
  const pngPath = join(outputDir, `${t.slug}.png`);
  const pdfPath = join(outputDir, `${t.slug}.pdf`);
  await sharp(Buffer.from(buildSvg(t))).png().toFile(pngPath);

  const doc = new PDFDocument({ size: "A4", margin: 0 });
  const out = createWriteStream(pdfPath);
  doc.pipe(out);
  const done = new Promise<void>((resolve, reject) => {
    out.on("finish", resolve);
    out.on("error", reject);
    doc.on("error", reject);
  });
  doc.image(pngPath, 0, 0, { fit: [595, 842] });
  doc.end();
  await done;

  const rows = t.localities.length * CATEGORIES.length;
  console.log(`  ${t.slug}: ${rows} rows`);
  return rows;
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  console.log(`Generating synthetic guidance-value PDFs in ${outputDir}`);
  let total = 0;
  for (const t of TABLES) total += await writeTable(t);
  console.log(`Done — ${TABLES.length} notifications, ${total} rows total.`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
