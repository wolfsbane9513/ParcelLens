"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ParcelCard } from "@/components/ParcelCard";
import { ParcelMap } from "@/components/ParcelMap";
import { PortfolioTable } from "@/components/PortfolioTable";
import { loadPortfolio, savePortfolio, upsertParcels, parsePortfolioJson } from "@/lib/portfolio";
import type { ParcelRecord } from "@/lib/schemas";

type ExtractResponse =
  | { status: "ok"; parcels: ParcelRecord[] }
  | { status: "not_a_property_document" }
  | { status: "error"; message: string };

type Status = { kind: "idle" | "not_a_doc" | "error"; message?: string };

const STEPS = ["Reading document", "Extracting fields", "Matching locality", "Valuing"];

export default function Home() {
  const [parcels, setParcels] = useState<ParcelRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const importRef = useRef<HTMLInputElement>(null);

  // Hydrate from localStorage (the store), and persist on change.
  useEffect(() => setParcels(loadPortfolio()), []);
  useEffect(() => {
    if (parcels.length) savePortfolio(parcels);
  }, [parcels]);

  const selected = parcels.find((p) => p.parcel_id === selectedId) ?? null;

  async function valuate(parcel: ParcelRecord): Promise<ParcelRecord> {
    try {
      const res = await fetch("/api/valuate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ parcel }),
      });
      const data = await res.json();
      return data.status === "ok" ? (data.parcel as ParcelRecord) : parcel;
    } catch {
      return parcel; // keep the extracted parcel even if valuation fails
    }
  }

  async function addFiles(selectedFiles: File[]) {
    if (selectedFiles.length === 0) return;
    setBusy(true);
    setStatus({ kind: "idle" });
    try {
      const form = new FormData();
      for (const f of selectedFiles) form.append("files", f);
      const res = await fetch("/api/extract", { method: "POST", body: form });
      const data = (await res.json()) as ExtractResponse;

      if (data.status === "not_a_property_document") return setStatus({ kind: "not_a_doc" });
      if (data.status === "error") return setStatus({ kind: "error", message: data.message });

      const valued = await Promise.all(data.parcels.map(valuate));
      setParcels((cur) => upsertParcels(cur, valued));
      if (valued[0]) setSelectedId(valued[0].parcel_id);
    } catch {
      setStatus({ kind: "error", message: "Could not reach the service. Is the dev server running?" });
    } finally {
      setBusy(false);
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(parcels, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "parcellens-portfolio.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File) {
    const parsed = parsePortfolioJson(await file.text());
    if (!parsed) return setStatus({ kind: "error", message: "That file is not a valid ParcelLens portfolio." });
    setParcels((cur) => upsertParcels(cur, parsed));
    if (parsed[0]) setSelectedId(parsed[0].parcel_id);
  }

  return (
    <main className="min-h-screen bg-[#f4f1ea] text-[#17211c]">
      <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col px-5 py-5 lg:px-8">
        <header className="flex items-center justify-between border-b border-[#17211c]/15 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-full bg-[#17382a] text-sm font-bold text-[#c7f36b]">P</div>
            <span className="text-sm font-semibold tracking-[0.22em] uppercase">ParcelLens</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="cursor-pointer rounded-full border border-[#17211c]/20 px-3 py-1.5 text-xs font-semibold text-[#526058] hover:border-[#17382a]">
              Import
              <input ref={importRef} type="file" accept=".json" className="sr-only" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
            </label>
            <button onClick={exportJson} disabled={!parcels.length} className="rounded-full border border-[#17211c]/20 px-3 py-1.5 text-xs font-semibold text-[#526058] hover:border-[#17382a] disabled:opacity-40">
              Export portfolio
            </button>
          </div>
        </header>

        <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Left: upload + map + portfolio */}
          <div className="flex flex-col gap-5">
            <label className={`group flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed px-5 py-4 transition ${busy ? "border-[#86a26d] bg-[#f4f8e9]" : "border-[#86a26d] bg-[#f4f8e9] hover:border-[#17382a] hover:bg-[#edf5d9]"}`}>
              <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="sr-only" disabled={busy} onChange={(e) => addFiles(Array.from(e.target.files ?? []))} />
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#17382a] text-xl text-[#c7f36b]">+</span>
              <div>
                <p className="font-semibold">Add a sale deed or encumbrance certificate</p>
                <p className="text-sm text-[#68766b]">Kannada, Hindi, or English · upload a deed + its EC together to merge them</p>
              </div>
            </label>

            {busy && (
              <div className="rounded-2xl border border-[#17211c]/12 bg-[#fffdf8] p-5">
                <p className="text-sm font-semibold text-[#17382a]">Analyzing…</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  {STEPS.map((s) => (
                    <span key={s} className="flex items-center gap-2 text-sm text-[#526058]">
                      <span className="size-2 animate-pulse rounded-full bg-[#86a26d]" />{s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {status.kind === "not_a_doc" && (
              <div className="rounded-2xl border border-[#e2c98a] bg-[#fbf4e0] px-5 py-4 text-sm text-[#8a5a10]">
                That doesn&apos;t look like a property document. ParcelLens reads sale deeds, ECs, khata, and RTC extracts.
              </div>
            )}
            {status.kind === "error" && (
              <div className="rounded-2xl border border-[#e2a08a] bg-[#fbe8e0] px-5 py-4 text-sm text-[#9f1d1d]">{status.message}</div>
            )}

            <ParcelMap parcels={parcels} selectedId={selectedId} onSelect={setSelectedId} />

            {parcels.length > 0 ? (
              <PortfolioTable parcels={parcels} selectedId={selectedId} onSelect={setSelectedId} />
            ) : (
              <div className="grid place-items-center rounded-2xl border border-dashed border-[#17211c]/15 py-10 text-center text-sm text-[#8a9389]">
                Upload documents to build a portfolio. Try the bundled samples in <code className="mx-1 rounded bg-[#eef2e4] px-1.5 py-0.5">data/samples/</code>.
              </div>
            )}
          </div>

          {/* Right: selected parcel */}
          <div className="lg:sticky lg:top-5 lg:self-start">
            {selected ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold tracking-wide text-[#526058]">Selected parcel</h2>
                  <Link href={`/parcels/${selected.parcel_id}`} className="text-xs font-semibold text-[#2f6b4f] hover:underline">
                    Open full detail →
                  </Link>
                </div>
                <ParcelCard parcel={selected} />
              </div>
            ) : (
              <div className="grid min-h-[300px] place-items-center rounded-[1.5rem] border border-[#17211c]/12 bg-[#fffdf8] p-8 text-center">
                <div>
                  <h1 className="text-2xl font-semibold tracking-[-0.03em]">Find the risk hiding in the paperwork.</h1>
                  <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#526058]">Upload regional-language deeds and ECs. ParcelLens extracts them with GPT-5.6, flags title and valuation risk, and pins each parcel on the map. Select a pin or row to see its brief.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="flex flex-col gap-2 border-t border-[#17211c]/15 pt-4 text-xs text-[#68766b] sm:flex-row sm:items-center sm:justify-between">
          <span>Screening tool — not a legal title opinion. Cost rates as configured; verify at the SRO.</span>
          <span>Built for OpenAI Build Week · Work &amp; Productivity</span>
        </footer>
      </div>
    </main>
  );
}
