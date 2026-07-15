# Agent instructions — ParcelLens

Read `PARCELLENS_BUILD_PLAN.md` in full before any task. It is the single source of truth for scope, schemas, and phasing.

## Working rules

1. Work **one phase at a time** (§8 of the plan). Do not start a phase until the previous phase's acceptance checklist passes. State which phase you are in at the start of every session.
2. **Never expand scope.** The non-goals in §4 are hard boundaries. Good ideas outside scope go to `PARKING_LOT.md` as one-liners.
3. Zod schemas in `src/lib/schemas.ts` are the source of truth for all data shapes. Change them only with explicit approval, and update §7 of the plan in the same commit.
4. Every LLM prompt lives in `src/lib/prompts/` as an exported, versioned constant. No inline prompts.
5. All model outputs are zod-validated. On failure: one retry with the validation error appended, then a graceful UI error state. Never crash on bad model output.
6. Model names: `gpt-5.6` for extraction/translation/adjudication, `text-embedding-3-large` for embeddings. Do not substitute models.
7. Small, frequent commits with descriptive messages. Commit at least at every acceptance-criterion boundary.
8. TypeScript strict mode; `npx tsc --noEmit` and `npm test` must be clean before declaring any phase done.
9. Secrets only via `.env` (see `.env.example`). Never commit keys, never log document contents in full.
10. Deadline is fixed: July 21. When in doubt between "more robust" and "done today," choose done today and note the tradeoff in a code comment.

## Definition of done (per phase)

- Acceptance checklist in the plan passes, demonstrated with actual output (test run, screenshot description, or command output).
- No TypeScript errors, no failing tests, no console errors on the demo path.
- README updated if the run instructions changed.
