import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { MediaAssetRegistry, verifyMedia, contentHash } from "../src/sound/registry";
import { ffmpegExecutable } from "../src/sound/tools";
import { phase11Root, visualOutput } from "../src/visual/cache";
import { validateVisualApprovals } from "../src/visual/resolver";
import type { VisualMediaAsset, VisualApproval } from "../src/visual/contracts";
import path from "node:path";
const args = process.argv.slice(2), command = args[0] ?? "pack";
const flag = (name: string) => { const i = args.indexOf(name); if (i < 0 || !args[i + 1])
    throw new Error(`${name} required`); return args[i + 1]; };
const registry = new MediaAssetRegistry<VisualMediaAsset>(JSON.parse(await readFile("examples/visual/media-registry.json", "utf8")));
await mkdir(phase11Root(), { recursive: true });
const json = async (n: string, v: unknown) => writeFile(visualOutput(n), JSON.stringify(v, null, 2));
let approvals: VisualApproval[] = [];
try {
    approvals = JSON.parse(await readFile(visualOutput("visual-approvals.json"), "utf8"));
}
catch (e) {
    if ((e as any).code !== "ENOENT")
        throw e;
    await json("visual-approvals.json", []);
}
validateVisualApprovals(approvals, registry);
if (command === "approve" || command === "reject") {
    const review = JSON.parse(await readFile(visualOutput("visual-review-manifest.json"), "utf8")), id = flag("--asset"), row = review.review.find((r: any) => r.assetId === id);
    if (!row)
        throw new Error("preview unavailable");
    const relative=path.relative(phase11Root(),path.resolve(row.preview));if(!relative||relative.startsWith("..")||path.isAbsolute(relative))throw new Error("review preview outside phase11");
    const preview = await readFile(visualOutput(...relative.split(path.sep)));
    if (contentHash(preview) !== row.previewHash)
        throw new Error("review derivative changed");
    const motion=flag("--motion-reviewed");if(!["true","false"].includes(motion))throw new Error("explicit true/false motion review required");
    const record: any = { id: flag("--approval-id"), assetId: id, context: flag("--context"), role: flag("--role"), sourceHash: flag("--source-hash"), compositionMode: flag("--mode"), status: command === "approve" ? "APPROVED" : "REJECTED", reviewer: { type: flag("--reviewer-type"), id: flag("--reviewer-id") }, reason: flag("--reason"), evidence: flag("--evidence"), reviewDerivativeHash: flag("--preview-hash"), reviewedMotion: motion === "true" };
    if (record.reviewDerivativeHash !== row.previewHash || record.sourceHash !== row.sourceHash)
        throw new Error("approval must bind current source and review");
    if (registry.get(id).technicalMetadata.kind === "VIDEO" && (!row.movingPreviewAvailable || !row.preview.endsWith(".mp4") || !record.reviewedMotion))
        throw new Error("moving preview review required");
    const next = approvals.filter(a => !(a.assetId === record.assetId && a.context === record.context && a.role === record.role));
    next.push(record);
    validateVisualApprovals(next, registry);
    await json("visual-approvals.json", next);
    for (const r of review.review)
        r.approvalStatus = next.filter(a => a.assetId === r.assetId);
    await json("visual-review-manifest.json", review);
    console.log(`${record.status}: ${id} / ${record.context}`);
}
else if (command === "pack") {
    const run = promisify(execFile), ffmpeg = ffmpegExecutable(), tests = [];
    for (const asset of registry.catalog.assets) {
        const source = await verifyMedia(process.env.CLONAI_MEDIA_ROOT, asset);
        await run(ffmpeg, ["-hide_banner", "-v", "error", "-xerror", "-err_detect", "explode", "-i", source.file, "-an", "-map", "0:v:0", "-f", "null", "-"], { timeout: 120000 });
        await verifyMedia(process.env.CLONAI_MEDIA_ROOT, asset);
        tests.push({ assetId: asset.id, hashVerified: true, decodePassed: true, originalUnchanged: true });
    }
    await json("pack-validation.json", { passed: true, count: tests.length, packRescanned: false, originalWrites: false, tests });
    console.log(`${tests.length} selected visuals validated`);
}
else
    throw new Error("approve / reject / pack expected");
