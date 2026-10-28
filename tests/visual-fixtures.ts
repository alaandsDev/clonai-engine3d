import { deflateSync } from "node:zlib";
import type { VisualMediaAsset, VisualApproval, VisualSelection, VisualCompositionPlan } from "../src/visual/contracts";
import { COMPOSITOR_VERSION } from "../src/visual/contracts";
import { MediaAssetRegistry } from "../src/sound/registry";
import { resolveVisual } from "../src/visual/resolver";
import { input } from "./sound-fixtures";
export function pngFixture(alpha = true) {
    const crc = (buf: Buffer) => { let c = 0xffffffff; for (const b of buf) {
        c ^= b;
        for (let i = 0; i < 8; i++)
            c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
    } return (c ^ 0xffffffff) >>> 0; };
    const chunk = (tag: string, data: Buffer) => { const t = Buffer.from(tag), size = Buffer.alloc(4), hash = Buffer.alloc(4); size.writeUInt32BE(data.length); hash.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([size, t, data, hash]); };
    const header = Buffer.alloc(13);
    header.writeUInt32BE(32, 0);
    header.writeUInt32BE(16, 4);
    header[8] = 8;
    header[9] = 6;
    const raw = Buffer.alloc(16 * (1 + 32 * 4));
    for (let y = 0; y < 16; y++)
        for (let x = 0; x < 32; x++) {
            const i = y * 129 + 1 + x * 4;
            raw[i] = 255;
            raw[i + 1] = 30;
            raw[i + 2] = 40;
            raw[i + 3] = alpha && x < 8 ? 0 : 255;
        }
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
export function visualAsset(): VisualMediaAsset { return { id: "GRAPHIC_ARROW_999", version: 1, type: "GRAPHIC_ELEMENT", subtype: "ARROW", roleTags: ["DIRECTION"], relativePath: "controlled.png", sourceCatalog: "controlled-test", sourceAuditId: "AUDIT_controlled", contentHash: "a".repeat(64), technicalMetadata: { kind: "IMAGE", format: "PNG", codec: "png", width: 32, height: 16, fps: 0, duration: 0, frameCount: 1, sizeBytes: pngFixture().length, alphaClass: "TRUE_ALPHA", alphaEvidence: { method: "controlled PNG full-pixel fixture", min: 0, max: 255 }, decodeVerified: true }, semanticMetadata: { description: "Controlled red test graphic, not an external approved asset", evidence: "generated deterministic PNG fixture" }, compositionMode: "ALPHA", lifecycleStatus: "TESTED", licenseStatus: "DECLARED", provenance: "generated test-only fixture" }; }
export function visualApproval(asset = visualAsset()): VisualApproval { return { id: "test_visual_review", assetId: asset.id, context: "visual_test", role: asset.roleTags[0], sourceHash: asset.contentHash, compositionMode: asset.compositionMode, status: "APPROVED", reviewer: { type: "HUMAN", id: "SYNTHETIC_TEST_ONLY" }, reason: "Controlled fixture, never an actual review of production pack", evidence: "unit test only", reviewDerivativeHash: "b".repeat(64), reviewedMotion: asset.technicalMetadata.kind === "VIDEO" }; }
export function selection(asset = visualAsset()): VisualSelection { return { eventId: "visual_test", assetId: asset.id, approvalId: "test_visual_review", compositionMode: asset.compositionMode, transform: { scale: 1, rotation: 0 }, zOrder: "GRAPHIC", order: 0, loopPolicy: "NONE", fadeInFrames: 0, fadeOutFrames: 0, allowUnsafePlacement: false, allowCaptionOverlap: false }; }
export function visualInput() { const x = input(); x.eventMap.events.push({ id: "visual_test", beatId: "hook", type: "VISUAL_LAYER", role: "DIRECTION", anchor: { type: "NORMALIZED", value: 0 }, durationHint: 1, intensity: .8, placement: { x: .6, y: .4, width: .15, height: .08 }, purpose: "Controlled visual layer timing proof" }); return x; }
export function visualPlan(): VisualCompositionPlan { const a = visualAsset(); return resolveVisual(visualInput(), new MediaAssetRegistry<VisualMediaAsset>({ version: 1, assets: [a] }), [visualApproval(a)], [selection(a)], "STRICT_RENDER"); }
