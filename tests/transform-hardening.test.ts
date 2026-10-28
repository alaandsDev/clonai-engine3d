import { test } from "node:test";
import assert from "node:assert/strict";
import { Euler, Vector3, Matrix4, Quaternion } from "three";
import { anchorAt, anchorMatrix, poseAt } from "../src/engine3d/motion";
import { effectiveDoorOpenProgress } from "../src/engine3d/door";
import { vfxAttachmentMatrix } from "../src/engine3d/attachments";
import { Vfx, Prop } from "../src/engine3d/library";
import { resolveShot } from "../src/engine3d/validation";
import { shotFixture } from "./fixtures/hardening";
import type { Transform, Anchor, Vec3 } from "../src/engine3d/contracts";
const transforms: Record<string, Transform> = {
  translation: { position: [2, -1, 3] },
  uniformScale: { scale: [1.7, 1.7, 1.7] },
  X: { rotation: [0.4, 0, 0] },
  Y: { rotation: [0, 0.7, 0] },
  Z: { rotation: [0, 0, 0.6] },
  XYZ: { rotation: [0.3, 0.7, 0.4] },
  translationRotation: { position: [2, 1, -1], rotation: [0.3, 0.7, 0.4] },
  translationScale: { position: [2, 1, -1], scale: [1.4, 1.4, 1.4] },
  rotationScale: { rotation: [0.3, 0.7, 0.4], scale: [1.2, 0.8, 1.6] },
  all: {
    position: [2, 1, -1],
    rotation: [0.3, 0.7, 0.4],
    scale: [1.2, 0.8, 1.6],
  },
};
const matrix = (t: Transform) =>
  new Matrix4().compose(
    new Vector3(...(t.position ?? [0, 0, 0])),
    new Quaternion().setFromEuler(new Euler(...(t.rotation ?? [0, 0, 0]))),
    new Vector3(...(t.scale ?? [1, 1, 1])),
  );
function analyticAnchor(a: Anchor) {
  if (a === "head") return new Vector3(0, 2.05, 0);
  if (a === "face") return new Vector3(0, 2.07, 0.49);
  if (a === "chest") return new Vector3(0, 1.25, 0);
  const side = a === "leftHand" ? -1 : 1;
  return new Vector3(0, -0.57, 0)
    .applyEuler(new Euler(0, 0, side * 0.3))
    .add(new Vector3(side * 0.44, 1.48, 0));
}
for (const id of ["CHAR_CAIO_001", "CHAR_LIA_001"])
  for (const [name, transform] of Object.entries(transforms))
    test(`analytical anchors ${id} with ${name}`, () => {
      const s = shotFixture();
      s.actions = [];
      const actor = { instanceId: "actor", resourceId: id, ...transform };
      s.characters = [actor];
      for (const a of [
        "head",
        "face",
        "leftHand",
        "rightHand",
        "chest",
      ] as Anchor[]) {
        const expected = analyticAnchor(a).applyMatrix4(matrix(transform));
        assert(
          new Vector3(...anchorAt(actor, s, 0.5, a)).distanceTo(expected) <
            1e-9,
          `${a}:${name}`,
        );
      }
    });
test("Point world target remains collinear under XYZ/scale and transformed target instance", () => {
  for (const transform of Object.values(transforms)) {
    const s = shotFixture();
    const actor = { ...s.characters[0], ...transform };
    s.characters = [actor];
    s.props[0].position = [3, 2, 4];
    s.props[0].rotation = [0.2, 0.4, 0.7];
    s.props[0].scale = [2, 1, 3];
    for (const object of [true, false]) {
      s.actions = [
        {
          resourceId: "ACTION_POINT_001",
          actor: "actor",
          ...(object
            ? { target: "door" }
            : { targetPosition: [3, 2, 4] as Vec3 }),
          start: 0,
          end: 1,
        },
      ];
      const shoulder = new Vector3(0.44, 1.48, 0).applyMatrix4(matrix(actor)),
        hand = new Vector3(...anchorAt(actor, s, 0.5, "rightHand")).sub(
          shoulder,
        ),
        target = new Vector3(3, 2, 4).sub(shoulder);
      assert(hand.clone().cross(target).length() < 1e-8);
      assert(hand.dot(target) > 0);
    }
  }
});
test("Look compensates actor yaw for world target/direction, pitch remains unsupported", () => {
  const s = shotFixture();
  s.characters[0].rotation = [0, Math.PI / 2, 0];
  for (const byDirection of [true, false]) {
    s.actions = [
      {
        resourceId: "ACTION_LOOK_001",
        actor: "actor",
        ...(byDirection
          ? { direction: [0, 0, 1] as Vec3 }
          : { targetPosition: [0.7, 2, 5] as Vec3 }),
        start: 0,
        end: 1,
      },
    ];
    assert(
      Math.abs(poseAt(s.characters[0], s, 0.5).headYaw + Math.PI / 2) < 1e-9,
    );
  }
});
test("attached breath and frost use anchor orientation, not global Z", () => {
  const s = shotFixture();
  s.actions = [];
  s.characters[0].rotation = [0, Math.PI / 2, 0];
  for (const resourceId of ["VFX_COLD_BREATH_001", "VFX_FROST_001"]) {
    const b = {
      resourceId,
      actor: "actor",
      anchor: "face" as const,
      start: 0,
      end: 1,
    };
    s.vfx = [b];
    const m = vfxAttachmentMatrix(b, s, 0.5),
      forward = new Vector3(0, 0, 1).transformDirection(m);
    assert(forward.distanceTo(new Vector3(1, 0, 0)) < 1e-9);
    const element = Vfx({ binding: b, shot: s, t: 0.5 }) as any;
    assert(element.props.matrix.equals(m));
    assert.equal(element.props.matrixAutoUpdate, false);
  }
});
for (const initial of [0, 0.25, 0.8, 1])
  test(`Door effective progress ${initial} contacts handle across transforms and times`, () => {
    for (const transform of Object.values(transforms))
      for (const t of [0, 0.5, 1]) {
        const s = shotFixture();
        s.characters[0] = { ...s.characters[0], ...transform };
        s.props[0] = {
          ...s.props[0],
          initialState: { openProgress: initial },
          rotation: [0.2, -0.3, 0.5],
          position: [1.1, 0.2, -0.3],
          scale: [1.1, 0.9, 1.3],
        };
        const r = resolveShot(s),
          open = Math.max(initial, t * t * (3 - 2 * t));
        assert.equal(effectiveDoorOpenProgress(r.props[0], r, t), open);
        const geometry = Prop({ instance: r.props[0], shot: r, t }) as any;
        assert.equal(
          geometry.props.children.props.children[3].props.rotation[1],
          -open * 1.5,
        );
        const expected = new Vector3(0.83, 1.05, 0.1)
          .applyEuler(new Euler(0, -open * 1.5, 0))
          .add(new Vector3(-0.52, 0, 0))
          .applyMatrix4(matrix(r.props[0]));
        const pose = poseAt(r.characters[0], r, t),
          a = pose.leftHandReach ? "leftHand" : "rightHand";
        assert(
          new Vector3(...anchorAt(r.characters[0], r, t, a)).distanceTo(
            expected,
          ) < 1e-8,
        );
      }
  });
