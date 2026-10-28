# Sound design v1 — Phase 10

`Editorial SFX_CUE → explicit selection + contextual approval → SoundDesignPlan → PCM mixer → FFmpeg WAV/AAC → QA`.

The media registry is separate from Engine3D. Production imports only the eight TESTED Phase 9 SFX from `examples/sound/media-registry.json`. IDs are assigned once, independent of filenames, hashes or current root. A future move updates relativePath, not identity. Asset/content revisions must be explicit; changing a hash invalidates prior approvals. There is no scan/import of the full pack, music, images, video, overlays or provider integration.

## Layers and approval

- MediaAssetRegistry validates version, closed fields, stable unique IDs, AUDIO/SFX, roles, technical/semantic metadata, lifecycle, provenance and relative paths. Copies returned by the registry cannot mutate its snapshot. It never promotes lifecycle.
- `CLONAI_MEDIA_ROOT` is runtime-only configuration. Resolution checks lexical and canonical containment, including junction/symlink targets, existence, size and SHA-256. It never constructs a shell from filenames. This is not OS isolation against a hostile concurrent filesystem writer.
- Review derivatives are normalized at -20 LUFS / -3 dBTP for listening only, 48k stereo, first up to 10 seconds. Every source/derivative hash and trim policy is recorded. Originals remain untouched.
- `sfx-approvals.json` starts empty. CLI approve/reject requires explicit reviewer type HUMAN, reviewer ID, context, role, reason, evidence and source hash. No test outcome or silence creates an approval. The exact event ID is the approval context. Approval of a role/event does not approve another role/event. A hash change, rejection or untested/rejected lifecycle blocks use.
- Manifests are trusted local human records, not authenticated identities or proof against deliberate manual forgery. Invalid HUMAN records, mismatched context/role/hash and missing review fields fail. Synthetic approvals in automated tests concern generated controlled waveforms only, never the production pack.
- Registry lifecycle stays TESTED while a separate context-specific human approval grants a use. License status is independent and remains DECLARED, based on the existing user declaration; no new rights certification is inferred.

`resolveSoundDesign` uses the existing Phase 9 compiled anchor/fingerprint; it never picks randomly. Selections bind event → approval → exact asset. Missing required SFX in STRICT_RENDER fails; missing optional SFX is explicitly OMITTED_OPTIONAL. PLAN_ONLY retains an unresolved record without mixing. A conflicting supplied selection fails even when optional. B-roll remains outside this module and is explicitly excluded by the pilot's visual projection.

## Timing, windows and sound policy

SoundDesignPlan v1 records anchorFrame/seconds/confidence, resolvedStart, source window, gain, fades, ducking, purpose and approvalRef. The pilot retimes beat duration hints to measured real TTS track frame counts and resolves word/phrase anchors again. **Word timing remains ESTIMATED**, not acoustic alignment. Source starts at the resolved anchor; no automatic transient detection or creative timing claim.

Default window is explicitly FULL_SOURCE, sourceIn=0/sourceOut=metadata duration. Overrides become EXPLICIT. No clamp, extension or arbitrary trim is hidden. Effective sample windows are rounded to 48k samples and checked against decoded length; encoder padding may make a full MP3 window invalid, requiring an explicit window. Finite window, within-source/timeline duration and non-silent selected content are required.

Gain range is [-30, 0] dB, no positive gain. Default -24 dB is a conservative attenuation from the source level, not a promise of -24 dBFS or a fixed loudness ratio to speech. Editorial intensity remains intention, not an automatic gain law. Defaults: 5ms fade-in, 20ms fade-out; fades may not overlap or exceed the window. Override explicitly for shorter cues.

Ducking attenuates only SFX, leaving voice samples unchanged: enabled=true, amountDb=6 (additional reduction), attack=30ms, release=150ms. Voice activity uses fixed 20ms stereo RMS blocks above -45 dBFS; a deterministic sample envelope smooths attack/release. No ML/automatic mastering. Perceptual intelligibility and balance still need human listening.

Mixer decodes sources via existing FFmpeg to 48k stereo float32, accumulates in float64, applies per-cue trim/gain/fades/ducking and writes float32 WAV derivatives. Sample peak >0.98 fails without limiter or hidden normalization; true peak >0 dBFS fails when measured by ebur128. Whole-file silence, zero-length/nonfinite PCM and silent selected windows fail. Intentional empty SFX bed when there are no cues is allowed. Voice tail padding to the video frame grid is explicit and bounded to one frame for the generic mixer. The pilot additionally pads each narration scene to its frame grid.

## Outputs, cache and commands

All sound derivatives and output manifests stay under `out/engine3d/phase10`, protected by the existing path safety helper including auxiliary PCM files. Existing edge-tts continues using its **unchanged normal public/audio cache**, provider/voice/rate/pitch; those are not sound derivatives. No original WAV/MP3 is copied into source/public. The master uses Remotion for the unchanged visuals/captions/voice-only video, then FFmpeg copies the video stream and muxes the separately mixed AAC. Both voice-only and SFX versions are preserved.

Mixer version: sound-mixer/1.0.0. Fingerprint includes voice bytes hash, relevant asset hashes/IDs, complete sound plan (timing/windows/gains/fades/ducking/approval refs), output format and numerical policy/version. It excludes absolute roots, mtime and machine name. Cache hit validates current source hashes/approval records, derivative byte hashes and decoded mix QA before reuse. Missing/tampered data cannot silently count as a valid hit. No concurrent cache lock or cross-FFmpeg/CPU bit equivalence is promised.

```powershell
$env:CLONAI_MEDIA_ROOT = '<external-pack-root>'
# Optional: CLONAI_FFMPEG specifies an existing executable; otherwise PATH or existing imageio_ffmpeg is discovered.
npm run sound:review
npm run sound:approve -- --approval-id <id> --asset <stable-id> --role IMPACT --context hook_sfx --reviewer-type HUMAN --reviewer-id <reviewer> --reason '<explicit decision>' --source-hash <sha256> --evidence '<review reference>'
npm run check:sound
npm run check:sound:pack
npm run check:sound:render
```

Review initializes an empty approval list only if absent; never overwrites existing decisions. Re-reviewing an exact asset/role/context replaces that current record explicitly. The pilot picks the lexicographically first approved exact hook_sfx/IMPACT record and records its ID; no creative inference. Without approval, render writes explicit SKIPPED / HUMAN_APPROVED missing and does not generate a SFX master. Fast tests never open the external pack; mixer integration uses generated sine WAVs. Pack and real-master checks are separate.
