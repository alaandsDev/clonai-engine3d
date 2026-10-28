# Visual compositor v1 — Phase 11

`VISUAL_LAYER intent → explicit asset/context review → VisualCompositionPlan → verified derivative bindings → generic Remotion compositor`.

The existing MediaAssetRegistry now validates visual assets through an additive generic type parameter. Existing audio callers retain their default Audio/SFX types and schema; a visual or mixed registry opts into its explicit generic. Source and output files enumerate eight AUDIO/SFX separately from five selected VISUAL assets. Engine3D remains 49 resources; external visuals never become procedural VFX.

## Data and lifecycle

Visual types: DUST, LIGHT_LEAK, OVERLAY and GRAPHIC_ELEMENT. Graphics use ARROW/LINE/ICON/STICKER/EMOJI subtypes; other types use IMAGE/VIDEO. Pilot caps: 4 dust, 4 light leak, 6 overlay, 12 graphics, at most 26 visuals. IDs are assigned independently of filenames/root. The production pilot selects only five Phase 7 catalog entries: one per atmosphere type plus a left-pointing arrow and a scribbled oval. The oval is tagged EMPHASIS after inspection, not falsely described as a connecting line.

Registry fields include measured alpha classification/evidence, native codec/dimensions/fps/duration/frame count/bytes, compositionMode, semantic evidence and safe-zone suitability. Lifecycle remains TESTED. Context approvals do not turn a catalog item into globally APPROVED. UNKNOWN/DECLARED license state is independent of technical/creative approval.

`cli/visual-inspect.py` opens selected candidates only. It checks canonical containment, prior size/hash when available, ffprobe and full FFmpeg video decode; image alpha is measured at native resolution and video alpha across every source frame reduced spatially to 96×96. Five representative color frames supplement video review; near-end sampling stays 250ms/at least two frames before the probed end to avoid container-tail seek gaps. It does not certify native-resolution video alpha at every pixel. Image/clip review derivatives record source/preview hashes, settings and tool version. The two selected short video previews contain the full clip in motion. Originals remain untouched.

Alpha classes: TRUE_ALPHA, OPAQUE, BLACK_BACKGROUND, WHITE_BACKGROUND, CHROMA_REQUIRED, BLEND_REQUIRED, UNKNOWN. ALPHA mode requires measured transparency. SCREEN/ADD/MULTIPLY/NORMAL are explicit author decisions, never automatically chosen by the compositor. CHROMA is recognized as a contract but remains unresolved/unsupported in Phase 11. A non-alpha video or photo is not relabeled transparent just because it lives under OVERLAY.

## Approval and planning

Review starts with no approvals. `visual:approve`/reject requires explicit HUMAN type/identity, exact event context, role, source hash, mode, reason, evidence, preview hash and true/false motion-review flag. Preview files are contained under phase11 and their byte hashes are verified. Video requires an actual moving preview and reviewedMotion=true; contact sheet alone is insufficient. These are trusted local review records, not authenticated human identities or proof against deliberate forgery. Automated fixtures use synthetic reviews of generated data only.

VISUAL_LAYER is an additive EditorialEvent union: beatId/purpose/anchor + role/durationHint/intensity/normalized placement. There is no filename in the editorial intent. The old director compiler preserves it as PLAN_ONLY rather than choosing a procedural fallback. The visual resolver handles an explicit event → approval → asset selection. STRICT_RENDER fails for unresolved/rejected/incompatible media; PLAN_ONLY keeps pending intentions.

VisualCompositionPlan version 1 contains compositor version, editorial fingerprint, fps/canvas/totalFrames, safe/caption zones and resolved layers. Each layer records exclusive start/end frames, timing confidence, source hash/type/kind/duration, mode, opacity, normalized box plus scale/rotation, optional normalized source crop, loop policy, fades, z-order/order, explicit placement overrides, approvalRef and purpose. Word timing remains ESTIMATED. No keyframe editor or automatic aesthetic scoring exists.

## Geometry and stack

Transform x/y are top-left normalized coordinates. Width/height are normalized output box dimensions; scale/rotation act around its center. Rotated bounds account for canvas aspect ratio. Important graphics must fit the authored safe zone and avoid the reserved caption rectangle x=.07/y=.72/w=.86/h=.20 unless each relevant override is explicitly true. Atmospheric layers can be full-frame, but cannot move above text/captions. This is conservative geometry, not a glyph segmentation or visual quality model.

Explicit stack: Engine3D 0 → atmosphere 10 → graphic 20 → existing text 30 → existing caption 40. Array/import ordering cannot override it; duplicate stack/order pairs fail. At most three external layers can overlap. SequenceRenderer gained an optional editorial slot and explicit z-indices; caption text/timing/font/padding and the procedural world contracts were preserved.

## Rendering and derivatives

The generic `EditorialVisualSequence` composition uses the existing SequenceRenderer plus a data-driven VisualLayers slot. Browser-safe validators contain no Node/filesystem/crypto imports. Components have top-level hooks, stable event keys, derived state during render and memoized validation/order. No component is created for a particular asset.

Compatible images are decoded by existing tooling and normalized on demand to PNG RGBA (maximum width 768). Selected/approved videos normalize on demand to 480-wide PNG RGBA sequences at composition fps. Browser rendering therefore relies on verified PNG frames, not arbitrary source codecs. PNG/JPG/AVIF inputs are usable only when the installed decoder succeeds; not every codec/format is promised. External video audio is discarded.

NONE requires enough video frames for the authored window; LOOP wraps a deterministic frame index; HOLD_LAST explicitly freezes the last available frame. Images use their sole frame. No silent looping/freezing occurs. ALPHA/NORMAL use native image alpha, SCREEN uses CSS screen, ADD uses plus-lighter and MULTIPLY uses multiply. CHROMA is rejected at the render boundary. Source crop is a normalized clipping transform, not a new image generator.

Only approved production selections create runtime derivatives. Other candidates have authorized review derivatives only. Cache fingerprints include source hash, conversion settings/tool version, complete layer (mode/opacity/transform/timing/crop/loop/approval), review record and visual-compositor/1.0.0. Final fingerprint also includes plan and derivative bindings. No absolute root, mtime or machine name participates. Every cached frame is hash-checked; corruption triggers regeneration. Sources are revalidated before/after preparation. There is no concurrent cache lock or cross-GPU pixel identity guarantee.

## Pilot and verification

The cold pilot reuses measured Phase 10 beat durations and the exact approved AAC audio. GRAPHIC_ARROW_001 points left at the thermometer during event_thermometer_focus, frame 305 inclusive to 359 exclusive, with four-frame fades and opacity .9. Caption-safe normalized placement: x=.70/y=.39/w=.18/h=.0542. One visual layer is used; all other candidates remain unapproved. B-roll stays PLAN_ONLY and is explicitly excluded, with no provider or transition/musical subsystem.

Render checks compare separately resolved baseline/visual Remotion compositions at before/during/after frames. Remotion's composition.props are resolved by selectComposition, so changing inputProps alone is not a valid control. The comparison reports exact differences plus a tolerance of 2/255 per RGB channel for GPU/compositing rounding; it requires meaningful change during the layer and none outside its window. Caption checks use the same declared tolerance. Gross brightness <1/255 is flagged as potentially black, not automatically called a broken dark scene.

Visual output renders silent Engine3D + captions/layers, then copies the already approved Phase 10 AAC stream unchanged. Its approval/source hash and baseline master hashes are revalidated first. baseline-voice.mp4, sound-design.mp4 and visual-sound-design.mp4 are preserved for comparison. Packet MD5 verifies unchanged sound; ffprobe checks H.264/AAC, canvas/fps/frames and A/V tolerance.

```powershell
$env:CLONAI_MEDIA_ROOT = '<external-pack-root>'
npm run visual:inspect
npm run visual:approve -- --asset GRAPHIC_ARROW_001 --approval-id <id> --context event_thermometer_focus --role DIRECTION --mode ALPHA --source-hash <sha256> --preview-hash <sha256> --motion-reviewed false --reviewer-type HUMAN --reviewer-id <reviewer> --reason '<explicit decision>' --evidence '<review reference>'
npm run check:visual
npm run check:visual:pack
npm run check:visual:render
```

Without HUMAN_APPROVED visual selection the real master command writes explicit SKIPPED rather than inventing an approval. Fast tests never depend on the external pack. Controlled integration generates transparent/opaque PNGs and short H.264 test video, checks alpha, normalized-frame cache and corruption recovery, then performs real before/during/after compositor renders.
