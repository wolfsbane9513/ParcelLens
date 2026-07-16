"use client";

import type { ParcelRecord } from "@/lib/schemas";
import { parcelSeverity, SEVERITY_COLOR } from "@/lib/severity";

// Keyless map: a projected plane over the Bengaluru bounding box. No tiles, no
// API key — lat/lng maps linearly to x/y. Honest and screenshot-clean; swap for
// a Google Maps renderer behind a key without touching callers.
const BOUNDS = { latMin: 12.86, latMax: 13.18, lngMin: 77.5, lngMax: 77.82 };
const W = 800;
const H = 620;

function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - BOUNDS.lngMin) / (BOUNDS.lngMax - BOUNDS.lngMin)) * W;
  const y = (1 - (lat - BOUNDS.latMin) / (BOUNDS.latMax - BOUNDS.latMin)) * H;
  return { x, y };
}

function isPlaced(p: ParcelRecord): boolean {
  return p.geo.lat !== 0 || p.geo.lng !== 0;
}

export function ParcelMap({
  parcels,
  selectedId,
  onSelect,
}: {
  parcels: ParcelRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const placed = parcels.filter(isPlaced);

  // Separate pins that land on the same centroid (same locality).
  const seen = new Map<string, number>();
  const pins = placed.map((p) => {
    const key = `${p.geo.lat},${p.geo.lng}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    const base = project(p.geo.lat, p.geo.lng);
    const angle = n * 2.4;
    return {
      parcel: p,
      x: base.x + (n === 0 ? 0 : Math.cos(angle) * 16),
      y: base.y + (n === 0 ? 0 : Math.sin(angle) * 16),
      color: SEVERITY_COLOR[parcelSeverity(p)],
    };
  });

  const grid = [];
  for (let i = 1; i < 6; i++) {
    grid.push(<line key={`v${i}`} x1={(W / 6) * i} y1={0} x2={(W / 6) * i} y2={H} stroke="#17382a" strokeOpacity={0.06} />);
    grid.push(<line key={`h${i}`} x1={0} y1={(H / 6) * i} x2={W} y2={(H / 6) * i} stroke="#17382a" strokeOpacity={0.06} />);
  }

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-[#17211c]/12 bg-[#eef2e4]">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Map of parcels in Bengaluru">
        <rect width={W} height={H} fill="#eef2e4" />
        {grid}
        <text x={16} y={28} fontSize={13} fontWeight={700} fill="#17382a" opacity={0.6} letterSpacing="0.15em">BENGALURU</text>
        <text x={W - 20} y={28} fontSize={12} fill="#526058" textAnchor="end">N ↑</text>

        {pins.map(({ parcel, x, y, color }) => {
          const selected = parcel.parcel_id === selectedId;
          return (
            <g key={parcel.parcel_id} className="cursor-pointer" onClick={() => onSelect(parcel.parcel_id)}>
              {selected && <circle cx={x} cy={y} r={18} fill={color} opacity={0.18} />}
              <circle cx={x} cy={y} r={selected ? 11 : 8} fill={color} stroke="#fffdf8" strokeWidth={2.5} />
              <text x={x + 14} y={y + 4} fontSize={12} fontWeight={selected ? 700 : 500} fill="#17211c">
                {parcel.identifiers.hobli || parcel.identifiers.village || parcel.identifiers.survey_number || "?"}
              </text>
            </g>
          );
        })}
      </svg>

      {placed.length === 0 && (
        <div className="absolute inset-0 grid place-items-center text-sm text-[#68766b]">
          Valued parcels appear here as pins.
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 left-4 flex gap-4 rounded-full bg-[#fffdf8]/90 px-4 py-2 text-xs font-medium shadow-sm">
        {(["red", "amber", "green"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: SEVERITY_COLOR[s] }} />
            {s === "red" ? "Blocking" : s === "amber" ? "Review" : "Clear"}
          </span>
        ))}
      </div>
    </div>
  );
}
