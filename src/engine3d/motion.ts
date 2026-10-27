import { Vector3, Euler } from "three";
import type { Anchor, Binding, Instance, ShotSpec, Vec3 } from "./contracts";
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
}
export function poseAt(i: Instance, shot: ShotSpec, t: number): Pose {
  const pose: Pose = {
    position: [...(i.position ?? [0, 0, 0])],
    lean: 0,
    headYaw: 0,
    leftArm: 0,
    rightArm: 0,
    leftLeg: 0,
    rightLeg: 0,
  };
  for (const b of shot.actions.filter(
    (a) => a.actor === i.instanceId && t >= a.start && t <= a.end,
  )) {
    const p = progress(b, t),
      wave = Math.sin(p * Math.PI * 8);
    const id = b.resourceId;
    if (id.includes("WALK") || id.includes("RUN")) {
      const run = id.includes("RUN");
      const stride = Math.sin(p * Math.PI * (run ? 16 : 8));
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
    }
    if (id.includes("JUMP")) pose.position[1] += Math.sin(p * Math.PI) * 0.8;
    if (id.includes("DANCE")) {
      pose.position[0] += wave * 0.17;
      pose.leftArm = wave;
      pose.rightArm = -wave;
      pose.lean = wave * 0.12;
    }
    if (id.includes("WAVE")) pose.rightArm = -2.4 + wave * 0.35;
    if (id.includes("THINK")) pose.rightArm = -1.7;
    const target =
      b.targetPosition ??
      shot.props.concat(shot.characters).find((x) => x.instanceId === b.target)
        ?.position;
    if (id.includes("LOOK") && (target || b.direction)) {
      const d = b.direction ?? [
        target![0] - pose.position[0],
        0,
        target![2] - pose.position[2],
      ];
      pose.headYaw = Math.atan2(d[0], d[2]);
    }
    if (id.includes("POINT") && (target || b.direction)) {
      const v = b.direction
        ? new Vector3(...b.direction).normalize().multiplyScalar(0.8)
        : new Vector3(...target!)
            .sub(new Vector3(...pose.position))
            .applyEuler(
              new Euler(...((i.rotation ?? [0, 0, 0]).map((v) => -v) as Vec3)),
            )
            .divide(new Vector3(...(i.scale ?? [1, 1, 1])))
            .sub(new Vector3(0.44, 1.48, 0));
      v.normalize().multiplyScalar(0.8);
      pose.handReach = [v.x, v.y, v.z];
    }
    if (id.includes("OPEN_DOOR")) {
      const door = shot.props.find((x) => x.instanceId === b.target);
      if (door) {
        const angle = -smooth(p) * 1.5;
        const hand = new Vector3(0.83, 1.05, 0.1)
          .applyEuler(new Euler(0, angle, 0))
          .add(new Vector3(-0.52, 0, 0));
        hand
          .multiply(new Vector3(...(door.scale ?? [1, 1, 1])))
          .applyEuler(new Euler(...(door.rotation ?? [0, 0, 0])))
          .add(new Vector3(...(door.position ?? [0, 0, 0])));
        const local = hand
          .sub(new Vector3(...pose.position))
          .applyEuler(
            new Euler(...((i.rotation ?? [0, 0, 0]).map((v) => -v) as Vec3)),
          )
          .divide(new Vector3(...(i.scale ?? [1, 1, 1])));
        if (local.x < 0)
          pose.leftHandReach = [local.x + 0.44, local.y - 1.48, local.z];
        else pose.handReach = [local.x - 0.44, local.y - 1.48, local.z];
      }
    }
  }
  return pose;
}
export function anchorAt(
  i: Instance,
  shot: ShotSpec,
  t: number,
  anchor: Anchor,
): Vec3 {
  const pose = poseAt(i, shot, t);
  const v = new Vector3(...rig[anchor]);
  if (anchor === "face")
    v.sub(new Vector3(...rig.head))
      .applyAxisAngle(new Vector3(0, 1, 0), pose.headYaw)
      .add(new Vector3(...rig.head));
  if (anchor === "rightHand" && pose.handReach)
    v.set(
      0.44 + pose.handReach[0],
      1.48 + pose.handReach[1],
      pose.handReach[2],
    );
  if (anchor === "leftHand" && pose.leftHandReach)
    v.set(
      -0.44 + pose.leftHandReach[0],
      1.48 + pose.leftHandReach[1],
      pose.leftHandReach[2],
    );
  if (anchor === "leftHand" || anchor === "rightHand") {
    if (
      !(anchor === "rightHand" && pose.handReach) &&
      !(anchor === "leftHand" && pose.leftHandReach)
    ) {
      const side = anchor === "leftHand" ? -1 : 1;
      v.set(0, -0.57, 0)
        .applyEuler(
          new Euler(
            anchor === "leftHand" ? pose.leftArm : pose.rightArm,
            0,
            side * 0.3,
          ),
        )
        .add(new Vector3(side * 0.44, 1.48, 0));
    }
  }
  v.applyEuler(new Euler(pose.lean, 0, 0))
    .multiply(new Vector3(...(i.scale ?? [1, 1, 1])))
    .applyEuler(new Euler(...(i.rotation ?? [0, 0, 0])))
    .add(new Vector3(...pose.position));
  return v.toArray() as Vec3;
}
export function cameraAt(
  id: string,
  t: number,
  strength = 1,
): { position: Vec3; target: Vec3 } {
  const position: Vec3 = [0, 2.1, 7.4];
  const target: Vec3 = [0, 1.25, 0];
  if (id.includes("PUSH_IN")) position[2] -= t * 1.4 * strength;
  if (id.includes("PULL_OUT")) position[2] += t * 1.8 * strength;
  if (id.includes("ORBIT")) {
    position[0] = Math.sin(t * 1.2) * 6 * strength;
    position[2] = Math.cos(t * 1.2) * 7.4;
  }
  if (id.includes("PAN_LEFT")) {
    position[0] -= t * strength;
    target[0] -= t * strength;
  }
  if (id.includes("PAN_RIGHT")) {
    position[0] += t * strength;
    target[0] += t * strength;
  }
  if (id.includes("SHAKE")) {
    position[0] += Math.sin(t * 143) * 0.05 * strength;
    position[1] += Math.sin(t * 197) * 0.04 * strength;
  }
  return { position, target };
}
