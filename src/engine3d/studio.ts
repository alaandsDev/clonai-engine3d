import { registry } from "./registry";
import { resolveShot } from "./validation";
import type { ProceduralSequence, ShotSpec } from "./contracts";
export function studioSequence(
  type: "character" | "environment" | "prop",
): ProceduralSequence {
  const shots = registry.listByType(type).map((r, n) => {
    const spec: ShotSpec = {
      id: r.id,
      durationSeconds: 3,
      environment: {
        resourceId: type === "environment" ? r.id : "ENV_LAB_001",
      },
      characters:
        type === "character"
          ? [{ instanceId: "preview", resourceId: r.id }]
          : [],
      props:
        type === "prop"
          ? [
              {
                instanceId: "preview",
                resourceId: r.id,
                position: [0, r.id === "PROP_DOOR_001" ? 0 : 0.8, 0],
                scale: r.id === "PROP_DOOR_001" ? [1, 1, 1] : [2, 2, 2],
                parameters:
                  r.id === "PROP_THERMOMETER_001" ? { value: -68 } : undefined,
              },
            ]
          : [],
      actions:
        type === "character"
          ? [
              {
                resourceId:
                  r.id === "CHAR_BLOB_001"
                    ? "ACTION_JUMP_001"
                    : "ACTION_WAVE_001",
                actor: "preview",
                start: 0,
                end: 1,
              },
            ]
          : [],
      vfx: [],
      camera: { resourceId: "CAM_ORBIT_001", parameters: { strength: 0.3 } },
      onScreenText: r.id,
    };
    return {
      ...resolveShot(spec),
      sceneId: "preview",
      startFrame: n * 90,
      endFrame: (n + 1) * 90,
      durationFrames: 90,
    };
  });
  return {
    id: type,
    title: type,
    fps: 30,
    width: 480,
    height: 854,
    totalFrames: shots.length * 90,
    totalDuration: shots.length * 3,
    shots,
    scenes: [],
    captions: [],
  };
}
