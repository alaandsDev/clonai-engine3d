import React, { useMemo } from "react";
import { resolveShot } from "./validation";
import { validateSequence } from "./sequence-validation";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import type { ProceduralSequence, ShotSpec } from "./contracts";
import { cameraAt } from "./motion";
import type { Pose } from "./motion";
import type { CameraState } from "./directed";
import type {EnvironmentState} from './demonstration-contracts';
import {ContactShadow,type EnvironmentStyle} from './assemblies';
import { Character, Environment, Prop, Vfx } from "./library";
import { COMPOSITION_Z } from "../composition-layers";
function Camera({ shot, t, state }: { shot: ShotSpec; t: number; state?: CameraState }) {
  const { camera } = useThree();
  const c = state ?? cameraAt(
    shot.camera.resourceId,
    t,
    shot.camera.parameters?.strength ?? 1,
  );
  camera.position.set(...c.position);
  camera.lookAt(...c.target);
  camera.updateMatrixWorld();
  return null;
}
export function ProceduralShot({ shot: input, directed,worldExtras,environmentState,environmentStyle }: { shot: ShotSpec; directed?: {camera:CameraState;poses:Record<string,Pose>;visibleProps:Record<string,boolean>;presenterVisible?:boolean;propHighlights?:Record<string,number>};worldExtras?:React.ReactNode;environmentState?:EnvironmentState;environmentStyle?:EnvironmentStyle }) {
  const shot = useMemo(() => {
    const { sceneId, startFrame, endFrame, durationFrames, ...spec } =
      input as ShotSpec & Record<string, unknown>;
    return resolveShot(spec);
  }, [input]);
  const frame = useCurrentFrame(),
    { fps, width, height } = useVideoConfig();
  const t = Math.min(
    1,
    frame / Math.max(1, Math.round(shot.durationSeconds * fps) - 1),
  );
  return (
    <AbsoluteFill>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 44, position: [0, 2.1, 7.4] }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        <Camera shot={shot} t={t} state={directed?.camera}/>
        <Environment id={shot.environment.resourceId} state={environmentState} style={environmentStyle}/>
        {worldExtras}
        {shot.characters.filter(()=>directed?.presenterVisible!==false).map((i) => (
          <React.Fragment key={i.instanceId}>{environmentStyle&&directed?.poses[i.instanceId]&&<ContactShadow at={[directed.poses[i.instanceId].position[0],0,directed.poses[i.instanceId].position[2]]} radius={0.42*(i.scale?.[0]??1)} opacity={0.3}/>}<Character instance={i} shot={shot} t={t} directedPose={directed?.poses[i.instanceId]}/></React.Fragment>
        ))}
        {shot.props.filter(i=>directed?.visibleProps[i.instanceId]!==false).map((i) => (
          <Prop key={i.instanceId} instance={i} shot={shot} t={t} highlight={directed?.propHighlights?.[i.instanceId]??0}/>
        ))}
        {shot.vfx.map((b, n) => (
          <Vfx key={n} binding={b} shot={shot} t={t} />
        ))}
      </ThreeCanvas>
      {shot.onScreenText && (
        <div
          style={{
            position: "absolute",
            top: "9%",
            zIndex: COMPOSITION_Z.TEXT,
            left: "8%",
            right: "8%",
            color: "white",
            fontFamily: "Trebuchet MS",
            fontSize: 30,
            fontWeight: 900,
            textAlign: "center",
            textShadow: "0 2px 6px #12263b",
          }}
        >
          {shot.onScreenText}
        </div>
      )}
      {shot.props
        .filter((p) => p.resourceId === "PROP_THERMOMETER_001" && directed?.visibleProps[p.instanceId]!==false)
        .map((p) => (
          <div
            key={p.instanceId}
            style={{
              position: "absolute",
              top: "18%",
              zIndex: COMPOSITION_Z.TEXT,
              right: "8%",
              color: "white",
              background: "#13283c",
              padding: 14,
              borderRadius: 12,
              fontSize: 30,
              fontFamily: "Trebuchet MS",
            }}
          >
            {p.parameters?.value ?? 0}°C
          </div>
        ))}
    </AbsoluteFill>
  );
}
export function SequenceRenderer({
  sequence: input,
  editorialLayers,
  world,
}: {
  sequence: ProceduralSequence;
  editorialLayers?: React.ReactNode;
  world?: React.ReactNode;
}) {
  const sequence = useMemo(() => validateSequence(input), [input]);
  const frame = useCurrentFrame();
  const cue = sequence.captions.find(
    (c) => frame >= c.startFrame && frame < c.endFrame,
  );
  return (
    <AbsoluteFill style={{ background: "#bed7e4", isolation: "isolate" }}>
      {world ?? sequence.shots.map((s) => (
        <Sequence
          key={s.id}
          from={s.startFrame}
          durationInFrames={s.durationFrames}
        >
          <ProceduralShot shot={s} />
        </Sequence>
      ))}
      {sequence.scenes
        .filter((s) => s.audio)
        .map((s) => (
          <Sequence
            key={s.id}
            from={s.startFrame}
            durationInFrames={s.durationFrames}
          >
            <Audio src={staticFile(s.audio!.relativeAudioPath)} />
          </Sequence>
        ))}
      {editorialLayers}
      {cue && (
        <div
          style={{
            position: "absolute",
            bottom: "13%",
            zIndex: COMPOSITION_Z.CAPTION,
            left: "7%",
            right: "7%",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "rgba(13,26,41,.9)",
              borderRadius: 18,
              padding: "14px 20px",
              color: "#fff",
              fontFamily: "Trebuchet MS",
              fontSize: 32,
              lineHeight: 1.2,
              fontWeight: 900,
              textAlign: "center",
              boxShadow: "0 4px 15px #10243744",
            }}
          >
            {cue.text}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
}
