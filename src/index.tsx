import React from "react";
import { Composition, registerRoot } from "remotion";
import plan from "../examples/cold-opening.json";
import { compileDirectorPlan } from "./engine3d/director";
import { SequenceRenderer } from "./engine3d/renderer";
import type { DirectorPlan, ProceduralSequence } from "./engine3d/contracts";
import { studioSequence } from "./engine3d/studio";
const sequence = compileDirectorPlan(plan as unknown as DirectorPlan);
const presets = {
  DirectorSequence: sequence,
  CharacterPreview: studioSequence("character"),
  ResourcePlayground: studioSequence("prop"),
  EnvironmentPreview: studioSequence("environment"),
  ShotBuilder: {
    ...sequence,
    shots: [{ ...sequence.shots[0], startFrame: 0 }],
    scenes: [],
    totalFrames: 90,
    captions: [],
  },
};
const Root = () => (
  <>
    {Object.entries(presets).map(([id, s]) => (
      <Composition
        key={id}
        id={id}
        component={SequenceRenderer}
        defaultProps={{ sequence: s }}
        durationInFrames={s.totalFrames}
        fps={s.fps}
        width={s.width}
        height={s.height}
        calculateMetadata={({ props }) => {
          const s = props.sequence as ProceduralSequence;
          return {
            durationInFrames: s.totalFrames,
            fps: s.fps,
            width: s.width,
            height: s.height,
          };
        }}
      />
    ))}
  </>
);
registerRoot(Root);
