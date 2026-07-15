"use client";

import { useState } from "react";
import { ParcelCard } from "@/components/ParcelCard";
import type { ParcelRecord } from "@/lib/schemas";

type ExtractResponse =
  | { status: "ok"; parcels: ParcelRecord[] }
  | { status: "not_a_property_document" }
  | { status: "error"; message: string };

const STEPS = ["Reading document", "Extracting fields", "Flagging risks"];

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExtractResponse | null>(null);

  async function runExtraction(selected: File[]) {
    if (selected.length === 0) return;
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      for (const f of selected) form.append("files", f);
      const res = await fetch("/api/extract", { method: "POST", body: form });
      setResult((await res.json()) as ExtractResponse);
    } catch {
      setResult({ status: "error", message: "Could not reach the extraction service. Is the dev server running?" });
    } finally {
      setBusy(false);
    }
  }

  function onSelect(list: FileList | null) {
    const selected = Array.from(list ?? []);
    setFiles(selected);
    void runExtraction(selected);
  }

  return (
    <main className="min-h-screen bg-[#f4f1ea] text-[#17211c]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-6 lg:px-10 lg:py-8">
        <header className="flex items-center justify-between border-b border-[#17211c]/15 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-full bg-[#17382a] text-sm font-bold text-[#c7f36b]">P</div>
            <span className="text-sm font-semibold tracking-[0.22em] uppercase">ParcelLens</span>
          </div>
          <span className="rounded-full border border-[#17211c]/20 px-3 py-1 text-xs font-semibold tracking-[0.12em] uppercase text-[#526058]">Phase 1 · extraction</span>
        </header>

        <section className="grid flex-1 gap-10 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <div className="lg:sticky lg:top-8 lg:self-start">
            <p className="mb-5 text-xs font-bold tracking-[0.3em] uppercase text-[#758176]">Multilingual property triage</p>
            <h1 className="max-w-xl text-4xl leading-[1.02] font-semibold tracking-[-0.04em] sm:text-5xl">Find the risk hiding in the paperwork.</h1>
            <p className="mt-5 max-w-md text-base leading-7 text-[#526058]">Upload a sale deed or encumbrance certificate — Kannada, Hindi, or English. ParcelLens reads it with GPT-5.6 and returns a structured screening brief with title and encumbrance risks flagged.</p>

            <label className="group mt-8 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#86a26d] bg-[#f4f8e9] px-6 text-center transition hover:border-[#17382a] hover:bg-[#edf5d9]">
              <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="sr-only" disabled={busy} onChange={(e) => onSelect(e.target.files)} />
              <span className="mb-3 grid size-11 place-items-center rounded-2xl bg-[#17382a] text-2xl text-[#c7f36b]">+</span>
              <span className="font-semibold">Drop a sale deed or EC here</span>
              <span className="mt-1.5 text-sm text-[#68766b]">PDF, PNG, or JPG · upload a deed + its EC together to merge them</span>
            </label>

            {files.length > 0 && (
              <div className="mt-4 rounded-xl bg-[#fffdf8] p-3 text-sm shadow-sm">
                {files.map((file) => (
                  <p key={`${file.name}-${file.size}`} className="truncate text-[#526058]">{file.name}</p>
                ))}
              </div>
            )}
          </div>

          <div className="min-w-0">
            {busy && (
              <div className="rounded-2xl border border-[#17211c]/12 bg-[#fffdf8] p-8">
                <p className="text-sm font-semibold text-[#17382a]">Analyzing documents…</p>
                <ul className="mt-4 space-y-2">
                  {STEPS.map((s) => (
                    <li key={s} className="flex items-center gap-3 text-sm text-[#526058]">
                      <span className="size-2 animate-pulse rounded-full bg-[#86a26d]" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!busy && result?.status === "ok" && (
              <div className="space-y-6">
                <p className="text-sm font-semibold text-[#526058]">{result.parcels.length} parcel{result.parcels.length === 1 ? "" : "s"} extracted</p>
                {result.parcels.map((p) => <ParcelCard key={p.parcel_id} parcel={p} />)}
              </div>
            )}

            {!busy && result?.status === "not_a_property_document" && (
              <div className="rounded-2xl border border-[#e2c98a] bg-[#fbf4e0] p-8 text-center">
                <p className="text-lg font-semibold text-[#8a5a10]">That doesn&apos;t look like a property document.</p>
                <p className="mt-2 text-sm text-[#7a6a45]">ParcelLens reads sale deeds, encumbrance certificates, khata, and RTC extracts. Try one of those.</p>
              </div>
            )}

            {!busy && result?.status === "error" && (
              <div className="rounded-2xl border border-[#e2a08a] bg-[#fbe8e0] p-8 text-center">
                <p className="text-lg font-semibold text-[#9f1d1d]">Extraction failed</p>
                <p className="mt-2 text-sm text-[#8a5145]">{result.message}</p>
              </div>
            )}

            {!busy && !result && (
              <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-[#17211c]/15 p-8 text-center text-sm text-[#8a9389]">
                Extracted parcels appear here.
              </div>
            )}
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-[#17211c]/15 pt-5 text-xs text-[#68766b] sm:flex-row sm:items-center sm:justify-between">
          <span>Screening tool — not a substitute for a legal title opinion.</span>
          <span>Built for OpenAI Build Week · Work &amp; Productivity</span>
        </footer>
      </div>
    </main>
  );
}
