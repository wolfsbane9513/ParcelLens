import { NextResponse } from "next/server";
import { extractParcels, type UploadFile } from "@/lib/extraction";

export const runtime = "nodejs";
export const maxDuration = 120; // vision extraction can be slow on multi-page docs

const ACCEPTED = new Set(["application/pdf", "image/png", "image/jpeg"]);

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ status: "error", message: "Expected multipart form data." }, { status: 400 });
  }

  const entries = form.getAll("files").filter((f): f is File => f instanceof File);
  if (entries.length === 0) {
    return NextResponse.json({ status: "error", message: "No files uploaded." }, { status: 400 });
  }

  const files: UploadFile[] = [];
  for (const f of entries) {
    const mimeType = ACCEPTED.has(f.type) ? f.type : "application/pdf";
    if (!ACCEPTED.has(f.type)) {
      return NextResponse.json(
        { status: "error", message: `Unsupported file type: ${f.name} (${f.type || "unknown"}). Upload PDF, PNG, or JPG.` },
        { status: 400 },
      );
    }
    const base64 = Buffer.from(await f.arrayBuffer()).toString("base64");
    files.push({ filename: f.name, mimeType, base64 });
  }

  const result = await extractParcels(files);
  const status = result.status === "error" ? 500 : 200;
  return NextResponse.json(result, { status });
}
