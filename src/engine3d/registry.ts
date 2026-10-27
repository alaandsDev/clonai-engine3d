import {
  fail,
  type Resource,
  type ResourceType,
  type Anchor,
} from "./contracts";
const human = ["CHAR_CAIO_001", "CHAR_LIA_001"];
const definitions: Record<string, string[]> = {
  character: ["ROBOT", "BLOB", "SCOUT", "CAIO", "LIA", "ZOMBIE"],
  environment: [
    "SPACE",
    "LAB",
    "FOREST",
    "OCEAN",
    "CITY",
    "RUINED_STREET",
    "SHELTER",
    "DEAD_FOREST",
    "WINTER",
  ],
  prop: [
    "PHONE",
    "FLASHLIGHT",
    "MICROPHONE",
    "CAMERA",
    "RADIO",
    "BACKPACK",
    "MEDKIT",
    "BOTTLE",
    "MAP",
    "CROWBAR",
    "HATCHET",
    "LANTERN",
    "DOOR",
    "THERMOMETER",
  ],
  action: [
    "IDLE",
    "WAVE",
    "JUMP",
    "DANCE",
    "THINK",
    "WALK",
    "OPEN_DOOR",
    "POINT",
    "LOOK",
    "RUN",
  ],
  camera: [
    "PUSH_IN",
    "PULL_OUT",
    "ORBIT",
    "PAN_LEFT",
    "PAN_RIGHT",
    "SHAKE",
    "STATIC",
  ],
  vfx: ["SNOW", "COLD_BREATH", "FROST"],
};
const prefixes: Record<string, string> = {
  character: "CHAR",
  environment: "ENV",
  prop: "PROP",
  action: "ACTION",
  camera: "CAM",
  vfx: "VFX",
};
export const resources: Resource[] = Object.entries(definitions).flatMap(
  ([type, names]) =>
    names.map((name) => {
      const parameters: Resource["metadata"]["parameters"] =
        name === "DOOR"
          ? { openProgress: { min: 0, max: 1 } }
          : name === "THERMOMETER"
            ? { value: { min: -150, max: 150 } }
            : name === "SNOW"
              ? { intensity: { min: 0, max: 1 } }
              : type === "camera"
                ? { strength: { min: 0, max: 3 } }
                : {};
      const advanced = ["OPEN_DOOR", "POINT", "LOOK", "RUN"].includes(name);
      return {
        id: `${prefixes[type]}_${name}_001`,
        type: type as ResourceType,
        name,
        description: `Procedural ${type}: ${name.toLowerCase().replaceAll("_", " ")}`,
        tags: [type, ...name.toLowerCase().split("_")],
        status: "available",
        source: "procedural",
        capabilities: [
          name.toLowerCase(),
          ...(type === "character" ? ["pose"] : []),
        ],
        metadata: {
          parameters,
          performanceClass: name === "SNOW" ? "medium" : "light",
          ...(type === "action"
            ? {
                compatibleCharacters: advanced
                  ? human
                  : definitions.character
                      .filter(
                        (n) =>
                          !(["WAVE", "THINK"].includes(name) && n === "BLOB"),
                      )
                      .map((n) => `CHAR_${n}_001`),
              }
            : {}),
          ...(type === "character"
            ? {
                anchors: (name === "BLOB"
                  ? ["head", "face", "chest"]
                  : [
                      "head",
                      "face",
                      "leftHand",
                      "rightHand",
                      "chest",
                    ]) as Anchor[],
              }
            : {}),
        },
      };
    }),
);
export class Registry {
  constructor(public entries: Resource[] = resources) {
    if (new Set(entries.map((r) => r.id)).size !== entries.length)
      fail("DUPLICATE_RESOURCE_ID", "registry");
  }
  getById(id: string) {
    return this.entries.find((r) => r.id === id);
  }
  has(id: string) {
    return !!this.getById(id);
  }
  listByType(type: ResourceType) {
    return this.entries.filter((r) => r.type === type);
  }
  searchByTags(tags: string[]) {
    return this.entries.filter((r) => tags.every((t) => r.tags.includes(t)));
  }
  resolve(
    id: string,
    type?: ResourceType,
  ):
    | { ok: true; resource: Resource }
    | { ok: false; reason: "NOT_FOUND" | "UNSUPPORTED" | "DEPRECATED" } {
    const r = this.getById(id);
    return !r
      ? { ok: false, reason: "NOT_FOUND" }
      : r.status === "deprecated"
        ? { ok: false, reason: "DEPRECATED" }
        : type && r.type !== type
          ? { ok: false, reason: "UNSUPPORTED" }
          : { ok: true, resource: r };
  }
}
export const registry = new Registry();
export const supportsAnchor = (id: string, anchor: Anchor) =>
  registry.getById(id)?.metadata.anchors?.includes(anchor) ?? false;
