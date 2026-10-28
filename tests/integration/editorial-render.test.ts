import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill } from "@remotion/renderer";
import raw from "../../examples/editorial/cold-pilot.json";
import { compileEditorial, createRenderProjection, inputsShape, type EditorialInputs } from "../../src/editorial";
import { compileDirectorPlan } from "../../src/engine3d/director";
test("Phase9: editorial visual projection → unchanged DirectorPlan → real renderStill", async () => {
    const out = path.resolve("out/engine3d/phase9");
    await mkdir(out, { recursive: true });
    const initial: unknown = structuredClone(raw);
    inputsShape(initial);
    let x: EditorialInputs = initial;
    // Prefer the generated full pilot with TESTED candidate, but keep standalone offline fixture possible.
    try {
        x = JSON.parse(await readFile(path.join(out, "pilot-input.json"), "utf8"));
    }
    catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT")
            throw e;
    }
    const r = compileEditorial(x, "PLAN_ONLY"), projection = createRenderProjection(r, { omitEventIds: ["hook_sfx", "place_broll"], reason: "Visual-only Phase 9 integration: no sound mixer or B-roll provider." });
    assert.equal(projection.omittedEvents.length, 2);
    const sequence = compileDirectorPlan(projection.directorPlan), inputProps = { sequence }, chromiumOptions = { gl: "angle" as const };
    const serveUrl = await bundle({ entryPoint: path.resolve("src/index.tsx"), publicDir: path.resolve("public") });
    const composition = await selectComposition({ serveUrl, id: "DirectorSequence", inputProps, chromiumOptions });
    const file = path.join(out, "editorial-number.png"), frame = 300;
    try {
        await renderStill({ serveUrl, composition, inputProps, chromiumOptions, frame, output: file });
        const png = await readFile(file);
        assert(png.length > 10000);
        assert.equal(png.subarray(1, 4).toString(), "PNG");
        assert.equal(png.readUInt32BE(16), 480);
        assert.equal(png.readUInt32BE(20), 854);
        await writeFile(path.join(out, "render-test-results.json"), JSON.stringify({ passed: true, tests: 1, file: "out/engine3d/phase9/editorial-number.png", frame, width: 480, height: 854, sha256: createHash("sha256").update(png).digest("hex"), fingerprint: projection.fingerprint, omittedEvents: projection.omittedEvents, reason: projection.reason, ttsInvoked: false, sfxMixed: false, brollGenerated: false }, null, 2));
    }
    catch (e) {
        await writeFile(path.join(out, "render-test-results.json"), JSON.stringify({ passed: false, tests: 1, error: String(e), omittedEvents: projection.omittedEvents }, null, 2));
        throw e;
    }
});
