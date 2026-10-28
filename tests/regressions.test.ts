import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Vector3, Euler } from "three";
import { compileDirectorPlan } from "../src/engine3d/director";
import { parameters, resolveShot } from "../src/engine3d/validation";
import { registry, supportsAnchor } from "../src/engine3d/registry";
import { anchorAt, smooth } from "../src/engine3d/motion";
import { studioSequence } from "../src/engine3d/studio";
import type {
  DirectorPlan,
  NarrationTrack,
  EngineError,
} from "../src/engine3d/contracts";
const plan = JSON.parse(
  await readFile("examples/cold-opening.json", "utf8"),
) as DirectorPlan;
test("open door uses left hand when handle is on actor left and contacts actual handle", () => {
  const shot = compileDirectorPlan(plan).shots[0];
  const actor = shot.characters[0],
    door = shot.props[0],
    b = shot.actions[0];
  const t = 0.5,
    angle = -smooth((t - b.start) / (b.end - b.start)) * 1.5;
  const expected = new Vector3(0.83, 1.05, 0.1)
    .applyEuler(new Euler(0, angle, 0))
    .add(new Vector3(-0.52, 0, 0))
    .multiply(new Vector3(...door.scale!))
    .applyEuler(new Euler(...door.rotation!))
    .add(new Vector3(...door.position!));
  const actual = new Vector3(...anchorAt(actor, shot, t, "leftHand"));
  assert(actual.distanceTo(expected) < 1e-10);
});
test("two-frame narration never creates zero-frame shot for unequal segments", () => {
  const track: NarrationTrack = {
    sceneId: "winter",
    text: "",
    spokenText: "",
    provider: "fake",
    voice: "fake",
    durationSeconds: 2 / 30,
    durationFrames: 2,
    relativeAudioPath: "audio/fake.wav",
    cacheKey: "test",
    timingSource: "estimated_proportional",
  };
  const short = structuredClone(plan);
  short.scenes[0].narration = "A palavraextremamentelonga";
  short.scenes[0].shots[0].narrationSegment = "A";
  short.scenes[0].shots[1].narrationSegment = "palavraextremamentelonga";
  const s = compileDirectorPlan({ ...short, timingMode: "narration" }, [track]);
  assert.deepEqual(
    s.shots.map((s) => s.durationFrames),
    [1, 1],
  );
  assert.equal(s.totalFrames, 2);
});
test("prototype parameter names are rejected explicitly", () => {
  for (const key of ["toString", "constructor", "__proto__"])
    assert.throws(
      () => parameters("PROP_DOOR_001", JSON.parse(`{"${key}":1}`)),
      (e: EngineError) => e.code === "INVALID_PARAMETER",
    );
});
test("plan id cannot escape output folder", () =>
  assert.throws(
    () => compileDirectorPlan({ ...plan, id: "../../escape" }),
    (e: EngineError) => e.code === "INVALID_PARAMETER",
  ));
test("blob does not advertise hand anchors or unsupported gestures", () => {
  assert(!supportsAnchor("CHAR_BLOB_001", "leftHand"));
  assert(
    !registry
      .getById("ACTION_WAVE_001")
      ?.metadata.compatibleCharacters?.includes("CHAR_BLOB_001"),
  );
});
for (const type of ["character", "environment", "prop"] as const)
  test(`studio ${type} gallery includes every registered resource`, () => {
    const s = studioSequence(type);
    assert.equal(s.shots.length, registry.listByType(type).length);
    assert.equal(s.totalFrames, s.shots.length * 90);
    for (const {
      sceneId,
      startFrame,
      endFrame,
      durationFrames,
      ...shot
    } of s.shots)
      assert(resolveShot(shot));
  });
test("multiple scenes preserve contiguous sequence and independent audio ownership", () => {
  const p = structuredClone(plan);
  const second = structuredClone(p.scenes[0]);
  second.id = "winter-two";
  second.order = 2;
  second.shots.forEach((s) => {
    s.id += "-two";
    s.props.forEach((x) => {
      delete x.continuityKey;
    });
  });
  p.scenes.push(second);
  const s = compileDirectorPlan(p);
  assert.equal(s.scenes[1].startFrame, 240);
  assert.equal(s.totalFrames, 480);
  assert.equal(s.shots[1].endFrame, s.shots[2].startFrame);
});
