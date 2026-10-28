import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia, renderStill } from "@remotion/renderer";
import { MediaAssetRegistry, contentHash, validateApprovals, verifyMedia } from "../src/sound/registry";
import { ffmpegExecutable } from "../src/sound/tools";
import { ffprobePath } from "../src/engine3d/audio/narration";
import { compileDirectorPlan } from "../src/engine3d/director";
import { compileEditorial, createRenderProjection, type EditorialInputs } from "../src/editorial";
import { phase11Root, visualOutput, prepareVisual } from "../src/visual/cache";
import { resolveVisual, visualFingerprint } from "../src/visual/resolver";
import type { VisualMediaAsset, VisualApproval, VisualSelection } from "../src/visual/contracts";
await mkdir(phase11Root(), { recursive: true });
const json = async (n: string, x: unknown) => writeFile(visualOutput(n), JSON.stringify(x, null, 2));
const registry = new MediaAssetRegistry<VisualMediaAsset>(JSON.parse(await readFile("examples/visual/media-registry.json", "utf8"))), approvals = JSON.parse(await readFile(visualOutput("visual-approvals.json"), "utf8")) as VisualApproval[];
const input = JSON.parse(await readFile("out/engine3d/phase10/editorial-retimed.json", "utf8")) as EditorialInputs;
input.eventMap.events.push({ id: "event_thermometer_focus", beatId: "number", type: "VISUAL_LAYER", role: "DIRECTION", anchor: { type: "WORD", value: "sessenta" }, durationHint: 1.8, intensity: .9, placement: { x: .70, y: .39, width: .18, height: .0542 }, purpose: "Apontar para o termômetro ao apresentar a temperatura extrema, sem cobrir legenda." });
const review = approvals.find(a => a.assetId === "GRAPHIC_ARROW_001" && a.context === "event_thermometer_focus" && a.role === "DIRECTION" && a.status === "APPROVED");
const selections: VisualSelection[] = review ? [{ eventId: "event_thermometer_focus", assetId: review.assetId, approvalId: review.id, compositionMode: "ALPHA", transform: { scale: 1, rotation: 0 }, zOrder: "GRAPHIC", order: 0, loopPolicy: "NONE", fadeInFrames: 4, fadeOutFrames: 4, allowUnsafePlacement: false, allowCaptionOverlap: false }] : [];
const plan = resolveVisual(input, registry, approvals, selections, review ? "STRICT_RENDER" : "PLAN_ONLY");
await json("visual-composition-plan.json", plan);
await json("resolved-visual-layers.json", plan.layers);
await json("pilot-editorial.json", input);
if (!review) {
    await json("render-results.json", { status: "SKIPPED", reason: "HUMAN_APPROVED visual missing; no visual master invented" });
    await json("visual-cache-manifest.json", { status: "NOT_CREATED" });
    await json("visual-qa.json", { status: "NOT_RUN", reason: "visual approval pending" });
    console.log("SKIP: HUMAN_APPROVED visual missing");
}
else {
    const audioRegistry = new MediaAssetRegistry(JSON.parse(await readFile("examples/sound/media-registry.json", "utf8"))), audioApprovals = JSON.parse(await readFile("out/engine3d/phase10/sfx-approvals.json", "utf8"));
    validateApprovals(audioApprovals, audioRegistry);
    if (!audioApprovals.some((a: any) => a.assetId === "SFX_IMPACT_001" && a.role === "IMPACT" && a.context === "hook_sfx" && a.status === "APPROVED"))
        throw new Error("Phase10 SFX approval revoked or missing");
    await verifyMedia(process.env.CLONAI_MEDIA_ROOT, audioRegistry.get("SFX_IMPACT_001"));
    const oldHashes = JSON.parse(await readFile("out/engine3d/phase10/master-files.json", "utf8"));
    for (const n of ["voice-only.mp4", "sound-design.mp4"])
        if (contentHash(await readFile(path.resolve("out/engine3d/phase10", n))) !== oldHashes[n].sha256)
            throw new Error("Phase10 baseline master hash changed");
    const prepared = await prepareVisual(plan, registry, approvals, process.env.CLONAI_MEDIA_ROOT), again = await prepareVisual(plan, registry, approvals, process.env.CLONAI_MEDIA_ROOT);
    await json("visual-cache-manifest.json", { ...prepared, repeatHits: again.manifests.map(m => m.cacheHit), fingerprint: visualFingerprint(plan, approvals, prepared.bindings) });
    const compiled = compileEditorial(input, "PLAN_ONLY"), projection = createRenderProjection(compiled, { omitEventIds: compiled.unresolvedEventIds, reason: "Visual layer executed by compositor; SFX reused exactly from approved Phase10 master; B-roll remains PLAN_ONLY and is excluded." });
    const sequence = compileDirectorPlan(projection.directorPlan), props = { sequence, visualPlan: plan, bindings: prepared.bindings }, baseProps = { ...props, visualPlan: { ...plan, layers: [] }, bindings: [] }, chromiumOptions = { gl: "angle" as const }, serveUrl = await bundle({ entryPoint: path.resolve("src/index.tsx"), publicDir: phase11Root() });
    const composition = await selectComposition({ serveUrl, id: "EditorialVisualSequence", inputProps: props, chromiumOptions }), ffmpeg = ffmpegExecutable(), run = promisify(execFile);
    const baseComposition = await selectComposition({ serveUrl, id: "EditorialVisualSequence", inputProps: baseProps, chromiumOptions });
    const l = plan.layers[0], points = [{ name: "before", frame: l.startFrame - 1 }, { name: "during", frame: Math.floor((l.startFrame + l.endFrame) / 2) }, { name: "after", frame: l.endFrame }], frameQa = [];
    for (const point of points) {
        const frames: Buffer[] = [];
        for (const [name, inputProps] of [["baseline", baseProps], ["visual", props]] as const) {
            const file = visualOutput(`qa-${point.name}-${name}.png`);
            await renderStill({ serveUrl, composition: name === "baseline" ? baseComposition : composition, inputProps, frame: point.frame, output: file, chromiumOptions });
            frames.push((await run(ffmpeg, ["-v", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { encoding: "buffer", maxBuffer: 4 * 1024 * 1024 })).stdout);
        }
        let changed = 0, rawChanged = 0, captionChanged = 0, maxCaptionDelta = 0, sum = 0;
        for (let i = 0; i < frames[0].length; i += 4) {
            let delta = 0;
            for (let c = 0; c < 3; c++) {
                sum += frames[1][i + c];
                delta = Math.max(delta, Math.abs(frames[0][i + c] - frames[1][i + c]));
            }
            if (delta)
                rawChanged++;
            const caption = Math.floor(i / 4 / sequence.width) >= plan.captionZone.y * sequence.height;
            if (caption)
                maxCaptionDelta = Math.max(maxCaptionDelta, delta);
            if (delta > 2) {
                changed++;
                if (caption)
                    captionChanged++;
            }
        }
        if (point.name === "during" ? changed < 50 : changed !== 0)
            throw new Error(`layer timing pixel guard failed ${point.name}: ${changed}`);
        if (captionChanged)
            throw new Error("caption region changed by graphic layer");
        const mean = sum / (frames[0].length / 4 * 3);
        frameQa.push({ ...point, changedPixels: changed, rawChangedPixels: rawChanged, captionChangedPixels: captionChanged, maxCaptionChannelDelta: maxCaptionDelta, pixelTolerance: 2, meanBrightness: mean, potentialBlackFrame: mean < 1 });
    }
    const silent = visualOutput("visual-silent.mp4");
    await renderMedia({ serveUrl, composition, inputProps: props, chromiumOptions, codec: "h264", outputLocation: silent, concurrency: 2 });
    for (const [from, to] of [["voice-only.mp4", "baseline-voice.mp4"], ["sound-design.mp4", "sound-design.mp4"]]) {
        await readFile(visualOutput(to)).catch((e: any) => { if (e.code !== "ENOENT")
            throw e; });
        await copyFile(path.resolve("out/engine3d/phase10", from), visualOutput(to));
    }
    const master = visualOutput("visual-sound-design.mp4");
    await run(ffmpeg, ["-hide_banner", "-v", "error", "-y", "-i", silent, "-i", visualOutput("sound-design.mp4"), "-map", "0:v:0", "-map", "1:a:0", "-c", "copy", master], { timeout: 120000 });
    const meta = JSON.parse((await run(ffprobePath(), ["-v", "error", "-show_streams", "-show_format", "-of", "json", master])).stdout), v = meta.streams.find((s: any) => s.codec_type === "video"), a = meta.streams.find((s: any) => s.codec_type === "audio");
    const md5 = async (file: string) => (await run(ffmpeg, ["-v", "error", "-i", file, "-map", "0:a:0", "-c", "copy", "-f", "md5", "-"])).stdout.trim();
    const audioIdentical = await md5(master) === await md5(visualOutput("sound-design.mp4"));
    const av = Math.abs(Number(v.duration) - Number(a.duration));
    if (!audioIdentical || v.codec_name !== "h264" || a.codec_name !== "aac" || v.width !== 480 || v.height !== 854 || v.r_frame_rate !== "30/1" || Number(v.nb_frames) !== sequence.totalFrames || av > 1 / 30 + 1024 / 48000)
        throw new Error("master format/audio/AV guard failed");
    await json("visual-qa.json", { passed: true, frames: frameQa, blackGuard: "Potential gross empty/black output only; not aesthetic scoring", captionRegionProtected: true, audioPacketsIdenticalToPhase10: audioIdentical, originalSourceHashVerified: true, derivativeIntegrityVerified: true, avDifference: av });
    await json("render-results.json", { status: "PASS", master: "out/engine3d/phase11/visual-sound-design.mp4", frames: sequence.totalFrames, video: v, audio: a, avDifference: av, approvedVisualLayers: plan.layers.length, maxSimultaneous: 1, sfxPreserved: "SFX_IMPACT_001 / hook_sfx; copied approved Phase10 AAC packets", broll: "PLAN_ONLY; explicitly excluded", masterHash: contentHash(await readFile(master)) });
    console.log(`PASS: ${plan.layers.length} approved visual + preserved Phase10 sound; ${sequence.totalFrames} frames`);
}
