import {
  fail,
  type ShotSpec,
  type ResourceType,
  type Instance,
  type Binding,
} from "./contracts";
import { registry, supportsAnchor } from "./registry";
import { shotShape, object } from "./schema";
import { requireExecutor } from "./executors";
import { SHOT_LIMITS } from "./limits";
import { effectiveDoorOpenProgress } from "./door";
export function resource(id: string, type: ResourceType) {
  const r = registry.resolve(id, type);
  if (!r.ok)
    fail(
      type === "camera" ? "UNSUPPORTED_CAMERA" : "RESOURCE_NOT_FOUND",
      `${id}: ${r.reason}`,
    );
  requireExecutor(id, type);
  return r.ok ? r.resource : fail("RESOURCE_NOT_FOUND", id);
}
export function parameters(id: string, values: Record<string, number> = {}) {
  object(values, "parameters");
  const r = registry.getById(id) ?? fail("RESOURCE_NOT_FOUND", id);
  for (const [key, v] of Object.entries(values)) {
    const spec = r.metadata.parameters[key];
    if (
      !Object.hasOwn(r.metadata.parameters, key) ||
      !spec ||
      !Number.isFinite(v) ||
      (spec.min !== undefined && v < spec.min) ||
      (spec.max !== undefined && v > spec.max)
    )
      fail("INVALID_PARAMETER", `${id}.${key}=${v}`);
  }
}
export const vector = (v: unknown) =>
  Array.isArray(v) &&
  v.length === 3 &&
  v.every((n) => typeof n === "number" && Number.isFinite(n));
export function resolveShot(s: ShotSpec): ShotSpec {
  shotShape(s);
  for (const k of ["characters", "props", "actions", "vfx"] as const)
    if (s[k].length > SHOT_LIMITS[k]) fail("PERFORMANCE_LIMIT", k);
  if (
    s.vfx
      .filter((b) => b.resourceId === "VFX_SNOW_001")
      .reduce(
        (sum, b) => sum + Math.round(80 * (b.parameters?.intensity ?? 0.6)),
        0,
      ) > SHOT_LIMITS.snowParticles
  )
    fail("PERFORMANCE_LIMIT", "snowParticles");
  if (!Number.isFinite(s.durationSeconds) || s.durationSeconds <= 0)
    fail("INVALID_DURATION", s.id);
  resource(s.environment.resourceId, "environment");
  resource(s.camera.resourceId, "camera");
  parameters(s.camera.resourceId, s.camera.parameters);
  const instances = new Map<string, Instance>();
  for (const [type, list] of [
    ["character", s.characters],
    ["prop", s.props],
  ] as const) {
    for (const i of list) {
      resource(i.resourceId, type);
      if (!i.instanceId || instances.has(i.instanceId))
        fail("DUPLICATE_INSTANCE_ID", i.instanceId);
      instances.set(i.instanceId, i);
      for (const k of ["position", "rotation", "scale"] as const)
        if (
          i[k] !== undefined &&
          (!vector(i[k]) || (k === "scale" && i[k]!.some((n) => n <= 0)))
        )
          fail("INVALID_TRANSFORM", `${i.instanceId}.${k}`);
      parameters(i.resourceId, i.parameters);
      parameters(i.resourceId, i.initialState);
      parameters(i.resourceId, i.finalState);
      for (const [k, v] of Object.entries(i.initialState ?? {}))
        if (i.parameters?.[k] !== undefined && i.parameters[k] !== v)
          fail("INVALID_PARAMETER", "parameters and initialState disagree");
    }
  }
  for (const [type, list] of [
    ["action", s.actions],
    ["vfx", s.vfx],
  ] as const)
    for (const b of list) {
      const r = resource(b.resourceId, type);
      if (
        !Number.isFinite(b.start) ||
        !Number.isFinite(b.end) ||
        b.start < 0 ||
        b.end > 1 ||
        b.start >= b.end
      )
        fail("INVALID_TIMING", b.resourceId);
      parameters(b.resourceId, b.parameters);
      if (
        (b.targetPosition && !vector(b.targetPosition)) ||
        (b.direction && !vector(b.direction))
      )
        fail("INVALID_TRANSFORM", b.resourceId);
      const actor = b.actor ? instances.get(b.actor) : undefined;
      if (type === "action" && (!actor || !s.characters.includes(actor)))
        fail("MISSING_ACTOR", b.actor ?? b.resourceId);
      if (b.actor && !actor) fail("MISSING_ACTOR", b.actor);
      if (type === "action") {
        if (b.anchor !== undefined)
          fail(
            "INVALID_PARAMETER",
            "action anchors unsupported; targets are world positions/origins",
          );
        const choices = [b.target, b.targetPosition, b.direction].filter(
          (v) => v !== undefined,
        ).length;
        if (choices > 1) fail("INVALID_PARAMETER", "ambiguous action target");
        const id = b.resourceId;
        if (
          [
            "ACTION_IDLE_001",
            "ACTION_WAVE_001",
            "ACTION_JUMP_001",
            "ACTION_DANCE_001",
            "ACTION_THINK_001",
          ].includes(id) &&
          choices
        )
          fail("INVALID_PARAMETER", "action has no target binding");
        if (
          ["ACTION_WALK_001", "ACTION_RUN_001"].includes(id) &&
          (b.target || b.direction)
        )
          fail("INVALID_PARAMETER", "locomotion accepts only targetPosition");
        if (id === "ACTION_OPEN_DOOR_001" && (b.direction || b.targetPosition))
          fail("INVALID_PARAMETER", "OpenDoor requires target prop");
      }
      if (type === "vfx") {
        if (b.targetPosition !== undefined || b.direction !== undefined)
          fail("INVALID_PARAMETER", "VFX uses instance bindings");
        if (b.resourceId === "VFX_SNOW_001") {
          if (b.actor || b.target || b.anchor)
            fail("INVALID_PARAMETER", "snow is unbound");
        } else {
          if (b.actor && (!actor || !s.characters.includes(actor)))
            fail("MISSING_ACTOR", "VFX actor must be character");
          if (
            b.resourceId === "VFX_COLD_BREATH_001" &&
            (!actor || b.anchor !== "face" || b.target)
          )
            fail(
              "UNSUPPORTED_ANCHOR",
              "cold breath requires character.face only",
            );
          if (b.resourceId === "VFX_FROST_001") {
            if (b.actor) {
              if (!b.anchor || b.target)
                fail("UNSUPPORTED_ANCHOR", "frost actor requires anchor only");
            } else if (
              !b.target ||
              !s.props.some((p) => p.instanceId === b.target) ||
              b.anchor
            )
              fail(
                "MISSING_TARGET",
                "frost requires prop target or character anchor",
              );
          }
        }
      }
      if (
        type === "action" &&
        actor &&
        !r.metadata.compatibleCharacters?.includes(actor.resourceId)
      )
        fail("INCOMPATIBLE_ACTION", `${actor.resourceId}/${b.resourceId}`);
      if (b.target && !instances.has(b.target))
        fail("MISSING_TARGET", b.target);
      if (
        b.resourceId === "ACTION_OPEN_DOOR_001" &&
        (!b.target || instances.get(b.target)?.resourceId !== "PROP_DOOR_001")
      )
        fail("MISSING_TARGET", "OpenDoor requires Door");
      if (
        ["ACTION_POINT_001", "ACTION_LOOK_001"].includes(b.resourceId) &&
        !b.target &&
        !b.targetPosition &&
        !b.direction
      )
        fail("MISSING_TARGET", b.resourceId);
      if (b.anchor && (!actor || !supportsAnchor(actor.resourceId, b.anchor)))
        fail("UNSUPPORTED_ANCHOR", b.anchor);
      if (
        b.resourceId === "VFX_COLD_BREATH_001" &&
        (!actor || b.anchor !== "face")
      )
        fail("UNSUPPORTED_ANCHOR", "cold breath requires actor.face");
      if (b.resourceId === "VFX_FROST_001" && !b.target && !b.actor)
        fail("MISSING_TARGET", "frost");
    }
  for (const prop of s.props) {
    const values = { ...prop.parameters, ...prop.initialState };
    for (const [key, declared] of Object.entries(prop.finalState ?? {})) {
      const executed =
        prop.resourceId === "PROP_DOOR_001" && key === "openProgress"
          ? effectiveDoorOpenProgress(prop, s, 1)
          : (values[key] ?? 0);
      if (declared !== executed)
        fail(
          "CONTINUITY_MISMATCH",
          "finalState disagrees with executed prop state",
        );
    }
  }
  return {
    ...s,
    characters: s.characters.map(defaultTransform),
    props: s.props.map(defaultTransform),
  };
}
function defaultTransform(i: Instance): Instance {
  return {
    ...i,
    parameters: { ...i.parameters, ...i.initialState },
    position: i.position ?? [0, 0, 0],
    rotation: i.rotation ?? [0, 0, 0],
    scale: i.scale ?? [1, 1, 1],
  };
}
