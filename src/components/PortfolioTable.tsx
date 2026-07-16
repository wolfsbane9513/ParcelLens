"use client";

import { useState } from "react";
import type { ParcelRecord } from "@/lib/schemas";
import { parcelSeverity, SEVERITY_COLOR } from "@/lib/severity";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

type SortKey = "locality" | "extent" | "deal" | "guidance" | "gap" | "flags";
const accessor: Record<SortKey, (p: ParcelRecord) => number | string> = {
  locality: (p) => p.identifiers.hobli || p.identifiers.village || "",
  extent: (p) => p.extent.sqft_normalized,
  deal: (p) => p.consideration.amount_inr,
  guidance: (p) => p.valuation?.guidance_value_total_inr ?? -1,
  gap: (p) => p.valuation?.gap_pct ?? 0,
  flags: (p) => p.risk_flags.length,
};

export function PortfolioTable({
  parcels,
  selectedId,
  onSelect,
}: {
  parcels: ParcelRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "gap", dir: 1 });

  const rows = [...parcels].sort((a, b) => {
    const va = accessor[sort.key](a);
    const vb = accessor[sort.key](b);
    const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
    return cmp * sort.dir;
  });

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));

  const totalDeal = parcels.reduce((s, p) => s + p.consideration.amount_inr, 0);
  const totalGuidance = parcels.reduce((s, p) => s + (p.valuation?.guidance_value_total_inr ?? 0), 0);
  const totalAcquisition = parcels.reduce(
    (s, p) => s + p.consideration.amount_inr + (p.valuation?.total_transaction_cost_inr ?? 0),
    0,
  );
  const blocking = parcels.filter((p) => parcelSeverity(p) === "red").length;

  const Th = ({ k, children, className = "" }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th
      className={`cursor-pointer select-none px-3 py-2 text-left font-semibold text-[#526058] hover:text-[#17211c] ${className}`}
      onClick={() => toggle(k)}
    >
      {children}
      {sort.key === k ? <span className="ml-1 text-[#86a26d]">{sort.dir === 1 ? "↑" : "↓"}</span> : null}
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#17211c]/12 bg-[#fffdf8]">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-[#17211c]/10 text-xs uppercase tracking-wide">
          <tr>
            <Th k="locality">Parcel</Th>
            <Th k="extent" className="text-right">Extent</Th>
            <Th k="deal" className="text-right">Deal</Th>
            <Th k="guidance" className="text-right">Guidance</Th>
            <Th k="gap" className="text-right">Gap</Th>
            <Th k="flags" className="text-right">Flags</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const sev = parcelSeverity(p);
            const gap = p.valuation?.gap_pct;
            return (
              <tr
                key={p.parcel_id}
                onClick={() => onSelect(p.parcel_id)}
                className={`cursor-pointer border-b border-[#17211c]/6 last:border-0 hover:bg-[#f4f8e9] ${
                  p.parcel_id === selectedId ? "bg-[#edf5d9]" : ""
                }`}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: SEVERITY_COLOR[sev] }} />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[#17211c]">
                        {p.identifiers.hobli || p.identifiers.village || "Unknown locality"}
                      </div>
                      <div className="truncate text-xs text-[#8a9389]">Survey {p.identifiers.survey_number ?? "—"}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[#38423b]">{p.extent.sqft_normalized.toLocaleString("en-IN")}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[#38423b]">{inr(p.consideration.amount_inr)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[#38423b]">
                  {p.valuation?.guidance_value_total_inr ? inr(p.valuation.guidance_value_total_inr) : <span className="text-[#aab1a5]">no rate</span>}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium" style={{ color: gap !== undefined && gap < 0 ? "#b91c1c" : "#2f7d4f" }}>
                  {gap === undefined ? "—" : `${gap >= 0 ? "+" : ""}${(gap * 100).toFixed(1)}%`}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[#38423b]">{p.risk_flags.length || "—"}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t-2 border-[#17211c]/15 bg-[#faf8f1] text-sm font-semibold">
          <tr>
            <td className="px-3 py-3">
              {parcels.length} parcel{parcels.length === 1 ? "" : "s"}
              {blocking > 0 && <span className="ml-2 rounded-full bg-[#fbe4e4] px-2 py-0.5 text-xs text-[#9f1d1d]">{blocking} blocking</span>}
            </td>
            <td />
            <td className="px-3 py-3 text-right tabular-nums" title="Total deal price">{inr(totalDeal)}</td>
            <td className="px-3 py-3 text-right tabular-nums" title="Total guidance value">{inr(totalGuidance)}</td>
            <td className="px-3 py-3 text-right text-xs font-normal text-[#68766b]" colSpan={2} title="Deal price + transaction costs">
              acq. {inr(totalAcquisition)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
