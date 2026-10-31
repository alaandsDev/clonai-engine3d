import React, { useMemo } from 'react';
import { BackSide, DataTexture, DoubleSide, RGBAFormat, RepeatWrapping } from 'three';
import type { DemonstrationSubject, SubjectState } from './demonstration-contracts';
/** Phase29 containment assemblies (drawn from functional roles, never from a named object):
 *  ROTATING_CONTAINER — an open-top drum on a vertical axis; PERFORATED variant = a wall with see-through openings
 *    (only when the script names openings). activity = how fast it is shown turning (motion streaks).
 *  OUTER_CONTAINER — a translucent vessel around it; fillLevel = material collected at its bottom.
 *  CONTENT_ITEMS — loose items inside a container; activity 0 = heaped at the bottom → 1 = against the wall;
 *    fillLevel = how much material they still hold (darker, dripping when high).
 * Deterministic: depends only on frame and parameters. */
export interface ContainmentContext { frame: number; fps: number }
export const CONTAINMENT_ASSEMBLIES = new Set(['ROTATING_CONTAINER', 'OUTER_CONTAINER', 'CONTENT_ITEMS']);
const OUTLINE = '#26303a';
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const seeded = (n: number) => { const x = Math.sin(n * 71.3 + 11.9) * 43758.5453; return x - Math.floor(x); };
const mix = (a: string, b: string, t: number) => { const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * clamp01(t)).toString(16).padStart(2, '0')).join(''); };
/** Wall texture with round see-through openings (alpha 0 inside each opening). */
function useOpenings(color: string) {
    return useMemo(() => {
        const w = 64, h = 32, d = new Uint8Array(w * h * 4), [r, g, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const cx = (x % 8) - 3.5, cy = (y % 8) - 3.5, hole = cx * cx + cy * cy < 5.2, k = (y * w + x) * 4;
            d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = hole ? 0 : 255;
        }
        const t = new DataTexture(d, w, h, RGBAFormat); t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(5, 2); t.needsUpdate = true; return t;
    }, [color]);
}
function RotatingContainer({ sub, s }: { sub: DemonstrationSubject; s: SubjectState }) {
    const [dd, h] = sub.size, r = dd / 2, a = clamp01(s.parameters.activity ?? 0), perforated = sub.variant === 'PERFORATED', wallColor = '#a9b4bc', tex = useOpenings(wallColor);
    return <>
        <mesh>{/* wall */}<cylinderGeometry args={[r, r, h, 48, 1, true]} />
            {perforated ? <meshToonMaterial map={tex} alphaTest={0.5} transparent side={DoubleSide} /> : <meshToonMaterial color={wallColor} side={DoubleSide} />}</mesh>
        <mesh position={[0, -h / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[r, 40]} /><meshToonMaterial color="#8f9aa3" side={DoubleSide} /></mesh>
        <mesh position={[0, h / 2, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[r, 0.035, 8, 48]} /><meshToonMaterial color="#6f7a83" /></mesh>
        <mesh position={[0, -h / 2 - 0.1, 0]}><cylinderGeometry args={[0.06, 0.06, 0.2, 12]} /><meshToonMaterial color="#4a545c" /></mesh>
        {/* a vertical stripe on the wall makes the rotation readable even without motion */}
        <mesh position={[r * 0.995, 0, 0]}><boxGeometry args={[0.02, h * 0.92, 0.12]} /><meshToonMaterial color="#d9733a" /></mesh>
        {a > 0.2 && [0.25, -0.15].map((y, i) => <mesh key={i} position={[0, y * h, 0]} rotation={[Math.PI / 2, 0, i * 2]}><torusGeometry args={[r * 1.06, 0.012, 4, 32, Math.PI * 0.7]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.65 * a} depthWrite={false} /></mesh>)}
    </>;
}
function OuterContainer({ sub, s }: { sub: DemonstrationSubject; s: SubjectState }) {
    const [dd, h] = sub.size, r = dd / 2, f = clamp01(s.parameters.fillLevel ?? 0), lh = Math.max(0.001, f * h * 0.45);
    return <>
        <mesh><cylinderGeometry args={[r, r, h, 48, 1, true]} /><meshToonMaterial color="#cfd8de" transparent opacity={0.3} side={DoubleSide} depthWrite={false} /></mesh>
        <mesh scale={[1.01, 1.0, 1.01]}><cylinderGeometry args={[r, r, h, 48, 1, true]} /><meshBasicMaterial color={OUTLINE} side={BackSide} transparent opacity={0.25} depthWrite={false} /></mesh>
        <mesh position={[0, -h / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[r, 40]} /><meshToonMaterial color="#b6c1c8" /></mesh>
        {f > 0.01 && <mesh position={[0, -h / 2 + lh / 2 + 0.005, 0]}><cylinderGeometry args={[r * 0.98, r * 0.98, lh, 40]} /><meshToonMaterial color="#3d8fd6" transparent opacity={0.8} /></mesh>}
        <mesh position={[r * 0.55, -h / 2 - 0.05, r * 0.55]}><cylinderGeometry args={[0.06, 0.06, 0.1, 12]} /><meshToonMaterial color="#5c6f7c" /></mesh>
    </>;
}
function ContentItems({ sub, s, ctx }: { sub: DemonstrationSubject; s: SubjectState; ctx: ContainmentContext }) {
    const [dd, h] = sub.size, R = dd / 2, a = clamp01(s.parameters.activity ?? 0), w = clamp01(s.parameters.fillLevel ?? 0), n = 7, ir = R * 0.3, t = ctx.frame / ctx.fps;
    const base = ['#e8784f', '#4fb08a', '#e0b23a'];
    return <>
        {Array.from({ length: n }, (_, i) => {
            const ang = i * Math.PI * 2 / n + seeded(i) * 0.4, rad = R * ((0.12 + 0.3 * seeded(i + 3)) * (1 - a) + 0.74 * a), y = (-h / 2 + ir * 0.6 + (i % 3) * ir * 0.8) * (1 - a) + (-h * 0.32 + (i % 4) * h * 0.2) * a;
            return <mesh key={i} position={[Math.cos(ang) * rad, y, Math.sin(ang) * rad]} rotation={[0, -ang, 0]} scale={[0.55 + 0.45 * (1 - a), 1, 1]}>
                <sphereGeometry args={[ir, 14, 10]} /><meshToonMaterial color={mix(base[i % 3], '#3f5f86', 0.5 * w)} /></mesh>;
        })}
        {w > 0.35 && [0, 1].map(k => { const y = -h / 2 - ((t * 0.9 + k * 0.5) % 1) * 0.3; return <mesh key={'d' + k} position={[Math.cos(k * 2) * R * 0.5, y, Math.sin(k * 2) * R * 0.5]}><sphereGeometry args={[0.03, 8, 6]} /><meshBasicMaterial color="#3d8fd6" transparent opacity={0.4 + 0.5 * w} /></mesh>; })}
    </>;
}
export function ContainmentAssembly({ sub, s, ctx }: { sub: DemonstrationSubject; s: SubjectState; ctx: ContainmentContext }) {
    switch (sub.assembly) {
        case 'ROTATING_CONTAINER': return <RotatingContainer sub={sub} s={s} />;
        case 'OUTER_CONTAINER': return <OuterContainer sub={sub} s={s} />;
        case 'CONTENT_ITEMS': return <ContentItems sub={sub} s={s} ctx={ctx} />;
        default: return null;
    }
}
