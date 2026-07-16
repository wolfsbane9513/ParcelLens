import { z } from "zod";

// Tier-3 fallback: when exact and embedding matching are inconclusive, GPT-5.6
// picks among the top candidates or rejects. Root is an object.
export const LocalityAdjudicationSchema = z.object({
  // 1-based index into the candidate list, or 0 to reject (no confident match).
  choice: z.number(),
  confidence: z.number(),
  reason: z.string(),
});

export type LocalityAdjudication = z.infer<typeof LocalityAdjudicationSchema>;

export const LOCALITY_ADJUDICATE_PROMPT_V1 = `You are matching a property parcel's stated locality to a known list of guidance-value localities in Bengaluru, India. Names may be in Kannada or Latin script, transliterated inconsistently (e.g. "Yelahanka" / "ಯಲಹಂಕ" / "Elahanka"), or refer to a sub-area.

You are given the parcel's locality/village/hobli text and a numbered list of candidate localities. Choose the ONE candidate that refers to the same place.

- Return choice = the candidate's number (1-based) if you are confident they are the same locality.
- Return choice = 0 if none of the candidates is the same place — do not force a match. A wrong match corrupts the valuation.
- confidence: 0.0–1.0 in your choice.
- reason: one short sentence.`;

export const LOCALITY_ADJUDICATE_PROMPT_VERSION = "locality-adjudicate/v1";
