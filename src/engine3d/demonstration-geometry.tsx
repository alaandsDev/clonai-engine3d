import React from 'react';
import { Vector3, Quaternion, Color } from 'three';
import type { Vec3 } from './contracts';
import type { DemonstrationProgram, DemonstrationState } from './demonstration-contracts';
import { pathAt } from './demonstration-runtime';
import { AssemblyGeometry, ContactShadow, type AssemblyContext, type EnvironmentStyle } from './assemblies';
/** Stylized environment style derived from a program: active only when some subject declares an assembly,
 * so legacy demonstrations render unchanged. The ground opening follows the terrain section footprint. */
export function environmentStyleOf(program: DemonstrationProgram | undefined, state: DemonstrationState | undefined): EnvironmentStyle | undefined {
    if (!program || !state || !program.subjects.some(s => s.assembly)) return;
    // A radiant source on stage sets the time of day: the sky darkens as it fades and stays dark once it is gone.
    const src = program.subjects.find(s => s.assembly === 'RADIANT_SOURCE'), ss = src ? state.subjects[src.id] : undefined;
    const night = ss ? (ss.visible ? 1 - Math.max(0, Math.min(1, ss.parameters.activity ?? 1)) : 1) : 0, nt = night > 0 ? { night } : {};
    const setting = program.subjects.some(s => s.assembly === 'CLOUD_FIELD') ? 'SKY' as const : program.subjects.some(s => s.assembly === 'WATER_SURFACE') ? 'WATER' as const : program.subjects.some(s => s.assembly === 'INTERIOR_ROOM') ? 'INDOOR' as const : undefined;
    if (setting) return { stylized: true, setting, ...nt };
    const terrain = program.subjects.find(s => s.assembly === 'TERRAIN_SECTION' && state.subjects[s.id]?.visible);
    if (!terrain) return { stylized: true, ...nt };
    const p = state.subjects[terrain.id].position, [w, , d] = terrain.size;
    return { stylized: true, hole: { x: [p[0] - w / 2, p[0] + w / 2], z: [p[2] - d / 2, p[2] + d / 2] }, cut: state.environment.groundCutaway, ...nt };
}
function Tube({ from, to, radius, color, opacity = 1 }: {
    from: Vec3;
    to: Vec3;
    radius: number;
    color: string;
    opacity?: number;
}) { const a = new Vector3(...from), b = new Vector3(...to), delta = b.clone().sub(a), length = delta.length(); if (length < .00001)
    return null; return <mesh position={a.add(b).multiplyScalar(.5)} quaternion={new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize())}><cylinderGeometry args={[radius, radius, length, 10]}/><meshToonMaterial color={color} transparent={opacity < 1} opacity={opacity}/></mesh>; }
function PartialPath({ points, progress, radius, color, opacity = 1 }: {
    points: Vec3[];
    progress: number;
    radius: number;
    color: string;
    opacity?: number;
}) { const lengths = points.slice(1).map((p, i) => new Vector3(...p).distanceTo(new Vector3(...points[i]))), total = lengths.reduce((a, b) => a + b, 0); let distance = 0; return <>{lengths.map((length, i) => { const start = distance / total; distance += length; const amount = Math.max(0, Math.min(1, (progress - start) / (length / total))); return amount > 0 ? <Tube key={i} from={points[i]} to={points[i].map((v, k) => v + (points[i + 1][k] - v) * amount) as Vec3} radius={radius} color={color} opacity={opacity}/> : null; })}</>; }
/** Primitive meshes inside the existing ThreeCanvas, not an alternate video renderer. */
export function DemonstrationGeometry({ program, state, frame = 0, fps = 30 }: {
    program: DemonstrationProgram;
    state: DemonstrationState;
    frame?: number;
    fps?: number;
}) {
    const ctx: AssemblyContext = { frame, fps, cutaway: state.environment.groundCutaway, flowing: program.subjects.some(sub => sub.kind === 'PATH' && (state.subjects[sub.id]?.parameters.flowProgress ?? 0) > 0) };
    return <>{program.subjects.filter(s => s.kind !== 'PROP').map(sub => {
            const s = state.subjects[sub.id];
            if (!s.visible)
                return null;
            if (sub.assembly)
                return <group key={sub.id} position={s.position} rotation={s.rotation} scale={s.scale}>
                    {(sub.assembly === 'GABLED_BUILDING' || sub.assembly === 'OPEN_BASIN' || sub.assembly === 'VANE_RING' || sub.assembly === 'RAISED_GROUND' || sub.assembly === 'DISPLAY_BLOCK' || sub.assembly === 'FLAME') && s.position[1] - sub.size[1] / 2 < 0.05 && <ContactShadow at={[0, -sub.size[1] / 2, 0]} radius={Math.max(sub.size[0], sub.size[2]) * 0.85} />}
                    <AssemblyGeometry sub={sub} s={s} ctx={ctx} /></group>;
            const highlight = s.parameters.highlight ?? 0, color = '#' + new Color(sub.color).lerp(new Color('#ffffff'), highlight).getHexString();
            return <group key={sub.id} position={s.position} rotation={s.rotation} scale={s.scale.map(v => v * (1 + highlight * .1)) as Vec3}>
 {sub.kind === 'BOX' || sub.kind === 'LAYER' ? <mesh><boxGeometry args={sub.size}/><meshToonMaterial color={color}/></mesh> : sub.kind === 'CYLINDER' ? <>
 <mesh><cylinderGeometry args={[sub.size[0] / 2, sub.size[0] / 2, sub.size[1], 16, 1, true]}/><meshToonMaterial color={color} transparent opacity={.25} side={2} depthWrite={false}/></mesh>
 <mesh position={[0, -sub.size[1] / 2 + .025, 0]}><cylinderGeometry args={[sub.size[0] / 2, sub.size[0] / 2, .05, 16]}/><meshToonMaterial color={color}/></mesh>
 {(s.parameters.fillLevel ?? 0) > 0 && <mesh position={[0, -sub.size[1] / 2 + sub.size[1] * (s.parameters.fillLevel ?? 0) / 2, 0]}><cylinderGeometry args={[sub.size[0] * .46, sub.size[0] * .46, sub.size[1] * (s.parameters.fillLevel ?? 0), 16]}/><meshToonMaterial color="#208fdb" transparent opacity={.88}/></mesh>}
 </> : sub.kind === 'PATH' ? <>
 <PartialPath points={sub.path!} progress={s.parameters.connection ?? 0} radius={sub.size[0]} color={color} opacity={.27}/>
 <PartialPath points={s.parameters.direction === -1 ? [...sub.path!].reverse() : sub.path!} progress={Math.min(s.parameters.connection ?? 0, s.parameters.flowProgress ?? 0)} radius={sub.size[0] * .7 * (s.parameters.amount ?? 1)} color="#1ba7ee"/>
 </> : null}</group>;
        })}</>;
}
