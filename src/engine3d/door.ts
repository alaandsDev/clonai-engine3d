import { Vector3, Euler } from "three";
import { fail, type Instance, type ShotSpec } from "./contracts";
import { instanceMatrix } from "./transforms";
const clamp = (v: number) => Math.max(0, Math.min(1, v));
export function effectiveDoorOpenProgress(
  door: Instance,
  shot: ShotSpec,
  t: number,
) {
  if (!Number.isFinite(t)) fail("INVALID_PARAMETER", "door time");
  let value =
    door.parameters?.openProgress ?? door.initialState?.openProgress ?? 0;
  if (!Number.isFinite(value) || value < 0 || value > 1)
    fail("INVALID_PARAMETER", "door openProgress");
  for (const b of shot.actions)
    if (
      b.resourceId === "ACTION_OPEN_DOOR_001" &&
      b.target === door.instanceId
    ) {
      if (
        !Number.isFinite(b.start) ||
        !Number.isFinite(b.end) ||
        b.start < 0 ||
        b.start >= b.end ||
        b.end > 1
      )
        fail("INVALID_TIMING", b.resourceId);
      const x = clamp((t - b.start) / (b.end - b.start));
      value = Math.max(value, x * x * (3 - 2 * x));
    }
  return value;
}
export function doorHandleWorld(door: Instance, shot: ShotSpec, t: number) {
  return new Vector3(0.83, 1.05, 0.1)
    .applyEuler(
      new Euler(0, -effectiveDoorOpenProgress(door, shot, t) * 1.5, 0),
    )
    .add(new Vector3(-0.52, 0, 0))
    .applyMatrix4(instanceMatrix(door));
}
