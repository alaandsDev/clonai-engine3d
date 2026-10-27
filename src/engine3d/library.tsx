import React from "react";
import { Euler, Quaternion, Vector3 } from "three";
import type { Instance, ShotSpec, Vec3, Binding } from "./contracts";
import {
  anchorAt,
  clamp,
  poseAt,
  progress,
  rig,
  seeded,
  smooth,
} from "./motion";
const ink = "#171f33";
export function Ball({
  at = [0, 0, 0],
  scale = [1, 1, 1],
  color = ink,
}: {
  at?: Vec3;
  scale?: Vec3;
  color?: string;
}) {
  return (
    <mesh position={at} scale={scale}>
      <sphereGeometry args={[1, 20, 14]} />
      <meshToonMaterial color={color} />
    </mesh>
  );
}
export function Box({
  at = [0, 0, 0],
  size = [1, 1, 1],
  color = ink,
  rotation = [0, 0, 0],
}: {
  at?: Vec3;
  size?: Vec3;
  color?: string;
  rotation?: Vec3;
}) {
  return (
    <mesh position={at} rotation={rotation}>
      <boxGeometry args={size} />
      <meshToonMaterial color={color} />
    </mesh>
  );
}
function Limb({
  from,
  to,
  color,
  radius = 0.09,
}: {
  from: Vec3;
  to: Vec3;
  color: string;
  radius?: number;
}) {
  const a = new Vector3(...from),
    b = new Vector3(...to),
    delta = b.clone().sub(a);
  const q = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    delta.clone().normalize(),
  );
  return (
    <mesh position={a.add(b).multiplyScalar(0.5)} quaternion={q}>
      <cylinderGeometry args={[radius, radius, delta.length(), 10]} />
      <meshToonMaterial color={color} />
    </mesh>
  );
}
export function Character({
  instance: i,
  shot,
  t,
}: {
  instance: Instance;
  shot: ShotSpec;
  t: number;
}) {
  const pose = poseAt(i, shot, t);
  const lia = i.resourceId.includes("LIA"),
    zombie = i.resourceId.includes("ZOMBIE"),
    robot = i.resourceId.includes("ROBOT"),
    blob = i.resourceId.includes("BLOB"),
    scout = i.resourceId.includes("SCOUT");
  const coat = lia
    ? "#20c4bd"
    : zombie
      ? "#6a8c4c"
      : scout
        ? "#edb631"
        : "#fa3e42";
  const skin = zombie ? "#6d9365" : ink;
  return (
    <group position={pose.position} rotation={i.rotation} scale={i.scale}>
      <group rotation={[pose.lean, 0, 0]}>
        {blob ? (
          <Ball
            at={[0, 1.1, 0]}
            scale={[0.65, 1, 0.5]}
            color={lia ? "#20c4bd" : "#a889ef"}
          />
        ) : (
          <>
            <Ball
              at={rig.chest}
              scale={[0.35, 0.48, 0.22]}
              color={robot ? "#b8ceda" : coat}
            />
            <Box
              at={[0, 1.21, 0.225]}
              size={[0.025, 0.62, 0.012]}
              color="#ffe9ba"
            />
            {[-1, 1].map((side) => (
              <group
                key={side}
                position={[side * 0.19, 0.87, 0]}
                rotation={[side < 0 ? pose.leftLeg : pose.rightLeg, 0, 0]}
              >
                <Limb
                  from={[0, 0, 0]}
                  to={[0, -0.64, 0]}
                  color="#243f70"
                  radius={0.115}
                />
                <Box
                  at={[0, -0.69, 0.08]}
                  size={[0.27, 0.19, 0.43]}
                  color={ink}
                />
              </group>
            ))}
            {pose.leftHandReach ? (
              <>
                <Limb
                  from={[-0.44, 1.48, 0]}
                  to={[
                    -0.44 + pose.leftHandReach[0],
                    1.48 + pose.leftHandReach[1],
                    pose.leftHandReach[2],
                  ]}
                  color={coat}
                />
                <Ball
                  at={[
                    -0.44 + pose.leftHandReach[0],
                    1.48 + pose.leftHandReach[1],
                    pose.leftHandReach[2],
                  ]}
                  scale={[0.13, 0.15, 0.12]}
                />
              </>
            ) : (
              <group
                position={[-0.44, 1.48, 0]}
                rotation={[pose.leftArm, 0, -0.3]}
              >
                <Limb from={[0, 0, 0]} to={[0, -0.57, 0]} color={coat} />
                <Ball at={[0, -0.57, 0]} scale={[0.13, 0.15, 0.12]} />
              </group>
            )}
            {pose.handReach ? (
              <>
                <Limb
                  from={[0.44, 1.48, 0]}
                  to={[
                    0.44 + pose.handReach[0],
                    1.48 + pose.handReach[1],
                    pose.handReach[2],
                  ]}
                  color={coat}
                />
                <Ball
                  at={[
                    0.44 + pose.handReach[0],
                    1.48 + pose.handReach[1],
                    pose.handReach[2],
                  ]}
                  scale={[0.13, 0.15, 0.12]}
                />
              </>
            ) : (
              <group
                position={[0.44, 1.48, 0]}
                rotation={[pose.rightArm, 0, 0.3]}
              >
                <Limb from={[0, 0, 0]} to={[0, -0.57, 0]} color={coat} />
                <Ball at={[0, -0.57, 0]} scale={[0.13, 0.15, 0.12]} />
              </group>
            )}
          </>
        )}
        <group position={rig.head} rotation={[0, pose.headYaw, 0]}>
          {robot ? (
            <Box size={[0.96, 0.83, 0.8]} color="#91b5c8" />
          ) : (
            <Ball scale={[0.56, 0.57, 0.48]} color={skin} />
          )}
          <Ball
            at={[-0.2, 0.06, 0.43]}
            scale={[0.17, 0.23, 0.075]}
            color="white"
          />
          <Ball
            at={[0.2, 0.06, 0.43]}
            scale={[0.17, 0.23, 0.075]}
            color="white"
          />
          {[-1, 1].map((side) => (
            <Ball
              key={side}
              at={[side * 0.2, 0.06, 0.5]}
              scale={[0.065, 0.105, 0.03]}
              color={ink}
            />
          ))}
          <Box
            at={[0, -0.23, 0.465]}
            size={[0.15, 0.035, 0.02]}
            color="#7898aa"
          />
          {lia && (
            <>
              <Ball
                at={[0.46, 0.25, -0.13]}
                scale={[0.26, 0.4, 0.27]}
                color="#613356"
              />
              <Box at={[0, 0.49, 0]} size={[0.7, 0.12, 0.65]} color="#edb631" />
            </>
          )}
          {scout && (
            <Box at={[0, 0.53, 0]} size={[1, 0.14, 0.9]} color="#4e704a" />
          )}
          {robot && (
            <>
              <Limb
                from={[0, 0.4, 0]}
                to={[0, 0.85, 0]}
                color="#a9c8d6"
                radius={0.035}
              />
              <Ball
                at={[0, 0.85, 0]}
                scale={[0.09, 0.09, 0.09]}
                color="#fa3e42"
              />
            </>
          )}
        </group>
      </group>
    </group>
  );
}
export function Prop({
  instance: i,
  shot,
  t,
}: {
  instance: Instance;
  shot: ShotSpec;
  t: number;
}) {
  const id = i.resourceId;
  let open = i.initialState?.openProgress ?? i.parameters?.openProgress ?? 0;
  for (const b of shot.actions)
    if (b.target === i.instanceId && b.resourceId.includes("OPEN_DOOR"))
      open = Math.max(open, smooth(progress(b, t)));
  let content: React.ReactNode;
  if (id.includes("DOOR"))
    content = (
      <>
        <Box at={[-0.62, 1.2, 0]} size={[0.18, 2.5, 0.22]} color="#c5a56e" />
        <Box at={[0.62, 1.2, 0]} size={[0.18, 2.5, 0.22]} color="#c5a56e" />
        <Box at={[0, 2.43, 0]} size={[1.42, 0.18, 0.22]} color="#c5a56e" />
        <group position={[-0.52, 0, 0]} rotation={[0, -open * 1.5, 0]}>
          <Box at={[0.52, 1.2, 0]} size={[1.04, 2.36, 0.12]} color="#247b8c" />
          <Box
            at={[0.52, 1.53, 0.07]}
            size={[0.77, 0.91, 0.035]}
            color="#73c5d5"
          />
          <Box
            at={[0.52, 0.48, 0.07]}
            size={[0.76, 0.57, 0.04]}
            color="#186071"
          />
          <Ball
            at={[0.83, 1.05, 0.1]}
            scale={[0.075, 0.075, 0.065]}
            color="#ffca58"
          />
        </group>
      </>
    );
  else if (id.includes("THERMOMETER")) {
    const val = i.parameters?.value ?? 0;
    content = (
      <>
        <Box at={[0, 0.6, 0]} size={[0.3, 1.2, 0.1]} color="#ecf1ed" />
        <Box at={[0, 0.63, 0.07]} size={[0.06, 0.8, 0.03]} color="#a1c6d4" />
        <Box
          at={[0, 0.3 + clamp((val + 100) / 150) * 0.4, 0.09]}
          size={[0.065, clamp((val + 100) / 150) * 0.8, 0.03]}
          color="#ff4b59"
        />
        <Ball at={[0, 0.15, 0.08]} scale={[0.12, 0.12, 0.06]} color="#ff4b59" />
      </>
    );
  } else if (id.includes("BOTTLE"))
    content = (
      <>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.1, 0.13, 0.5, 12]} />
          <meshToonMaterial color="#3fc6b5" />
        </mesh>
        <Box at={[0, 0.6, 0]} size={[0.14, 0.12, 0.14]} color="#e2f6ed" />
      </>
    );
  else if (id.includes("MAP"))
    content = (
      <>
        <Box size={[0.7, 0.03, 0.5]} color="#f4d69e" />
        {[-0.2, 0, 0.2].map((x) => (
          <Box
            key={x}
            at={[x, 0.02, 0]}
            size={[0.02, 0.01, 0.42]}
            color="#499590"
          />
        ))}
      </>
    );
  else if (id.includes("CROWBAR") || id.includes("HATCHET"))
    content = (
      <>
        <Box at={[0, 0.45, 0]} size={[0.07, 0.9, 0.07]} color="#8f9ead" />
        <Box
          at={[0.12, 0.85, 0]}
          size={[id.includes("HATCHET") ? 0.4 : 0.24, 0.16, 0.1]}
          color="#b3c8d1"
        />
      </>
    );
  else if (id.includes("LANTERN") || id.includes("FLASHLIGHT"))
    content = (
      <>
        <Box at={[0, 0.25, 0]} size={[0.23, 0.5, 0.23]} color="#e4b447" />
        <Ball at={[0, 0.52, 0]} scale={[0.17, 0.16, 0.17]} color="#fff0aa" />
      </>
    );
  else if (id.includes("MICROPHONE"))
    content = (
      <>
        <Box at={[0, 0.2, 0]} size={[0.08, 0.4, 0.08]} />
        <Ball at={[0, 0.46, 0]} scale={[0.16, 0.2, 0.16]} color="#a1bbc5" />
      </>
    );
  else if (id.includes("BACKPACK"))
    content = (
      <>
        <Ball at={[0, 0.35, 0]} scale={[0.32, 0.4, 0.16]} color="#c88a35" />
        <Box at={[0, 0.27, 0.17]} size={[0.42, 0.3, 0.08]} color="#ad652e" />
      </>
    );
  else if (id.includes("MEDKIT"))
    content = (
      <>
        <Box at={[0, 0.25, 0]} size={[0.6, 0.45, 0.22]} color="#edf6ef" />
        <Box at={[0, 0.25, 0.12]} size={[0.3, 0.09, 0.025]} color="#f34553" />
        <Box at={[0, 0.25, 0.13]} size={[0.09, 0.3, 0.025]} color="#f34553" />
      </>
    );
  else if (id.includes("PHONE"))
    content = (
      <>
        <Box at={[0, 0.25, 0]} size={[0.23, 0.46, 0.045]} />
        <Box at={[0, 0.27, 0.027]} size={[0.19, 0.35, 0.01]} color="#66d4d7" />
      </>
    );
  else if (id.includes("CAMERA"))
    content = (
      <>
        <Box at={[0, 0.22, 0]} size={[0.5, 0.32, 0.2]} color="#42566d" />
        <Ball at={[0, 0.22, 0.15]} scale={[0.14, 0.14, 0.1]} color="#73c5d5" />
      </>
    );
  else
    content = (
      <>
        <Box at={[0, 0.25, 0]} size={[0.45, 0.5, 0.22]} color="#536b54" />
        <Box at={[0, 0.35, 0.12]} size={[0.3, 0.13, 0.02]} color="#f2d37d" />
        <Limb
          from={[0.15, 0.5, 0]}
          to={[0.2, 0.9, 0]}
          color={ink}
          radius={0.018}
        />
      </>
    );
  return (
    <group position={i.position} rotation={i.rotation} scale={i.scale}>
      {content}
    </group>
  );
}
const envColors: Record<string, [string, string]> = {
  WINTER: ["#b4d5e5", "#ebf3f1"],
  SPACE: ["#101c42", "#283657"],
  LAB: ["#a9dcd9", "#d9e8e7"],
  FOREST: ["#9cc6b1", "#71996e"],
  OCEAN: ["#99d8e5", "#2794b1"],
  CITY: ["#bfd1d8", "#768b99"],
  RUINED_STREET: ["#a4a697", "#6a706a"],
  SHELTER: ["#816f66", "#a28b72"],
  DEAD_FOREST: ["#9ba4a0", "#777b70"],
};
export function Environment({ id }: { id: string }) {
  const name = id.slice(4, -4);
  const [bg, ground] = envColors[name];
  const forest = name.includes("FOREST") || name === "WINTER";
  return (
    <>
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, 12, 28]} />
      <ambientLight intensity={1.3} />
      <directionalLight
        position={[-4, 8, 5]}
        intensity={2.2}
        color={name === "WINTER" ? "#d6f2ff" : "#fff1da"}
      />
      <directionalLight position={[4, 3, -2]} intensity={1.2} color="#9abddd" />
      <Box at={[0, -0.15, 0]} size={[100, 0.25, 100]} color={ground} />
      {forest ? (
        Array.from({ length: 12 }, (_, n) => {
          const x = (n % 2 ? -1 : 1) * (2.8 + seeded(n + 4) * 4),
            z = -2 - seeded(n + 9) * 10;
          return (
            <group key={n} position={[x, 0, z]}>
              <Box at={[0, 1, 0]} size={[0.18, 2, 0.18]} color="#5f7274" />
              {name !== "DEAD_FOREST" &&
                [0, 1, 2].map((k) => (
                  <mesh key={k} position={[0, 1.1 + k * 0.55, 0]}>
                    <coneGeometry args={[0.9 - k * 0.18, 1.5, 7]} />
                    <meshToonMaterial
                      color={name === "WINTER" ? "#cee5e7" : "#326b58"}
                    />
                  </mesh>
                ))}
            </group>
          );
        })
      ) : name === "CITY" || name === "RUINED_STREET" ? (
        Array.from({ length: 10 }, (_, n) => (
          <Box
            key={n}
            at={[
              (n % 2 ? -1 : 1) * (3 + seeded(n) * 4),
              1.5,
              -2 - Math.floor(n / 2) * 2,
            ]}
            size={[
              1.3,
              name === "CITY" ? 3 + seeded(n) * 4 : 1 + seeded(n) * 2,
              1.4,
            ]}
            color={n % 2 ? "#718c9b" : "#93a9ad"}
          />
        ))
      ) : name === "LAB" || name === "SHELTER" ? (
        <>
          <Box at={[0, 2, -4]} size={[12, 4, 0.2]} color={bg} />
          <Box at={[2, 1, -2]} size={[2, 0.15, 1]} color="#455f6c" />
        </>
      ) : name === "SPACE" ? (
        Array.from({ length: 30 }, (_, n) => (
          <Ball
            key={n}
            at={[
              (seeded(n) - 0.5) * 22,
              seeded(n + 70) * 10,
              -7 - seeded(n + 100) * 10,
            ]}
            scale={[0.035, 0.035, 0.035]}
            color="white"
          />
        ))
      ) : null}
    </>
  );
}
export function Vfx({
  binding: b,
  shot,
  t,
}: {
  binding: Binding;
  shot: ShotSpec;
  t: number;
}) {
  if (t < b.start || t > b.end) return null;
  const p = progress(b, t);
  const actor = shot.characters.find((c) => c.instanceId === b.actor);
  const target = shot.props.find((c) => c.instanceId === b.target);
  const at: Vec3 = actor
    ? anchorAt(actor, shot, t, b.anchor ?? "face")
    : (target?.position ?? [0, 0, 0]);
  if (b.resourceId.includes("SNOW"))
    return (
      <>
        {Array.from(
          { length: Math.round(80 * (b.parameters?.intensity ?? 0.6)) },
          (_, n) => (
            <Ball
              key={n}
              at={[
                (seeded(n) - 0.5) * 10,
                (((seeded(n + 80) * 7 - t * 4) % 7) + 7) % 7,
                (seeded(n + 160) - 0.5) * 8,
              ]}
              scale={[0.026, 0.026, 0.026]}
              color="#ffffff"
            />
          ),
        )}
      </>
    );
  if (b.resourceId.includes("COLD_BREATH"))
    return (
      <group position={at}>
        {Array.from({ length: 5 }, (_, n) => {
          const age = (p * 3 + n / 5) % 1;
          return (
            <mesh
              key={n}
              position={[age * 0.4, age * 0.2, 0.1 + age * 0.65]}
              scale={[0.04 + age * 0.14, 0.03 + age * 0.08, 0.05 + age * 0.16]}
            >
              <sphereGeometry args={[1, 10, 8]} />
              <meshBasicMaterial
                color="#e8faff"
                transparent
                opacity={(1 - age) * 0.3}
                depthWrite={false}
              />
            </mesh>
          );
        })}
      </group>
    );
  return (
    <group position={at}>
      {Array.from({ length: 10 }, (_, n) => (
        <group
          key={n}
          position={[
            (seeded(n) - 0.5) * 0.75,
            (seeded(n + 30) - 0.5) * 0.35,
            0.04,
          ]}
          rotation={[0, 0, n * 0.8]}
          scale={Math.max(0.1, smooth(p))}
        >
          <Box size={[0.018, 0.14, 0.025]} color="#c7faff" />
          <Box size={[0.12, 0.018, 0.025]} color="#c7faff" />
        </group>
      ))}
    </group>
  );
}
