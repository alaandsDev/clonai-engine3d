import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fail } from "../engine3d/contracts";
import { ffprobePath } from "../engine3d/audio/narration";
import { resolveSafeOutputPath } from "../engine3d/paths";
import { MediaAssetRegistry, validateApprovals, verifyMedia, contentHash, soundFail } from "./registry";
import { soundPlanShape, mixFingerprint, MIXER_VERSION } from "./resolver";
import type { SoundDesignPlan, SfxApproval, Ducking } from "./contracts";
const run = promisify(execFile);
export function phase10Root() { let root = process.cwd(); for (const part of ["out", "engine3d", "phase10"])
    root = resolveSafeOutputPath(root, part); return root; }
export function soundOutput(...parts: string[]) { let root = phase10Root(); for (const part of parts)
    root = resolveSafeOutputPath(root, part); return root; }
export function decodeArgs(file: string) { return ["-hide_banner", "-v", "error", "-xerror", "-err_detect", "explode", "-i", file, "-map", "0:a:0", "-ac", "2", "-ar", "48000", "-f", "f32le", "-acodec", "pcm_f32le", "-"]; }
export async function decodeAudio(ffmpeg: string, file: string): Promise<Float32Array> {
    const r = await run(ffmpeg, decodeArgs(file), { timeout: 90000, maxBuffer: 128 * 1024 * 1024, encoding: "buffer" });
    if (r.stderr.length || !r.stdout.length || r.stdout.length % 8)
        soundFail("invalid audio decode");
    const samples = new Float32Array(r.stdout.length / 4);
    for (let i = 0; i < samples.length; i++) {
        samples[i] = r.stdout.readFloatLE(i * 4);
        if (!Number.isFinite(samples[i]))
            soundFail("nonfinite PCM");
    }
    return samples;
}
export function pcmMetrics(samples: Float32Array) { if (!samples.length)
    soundFail("empty audio"); let sum = 0, peak = 0; for (const x of samples) {
    if (!Number.isFinite(x))
        soundFail("nonfinite audio");
    sum += x * x;
    peak = Math.max(peak, Math.abs(x));
} return { peak, rms: Math.sqrt(sum / samples.length), samples: samples.length, duration: samples.length / 96000 }; }
export function requireAudible(samples: Float32Array, label: string) { const m = pcmMetrics(samples); if (m.rms <= 1e-8)
    soundFail(`${label}: empty/silent audio`); return m; }
export function mixPcm(voice: Float32Array, plan: SoundDesignPlan, sources: Map<string, Float32Array>) {
    soundPlanShape(plan);
    const expected = Math.round(plan.durationSeconds * 48000) * 2;
    if (voice.length !== expected)
        soundFail("voice duration does not match plan");
    requireAudible(voice, "voice");
    const sum = new Float64Array(voice.length);
    for (let i = 0; i < voice.length; i++)
        sum[i] = voice[i];
    const bed = new Float64Array(voice.length);
    for (const c of plan.cues) {
        const source = sources.get(c.assetId);
        if (!source)
            soundFail("missing decoded SFX");
        requireAudible(source!, "SFX");
        const from = Math.round(c.sourceIn * 48000), to = Math.round(c.sourceOut * 48000), start = Math.round(c.resolvedStart * 48000), length = to - from;
        if (from < 0 || length < 1 || to * 2 > source!.length || start + length > voice.length / 2)
            soundFail("sample window outside source/timeline");
        requireAudible(source!.subarray(from * 2, to * 2), "selected SFX window");
        let env = 0;
        const gain = 10 ** (c.gainDb / 20), d = c.ducking;
        const activity = new Float32Array(Math.ceil(voice.length / 1920));
        for (let block = 0; block < activity.length; block++) {
            const a = block * 1920, b = Math.min(a + 1920, voice.length);
            let energy = 0;
            for (let i = a; i < b; i++)
                energy += voice[i] * voice[i];
            activity[block] = Math.sqrt(energy / (b - a)) >= 10 ** (d.thresholdDb / 20) ? 1 : 0;
        }
        // Fixed 20ms RMS voice activity, attack/release smoothing, never modifies the voice stem.
        for (let f = 0; f < voice.length / 2; f++) {
            const target = d.enabled ? activity[Math.floor(f / 960)] : 0;
            const seconds = target > env ? d.attack : d.release;
            env += (target - env) * (1 - Math.exp(-1 / (48000 * seconds)));
            if (f < start || f >= start + length)
                continue;
            const k = f - start;
            const fade = Math.min(1, c.fadeIn ? k / (c.fadeIn * 48000) : 1, c.fadeOut ? (length - 1 - k) / (c.fadeOut * 48000) : 1);
            const g = gain * fade * 10 ** (-d.amountDb * env / 20);
            for (let ch = 0; ch < 2; ch++) {
                const value = source![(from + k) * 2 + ch] * g;
                sum[f * 2 + ch] += value;
                bed[f * 2 + ch] += value;
            }
        }
    }
    const mixed = Float32Array.from(sum), sfx = Float32Array.from(bed), qa = requireAudible(mixed, "mix");
    if (qa.peak > 0.98)
        fail("AUDIO_CLIPPING", "mix sample peak exceeds 0.98; reduce cue gains, no limiter applied");
    return { mixed, sfx, voiceMetrics: pcmMetrics(voice), sfxMetrics: pcmMetrics(sfx), mixMetrics: qa };
}
export async function encodeWav(ffmpeg: string, samples: Float32Array, output: string) {
    const relative = path.relative(phase10Root(), path.resolve(output));
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
        soundFail("output outside phase10");
    output = soundOutput(...relative.split(path.sep));
    const raw = resolveSafeOutputPath(path.dirname(output), path.basename(output), ".f32");
    const bytes = Buffer.alloc(samples.length * 4);
    samples.forEach((v, i) => bytes.writeFloatLE(v, i * 4));
    await writeFile(raw, bytes);
    await run(ffmpeg, ["-hide_banner", "-v", "error", "-y", "-f", "f32le", "-ar", "48000", "-ac", "2", "-i", raw, "-c:a", "pcm_f32le", output], { timeout: 90000 });
    // Derivative PCM is retained for reproducible QA; originals are never written.
}
export async function audioQa(ffmpeg: string, file: string) {
    const p = JSON.parse((await run(ffprobePath(), ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], { timeout: 30000 })).stdout);
    const a = p.streams.find((a: any) => a.codec_type === "audio"), pcm = await decodeAudio(ffmpeg, file), m = requireAudible(pcm, "output");
    if (!a || Number(a.sample_rate) !== 48000 || a.channels !== 2 || !Number.isFinite(Number(p.format.duration)) || m.peak > 0.98)
        soundFail("audio QA format/duration/peak");
    const loud = await run(ffmpeg, ["-hide_banner", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"], { timeout: 90000, maxBuffer: 2 * 1024 * 1024 });
    const integrated = [...loud.stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1)?.[1], tp = [...loud.stderr.matchAll(/Peak:\s+(-?[\d.]+) dBFS/g)].at(-1)?.[1];
    if (tp && Number.isFinite(Number(tp)) && Number(tp) > 0)
        fail("AUDIO_CLIPPING", "true peak exceeds 0 dBFS");
    return { ...m, codec: a.codec_name, sampleRate: 48000, channels: 2, containerDuration: Number(p.format.duration), integratedLufs: integrated && Number.isFinite(Number(integrated)) ? Number(integrated) : null, truePeakDb: tp && Number.isFinite(Number(tp)) ? Number(tp) : null, passed: true };
}
export async function mixAudio(options: {
    ffmpeg: string;
    voiceFile: string;
    plan: SoundDesignPlan;
    registry: MediaAssetRegistry;
    approvals: SfxApproval[];
    mediaRoot: string | undefined;
}) {
    const { ffmpeg, voiceFile, plan, registry, approvals, mediaRoot } = options;
    soundPlanShape(plan);
    validateApprovals(approvals, registry);
    if (plan.mode !== "STRICT_RENDER")
        soundFail("PLAN_ONLY cannot mix");
    const sources = new Map<string, Float32Array>();
    for (const c of plan.cues) {
        const a = registry.get(c.assetId);
        if (a.lifecycleStatus === "REJECTED" || !["TESTED", "APPROVED"].includes(a.lifecycleStatus) || a.contentHash !== c.sourceHash || !a.roleTags.includes(c.role) || c.sourceOut > a.technicalMetadata.duration)
            soundFail("cue asset mismatch");
        const approval = approvals.find(a => a.id === c.approvalRef);
        if (!approval || approval.status !== "APPROVED" || approval.assetId !== c.assetId || approval.role !== c.role || approval.context !== c.context || approval.sourceHash !== c.sourceHash)
            soundFail("cue approval mismatch");
        const { file } = await verifyMedia(mediaRoot, a);
        if (!sources.has(a.id))
            sources.set(a.id, await decodeAudio(ffmpeg, file));
    }
    const voiceHash = contentHash(await readFile(voiceFile)), fingerprint = mixFingerprint(plan, voiceHash, registry.catalog.assets);
    const cache = soundOutput("cache");
    await mkdir(cache, { recursive: true });
    const output = resolveSafeOutputPath(cache, fingerprint, ".wav"), manifest = resolveSafeOutputPath(cache, fingerprint, ".json");
    const sfxFile = resolveSafeOutputPath(cache, fingerprint, "-sfx.wav");
    try {
        const prior = JSON.parse(await readFile(manifest, "utf8"));
        if (prior.fingerprint === fingerprint && prior.sfxQa && prior.outputHash === contentHash(await readFile(output)) && prior.sfxHash === contentHash(await readFile(sfxFile))) {
            const qa = await audioQa(ffmpeg, output);
            if (Math.abs(qa.duration - plan.durationSeconds) > 1 / 48000)
                soundFail("cache duration mismatch");
            return { output, fingerprint, cacheHit: true, qa, sfxQa: prior.sfxQa, voiceHash };
        }
    }
    catch (e) {
        if ((e as any).code !== "ENOENT" && !(e instanceof SyntaxError))
            throw e;
    }
    const voice = await decodeAudio(ffmpeg, voiceFile), expected = Math.round(plan.durationSeconds * 48000) * 2;
    // At most one video frame of explicit tail padding for the ceil-to-frame render grid.
    if (Math.abs(voice.length - expected) > Math.ceil(48000 / plan.fps) * 2)
        soundFail("voice/timeline duration mismatch");
    const padded = new Float32Array(expected);
    padded.set(voice.subarray(0, expected));
    const mix = mixPcm(padded, plan, sources);
    await encodeWav(ffmpeg, mix.mixed, output);
    const qa = await audioQa(ffmpeg, output);
    await encodeWav(ffmpeg, mix.sfx, sfxFile);
    const sfxQa = plan.cues.length ? await audioQa(ffmpeg, sfxFile) : { ...mix.sfxMetrics, intentionalSilence: true, integratedLufs: null, truePeakDb: null };
    if (Math.abs(qa.duration - plan.durationSeconds) > 1 / 48000)
        soundFail("mixed duration mismatch");
    const data = { mixerVersion: MIXER_VERSION, fingerprint, voiceHash, outputHash: contentHash(await readFile(output)), sfxHash: contentHash(await readFile(sfxFile)), plan, voice: mix.voiceMetrics, sfx: mix.sfxMetrics, mix: mix.mixMetrics, qa, sfxQa };
    await writeFile(manifest, JSON.stringify(data, null, 2));
    return { output, fingerprint, cacheHit: false, qa, sfxQa, voiceHash };
}
