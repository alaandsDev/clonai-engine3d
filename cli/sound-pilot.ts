import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";
import { MediaAssetRegistry, validateApprovals } from "../src/sound/registry";
import { resolveSoundDesign } from "../src/sound/resolver";
import { soundOutput, phase10Root, mixAudio, decodeAudio, encodeWav, audioQa } from "../src/sound/mixer";
import { ffmpegExecutable } from "../src/sound/tools";
import { compileEditorial, createRenderProjection, type EditorialInputs } from "../src/editorial";
import { compileDirectorPlan } from "../src/engine3d/director";
import { narration, ffprobePath } from "../src/engine3d/audio/narration";
import type { NarrationTrack } from "../src/engine3d/contracts";
import type { SfxApproval, CueSelection } from "../src/sound/contracts";
await mkdir(phase10Root(), { recursive: true });
const json = async (n: string, x: unknown) => writeFile(soundOutput(n), JSON.stringify(x, null, 2));
const registry = new MediaAssetRegistry(JSON.parse(await readFile("examples/sound/media-registry.json", "utf8")));
const approvals = JSON.parse(await readFile(soundOutput("sfx-approvals.json"), "utf8")) as SfxApproval[];
validateApprovals(approvals, registry);
const input = JSON.parse(await readFile("examples/editorial/cold-pilot.json", "utf8")) as EditorialInputs;
const approved = approvals.filter(a => a.status === "APPROVED" && a.context === "hook_sfx" && a.role === "IMPACT").sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
if (!approved.length) {
    const plan = resolveSoundDesign(input, registry, approvals, [], "PLAN_ONLY");
    await json("sound-design-plan.json", plan);
    await json("resolved-sfx.json", { cues: [], unresolved: plan.unresolved });
    await json("render-results.json", { status: "SKIPPED", reason: "HUMAN_APPROVED missing for hook_sfx / IMPACT; no real SFX master produced", omittedVisualRequest: "place_broll remains excluded; no B-roll implementation" });
    await json("audio-qa.json", { status: "NOT_RUN", reason: "No approved real SFX master. Controlled mixer integration is separate." });
    await json("mix-fingerprint.json", { status: "NOT_CREATED", reason: "No real voice/mix before human approval" });
    await json("cache-manifest.json", { status: "NOT_CREATED", reason: "No approved master" });
    console.log("SKIP: HUMAN_APPROVED missing; review package ready.");
}
else {
    const ffmpeg = ffmpegExecutable(), run = promisify(execFile), tracks: NarrationTrack[] = [];
    // Existing provider/config/cache exactly as before. Only the duration hints are retimed to measured audio.
    for (const b of input.plan.beats) {
        const t = await narration(`scene_${b.id}`, b.narration, 30);
        tracks.push(t);
        b.durationSeconds = t.durationFrames / 30;
    }
    const compiled = compileEditorial(input, "PLAN_ONLY"), projection = createRenderProjection(compiled, { omitEventIds: compiled.unresolvedEventIds, reason: "SFX executed separately by sound plan; B-roll explicitly excluded from Phase10." });
    const sequence = compileDirectorPlan(projection.directorPlan, tracks), selection: CueSelection = { eventId: "hook_sfx", assetId: approved[0].assetId, approvalId: approved[0].id, context: "hook_sfx" };
    const plan = resolveSoundDesign(input, registry, approvals, [selection], "STRICT_RENDER");
    if (!plan.cues.length)
        throw new Error("at least one HUMAN-approved real cue required");
    await json("sound-design-plan.json", plan);
    await json("resolved-sfx.json", plan.cues);
    await json("editorial-retimed.json", input);
    await json("visual-projection.json", projection);
    await json("narration-tracks.json", tracks);
    const voice = new Float32Array(sequence.totalFrames / 30 * 48000 * 2);
    let offset = 0;
    for (const t of tracks) {
        const pcm = await decodeAudio(ffmpeg, path.resolve("public", t.relativeAudioPath)), size = t.durationFrames / 30 * 48000 * 2;
        if (pcm.length > size + 3200)
            throw new Error("narration decoded longer than planned scene");
        voice.set(pcm.subarray(0, size), offset);
        offset += size;
    }
    const voiceFile = soundOutput("narration.wav");
    await encodeWav(ffmpeg, voice, voiceFile);
    const options = { ffmpeg, voiceFile, plan, registry, approvals, mediaRoot: process.env.CLONAI_MEDIA_ROOT }, mixed = await mixAudio(options), repeat = await mixAudio(options);
    await json("mix-fingerprint.json", { fingerprint: mixed.fingerprint, voiceHash: mixed.voiceHash });
    await json("cache-manifest.json", { firstHit: mixed.cacheHit, repeatHit: repeat.cacheHit, sameFingerprint: mixed.fingerprint === repeat.fingerprint, output: path.relative(process.cwd(), mixed.output).replaceAll("\\", "/") });
    const props = { sequence }, chromiumOptions = { gl: "angle" as const }, serveUrl = await bundle({ entryPoint: path.resolve("src/index.tsx"), publicDir: path.resolve("public") });
    const composition = await selectComposition({ serveUrl, id: "DirectorSequence", inputProps: props, chromiumOptions });
    const voiceOnly = soundOutput("voice-only.mp4"), master = soundOutput("sound-design.mp4");
    await renderMedia({ serveUrl, composition, inputProps: props, chromiumOptions, codec: "h264", audioCodec: "aac", outputLocation: voiceOnly, concurrency: 2 });
    await run(ffmpeg, ["-hide_banner", "-v", "error", "-y", "-i", voiceOnly, "-i", mixed.output, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-t", String(sequence.totalFrames / 30), master], { timeout: 120000 });
    const meta = JSON.parse((await run(ffprobePath(), ["-v", "error", "-show_streams", "-show_format", "-of", "json", master])).stdout), v = meta.streams.find((s: any) => s.codec_type === "video"), a = meta.streams.find((s: any) => s.codec_type === "audio");
    const av = Math.abs(Number(v.duration) - Number(a.duration));
    if (v.codec_name !== "h264" || a.codec_name !== "aac" || v.width !== 480 || v.height !== 854 || v.r_frame_rate !== "30/1" || Number(v.nb_frames) !== sequence.totalFrames || Number(a.sample_rate) !== 48000 || a.channels !== 2 || av > 1 / 30 + 1024 / 48000)
        throw new Error("master A/V QA failed");
    const masterQa = await audioQa(ffmpeg, master), voiceQa = await audioQa(ffmpeg, voiceFile);
    await json("audio-qa.json", { voice: voiceQa, sfx: mixed.sfxQa, mixed: mixed.qa, master: masterQa, avDifference: av, timingConfidence: "ESTIMATED" });
    await json("render-results.json", { status: "PASS", provider: "edge-tts", voiceOnly: "out/engine3d/phase10/voice-only.mp4", master: "out/engine3d/phase10/sound-design.mp4", video: v, audio: a, avDifference: av, frames: sequence.totalFrames, approvedCues: plan.cues.length, excludedVisualEvents: ["place_broll"] });
    console.log(`PASS: real voice + ${plan.cues.length} approved SFX; ${sequence.totalFrames} frames`);
}
