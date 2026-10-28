# Editorial pilot v1

`EditorialPlan + EditorialEventMap + injected catalog/approval records → compileEditorial → DirectorPlan`.
The engine contracts, renderer, narration, captions and 49 resources are unchanged. Plans are authored externally; no LLM, network or filesystem work happens in the compiler.

Each beat contains narrative intent, information type, emphasis, narration, a duration hint and explicit `staging` using existing DirectorShot fields. One beat becomes one scene/shot. Ordered beat narration must cover the script exactly after whitespace normalization. Every inter-beat CUT must be authored. No storytelling is inferred from prose or filenames.

## Contracts and timing

`contracts.ts` defines version 1 discriminated unions. `schema.ts` validates unknown JSON, closed fields, enums, finite values, normalized rectangles, relative asset paths and structural execution shapes. `qaEditorial` adds cross-reference, causal, conflict, catalog and approval checks. Final compilation invokes the existing `compileDirectorPlan`, including resource compatibility and captions validation.

Anchors: BEAT_START, BEAT_END, NORMALIZED, WORD and PHRASE. Unicode tokens are NFC/lowercase without locale-specific matching. Whole words/phrases must exist; repeated matches require a one-based occurrence. Approximate word starts use cumulative token character weights; durations are authored hints, quantized to the canvas frame grid. All pilot resolutions are **ESTIMATED**. EXACT and MEASURED are reserved confidence vocabulary, not currently generated from audio. BEAT_END is an exclusive boundary, usable for CUT only. The TTS provider and word boundaries remain unchanged.

## Event execution boundary

| Event | v1 behavior |
|---|---|
| VISUAL_FOCUS | Validated instance reference, review metadata; staging already defines the action. No automatic camera retarget. |
| CAMERA_EMPHASIS | At frame zero: PUSH/PULL/ORBIT/STATIC/PAN(left/right)/SHAKE map to existing cameras for the whole shot. Later anchors are PLAN_ONLY. |
| TEXT_EMPHASIS | At frame zero without custom placement: existing whole-shot onScreenText. Importance is metadata. Later/custom placement is PLAN_ONLY. |
| HOLD | Keep the shot without a cut for the requested interval. Does not freeze the pose, camera or existing actions. |
| CUT | Explicit end-of-beat boundary before a next beat. Internal/last-beat cuts fail. |
| ATMOSPHERE | Metadata only. VFX must already be explicitly authored in staging. |
| SFX_CUE | PLAN_ONLY even with approval: no mixer in this phase. |
| BROLL_REQUEST | PLAN_ONLY; no media resolver/provider. Generation flags must be false. |

`PLAN_ONLY` preserves every event and returns a labeled visual DirectorPlan alongside dispositions/reasons. **It is not a full audiovisual render approval.** `STRICT_RENDER` rejects every PLAN_ONLY event, including optional unresolved SFX and B-roll. To render the visual subset, `createRenderProjection` requires the exact pending event IDs and a reason, and returns the omission manifest with the plan. It does not add fallback content.

The normalized safe zone is authored on each plan. The pilot uses x=.08, y=.08, width=.84, height=.72 on 480×854. Custom rectangles must fit it, but custom layout rendering is not implemented. The legacy onScreenText region x=.08/y=.09/width=.84/height=.1 must fit the zone for a mapped label. This is a planning/layout guard, not proof that arbitrary glyphs/long text fit; the old caption layout is unchanged.

## Assets and approvals

An `EditorialAssetRef` is a minimal external reference, never a media registry or load instruction. Paths are portable relative paths with no traversal/absolute/Windows device forms. Catalog entries are injected data; membership is validated without implicit disk access. Only `cli/editorial-sfx-check.ts` resolves explicitly configured pack roots and checks the selected files (at most 12), with canonical containment, ffprobe and full decode to memory. No pack enumeration or audio copy occurs.

Lifecycle meanings:

- DISCOVERED: identified in a source catalog.
- CURATED: selected as a candidate by a declared rule/human; no creative approval implied.
- TESTED: technical evidence of valid probe/decode, finite samples, duration and integrity.
- APPROVED: explicit human review record for the exact event context, plus technical evidence. Never inferred or promoted by the compiler.
- REJECTED: cannot be referenced for execution in this pilot. Revocation must be reflected in the injected catalog.

The manifests are trusted local records, **not authenticated human identity or cryptographic proof of review**. The validator rejects missing/mismatched/context-free or machine-only approvals; it cannot stop someone deliberately fabricating a human record outside the system. No human APPROVED record was produced. License status is independent of technical/creative status. TESTED does not prove rights or pleasant sound.

## Determinism and usage

Canonical JSON sorts object keys by code-unit order; array order is meaningful. SHA-256 includes compiler version, plan, events, referenced asset state/content evidence, relevant approval content and decisions. Unreferenced candidates and approval timestamps do not invalidate the editorial result. No absolute runtime root, mtime, current clock, network or random input is included. This fingerprint supports future cache/review invalidation; no cache system is implemented.

```powershell
npm run check:editorial
# Technical pilot uses the existing FFmpeg installation; paths are explicit runtime configuration:
npm run engine3d:editorial:sfx -- --root <pack-root> --ffmpeg <ffmpeg-executable>
npm run engine3d:editorial
npm run check:editorial:render
```

The evidence CLI uses `examples/editorial/cold-pilot.json`, reads the Phase 7 shortlist, attaches one TESTED impact candidate and writes `out/engine3d/phase9`. It needs technical manifests from the preceding SFX command. The standalone render integration can use the fixture with unresolved SFX without opening the external pack. All compile/fast tests are offline. No dependency, provider, UI, overlay, mixer or TTS change is introduced.
