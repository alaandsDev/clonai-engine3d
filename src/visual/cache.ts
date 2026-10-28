import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveSafeOutputPath } from "../engine3d/paths";
import { MediaAssetRegistry, verifyMedia, contentHash } from "../sound/registry";
import { jsonHash } from "../editorial/fingerprint";
import { ffmpegExecutable } from "../sound/tools";
import { validateVisualApprovals } from "./resolver";
import { visualPlanShape, invalid } from "./schema";
import { COMPOSITOR_VERSION, type VisualCompositionPlan, type VisualMediaAsset, type VisualApproval, type VisualBinding } from "./contracts";
const run = promisify(execFile);
export function phase11Root() { let root = process.cwd(); for (const part of ["out", "engine3d", "phase11"])
    root = resolveSafeOutputPath(root, part); return root; }
export function visualOutput(...parts: string[]) { let root = phase11Root(); for (const p of parts)
    root = resolveSafeOutputPath(root, p); return root; }
export async function prepareVisual(plan: VisualCompositionPlan, registry: MediaAssetRegistry<VisualMediaAsset>, approvals: VisualApproval[], root: string | undefined) {
    visualPlanShape(plan);
    validateVisualApprovals(approvals, registry);
    if (plan.unresolved.length)
        invalid("cannot prepare unresolved visual plan");
    const ffmpeg = ffmpegExecutable(), version = (await run(ffmpeg, ["-version"])).stdout.split(/\r?\n/)[0];
    const bindings: VisualBinding[] = [], manifests: any[] = [];
    for (const layer of plan.layers) {
        const asset = registry.get(layer.assetId), review = approvals.find(a => a.id === layer.approvalRef);
        if (!review || review.status !== "APPROVED" || review.context !== layer.eventId || review.role !== layer.role || review.assetId !== asset.id || review.compositionMode !== layer.compositionMode || asset.compositionMode !== layer.compositionMode || asset.lifecycleStatus === "REJECTED" || !["TESTED", "APPROVED"].includes(asset.lifecycleStatus) || layer.sourceHash !== asset.contentHash)
            invalid("prepare approval/asset mismatch");
        if (layer.kind !== asset.technicalMetadata.kind || layer.assetType !== asset.type || layer.sourceDuration !== asset.technicalMetadata.duration)
            invalid("layer/source technical mismatch");
        const { file } = await verifyMedia(root, asset);
        const settings = { format: "PNG_RGBA", width: asset.technicalMetadata.kind === "VIDEO" ? 480 : 768, fps: plan.fps, kind: asset.technicalMetadata.kind };
        const key = jsonHash({ sourceHash: asset.contentHash, settings, layer, approval: review, compositorVersion: COMPOSITOR_VERSION, toolVersion: version });
        const dir = visualOutput("cache", key);
        await mkdir(dir, { recursive: true });
        const manifestPath = resolveSafeOutputPath(dir, "manifest.json");
        let info: any, hit = false;
        try {
            info = JSON.parse(await readFile(manifestPath, "utf8"));
            if (info.fingerprint === key && Array.isArray(info.frames) && info.frames.length) {
                hit = true;
                for (const f of info.frames) {
                    const target = resolveSafeOutputPath(dir, f.filename);
                    if (contentHash(await readFile(target)) !== f.sha256) {
                        hit = false;
                        break;
                    }
                }
            }
        }
        catch (e) {
            if ((e as any).code !== "ENOENT" && !(e instanceof SyntaxError))
                throw e;
        }
        if (!hit) {
            for (const f of await readdir(dir))
                if (/^frame-\d{6}\.png$/.test(f))
                    resolveSafeOutputPath(dir, f);
            const pattern = path.join(dir, "frame-%06d.png"), filter = asset.technicalMetadata.kind === "VIDEO" ? `fps=${plan.fps},scale=480:-2,format=rgba` : `scale='min(768,iw)':-1,format=rgba`;
            await run(ffmpeg, ["-hide_banner", "-v", "error", "-y", "-i", file, "-an", "-vf", filter, ...(asset.technicalMetadata.kind === "IMAGE" ? ["-frames:v", "1"] : []), "-start_number", "0", pattern], { timeout: 120000, maxBuffer: 2 * 1024 * 1024 });
            const names = (await readdir(dir)).filter(n => /^frame-\d{6}\.png$/.test(n)).sort();
            if (!names.length || names.length > 7200 || asset.technicalMetadata.kind === "IMAGE" && names.length !== 1)
                invalid("derivative frame count");
            const frames = [];
            for (let i = 0; i < names.length; i++) {
                if (names[i] !== `frame-${String(i).padStart(6, "0")}.png`)
                    invalid("derivative sequence gap");
                const f = resolveSafeOutputPath(dir, names[i]), bytes = await readFile(f);
                if (bytes.subarray(1, 4).toString() !== "PNG")
                    invalid("invalid PNG derivative");
                frames.push({ filename: names[i], sha256: contentHash(bytes), bytes: bytes.length });
            }
            info = { fingerprint: key, sourceHash: asset.contentHash, assetId: asset.id, settings, compositionMode: layer.compositionMode, approval: review, compositorVersion: COMPOSITOR_VERSION, toolVersion: version, frames };
            await writeFile(manifestPath, JSON.stringify(info, null, 2));
        }
        await verifyMedia(root, asset);
        bindings.push({ eventId: layer.eventId, assetId: asset.id, kind: asset.technicalMetadata.kind, frames: info.frames.map((f: any) => `cache/${key}/${f.filename}`), derivativeFingerprint: key, sourceHash: asset.contentHash });
        manifests.push({ eventId: layer.eventId, assetId: asset.id, fingerprint: key, cacheHit: hit, sourceHash: asset.contentHash, derivativeHashes: info.frames.map((f: any) => f.sha256), settings, toolVersion: version });
    }
    return { bindings, manifests };
}
