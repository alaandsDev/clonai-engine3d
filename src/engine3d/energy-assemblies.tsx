import React from 'react';
import { BackSide, DoubleSide } from 'three';
import type { DemonstrationSubject, SubjectState } from './demonstration-contracts';
/** Phase29 energy-flow assemblies (drawn from roles, never from a named object):
 *  RADIANT_SOURCE — a glowing disc with rays (activity = shining);
 *  COLLECTOR_PANEL — a tilted frame of cells; activity = lit (cells brighten), fillLevel = shade over it;
 *  CONSUMER_LAMP — a wall light; activity = on (glow);
 *  UTILITY_POLE — a pole with a crossbar and insulators (the grid);
 *  NEIGHBORHOOD — neutral exterior staging (background houses, street, fences): context only, never a part.
 * Deterministic: depends only on frame and parameters. */
export interface EnergyContext { frame: number; fps: number }
export const ENERGY_ASSEMBLIES = new Set(['RADIANT_SOURCE', 'COLLECTOR_PANEL', 'CONSUMER_LAMP', 'UTILITY_POLE', 'NEIGHBORHOOD', 'SHADE_TREE']);
const OUTLINE = '#26303a';
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mix = (a: string, b: string, t: number) => { const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * clamp01(t)).toString(16).padStart(2, '0')).join(''); };
function RadiantSource({ sub, s, ctx }: { sub: DemonstrationSubject; s: SubjectState; ctx: EnergyContext }) {
    const r = sub.size[0] / 2, a = clamp01(s.parameters.activity ?? 1), spin = ctx.frame / ctx.fps * 0.3;
    return <>
        <mesh><sphereGeometry args={[r, 32, 20]} /><meshBasicMaterial color="#ffd23f" /></mesh>
        <mesh scale={[1.45, 1.45, 1.45]}><sphereGeometry args={[r, 24, 16]} /><meshBasicMaterial color="#ffe98a" transparent opacity={0.25 * a} depthWrite={false} /></mesh>
        <group rotation={[0, 0, spin]}>{Array.from({ length: 8 }, (_, i) => <mesh key={i} rotation={[0, 0, i * Math.PI / 4]} position={[Math.cos(i * Math.PI / 4) * r * 1.9, Math.sin(i * Math.PI / 4) * r * 1.9, 0]}><boxGeometry args={[r * 0.7, r * 0.14, 0.02]} /><meshBasicMaterial color="#ffd23f" transparent opacity={0.8 * a} /></mesh>)}</group>
    </>;
}
function CollectorPanel({ sub, s, ctx }: { sub: DemonstrationSubject; s: SubjectState; ctx: EnergyContext }) {
    const [w, t, d] = sub.size, a = clamp01(s.parameters.activity ?? 0), shade = clamp01(s.parameters.fillLevel ?? 0), cols = 4, rows = 2, cw = w * 0.9 / cols, cd = d * 0.88 / rows;
    const cell = mix('#1d3b73', '#3f7fe0', a * (0.75 + 0.25 * Math.sin(ctx.frame * 0.25)));
    return <>
        <mesh><boxGeometry args={[w, t, d]} /><meshToonMaterial color="#c9d1d8" /></mesh>
        <mesh scale={[1.02, 1.3, 1.02]}><boxGeometry args={[w, t, d]} /><meshBasicMaterial color={OUTLINE} side={BackSide} /></mesh>
        {Array.from({ length: cols * rows }, (_, i) => <mesh key={i} position={[-w * 0.45 + cw * (i % cols + 0.5), t / 2 + 0.006, -d * 0.44 + cd * (Math.floor(i / cols) + 0.5)]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[cw * 0.9, cd * 0.88]} /><meshBasicMaterial color={cell} /></mesh>)}
        <mesh position={[0, -t * 0.5 - 0.2, 0]}><cylinderGeometry args={[0.04, 0.04, 0.4, 8]} /><meshToonMaterial color="#6f7a83" /></mesh>
        {shade > 0.02 && <mesh position={[0, t / 2 + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[w * 1.05, d * 1.05]} /><meshBasicMaterial color="#0d1620" transparent opacity={0.55 * shade} depthWrite={false} /></mesh>}
    </>;
}
function ConsumerLamp({ sub, s }: { sub: DemonstrationSubject; s: SubjectState }) {
    const r = sub.size[0] / 2, a = clamp01(s.parameters.activity ?? 0);
    return <>
        <mesh position={[-r * 0.6, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.03, 0.03, r * 1.2, 8]} /><meshToonMaterial color="#4a545c" /></mesh>
        <mesh position={[0, r * 0.15, 0]}><coneGeometry args={[r * 0.8, r * 0.7, 16, 1, true]} /><meshToonMaterial color="#3a4248" /></mesh>
        <mesh position={[0, -r * 0.2, 0]}><sphereGeometry args={[r * 0.45, 16, 12]} /><meshBasicMaterial color={a > 0.5 ? '#fff3b0' : '#9aa3ab'} /></mesh>
        {a > 0.05 && <mesh position={[0, -r * 0.2, 0]} scale={[3, 3, 3]}><sphereGeometry args={[r * 0.45, 16, 12]} /><meshBasicMaterial color="#ffe066" transparent opacity={0.4 * a} depthWrite={false} /></mesh>}
        {/* the light it gives: a soft cone below the bulb */}
        {a > 0.05 && <mesh position={[0, -r * 1.5, 0]}><coneGeometry args={[r * 1.5, r * 2.4, 20, 1, true]} /><meshBasicMaterial color="#ffe066" transparent opacity={0.25 * a} depthWrite={false} side={DoubleSide} /></mesh>}
    </>;
}
function UtilityPole({ sub }: { sub: DemonstrationSubject }) {
    const [d, h] = sub.size;
    return <>
        <mesh><cylinderGeometry args={[d * 0.35, d * 0.45, h, 10]} /><meshToonMaterial color="#8a6a4a" /></mesh>
        <mesh position={[0, h * 0.42, 0]}><boxGeometry args={[1.4, 0.1, 0.1]} /><meshToonMaterial color="#6d5238" /></mesh>
        {[-0.55, 0, 0.55].map(x => <mesh key={x} position={[x, h * 0.42 + 0.12, 0]}><cylinderGeometry args={[0.05, 0.06, 0.16, 8]} /><meshToonMaterial color="#9fd3e6" /></mesh>)}
    </>;
}
/** Neutral exterior staging: background houses along a street with fences (repeated low-poly shapes). */
function Neighborhood({ sub }: { sub: DemonstrationSubject }) {
    const E = sub.size[0] * 4, colors = ['#e8b4a0', '#a8d0e6', '#f2d388', '#c6e2b5'];
    return <>
        <mesh position={[0, 0.01, E * 0.32]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[E * 2, 2.6]} /><meshToonMaterial color="#5b6168" /></mesh>
        <mesh position={[0, 0.02, E * 0.32]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[E * 2, 0.08]} /><meshBasicMaterial color="#f2f2ea" /></mesh>
        {[-1, 1].flatMap(side => [0, 1].map(k => { const x = side * (E * 0.38 + k * 4.2), c = colors[(k * 2 + (side > 0 ? 1 : 0)) % 4];
            return <group key={side + '_' + k} position={[x, 0, -E * 0.18 - k * 1.5]}>
                <mesh position={[0, 1.1, 0]}><boxGeometry args={[3, 2.2, 2.8]} /><meshToonMaterial color={c} /></mesh>
                <mesh position={[0, 2.55, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[2.3, 1.1, 4]} /><meshToonMaterial color="#b5503a" /></mesh>
            </group>; }))}
    </>;
}
/** Shade tree (a stated shade-giver; staging): trunk and a rounded canopy. */
function ShadeTree({ sub }: { sub: DemonstrationSubject }) {
    const [w, h] = sub.size;
    return <>
        <mesh position={[0, -h * 0.25, 0]}><cylinderGeometry args={[w * 0.08, w * 0.11, h * 0.5, 8]} /><meshToonMaterial color="#7a5638" /></mesh>
        {[[0, 0.15, 0, 0.42], [-0.22, 0.05, 0.1, 0.32], [0.22, 0.08, -0.08, 0.3]].map(([x, y, z, r], i) => <mesh key={i} position={[x * w, y * h, z * w]}><sphereGeometry args={[r * w, 12, 10]} /><meshToonMaterial color={sub.color} /></mesh>)}
    </>;
}
export function EnergyAssembly({ sub, s, ctx }: { sub: DemonstrationSubject; s: SubjectState; ctx: EnergyContext }) {
    switch (sub.assembly) {
        case 'RADIANT_SOURCE': return <RadiantSource sub={sub} s={s} ctx={ctx} />;
        case 'COLLECTOR_PANEL': return <CollectorPanel sub={sub} s={s} ctx={ctx} />;
        case 'CONSUMER_LAMP': return <ConsumerLamp sub={sub} s={s} />;
        case 'UTILITY_POLE': return <UtilityPole sub={sub} />;
        case 'NEIGHBORHOOD': return <Neighborhood sub={sub} />;
        case 'SHADE_TREE': return <ShadeTree sub={sub} />;
        default: return null;
    }
}
