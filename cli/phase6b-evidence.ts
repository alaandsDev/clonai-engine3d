/** Reproducible phase-specific QA evidence; no resources or production renderers. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { Euler, Vector3, Matrix4, Quaternion } from "three";
import { resolveSafeOutputPath } from "../src/engine3d/paths";
import { registry } from "../src/engine3d/registry";
import { Character, Environment, Prop, Vfx } from "../src/engine3d/library";
import { anchorAt, poseAt, cameraAt } from "../src/engine3d/motion";
import { effectiveDoorOpenProgress } from "../src/engine3d/door";
import { resolveShot } from "../src/engine3d/validation";
import { vfxAttachmentMatrix } from "../src/engine3d/attachments";
import { shotFixture } from "../tests/fixtures/hardening";
import type { Transform, Vec3, Anchor } from "../src/engine3d/contracts";
const root = path.resolve("out/engine3d/phase6b");
await mkdir(root, { recursive: true });
const json = (id: string, value: unknown) =>
  writeFile(
    resolveSafeOutputPath(root, id, ".json"),
    JSON.stringify(value, null, 2),
  );
const parse = (s: string) => {
  const tests = [...s.matchAll(/^(not )?ok (\d+) - (.+)$/gm)].map((m) => ({
    name: m[3].trim(),
    status: m[1] ? "FAIL" : "PASS",
  }));
  return {
    tests,
    total: tests.length,
    passed: tests.filter((t) => t.status === "PASS").length,
  };
};
const red = parse(
    await readFile(resolveSafeOutputPath(root, "red", ".tap"), "utf8"),
  ),
  green = parse(
    await readFile(resolveSafeOutputPath(root, "green", ".tap"), "utf8"),
  );
assert.equal(red.total, 4);
assert.equal(red.passed, 0);
assert.equal(green.passed, 4);
const fast = await readFile(
  resolveSafeOutputPath(root, "fast", ".log"),
  "utf8",
);
const fastCount = Number(fast.match(/tests (\d+)/)?.[1]);
await json("regression-results", {
  baselineFastTests: 124,
  fastTests: fastCount,
  red,
  green,
  fixture: "tests/fixtures/hardening.ts",
});
const attacks = [
  "../../escape",
  "..\\..\\escape",
  "C:\\temp\\escape",
  "\\\\server\\share",
  "/tmp/escape",
  "shot/../../../escape",
  ".",
  "..",
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "bad\\/../escape",
  "C:relative",
  "CON.txt",
  "COM1",
  "a?b",
  "",
  "   ",
];
const pathResults = attacks.map((input) => {
  try {
    const result = resolveSafeOutputPath(
      path.join(root, "sandbox"),
      input,
      "-start.png",
    );
    return {
      sample: JSON.stringify(input),
      blocked: false,
      result: path.relative(root, result).replaceAll("\\", "/"),
    };
  } catch (e: any) {
    return { sample: JSON.stringify(input), blocked: true, code: e.code };
  }
});
assert(pathResults.every((r) => r.blocked));
await json("path-security-results", {
  root: "out/engine3d/phase6b/sandbox",
  cases: pathResults,
  canonicalSymlinkTest: "tests/hardening-contracts.test.ts",
});
const matrix = (i: Transform) =>
  new Matrix4().compose(
    new Vector3(...(i.position ?? [0, 0, 0])),
    new Quaternion().setFromEuler(new Euler(...(i.rotation ?? [0, 0, 0]))),
    new Vector3(...(i.scale ?? [1, 1, 1])),
  );
const transforms: Transform[] = [
  { position: [2, -1, 3] },
  { scale: [1.7, 1.7, 1.7] },
  { rotation: [0.4, 0, 0] },
  { rotation: [0, 0.7, 0] },
  { rotation: [0, 0, 0.6] },
  { rotation: [0.3, 0.7, 0.4] },
  { position: [2, 1, -1], rotation: [0.3, 0.7, 0.4] },
  { position: [2, 1, -1], scale: [1.4, 1.4, 1.4] },
  { rotation: [0.3, 0.7, 0.4], scale: [1.2, 0.8, 1.6] },
  { position: [2, 1, -1], rotation: [0.3, 0.7, 0.4], scale: [1.2, 0.8, 1.6] },
];
const doorCases: any[] = [];
let maxError = 0;
for (const initial of [0, 0.25, 0.8, 1])
  for (const [index, transform] of transforms.entries())
    for (const t of [0, 0.5, 1]) {
      const shot = shotFixture();
      shot.characters[0] = { ...shot.characters[0], ...transform };
      shot.props[0] = {
        ...shot.props[0],
        initialState: { openProgress: initial },
        position: [1.1, 0.2, -0.3],
        rotation: [0.2, -0.3, 0.5],
        scale: [1.1, 0.9, 1.3],
      };
      const s = resolveShot(shot),
        open = effectiveDoorOpenProgress(s.props[0], s, t);
      const expected = new Vector3(0.83, 1.05, 0.1)
        .applyEuler(new Euler(0, -open * 1.5, 0))
        .add(new Vector3(-0.52, 0, 0))
        .applyMatrix4(matrix(s.props[0]));
      const pose = poseAt(s.characters[0], s, t);
      const error = new Vector3(
        ...anchorAt(
          s.characters[0],
          s,
          t,
          pose.leftHandReach ? "leftHand" : "rightHand",
        ),
      ).distanceTo(expected);
      assert(error < 1e-8);
      maxError = Math.max(maxError, error);
      doorCases.push({ initial, transform: index, t, open, error });
    }
const anchorCases: any[] = [];
for (const id of ["CHAR_CAIO_001", "CHAR_LIA_001"])
  for (const [index, transform] of transforms.entries()) {
    const s = shotFixture();
    s.actions = [];
    const actor = { instanceId: "actor", resourceId: id, ...transform };
    s.characters = [actor];
    for (const anchor of [
      "head",
      "face",
      "leftHand",
      "rightHand",
      "chest",
    ] as Anchor[]) {
      const side = anchor === "leftHand" ? -1 : 1;
      const local =
        anchor === "head"
          ? new Vector3(0, 2.05, 0)
          : anchor === "face"
            ? new Vector3(0, 2.07, 0.49)
            : anchor === "chest"
              ? new Vector3(0, 1.25, 0)
              : new Vector3(0, -0.57, 0)
                  .applyEuler(new Euler(0, 0, side * 0.3))
                  .add(new Vector3(side * 0.44, 1.48, 0));
      const error = new Vector3(...anchorAt(actor, s, 0.5, anchor)).distanceTo(
        local.applyMatrix4(matrix(actor)),
      );
      assert(error < 1e-9);
      anchorCases.push({ id, transform: index, anchor, error });
    }
  }
const look = shotFixture();
look.characters[0].rotation = [0, Math.PI / 2, 0];
look.actions = [
  {
    resourceId: "ACTION_LOOK_001",
    actor: "actor",
    direction: [0, 0, 1],
    start: 0,
    end: 1,
  },
];
const yaw = poseAt(look.characters[0], look, 0.5).headYaw;
assert(Math.abs(yaw + Math.PI / 2) < 1e-9);
const attached = shotFixture();
attached.actions = [];
attached.characters[0].rotation = [0, Math.PI / 2, 0];
const forward = new Vector3(0, 0, 1).transformDirection(
  vfxAttachmentMatrix(
    {
      resourceId: "VFX_COLD_BREATH_001",
      actor: "actor",
      anchor: "face",
      start: 0,
      end: 1,
    },
    attached,
    0.5,
  ),
);
assert(forward.distanceTo(new Vector3(1, 0, 0)) < 1e-9);
await json("transform-results", {
  coordinateSystem:
    "WORLD = T * R(XYZ) * S * LOCAL; inverse uses Matrix4.invert",
  anchorCases,
  doorCases,
  maxHandHandleError: maxError,
  lookYaw: yaw,
  expectedLookYaw: -Math.PI / 2,
  attachedFaceForward: forward.toArray(),
  pointRegression: "tests/transform-hardening.test.ts",
});
const s = resolveShot(shotFixture()),
  executors: any[] = [];
for (const r of registry.entries) {
  let output: any;
  if (r.type === "character")
    output = Character({
      instance: { instanceId: "preview", resourceId: r.id },
      shot: { ...s, actions: [] },
      t: 0.5,
    });
  if (r.type === "environment") output = Environment({ id: r.id });
  if (r.type === "prop")
    output = Prop({
      instance: { instanceId: "preview", resourceId: r.id },
      shot: { ...s, actions: [] },
      t: 0.5,
    });
  if (r.type === "vfx")
    output = Vfx({
      binding: {
        resourceId: r.id,
        start: 0,
        end: 1,
        ...(r.name === "SNOW"
          ? {}
          : { actor: "actor", anchor: "face" as const }),
      },
      shot: s,
      t: 0.5,
    });
  if (r.type === "camera") output = cameraAt(r.id, 0.5);
  if (r.type === "action")
    output = poseAt(
      s.characters[0],
      {
        ...s,
        actions: [
          {
            resourceId: r.id,
            actor: "actor",
            start: 0,
            end: 1,
            ...(r.name === "OPEN_DOOR"
              ? { target: "door" }
              : ["POINT", "LOOK"].includes(r.name)
                ? { targetPosition: [1, 1, 2] as Vec3 }
                : {}),
          },
        ],
      },
      0.5,
    );
  assert(output);
  executors.push({ id: r.id, type: r.type, executed: true });
}
const counts = Object.fromEntries(
  [
    "character",
    "environment",
    "prop",
    "action",
    "camera",
    "vfx",
    "scenePreset",
  ].map((type) => [
    type,
    registry.entries.filter((r) => r.type === type).length,
  ]),
);
assert.equal(executors.length, 49);
await json("executor-results", {
  total: 49,
  counts,
  executors,
  unknownIdTests: "tests/hardening-contracts.test.ts",
});
console.log(
  JSON.stringify({
    fastTests: fastCount,
    red: red.passed,
    green: green.passed,
    doorCases: doorCases.length,
    anchorCases: anchorCases.length,
    maxError,
    executors: 49,
  }),
);
