import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { MediaAssetRegistry, verifyMedia, contentHash, validateApprovals, approvalShape } from "../src/sound/registry";
import { soundOutput, phase10Root, audioQa, decodeAudio, requireAudible } from "../src/sound/mixer";
import { ffmpegExecutable } from "../src/sound/tools";
import type { SfxApproval } from "../src/sound/contracts";
import { ffprobePath } from "../src/engine3d/audio/narration";
const args = process.argv.slice(2), command = args[0] ?? "review", run = promisify(execFile);
const flag = (key: string) => { const i = args.indexOf(key); return i >= 0 ? args[i + 1] : undefined; };
const required = (key: string) => { const v = flag(key); if (!v)
    throw new Error(`${key} required`); return v; };
const registry = new MediaAssetRegistry(JSON.parse(await readFile("examples/sound/media-registry.json", "utf8")));
if (registry.catalog.assets.length !== 8)
    throw new Error("Phase10 production registry must have exactly eight SFX");
await mkdir(phase10Root(), { recursive: true });
const save = async (n: string, v: unknown) => writeFile(soundOutput(n), JSON.stringify(v, null, 2));
let approvals: SfxApproval[] = [];
try {
    approvals = JSON.parse(await readFile(soundOutput("sfx-approvals.json"), "utf8"));
}
catch (e) {
    if ((e as any).code !== "ENOENT")
        throw e;
    await save("sfx-approvals.json", approvals);
}
validateApprovals(approvals, registry);
if (command === "approve" || command === "reject") {
    const record: any = { id: required("--approval-id"), assetId: required("--asset"), role: required("--role"), context: required("--context"), status: command === "approve" ? "APPROVED" : "REJECTED", reviewer: { type: required("--reviewer-type"), id: required("--reviewer-id") }, reason: required("--reason"), sourceHash: required("--source-hash"), evidence: required("--evidence") };
    // HUMAN is supplied explicitly by the reviewer; no default or inference from a successful test.
    approvalShape(record);
    const next = approvals.filter(a => !(a.assetId === record.assetId && a.role === record.role && a.context === record.context));
    next.push(record);
    validateApprovals(next, registry);
    await save("sfx-approvals.json", next);
    try {
        const review = JSON.parse(await readFile(soundOutput("sfx-review-manifest.json"), "utf8"));
        for (const row of review.review)
            row.approvalStatus = next.filter(a => a.assetId === row.assetId);
        await save("sfx-review-manifest.json", review);
    }
    catch (e) {
        if ((e as any).code !== "ENOENT")
            throw e;
    }
    console.log(`${record.status}: ${record.assetId} / ${record.role} / ${record.context}`);
}
else if (command === "review" || command === "pack") {
    const root = flag("--root") ?? process.env.CLONAI_MEDIA_ROOT, ffmpeg = ffmpegExecutable(), results: any[] = [], review: any[] = [];
    await save("media-registry.json", registry.catalog);
    await save("media-root-check.json", { configured: !!root, rootIsRuntimeOnly: true });
    const dir = soundOutput("sfx-review");
    await mkdir(dir, { recursive: true });
    for (const a of registry.catalog.assets) {
        const v = await verifyMedia(root, a), before = await stat(v.file), decoded = await decodeAudio(ffmpeg, v.file), metrics = requireAudible(decoded, a.id);
        const probe = JSON.parse((await run(ffprobePath(), ["-v", "error", "-show_streams", "-show_format", "-of", "json", v.file])).stdout), stream = probe.streams.find((s: any) => s.codec_type === "audio");
        if (!stream || stream.codec_name !== a.technicalMetadata.codec || Number(stream.sample_rate) !== a.technicalMetadata.sampleRate || stream.channels !== a.technicalMetadata.channels || Math.abs(Number(probe.format.duration) - a.technicalMetadata.duration) > 1e-5)
            throw new Error(`native metadata mismatch ${a.id}`);
        if (Math.abs(metrics.duration - a.technicalMetadata.duration) > 0.12)
            throw new Error(`metadata duration mismatch ${a.id}`);
        const afterHash = contentHash(await readFile(v.file));
        if (afterHash !== a.contentHash || (await stat(v.file)).mtimeMs !== before.mtimeMs)
            throw new Error("original changed");
        results.push({ assetId: a.id, hashVerified: true, decoded: true, nativeMetadataVerified: true, ...metrics, sourceUnchanged: true });
        if (command === "review") {
            const dest = soundOutput("sfx-review", a.id + ".wav"), sourceOut = Math.min(10, a.technicalMetadata.duration);
            await run(ffmpeg, ["-hide_banner", "-v", "error", "-y", "-i", v.file, "-t", String(sourceOut), "-af", "loudnorm=I=-20:TP=-3:LRA=7", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", dest], { timeout: 90000 });
            const qa = await audioQa(ffmpeg, dest);
            if (contentHash(await readFile(v.file)) !== a.contentHash)
                throw new Error("source changed during preview generation");
            review.push({ assetId: a.id, roleTags: a.roleTags, filename: path.posix.basename(a.relativePath), sourceDuration: a.technicalMetadata.duration, technicalStatus: a.lifecycleStatus, approvalStatus: approvals.filter(p => p.assetId === a.id), notes: "Review-only normalized derivative; first up to 10s, not approved. UI files are typing candidates.", sourceIn: 0, sourceOut, sourceHash: a.contentHash, derivative: `out/engine3d/phase10/sfx-review/${a.id}.wav`, derivativeHash: contentHash(await readFile(dest)), qa, proposedContext: a.roleTags.includes("IMPACT") ? { context: "hook_sfx", role: "IMPACT", description: "Pontuar ‘tão brutal’ no piloto do frio" } : null });
        }
    }
    await save("pack-validation.json", { passed: true, count: results.length, packRescanned: false, originalWrites: false, results });
    await save("media-root-check.json", { configured: true, validatedAssets: results.length, rootPersisted: false, containment: "lexical and realpath" });
    if (command === "review")
        await save("sfx-review-manifest.json", { version: 1, context: "hook_sfx", approvalPolicy: "Explicit HUMAN/context/sourceHash review only; silence is not approval", review });
    console.log(`${results.length}/8 valid; ${command}`);
}
else
    throw new Error("command must be review, pack, approve or reject");
