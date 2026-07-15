import OpenAI from "openai";

export const EXTRACTION_MODEL = "gpt-5.6"; // AGENTS §6 — do not substitute.

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set — add it to .env before running model calls.");
  }
  client ??= new OpenAI();
  return client;
}

export type UploadFile = { filename: string; mimeType: string; base64: string };

export function toDataUrl(file: UploadFile): string {
  return `data:${file.mimeType};base64,${file.base64}`;
}

// A Responses-API content part for a document — PDF as input_file, image as input_image.
export function fileContentPart(file: UploadFile) {
  if (file.mimeType === "application/pdf") {
    return { type: "input_file" as const, filename: file.filename, file_data: toDataUrl(file) };
  }
  return { type: "input_image" as const, image_url: toDataUrl(file), detail: "high" as const };
}
