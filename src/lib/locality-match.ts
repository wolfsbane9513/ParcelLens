import { zodTextFormat } from "openai/helpers/zod";
import type { ParcelRecord } from "@/lib/schemas";
import { getOpenAI } from "@/lib/openai";
import {
  LocalityAdjudicationSchema,
  LOCALITY_ADJUDICATE_PROMPT_V1,
} from "@/lib/prompts/locality-adjudicate";

export const EMBEDDING_MODEL = "text-embedding-3-large"; // AGENTS §6

export type LocalityGeo = { lat: number; lng: number; precision: "locality"; source: "geocode" };
export type LocalityIndexEntry = {
  locality_romanized: string;
  locality_native: string;
  embedding: number[];
  geo: LocalityGeo;
};

export type MatchMethod = "exact" | "embedding" | "llm_adjudicated" | "none";
export type LocalityMatch = {
  locality_romanized: string;
  locality_native: string;
  geo: LocalityGeo;
  method: MatchMethod;
  confidence: number;
};

// Acceptance thresholds from the plan (§8 Phase 3).
const EMBED_ACCEPT = 0.85;
const EMBED_MARGIN = 0.05;

export function normalizeLocality(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\sऀ-ൿ]/g, "")
    .replace(/\b(hobli|village|taluk|ಹೋಬಳಿ|ಗ್ರಾಮ|ನಗರ)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Candidate locality strings from a parcel — the locality can land in village
// OR hobli depending on how the deed phrases it, so gather both.
export function localityQueries(id: ParcelRecord["identifiers"]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [id.village, id.hobli]) {
    if (!raw) continue;
    const n = normalizeLocality(raw);
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(raw);
    }
  }
  return out;
}

export function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

// Normalized exact match against a romanized OR native locality name.
export function exactMatch(queries: string[], index: LocalityIndexEntry[]): LocalityIndexEntry | null {
  for (const q of queries) {
    const nq = normalizeLocality(q);
    const hit = index.find(
      (e) => normalizeLocality(e.locality_romanized) === nq || normalizeLocality(e.locality_native) === nq,
    );
    if (hit) return hit;
  }
  return null;
}

export function rankByEmbedding(
  queryVec: number[],
  index: LocalityIndexEntry[],
): { entry: LocalityIndexEntry; score: number }[] {
  return index
    .map((entry) => ({ entry, score: cosineSim(queryVec, entry.embedding) }))
    .sort((a, b) => b.score - a.score);
}

// Accept only a clear winner: high score AND a margin over #2. A near-tie
// (e.g. Yelahanka vs Yelahanka New Town) returns null and routes to adjudication.
export function decideEmbedding(
  ranked: { entry: LocalityIndexEntry; score: number }[],
): { entry: LocalityIndexEntry; confidence: number } | null {
  const top = ranked[0];
  if (!top || top.score < EMBED_ACCEPT) return null;
  const margin = ranked[1] ? top.score - ranked[1].score : 1;
  if (margin < EMBED_MARGIN) return null;
  return { entry: top.entry, confidence: top.score };
}

function toMatch(entry: LocalityIndexEntry, method: MatchMethod, confidence: number): LocalityMatch {
  return {
    locality_romanized: entry.locality_romanized,
    locality_native: entry.locality_native,
    geo: entry.geo,
    method,
    confidence,
  };
}

async function embed(text: string): Promise<number[]> {
  const res = await getOpenAI().embeddings.create({ model: EMBEDDING_MODEL, input: text });
  return res.data[0].embedding;
}

async function adjudicate(
  query: string,
  candidates: LocalityIndexEntry[],
): Promise<{ entry: LocalityIndexEntry; confidence: number } | null> {
  const list = candidates.map((c, i) => `${i + 1}. ${c.locality_romanized} (${c.locality_native})`).join("\n");
  const res = await getOpenAI().responses.parse({
    model: "gpt-5.6",
    input: [
      { role: "system", content: LOCALITY_ADJUDICATE_PROMPT_V1 },
      { role: "user", content: `Parcel locality: "${query}"\n\nCandidates:\n${list}` },
    ],
    text: { format: zodTextFormat(LocalityAdjudicationSchema, "locality_adjudication") },
  });
  const out = res.output_parsed;
  if (!out || out.choice < 1 || out.choice > candidates.length) return null;
  return { entry: candidates[out.choice - 1], confidence: out.confidence };
}

// Three-tier match. Exact is pure + free; embedding/adjudication call the API
// only when exact fails. Returns null when nothing matches (no false positive).
export async function matchLocality(
  parcel: ParcelRecord,
  index: LocalityIndexEntry[],
): Promise<LocalityMatch | null> {
  const queries = localityQueries(parcel.identifiers);
  if (queries.length === 0 || index.length === 0) return null;

  const exact = exactMatch(queries, index);
  if (exact) return toMatch(exact, "exact", 1);

  // Embed each query; keep the ranking whose top score is highest.
  let best: { entry: LocalityIndexEntry; score: number }[] | null = null;
  for (const q of queries) {
    const ranked = rankByEmbedding(await embed(q), index);
    if (!best || (ranked[0]?.score ?? 0) > (best[0]?.score ?? 0)) best = ranked;
  }
  if (!best) return null;

  const decided = decideEmbedding(best);
  if (decided) return toMatch(decided.entry, "embedding", decided.confidence);

  const adjudicated = await adjudicate(queries[0], best.slice(0, 3).map((r) => r.entry));
  if (adjudicated) return toMatch(adjudicated.entry, "llm_adjudicated", adjudicated.confidence);

  return null;
}
