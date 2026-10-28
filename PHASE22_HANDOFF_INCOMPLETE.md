# Phase 22 — Incomplete Implementation Handoff

## 1. Purpose

Intermediate checkpoint of Phase 22 / Research v3, created to transfer work between agents.

**PHASE 22 IS NOT COMPLETE.** No real Phase 22 benchmark was run, there is no `check:research-v3` suite, no reviews, no audit and no `PHASE22_REPORT.md`. Everything below separates what is implemented from what was only compiled or observed in development.

## 2. Starting Point

- Phase 21 base commit: `838bc9c` (branch `main`, equal to `origin/main` at the start of Phase 22).
- Baseline before any Phase 22 change, run on the clean checkout: **15/15 commands PASS**, **688 fast tests PASS** (`out/engine3d/phase22/analysis/checks-baseline.tsv`, logs in `out/engine3d/phase22/logs/checks-baseline/`; `out/` is not in Git).

## 3. Work Completed So Far

All Phase 22 behaviour is opt-in via `sourcePolicy.researchVersion: 3`. v1 and v2 code paths are unchanged in behaviour (see §6).

| Area | State | Where |
|---|---|---|
| Research v3 contracts (DocumentSubjectCandidate, DocumentContextSummary, StructuredRecord/RecordField, MultiSubjectSemantics, EntityGraph, PublisherIdentity, AuthorityAssessment, EntityEligibility, ResearchV3Section, `subjectKind`, `sharedRecordId`, `subjectSource`, new alias states) | COMPLETE (compile-validated) | `src/research/contracts.ts` |
| Request validator: `researchVersion: 3`, `observationSitePolicy` (v3 only), v2 fields allowed for v2/v3 | COMPLETE, NEEDS VALIDATION (no v3 tests) | `src/research/request.ts` |
| Web config: strategies `CROSSREF_WORKS_SEARCH`, `PUBLISHER_LINK_FOLLOWING`; optional `crossrefEndpoint`, `maxDatasetBytes`, `maxPublisherLinksPerSource`, `budgets.entityExpansion` (validated only when present; no new defaults in v2 configs) | COMPLETE, NEEDS VALIDATION | `src/research/web/config.ts` |
| DocumentContext + DocumentSubjectCandidate (title, data headings, explicit location labels, h1+lead, JSON-LD Place, URL hint never decisive; ambiguity → `DOCUMENT_SUBJECT_AMBIGUOUS`) | COMPLETE, NEEDS VALIDATION | `src/research/context.ts` |
| Context-aware table interpretation (v3: `<td>` metric row labels, "Years" period-of-record column, subject inheritance with `subjectSource` and spans) | COMPLETE, NEEDS VALIDATION | `src/research/structured.ts` (`GridOptions`, `InheritedSubject`) |
| Section-label row handling (row led by a cell spanning ≥ half the table is not a header level) | COMPLETE (v3 only), dev-validated on real snapshots | `src/research/structured.ts` |
| `<td><strong>Label:</strong> value</td>` label/value parsing | COMPLETE, dev-validated | `src/research/records.ts` |
| SemiStructuredRecord extraction (label/value blocks, class-labelled divs, two-column label/value tables; heading context) | COMPLETE, NEEDS VALIDATION | `src/research/records.ts` |
| Multi-subject records (SINGLE / TIED_RECORD / ALTERNATIVE_SUBJECTS / AMBIGUOUS_SUBJECT; ambiguous → zero facts) | COMPLETE, dev-validated on the real WMO record | `src/research/records.ts` |
| Explicit tied records in English prose ("A and B share … record (low) of V" → one fact per subject, shared `sharedRecordId`, per-subject evidence id) | COMPLETE, NEEDS VALIDATION | `src/research/english.ts` (version 3) |
| PublisherIdentity (JSON-LD, publisher/author meta, "produced by …", copyright) | COMPLETE, dev-validated | `src/research/authority.ts` |
| AuthorityAssessment (GOVERNMENT needs explicit org statement + gov domain label or GovernmentOrganization schema; HIGH needs fact-domain compatibility; reference corpus never promoted; effective class used for assessment only, `pack.sources` keep the declared class) | COMPLETE, dev-validated | `src/research/authority.ts`, `src/research/v3.ts` (`applyAuthority`) |
| EntityGraph (STATION vs PLACE/SETTLEMENT nodes; OBSERVATION_SITE_FOR via data attribution citing the station document + name-token overlap, or explicit "serves" wording; NEAR; LOCATED_IN; ALIAS_OF) | COMPLETE, dev-validated for OBSERVATION_SITE_FOR | `src/research/entities.ts` |
| Station/location separation in identity (`subjectKind: 'STATION'` is part of the v3 fact identity) | COMPLETE | `src/research/v2.ts` (`identityV2`) |
| Alias states v3 (JSON-LD on the page subject → SUPPORTED_ALIAS; transliteration similarity → CANDIDATE_ALIAS; only CONFIRMED merges) | COMPLETE, NEEDS VALIDATION | `src/research/origins.ts` |
| Near-copy fact-window detection (word 4-gram Jaccard ≥ 0.6 between prose root evidences → merged root + NEAR_COPY relation) | COMPLETE (v3 only), NEEDS VALIDATION | `src/research/similarity.ts`, `src/research/v2.ts` |
| Ranking v3 (entity keys with station suffix; station measurements count for a place only via source-backed relation allowed by `observationSitePolicy`) | COMPLETE, NEEDS VALIDATION | `src/research/ranking.ts` |
| v3 assembly (authority → v2 core with v3 extraction → EntityGraph → sites → ranking → eligibility checklist → fingerprinted `pack.v3`) | COMPLETE, dev-validated on Phase 21 snapshots | `src/research/v3.ts`, `src/research/v3-extract.ts`, `src/research/pack.ts` |
| Fetcher v3 (discovery independence in provenance, language-preserving admission, JS/challenge diagnostics, bounded dataset ingestion) | COMPLETE, NEEDS VALIDATION (compile only) | `src/research/web/fetcher.ts` |
| Large CSV/TSV bounded ingestion (header + rows containing candidate-entity terms; `metadata.partial` with full size/hash/rule) | PARTIAL: implemented, never executed. Large HTML structural truncation is NOT STARTED. | `src/research/web/fetcher.ts` |
| Unsupported-language diagnostics (source kept in pack, assessed REJECT, never extracted, visible in SourceGraph) | COMPLETE, NEEDS VALIDATION | `src/research/web/fetcher.ts` |
| JS/challenge diagnostics (`JS_RENDER_REQUIRED`, `ANTI_BOT_CHALLENGE`, `EMPTY_STATIC_HTML`) | COMPLETE, NEEDS VALIDATION | `src/research/web/fetcher.ts` (`scriptDiagnostic`) |
| PDF diagnostics (`PDF_TEXT_REQUIRED` / `PDF_TABLE_REQUIRED` / `PDF_SCANNED_UNKNOWN` from reference context only; PDFs are never fetched) | COMPLETE, NEEDS VALIDATION | `src/research/web/v3.ts` |
| Crossref provider (keyless works search) | COMPLETE, NEEDS VALIDATION (never called live) | `src/research/web/v3.ts` |
| CandidateEntityPool (deterministic, fingerprinted) | COMPLETE, NEEDS VALIDATION | `src/research/web/v3.ts` |
| CorroborationTask (excluded known origins: domains of supporting sources and of their citations) | COMPLETE, NEEDS VALIDATION | `src/research/web/v3.ts` |
| Value-of-information priority (temp+residency scores; +15 when one step from eligible; low priority for incompatible-only entities) | COMPLETE, NEEDS VALIDATION | `src/research/web/v3.ts` |
| Purpose-tagged queries and query trace (`purpose`, `derivedFrom`, `targetGap`, `factId`, `excludedOrigins`, `provider`) | COMPLETE, NEEDS VALIDATION | `src/research/web/v3.ts`, `src/research/web/contracts.ts` |
| Discovery independence vs evidence independence (`discovery[].independence`, `laterDerived`) | COMPLETE, NEEDS VALIDATION | `src/research/web/v3.ts` (`sessionV3`) |
| Publisher-link following (same-publisher data/full-statistics links of INSTITUTIONAL_HIGH sources) | COMPLETE, NEEDS VALIDATION | `src/research/web/v3.ts` (`publisherLinks`) |
| R0–R5 loop (`runWebResearchV3`) | PARTIAL: written and compiling, NEVER EXECUTED (no mock test, no live run). R5 "remaining high-value gaps" is the repeated R1–R4 cycle, not a separate stage. | `src/research/web/v3.ts` |
| Session integration (`researchVersion 3` dispatch, `session.v3`) | COMPLETE, NEEDS VALIDATION | `src/research/web/provider.ts` |
| Replay integration (recomputes CandidateEntityPool/CorroborationTasks, fails with `REPLAY_V3_MISMATCH`) | COMPLETE, NEEDS VALIDATION (no v3 session exists yet) | `src/research/web/provider.ts` |
| `check:research-v3` suite | NOT STARTED | — |
| Output/review writers for v3 artifacts (`out/engine3d/phase22/*`, 9 required reviews) | NOT STARTED | — |
| Audit harness v3 (anti-hardcode v3, comparison 20/21/22) | NOT STARTED (Phase 21 `cli/research-v2-audit.ts` exists as a base) | — |
| Cold and second real benchmarks | NOT STARTED | — |
| README/docs for v3 | NOT STARTED | — |

## 4. Important Bugs Found and Fixed

### WMO line-break / multi-subject bug
The archived WMO record stores locations as `(a) Verkhoyansk, Russia […]<br/>(b) Oimaykon, Russia […]`. The first record-text cleanup collapsed the line break, the value became one string, and the subject splitter returned only "Verkhoyansk": −67.8 °C was attributed to Verkhoyansk alone (seen in development, never in a saved session). Fix in `records.ts`: line breaks are kept, inline `(a) … (b) …` enumerations are split, and enumerated/separated subjects are `ALTERNATIVE_SUBJECTS` or `AMBIGUOUS_SUBJECT` with zero individual facts. Only explicit tie wording (`share/shared/jointly/tied/…`) yields `TIED_RECORD`; formatting alone ("A / B") never does.

### Over-broad labels
Location labels matched any label containing site/place/settlement. So "Site number" counted as a second location (making station records ambiguous), and "Coldest inhabited place" / "Highest permanent settlement" counted as location labels (yielding bogus subjects such as "is La Rinconada"). Fix: location labels are whole-label matches (`(geospatial|geographic|observation)? location|place|site|station|… (name)?`).

### BOM section-label row
Official climate tables put a section row (one `th` spanning 16 columns: "Temperature") right after the column header. It was counted as a second header level, which hid the "Annual" column (and gave `header hierarchy deeper than two rows` on the full table). Fix (v3 only): after the first header row, a row whose first cell spans ≥ half the table is a section label.

### Temperature vocabulary
"Lowest maximum temperature" (−2.1) became `MINIMUM_RECORDED`, "number of days ≥ 30 °C" (205.2) became `AVERAGE`, and "Mean 9am/3pm temperature" became `AVERAGE`. Fix in the shared `temperatureQualifiers`: these return `STATISTIC_NOT_SUPPORTED …` (classified UNSUPPORTED_METRIC). This was not version-gated, because Phase 19/20 rederivations and Phase 21 replays were verified unchanged after the fix.

### Other
- `\b`/`\d` regex escapes were turned into control characters when an edit went through a shell string. They were repaired, and all `src/research` files were scanned: 0 control characters. Lesson for the next agent: edit through script files or the Edit tool, not inline shell strings.

## 5. Important Real Result Already Observed (offline, development only)

Reproduced on the current tree with `npx tsx tools/phase22-checkpoint/dev-v3.ts`. It rebuilds the saved Phase 21 Cold snapshots under `researchVersion: 3` with `observationSitePolicy: SOURCED_OBSERVATION_SITE`; no network.

1. **DocumentContext:** an official climate-statistics page resolves its subject to the observation site **LIAWENEE (STATION)**, from the explicit "Site name" label and a "Summary statistics …" heading.
2. **Extraction:** its "Lowest temperature (°C)" row, annual column, gives **−14.2 °C, period 2001–2026**, with `subjectSource` recorded.
3. **Authority:** the publisher statement "produced by the Bureau of Meteorology" plus a government domain label and a matching fact domain give `PRIMARY_OFFICIAL / INSTITUTIONAL_HIGH`.
4. **Admission:** the GroundedFact is **SUPPORTED** via `SINGLE_ORIGIN_AUTHORITY PRIMARY_OFFICIAL HIGH`, which the Cold policy already allows.
5. **Entity link:** a source-backed `OBSERVATION_SITE_FOR` edge (station → settlement Liawenee) exists, because Wikipedia's "Climate data for Liawenee" table cites the station's own page.
6. **Kept separate:** the settlement's own Wikipedia −14.2 fact stays a separate INSUFFICIENT fact, and the WMO record stays `ALTERNATIVE_SUBJECTS` (no fact).
7. **Not eligible:** the Liawenee residency is still single-origin (INSUFFICIENT), so the Cold ranking stays `RANKING_INCOMPLETE`, 0 eligible.

**THIS VALUE/ENTITY MUST NOT BE HARDCODED.** It must keep being derived generically from snapshots. It is a development observation on Phase 21 snapshots, not a Phase 22 benchmark result.

## 6. Compatibility Status (verified on the current working tree at checkpoint time)

- `npm run typecheck`: PASS.
- `tests/research.test.ts` + `tests/web-research.test.ts` + `tests/research-v2.test.ts`: **204/204 PASS**.
- Phase 19 packs (4) and Phase 20 packs (5) rederive identically; both Phase 20 sessions replay to the same processing fingerprint (`tools/phase22-checkpoint/legacy.ts`).
- Both Phase 21 sessions (Cold v2, population v2) replay with identical processing and pack fingerprints (`tools/phase22-checkpoint/legacy21.ts`).
- The full 15-command regression was **not** re-run after the Phase 22 changes. The last full run is the pre-change baseline (§2).

## 7. Exact Interruption Point

The last stage started was the offline Research v3 test suite (`tests/research-v3.test.ts`), covering spec tests §105–§127, the loop, replay and compatibility, with fictitious fixtures. The last message before the interruption was:

> "Now the offline v3 suite, covering spec tests §105–§127 plus the loop, replay and compatibility checks, with fictitious names and domains only:"

Filesystem check: `tests/research-v3.test.ts` **does not exist** and `package.json` has **no** `check:research-v3` script. The suite was never created or executed.

## 8. Current Test Status

| Command | Result | Tests | Failures |
|---|---|---|---|
| `npm run typecheck` | PASS | — | — |
| `npx tsx --test tests/research.test.ts tests/web-research.test.ts tests/research-v2.test.ts` | PASS | 204 | 0 |
| `npx tsx tools/phase22-checkpoint/legacy.ts` (scratchpad original) | PASS | 9 packs + 2 replays | 0 |
| `npx tsx tools/phase22-checkpoint/legacy21.ts` (also run from the repo copy) | PASS | 2 replays | 0 |
| `npm run check:research-v3` | DOES NOT EXIST | — | — |
| Full regression (15 commands) | NOT RE-RUN after changes | — | — |

## 9. Files Changed

NEW
- `src/research/context.ts`: DocumentContext, DocumentSubjectCandidate, data-heading subjects, ambiguity and inheritance (`subjectAt`).
- `src/research/records.ts`: semi-structured records, location/date/metric fields, multi-subject semantics, record facts.
- `src/research/authority.ts`: PublisherIdentity and AuthorityAssessment.
- `src/research/entities.ts`: EntityGraph, station/place keys, OBSERVATION_SITE_FOR/NEAR/LOCATED_IN/ALIAS_OF, observation-site map, transliteration key.
- `src/research/similarity.ts`: word-shingle Jaccard fact-window near-copy detection.
- `src/research/v3-extract.ts`: per-snapshot v3 extraction (context → tables → records).
- `src/research/v3.ts`: authority application, eligibility checklist, fingerprinted v3 section.
- `src/research/web/v3.ts`: Crossref provider, CandidateEntityPool, CorroborationTasks, publisher links, R0–R5 loop, session v3 view.
- `tools/phase22-checkpoint/{legacy,legacy21,dev-v3}.ts`: offline checkpoint helpers (not in tsconfig; run with `npx tsx` from the repo root).
- `PHASE22_HANDOFF_INCOMPLETE.md`: this file.

MODIFIED
- `src/research/contracts.ts`: v3 types; optional fields on CanonicalFact/StructuredProvenance/SourceInput/EvidencePack.
- `src/research/request.ts`: v3 validation.
- `src/research/structured.ts`: headings in ParsedHtml, GridOptions/v3 inheritance, section-label rows, years column, vocabulary fixes.
- `src/research/english.ts`: version 3 (tie extraction, per-subject tie evidence ids).
- `src/research/origins.ts`: v3 alias states.
- `src/research/v2.ts`: v3 extraction hook, station-aware identity, near-copy union, contexts/records/aliases returned.
- `src/research/pack.ts`: v3 authority + v3 section + ranking with observation sites.
- `src/research/ranking.ts`: entity-keyed ranking v3 with ObservationSites.
- `src/research/web/contracts.ts`: query purposes, discovery independence, CandidateEntity, CorroborationTask, ResearchSessionV3, new gap codes.
- `src/research/web/config.ts`: v3 optional keys and strategies.
- `src/research/web/fetcher.ts`: v3 options (independence, language preservation, JS diagnostics, bounded datasets).
- `src/research/web/provider.ts`: v3 dispatch, `session.v3`, replay of the v3 view.
- `src/research/web/index.ts`: exports `./v3`.

DELETED: none.

## 10. Remaining Work

1. Write `tests/research-v3.test.ts` and add `check:research-v3` to `package.json`. Cover §105–§127, a mocked R0–R5 loop, replay with zero network, tampered-v3 replay, the CSV formula row, language/JS/PDF diagnostics, publisher links, and v1/v2 compatibility. Fix the failures it finds.
2. Execute `runWebResearchV3` with mocks first; it has never run.
3. Output writers for the v3 directories and the 9 required reviews (`independent-discovery`, `candidate-entity-pool`, `document-context`, `entity-graph`, `station-resolution`, `primary-records`, `publisher-authority`, `corroboration`, `cold-eligibility`), plus the per-entity Cold eligibility table (§136).
4. Audit harness v3: zero-network replay, anti-hardcode v3 (subjects, values, domains, URLs, publisher names, station names, ranking order, final official sources), and the Phase 20/21/22 comparison.
5. Security regression: reference, publisher-link and API candidates through the same secure fetch.
6. Real benchmarks: Cold (exact topic and policy: MINIMUM_RECORDED, PERMANENT_POPULATION, quorum 2; add `observationSitePolicy` only with the justification documented) and the second domain (reuse the population benchmark). Write v3 request inputs under `examples/research/`.
7. Full 15+1 command regression and `engine3d:catalog`.
8. Documentation updates (`src/research/README.md`, `src/research/web/README.md`) and `PHASE22_REPORT.md` with the real-world gates R1–R6 reported separately.

## 11. Do Not Redo (audit before rewriting)

DocumentContext, records/multi-subject semantics, PublisherIdentity/Authority, EntityGraph/observation sites, the station-aware identity, ranking v3, v3 assembly in `pack.ts`, the fetcher v3 options, CandidateEntityPool/CorroborationTask, and replay of the v3 view. The core path was validated offline on real Phase 21 snapshots (§5) and v1/v2 compatibility is verified (§6).

## 12. Known Risks

- **Compile-only code:** `runWebResearchV3`, Crossref, publisher links, bounded dataset ingestion, language-preserving admission, `scriptDiagnostic` and the v3 replay check have never executed.
- **Tie wording:** `subjectsOf` and the English tie pattern rely on a small tie vocabulary, and the tie fact requires explicit low/cold wording.
- **Context heuristics:** headings without a data prefix are never subjects, by design; bare-name headings (e.g. "LIAWENEE") are ignored. `PLURAL`/generic word lists are heuristic.
- **Observation sites:** `OBSERVATION_SITE_FOR` via citation requires shared name tokens of ≥ 3 characters. This is conservative; stations with different names than the place will not link.
- **Authority:** depends on explicit publisher statements. `GOV_NAME` includes broad words, guarded by the gov-domain requirement. Wikidata official-website relations are not used for authority.
- **Station records in the pool:** the transposed-table extractor also yields other statistics (e.g. `AVERAGE_DAILY_MINIMUM`) for stations. They do not affect the Cold ranking, but they enter the pool.
- **Prefixed headings:** `context.ts` `headingSubject` returns kind STATION only from words in the name. The DOCUMENT_LABEL "Site name" is what currently gives STATION for official pages.
- **Remaining fragility:** `blockFields` regex scanning on very large pages (performance not measured for v3). Large HTML truncation is not implemented. `researchV3Section` eligibility is only meaningful for RANKING goals.
- **Not re-run:** the full regression after these changes.

## 13. Next Recommended Command

```bash
git status
git show --stat HEAD
```

Read `PHASE22_HANDOFF_INCOMPLETE.md`, then:

```bash
npm run typecheck
npx tsx --test tests/research.test.ts tests/web-research.test.ts tests/research-v2.test.ts
npx tsx tools/phase22-checkpoint/legacy21.ts
npx tsx tools/phase22-checkpoint/dev-v3.ts
```

Then create `tests/research-v3.test.ts` + `check:research-v3` (§10.1), run it, and continue from its failures.
