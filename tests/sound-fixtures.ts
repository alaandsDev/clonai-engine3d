import registryJson from "../examples/sound/media-registry.json";
import pilot from "../examples/editorial/cold-pilot.json";
import { inputsShape, type EditorialInputs } from "../src/editorial";
import { MediaAssetRegistry } from "../src/sound/registry";
import { resolveSoundDesign, defaultDucking } from "../src/sound/resolver";
import type { MediaAsset, SfxApproval, SoundDesignPlan } from "../src/sound/contracts";
export const input = (): EditorialInputs => { const x: unknown = structuredClone(pilot); inputsShape(x); return x; };
export function asset(): MediaAsset { return { ...structuredClone(registryJson.assets[2]), id: "SFX_IMPACT_999", roleTags: ["IMPACT"], relativePath: "sfx.wav", contentHash: "a".repeat(64), technicalMetadata: { codec: "pcm_f32le", duration: 0.25, sampleRate: 48000, channels: 2, sizeBytes: 96044 } } as MediaAsset; }
// Synthetic review of a controlled generated waveform, never an approval of the production pack.
export const approval = (a = asset()): SfxApproval => ({ id: "controlled_test_review", assetId: a.id, role: "IMPACT", context: "hook_sfx", status: "APPROVED", reviewer: { type: "HUMAN", id: "SYNTHETIC_UNIT_FIXTURE_ONLY" }, reason: "Controlled test record, not an actual human review", sourceHash: a.contentHash, evidence: "synthetic unit fixture, never production approval" });
export function resolved() { const a = asset(), registry = new MediaAssetRegistry({ version: 1, assets: [a] }), review = approval(a); const plan = resolveSoundDesign(input(), registry, [review], [{ eventId: "hook_sfx", assetId: a.id, approvalId: review.id, context: "hook_sfx" }], "STRICT_RENDER"); return { registry, review, plan }; }
export function pcmPlan(): SoundDesignPlan { const p = resolved().plan; p.durationSeconds = 1; p.cues[0].anchor = { type: "NORMALIZED", value: 0.1 }; p.cues[0].anchorFrame = 3; p.cues[0].anchorSeconds = 0.1; p.cues[0].resolvedStart = 0.1; return p; }
export function sine(seconds: number, amplitude: number, hz: number) { return Float32Array.from({ length: Math.round(seconds * 48000) * 2 }, (_, i) => amplitude * Math.sin(2 * Math.PI * hz * Math.floor(i / 2) / 48000)); }
