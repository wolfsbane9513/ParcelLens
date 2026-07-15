# ParcelLens

Multilingual property due-diligence for real estate teams evaluating land in Bengaluru. Upload a regional-language sale deed or encumbrance certificate (Kannada, Hindi, English) and ParcelLens reads it with **GPT-5.6**, extracts a structured parcel record, and flags title and encumbrance risks. Built for **OpenAI Build Week — Work & Productivity** with Codex.

> **Screening tool — not a substitute for a legal title opinion.**

## What works today (through Phase 2)

- **Upload → extract → flag** loop. Drop a sale deed and/or its EC on the landing page; they are read by GPT-5.6 vision and merged (by survey number + village) into one parcel card.
- **Structured extraction** into strict Zod-validated `ParcelRecord`s (`src/lib/schemas.ts` is the source of truth). PDFs and images go straight to the model as `input_file` / `input_image` — no OCR, no rasterization step.
- **Risk rule engine** (`src/lib/risk-flags.ts`): `CHAIN_GAP`, `ACTIVE_ENCUMBRANCE`, `EXTENT_MISMATCH`, `NAME_MISMATCH`, `LOW_EXTRACTION_CONFIDENCE`. (`BELOW_GUIDANCE` and `MISSING_CONVERSION` arrive with valuation in Phase 4.)
- **Honest failure states**: a non-property upload (e.g. a photo) returns a friendly "not a property document"; malformed model output is retried once then surfaced as an error — never a crash.
- **Six synthetic sample documents** in `data/samples/` (2 Kannada deeds, 2 Kannada ECs, 1 Hindi deed, 1 English deed). One deed+EC pair carries a deliberate chain gap + active mortgage to exercise the red flags. These are synthetic demo documents, not legal records.

- **Guidance-value (circle-rate) ingestion** (`scripts/ingest-rates.ts`): regional-language rate-table PDFs → GPT-5.6 vision → validated `RateEntry[]` in `data/rates/ka_bengaluru_urban.json`, each row carrying native + romanized locality and a source citation. Idempotent (re-runs skip already-ingested files; `--force` to re-extract) with a row-completeness guard against silent table truncation.

Locality matching, valuation, the map/portfolio surface, and the language toggle are staged in later phases (see `PARCELLENS_BUILD_PLAN.md`).

> **Rate data is synthetic.** Per plan §9, the guidance-value PDFs in `data/rates/raw/` are generated Kannada rate tables (`scripts/generate-rate-table.ts`), not live Kaveri-portal downloads — the portal has CAPTCHA/login. The **ingestion pipeline** is the product; swapping in real downloaded PDFs is a drop-in.

## Quickstart

```bash
pnpm install
cp .env.example .env        # then add your OPENAI_API_KEY
pnpm dev                    # http://localhost:3000
```

Drop `data/samples/kn-clean-sale-deed.pdf` (or several files together) onto the upload card to see a parcel extracted. Upload the `kn-flawed-*` pair together to see `CHAIN_GAP` + `ACTIVE_ENCUMBRANCE`.

### Verify extraction from the CLI

A thin one-document slice, useful before wiring anything on top:

```bash
pnpm verify:extract                                   # clean Kannada sale deed
pnpm verify:extract data/samples/hi-sale-deed.pdf     # any sample
```

### Checks

```bash
pnpm typecheck
pnpm test        # risk-flag + schema unit tests (no API key needed)
pnpm lint
```

### Rate ingestion (Phase 2)

```bash
pnpm generate:rates    # synthetic Kannada guidance-value PDFs -> data/rates/raw/
pnpm ingest:rates      # GPT-5.6 vision -> data/rates/ka_bengaluru_urban.json (needs key)
```

Regenerate the sample deeds with `pnpm generate:samples`. **Note:** the generators render Kannada/Hindi via system fonts — on a fresh Linux box install `fonts-noto` (Noto Sans Kannada + Devanagari) or text renders as boxes. The committed PDFs/PNGs are already rendered, so this only matters if you regenerate.

## Configuration

Secrets live only in `.env` (see `.env.example`):

| Var | Used for |
|---|---|
| `OPENAI_API_KEY` | GPT-5.6 extraction (required) |
| `GOOGLE_MAPS_API_KEY` | Map + geocoding (Phase 3+) |

## How it's built

- **Next.js 14 (App Router) + TypeScript + Tailwind**, single full-stack repo, no database — parcels live in memory and export as JSON.
- **Model**: `gpt-5.6` via the OpenAI Responses API with `responses.parse` + `zodTextFormat` for structured output. Every prompt is a versioned exported constant under `src/lib/prompts/` — no inline prompts.
- **Separation of concerns**: the model returns raw facts against a loose `DocExtractionSchema`; the server assigns ids, computes `sqft_normalized`, merges documents, and validates against the strict `ParcelRecordSchema`.
- Pure functions (risk flags, valuation) are unit-tested with Vitest.

## Scope guardrails

No legal-validity claims, no live portal scraping, no market-price prediction, no handwritten-deed OCR, no multi-state coverage, no auth — single-session demo. See §4 of `PARCELLENS_BUILD_PLAN.md`.
