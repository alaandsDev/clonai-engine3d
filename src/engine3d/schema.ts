import { fail } from "./contracts";
export function object(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("INVALID_PARAMETER", label + " must be object");
}
export function fields(value: unknown, keys: string[], label: string) {
  object(value, label);
  for (const k of Object.keys(value))
    if (!keys.includes(k))
      fail("INVALID_PARAMETER", `${label}.${k} unknown field`);
}
export function list(
  value: unknown,
  label: string,
): asserts value is unknown[] {
  if (!Array.isArray(value))
    fail("INVALID_PARAMETER", label + " must be array");
}
export function text(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim())
    fail("INVALID_PARAMETER", label + " must be nonempty string");
}
export function shotShape(s: unknown, director = false) {
  object(s, "shot");
  fields(
    s,
    [
      "id",
      "durationSeconds",
      "environment",
      "characters",
      "props",
      "actions",
      "vfx",
      "camera",
      "onScreenText",
      "visualIntent",
      "narrationSegment",
      ...(director ? ["order", "transition"] : []),
    ],
    "shot",
  );
  text(s.id, "shot.id");
  if (s.environment) {
    fields(s.environment, ["resourceId"], "environment");
    text((s.environment as any).resourceId, "environment.resourceId");
  } else if (!director) fail("RESOURCE_NOT_FOUND", "environment");
  fields(s.camera, ["resourceId", "parameters"], "camera");
  text((s.camera as any).resourceId, "camera.resourceId");
  for (const kind of ["characters", "props"]) {
    list(s[kind], kind);
    for (const i of s[kind] as unknown[]) {
      fields(
        i,
        [
          "instanceId",
          "resourceId",
          "position",
          "rotation",
          "scale",
          "parameters",
          "continuityKey",
          "initialState",
          "finalState",
          ...(director && kind === "characters" ? ["castId"] : []),
        ],
        kind,
      );
      text((i as any).instanceId, "instanceId");
      if (director && kind === "characters") text((i as any).castId, "castId");
      else text((i as any).resourceId, "resourceId");
    }
  }
  for (const kind of ["actions", "vfx"]) {
    list(s[kind], kind);
    for (const b of s[kind] as unknown[]) {
      fields(
        b,
        [
          "resourceId",
          "start",
          "end",
          "actor",
          "target",
          "anchor",
          "targetPosition",
          "direction",
          "parameters",
        ],
        kind,
      );
      text((b as any).resourceId, "resourceId");
    }
  }
}
export function planShape(p: unknown) {
  fields(
    p,
    ["id", "title", "format", "style", "cast", "timingMode", "scenes"],
    "plan",
  );
  object(p, "plan");
  text(p.id, "plan.id");
  text(p.title, "plan.title");
  text(p.style, "plan.style");
  fields(p.format, ["width", "height", "fps"], "format");
  object(p.cast, "cast");
  for (const v of Object.values(p.cast)) text(v, "cast resource");
  list(p.scenes, "scenes");
  for (const scene of p.scenes) {
    fields(
      scene,
      ["id", "order", "narration", "environment", "shots"],
      "scene",
    );
    object(scene, "scene");
    text(scene.id, "scene.id");
    if (typeof scene.narration !== "string")
      fail("NARRATION_EMPTY", String(scene.id));
    fields(scene.environment, ["resourceId"], "environment");
    list(scene.shots, "shots");
    for (const s of scene.shots) shotShape(s, true);
  }
}
