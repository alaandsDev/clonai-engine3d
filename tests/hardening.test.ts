import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { Vector3, Euler } from "three";
import { resolveShot } from "../src/engine3d/validation";
import { anchorAt, poseAt, smooth, progress } from "../src/engine3d/motion";
import { shotFixture } from "./fixtures/hardening";
import * as paths from "../src/engine3d/paths";
test("H01: traversal cannot leave artifact root", () => {
  const root = path.resolve("out/engine3d/phase6b/path-sandbox");
  for (const id of [
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
  ]) {
    try {
      const output = paths.resolveSafeOutputPath(root, id, "-start.png");
      const relative = path.relative(root, output);
      assert(
        relative && !relative.startsWith("..") && !path.isAbsolute(relative),
        id,
      );
    } catch (e: any) {
      if (e.code === "ERR_ASSERTION") throw e;
      assert.equal(e.name, "EngineError");
    }
  }
});
test("H02: renderer text and VFX binding must be executable", () => {
  for (const change of [
    (s: any) => (s.onScreenText = { bad: true }),
    (s: any) => (s.narrationSegment = 42),
    (s: any) =>
      (s.vfx = [
        { resourceId: "VFX_FROST_001", target: "actor", start: 0, end: 1 },
      ]),
    (s: any) =>
      (s.vfx = [
        { resourceId: "VFX_FROST_001", actor: "door", start: 0, end: 1 },
      ]),
    (s: any) =>
      (s.actions = [
        {
          resourceId: "ACTION_LOOK_001",
          actor: "actor",
          direction: [0, 0, 0],
          start: 0,
          end: 1,
        },
      ]),
  ]) {
    const s = shotFixture();
    change(s);
    assert.throws(
      () => resolveShot(s),
      (e: any) => e.name === "EngineError",
    );
  }
});
function handleAt(s: ReturnType<typeof shotFixture>, t: number, open: number) {
  const door = s.props[0];
  return new Vector3(0.83, 1.05, 0.1)
    .applyEuler(new Euler(0, -open * 1.5, 0))
    .add(new Vector3(-0.52, 0, 0))
    .multiply(new Vector3(...(door.scale ?? [1, 1, 1])))
    .applyEuler(new Euler(...(door.rotation ?? [0, 0, 0])))
    .add(new Vector3(...(door.position ?? [0, 0, 0])));
}
test("H03: combined XYZ transform preserves hand target", () => {
  const s = resolveShot(shotFixture());
  s.characters[0].rotation = [0.3, 0.7, 0.4];
  const pose = poseAt(s.characters[0], s, 0.5);
  const hand = anchorAt(
    s.characters[0],
    s,
    0.5,
    pose.leftHandReach ? "leftHand" : "rightHand",
  );
  assert(new Vector3(...hand).distanceTo(handleAt(s, 0.5, smooth(0.5))) < 1e-9);
});
test("H04: partially open door shares geometry and hand progress", () => {
  const s = shotFixture();
  s.props[0].initialState = { openProgress: 0.8 };
  const r = resolveShot(s),
    pose = poseAt(r.characters[0], r, 0.25);
  const hand = anchorAt(
    r.characters[0],
    r,
    0.25,
    pose.leftHandReach ? "leftHand" : "rightHand",
  );
  assert(new Vector3(...hand).distanceTo(handleAt(r, 0.25, 0.8)) < 1e-9);
});
