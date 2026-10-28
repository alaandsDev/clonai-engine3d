import { Vector3, Euler, Matrix4, Quaternion } from "three";
import {
  fail,
  type Anchor,
  type Binding,
  type Instance,
  type ShotSpec,
  type Vec3,
} from "./contracts";
import { requireExecutor } from "./executors";
import { instanceMatrix, worldToLocal } from "./transforms";
import { doorHandleWorld } from "./door";
import { registry, supportsAnchor } from "./registry";
import { vec } from "./schema";
export const clamp = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};
export const seeded = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};
export const progress = (b: Binding, t: number) =>
  clamp((t - b.start) / (b.end - b.start));
/** Analytical model coordinates, not extracted mesh/bone positions. */
export const rig = {
  head: [0, 2.05, 0],
  face: [0, 2.07, 0.49],
  leftHand: [-0.63, 0.91, 0],
  rightHand: [0.63, 0.91, 0],
  chest: [0, 1.25, 0],
} satisfies Record<Anchor, Vec3>;
export interface Pose {
  position: Vec3;
  lean: number;
  headYaw: number;
  leftArm: number;
  rightArm: number;
  leftLeg: number;
  rightLeg: number;
  handReach?: Vec3;
  leftHandReach?: Vec3;
  /** Analytical local foot endpoints for directed locomotion, without skeletal IK. */
  feet?: { left: Vec3; right: Vec3 };
}
export function bodyMatrix(i: Instance, pose: Pose) {
  return instanceMatrix({ ...i, position: pose.position }).multiply(
    new Matrix4().makeRotationX(pose.lean),
  );
}
function targetOf(b: Binding, shot: ShotSpec): Vec3 | undefined {
  if (b.targetPosition) return b.targetPosition;
  if (!b.target) return;
  const target =
    [...shot.props, ...shot.characters].find(
      (x) => x.instanceId === b.target,
    ) ?? fail("MISSING_TARGET", b.target);
  return new Vector3().applyMatrix4(instanceMatrix(target)).toArray() as Vec3;
}
export function poseAt(i: Instance, shot: ShotSpec, t: number): Pose {
  requireExecutor(i.resourceId, "character");
  instanceMatrix(i);
  if (!Number.isFinite(t) || t < 0 || t > 1)
    fail("INVALID_PARAMETER", "pose time must be normalized");
  const pose: Pose = {
    position: [...(i.position ?? [0, 0, 0])],
    lean: 0,
    headYaw: 0,
    leftArm: 0,
    rightArm: 0,
    leftLeg: 0,
    rightLeg: 0,
  };
  const bindings = shot.actions.filter((b) => {
    requireExecutor(b.resourceId, "action");
    if (
      !Number.isFinite(b.start) ||
      !Number.isFinite(b.end) ||
      b.start < 0 ||
      b.start >= b.end ||
      b.end > 1
    )
      fail("INVALID_TIMING", b.resourceId);
    if (b.targetPosition !== undefined) vec(b.targetPosition, "targetPosition");
    if (b.direction !== undefined) {
      vec(b.direction, "direction");
      if (b.direction.every((n) => n === 0))
        fail("INVALID_PARAMETER", "direction cannot be zero");
    }
    if (
      b.actor === i.instanceId &&
      !registry
        .getById(b.resourceId)
        ?.metadata.compatibleCharacters?.includes(i.resourceId)
    )
      fail("INCOMPATIBLE_ACTION", b.resourceId);
    return b.actor === i.instanceId && t >= b.start && t <= b.end;
  });
  // Base body pose first, target-space actions second: attachment math sees the final body transform.
  for (const b of bindings) {
    const key = requireExecutor(b.resourceId, "action"),
      p = progress(b, t),
      wave = Math.sin(p * Math.PI * 8);
    switch (key) {
      case "IDLE":
        break; // Intentional explicit base pose, never an unknown-action fallback.
      case "WALK":
      case "RUN": {
        const run = key === "RUN",
          stride = Math.sin(p * Math.PI * (run ? 16 : 8));
        pose.leftArm = stride * (run ? 1.1 : 0.5);
        pose.rightArm = -pose.leftArm;
        pose.leftLeg = -stride * (run ? 0.85 : 0.4);
        pose.rightLeg = -pose.leftLeg;
        pose.lean = run ? 0.23 : 0.04;
        pose.position[1] += Math.abs(stride) * (run ? 0.18 : 0.04);
        if (b.targetPosition)
          pose.position = pose.position.map(
            (v, k) => v + (b.targetPosition![k] - v) * p,
          ) as Vec3;
        break;
      }
      case "JUMP":
        pose.position[1] += Math.sin(p * Math.PI) * 0.8;
        break;
      case "DANCE":
        pose.position[0] += wave * 0.17;
        pose.leftArm = wave;
        pose.rightArm = -wave;
        pose.lean = wave * 0.12;
        break;
      case "WAVE":
        pose.rightArm = -2.4 + wave * 0.35;
        break;
      case "THINK":
        pose.rightArm = -1.7;
        break;
      case "POINT":
      case "LOOK":
      case "OPEN_DOOR":
        break;
      default:
        fail("EXECUTOR_NOT_FOUND", key);
    }
  }
  for (const b of bindings) {
    const key = requireExecutor(b.resourceId, "action");
    if (key === "LOOK" || key === "POINT") {
      const target = targetOf(b, shot),
        matrix = bodyMatrix(i, pose);
      let local: Vector3;
      if (b.direction) {
        local = new Vector3(...b.direction).transformDirection(
          matrix.clone().invert(),
        );
      } else if (target) local = worldToLocal(target, matrix);
      else return fail("MISSING_TARGET", b.resourceId);
      if (
        !local.toArray().every(Number.isFinite) ||
        !Number.isFinite(local.lengthSq())
      )
        fail("INVALID_PARAMETER", "target magnitude");
      if (key === "LOOK") {
        if (!b.direction) local.sub(new Vector3(...rig.head));
        pose.headYaw = Math.atan2(local.x, local.z);
      } else {
        if (!b.direction) local.sub(new Vector3(0.44, 1.48, 0));
        if (local.lengthSq() === 0)
          fail("INVALID_PARAMETER", "point target equals shoulder");
        pose.handReach = local
          .normalize()
          .multiplyScalar(0.8)
          .toArray() as Vec3;
      }
    }
    if (key === "OPEN_DOOR") {
      const door =
        shot.props.find((x) => x.instanceId === b.target) ??
        fail("MISSING_TARGET", "door");
      const local = doorHandleWorld(door, shot, t).applyMatrix4(
        bodyMatrix(i, pose).invert(),
      );
      if (local.x < 0)
        pose.leftHandReach = [local.x + 0.44, local.y - 1.48, local.z];
      else pose.handReach = [local.x - 0.44, local.y - 1.48, local.z];
    }
  }
  return pose;
}
export function anchorMatrix(
  i: Instance,
  shot: ShotSpec,
  t: number,
  anchor: Anchor,
) {
  if (!supportsAnchor(i.resourceId, anchor))
    fail("UNSUPPORTED_ANCHOR", String(anchor));
  const pose = poseAt(i, shot, t);
  const matrix = bodyMatrix(i, pose),
    local = new Matrix4();
  if (anchor === "head" || anchor === "face") {
    local
      .makeTranslation(...rig.head)
      .multiply(new Matrix4().makeRotationY(pose.headYaw));
    if (anchor === "face")
      local.multiply(
        new Matrix4().makeTranslation(
          rig.face[0] - rig.head[0],
          rig.face[1] - rig.head[1],
          rig.face[2] - rig.head[2],
        ),
      );
  } else if (anchor === "chest") local.makeTranslation(...rig.chest);
  else if (anchor === "leftHand" || anchor === "rightHand") {
    const left = anchor === "leftHand",
      side = left ? -1 : 1,
      reach = left ? pose.leftHandReach : pose.handReach;
    if (reach) {
      const rotation = new Quaternion().setFromUnitVectors(
        new Vector3(0, -1, 0),
        new Vector3(...reach).normalize(),
      );
      local.compose(
        new Vector3(side * 0.44 + reach[0], 1.48 + reach[1], reach[2]),
        rotation,
        new Vector3(1, 1, 1),
      );
    } else
      local
        .makeTranslation(side * 0.44, 1.48, 0)
        .multiply(
          new Matrix4().makeRotationFromEuler(
            new Euler(left ? pose.leftArm : pose.rightArm, 0, side * 0.3),
          ),
        )
        .multiply(new Matrix4().makeTranslation(0, -0.57, 0));
  } else fail("UNSUPPORTED_ANCHOR", String(anchor));
  return matrix.multiply(local);
}
export const anchorAt = (
  i: Instance,
  shot: ShotSpec,
  t: number,
  anchor: Anchor,
) =>
  new Vector3()
    .applyMatrix4(anchorMatrix(i, shot, t, anchor))
    .toArray() as Vec3;
export function cameraAt(
  id: string,
  t: number,
  strength = 1,
): { position: Vec3; target: Vec3 } {
  const key = requireExecutor(id, "camera");
  if (
    !Number.isFinite(t) ||
    !Number.isFinite(strength) ||
    strength < 0 ||
    strength > 3
  )
    fail("INVALID_PARAMETER", "camera");
  const position: Vec3 = [0, 2.1, 7.4],
    target: Vec3 = [0, 1.25, 0];
  switch (key) {
    case "STATIC":
      break;
    case "PUSH_IN":
      position[2] -= t * 1.4 * strength;
      break;
    case "PULL_OUT":
      position[2] += t * 1.8 * strength;
      break;
    case "ORBIT":
      position[0] = Math.sin(t * 1.2) * 6 * strength;
      position[2] = 7.4 + (Math.cos(t * 1.2) - 1) * 7.4 * strength;
      break;
    case "PAN_LEFT":
      position[0] -= t * strength;
      target[0] -= t * strength;
      break;
    case "PAN_RIGHT":
      position[0] += t * strength;
      target[0] += t * strength;
      break;
    case "SHAKE":
      position[0] += Math.sin(t * 143) * 0.05 * strength;
      position[1] += Math.sin(t * 197) * 0.04 * strength;
      break;
    default:
      fail("EXECUTOR_NOT_FOUND", key);
  }
  return { position, target };
}
