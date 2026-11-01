import React from 'react';
import { BackSide, DoubleSide, Quaternion, Vector3 } from 'three';
import type { Vec3 } from './contracts';
import type { DemonstrationSubject, SubjectState } from './demonstration-contracts';
/** Phase29 motion assemblies: generic vehicle bodies, vehicle parts, invisible-concept manifestations and
 * medium fields (sky, water, road) that stream past a body to convey speed. Forward = +X, up = +Y.
 * Deterministic: animation depends only on frame and the subject's parameters (activity, fillLevel). */
export interface MotionContext { frame: number; fps: number }
const OUTLINE = '#26303a';
const seeded = (n: number) => { const x = Math.sin(n * 91.7 + 47.3) * 43758.5453; return x - Math.floor(x); };
const wrap = (v: number, span: number) => ((v % span) + span) % span - span / 2;
function Box({ at, size, color, rotation, outline = false }: { at: Vec3; size: Vec3; color: string; rotation?: Vec3; outline?: boolean }) {
    return <group position={at} rotation={rotation}>
        <mesh><boxGeometry args={size} /><meshToonMaterial color={color} /></mesh>
        {outline && <mesh scale={[1.03, 1.06, 1.03]}><boxGeometry args={size} /><meshBasicMaterial color={OUTLINE} side={BackSide} /></mesh>}
    </group>;
}
/** Streamlined body (aircraft, rocket, submarine): capsule along X with nose, tapered tail, fin, windows and a stripe. */
function Fuselage({ sub }: { sub: DemonstrationSubject }) {
    const [L, D] = sub.size, r = D / 2, body = L * 0.62, stripe = sub.color;
    return <>
        <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[r, r, body, 28]} /><meshToonMaterial color="#f4f6f8" /></mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} scale={[1.03, 1.0, 1.03]}><cylinderGeometry args={[r, r, body, 28]} /><meshBasicMaterial color={OUTLINE} side={BackSide} /></mesh>
        <mesh position={[body / 2, 0, 0]} scale={[1.6, 1, 1]}><sphereGeometry args={[r, 24, 16, 0, Math.PI * 2, 0, Math.PI]} /><meshToonMaterial color="#f4f6f8" /></mesh>
        <mesh position={[-body / 2 - L * 0.12, r * 0.25, 0]} rotation={[0, 0, Math.PI / 2 - 0.12]}><cylinderGeometry args={[r * 0.35, r, L * 0.26, 24]} /><meshToonMaterial color="#eef1f4" /></mesh>
        <Box at={[-body / 2 - L * 0.16, r * 1.25, 0]} size={[L * 0.16, r * 1.8, 0.06]} rotation={[0, 0, -0.45]} color={stripe} outline />
        <Box at={[-body / 2 - L * 0.17, r * 0.35, 0]} size={[L * 0.1, 0.05, r * 3.2]} color="#dfe4e8" outline />
        <Box at={[0, -r * 0.18, 0]} size={[body * 1.01, r * 0.18, D * 1.005]} color={stripe} />
        {Array.from({ length: 12 }, (_, i) => [-1, 1].map(s => <Box key={i + '' + s} at={[body * (0.38 - i * 0.065), r * 0.28, s * r * 0.97]} size={[r * 0.18, r * 0.24, 0.02]} color="#2a3b4f" />))}
        <Box at={[body / 2 + r * 0.45, r * 0.45, 0]} size={[r * 0.5, r * 0.28, r * 1.3]} rotation={[0, 0, -0.5]} color="#2a3b4f" />
    </>;
}
/** Hull (boat): tapered bow, deck and cabin. */
function Hull({ sub }: { sub: DemonstrationSubject }) {
    const [L, H, W] = sub.size;
    return <>
        <Box at={[-L * 0.1, -H * 0.25, 0]} size={[L * 0.8, H * 0.5, W]} color={sub.color} outline />
        <mesh position={[L * 0.38, -H * 0.25, 0]} rotation={[0, Math.PI / 4, 0]}><boxGeometry args={[W * 0.71, H * 0.5, W * 0.71]} /><meshToonMaterial color={sub.color} /></mesh>
        <Box at={[0, H * 0.02, 0]} size={[L * 0.95, 0.06, W * 0.98]} color="#c79a62" />
        <Box at={[-L * 0.15, H * 0.3, 0]} size={[L * 0.35, H * 0.5, W * 0.7]} color="#f4f6f8" outline />
    </>;
}
/** Car body: lower body, cabin with windows, four wheels that spin with the medium speed. */
function CarBody({ sub, ctx }: { sub: DemonstrationSubject; ctx: MotionContext }) {
    const [L, H, W] = sub.size, spin = -ctx.frame / ctx.fps * 9;
    return <>
        <Box at={[0, -H * 0.05, 0]} size={[L, H * 0.45, W]} color={sub.color} outline />
        <Box at={[-L * 0.08, H * 0.32, 0]} size={[L * 0.55, H * 0.36, W * 0.9]} color="#2a3b4f" outline />
        {[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([x, z], i) => <mesh key={i} position={[x * L * 0.32, -H * 0.3, z * W * 0.5]} rotation={[Math.PI / 2, spin, 0]}><cylinderGeometry args={[H * 0.24, H * 0.24, 0.16, 16]} /><meshToonMaterial color="#1e2328" /></mesh>)}
    </>;
}
/** Lifting surface pair (wings, fins, hydrofoils): two swept panels with a rounded leading edge. size = [chord, thickness, span]. */
function LiftSurface({ sub, s }: { sub: DemonstrationSubject; s: SubjectState }) {
    const [c, t, span] = sub.size, h = s.parameters.highlight ?? 0, col = h > 0 ? '#ffe9a8' : '#d9dee3';
    return <>{[-1, 1].map(side => <group key={side} position={[0, 0, side * span / 4]} rotation={[side * 0.05, side * -0.32, 0]}>
        <Box at={[0, 0, 0]} size={[c, t, span / 2]} color={col} outline />
        <mesh position={[c / 2, 0, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[t / 2, t / 2, span / 2, 10]} /><meshToonMaterial color={col} /></mesh>
        <Box at={[-c / 2 + 0.04, t / 2 + 0.005, 0]} size={[0.08, 0.01, span / 2]} color="#9aa3ab" />
    </group>)}</>;
}
/** Propulsor pair (engines, thrusters): nacelles with a spinning fan and an exhaust glow that follows activity. size = [diameter, length, spread]. */
function Propulsor({ sub, s, ctx }: { sub: DemonstrationSubject; s: SubjectState; ctx: MotionContext }) {
    const [d, len, spread] = sub.size, r = d / 2, act = s.parameters.activity ?? 0, ang = ctx.frame / ctx.fps * (4 + 30 * act), sides = spread > 0.1 ? [-1, 1] : [0];
    return <>{sides.map(side => <group key={side} position={[0, 0, side * spread / 2]}>
        <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[r, r * 0.8, len, 22, 1, true]} /><meshToonMaterial color="#8c969f" side={DoubleSide} /></mesh>
        <mesh position={[len / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[r * 0.95, r * 0.1, 8, 24]} /><meshToonMaterial color="#5a646d" /></mesh>
        <group position={[len * 0.38, 0, 0]} rotation={[ang, 0, 0]}>{Array.from({ length: 8 }, (_, i) => <Box key={i} at={[0, r * 0.45 * Math.cos(i * Math.PI / 4), r * 0.45 * Math.sin(i * Math.PI / 4)]} rotation={[i * Math.PI / 4, 0, 0.5]} size={[0.03, r * 0.85, r * 0.16]} color="#c9d1d8" />)}
            <mesh rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[r * 0.25, r * 0.5, 12]} /><meshToonMaterial color="#3b434b" /></mesh></group>
        {act > 0.05 && <mesh position={[-len / 2 - len * 0.35 * act, 0, 0]} rotation={[0, 0, Math.PI / 2]}><coneGeometry args={[r * 0.6, len * 0.7 * act, 16]} /><meshBasicMaterial color="#ffd27a" transparent opacity={0.45 * act} depthWrite={false} /></mesh>}
    </group>)}</>;
}
/** Streamlines (any fluid passing a body): dotted lines moving backward relative to the body; downstream they turn by
 * fillLevel (deflection, 0..1, downward), with small arrows marking the turned flow. activity = how much flow is shown. */
function Streamlines({ sub, s, ctx }: { sub: DemonstrationSubject; s: SubjectState; ctx: MotionContext }) {
    const [L, H, W] = sub.size, act = s.parameters.activity ?? 0, defl = s.parameters.fillLevel ?? 0, t = ctx.frame / ctx.fps;
    if (act < 0.02) return null;
    const lines = 7, dots = 22, out: React.ReactNode[] = [];
    for (let k = 0; k < lines; k++) {
        const y0 = (k - (lines - 1) / 2) * H / lines, z = (seeded(k) - 0.5) * W * 0.8, near = Math.max(0, 1 - Math.abs(y0) / (H * 0.5));
        for (let j = 0; j < dots; j++) {
            const u = ((j / dots + t * 0.55) % 1), x = L / 2 - u * L, behind = Math.max(0, -x / (L / 2));
            const bump = Math.exp(-x * x / 0.35) * 0.18 * near * Math.sign(y0 || 1), y = y0 + bump - behind * behind * defl * H * 0.55 * (0.5 + near);
            out.push(<mesh key={k + '-' + j} position={[x, y, z]}><sphereGeometry args={[0.035, 6, 4]} /><meshBasicMaterial color="#ffffff" transparent opacity={act * (0.4 + 0.6 * Math.sin(u * Math.PI))} depthWrite={false} /></mesh>);
        }
    }
    const arrows = defl > 0.3 ? [-0.25, 0.25].map((z, i) => <group key={'a' + i} position={[-L * 0.32, -H * 0.38 - (t * 0.6 % 0.3), z * W]}>
        <mesh><cylinderGeometry args={[0.025, 0.025, 0.35, 8]} /><meshBasicMaterial color="#3a8dde" /></mesh>
        <mesh position={[0, -0.24, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.07, 0.15, 10]} /><meshBasicMaterial color="#3a8dde" /></mesh></group>) : [];
    return <>{out}{arrows}</>;
}
/** Force arrow (any named force): a bold arrow along +Y that grows with activity; orientation and colour come from the plan. */
function ForceArrow({ sub, s }: { sub: DemonstrationSubject; s: SubjectState }) {
    const [w, len] = sub.size, act = s.parameters.activity ?? 0, l = len * act;
    if (act < 0.02) return null;
    return <group position={[0, -len / 2, 0]}>
        <mesh position={[0, l * 0.4, 0]}><cylinderGeometry args={[w * 0.3, w * 0.3, l * 0.8, 12]} /><meshBasicMaterial color={sub.color} depthTest={false} /></mesh>
        <mesh position={[0, l * 0.88, 0]}><coneGeometry args={[w * 0.75, l * 0.24, 16]} /><meshBasicMaterial color={sub.color} depthTest={false} /></mesh>
        <mesh position={[0, l * 0.88, 0]} scale={[1.15, 1.08, 1.15]}><coneGeometry args={[w * 0.75, l * 0.24, 16]} /><meshBasicMaterial color={OUTLINE} side={BackSide} depthTest={false} /></mesh>
    </group>;
}
/** Pressure field (a named pressure concept): soft contour shells around a body; symmetric, claims no distribution. */
function PressureField({ sub, s, ctx }: { sub: DemonstrationSubject; s: SubjectState; ctx: MotionContext }) {
    const [L, H, W] = sub.size, act = s.parameters.activity ?? 0, pulse = 1 + 0.04 * Math.sin(ctx.frame / ctx.fps * 4);
    if (act < 0.02) return null;
    return <>{[1, 1.35, 1.7].map((k, i) => <mesh key={i} scale={[L / 2 * k * pulse, H / 2 * k * pulse, W / 2 * k * pulse]}><sphereGeometry args={[1, 24, 12]} /><meshBasicMaterial color="#8ad0ff" transparent opacity={act * (0.16 - i * 0.04)} depthWrite={false} side={DoubleSide} /></mesh>)}</>;
}
/** Sky field: cloud clusters streaming backward past the body (speed = activity) above a sea with moving wave stripes
 * and the body's shadow. size = [extent, depth of the sea below, extent] in units of 8 (primitive size stays bounded). */
function CloudField({ sub, s, ctx }: { sub: DemonstrationSubject; s: SubjectState; ctx: MotionContext }) {
    const E = sub.size[0] * 8, drop = sub.size[1] * 8, act = s.parameters.activity ?? 0, t = ctx.frame / ctx.fps, travel = t * (2 + 14 * act), span = E;
    const clouds = Array.from({ length: 16 }, (_, i) => { const y = (seeded(i + 1) - 0.65) * 9, z = (seeded(i + 7) - 0.5) * E * 0.7 - (Math.abs(seeded(i + 7) - 0.5) < 0.12 ? 6 : 0), x = wrap(seeded(i + 3) * span - travel, span), k = 0.8 + seeded(i + 11) * 1.6;
        return <group key={i} position={[x, y, z]} scale={[k, k * 0.6, k]}>{[[0, 0, 0, 1], [0.9, -0.1, 0.2, 0.75], [-0.85, -0.15, -0.1, 0.7]].map(([a, b, c, r], j) => <mesh key={j} position={[a, b, c]}><sphereGeometry args={[r, 12, 10]} /><meshToonMaterial color="#ffffff" /></mesh>)}</group>; });
    const stripes = Array.from({ length: 10 }, (_, i) => <mesh key={'w' + i} position={[wrap(i * span / 10 - travel * 0.6, span), -drop + 0.02, (seeded(i + 21) - 0.5) * E * 0.6]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[2.6, 0.12]} /><meshBasicMaterial color="#d8f1ff" transparent opacity={0.5} /></mesh>);
    return <>
        <mesh position={[0, -drop, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[E * 3, E * 3]} /><meshToonMaterial color="#2f9bd0" /></mesh>
        {stripes}
        <mesh position={[0, -drop + 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[2.4, 1.6, 1]}><circleGeometry args={[1, 24]} /><meshBasicMaterial color="#14506e" transparent opacity={0.35} depthWrite={false} /></mesh>
        {clouds}
    </>;
}
/** Water surface: sea plane with foam stripes streaming backward and a wake behind the body (speed = activity). */
function WaterSurface({ sub, s, ctx }: { sub: DemonstrationSubject; s: SubjectState; ctx: MotionContext }) {
    const E = sub.size[0] * 8, act = s.parameters.activity ?? 0, travel = ctx.frame / ctx.fps * (1 + 6 * act);
    return <>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[E * 3, E * 3]} /><meshToonMaterial color="#2f8fc4" /></mesh>
        {Array.from({ length: 14 }, (_, i) => <mesh key={i} position={[wrap(i * E / 14 - travel, E), 0.02, (seeded(i + 2) - 0.5) * E * 0.5]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.4, 0.08]} /><meshBasicMaterial color="#e3f5ff" transparent opacity={0.6} /></mesh>)}
        {act > 0.05 && [-1, 1].map(s2 => <mesh key={'k' + s2} position={[-3, 0.03, s2 * 0.6]} rotation={[-Math.PI / 2, 0, s2 * 0.12]}><planeGeometry args={[4, 0.18 * act]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.7} /></mesh>)}
    </>;
}
/** Road strip: asphalt with dashed centre marks streaming backward (speed = activity). */
function RoadStrip({ sub, s, ctx }: { sub: DemonstrationSubject; s: SubjectState; ctx: MotionContext }) {
    const E = sub.size[0] * 8, W = sub.size[2], act = s.parameters.activity ?? 0, travel = ctx.frame / ctx.fps * (1 + 10 * act);
    return <>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[E * 3, W]} /><meshToonMaterial color="#3c4248" /></mesh>
        {Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[wrap(i * E / 12 - travel, E), 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.0, 0.12]} /><meshBasicMaterial color="#f5f5f0" /></mesh>)}
    </>;
}
/** Studio backdrop (experiment/component micro-stage): a clean cyclorama with a grid floor that isolates the subject. */
function StudioBackdrop({ sub }: { sub: DemonstrationSubject }) {
    const R = sub.size[0] * 4, floor = -sub.size[1];
    return <>
        <mesh renderOrder={-1}><sphereGeometry args={[R, 32, 16]} /><meshBasicMaterial color={sub.color} side={BackSide} fog={false} /></mesh>
        <mesh position={[0, floor, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[R * 0.9, 48]} /><meshToonMaterial color="#dfe7ee" /></mesh>
        <gridHelper args={[R * 1.6, 32, '#b9c6d2', '#cdd7e0']} position={[0, floor + 0.01, 0]} />
        <mesh position={[0, floor + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[2.6, 1.4, 1]}><circleGeometry args={[1, 32]} /><meshBasicMaterial color="#1d2a33" transparent opacity={0.18} depthWrite={false} /></mesh>
    </>;
}
/** Enclosure (Phase29 execution layer): a closed housing whose front and top walls open into a section view as
 * activity goes 0 → 1 (cutaway), so what happens inside stays visible. size = [width, height, depth]. */
function Enclosure({ sub, s }: { sub: DemonstrationSubject; s: SubjectState }) {
    const [w, h, d] = sub.size, open = Math.min(1, Math.max(0, s.parameters.activity ?? 0)), t = 0.06, wall = 1 - open * 0.92;
    const Wall = ({ at, size, opacity, color = sub.color }: { at: Vec3; size: Vec3; opacity: number; color?: string }) =>
        <mesh position={at}><boxGeometry args={size} /><meshToonMaterial color={color} transparent={opacity < 1} opacity={opacity} depthWrite={opacity > 0.5} /></mesh>;
    const shell = <>
        <Wall at={[0, 0, -d / 2 + t / 2]} size={[w, h, t]} opacity={1} color="#c9d3da" />
        <Wall at={[-w / 2 + t / 2, 0, 0]} size={[t, h, d]} opacity={1} />
        <Wall at={[w / 2 - t / 2, 0, 0]} size={[t, h, d]} opacity={1} />
        <Wall at={[0, -h / 2 + t / 2, 0]} size={[w, t, d]} opacity={1} />
        <mesh scale={[1.01, 1.01, 1.01]}><boxGeometry args={[w, h, d]} /><meshBasicMaterial color={OUTLINE} side={BackSide} transparent opacity={0.6} /></mesh></>;
    // DOOR_FRONT (the script names a door): the same cabinet with a hinged front — two doors with handles, a base
    // kick-plate with a vent and feet. Opening = the doors swing open on their hinges (the section), closing = they return.
    if (sub.variant === 'DOOR_FRONT') {
        const a = -open * 1.75, split = h * 0.3, hingeX = -w / 2, base = 0.16;
        const Door = ({ y, hh }: { y: number; hh: number }) => <group position={[hingeX, y, d / 2]} rotation={[0, a, 0]}>
            <mesh position={[w / 2, 0, 0.03]}><boxGeometry args={[w * 0.98, hh - 0.04, 0.06]} /><meshToonMaterial color={sub.color} /></mesh>
            <mesh position={[w * 0.9, 0, 0.09]}><boxGeometry args={[0.05, Math.min(hh * 0.6, 0.7), 0.05]} /><meshToonMaterial color="#9aa6ae" /></mesh></group>;
        return <>{shell}
            <Wall at={[0, h / 2 - t / 2, 0]} size={[w, t, d]} opacity={1} />
            <Door y={h / 2 - split / 2} hh={split} /><Door y={-h / 2 + base + (h - split - base) / 2} hh={h - split - base} />
            <mesh position={[0, -h / 2 + base / 2, d / 2 + 0.01]}><boxGeometry args={[w, base, 0.04]} /><meshToonMaterial color="#5d6870" /></mesh>
            <mesh position={[0, -h / 2 + base / 2, d / 2 + 0.035]}><boxGeometry args={[w * 0.7, 0.03, 0.01]} /><meshBasicMaterial color="#2f383e" /></mesh>
            {[-1, 1].map(x => <mesh key={'f' + x} position={[x * (w / 2 - 0.12), -h / 2 - 0.04, d / 2 - 0.12]}><cylinderGeometry args={[0.05, 0.05, 0.08, 10]} /><meshToonMaterial color="#3a4248" /></mesh>)}
        </>;
    }
    return <>{shell}
        <Wall at={[0, h / 2 - t / 2, 0]} size={[w, t, d]} opacity={wall} />
        <Wall at={[0, 0, d / 2 - t / 2]} size={[w, h, t]} opacity={wall} />
        {open > 0.05 && <mesh position={[0, 0, d / 2 + 0.002]}><planeGeometry args={[w * 0.98, h * 0.98]} /><meshBasicMaterial color={OUTLINE} wireframe transparent opacity={0.55 * open} /></mesh>}
    </>;
}
/** State tint (Phase29): a translucent volume that shows a state of the material inside a component.
 * PHASE: fillLevel 0 = liquid (droplets, dense blue) → 1 = gas (rising pale bubbles); THERMAL: 0 = cold (blue) → 1 = hot (orange).
 * activity = agitation while the state is changing (boiling bubbles / shimmer). */
function StateTint({ sub, s, ctx }: { sub: DemonstrationSubject; s: SubjectState; ctx: MotionContext }) {
    const [w, h, d] = sub.size, v = Math.min(1, Math.max(0, s.parameters.fillLevel ?? 0)), a = Math.min(1, Math.max(0, s.parameters.activity ?? 0)), thermal = sub.variant === 'THERMAL';
    const mix = (c0: number[], c1: number[]) => '#' + c0.map((x, i) => Math.round(x + (c1[i] - x) * v).toString(16).padStart(2, '0')).join('');
    const color = thermal ? mix([70, 140, 230], [245, 130, 40]) : mix([40, 120, 220], [215, 235, 250]);
    const n = 8, rise = 0.6 + a * 1.4;
    return <>
        <mesh><boxGeometry args={[w, h, d]} /><meshBasicMaterial color={color} transparent opacity={0.16 + 0.22 * (thermal ? v : 1 - v * 0.5)} depthWrite={false} /></mesh>
        {Array.from({ length: n }, (_, i) => { const y = wrap(seeded(i) * h + ctx.frame / ctx.fps * rise * (thermal ? 0.4 : v + a), h);
            const r = (thermal ? 0.03 : 0.025 + 0.035 * v) * Math.min(w, d) * 4;
            return <mesh key={i} position={[(seeded(i + 7) - 0.5) * w * 0.85, y, (seeded(i + 13) - 0.5) * d * 0.85]}><sphereGeometry args={[r, 8, 6]} /><meshBasicMaterial color={thermal ? color : v > 0.5 ? '#ffffff' : '#7fb6ff'} transparent opacity={thermal ? 0.25 + 0.5 * a : 0.55} /></mesh>; })}
    </>;
}
/** Machine unit (Phase29): a powered component; activity 0 = off (still fan, dark lamp), 1 = running (fan turns, lamp lit, slight hum). */
function MachineUnit({ sub, s, ctx }: { sub: DemonstrationSubject; s: SubjectState; ctx: MotionContext }) {
    const [w, h, d] = sub.size, a = Math.min(1, Math.max(0, s.parameters.activity ?? 0)), hum = a * Math.sin(ctx.frame * 2.1) * 0.012;
    return <group position={[hum, 0, 0]}>
        <Box at={[0, 0, 0]} size={[w, h, d]} color={sub.color} outline />
        <group position={[0, 0, d / 2 + 0.02]} rotation={[0, 0, ctx.frame / ctx.fps * 9 * a]}>
            {[0, 1, 2, 3].map(i => <mesh key={i} rotation={[0, 0, i * Math.PI / 2]} position={[0, 0, 0]}><boxGeometry args={[Math.min(w, h) * 0.62, Math.min(w, h) * 0.12, 0.02]} /><meshToonMaterial color="#4a5660" /></mesh>)}
        </group>
        <mesh position={[w * 0.36, h * 0.36, d / 2 + 0.02]}><sphereGeometry args={[Math.min(w, h) * 0.07, 10, 8]} /><meshBasicMaterial color={a > 0.5 ? '#3ee86a' : '#3a2a2a'} /></mesh>
    </group>;
}
/** Transfer path (Phase29): something without its own geometry (heat, a material in a pipe) travelling from a source
 * to a destination. No tube is drawn: particles advance along the path up to flowProgress.
 * THERMAL = warm particles (heat); PHASE = material particles (pale gas when fillLevel-like amount ≥ .5, blue liquid otherwise).
 * Readability: the SOURCE glows while the transfer runs, a fading trail joins source and head (older = smaller, fainter),
 * a small cone at the head shows the direction (reinforcement only) and the DESTINATION is ringed once reached. */
/** A soft straight beam behind the head of a light transfer (reads as a ray at any distance). */
function Beam({ from, to, color }: { from: Vec3; to: Vec3; color: string }) {
    const a = new Vector3(...from), b = new Vector3(...to), d = b.clone().sub(a), l = d.length(); if (l < 0.01) return null;
    return <mesh position={a.add(b).multiplyScalar(0.5)} quaternion={new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize())}><cylinderGeometry args={[0.1, 0.1, l, 8]} /><meshBasicMaterial color={color} transparent opacity={0.6} depthWrite={false} /></mesh>;
}
function TransferPath({ sub, s, ctx }: { sub: DemonstrationSubject; s: SubjectState; ctx: MotionContext }) {
    const path = sub.path!, prog = Math.min(1, Math.max(0, s.parameters.flowProgress ?? 0)); if (prog <= 0.001 || path.length < 2) return null;
    const lens = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1], p[2] - path[i][2])), total = lens.reduce((a, b) => a + b, 0);
    const at = (d: number): Vec3 => { let r = Math.max(0, d); for (let i = 0; i < lens.length; i++) { if (r <= lens[i]) { const t = lens[i] ? r / lens[i] : 0; return path[i].map((v, k) => v + (path[i + 1][k] - v) * t) as Vec3; } r -= lens[i]; } return path[path.length - 1]; };
    // LIGHT = radiant energy (bright, large), CHARGE = charge carriers (small, cyan), ALTERNATING = alternating current (wobbles across the path).
    const v = sub.variant, thermal = v === 'THERMAL' || v === 'LIGHT', gas = (s.parameters.amount ?? 0) >= 0.5, color = v === 'LIGHT' ? '#ffe066' : v === 'CHARGE' ? '#4fd1ff' : v === 'ALTERNATING' ? '#ffb347' : thermal ? '#ff8a2a' : gas ? '#e8f3fb' : '#2f86e0';
    const light = v === 'LIGHT', reach = prog * total, n = light ? 14 : 9, spacing = Math.max(0.12, Math.min(light ? 0.5 : 0.3, reach / n)), phase = (ctx.frame / ctx.fps * 0.9) % spacing;
    // Head direction (for the cone): tangent at the head.
    const h0 = at(reach - 0.05), h1 = at(reach), dir = [h1[0] - h0[0], h1[1] - h0[1], h1[2] - h0[2]], dl = Math.hypot(...dir) || 1;
    const yaw = Math.atan2(dir[0], dir[2]), pitch = Math.acos(Math.max(-1, Math.min(1, dir[1] / dl)));
    const pulse = 0.75 + 0.25 * Math.sin(ctx.frame * 0.25), arrived = prog >= 0.97;
    return <>
        <mesh position={path[0]}><sphereGeometry args={[thermal ? 0.16 * pulse : 0.1, 14, 10]} /><meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} /></mesh>
        {Array.from({ length: Math.min(n, Math.floor(reach / spacing)) }, (_, i) => { const d = reach - i * spacing - phase, age = i / n, p = at(d);
            const wob = v === 'ALTERNATING' ? 0.07 * Math.sin(ctx.frame * 0.55 + i * 1.3) : 0;
            return <mesh key={i} position={[p[0], p[1] + wob, p[2]]}><sphereGeometry args={[(light ? 0.2 : v === 'CHARGE' || v === 'ALTERNATING' ? 0.09 : thermal ? 0.075 : 0.06) * (1 - 0.45 * age), 10, 8]} /><meshBasicMaterial color={color} transparent opacity={0.95 - 0.6 * age} /></mesh>; })}
        <mesh position={h1}><sphereGeometry args={[light ? 0.22 : thermal ? 0.13 : 0.09, 12, 10]} /><meshBasicMaterial color={color} /></mesh>
        {light && <Beam from={at(reach - Math.min(reach, 4))} to={h1} color={color} />}
        {thermal && !arrived && <group position={h1} rotation={[0, yaw, 0]}><mesh rotation={[pitch, 0, 0]} position={[0, 0, 0]}><coneGeometry args={[0.07, 0.2, 10]} /><meshBasicMaterial color="#ffd27a" /></mesh></group>}
        {arrived && <mesh position={path[path.length - 1]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.2, 0.025, 6, 20]} /><meshBasicMaterial color={color} transparent opacity={0.8} /></mesh>}
    </>;
}
/** Interior room (Phase29 context planner): neutral staging around an indoor object — floor, two walls with a baseboard,
 * a window and a plain worktop along the side wall. Variant picks the finish (kitchen-like, bathroom-like, shaft, workshop).
 * It contextualises; it never adds a functional part of the mechanism. size = [width, height, depth] of the room. */
function InteriorRoom({ sub }: { sub: DemonstrationSubject }) {
    // Nominal size ×4 (primitive sizes are bounded): size = room [width, height, depth] / 4.
    const [w, h, d] = sub.size.map(x => x * 4), v = sub.variant;
    // NEUTRAL_INTERIOR: plain indoor staging (no room type claimed): neutral walls and floor, no tiles.
    const wall = v === 'NEUTRAL_INTERIOR' ? '#e9e6e1' : v === 'BATHROOM_LIKE' ? '#dfeef2' : v === 'BUILDING_SHAFT' ? '#c9ccce' : v === 'WORKSHOP' ? '#d9d2c4' : '#f1e6d6';
    const floor = v === 'NEUTRAL_INTERIOR' ? '#b8ad9e' : v === 'BATHROOM_LIKE' ? '#cfd8dc' : v === 'BUILDING_SHAFT' ? '#9ea3a6' : v === 'WORKSHOP' ? '#8d8478' : '#c9a27a';
    const tile = v === 'BATHROOM_LIKE' || v === 'KITCHEN_LIKE' || v === undefined;
    return <>
        <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[w, d]} /><meshToonMaterial color={floor} /></mesh>
        <mesh position={[0, h / 2, -d / 2]}><boxGeometry args={[w, h, 0.1]} /><meshToonMaterial color={wall} /></mesh>
        <mesh position={[-w / 2, h / 2, 0]}><boxGeometry args={[0.1, h, d]} /><meshToonMaterial color={wall} /></mesh>
        <mesh position={[0, 0.06, -d / 2 + 0.06]}><boxGeometry args={[w, 0.12, 0.04]} /><meshToonMaterial color="#8a7a6a" /></mesh>
        {tile && <mesh position={[0, 1.1, -d / 2 + 0.06]}><boxGeometry args={[w, 0.9, 0.02]} /><meshToonMaterial color={v === 'BATHROOM_LIKE' ? '#bfe1ea' : '#e6d8c2'} /></mesh>}
        {v !== 'BUILDING_SHAFT' && <mesh position={[w * 0.22, h * 0.62, -d / 2 + 0.07]}><boxGeometry args={[1.4, 1.0, 0.03]} /><meshBasicMaterial color="#cfe6f5" /></mesh>}
        {v !== 'BUILDING_SHAFT' && <mesh position={[-w / 2 + 0.35, 0.45, -d * 0.15]}><boxGeometry args={[0.6, 0.9, d * 0.5]} /><meshToonMaterial color="#e9e2d8" /></mesh>}
    </>;
}
export const MOTION_ASSEMBLIES = ['FUSELAGE', 'HULL', 'CAR_BODY', 'LIFT_SURFACE', 'PROPULSOR', 'STREAMLINES', 'FORCE_ARROW', 'PRESSURE_FIELD', 'CLOUD_FIELD', 'WATER_SURFACE', 'ROAD_STRIP', 'STUDIO_BACKDROP', 'ENCLOSURE', 'STATE_TINT', 'MACHINE_UNIT', 'TRANSFER_PATH', 'INTERIOR_ROOM'] as const;
export function MotionAssembly({ sub, s, ctx }: { sub: DemonstrationSubject; s: SubjectState; ctx: MotionContext }) {
    switch (sub.assembly) {
        case 'FUSELAGE': return <Fuselage sub={sub} />;
        case 'HULL': return <Hull sub={sub} />;
        case 'CAR_BODY': return <CarBody sub={sub} ctx={ctx} />;
        case 'LIFT_SURFACE': return <LiftSurface sub={sub} s={s} />;
        case 'PROPULSOR': return <Propulsor sub={sub} s={s} ctx={ctx} />;
        case 'STREAMLINES': return <Streamlines sub={sub} s={s} ctx={ctx} />;
        case 'FORCE_ARROW': return <ForceArrow sub={sub} s={s} />;
        case 'PRESSURE_FIELD': return <PressureField sub={sub} s={s} ctx={ctx} />;
        case 'CLOUD_FIELD': return <CloudField sub={sub} s={s} ctx={ctx} />;
        case 'WATER_SURFACE': return <WaterSurface sub={sub} s={s} ctx={ctx} />;
        case 'ROAD_STRIP': return <RoadStrip sub={sub} s={s} ctx={ctx} />;
        case 'STUDIO_BACKDROP': return <StudioBackdrop sub={sub} />;
        case 'ENCLOSURE': return <Enclosure sub={sub} s={s} />;
        case 'STATE_TINT': return <StateTint sub={sub} s={s} ctx={ctx} />;
        case 'MACHINE_UNIT': return <MachineUnit sub={sub} s={s} ctx={ctx} />;
        case 'TRANSFER_PATH': return <TransferPath sub={sub} s={s} ctx={ctx} />;
        case 'INTERIOR_ROOM': return <InteriorRoom sub={sub} />;
        default: return null;
    }
}
