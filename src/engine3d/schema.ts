import { fail } from "./contracts";
export function object(
  v: unknown,
  label: string,
): asserts v is Record<string, any> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    fail("INVALID_PARAMETER", label + " must be object");
}
export function fields(v: unknown, keys: string[], label: string) {
  object(v, label);
  for (const k of Object.keys(v))
    if (!keys.includes(k))
      fail("INVALID_PARAMETER", label + "." + k + " unknown field");
}
export function list(v: unknown, label: string): asserts v is any[] {
  if (!Array.isArray(v)) fail("INVALID_PARAMETER", label + " must be array");
}
export function text(v: unknown, label: string) {
  if (typeof v !== "string" || !v.trim())
    fail("INVALID_PARAMETER", label + " must be nonempty string");
}
export function finite(
  v: unknown,
  label: string,
  min = -Infinity,
  max = Infinity,
) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    fail("INVALID_PARAMETER", label + " invalid number");
}
export function vec(v: unknown, label: string, scale = false) {
  if (
    !Array.isArray(v) ||
    v.length !== 3 ||
    !v.every(
      (n) => typeof n === "number" && Number.isFinite(n) && (!scale || n > 0),
    )
  )
    fail("INVALID_TRANSFORM", label);
}
const optional = (
  v: Record<string, any>,
  key: string,
  check: (value: any, label: string) => void,
) => {
  if (v[key] !== undefined) check(v[key], key);
};
function numericMap(v: unknown, label: string) {
  object(v, label);
  for (const [k, x] of Object.entries(v)) finite(x, label + "." + k);
}
function environment(v: unknown) {
  fields(v, ["resourceId"], "environment");
  object(v, "environment");
  text(v.resourceId, "environment.resourceId");
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
  if (
    typeof s.durationSeconds !== "number" ||
    !Number.isFinite(s.durationSeconds) ||
    s.durationSeconds <= 0
  )
    fail("INVALID_DURATION", s.id);
  for (const k of ["onScreenText", "visualIntent", "narrationSegment"])
    optional(s, k, (v, l) => {
      if (typeof v !== "string")
        fail("INVALID_PARAMETER", l + " must be string");
    });
  if (director) {
    finite(s.order, "shot.order");
    optional(s, "transition", (v) => {
      if (v !== "CUT") fail("UNSUPPORTED_TRANSITION", String(v));
    });
  }
  if (s.environment !== undefined) environment(s.environment);
  else if (!director) fail("RESOURCE_NOT_FOUND", "environment");
  fields(s.camera, ["resourceId", "parameters"], "camera");
  text(s.camera.resourceId, "camera.resourceId");
  optional(s.camera, "parameters", numericMap);
  for (const kind of ["characters", "props"]) {
    list(s[kind], kind);
    for (const i of s[kind]) {
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
      text(i.instanceId, "instanceId");
      if (director && kind === "characters") {
        text(i.castId, "castId");
        optional(i, "resourceId", text);
      } else text(i.resourceId, "resourceId");
      for (const k of ["position", "rotation"]) optional(i, k, vec);
      optional(i, "scale", (v, l) => vec(v, l, true));
      for (const k of ["parameters", "initialState", "finalState"])
        optional(i, k, numericMap);
      optional(i, "continuityKey", text);
    }
  }
  for (const kind of ["actions", "vfx"]) {
    list(s[kind], kind);
    for (const b of s[kind]) {
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
      text(b.resourceId, "resourceId");
      if (
        !Number.isFinite(b.start) ||
        !Number.isFinite(b.end) ||
        typeof b.start !== "number" ||
        typeof b.end !== "number" ||
        b.start < 0 ||
        b.end > 1 ||
        b.start >= b.end
      )
        fail("INVALID_TIMING", b.resourceId);
      for (const k of ["actor", "target"]) optional(b, k, text);
      optional(b, "anchor", (v) => {
        if (!["head", "face", "leftHand", "rightHand", "chest"].includes(v))
          fail("UNSUPPORTED_ANCHOR", String(v));
      });
      optional(b, "targetPosition", vec);
      optional(b, "direction", (v, l) => {
        vec(v, l);
        if (v.every((n: number) => n === 0))
          fail("INVALID_PARAMETER", "direction cannot be zero");
      });
      optional(b, "parameters", numericMap);
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
  for (const k of ["id", "title", "style"]) text(p[k], k);
  fields(p.format, ["width", "height", "fps"], "format");
  for (const k of ["width", "height", "fps"]) {
    finite(p.format[k], k, 1);
    if (!Number.isInteger(p.format[k]))
      fail("INVALID_PARAMETER", k + " must be integer");
  }
  if (!["fixed", "narration"].includes(p.timingMode))
    fail("INVALID_PARAMETER", "timingMode");
  object(p.cast, "cast");
  for (const [k, v] of Object.entries(p.cast)) {
    text(k, "castId");
    text(v, "cast resource");
  }
  list(p.scenes, "scenes");
  for (const scene of p.scenes) {
    fields(
      scene,
      ["id", "order", "narration", "environment", "shots"],
      "scene",
    );
    text(scene.id, "scene.id");
    finite(scene.order, "scene.order");
    if (typeof scene.narration !== "string")
      fail("NARRATION_EMPTY", String(scene.id));
    environment(scene.environment);
    list(scene.shots, "shots");
    for (const s of scene.shots) shotShape(s, true);
  }
}
export function trackShape(t: unknown) {
  fields(
    t,
    [
      "sceneId",
      "text",
      "spokenText",
      "provider",
      "voice",
      "durationSeconds",
      "durationFrames",
      "relativeAudioPath",
      "cacheKey",
      "timingSource",
    ],
    "audio",
  );
  object(t, "audio");
  for (const k of [
    "sceneId",
    "text",
    "spokenText",
    "provider",
    "voice",
    "relativeAudioPath",
    "cacheKey",
  ]) {
    if (typeof t[k] !== "string") fail("INVALID_PARAMETER", "audio." + k);
  }
  if (
    !Number.isFinite(t.durationSeconds) ||
    t.durationSeconds <= 0 ||
    !Number.isInteger(t.durationFrames) ||
    t.durationFrames < 1
  )
    fail("AUDIO_DURATION_INVALID", "audio duration");
  if (!["tts_boundary", "estimated_proportional"].includes(t.timingSource))
    fail("INVALID_PARAMETER", "audio timingSource");
  if (!/^audio\/[A-Za-z0-9_-]+\.(mp3|wav)$/.test(t.relativeAudioPath))
    fail("INVALID_PARAMETER", "audio path must be relative to public/audio");
}
