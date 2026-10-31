import React from 'react';
import { BackSide } from 'three';
import type { DemonstrationSubject, SubjectState } from './demonstration-contracts';
/** Phase29 functional silhouettes: shapes that say what a part DOES (selected upstream from its stated role in the
 * mechanism, never from its name). No internal mechanism is drawn — only the function the script states.
 * Deterministic: animation depends only on frame and the subject's parameters. */
export interface FunctionalContext { frame: number; fps: number }
const OUTLINE = '#26303a';
const seeded = (n: number) => { const x = Math.sin(n * 57.3 + 19.1) * 43758.5453; return x - Math.floor(x); };
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mixHex = (a: number[], b: number[], t: number) => '#' + a.map((x, i) => Math.round(x + (b[i] - x) * clamp01(t)).toString(16).padStart(2, '0')).join('');
export const FUNCTIONAL_VARIANTS = new Set(['COMPRESSOR_LIKE', 'VALVE_LIKE', 'HEAT_EXCHANGER', 'CONTROL_UNIT', 'COMPRESSION', 'PRESSURE', 'PUMP_LIKE']);
/** Powered part acting on the circulating material: compact sealed body on a base, connected by an inlet and an outlet;
 * running = the body pulses (a band travels along it) and the lamp is lit. */
function PoweredBody({ sub, s, ctx }: { sub: DemonstrationSubject; s: SubjectState; ctx: FunctionalContext }) {
    const [w, h, d] = sub.size, a = clamp01(s.parameters.activity ?? 0), r = Math.min(w, d) * 0.42, bodyH = h * 0.58, y0 = -h / 2 + 0.06 + bodyH / 2;
    const t = ctx.frame / ctx.fps, hum = a * Math.sin(ctx.frame * 2.3) * 0.01, band = y0 - bodyH * 0.35 + bodyH * 0.7 * (0.5 + 0.5 * Math.sin(t * 7)) * a + (1 - a) * bodyH * 0.1;
    return <group position={[hum, 0, 0]}>
        <mesh position={[0, -h / 2 + 0.03, 0]}><boxGeometry args={[w, 0.06, d]} /><meshToonMaterial color="#3a4248" /></mesh>
        <mesh position={[0, y0, 0]}><cylinderGeometry args={[r, r, bodyH, 24]} /><meshToonMaterial color="#5d7f8e" /></mesh>
        <mesh position={[0, y0, 0]} scale={[1.05, 1.03, 1.05]}><cylinderGeometry args={[r, r, bodyH, 24]} /><meshBasicMaterial color={OUTLINE} side={BackSide} /></mesh>
        <mesh position={[0, y0 + bodyH / 2, 0]} scale={[1, 0.55, 1]}><sphereGeometry args={[r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshToonMaterial color="#5d7f8e" /></mesh>
        <mesh position={[-r - 0.1, y0 - bodyH * 0.2, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.045, 0.045, 0.22, 10]} /><meshToonMaterial color="#9aa6ae" /></mesh>
        <mesh position={[0, y0 + bodyH / 2 + r * 0.55 + 0.08, 0]}><cylinderGeometry args={[0.045, 0.045, 0.18, 10]} /><meshToonMaterial color="#9aa6ae" /></mesh>
        <mesh position={[0, band, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[r * 1.04, 0.025, 6, 24]} /><meshBasicMaterial color={a > 0.05 ? '#ffd27a' : '#46525a'} /></mesh>
        <mesh position={[r * 0.75, y0 + bodyH * 0.3, r * 0.75]}><sphereGeometry args={[0.04, 10, 8]} /><meshBasicMaterial color={a > 0.5 ? '#3ee86a' : '#3a2a2a'} /></mesh>
    </group>;
}
/** Actuator that moves a material along a route (pump-like): a round housing with a spinning impeller seen through its
 * face, a motor body behind it, an inlet on one side and an outlet leaving tangentially; activity = running. */
function PumpLike({ sub, s, ctx }: { sub: DemonstrationSubject; s: SubjectState; ctx: FunctionalContext }) {
    const [w, h, d] = sub.size, a = clamp01(s.parameters.activity ?? 0), R = Math.min(w, h) * 0.38, spin = ctx.frame / ctx.fps * 14 * a;
    return <group position={[a * Math.sin(ctx.frame * 2.7) * 0.006, 0, 0]}>
        <mesh position={[0, -h / 2 + 0.02, 0]}><boxGeometry args={[w, 0.04, d]} /><meshToonMaterial color="#3a4248" /></mesh>
        <mesh position={[0, 0, d * 0.12]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[R, R, d * 0.32, 28]} /><meshToonMaterial color={sub.color} /></mesh>
        <mesh position={[0, 0, -d * 0.22]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[R * 0.7, R * 0.7, d * 0.4, 20]} /><meshToonMaterial color="#56636c" /></mesh>
        <group position={[0, 0, d * 0.29]} rotation={[0, 0, spin]}>{[0, 1].map(i => <mesh key={i} rotation={[0, 0, i * Math.PI / 2]}><boxGeometry args={[R * 1.6, R * 0.22, 0.02]} /><meshToonMaterial color="#e3e8eb" /></mesh>)}</group>
        <mesh position={[-R - 0.08, 0, d * 0.12]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.05, 0.05, 0.18, 10]} /><meshToonMaterial color="#9aa6ae" /></mesh>
        <mesh position={[R * 0.55, R + 0.06, d * 0.12]}><cylinderGeometry args={[0.05, 0.05, 0.16, 10]} /><meshToonMaterial color="#9aa6ae" /></mesh>
    </group>;
}
/** Controller: small unit with a dial facing out at 45° (seen from the front and the side) and an indicator lamp.
 * activity 1 = demanding (needle left, lamp lit) → 0 = switched (needle right, lamp off). */
function ControlUnit({ sub, s }: { sub: DemonstrationSubject; s: SubjectState }) {
    const [w, h, d] = sub.size, a = clamp01(s.parameters.activity ?? 0);
    return <>
        <mesh><boxGeometry args={[w, h, d]} /><meshToonMaterial color={sub.color} /></mesh>
        <mesh scale={[1.06, 1.05, 1.1]}><boxGeometry args={[w, h, d]} /><meshBasicMaterial color={OUTLINE} side={BackSide} /></mesh>
        <group position={[w * 0.3, h * 0.08, d * 0.3]} rotation={[0, Math.PI / 4, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[Math.min(w, h) * 0.36, Math.min(w, h) * 0.36, 0.03, 20]} /><meshToonMaterial color="#f7f9fa" /></mesh>
            <mesh position={[0, 0, 0.025]} rotation={[0, 0, -0.9 + 1.8 * (1 - a)]}><boxGeometry args={[0.018, Math.min(w, h) * 0.3, 0.012]} /><meshBasicMaterial color="#c0392b" /></mesh>
        </group>
        <mesh position={[0, h * 0.42, d * 0.5]}><sphereGeometry args={[0.035, 10, 8]} /><meshBasicMaterial color={a > 0.5 ? '#3ee86a' : '#5a3030'} /></mesh>
    </>;
}
/** Restriction on a route: straight inlet, converging cone, narrow throat (accent collar), diverging cone, outlet. Axis = X. */
function Restriction({ sub }: { sub: DemonstrationSubject }) {
    const [L, D] = sub.size, R = D * 0.3, r = R * 0.38, seg = L / 5, metal = '#8d99a3';
    const Pipe = ({ x, len, r0, r1 }: { x: number; len: number; r0: number; r1: number }) => <mesh position={[x, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><cylinderGeometry args={[r1, r0, len, 16]} /><meshToonMaterial color={metal} /></mesh>;
    return <>
        <Pipe x={-2 * seg} len={seg} r0={R} r1={R} /><Pipe x={-seg} len={seg} r0={R} r1={r} />
        <Pipe x={0} len={seg} r0={r} r1={r} /><Pipe x={seg} len={seg} r0={r} r1={R} /><Pipe x={2 * seg} len={seg} r0={R} r1={R} />
        <mesh rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[r * 1.6, r * 0.45, 8, 20]} /><meshToonMaterial color="#d9733a" /></mesh>
    </>;
}
/** Exchange surface: a long tube folded back and forth over a large area (serpentine) on a thin backing. Plane = XY. */
function ExchangeSurface({ sub }: { sub: DemonstrationSubject }) {
    const [w, h] = sub.size, rows = 5, gap = h * 0.86 / (rows - 1), tube = '#3b4248', r = Math.min(0.045, gap * 0.22);
    const ys = Array.from({ length: rows }, (_, i) => h * 0.43 - i * gap);
    return <>
        <mesh position={[0, 0, -0.02]}><boxGeometry args={[w * 0.94, h * 0.96, 0.015]} /><meshToonMaterial color="#59626a" transparent opacity={0.55} /></mesh>
        {ys.map((y, i) => <mesh key={'t' + i} position={[0, y, 0.02]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[r, r, w * 0.86, 10]} /><meshToonMaterial color={tube} /></mesh>)}
        {ys.slice(1).map((y, i) => <mesh key={'u' + i} position={[(i % 2 ? -1 : 1) * w * 0.43, y + gap / 2, 0.02]}><cylinderGeometry args={[r, r, gap, 10]} /><meshToonMaterial color={tube} /></mesh>)}
    </>;
}
/** Material being squeezed: the volume narrows as activity rises (the action), its particles pack together (state
 * difference), and its colour warms with fillLevel (the stated result). */
function Compression({ sub, s, ctx }: { sub: DemonstrationSubject; s: SubjectState; ctx: FunctionalContext }) {
    const [w, h, d] = sub.size, a = clamp01(s.parameters.activity ?? 0), v = clamp01(s.parameters.fillLevel ?? 0), k = 1 - 0.5 * a;
    const color = mixHex([150, 196, 240], [245, 128, 40], v), t = ctx.frame / ctx.fps;
    return <>
        <mesh scale={[k, 1, k]}><boxGeometry args={[w, h, d]} /><meshBasicMaterial color={color} transparent opacity={0.16 + 0.12 * a} depthWrite={false} /></mesh>
        <mesh scale={[k * 1.01, 1.01, k * 1.01]}><boxGeometry args={[w, h, d]} /><meshBasicMaterial color={color} wireframe transparent opacity={0.5} /></mesh>
        {Array.from({ length: 8 }, (_, i) => { const j = 0.03 * Math.sin(t * 3 + i);
            return <mesh key={i} position={[(seeded(i) - 0.5) * w * 0.8 * k + j, (seeded(i + 5) - 0.5) * h * 0.8 * (1 - 0.35 * a), (seeded(i + 9) - 0.5) * d * 0.8 * k]}><sphereGeometry args={[0.055, 10, 8]} /><meshBasicMaterial color={color} /></mesh>; })}
    </>;
}
/** Property of the flowing material across a restriction (axis X): upstream particles stay dense; downstream their
 * spacing opens as fillLevel (the property) drops — before/after on the two sides of the narrowing. */
function PressureAcross({ sub, s, ctx }: { sub: DemonstrationSubject; s: SubjectState; ctx: FunctionalContext }) {
    const [w, h, d] = sub.size, p = clamp01(s.parameters.fillLevel ?? 0), t = ctx.frame / ctx.fps;
    const dense = '#1f5fbf', light = mixHex([31, 95, 191], [190, 224, 255], 1 - p);
    return <>
        <mesh><boxGeometry args={[w, h, d]} /><meshBasicMaterial color="#8fb8e8" transparent opacity={0.1} depthWrite={false} /></mesh>
        {Array.from({ length: 9 }, (_, i) => { const up = i < 4, u = ((i % (up ? 4 : 5)) / (up ? 4 : 5) + t * 0.25) % 1;
            const x = up ? -w * 0.48 + u * w * 0.36 : w * 0.1 + u * w * 0.38 * (0.5 + 0.5 * (1 - p)) / 1, y = (seeded(i + 3) - 0.5) * h * (up ? 0.35 : 0.35 + 0.5 * (1 - p)), z = (seeded(i + 11) - 0.5) * d * (up ? 0.35 : 0.35 + 0.5 * (1 - p));
            return <mesh key={i} position={[x, y, z]}><sphereGeometry args={[up ? 0.045 : 0.045 + 0.02 * (1 - p), 8, 6]} /><meshBasicMaterial color={up ? dense : light} /></mesh>; })}
    </>;
}
export function FunctionalPart({ sub, s, ctx }: { sub: DemonstrationSubject; s: SubjectState; ctx: FunctionalContext }) {
    switch (sub.variant) {
        case 'COMPRESSOR_LIKE': return <PoweredBody sub={sub} s={s} ctx={ctx} />;
        case 'CONTROL_UNIT': return <ControlUnit sub={sub} s={s} />;
        case 'VALVE_LIKE': return <Restriction sub={sub} />;
        case 'HEAT_EXCHANGER': return <ExchangeSurface sub={sub} />;
        case 'COMPRESSION': return <Compression sub={sub} s={s} ctx={ctx} />;
        case 'PRESSURE': return <PressureAcross sub={sub} s={s} ctx={ctx} />;
        case 'PUMP_LIKE': return <PumpLike sub={sub} s={s} ctx={ctx} />;
        default: return null;
    }
}
