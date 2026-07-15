"use client";

import { useState } from "react";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#f4f1ea] text-[#17211c]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 lg:px-10 lg:py-8">
        <header className="flex items-center justify-between border-b border-[#17211c]/15 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-full bg-[#17382a] text-sm font-bold text-[#c7f36b]">P</div>
            <span className="text-sm font-semibold tracking-[0.22em] uppercase">ParcelLens</span>
          </div>
          <span className="rounded-full border border-[#17211c]/20 px-3 py-1 text-xs font-semibold tracking-[0.12em] uppercase text-[#526058]">Phase 0 · workspace</span>
        </header>

        <section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
          <div>
            <p className="mb-6 text-xs font-bold tracking-[0.3em] uppercase text-[#758176]">Multilingual property triage</p>
            <h1 className="max-w-3xl text-5xl leading-[0.98] font-semibold tracking-[-0.05em] sm:text-7xl">Find the risk hiding in the paperwork.</h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#526058]">ParcelLens turns regional-language deeds and encumbrance certificates into a clear screening brief for teams evaluating land in Bengaluru.</p>
            <div className="mt-9 flex flex-wrap gap-3 text-sm font-semibold">
              <span className="rounded-full bg-[#17382a] px-4 py-2 text-[#f4f1ea]">Kannada-first</span>
              <span className="rounded-full border border-[#17211c]/20 px-4 py-2">Evidence-linked</span>
              <span className="rounded-full border border-[#17211c]/20 px-4 py-2">Map-ready</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-5 -z-10 rounded-[2.5rem] bg-[#d9e6c0] blur-2xl" />
            <div className="rounded-[2rem] border border-[#17211c]/15 bg-[#fffdf8] p-5 shadow-[0_24px_80px_rgba(23,56,42,0.12)] sm:p-7">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#758176]">Start a review</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Upload property documents</h2>
                </div>
                <div className="rounded-full bg-[#e8f7b9] px-3 py-1 text-xs font-bold text-[#31511e]">Coming next</div>
              </div>

              <label className="group flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#86a26d] bg-[#f4f8e9] px-6 text-center transition hover:border-[#17382a] hover:bg-[#edf5d9]">
                <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
                <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-[#17382a] text-2xl text-[#c7f36b]">+</span>
                <span className="font-semibold">Drop a sale deed or EC here</span>
                <span className="mt-2 text-sm text-[#68766b]">PDF, PNG, or JPG · Kannada, Hindi, or English</span>
              </label>

              {files.length > 0 && (
                <div className="mt-4 rounded-xl bg-[#f4f1ea] p-3 text-sm">
                  <p className="font-semibold">Selected for the next phase</p>
                  {files.map((file) => <p key={`${file.name}-${file.size}`} className="mt-1 truncate text-[#526058]">{file.name}</p>)}
                </div>
              )}

              <div className="mt-5 flex items-center justify-between border-t border-[#17211c]/10 pt-5 text-xs text-[#68766b]">
                <span>Extraction pipeline is being assembled</span>
                <span className="font-mono">v0.1</span>
              </div>
            </div>
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
