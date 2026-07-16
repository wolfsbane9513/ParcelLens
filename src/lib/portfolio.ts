import { ParcelRecordSchema, type ParcelRecord } from "@/lib/schemas";

// The portfolio lives in the browser (no database, single-session app). API
// routes are pure; this localStorage store is the source of truth for the UI and
// lets /parcels/[id] survive refresh and deep-links.
const STORAGE_KEY = "parcellens.portfolio.v1";

export function loadPortfolio(): ParcelRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = ParcelRecordSchema.array().safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function savePortfolio(parcels: ParcelRecord[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parcels));
}

export function getParcel(id: string): ParcelRecord | null {
  return loadPortfolio().find((p) => p.parcel_id === id) ?? null;
}

// Merge helper: replace a parcel with the same id, else append.
export function upsertParcels(current: ParcelRecord[], incoming: ParcelRecord[]): ParcelRecord[] {
  const byId = new Map(current.map((p) => [p.parcel_id, p]));
  for (const p of incoming) byId.set(p.parcel_id, p);
  return [...byId.values()];
}

// Validate an imported portfolio JSON (from the Export button). Returns null on
// anything malformed rather than throwing.
export function parsePortfolioJson(text: string): ParcelRecord[] | null {
  try {
    const parsed = ParcelRecordSchema.array().safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
