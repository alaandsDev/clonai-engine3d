import { readFile, writeFile, mkdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { ffprobePath } from "../src/engine3d/audio/narration";
import { selectSfxCandidates } from "../src/editorial/sfx-selection";
import type { AssetApproval } from "../src/editorial/contracts";
const run = promisify(execFile), args = process.argv.slice(2);
const arg = (name: string) => { const i = args.indexOf(name); if (i < 0 || !args[i + 1])
    throw new Error(`${name} required`); return args[i + 1]; };
const root = await realpath(arg("--root")), ffmpeg = arg("--ffmpeg");
const out = path.resolve("out/engine3d/phase9");
await mkdir(out, { recursive: true });
const json = async (n: string, v: unknown) => writeFile(path.join(out, n), JSON.stringify(v, null, 2));
const candidates = selectSfxCandidates(JSON.parse(await readFile("out/pack-audit/recommended-assets.json", "utf8")), JSON.parse(await readFile("out/pack-audit/sfx-assets.json", "utf8")));
if (!candidates.length || candidates.length > 12)
    throw new Error("expected 1..12 selected SFX");
const tests: any[] = [], approvals: AssetApproval[] = [];
for (const c of candidates) {
    const rel = c.assetRef.relativePath;
    let test: any = { testId: `technical_${c.assetRef.auditId}`, assetRef: { ...c.assetRef }, passed: false };
    try {
        const file = await realpath(path.resolve(root, rel)), from = path.relative(root, file);
        if (from.startsWith("..") || path.isAbsolute(from))
            throw new Error("containment failed");
        const before = await stat(file);
        if (!before.isFile() || before.size <= 0 || before.size > 50 * 1024 * 1024)
            throw new Error("invalid size");
        const original = await readFile(file), hash = createHash("sha256").update(original).digest("hex");
        const probe = JSON.parse((await run(ffprobePath(), ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], { timeout: 30000, maxBuffer: 1024 * 1024 })).stdout);
        const audio = probe.streams.find((s: any) => s.codec_type === "audio");
        const duration = Number(probe.format.duration), rate = Number(audio?.sample_rate), channels = Number(audio?.channels);
        if (!audio?.codec_name || ![duration, rate, channels].every(n => Number.isFinite(n) && n > 0) || duration > 60 || !Number.isInteger(rate) || !Number.isInteger(channels))
            throw new Error("invalid probe values");
        const decoded = await run(ffmpeg, ["-hide_banner", "-v", "error", "-xerror", "-err_detect", "explode", "-i", file, "-map", "0:a:0", "-f", "f32le", "-acodec", "pcm_f32le", "-"], { timeout: 60000, maxBuffer: 64 * 1024 * 1024, encoding: "buffer" });
        const pcm = decoded.stdout;
        if (decoded.stderr.length || !pcm.length || pcm.length % (4 * channels))
            throw new Error("decode error/truncation");
        let peak = 0, sum = 0;
        for (let i = 0; i < pcm.length; i += 4) {
            const v = pcm.readFloatLE(i);
            if (!Number.isFinite(v))
                throw new Error("nonfinite sample");
            peak = Math.max(peak, Math.abs(v));
            sum += v * v;
        }
        const decodedDuration = pcm.length / (4 * channels * rate);
        if (Math.abs(decodedDuration - duration) > 0.12)
            throw new Error("duration mismatch");
        const after = await stat(file), afterHash = createHash("sha256").update(await readFile(file)).digest("hex");
        if (afterHash !== hash || before.size !== after.size || before.mtimeMs !== after.mtimeMs)
            throw new Error("source changed");
        test = { ...test, passed: true, exists: true, codec: audio.codec_name, sampleRate: rate, channels, duration, decodedDuration, decodedSamples: pcm.length / 4, finiteSamples: true, decodeExitCode: 0, decodeDiagnosticBytes: decoded.stderr.length, peak, rms: Math.sqrt(sum / (pcm.length / 4)), sha256: hash, sizeBytes: before.size, unchangedAfterTest: true, creativeApproval: false };
        c.assetRef.status = "TESTED";
        c.technicalEvidence = { testId: test.testId, sha256: hash, passed: true };
        approvals.push({ assetRef: { ...c.assetRef }, status: "TESTED", context: "phase9-technical-pilot", reviewer: { type: "TECHNICAL_CHECK", id: "ffprobe-full-decode-v1" }, reason: "Probe, finite PCM, duration and integrity checks passed. Listening and context approval remain pending.", evidence: "out/engine3d/phase9/sfx-technical-tests.json" });
    }
    catch {
        test.failure = "Technical check failed; no TESTED/APPROVED promotion. Check runtime diagnostics and source manually.";
    }
    tests.push(test);
}
await json("sfx-candidates.json", { catalogSource: ["out/pack-audit/recommended-assets.json", "out/pack-audit/sfx-assets.json"], selectionLimit: 12, candidates });
await json("sfx-technical-tests.json", { method: "Selected files only; read-only ffprobe and full f32le decode to memory, no output audio files", ffmpeg: path.basename(ffmpeg), tests, passed: tests.filter(t => t.passed).length, total: tests.length, packRescanned: false, packWrites: false });
await json("asset-approvals.json", approvals);
console.log(`${tests.filter(t => t.passed).length}/${tests.length} technically TESTED; 0 human APPROVED`);
if (tests.some(t => !t.passed))
    process.exitCode = 1;
