import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { fail, type Transform, type Vec3 } from "./contracts";
/** Column vectors: WORLD = T * R(XYZ) * S * LOCAL. */
export function instanceMatrix(i: Transform): Matrix4 {
  for (const v of [
    i.position ?? [0, 0, 0],
    i.rotation ?? [0, 0, 0],
    i.scale ?? [1, 1, 1],
  ])
    if (!Array.isArray(v) || v.length !== 3 || !v.every(Number.isFinite))
      fail("INVALID_TRANSFORM", "matrix requires finite vectors");
  if (i.scale?.some((n) => n <= 0))
    fail("INVALID_TRANSFORM", "scale must be positive");
  const matrix = new Matrix4().compose(
    new Vector3(...(i.position ?? [0, 0, 0])),
    new Quaternion().setFromEuler(new Euler(...(i.rotation ?? [0, 0, 0]))),
    new Vector3(...(i.scale ?? [1, 1, 1])),
  );
  const determinant = matrix.determinant();
  if (!Number.isFinite(determinant) || determinant === 0)
    fail("INVALID_TRANSFORM", "non-invertible or overflowing transform");
  return matrix;
}
export const worldToLocal = (v: Vec3, m: Matrix4) =>
  new Vector3(...v).applyMatrix4(m.clone().invert());
export const localToWorld = (v: Vec3, m: Matrix4) =>
  new Vector3(...v).applyMatrix4(m);
