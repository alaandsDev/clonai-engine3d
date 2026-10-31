import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveSafeOutputPath, safeArtifactName } from "../src/engine3d/paths";
import { resolveShot } from "../src/engine3d/validation";
import { compileDirectorPlan, captions } from "../src/engine3d/director";
import { Character, Environment, Prop, Vfx } from "../src/engine3d/library";
import { poseAt, cameraAt } from "../src/engine3d/motion";
import { Registry, registry } from "../src/engine3d/registry";
import { SHOT_LIMITS } from "../src/engine3d/limits";
import { validateSequence } from "../src/engine3d/sequence-validation";
import { shotFixture, planFixture } from "./fixtures/hardening";
const rejects = (f: () => unknown, code?: string) =>
  assert.throws(
    f,
    (e: any) => e.name === "EngineError" && (!code || e.code === code),
  );
test("runtime sequence inputProps reject malformed timeline and values before React", () => {
  const sequence = compileDirectorPlan(planFixture());
  assert(validateSequence(sequence));
  for (const change of [
    (s: any) => (s.width = Infinity),
    (s: any) => (s.shots = [null]),
    (s: any) => (s.shots[0].onScreenText = { bad: true }),
    (s: any) => (s.shots[0].startFrame = 2),
    (s: any) => (s.captions[0].endFrame = 0),
  ]) {
    const s = structuredClone(sequence);
    change(s);
    rejects(() => validateSequence(s));
  }
});
test("declared final state must agree with the actual prop execution", () => {
  const s = shotFixture();
  s.props[0].finalState = { openProgress: 0.2 };
  rejects(() => resolveShot(s), "CONTINUITY_MISMATCH");
  s.props[0].finalState = { openProgress: 1 };
  assert(resolveShot(s));
});
test("every one of the 53 available IDs executes its actual category implementation", () => {
  const s = resolveShot(shotFixture());
  for (const r of registry.entries) {
    if (r.type === "character")
      assert(
        Character({
          instance: { instanceId: "preview", resourceId: r.id },
          shot: { ...s, actions: [] },
          t: 0.5,
        }),
      );
    if (r.type === "environment") assert(Environment({ id: r.id }));
    if (r.type === "prop")
      assert(
        Prop({
          instance: { instanceId: "preview", resourceId: r.id },
          shot: { ...s, actions: [] },
          t: 0.5,
        }),
      );
    if (r.type === "vfx")
      assert(
        Vfx({
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
        }),
      );
    if (r.type === "camera")
      assert(cameraAt(r.id, 0.5).position.every(Number.isFinite));
    if (r.type === "action") {
      const b = {
        resourceId: r.id,
        actor: "actor",
        start: 0,
        end: 1,
        ...(r.name === "OPEN_DOOR"
          ? { target: "door" }
          : ["POINT", "LOOK"].includes(r.name)
            ? { targetPosition: [1, 1, 2] as [number, number, number] }
            : {}),
      };
      assert(
        poseAt(s.characters[0], { ...s, actions: [b] }, 0.5).position.every(
          Number.isFinite,
        ),
      );
    }
  }
  assert.equal(registry.entries.length, 53);
});
test("H01 central helper rejects hostile Windows, Unix and mixed names", () => {
  const root = path.resolve("out/engine3d/phase6b/path-sandbox");
  for (const id of [
    "../../escape",
    "..\\..\\escape",
    "C:\\temp\\escape",
    "C:escape",
    "\\\\server\\share",
    "/tmp/escape",
    "shot/../../../escape",
    ".",
    "..",
    "CON",
    "PRN",
    "AUX",
    "NUL",
    "CON.txt",
    "COM1",
    "lpt9.png",
    "bad\\/../x",
    "a:b",
    "a?b",
    "a*b",
    "a|b",
    "a<b",
    "a>b",
    '"',
    "a\0b",
    "",
    "   ",
    "...",
    "a.",
    "name ",
    "🔥",
  ])
    rejects(
      () => resolveSafeOutputPath(root, id, ".png"),
      "UNSAFE_OUTPUT_PATH",
    );
  rejects(
    () => resolveSafeOutputPath(root, "ok", "/../../bad"),
    "UNSAFE_OUTPUT_PATH",
  );
  assert.equal(safeArtifactName("good-id"), "good-id");
});
test("H01 safe writes and canonical containment stay within temporary sandbox", async () => {
  const sandbox = await mkdtemp(path.join(tmpdir(), "engine-path-"));
  try {
    const root = path.join(sandbox, "artifacts"),
      outside = path.join(sandbox, "sibling");
    await mkdir(root);
    await mkdir(outside);
    const dest = resolveSafeOutputPath(root, "valid-id", ".json");
    await writeFile(dest, "{}");
    assert.equal(await readFile(dest, "utf8"), "{}");
    await symlink(outside, path.join(root, "junction.png"), "junction");
    rejects(
      () => resolveSafeOutputPath(root, "junction", ".png"),
      "UNSAFE_OUTPUT_PATH",
    );
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});
test("logical shot IDs remain data but output names must pass filesystem policy", () => {
  const p = planFixture();
  p.scenes[0].shots[0].id = "logical/segment";
  assert.equal(compileDirectorPlan(p).shots[0].id, "logical/segment");
  rejects(
    () => resolveSafeOutputPath("out", p.scenes[0].shots[0].id, ".png"),
    "UNSAFE_OUTPUT_PATH",
  );
});
for (const n of [NaN, Infinity, -Infinity])
  test(`nonfinite ${n} rejected across contract numeric fields`, () => {
    const changes: ((s: any) => void)[] = [
      (s) => (s.durationSeconds = n),
      (s) => (s.characters[0].position = [n, 0, 0]),
      (s) => (s.characters[0].rotation = [0, n, 0]),
      (s) => (s.characters[0].scale = [1, 1, n]),
      (s) => (s.camera.parameters = { strength: n }),
      (s) => (s.props[0].parameters = { openProgress: n }),
      (s) => (s.actions[0].start = n),
      (s) => (s.actions[0].end = n),
      (s) =>
        (s.actions = [
          {
            resourceId: "ACTION_POINT_001",
            actor: "actor",
            start: 0,
            end: 1,
            targetPosition: [n, 0, 0],
          },
        ]),
      (s) =>
        (s.actions = [
          {
            resourceId: "ACTION_LOOK_001",
            actor: "actor",
            start: 0,
            end: 1,
            direction: [0, n, 0],
          },
        ]),
      (s) =>
        (s.vfx = [
          {
            resourceId: "VFX_SNOW_001",
            start: 0,
            end: 1,
            parameters: { intensity: n },
          },
        ]),
      (s) => {
        s.props[0].resourceId = "PROP_THERMOMETER_001";
        s.props[0].parameters = { value: n };
        s.actions = [];
      },
    ];
    for (const change of changes) {
      const s = shotFixture();
      change(s);
      rejects(() => resolveShot(s));
    }
    for (const key of ["width", "height", "fps"]) {
      const p = planFixture();
      (p.format as any)[key] = n;
      rejects(() => compileDirectorPlan(p));
    }
  });
test("known fields reject null, wrong types, shapes, enums and ignored targets", () => {
  for (const change of [
    (s: any) => (s.onScreenText = {}),
    (s: any) => (s.narrationSegment = 2),
    (s: any) => (s.visualIntent = false),
    (s: any) => (s.characters[0].position = null),
    (s: any) => (s.props[0].initialState = []),
    (s: any) => (s.actions[0].actor = 4),
    (s: any) => (s.actions[0].targetPosition = [1, 2]),
    (s: any) => (s.actions[0].anchor = "unknown"),
    (s: any) => (s.actions[0].direction = [0, 0, 0]),
    (s: any) => (s.actions[0].targetPosition = [1, 2, 3]),
    (s: any) => (s.camera.parameters = { unknown: 1 }),
  ]) {
    const s = shotFixture();
    change(s);
    rejects(() => resolveShot(s));
  }
});
test("Frost and breath binding types fail both validation and direct execution", () => {
  const s = shotFixture();
  for (const b of [
    { resourceId: "VFX_FROST_001", target: "actor" },
    { resourceId: "VFX_FROST_001", actor: "door" },
    { resourceId: "VFX_FROST_001", actor: "actor" },
    { resourceId: "VFX_COLD_BREATH_001", target: "door" },
    { resourceId: "VFX_COLD_BREATH_001", actor: "door", anchor: "face" },
  ]) {
    const binding = { ...b, start: 0, end: 1 } as any;
    rejects(() => resolveShot({ ...s, vfx: [binding] }));
    rejects(() => Vfx({ binding, shot: s, t: 0.5 }));
  }
  assert(
    resolveShot({
      ...s,
      vfx: [{ resourceId: "VFX_FROST_001", target: "door", start: 0, end: 1 }],
    }),
  );
  assert(
    resolveShot({
      ...s,
      vfx: [
        {
          resourceId: "VFX_FROST_001",
          actor: "actor",
          anchor: "face",
          start: 0,
          end: 1,
        },
      ],
    }),
  );
});
test("Thermometer initialState maps explicitly to visual parameter and conflicts fail", () => {
  const s = shotFixture();
  s.actions = [];
  s.props = [
    {
      instanceId: "therm",
      resourceId: "PROP_THERMOMETER_001",
      initialState: { value: -63 },
    },
  ];
  const r = resolveShot(s);
  assert.equal(r.props[0].parameters?.value, -63);
  const tree = Prop({ instance: r.props[0], shot: r, t: 0 }) as any;
  const canonical = Prop({
    instance: {
      instanceId: "therm",
      resourceId: "PROP_THERMOMETER_001",
      parameters: { value: -63 },
    },
    shot: r,
    t: 0,
  }) as any;
  assert.deepEqual(
    tree.props.children.props.children[2].props,
    canonical.props.children.props.children[2].props,
  );
  s.props[0].parameters = { value: 20 };
  rejects(() => resolveShot(s), "INVALID_PARAMETER");
});
test("unknown IDs fail at every direct executor including inactive actions/VFX", () => {
  const shot = shotFixture(),
    unknown = { instanceId: "bad", resourceId: "CHAR_CAIO_001_UNKNOWN" };
  rejects(
    () => Character({ instance: unknown, shot, t: 0 }),
    "EXECUTOR_NOT_FOUND",
  );
  rejects(
    () =>
      Prop({
        instance: { ...unknown, resourceId: "PROP_RADIO_001_UNKNOWN" },
        shot,
        t: 0,
      }),
    "EXECUTOR_NOT_FOUND",
  );
  rejects(
    () => Environment({ id: "ENV_WINTER_001_UNKNOWN" }),
    "EXECUTOR_NOT_FOUND",
  );
  rejects(
    () =>
      Vfx({
        binding: { resourceId: "VFX_FROST_UNKNOWN", start: 0.8, end: 1 },
        shot,
        t: 0,
      }),
    "EXECUTOR_NOT_FOUND",
  );
  rejects(() => cameraAt("CAM_STATIC_001_UNKNOWN", 0), "EXECUTOR_NOT_FOUND");
  shot.actions[0].resourceId = "ACTION_IDLE_001_UNKNOWN";
  rejects(() => poseAt(shot.characters[0], shot, 0), "EXECUTOR_NOT_FOUND");
});
test("Idle and Static explicitly preserve base pose/camera", () => {
  const s = shotFixture();
  s.actions = [];
  const baseline = poseAt(s.characters[0], s, 0.4);
  s.actions = [
    { resourceId: "ACTION_IDLE_001", actor: "actor", start: 0, end: 1 },
  ];
  assert.deepEqual(poseAt(s.characters[0], s, 0.4), baseline);
  assert.deepEqual(cameraAt("CAM_STATIC_001", 0.4), {
    position: [0, 2.1, 7.4],
    target: [0, 1.25, 0],
  });
  assert.deepEqual(
    cameraAt("CAM_ORBIT_001", 0.4, 0),
    cameraAt("CAM_STATIC_001", 0.4),
  );
});
test("available metadata cannot register an unimplemented executor", () => {
  rejects(
    () =>
      new Registry([{ ...registry.entries[0], id: "CHAR_UNIMPLEMENTED_001" }]),
    "EXECUTOR_NOT_FOUND",
  );
  assert.equal(registry.entries.length, 53);
});
test("captions fail explicitly rather than dropping words on short timeline", () => {
  rejects(
    () => captions("um dois três quatro cinco seis sete", 0, 2),
    "CAPTION_DURATION_TOO_SHORT",
  );
  const cues = captions("um dois três quatro cinco seis sete", 0, 3);
  assert.equal(
    cues.map((c) => c.text).join(" "),
    "um dois três quatro cinco seis sete",
  );
  assert(cues.every((c) => c.endFrame > c.startFrame));
});
for (const k of ["characters", "props", "actions", "vfx"] as const)
  test(`guardrail ${k}: boundary accepted and overflow rejected`, () => {
    const s = shotFixture();
    s.actions = [];
    const limit = SHOT_LIMITS[k];
    if (k === "characters")
      s.characters = Array.from({ length: limit }, (_, n) => ({
        ...s.characters[0],
        instanceId: "actor" + n,
      }));
    if (k === "props")
      s.props = Array.from({ length: limit }, (_, n) => ({
        ...s.props[0],
        instanceId: "door" + n,
      }));
    if (k === "actions")
      s.actions = Array.from({ length: limit }, () => ({
        resourceId: "ACTION_IDLE_001",
        actor: "actor",
        start: 0,
        end: 1,
      }));
    if (k === "vfx")
      s.vfx = Array.from({ length: limit }, () => ({
        resourceId: "VFX_COLD_BREATH_001",
        actor: "actor",
        anchor: "face",
        start: 0,
        end: 1,
      }));
    assert(resolveShot(s));
    (s[k] as any[]).push({
      ...s[k][0],
      ...(["characters", "props"].includes(k)
        ? { instanceId: "overflow" }
        : {}),
    });
    rejects(() => resolveShot(s), "PERFORMANCE_LIMIT");
  });
test("snow budget sums all bindings", () => {
  const s = shotFixture();
  s.actions = [];
  s.vfx = Array.from({ length: 2 }, () => ({
    resourceId: "VFX_SNOW_001",
    start: 0,
    end: 1,
    parameters: { intensity: 1 },
  }));
  assert(resolveShot(s));
  s.vfx.push({ ...s.vfx[0] });
  rejects(() => resolveShot(s), "PERFORMANCE_LIMIT");
});
