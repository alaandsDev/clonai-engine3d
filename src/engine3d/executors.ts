import { fail, type Resource, type ResourceType } from "./contracts";
/** Explicit inventory, independent of metadata generation; values select exact executor branches. */
export const executorKeys: Record<ResourceType, Record<string, string>> = {
  character: {
    CHAR_ROBOT_001: "ROBOT",
    CHAR_BLOB_001: "BLOB",
    CHAR_SCOUT_001: "SCOUT",
    CHAR_CAIO_001: "CAIO",
    CHAR_LIA_001: "LIA",
    CHAR_ZOMBIE_001: "ZOMBIE",
  },
  environment: {
    ENV_SPACE_001: "SPACE",
    ENV_LAB_001: "LAB",
    ENV_FOREST_001: "FOREST",
    ENV_OCEAN_001: "OCEAN",
    ENV_CITY_001: "CITY",
    ENV_RUINED_STREET_001: "RUINED_STREET",
    ENV_SHELTER_001: "SHELTER",
    ENV_DEAD_FOREST_001: "DEAD_FOREST",
    ENV_WINTER_001: "WINTER",
  },
  prop: {
    PROP_PHONE_001: "PHONE",
    PROP_FLASHLIGHT_001: "FLASHLIGHT",
    PROP_MICROPHONE_001: "MICROPHONE",
    PROP_CAMERA_001: "CAMERA",
    PROP_RADIO_001: "RADIO",
    PROP_BACKPACK_001: "BACKPACK",
    PROP_MEDKIT_001: "MEDKIT",
    PROP_BOTTLE_001: "BOTTLE",
    PROP_MAP_001: "MAP",
    PROP_CROWBAR_001: "CROWBAR",
    PROP_HATCHET_001: "HATCHET",
    PROP_LANTERN_001: "LANTERN",
    PROP_DOOR_001: "DOOR",
    PROP_THERMOMETER_001: "THERMOMETER",
    PROP_CAR_001: "CAR",
  },
  action: {
    ACTION_IDLE_001: "IDLE",
    ACTION_WAVE_001: "WAVE",
    ACTION_JUMP_001: "JUMP",
    ACTION_DANCE_001: "DANCE",
    ACTION_THINK_001: "THINK",
    ACTION_WALK_001: "WALK",
    ACTION_OPEN_DOOR_001: "OPEN_DOOR",
    ACTION_POINT_001: "POINT",
    ACTION_LOOK_001: "LOOK",
    ACTION_RUN_001: "RUN",
  },
  camera: {
    CAM_PUSH_IN_001: "PUSH_IN",
    CAM_PULL_OUT_001: "PULL_OUT",
    CAM_ORBIT_001: "ORBIT",
    CAM_PAN_LEFT_001: "PAN_LEFT",
    CAM_PAN_RIGHT_001: "PAN_RIGHT",
    CAM_SHAKE_001: "SHAKE",
    CAM_STATIC_001: "STATIC",
  },
  vfx: {
    VFX_SNOW_001: "SNOW",
    VFX_COLD_BREATH_001: "COLD_BREATH",
    VFX_FROST_001: "FROST",
  },
  scenePreset: {},
};
export function requireExecutor(id: string, type: ResourceType) {
  const entries = executorKeys[type];
  if (!entries || !Object.hasOwn(entries, id))
    fail("EXECUTOR_NOT_FOUND", `${type}:${String(id)}`);
  return entries[id];
}
export function verifyExecutors(resources: Resource[]) {
  for (const r of resources)
    if (r.status === "available") requireExecutor(r.id, r.type);
  return true;
}
