import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";

const outputDir = join(process.cwd(), "data", "samples");
type Sample = { slug: string; title: string; lines: string[] };
const samples: Sample[] = [
  { slug: "kn-clean-sale-deed", title: "à²®à²¾à²°à²¾à²Ÿ à²ªà²¤à³à²° / SALE DEED", lines: ["à²•à²²à³à²ªà²¿à²¤ à²¦à²¾à²–à²²à³† - ParcelLens demo sample", "à²®à²¾à²°à²¾à²Ÿà²—à²¾à²°à²°à³: à²°à²µà²¿ à²•à³à²®à²¾à²°à³ à²®à²¤à³à²¤à³ à²†à²¶à²¾ à²•à³à²®à²¾à²°à³", "à²–à²°à³€à²¦à²¿à²¦à²¾à²°à²°à³: à²®à³€à²°à²¾ à²°à²¾à²µà³", "à²¸à²°à³à²µà³‡ à²¸à²‚à²–à³à²¯à³†: 45/2, à²¯à²²à²¹à²‚à²• à²¹à³‹à²¬à²³à²¿, à²¬à³†à²‚à²—à²³à³‚à²°à³ à²‰à²¤à³à²¤à²°", "à²µà²¿à²¸à³à²¤à³€à²°à³à²£: 1,200 à²šà²¦à²° à²…à²¡à²¿", "à²®à²¾à²°à²¾à²Ÿ à²®à³Šà²¤à³à²¤: à²°à³‚. 72,00,000", "à²¦à²¿à²¨à²¾à²‚à²•: 10-06-2026", "à²‰à²¤à³à²¤à²°: à²°à²¸à³à²¤à³† | à²¦à²•à³à²·à²¿à²£: à²¸à³ˆà²Ÿà³ 46 | à²ªà³‚à²°à³à²µ: à²‰à²¦à³à²¯à²¾à²¨ | à²ªà²¶à³à²šà²¿à²®: à²¸à³ˆà²Ÿà³ 44"] },
  { slug: "kn-flawed-sale-deed", title: "à²®à²¾à²°à²¾à²Ÿ à²ªà²¤à³à²° / SALE DEED - REVIEW", lines: ["à²•à²²à³à²ªà²¿à²¤ à²¦à²¾à²–à²²à³† - deliberate risk sample", "à²®à²¾à²°à²¾à²Ÿà²—à²¾à²°à²°à³: à²µà²¿à²œà²¯à³ à²¶à³†à²Ÿà³à²Ÿà²¿", "à²–à²°à³€à²¦à²¿à²¦à²¾à²°à²°à³: à²®à³€à²°à²¾ à²°à²¾à²µà³", "à²¸à²°à³à²µà³‡ à²¸à²‚à²–à³à²¯à³†: 45/2, à²¯à²²à²¹à²‚à²• à²¹à³‹à²¬à²³à²¿, à²¬à³†à²‚à²—à²³à³‚à²°à³ à²‰à²¤à³à²¤à²°", "à²µà²¿à²¸à³à²¤à³€à²°à³à²£: 1,200 à²šà²¦à²° à²…à²¡à²¿ | à²®à²¾à²°à²¾à²Ÿ à²®à³Šà²¤à³à²¤: à²°à³‚. 55,00,000", "à²¦à²¿à²¨à²¾à²‚à²•: 12-06-2026", "à²¹à²¿à²‚à²¦à²¿à²¨ à²¹à²•à³à²•à³à²¦à²¾à²°à²° à²¸à²°à²ªà²³à²¿à²¯à²²à³à²²à²¿ à²¦à²¾à²–à²²à³† à²•à³Šà²°à²¤à³† à²‡à²¦à³†."] },
  { slug: "kn-flawed-encumbrance-certificate", title: "à²­à²¾à²° à²ªà³à²°à²®à²¾à²£ à²ªà²¤à³à²° / ENCUMBRANCE CERTIFICATE", lines: ["à²•à²²à³à²ªà²¿à²¤ à²¦à²¾à²–à²²à³† - paired with kn-flawed-sale-deed", "à²¸à²°à³à²µà³‡ à²¸à²‚à²–à³à²¯à³†: 45/2, à²¯à²²à²¹à²‚à²•, à²¬à³†à²‚à²—à²³à³‚à²°à³ à²¨à²—à²°", "à²¹à²•à³à²•à³à²¦à²¾à²°: à²µà²¿à²œà²¯à³ à²¶à³†à²Ÿà³à²Ÿà²¿", "à²¸à²•à³à²°à²¿à²¯ à²…à²¡à²®à²¾à²¨: à²•à²¾à²µà³‡à²°à²¿ à²•à³‹-à²†à²ªà²°à³‡à²Ÿà²¿à²µà³ à²¬à³à²¯à²¾à²‚à²•à³", "à²®à³Šà²¤à³à²¤: à²°à³‚. 18,00,000 | à²¸à³à²¥à²¿à²¤à²¿: à²¸à²•à³à²°à²¿à²¯", "à²ªà³à²°à²®à²¾à²£ à²ªà²¤à³à²° à²¦à²¿à²¨à²¾à²‚à²•: 15-06-2026"] },
  { slug: "kn-clean-encumbrance-certificate", title: "à²­à²¾à²° à²ªà³à²°à²®à²¾à²£ à²ªà²¤à³à²° / ENCUMBRANCE CERTIFICATE", lines: ["à²•à²²à³à²ªà²¿à²¤ à²¦à²¾à²–à²²à³† - paired with kn-clean-sale-deed", "à²¸à²°à³à²µà³‡ à²¸à²‚à²–à³à²¯à³†: 45/2, à²¯à²²à²¹à²‚à²•, à²¬à³†à²‚à²—à²³à³‚à²°à³ à²¨à²—à²°", "à²¹à²•à³à²•à³à²¦à²¾à²°: à²°à²µà²¿ à²•à³à²®à²¾à²°à³ à²®à²¤à³à²¤à³ à²†à²¶à²¾ à²•à³à²®à²¾à²°à³", "à²¦à²¾à²–à²²à²¾à²—à²¿à²°à³à²µ à²­à²¾à²°à²—à²³à³: à²¯à²¾à²µà³à²¦à³‚ à²‡à²²à³à²²", "à²ªà³à²°à²®à²¾à²£ à²ªà²¤à³à²° à²¦à²¿à²¨à²¾à²‚à²•: 15-06-2026"] },
  { slug: "hi-sale-deed", title: "à¤¬à¤¿à¤•à¥à¤°à¥€ à¤µà¤¿à¤²à¥‡à¤– / SALE DEED", lines: ["à¤•à¤¾à¤²à¥à¤ªà¤¨à¤¿à¤• à¤¦à¤¸à¥à¤¤à¤¾à¤µà¥‡à¤œà¤¼ - ParcelLens demo sample", "à¤µà¤¿à¤•à¥à¤°à¥‡à¤¤à¤¾: à¤¨à¤¿à¤–à¤¿à¤² à¤µà¤°à¥à¤®à¤¾", "à¤–à¤°à¥€à¤¦à¤¾à¤°: à¤…à¤¨à¤¨à¥à¤¯à¤¾ à¤¸à¤¿à¤‚à¤¹", "à¤¸à¤°à¥à¤µà¥‡ à¤¨à¤‚à¤¬à¤°: 88/1, à¤µà¥à¤¹à¤¾à¤‡à¤Ÿà¤«à¥€à¤²à¥à¤¡, à¤¬à¥‡à¤‚à¤—à¤²à¥à¤°à¥ à¤ªà¥‚à¤°à¥à¤µ", "à¤•à¥à¤·à¥‡à¤¤à¥à¤°à¤«à¤²: 1,500 à¤µà¤°à¥à¤— à¤«à¥à¤Ÿ", "à¤¬à¤¿à¤•à¥à¤°à¥€ à¤®à¥‚à¤²à¥à¤¯: à¤°à¥. 96,00,000", "à¤¦à¤¿à¤¨à¤¾à¤‚à¤•: 14-06-2026"] },
  { slug: "en-sale-deed", title: "SALE DEED", lines: ["Fictional document - ParcelLens demo sample", "Sellers: Daniel Thomas and Priya Thomas", "Buyer: Kavya Menon", "Survey number: 102/4, Whitefield, Bengaluru East", "Extent: 1,800 square feet", "Consideration: INR 12,500,000", "Date: 16-06-2026"] },
];

function escapeXml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }

async function writePdf(sample: Sample) {
  const pdfPath = join(outputDir, `${sample.slug}.pdf`);
  const pngPath = join(outputDir, `${sample.slug}.png`);
  const lines = sample.lines.map((line, index) => `<text x="72" y="${148 + index * 34}" font-size="18">${escapeXml(line)}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123"><rect width="100%" height="100%" fill="#fffdf8"/><text x="72" y="92" font-size="26" font-weight="700" fill="#17382a">${escapeXml(sample.title)}</text>${lines}<text x="72" y="1050" font-size="13" fill="#65736a">Synthetic sample for hackathon demonstration. Not a legal document.</text></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(pngPath);

  const document = new PDFDocument({ size: "A4", margin: 0 });
  const output = createWriteStream(pdfPath);
  document.pipe(output);
  const finished = new Promise<void>((resolve, reject) => { output.on("finish", resolve); output.on("error", reject); document.on("error", reject); });
  document.image(pngPath, 0, 0, { fit: [595, 842] });
  document.end();
  await finished;
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  await Promise.all(samples.map(writePdf));
  console.log(`Generated ${samples.length} sample documents in ${outputDir}`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });