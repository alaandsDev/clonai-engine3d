import React from "react";
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
import { Character, Environment, Prop, Vfx } from "./library";
function Camera({ shot, t }: { shot: ShotSpec; t: number }) {
  const { camera } = useThree();
  const c = cameraAt(
    shot.camera.resourceId,
    t,
    shot.camera.parameters?.strength ?? 1,
  );
  camera.position.set(...c.position);
  camera.lookAt(...c.target);
  camera.updateMatrixWorld();
  return null;
}
export function ProceduralShot({ shot }: { shot: ShotSpec }) {
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
        <Camera shot={shot} t={t} />
        <Environment id={shot.environment.resourceId} />
        {shot.characters.map((i) => (
          <Character key={i.instanceId} instance={i} shot={shot} t={t} />
        ))}
        {shot.props.map((i) => (
          <Prop key={i.instanceId} instance={i} shot={shot} t={t} />
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
        .filter((p) => p.resourceId.includes("THERMOMETER"))
        .map((p) => (
          <div
            key={p.instanceId}
            style={{
              position: "absolute",
              top: "18%",
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
  sequence,
}: {
  sequence: ProceduralSequence;
}) {
  const frame = useCurrentFrame();
  const cue = sequence.captions.find(
    (c) => frame >= c.startFrame && frame < c.endFrame,
  );
  return (
    <AbsoluteFill style={{ background: "#bed7e4" }}>
      {sequence.shots.map((s) => (
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
      {cue && (
        <div
          style={{
            position: "absolute",
            bottom: "13%",
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
