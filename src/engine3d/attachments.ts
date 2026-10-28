import { Matrix4 } from "three";
import { fail, type Binding, type ShotSpec } from "./contracts";
import { requireExecutor } from "./executors";
import { anchorMatrix } from "./motion";
import { instanceMatrix } from "./transforms";
import { resolveShot } from "./validation";
export function vfxAttachmentMatrix(
  binding: Binding,
  shot: ShotSpec,
  t: number,
): Matrix4 {
  if (!Number.isFinite(t)) fail("INVALID_PARAMETER", "attachment time");
  const key = requireExecutor(binding.resourceId, "vfx");
  resolveShot({ ...shot, vfx: [binding] });
  if (key === "SNOW") return new Matrix4();
  if (binding.actor) {
    const actor =
      shot.characters.find((i) => i.instanceId === binding.actor) ??
      fail("MISSING_ACTOR", binding.actor);
    return anchorMatrix(
      actor,
      shot,
      t,
      binding.anchor ??
        fail("UNSUPPORTED_ANCHOR", "attachment anchor required"),
    );
  }
  const target =
    shot.props.find((i) => i.instanceId === binding.target) ??
    fail("MISSING_TARGET", "attachment prop required");
  return instanceMatrix(target);
}
