import type { DirectorPlan, ShotSpec } from "../../src/engine3d/contracts";
export const shotFixture = (): ShotSpec => ({
  id: "regression-shot",
  durationSeconds: 2,
  environment: { resourceId: "ENV_WINTER_001" },
  characters: [
    {
      instanceId: "actor",
      resourceId: "CHAR_LIA_001",
      position: [0.7, 0, 0.1],
    },
  ],
  props: [
    {
      instanceId: "door",
      resourceId: "PROP_DOOR_001",
      position: [-0.4, 0, 0],
      scale: [0.9, 0.9, 0.9],
    },
  ],
  actions: [
    {
      resourceId: "ACTION_OPEN_DOOR_001",
      actor: "actor",
      target: "door",
      start: 0,
      end: 1,
    },
  ],
  vfx: [],
  camera: { resourceId: "CAM_STATIC_001" },
});
export const planFixture = (): DirectorPlan => {
  const { environment, characters, ...shot } = shotFixture();
  return {
    id: "hardening-proof",
    title: "Prova independente",
    format: { width: 480, height: 854, fps: 30 },
    style: "stylized-cartoon",
    timingMode: "fixed",
    cast: { guide: "CHAR_LIA_001" },
    scenes: [
      {
        id: "scene",
        order: 1,
        narration: "Lia observa o frio.",
        environment,
        shots: [
          {
            ...shot,
            order: 1,
            characters: characters.map(({ resourceId, ...c }) => ({
              ...c,
              castId: "guide",
            })),
          },
        ],
      },
    ],
  };
};
