import type { ParcelRecord, RiskFlag } from "@/lib/schemas";

const SEVERITY: Record<RiskFlag["severity"], { bg: string; fg: string; label: string }> = {
  red: { bg: "#fbe4e4", fg: "#9f1d1d", label: "Blocking" },
  amber: { bg: "#fbf0d8", fg: "#8a5a10", label: "Review" },
  info: { bg: "#e9efe4", fg: "#425446", label: "Note" },
};

function inr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[10px] font-bold tracking-[0.14em] uppercase text-[#8a9389]">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-[#17211c]">{value || <span className="text-[#aab1a5]">—</span>}</dd>
    </div>
  );
}

export function ParcelCard({ parcel }: { parcel: ParcelRecord }) {
  const { identifiers: id, extent, consideration, parties, chain_of_title, encumbrances, source_documents, risk_flags } = parcel;
  const worst = risk_flags.some((f) => f.severity === "red") ? "red" : risk_flags.some((f) => f.severity === "amber") ? "amber" : "green";
  const accent = worst === "red" ? "#b91c1c" : worst === "amber" ? "#b45309" : "#2f7d4f";

  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-[#17211c]/12 bg-[#fffdf8] shadow-[0_18px_60px_rgba(23,56,42,0.1)]">
      <header className="flex items-start justify-between gap-4 border-b border-[#17211c]/10 px-6 py-5" style={{ borderLeft: `5px solid ${accent}` }}>
        <div>
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#8a9389]">Parcel</p>
          <h3 className="mt-1 text-xl font-semibold tracking-[-0.02em]">
            {id.survey_number ? `Survey ${id.survey_number}` : "Unidentified survey"}
          </h3>
          <p className="mt-0.5 text-sm text-[#526058]">
            {[id.village, id.hobli, id.taluk, id.district].filter(Boolean).join(" · ") || "Location not stated"}
          </p>
        </div>
        <span className="shrink-0 rounded-full px-3 py-1 text-xs font-bold" style={{ background: `${accent}1a`, color: accent }}>
          {worst === "red" ? "Blocking issues" : worst === "amber" ? "Needs review" : "Clear"}
        </span>
      </header>

      {risk_flags.length > 0 && (
        <div className="space-y-2 border-b border-[#17211c]/10 bg-[#faf8f1] px-6 py-4">
          {risk_flags.map((f, i) => {
            const s = SEVERITY[f.severity];
            return (
              <div key={`${f.code}-${i}`} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 shrink-0 rounded px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase" style={{ background: s.bg, color: s.fg }}>
                  {f.code}
                </span>
                <span className="text-[#38423b]">{f.message}</span>
              </div>
            );
          })}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-6 py-5 sm:grid-cols-3">
        <Field label="Extent" value={extent.value ? `${extent.value.toLocaleString("en-IN")} ${extent.unit} · ${extent.sqft_normalized.toLocaleString("en-IN")} sqft` : null} />
        <Field label="Consideration" value={consideration.amount_inr ? inr(consideration.amount_inr) : null} />
        <Field label="Deed date" value={consideration.date} />
        <Field label="Seller(s)" value={parties.sellers.join(", ")} />
        <Field label="Buyer(s)" value={parties.buyers.join(", ")} />
        <Field label="Khata / Site" value={[id.khata_number, id.site_number].filter(Boolean).join(" · ")} />
      </dl>

      {chain_of_title.length > 0 && (
        <section className="border-t border-[#17211c]/10 px-6 py-5">
          <p className="mb-3 text-[10px] font-bold tracking-[0.16em] uppercase text-[#8a9389]">Chain of title</p>
          <ol className="space-y-2">
            {chain_of_title.map((c, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 text-xs text-[#8a9389]">{c.date ?? "undated"}</span>
                <span className="font-medium">{c.from}</span>
                <span className="text-[#aab1a5]">→</span>
                <span className="font-medium">{c.to}</span>
                <span className="rounded-full bg-[#eef2e7] px-2 py-0.5 text-[10px] font-semibold text-[#4a5a4d]">{c.instrument}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {encumbrances.length > 0 && (
        <section className="border-t border-[#17211c]/10 px-6 py-5">
          <p className="mb-3 text-[10px] font-bold tracking-[0.16em] uppercase text-[#8a9389]">Encumbrances</p>
          <ul className="space-y-2">
            {encumbrances.map((e, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${e.status === "active" ? "bg-[#fbe4e4] text-[#9f1d1d]" : "bg-[#e9efe4] text-[#425446]"}`}>
                  {e.status}
                </span>
                <span className="font-medium">{e.type.replace("_", " ")}</span>
                <span className="text-[#526058]">{e.holder}</span>
                {e.amount_inr ? <span className="text-[#8a9389]">{inr(e.amount_inr)}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="flex flex-wrap items-center gap-3 border-t border-[#17211c]/10 bg-[#faf8f1] px-6 py-4 text-xs text-[#68766b]">
        {source_documents.map((d) => (
          <span key={d.doc_id} className="inline-flex items-center gap-1.5 rounded-full border border-[#17211c]/12 bg-white px-2.5 py-1">
            <span className="font-medium text-[#38423b]">{d.filename}</span>
            <span className="text-[#a4aa9e]">{d.language}</span>
            <span className={d.extraction_confidence < 0.7 ? "font-bold text-[#9f1d1d]" : "text-[#7d8a7f]"}>
              {Math.round(d.extraction_confidence * 100)}%
            </span>
          </span>
        ))}
      </footer>
    </article>
  );
}
