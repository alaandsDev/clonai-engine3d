import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, symlink } from "node:fs/promises";
import path from "node:path";
import raw from "../examples/sound/media-registry.json";
import { MediaAssetRegistry, mediaAssetShape, approvalShape, validateApprovals, resolveMediaPath, verifyMedia, contentHash } from "../src/sound/registry";
import { resolveSoundDesign, soundPlanShape, duckingShape, defaultDucking, mixFingerprint } from "../src/sound/resolver";
import { pcmMetrics, mixPcm, decodeArgs, soundOutput } from "../src/sound/mixer";
import { canonicalJson } from "../src/editorial";
import { asset, approval, input, resolved, pcmPlan, sine } from "./sound-fixtures";
test("sound schema accepts only AUDIO/SFX production entries and eight stable IDs", () => { const r = new MediaAssetRegistry(raw); assert.equal(r.catalog.assets.length, 8); assert.deepEqual(r.catalog.assets.map(a => a.id), ["SFX_WHOOSH_001", "SFX_WHOOSH_002", "SFX_IMPACT_001", "SFX_IMPACT_002", "SFX_RISER_001", "SFX_RISER_002", "SFX_UI_001", "SFX_UI_002"]); });
for (const field of ["id", "type", "subtype", "contentHash", "lifecycleStatus", "licenseStatus"])
    test(`sound rejects invalid asset ${field}`, () => { const a: any = asset(); a[field] = "INVALID"; assert.throws(() => mediaAssetShape(a)); });
test("sound stable ID survives a relative path change; registry does not promote status", () => { const a = asset(); a.relativePath = "moved/new.wav"; const r = new MediaAssetRegistry({ version: 1, assets: [a] }); assert.equal(r.get(a.id).id, "SFX_IMPACT_999"); assert.equal(r.get(a.id).lifecycleStatus, "TESTED"); r.get(a.id).lifecycleStatus = "APPROVED"; assert.equal(r.get(a.id).lifecycleStatus, "TESTED"); });
test("sound duplicate IDs, unknown metadata and bad technical values fail", () => { const a = asset(); assert.throws(() => new MediaAssetRegistry({ version: 1, assets: [a, a] })); for (const change of [(x: any) => x.technicalMetadata.duration = 0, (x: any) => x.technicalMetadata.sampleRate = NaN, (x: any) => x.extra = 1]) {
    const b = asset();
    change(b);
    assert.throws(() => mediaAssetShape(b));
} });
test("sound rejects traversal, absolute, UNC, drive, null and mixed-separator paths", () => { for (const s of ["../a.wav", "/a.wav", "C:/a.wav", "\\\\host\\share", "SFX\\a.wav", "SFX/a\0.wav", "SFX/../../a.wav"]) {
    const a = asset();
    a.relativePath = s;
    assert.throws(() => mediaAssetShape(a));
} });
test("sound external root, existence, canonical containment and hash verification", async () => { const dir = soundOutput("tests"); await mkdir(dir, { recursive: true }); const base = await mkdtemp(path.join(dir, "paths-")), root = path.join(base, "media"), outside = path.join(base, "outside"); await mkdir(root); await mkdir(outside); await writeFile(path.join(outside, "x.wav"), "x"); await symlink(outside, path.join(root, "escape"), "junction"); await assert.rejects(resolveMediaPath(undefined, "x.wav"), /MEDIA_ROOT_MISSING/); await assert.rejects(resolveMediaPath(root, "missing.wav"), /MEDIA_ASSET_MISSING/); await assert.rejects(resolveMediaPath(root, "escape/x.wav"), /MEDIA_PATH_ESCAPE/); await writeFile(path.join(root, "sfx.wav"), "controlled"); const a = asset(); await assert.rejects(verifyMedia(root, a), /MEDIA_HASH_MISMATCH/); a.contentHash = contentHash(Buffer.from("controlled")); a.technicalMetadata.sizeBytes = 10; assert.equal((await verifyMedia(root, a)).hash, a.contentHash); });
test("sound approval requires explicit HUMAN identity, reason, source hash and context", () => { for (const change of [(a: any) => delete a.reviewer.type, (a: any) => a.reviewer.type = "TECHNICAL_CHECK", (a: any) => a.reviewer.id = "", (a: any) => a.context = "", (a: any) => a.sourceHash = "x", (a: any) => a.reason = ""]) {
    const a = approval();
    change(a);
    assert.throws(() => approvalShape(a));
} });
test("sound approval mismatch and duplicate approvals blocked", () => { const { registry, review } = resolved(); assert.throws(() => validateApprovals([review, review], registry)); const wrong = { ...review, sourceHash: "b".repeat(64) }; assert.throws(() => validateApprovals([wrong], registry)); });
test("sound resolver is deterministic and independent of registry array order", () => { const { registry, review, plan } = resolved(); const again = resolveSoundDesign(input(), registry, [review], [{ eventId: "hook_sfx", assetId: review.assetId, approvalId: review.id, context: "hook_sfx" }], "STRICT_RENDER"); assert.equal(canonicalJson(plan), canonicalJson(again)); assert.equal(plan.cues[0].timingConfidence, "ESTIMATED"); });
test("sound optional unresolved STRICT is explicit OMITTED_OPTIONAL", () => { const { registry } = resolved(); const p = resolveSoundDesign(input(), registry, [], [], "STRICT_RENDER"); assert.equal(p.cues.length, 0); assert.equal(p.unresolved[0].status, "OMITTED_OPTIONAL"); });
test("sound required unresolved STRICT fails while PLAN_ONLY remains inspectable", () => { const x = input(), e = x.eventMap.events.find(e => e.type === "SFX_CUE")!; if (e.type === "SFX_CUE")
    e.optional = false; const { registry } = resolved(); assert.throws(() => resolveSoundDesign(x, registry, [], [], "STRICT_RENDER"), /SFX_REQUIRED_UNRESOLVED/); assert.equal(resolveSoundDesign(x, registry, [], [], "PLAN_ONLY").unresolved[0].status, "PLAN_ONLY"); });
test("sound approval role/context cannot be reused for another event", () => { const { registry, review } = resolved(); for (const change of [(a: any) => a.role = "UI", (a: any) => a.context = "NUMBER_REVEAL"]) {
    const a = structuredClone(review);
    change(a);
    assert.throws(() => resolveSoundDesign(input(), registry, [a], [{ eventId: "hook_sfx", assetId: review.assetId, approvalId: a.id, context: "hook_sfx" }], "STRICT_RENDER"));
} });
test("sound rejected lifecycle/context blocked", () => { const a = asset(); a.lifecycleStatus = "REJECTED"; const registry = new MediaAssetRegistry({ version: 1, assets: [a] }), r = approval(a); assert.throws(() => resolveSoundDesign(input(), registry, [r], [{ eventId: "hook_sfx", assetId: a.id, approvalId: r.id, context: "hook_sfx" }], "STRICT_RENDER")); });
for (const [field, value] of [["sourceIn", -1], ["sourceIn", 1], ["sourceOut", 0], ["sourceOut", 0.5], ["gainDb", 1], ["gainDb", -31], ["gainDb", NaN], ["fadeIn", -1], ["fadeOut", 1]] as const)
    test(`sound validates ${field}=${value}`, () => { const { registry, review } = resolved(); assert.throws(() => resolveSoundDesign(input(), registry, [review], [{ eventId: "hook_sfx", assetId: review.assetId, approvalId: review.id, context: "hook_sfx", [field]: value }], "STRICT_RENDER")); });
test("sound explicit source window and fades are retained", () => { const { registry, review } = resolved(); const p = resolveSoundDesign(input(), registry, [review], [{ eventId: "hook_sfx", assetId: review.assetId, approvalId: review.id, context: "hook_sfx", sourceIn: 0.01, sourceOut: 0.2, fadeIn: 0.01, fadeOut: 0.02, gainDb: -20 }], "STRICT_RENDER"); assert.equal(p.cues[0].windowPolicy, "EXPLICIT"); assert.equal(p.cues[0].sourceIn, 0.01); assert.equal(p.cues[0].gainDb, -20); });
test("sound invalid ducking rejected", () => { for (const [key, value] of [["enabled", 1], ["amountDb", -1], ["amountDb", 25], ["attack", 0], ["release", NaN], ["thresholdDb", 0]]) {
    const d: any = { ...defaultDucking, [key]: value };
    assert.throws(() => duckingShape(d));
} });
test("sound timing/windows cannot escape timeline or contradict frame anchor", () => { for (const change of [(p: any) => p.cues[0].resolvedStart = -1, (p: any) => p.cues[0].resolvedStart = 2, (p: any) => p.cues[0].anchorFrame = 4, (p: any) => p.cues.push(p.cues[0])]) {
    const p = pcmPlan();
    change(p);
    assert.throws(() => soundPlanShape(p));
} });
test("sound fingerprint invalidates gain/fades/ducking/timing/source/voice changes", () => { const p = pcmPlan(), h = "b".repeat(64), assets = [{ id: p.cues[0].assetId, contentHash: p.cues[0].sourceHash }], base = mixFingerprint(p, h, assets); assert.equal(base, mixFingerprint(structuredClone(p), h, assets)); for (const change of [(p: any) => p.cues[0].gainDb = -25, (p: any) => p.cues[0].fadeIn = 0.01, (p: any) => p.cues[0].ducking.amountDb = 10, (p: any) => { p.cues[0].anchorFrame = 6; p.cues[0].anchorSeconds = .2; p.cues[0].resolvedStart = .2; }, (p: any) => p.cues[0].sourceHash = "c".repeat(64)]) {
    const x = structuredClone(p);
    change(x);
    assert.notEqual(base, mixFingerprint(x, h, assets));
} assert.notEqual(base, mixFingerprint(p, "d".repeat(64), assets)); });
test("sound FFmpeg commands are argument arrays, paths are never shell expressions", () => { const filename = "folder/a $name.wav"; const args = decodeArgs(filename); assert.equal(args[args.indexOf("-i") + 1], filename); assert(args.includes("48000")); assert(args.includes("f32le")); });
test("sound PCM mixer preserves voice, stays finite and applies deterministic ducking", () => { const voice = sine(1, .2, 240), fx = sine(.25, .6, 1800), p = pcmPlan(), sources = new Map([[p.cues[0].assetId, fx]]); const a = mixPcm(voice, p, sources), b = mixPcm(voice, p, sources); assert.deepEqual(a.mixed, b.mixed); assert.equal(a.mixed[100], voice[100]); assert(a.sfxMetrics.rms > 0); const dry = structuredClone(p); dry.cues[0].ducking.enabled = false; assert(mixPcm(voice, dry, sources).sfxMetrics.rms > a.sfxMetrics.rms); });
test("sound QA detects silence, nonfinite PCM, clipping and missing/short source", () => { const p = pcmPlan(), voice = sine(1, .2, 240), fx = sine(.25, .6, 1800), sources = new Map([[p.cues[0].assetId, fx]]); assert.throws(() => mixPcm(new Float32Array(96000), p, sources), /silent/); assert.throws(() => pcmMetrics(Float32Array.from([NaN]))); assert.throws(() => mixPcm(Float32Array.from({ length: 96000 }, () => .99), p, sources), /CLIPPING/); assert.throws(() => mixPcm(voice, p, new Map())); assert.throws(() => mixPcm(voice, p, new Map([[p.cues[0].assetId, sine(.1, .4, 1000)]]))); });
