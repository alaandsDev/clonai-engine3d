import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import ts from "typescript";
import { bundle } from "@remotion/bundler";
import {
  selectComposition,
  renderStill,
  renderMedia,
} from "@remotion/renderer";
import { compileDirectorPlan } from "../../src/engine3d/director";
import {
  narration,
  FakeNarrationProvider,
  EdgeTtsNarrationProvider,
  ffprobePath,
  defaultConfig,
} from "../../src/engine3d/audio/narration";
import { resolveSafeOutputPath } from "../../src/engine3d/paths";
import { planFixture } from "../fixtures/hardening";
import type { DirectorPlan } from "../../src/engine3d/contracts";
const root = path.resolve("out/engine3d/phase6b");
const output = (id: string, suffix: string) =>
  resolveSafeOutputPath(root, id, suffix);
const plan = planFixture();
const shot = plan.scenes[0].shots[0];
plan.scenes[0].narration = "Lia observa o termômetro.";
shot.characters[0].position = [-0.45, 0, 0];
shot.props = [
  {
    instanceId: "therm",
    resourceId: "PROP_THERMOMETER_001",
    position: [0.6, 0.8, 0.15],
    initialState: { value: -63 },
  },
];
shot.actions = [
  {
    resourceId: "ACTION_POINT_001",
    actor: "actor",
    target: "therm",
    start: 0,
    end: 1,
  },
  {
    resourceId: "ACTION_LOOK_001",
    actor: "actor",
    targetPosition: [0.6, 1.5, 1.8],
    start: 0,
    end: 1,
  },
];
shot.vfx = [
  {
    resourceId: "VFX_SNOW_001",
    start: 0,
    end: 1,
    parameters: { intensity: 0.4 },
  },
];
shot.camera = { resourceId: "CAM_ORBIT_001", parameters: { strength: 0.1 } };
const sequence = compileDirectorPlan(plan),
  inputProps = { sequence },
  chromiumOptions = { gl: "angle" as const };
let serveUrl: string,
  composition: Awaited<ReturnType<typeof selectComposition>>;
const results: any[] = [];
before(async () => {
  await mkdir(root, { recursive: true });
  serveUrl = await bundle({
    entryPoint: path.resolve("src/index.tsx"),
    publicDir: path.resolve("public"),
  });
  composition = await selectComposition({
    serveUrl,
    id: "DirectorSequence",
    inputProps,
    chromiumOptions,
  });
});
test("A: independent JSON renderStill E2E", async () => {
  await writeFile(
    output("render-plan", ".json"),
    JSON.stringify(plan, null, 2),
  );
  const file = output("lia-thermometer", ".png");
  await renderStill({
    serveUrl,
    composition,
    inputProps,
    frame: 30,
    output: file,
    chromiumOptions,
  });
  const data = await readFile(file);
  assert(data.length > 10000);
  assert.equal(data.subarray(1, 4).toString(), "PNG");
  results.push({
    test: "A",
    status: "PASS",
    file: path.relative(process.cwd(), file).replaceAll("\\", "/"),
  });
});
test("B: same-frame render determinism on this installation", async () => {
  const hashes: string[] = [];
  for (const n of [1, 2]) {
    const file = output(`determinism-${n}`, ".png");
    await renderStill({
      serveUrl,
      composition,
      inputProps,
      frame: 30,
      output: file,
      chromiumOptions,
    });
    hashes.push(
      createHash("sha256")
        .update(await readFile(file))
        .digest("hex"),
    );
  }
  const evidence = {
    frame: 30,
    width: 480,
    height: 854,
    fps: 30,
    hashes,
    equal: hashes[0] === hashes[1],
  };
  await writeFile(
    output("determinism", ".json"),
    JSON.stringify(evidence, null, 2),
  );
  assert(evidence.equal);
  results.push({ test: "B", status: "PASS", hashes });
});
let media: any;
test("C: narration-driven MP4 integration (fake offline; real provider opt-in)", async () => {
  const real = process.env.ENGINE3D_REAL_TTS === "1";
  const provider = real
    ? new EdgeTtsNarrationProvider()
    : new FakeNarrationProvider();
  const track = await narration(
    "scene",
    plan.scenes[0].narration,
    30,
    provider,
    defaultConfig,
  );
  const narrated = compileDirectorPlan({ ...plan, timingMode: "narration" }, [
    track,
  ]);
  // Rebundle after synthesis so a newly written public audio file is included.
  const narratedUrl = await bundle({
    entryPoint: path.resolve("src/index.tsx"),
    publicDir: path.resolve("public"),
  });
  const props = { sequence: narrated };
  const comp = await selectComposition({
    serveUrl: narratedUrl,
    id: "DirectorSequence",
    inputProps: props,
    chromiumOptions,
  });
  const file = output("narration-integration", ".mp4");
  await renderMedia({
    serveUrl: narratedUrl,
    composition: comp,
    inputProps: props,
    codec: "h264",
    audioCodec: "aac",
    outputLocation: file,
    chromiumOptions,
    concurrency: 2,
  });
  media = JSON.parse(
    execFileSync(
      ffprobePath(),
      ["-v", "error", "-show_streams", "-show_format", "-of", "json", file],
      { encoding: "utf8" },
    ),
  );
  media.format.filename = path
    .relative(process.cwd(), file)
    .replaceAll("\\", "/");
  await writeFile(
    output("integration-audio-manifest", ".json"),
    JSON.stringify([track], null, 2),
  );
  await writeFile(
    output("media-metadata", ".json"),
    JSON.stringify(media, null, 2),
  );
  assert.equal(track.provider, real ? "edge-tts" : "fake");
  assert.equal(
    Number(media.streams.find((s: any) => s.codec_type === "video").nb_frames),
    narrated.totalFrames,
  );
  results.push({
    test: "C",
    status: "PASS",
    provider: track.provider,
    frames: narrated.totalFrames,
  });
});
test("D: ffprobe validates media dimensions, codecs, fps and A/V duration", () => {
  assert(media, "preceding render must succeed");
  const v = media.streams.find((s: any) => s.codec_type === "video"),
    a = media.streams.find((s: any) => s.codec_type === "audio");
  assert.equal(v.codec_name, "h264");
  assert.equal(a.codec_name, "aac");
  assert.equal(v.width, 480);
  assert.equal(v.height, 854);
  assert.equal(v.r_frame_rate, "30/1");
  assert(Math.abs(Number(v.duration) - Number(a.duration)) < 1 / 30 + 0.025);
  assert(Number(media.format.duration) > 0);
  results.push({
    test: "D",
    status: "PASS",
    videoCodec: v.codec_name,
    audioCodec: a.codec_name,
    avDifference: Number(a.duration) - Number(v.duration),
  });
});
after(async () => {
  await writeFile(
    output("render-test-results", ".json"),
    JSON.stringify(
      { tests: results, total: 4, passed: results.length },
      null,
      2,
    ),
  );
});
