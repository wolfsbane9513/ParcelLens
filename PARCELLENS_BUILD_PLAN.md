# ParcelLens — Build Plan & Agent Spec

**Hackathon:** OpenAI Build Week Challenge · **Track:** Work & Productivity
**Deadline:** Tue, July 21, 2026, 5:00 PM PT (= Wed, July 22, 5:30 AM IST — treat *your* deadline as the night of July 21 IST)
**Credits deadline:** Fri, July 17, 12:00 PM PT — claim free Codex credits on the Resources tab FIRST.

> **How to use this file:** Put it in the repo root. Reference it from `AGENTS.md` (Codex) or `CLAUDE.md` (Claude Code) with one line: *"Read PARCELLENS_BUILD_PLAN.md before any task. Work one phase at a time. Do not start a phase until the previous phase's acceptance criteria pass."* Then paste each Phase's **Agent Task** block as your prompt.

---

## 1. One-paragraph pitch

Real estate developers in India evaluate many land parcels under time pressure, but the source of truth — sale deeds, encumbrance certificates, khata extracts, and government guidance-value (circle rate) notifications — is fragmented across state portals and written largely in regional languages (Kannada, Hindi, Marathi, Tamil, Telugu). ParcelLens ingests these regional-language documents, extracts structured facts with GPT-5.6, flags title and valuation risks, looks up the applicable government guidance value, and pins every parcel on a Google Map with color-coded risk — turning weeks of manual due-diligence triage into minutes. The architecture generalizes to any country with non-English property records.

## 2. Judging-criteria alignment (keep these in every decision)

| Criterion | How ParcelLens scores |
|---|---|
| Technological implementation | Multilingual + multimodal GPT-5.6 pipeline (Kannada/Hindi doc → structured JSON), embedding-based cross-script locality matching, agent-adjudicated fuzzy matches. Built with Codex; /feedback session ID captured. |
| Design | Complete product loop: upload → extract → flag → value → map. Portfolio view, language toggle, empty/error states. Not a notebook demo. |
| Potential impact | ~2/3 of Indian civil cases involve land disputes; developer due diligence takes weeks per parcel; third-party portals show stale circle rates after revisions. Specific persona: land-acquisition teams at small/mid developers. |
| Quality of idea | Map-first + language-first is the differentiator vs. report-generating competitors. Honest scoping (screening tool, not legal opinion). |

## 3. Goals

1. A user can upload a sale deed + EC in Kannada (or Hindi) and get a structured, accurate parcel card in under 60 seconds.
2. Every parcel is pinned on Google Maps with a green/amber/red risk color and a click-through card.
3. Guidance value lookup works for at least 2 Bengaluru localities from real regional-language rate data, with deal-vs-guidance gap and full transaction-cost estimate.
4. The full due-diligence brief renders in English AND at least one regional language via a toggle.
5. Judges can run the whole thing from the README in under 10 minutes using bundled sample documents.

## 4. Non-goals (write these in the README too — judges respect scoping)

- **No handwritten/historical deed OCR.** Typed/printed docs and clear scans only. (Handwriting is a research project, not a week.)
- **No live scraping of Kaveri/Bhoomi/IGR portals.** CAPTCHA + login + fragility. Rate data is ingested offline from downloaded PDFs; the *pipeline* is the product.
- **No market-price prediction model.** Guidance value + gap analysis only. A bad prediction poisons demo credibility.
- **No legal validity claims.** Persistent UI disclaimer: "Screening tool — not a substitute for a legal title opinion."
- **No multi-state coverage.** Karnataka deep + 1 Hindi/Marathi doc to prove language generality. Other states = roadmap slide.
- **No auth/user accounts.** Single-session demo app.

## 5. Tech stack (chosen for 6-day velocity — do not deviate without reason)

- **App:** Next.js 14+ (App Router), TypeScript, single repo, full-stack (API routes for server work).
- **AI:** OpenAI SDK. `gpt-5.6` for extraction/translation/adjudication (vision input for scanned PDFs/images); `text-embedding-3-large` for locality matching. **Hackathon rule: the project must be built with Codex + GPT-5.6 — keep GPT-5.6 as the workhorse model.**
- **Maps:** Google Maps JavaScript API (`@vis.gl/react-google-maps`), Geocoding API for fallback geocoding. Free tier is enough.
- **Storage:** NO database. Committed JSON files: `data/rates/*.json` (rate tables), `data/localities/index.json` (precomputed embedding index), `data/samples/` (sample docs). Uploaded parcels live in server memory + are export/importable as JSON. This is deliberate: zero setup for judges.
- **PDF/image handling:** send pages to GPT-5.6 vision directly (render PDF pages to PNG server-side with `pdf-to-img` or similar). Avoid OCR libraries entirely.
- **Styling:** Tailwind. Clean, dense, dashboard-like. Dark-on-light.
- **Tests:** Vitest for the valuation engine and locality matcher (pure functions — cheap, high-signal tests).

## 6. Repo structure

```
parcellens/
├── PARCELLENS_BUILD_PLAN.md      # this file
├── AGENTS.md                     # points agents at this plan; coding conventions
├── README.md                     # judge-facing (Phase 6)
├── .env.example                  # OPENAI_API_KEY, GOOGLE_MAPS_API_KEY
├── data/
│   ├── samples/                  # sample deeds/ECs (kn, hi, en) — PDFs + PNGs
│   ├── rates/ka_bengaluru_urban.json
│   └── localities/index.json     # {locality, native, romanized, embedding[], geo}
├── scripts/
│   ├── ingest-rates.ts           # regional-language rate PDF -> rates JSON (uses GPT-5.6)
│   ├── build-locality-index.ts   # localities -> embeddings index
│   └── generate-samples.ts       # synthetic regional-language sample deeds
├── src/
│   ├── app/                      # Next.js pages + API routes
│   │   ├── page.tsx              # map + portfolio dashboard
│   │   ├── parcels/[id]/page.tsx # parcel detail
│   │   └── api/{extract,valuate,translate}/route.ts
│   ├── lib/
│   │   ├── extraction.ts         # GPT-5.6 doc -> ParcelRecord
│   │   ├── locality-match.ts     # romanize + embed + adjudicate
│   │   ├── valuation.ts          # pure functions, unit-tested
│   │   ├── risk-flags.ts         # rule engine over ParcelRecord
│   │   └── schemas.ts            # zod schemas (source of truth)
│   └── components/               # Map, ParcelCard, PortfolioTable, LangToggle
└── tests/
```

## 7. Data schemas (implement as zod in `src/lib/schemas.ts` — the single source of truth)

### 7.1 ParcelRecord

```jsonc
{
  "parcel_id": "uuid",
  "created_at": "ISO-8601",
  "source_documents": [
    { "doc_id": "uuid", "doc_type": "sale_deed | encumbrance_certificate | khata | rtc | other",
      "language": "kn | hi | ta | te | mr | en", "filename": "string",
      "extraction_confidence": 0.0 }
  ],
  "identifiers": {
    "survey_number": "string|null", "site_number": "string|null", "khata_number": "string|null",
    "village": "string|null", "hobli": "string|null", "taluk": "string|null",
    "district": "string|null", "state": "KA | MH | TN | ...", "pin_code": "string|null"
  },
  "extent": { "value": 0, "unit": "sqft | sqm | acre | gunta | cent", "sqft_normalized": 0 },
  "parties": { "sellers": ["string"], "buyers": ["string"] },
  "consideration": { "amount_inr": 0, "date": "ISO-8601|null" },
  "chain_of_title": [
    { "from": "string", "to": "string", "instrument": "sale | gift | partition | inheritance | court_order",
      "date": "ISO-8601|null", "registration_number": "string|null" }
  ],
  "encumbrances": [
    { "type": "mortgage | lien | lease | court_attachment", "holder": "string",
      "amount_inr": 0, "status": "active | discharged", "date": "ISO-8601|null" }
  ],
  "boundaries": { "north": "string|null", "south": "string|null", "east": "string|null", "west": "string|null" },
  "geo": { "lat": 0, "lng": 0, "precision": "parcel | locality | village | manual", "source": "geocode | manual" },
  "risk_flags": [ { "code": "string", "severity": "red | amber | info", "message": "string", "evidence_doc_id": "uuid|null" } ],
  "valuation": { /* ValuationResult, §7.3 */ }
}
```

### 7.2 RateEntry (one row of a guidance-value table)

```jsonc
{
  "state": "KA", "district": "Bengaluru Urban", "taluk": "string", "hobli": "string|null",
  "locality_native": "ಯಲಹಂಕ ...", "locality_romanized": "yelahanka ...",
  "property_type": "residential_site | apartment | agricultural | commercial",
  "road_width_category": "string|null",
  "rate_per_sqft_inr": 0,
  "effective_date": "ISO-8601",
  "source_notification": "filename/citation of the gazette PDF"
}
```

### 7.3 ValuationResult

```jsonc
{
  "matched_rate": { /* RateEntry */ }, "match_confidence": 0.0, "match_method": "exact | embedding | llm_adjudicated | none",
  "guidance_value_total_inr": 0,
  "deal_price_inr": 0,
  "gap_pct": 0,                     // (deal - guidance) / guidance
  "duty_basis_inr": 0,              // max(deal, guidance) — Karnataka registers on the higher
  "stamp_duty_inr": 0, "cess_inr": 0, "surcharge_inr": 0, "registration_fee_inr": 0,
  "total_transaction_cost_inr": 0,
  "flags": ["BELOW_GUIDANCE" ]
}
```

**Karnataka cost constants** (put in `valuation.ts` as a config object with a `verify_before_use: true` comment and a UI footnote "rates as configured — verify at SRO"): stamp duty 5% of duty basis (residential > ₹45L), cess 10% *of stamp duty*, surcharge 2% *of stamp duty*, registration fee 2% of duty basis.

### 7.4 Risk flag codes (rule engine in `risk-flags.ts`)

| Code | Severity | Rule |
|---|---|---|
| `CHAIN_GAP` | red | Chain of title has a hole: a `to` party never appears as a later `from`, or gap > 13 years between transfers with no instrument. |
| `ACTIVE_ENCUMBRANCE` | red | Any encumbrance with `status: active`. |
| `BELOW_GUIDANCE` | red | `deal_price < guidance_value_total` (registration-blocking in Karnataka). |
| `EXTENT_MISMATCH` | amber | Extent differs > 5% between two source documents for the same parcel. |
| `NAME_MISMATCH` | amber | Current seller not found among the most recent `to` parties in the chain (use normalized fuzzy compare). |
| `MISSING_CONVERSION` | amber | Property type in rate match is agricultural but deed describes residential use. |
| `LOW_EXTRACTION_CONFIDENCE` | info | Any doc `extraction_confidence < 0.7` — show "verify manually". |

---

## 8. Phased build plan

Rules for the agent (Codex / Claude Code):

1. Work strictly one phase at a time. Run the phase's acceptance checklist before declaring done.
2. Never expand scope. If something seems missing, add it to `PARKING_LOT.md` instead of building it.
3. Every GPT-5.6 prompt used in the pipeline lives in `src/lib/prompts/` as a versioned exported constant — never inline. (These get shown in the demo video as "key decisions".)
4. All model calls request structured output validated by the zod schemas; on validation failure, retry once with the validation error appended, then surface a graceful error state.
5. Small commits with descriptive messages — the commit history is evidence of genuine effort for judges.

### Phase 0 — Scaffold + sample data (July 15, evening)

**Agent Task:** "Scaffold the repo per §6: Next.js 14 + TS + Tailwind + Vitest, `.env.example`, zod schemas from §7 in `src/lib/schemas.ts` with exported types, empty lib modules with TODO stubs, and a landing page with an upload dropzone (non-functional). Then implement `scripts/generate-samples.ts`: use GPT-5.6 to generate 6 realistic synthetic property documents as HTML → render to PDF (puppeteer): 2 Kannada sale deeds (one clean, one with a deliberate chain gap + active mortgage in its paired EC), 2 Kannada ECs (paired), 1 Hindi sale deed, 1 English sale deed. Use fictional parties, real-looking Bengaluru localities (Yelahanka, Whitefield areas), survey-number formats like '45/2'. Save to `data/samples/` as PDF + first-page PNG."

**Acceptance:** `npm run dev` serves the shell; `npx tsc --noEmit` clean; 6 sample docs render legibly with correct scripts; schemas parse a hand-written fixture.

### Phase 1 — Extraction pipeline (July 16)

**Agent Task:** "Implement `src/lib/extraction.ts` + `POST /api/extract`: accept uploaded PDF/PNG(s), render PDF pages to PNG, send to GPT-5.6 vision with a prompt that (a) identifies doc_type and language, (b) extracts every ParcelRecord field present, (c) returns a per-field confidence and an overall `extraction_confidence`, (d) returns `null` (never guesses) for absent fields. Merge multiple documents into one ParcelRecord when identifiers match (survey number + village), recording provenance per doc. Wire the upload dropzone to this endpoint and render a raw ParcelCard (no map yet). Then implement `risk-flags.ts` rules from §7.4 (except BELOW_GUIDANCE — that's Phase 4) with unit tests."

**Acceptance:** All 6 samples extract with correct parties, survey number, extent, consideration; the deliberately-flawed pair produces `CHAIN_GAP` + `ACTIVE_ENCUMBRANCE`; Hindi doc extracts as well as Kannada; wrong-file upload (e.g., a cat photo) yields a friendly "not a property document" state; unit tests pass.

### Phase 2 — Rate ingestion (July 17, morning) ⚠️ claim Codex credits before 12 PM PT today

**Agent Task:** "Implement `scripts/ingest-rates.ts`: input = one or more guidance-value PDFs (regional-language tables from the Kaveri portal's area-wise PDFs; I will download 2 Bengaluru localities' worth manually and drop them in `data/rates/raw/`), output = validated `RateEntry[]` in `data/rates/ka_bengaluru_urban.json`. Pipeline: render pages → GPT-5.6 vision extracts table rows → normalize (romanize locality via GPT-5.6, map property types to our enum, parse rates as integers) → zod-validate → write JSON with source citations. Log a summary table. If a real PDF proves unparseable today, generate a realistic synthetic Kannada rate-table PDF and ingest that instead — the pipeline is the demo, note the substitution in README."

**Acceptance:** ≥ 40 RateEntry rows across ≥ 2 localities; spot-check 5 rows against source by eye; every row has native + romanized locality and a source citation; re-running the script is idempotent.

### Phase 3 — Locality matching (July 17, afternoon)

**Agent Task:** "Implement `scripts/build-locality-index.ts` (embed `locality_romanized` + `locality_native` for every distinct locality in the rates JSON with text-embedding-3-large; store vectors + centroid lat/lng geocoded once via Google Geocoding API into `data/localities/index.json`) and `src/lib/locality-match.ts`: given ParcelRecord identifiers, (1) exact normalized string match; (2) else cosine similarity over the index — accept if top score > 0.85 and margin over #2 > 0.05; (3) else send top-3 candidates + parcel context to GPT-5.6 to adjudicate or reject; record `match_method` and `match_confidence`. Reuse the matched locality's centroid as the parcel's `geo` (`precision: locality`) with a Geocoding-API fallback and a manual pin-adjust affordance flag. Unit-test with cross-script cases: 'Yelahanka' vs 'ಯಲಹಂಕ' vs 'Elahanka'."

**Acceptance:** All sample parcels match the correct locality; a nonsense locality returns `none` (no false positive); tests cover exact / embedding / adjudicated / none paths.

### Phase 4 — Valuation engine (July 18, morning)

**Agent Task:** "Implement `src/lib/valuation.ts` as pure functions per §7.3: pick applicable RateEntry (locality match + property type + road width when present), compute guidance total from `sqft_normalized`, duty basis = max(deal, guidance), then stamp duty / cess / surcharge / registration fee from the config object, total cost, gap_pct, and `BELOW_GUIDANCE` flag. `POST /api/valuate` takes a parcel_id and attaches ValuationResult to the ParcelRecord. Exhaustive unit tests including: below-guidance deal, missing rate match (graceful `match_method: none` — parcel card shows 'no rate data for this locality'), and zero/absent extent."

**Acceptance:** Hand-computed fixture matches to the rupee; all tests pass; no-match path renders gracefully in the card.

### Phase 5 — Map UI + portfolio + language toggle (July 18 afternoon – July 19)

**Agent Task:** "Build the product surface: (1) Main page = full-bleed Google Map of Bengaluru with color-coded parcel pins (red if any red flag, amber if only ambers, else green) + a left portfolio sidebar (sortable table: parcel, locality, extent, deal price, guidance value, gap %, flags; totals row with aggregate acquisition cost and count of blocking issues). (2) Pin click → ParcelCard popover; 'open detail' → `/parcels/[id]` with full extracted record, chain-of-title timeline, encumbrance list, valuation breakdown, per-doc provenance and confidences, and manual pin-adjust (drag pin → updates geo, precision: manual). (3) Language toggle (EN / ಕನ್ನಡ / हिन्दी) on the due-diligence brief: `POST /api/translate` renders the brief from the structured ParcelRecord in the target language via GPT-5.6 — generate from structure, don't translate prose. Cache per language. (4) Persistent footer disclaimer: 'Screening tool — not a legal title opinion. Cost rates as configured; verify at SRO.' (5) Empty state, loading states with progress ('Reading document… Extracting… Matching locality… Valuing…'), and an 'Export portfolio JSON' button."

**Acceptance:** Demo path works end-to-end fresh from `npm run dev`: upload 3 sample parcels → 3 pins with correct colors → portfolio totals correct → language toggle produces fluent Kannada brief → export works. No console errors; mobile not required.

### Phase 6 — Polish, README, video, submit (July 20 – 21)

**July 20 (day): hardening + judge experience.**
- README (judge-facing): what/why with the impact stats, 10-minute quickstart (clone → env keys → `npm i` → `npm run dev` → drag `data/samples/*`), architecture diagram, **"Where Codex accelerated the build"** section (concrete examples + screenshots), **"Key decisions"** section (normalize-at-ingestion vs per-language embedding models; no-DB design; synthetic-vs-real rate data), non-goals, roadmap (more states, live portal sync, handwriting).
- `PARKING_LOT.md` reviewed — anything critical? (Answer should be no.)
- Fresh-clone test on a clean machine/container following only the README.
- Capture the **/feedback Codex session ID** for the session(s) where core functionality was built — required in the submission form.

**July 20 (evening): demo video (< 3 min, public YouTube). Script:**
1. 0:00–0:20 — Problem: "Two-thirds of Indian civil cases are land disputes. Developers triage parcels for weeks, in five languages." Show a real Kannada deed.
2. 0:20–1:10 — Live loop: upload Kannada deed + EC → parcel card appears → red flags called out → pin drops on map.
3. 1:10–1:50 — Valuation: guidance value matched from a Kannada rate table, gap %, total transaction cost, BELOW_GUIDANCE blocker on the flawed parcel. Portfolio view: "a week of triage in ninety seconds."
4. 1:50–2:20 — Language toggle: same brief in Kannada. One line on generality: "same pipeline, any state, any country with non-English records."
5. 2:20–3:00 — **How Codex + GPT-5.6 built it** (required, with audio): show a real Codex session (e.g., it writing the extraction pipeline or the locality matcher), name GPT-5.6 as the extraction/translation/adjudication engine, show the prompts folder.

**July 21: submission checklist.**
- [ ] Repo public with license, or private + shared with `testing@devpost.com` and `build-week-event@openai.com`
- [ ] README complete; sample data bundled; fresh-clone test passed
- [ ] Video uploaded, public, < 3 min, audio covers Codex AND GPT-5.6
- [ ] /feedback Codex session ID entered in the form
- [ ] Track selected: Work & Productivity; project description written
- [ ] Submitted with hours to spare (evening July 21 IST, not 5:29 AM July 22)

---

## 9. Risk register & fallbacks

| Risk | Fallback |
|---|---|
| Real Kaveri rate PDFs unparseable / unavailable in time | Synthetic Kannada rate-table PDF; ingest that; disclose in README. Pipeline is the showcase, not coverage. |
| Survey-number geocoding is unreliable | Already designed around: locality-centroid pins + manual drag-adjust. Never block on precise geocoding. |
| GPT-5.6 extraction misses fields on real scans | Per-field confidence + LOW_EXTRACTION_CONFIDENCE flag + "verify manually" UI. Honesty is a feature. |
| Google Maps key/billing friction for judges | README includes keyless fallback: `NEXT_PUBLIC_MAP_FALLBACK=1` renders a static SVG map of Bengaluru with the same pins. Build this only if time permits (P1). |
| Phase 5 runs long | Cut in order: language toggle caching → portfolio totals row → detail-page timeline visualization. Never cut: map pins, parcel card, valuation card. |
| Time runs out on July 20 | The demo only needs 3 parcels and 2 localities. Reduce data, not features; reduce features, not the core loop. |

## 10. Open questions (resolve before Phase 2)

- **[You, blocking Phase 2]** Download 2 localities' guidance-value PDFs from the Kaveri portal (no login needed for guidance value search) — or green-light the synthetic fallback immediately.
- **[You, non-blocking]** Team or solo? If teammates join, Phase 1–2 (pipelines) and Phase 5 (UI) parallelize cleanly.
- **[You, non-blocking]** Confirm current Karnataka duty/fee percentages before the video — they've changed recently; the config object makes this a 2-minute edit.
