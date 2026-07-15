# ParcelLens

ParcelLens is a multilingual property due-diligence workspace for real estate teams evaluating land in Bengaluru. It is built for OpenAI Build Week, Work & Productivity.

## Phase 0

The current shell includes a Kannada-first upload surface, strict Zod schemas, a Vitest fixture, and six synthetic property documents in `data/samples/`:

- Two Kannada sale deeds
- Two Kannada encumbrance certificates
- One Hindi sale deed
- One English sale deed

The PDFs and PNG previews are synthetic demo documents, not legal records. The extraction, risk, valuation, map, and translation phases are intentionally staged behind the Phase 0 boundary.

## Quickstart

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`, then select a sample PDF or image in the upload card. The upload UI is non-functional until Phase 1.

Regenerate the sample documents with:

```bash
pnpm generate:samples
```

Run checks with:

```bash
pnpm typecheck
pnpm test
pnpm lint
```

Copy `.env.example` to `.env.local` before later phases add OpenAI and Google Maps calls.

## Scope guardrails

This is a screening tool, not a legal title opinion. It does not claim legal validity, scrape live government portals, predict market prices, process handwritten deeds, or provide multi-state coverage in the initial build.
