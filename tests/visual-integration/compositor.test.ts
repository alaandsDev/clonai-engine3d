import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill } from "@remotion/renderer";
import { visualAsset, visualApproval, selection, visualInput, pngFixture } from "../visual-fixtures";
import { MediaAssetRegistry, contentHash } from "../../src/sound/registry";
import { ffmpegExecutable } from "../../src/sound/tools";
import { resolveVisual } from "../../src/visual/resolver";
import { visualOutput, phase11Root, prepareVisual } from "../../src/visual/cache";
import { compileEditorial } from "../../src/editorial";
import { compileDirectorPlan } from "../../src/engine3d/director";
import type { VisualMediaAsset } from "../../src/visual/contracts";
test("visual controlled PNG+video fixtures → derivative/cache → real compositor pixel window guards", async () => {
    const out = visualOutput("tests");
    await mkdir(out, { recursive: true });
    const root = await mkdtemp(path.join(out, "controlled-")), png = pngFixture(), file = path.join(root, "controlled.png");
    await writeFile(file, png);
    await writeFile(path.join(root, "opaque.png"), pngFixture(false));
    const a = visualAsset();
    a.contentHash = contentHash(png);
    a.technicalMetadata.sizeBytes = png.length;
    const r = new MediaAssetRegistry<VisualMediaAsset>({ version: 1, assets: [a] }), review = visualApproval(a), x = visualInput();
    const e = x.eventMap.events.find(e => e.type === "VISUAL_LAYER")!;
    e.anchor = { type: "NORMALIZED", value: .1 };
    if (e.type === "VISUAL_LAYER")
        e.durationHint = .5;
    const plan = resolveVisual(x, r, [review], [selection(a)], "STRICT_RENDER"), prepared = await prepareVisual(plan, r, [review], root), again = await prepareVisual(plan, r, [review], root);
    assert(again.manifests[0].cacheHit);
    assert.equal(contentHash(await readFile(file)), a.contentHash);
    // Tampered derived bytes cannot count as a cache hit.
    const derivative = path.join(phase11Root(), prepared.bindings[0].frames[0]);
    await writeFile(derivative, "corrupt fixture derivative");
    const recovered = await prepareVisual(plan, r, [review], root);
    assert.equal(recovered.manifests[0].cacheHit, false);
    const ffmpeg = ffmpegExecutable(), run = promisify(execFile), videoFile = path.join(root, "controlled.mp4");
    await run(ffmpeg, ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=64x64:rate=30:duration=0.4", "-an", "-c:v", "libx264", "-threads", "1", "-pix_fmt", "yuv420p", videoFile]);
    for (const [image, expectedMin] of [[derivative, 0], [path.join(root, "opaque.png"), 255]] as const) {
        const rgba = (await run(ffmpeg, ["-v", "error", "-i", image, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { encoding: "buffer", maxBuffer: 1024 * 1024 })).stdout;
        const alpha = [];
        for (let i = 3; i < rgba.length; i += 4)
            alpha.push(rgba[i]);
        assert.equal(Math.min(...alpha), expectedMin);
        assert.equal(Math.max(...alpha), 255);
    }
    const v: VisualMediaAsset = { ...a, id: "OVERLAY_999", type: "OVERLAY", subtype: "VIDEO", roleTags: ["DIRECTION"], relativePath: "controlled.mp4", contentHash: contentHash(await readFile(videoFile)), compositionMode: "NORMAL", technicalMetadata: { ...a.technicalMetadata, kind: "VIDEO", format: "MP4", codec: "h264", width: 64, height: 64, fps: 30, duration: .4, frameCount: 12, sizeBytes: (await readFile(videoFile)).length, alphaClass: "OPAQUE", alphaEvidence: { method: "generated opaque controlled video", min: 255, max: 255 } } };
    const vr = new MediaAssetRegistry<VisualMediaAsset>({ version: 1, assets: [v] }), va = visualApproval(v), vs = { ...selection(v), zOrder: "ATMOSPHERE" as const, loopPolicy: "LOOP" as const }, vp = resolveVisual(x, vr, [va], [vs], "STRICT_RENDER"), videoPrepared = await prepareVisual(vp, vr, [va], root);
    assert.equal(videoPrepared.bindings[0].frames.length, 12);
    const compiled = compileEditorial(x), sequence = compileDirectorPlan(compiled.directorPlan), props = { sequence, visualPlan: plan, bindings: recovered.bindings }, base = { sequence, visualPlan: { ...plan, layers: [] }, bindings: [] }, chromiumOptions = { gl: "angle" as const }, serveUrl = await bundle({ entryPoint: path.resolve("src/index.tsx"), publicDir: phase11Root() });
    const comps = [await selectComposition({ serveUrl, id: "EditorialVisualSequence", inputProps: base, chromiumOptions }), await selectComposition({ serveUrl, id: "EditorialVisualSequence", inputProps: props, chromiumOptions })];
    const layer = plan.layers[0], checks = [];
    for (const [name, frame] of [["before", layer.startFrame - 1], ["during", layer.startFrame + 5], ["after", layer.endFrame]] as const) {
        const pixels: Buffer[] = [];
        for (let i = 0; i < 2; i++) {
            const output = path.join(root, `${name}-${i}.png`), inputProps = i === 0 ? base : props;
            await renderStill({ serveUrl, composition: comps[i], inputProps, frame, output, chromiumOptions });
            pixels.push((await run(ffmpeg, ["-v", "error", "-i", output, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { encoding: "buffer", maxBuffer: 4 * 1024 * 1024 })).stdout);
        }
        let changed = 0;
        for (let i = 0; i < pixels[0].length; i++)
            if (pixels[0][i] !== pixels[1][i])
                changed++;
        if (name === "during")
            assert(changed > 50);
        else
            assert.equal(changed, 0);
        checks.push({ name, frame, changedChannels: changed });
    }
    await writeFile(visualOutput("controlled-visual-integration.json"), JSON.stringify({ passed: true, syntheticAssetsOnly: true, productionApprovalInvented: false, fixtures: ["transparent PNG", "opaque PNG", "short H264 video"], videoDerivativeFrames: 12, cacheHitVerified: true, corruptionRecoveryVerified: true, checks }, null, 2));
});
