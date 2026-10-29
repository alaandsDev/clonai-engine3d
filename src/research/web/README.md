# Web research v1

The network boundary is asynchronous. `SearchProvider` returns discovery data; `WebSourceProvider.fetch` obtains UTF-8 text, checks robots and HTTP safety, preserves immutable raw snapshots, and admits sources through the existing research core. Its synchronous `receive` method returns only acquired snapshots, preserving the Phase 19 interface. No search excerpt is an extraction input.

`runWebResearch` plans bounded rounds and coverage-driven follow-ups. Config defaults disable networking; the CLI request must explicitly enable it. MediaWiki REST is the initial free provider and searches one reference corpus. Domain hints are explicit policy inputs. Discovery scores do not become final source quality. DNS answers must all be public and the Node transport pins those answers; every redirect repeats validation and robots checks. Downloads accept only bounded text, without executing scripts. The implementation serializes requests, which is stricter than the configurable concurrency ceiling.

`replayWebResearch` makes no network calls. It verifies the original session and raw snapshots, rebuilds the EvidencePack with Phase 19, runs GROUNDED_ONLY again, and compares pack/ranking/writer/script/plan fingerprints. Immutable discovery and session caches accompany the raw snapshot cache. Changing a parser or policy can correctly invalidate an older replay.

English extraction requires `sourcePolicy.allowEnglishExtraction: true`. It supports a small set of literal temperature and human-presence patterns. Quotes remain English with raw source spans; contextual subjects also require exact heading/lead spans. PT extraction defaults and fixture writer outputs remain compatible. CSV MIME is accepted as text; no universal CSV, PDF or JavaScript-page parser is provided. Missing facts and unrelated documents do not establish a ranking.

```powershell
npm run research:web -- out/engine3d/phase20/inputs/real-cold-places-request.json
npm run research:web:replay -- out/engine3d/phase20/logs/real-cold-places.json
npm run research:web:inspect -- out/engine3d/phase20/logs/real-cold-places.json
npm run check:web-research
```

A READY research pack is separate from grounded-script selection, visual eligibility and measured production timing. Scope is limited to candidates discovered in the session; the system does not establish exhaustive global superlatives. No video is rendered automatically by these commands.

# Web research v2 (Phase 21)

A request with `sourcePolicy.researchVersion: 2` needs `web.v2` and runs `runWebResearchV2`: round 0 is broad discovery through the MediaWiki reference corpus; each further round runs VERIFICATION (the entity's own reference page for a missing fact family), ORIGIN_DISCOVERY (follow footnote/inline references attached to evidence of facts that still lack an origin) and CORROBORATION (Wikidata declared official website, OpenAlex works). Strategies are `MEDIAWIKI_REFERENCE_SEARCH`, `REFERENCE_FOLLOWING`, `WIKIDATA_ENTITY_DISCOVERY` and `OPENALEX_ACADEMIC_SEARCH` — all free, keyless public endpoints, each failure recorded while the others continue. A provider never decides the source class: classification happens after fetch (explicit domain hint, reference corpus, archived original, scholarly meta tags, JSON-LD publisher type; otherwise OTHER).

`ReferenceCandidate` keeps sourceId, targetUrl, anchorText, contextSpan (the supported evidence), referenceType, researchQuestionIds, confidence, reason, evidenceIds and the gap it serves. Only references attached to evidence of entities with open gaps are followed (no crawl), at most `maxReferencesPerSource` per source; every link goes through the same canonicalization, DNS/IP pinning, redirect, robots, MIME and size checks. PDFs are not fetched (`PDF_SOURCE_UNSUPPORTED`, reported as `PRIMARY_SOURCE_DISCOVERED_BUT_PDF_UNSUPPORTED` for institution-like hosts). A dead original may be retried through its archived copy, which is the same origin (MIRRORS).

Stage budgets (`broadDiscovery`, `originDiscovery`, `verification`, `corroboration`) are fetch attempts whose sum may not exceed `maxFetchedSources`; a stage with nothing actionable passes its remainder to the next stage in that order (`BUDGET_REALLOCATED` diagnostic). Ready entities are skipped. The session's `v2` section records strategies, references, stage budgets, the entity pool, typed gaps (SOURCE_DISCOVERY/FETCH/FORMAT, EVIDENCE_EXTRACTION, CORROBORATION, FACT_CONFLICT, VISUAL, WRITER_REALIZATION) and diversity/corroboration/structured metrics. In v2 the fetcher also detects English by function-word frequency when a page declares no language, and flags direct evidence from a value+unit, a unit header or explicit presence/census wording.

```powershell
npm run research:web -- examples/research/web-v2-cold-request.json out/engine3d/phase21
npm run research:web:replay -- out/engine3d/phase21/logs/real-cold-places-v2.json out/engine3d/phase21
npm run check:research-v2
```

# Web research v3 (Phase 22)

Use `researchVersion: 3` and `web.v2` budget configuration. R0 broad discovery, R1 entity expansion, R2 verification, R3 references/publisher links and R4 independent corroboration repeat through a bounded R5 follow-up cycle. R5 is a loop phase, not a separate network provider. Free MediaWiki, Wikidata, OpenAlex and Crossref adapters share the secure HTTP boundary. Publisher links remain same-publisher discovery paths and do not create independent origins.

`CandidateEntityPool` ranks source-backed gaps, keeping search-only titles and observation sites separate. Purpose-tagged `CorroborationTask` queries exclude known origins and enforce their per-task fetch budget. A reference-derived attempt cannot discharge a task that requires independent discovery. Independently discovered sources can still be derivative evidence; SourceGraph and per-fact origin roots decide corroboration.

Bounded CSV/TSV ingestion hashes and records the full downloaded payload before retaining a header plus candidate rows. `metadata.partial` records original byte count/hash, selection rule and row counts; evidence offsets refer to the retained partial snapshot. This does not implement truncation of oversized HTML. Unsupported languages, JavaScript requirements, anti-bot pages and PDF references produce diagnostics. PDFs are not downloaded or interpreted, and browser scripts are not executed.

The saved `v3` session view includes pool/tasks/discovery provenance and fingerprints. Replay blocks no errors by falling back to stored conclusions: it rebuilds pool/tasks, context, graph, evidence, facts, ranking and writer, and rejects fingerprint/content mismatches. `research-v3-audit.ts` additionally disables HTTP, HTTPS, fetch, DNS and transport while replaying saved sessions. Its strict R3 gate compares the same canonical fact with an earlier INSUFFICIENT state; the runtime `R3_ADMITTED_FACT` field alone only indicates an admitted fact.

```powershell
npm run research:web -- examples/research/web-v3-cold-request.json out/engine3d/phase22
npm run research:web -- examples/research/web-v3-population-request.json out/engine3d/phase22
npm run research:web:replay -- out/engine3d/phase22/logs/real-cold-places-v3.json out/engine3d/phase22
npx tsx cli/research-v3-audit.ts out/engine3d/phase22
```

`saveResearchArtifacts` writes 13 v3 JSON views and nine escaped Markdown review views. The audit combines both benchmark reviews and writes comparison, strict gates, replay, anti-hardcode, security, timing and registry/video integrity reports. Real benchmarks are live observations; cached replay and old-snapshot development observations are labelled separately. Research readiness, writer realization and rendering remain distinct gates.
