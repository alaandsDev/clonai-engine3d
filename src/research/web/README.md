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
