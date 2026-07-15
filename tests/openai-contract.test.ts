import { describe, expect, it } from "vitest";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { DocExtractionSchema } from "../src/lib/prompts/extraction";
import { RateExtractionSchema } from "../src/lib/prompts/rate-ingest";

// Keyless guard: proves the OpenAI SDK surface our pipeline calls actually
// exists in the installed version, and that our zod schemas convert to a valid
// structured-output format. Catches a renamed API before it fails at runtime.
describe("openai SDK contract", () => {
  const client = new OpenAI({ apiKey: "test-only-not-used" });

  it("exposes responses.parse", () => {
    expect(typeof client.responses.parse).toBe("function");
  });

  it("converts DocExtractionSchema to a text format", () => {
    expect(() => zodTextFormat(DocExtractionSchema, "doc_extraction")).not.toThrow();
  });

  it("converts RateExtractionSchema to a text format", () => {
    expect(() => zodTextFormat(RateExtractionSchema, "rate_table")).not.toThrow();
  });
});
