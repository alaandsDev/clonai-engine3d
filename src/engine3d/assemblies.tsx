import React from 'react';
import { Vector3, Quaternion, Color, Shape, BackSide, FrontSide, DoubleSide } from 'three';
import type { Vec3 } from './contracts';
import type { DemonstrationSubject, SubjectState } from './demonstration-contracts';
import { MotionAssembly } from './motion-assemblies';
import { FunctionalPart, FUNCTIONAL_VARIANTS } from './functional-parts';
import { ContainmentAssembly, CONTAINMENT_ASSEMBLIES } from './containment-assemblies';
import { EnergyAssembly, ENERGY_ASSEMBLIES } from './energy-assemblies';
/** Phase27B stylized assemblies: generic objects composed from primitives (editorial geometry).
 * Deterministic: animation depends only on the frame number. No asset files. */
export const PALETTE = { GRASS: '#7fb35c', GRASS_DARK: '#5d9142', SOIL_TOP: '#6d4a33', SOIL_MID: '#8c6a47', SOIL_DEEP: '#6c5c50', WATER: '#2b8de0', WATER_LIGHT: '#a6dcff', METAL: '#a3aeb6', METAL_DARK: '#56636d', STONE: '#b9bec2', STONE_DARK: '#7d868d', WALL: '#f2e7d0', ROOF: '#c94b3b', DOOR: '#6b4a36', WINDOW: '#a8dcf2', TRIM: '#ffffff', OUTLINE: '#26303a', PANEL: '#8fa3ae', FRAME: '#5f7380', CARRIAGE: '#e0a93f' } as const;
export interface AssemblyContext { frame: number; fps: number; cutaway: number; flowing: boolean }
const tint = (c: string, h: number) => h > 0 ? '#' + new Color(c).lerp(new Color('#ffffff'), Math.min(0.6, h * 2.4)).getHexString() : c;
function Block({ at, size, color, opacity = 1, outline = false, rotation }: { at: Vec3; size: Vec3; color: string; opacity?: number; outline?: boolean; rotation?: Vec3 }) {
    if (size.some(v => v <= 0)) return null;
    return <group position={at} rotation={rotation}>
        <mesh><boxGeometry args={size} /><meshToonMaterial color={color} transparent={opacity < 1} opacity={opacity} /></mesh>
        {outline && <mesh scale={[1.035, 1.035, 1.035]}><boxGeometry args={size} /><meshBasicMaterial color={PALETTE.OUTLINE} side={BackSide} /></mesh>}
    </group>;
}
const span = (a: number, b: number) => ({ c: (a + b) / 2, s: Math.abs(b - a) });
function Range({ x, y, z, color, opacity, offset = [0, 0, 0] }: { x: [number, number]; y: [number, number]; z: [number, number]; color: string; opacity?: number; offset?: Vec3 }) {
    const X = span(...x), Y = span(...y), Z = span(...z);
    return <Block at={[X.c + offset[0], Y.c + offset[1], Z.c + offset[2]]} size={[X.s, Y.s, Z.s]} color={color} opacity={opacity} />;
}
/** Shared section geometry so a terrain block and a liquid band embedded in it agree on the cut. */
export function sectionGeometry(size: Vec3) { const [W, H, D] = size; return { W, H, D, hw: Math.min(1.0, W * 0.14), cutZ: -D * 0.1, x0: -W / 2, x1: W / 2, y0: H / 2, y1: -H / 2, z0: -D / 2, z1: D / 2 }; }
const seeded = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
/** Solid terrain block with grass top and editorial (unlabelled) tone strata. A front notch around the
 * system slides out as the section opens: the cut face is clean and vertical. */
function TerrainSection({ sub, ctx, highlight }: { sub: DemonstrationSubject; ctx: AssemblyContext; highlight: number }) {
    const g = sectionGeometry(sub.size), strata: [number, number, string][] = [[g.y0, g.y0 - 0.9, PALETTE.SOIL_TOP], [g.y0 - 0.9, g.y0 - 2.4, PALETTE.SOIL_MID], [g.y0 - 2.4, g.y1, PALETTE.SOIL_DEEP]];
    const parts: { x: [number, number]; z: [number, number] }[] = [{ x: [g.x0, g.x1], z: [g.z0, g.cutZ] }, { x: [g.x0, -g.hw], z: [g.cutZ, g.z1] }, { x: [g.hw, g.x1], z: [g.cutZ, g.z1] }];
    const open = Math.max(0, Math.min(1, ctx.cutaway)), fillOffset: Vec3 = [0, -open * open * 7, open * 2.6], fillVisible = open < 0.999, grass = tint(PALETTE.GRASS, highlight);
    return <>
        {parts.flatMap((p, i) => strata.map(([a, b, c], k) => <Range key={i + '-' + k} x={p.x} y={[b, a]} z={p.z} color={tint(c, highlight)} />))}
        {parts.map((p, i) => <Range key={'g' + i} x={p.x} y={[g.y0, g.y0 + 0.07]} z={p.z} color={grass} />)}
        <Range x={[-g.hw, g.hw]} y={[g.y1, g.y1 + 0.35]} z={[g.cutZ, g.z1]} color={PALETTE.SOIL_DEEP} />
        {fillVisible && <>{strata.map(([a, b, c], k) => <Range key={'f' + k} x={[-g.hw, g.hw]} y={[Math.max(b, g.y1 + 0.35), a]} z={[g.cutZ, g.z1]} color={c} offset={fillOffset} />)}
            <Range x={[-g.hw, g.hw]} y={[g.y0, g.y0 + 0.07]} z={[g.cutZ, g.z1]} color={grass} offset={fillOffset} /></>}
        {Array.from({ length: 5 }, (_, n) => { const side = n % 2 ? 1 : -1, x = side * (g.hw + 0.35 + seeded(n) * (g.W / 2 - g.hw - 0.6)), z = g.cutZ + 0.3 + seeded(n + 7) * (g.z1 - g.cutZ - 0.6);
            return <mesh key={'t' + n} position={[x, g.y0 + 0.17, z]}><coneGeometry args={[0.12, 0.26, 5]} /><meshToonMaterial color={PALETTE.GRASS_DARK} /></mesh>; })}
    </>;
}
/** Groundwater shown where the section cuts the ground: bands on the cut faces with a light upper edge,
 * and small bubbles drifting toward the section centre (the conduit) while flow is active. */
function LiquidVolume({ sub, ctx, highlight }: { sub: DemonstrationSubject; ctx: AssemblyContext; highlight: number }) {
    const g = sectionGeometry([sub.size[0], 0, sub.size[2]]), hb = sub.size[1] / 2, water = highlight > 0 ? '#' + new Color(PALETTE.WATER).lerp(new Color('#4fb4ff'), Math.min(1, highlight * 4)).getHexString() : PALETTE.WATER, t = ctx.frame / ctx.fps;
    const bubbles = Array.from({ length: 6 }, (_, n) => { const side = n % 2 ? 1 : -1, u = ((t * (ctx.flowing ? 0.45 : 0.12) + seeded(n)) % 1); return [side * g.hw * (1 - u) * 0.95, -hb * 0.6 + seeded(n + 3) * hb * 1.2, g.cutZ + 0.06] as Vec3; });
    return <>
        <Range x={[-g.hw, g.hw]} y={[-hb, hb]} z={[g.cutZ, g.cutZ + 0.05]} color={water} />
        <Range x={[-g.hw, g.hw]} y={[hb - 0.07, hb]} z={[g.cutZ + 0.05, g.cutZ + 0.07]} color={PALETTE.WATER_LIGHT} />
        {[-1, 1].map(side => <React.Fragment key={side}>
            <Range x={side < 0 ? [-g.hw, -g.hw + 0.05] : [g.hw - 0.05, g.hw]} y={[-hb, hb]} z={[g.cutZ, g.z1]} color={water} />
            <Range x={side < 0 ? [-g.hw + 0.05, -g.hw + 0.07] : [g.hw - 0.07, g.hw - 0.05]} y={[hb - 0.07, hb]} z={[g.cutZ, g.z1]} color={PALETTE.WATER_LIGHT} />
            <Range x={side < 0 ? [g.x0, -g.hw] : [g.hw, g.x1]} y={[-hb, hb]} z={[g.z1, g.z1 + 0.04]} color={water} />
        </React.Fragment>)}
        {bubbles.map((p, i) => <mesh key={i} position={p}><sphereGeometry args={[0.05, 8, 6]} /><meshBasicMaterial color={PALETTE.WATER_LIGHT} /></mesh>)}
    </>;
}
function segments(path: Vec3[]) { const lengths = path.slice(1).map((p, i) => new Vector3(...p).distanceTo(new Vector3(...path[i]))); return { lengths, total: lengths.reduce((a, b) => a + b, 0) }; }
function pointAt(path: Vec3[], d: number): Vec3 { const { lengths } = segments(path); let at = d; for (let i = 0; i < lengths.length; i++) { if (at <= lengths[i] || i === lengths.length - 1) { const t = lengths[i] ? Math.min(1, at / lengths[i]) : 0; return path[i].map((v, k) => v + (path[i + 1][k] - v) * t) as Vec3; } at -= lengths[i]; } return path[0]; }
/** Sectioned pipe: the back half-shell is solid (front half removed for inspection), joints are rings,
 * water fills from the start of the path and light markers travel in the flow direction. */
function Pipe({ sub, s, ctx, highlight }: { sub: DemonstrationSubject; s: SubjectState; ctx: AssemblyContext; highlight: number }) {
    const path = sub.path!, r = sub.size[0], { lengths, total } = segments(path), connected = (s.parameters.connection ?? 0) * total, filled = Math.min(connected, (s.parameters.flowProgress ?? 0) * total);
    let d = 0; const shells: React.ReactNode[] = [], waters: React.ReactNode[] = [];
    lengths.forEach((len, i) => {
        const a = new Vector3(...path[i]), b = new Vector3(...path[i + 1]), dir = b.clone().sub(a).normalize(), q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
        const shellLen = Math.max(0, Math.min(len, connected - d)), waterLen = Math.max(0, Math.min(len, filled - d));
        if (shellLen > 0.001) { const mid = a.clone().add(dir.clone().multiplyScalar(shellLen / 2)); shells.push(<group key={'s' + i} position={mid} quaternion={q}>
            <mesh><cylinderGeometry args={[r, r, shellLen, 18, 1, true, Math.PI / 2, Math.PI]} /><meshToonMaterial color={tint(PALETTE.METAL, highlight)} side={FrontSide} /></mesh>
            <mesh><cylinderGeometry args={[r * 0.97, r * 0.97, shellLen, 18, 1, true, Math.PI / 2, Math.PI]} /><meshToonMaterial color={PALETTE.METAL_DARK} side={BackSide} /></mesh></group>); }
        if (waterLen > 0.001) { const mid = a.clone().add(dir.clone().multiplyScalar(waterLen / 2)); waters.push(<mesh key={'w' + i} position={mid} quaternion={q}><cylinderGeometry args={[r * 0.72, r * 0.72, waterLen, 14]} /><meshToonMaterial color={PALETTE.WATER} /></mesh>); }
        d += len;
    });
    const joints = path.filter((_, i) => { if (i === 0 || i === path.length - 1) return false; let at = 0; for (let k = 0; k < i; k++) at += lengths[k]; return at <= connected + 1e-6; });
    const spacing = 0.42, markers = filled > 0.05 ? Array.from({ length: Math.floor(filled / spacing) }, (_, n) => pointAt(path, (n * spacing + (ctx.frame * 0.035) % spacing) % Math.max(filled, 1e-6))) : [];
    return <>{shells}{waters}
        {joints.map((p, i) => <mesh key={'j' + i} position={p}><sphereGeometry args={[r * 1.12, 14, 10]} /><meshToonMaterial color={PALETTE.METAL_DARK} /></mesh>)}
        {markers.map((p, i) => <mesh key={'m' + i} position={[p[0], p[1], p[2] + r * 0.25]}><sphereGeometry args={[r * 0.3, 8, 6]} /><meshBasicMaterial color={PALETTE.WATER_LIGHT} /></mesh>)}</>;
}
/** Open basin/head: stone collar on the ground, solid wall, darker inner wall, rim, liquid at fill level. */
function OpenBasin({ sub, s, highlight }: { sub: DemonstrationSubject; s: SubjectState; highlight: number }) {
    const [dia, h] = sub.size, r = dia / 2, fill = s.parameters.fillLevel ?? 0;
    return <>
        <mesh position={[0, -h / 2 + 0.035, 0]}><cylinderGeometry args={[r * 1.35, r * 1.42, 0.07, 24]} /><meshToonMaterial color={PALETTE.STONE_DARK} /></mesh>
        <mesh><cylinderGeometry args={[r, r * 1.04, h, 24, 1, true]} /><meshToonMaterial color={tint(PALETTE.STONE, highlight)} side={FrontSide} /></mesh>
        <mesh><cylinderGeometry args={[r * 0.9, r * 0.9, h, 24, 1, true]} /><meshToonMaterial color={PALETTE.STONE_DARK} side={DoubleSide} /></mesh>
        <mesh position={[0, -h / 2 + 0.02, 0]}><cylinderGeometry args={[r * 0.9, r * 0.9, 0.04, 24]} /><meshToonMaterial color={PALETTE.METAL_DARK} /></mesh>
        <mesh position={[0, h / 2, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[r * 0.95, r * 0.09, 8, 28]} /><meshToonMaterial color={PALETTE.STONE_DARK} /></mesh>
        {fill > 0.01 && <mesh position={[0, -h / 2 + 0.04 + h * 0.9 * fill / 2, 0]}><cylinderGeometry args={[r * 0.88, r * 0.88, h * 0.9 * fill, 24]} /><meshToonMaterial color={PALETTE.WATER} /></mesh>}
    </>;
}
/** Gabled building: walls with outline, prism roof, door and framed windows, contact base. */
function GabledBuilding({ sub, highlight }: { sub: DemonstrationSubject; highlight: number }) {
    const [w, h, d] = sub.size, wallH = h * 0.62, base = -h / 2, roofShape = new Shape(); roofShape.moveTo(-w * 0.58, 0); roofShape.lineTo(w * 0.58, 0); roofShape.lineTo(0, h * 0.4); roofShape.lineTo(-w * 0.58, 0);
    return <>
        <Block at={[0, base + wallH / 2, 0]} size={[w, wallH, d]} color={tint(PALETTE.WALL, highlight)} outline />
        <Block at={[0, base + 0.04, 0]} size={[w * 1.04, 0.08, d * 1.04]} color={PALETTE.STONE_DARK} />
        <group position={[0, base + wallH, -d * 0.56]}><mesh><extrudeGeometry args={[roofShape, { depth: d * 1.12, bevelEnabled: false }]} /><meshToonMaterial color={PALETTE.ROOF} /></mesh>
            <mesh scale={[1.03, 1.05, 1]} position={[0, -0.01, -0.01]}><extrudeGeometry args={[roofShape, { depth: d * 1.14, bevelEnabled: false }]} /><meshBasicMaterial color={PALETTE.OUTLINE} side={BackSide} /></mesh></group>
        <Block at={[-w * 0.18, base + wallH * 0.32, d / 2 + 0.01]} size={[w * 0.2, wallH * 0.62, 0.04]} color={PALETTE.DOOR} />
        {[0.22].map(x => <React.Fragment key={x}><Block at={[w * x, base + wallH * 0.58, d / 2 + 0.01]} size={[w * 0.24, wallH * 0.3, 0.035]} color={PALETTE.TRIM} />
            <Block at={[w * x, base + wallH * 0.58, d / 2 + 0.025]} size={[w * 0.18, wallH * 0.22, 0.03]} color={PALETTE.WINDOW} /></React.Fragment>)}
    </>;
}
function FramePanel({ sub, highlight }: { sub: DemonstrationSubject; highlight: number }) {
    const [w, h, d] = sub.size;
    return <><Block at={[0, 0, 0]} size={[w, h, d]} color={tint(PALETTE.PANEL, highlight)} />
        {[-1, 1].map(s => <Block key={s} at={[s * (w / 2 - 0.06), 0, d / 2 + 0.04]} size={[0.12, h, 0.08]} color={PALETTE.FRAME} />)}
        {[-0.33, 0, 0.33].map(y => <Block key={y} at={[0, y * h, d / 2 + 0.03]} size={[w, 0.07, 0.06]} color={PALETTE.FRAME} />)}</>;
}
function Panel({ sub, highlight }: { sub: DemonstrationSubject; highlight: number }) {
    const [w, h, d] = sub.size;
    return <><Block at={[0, 0, 0]} size={[w, h, d]} color={tint('#a9bcc6', highlight)} outline /><Block at={[0, h / 2 - 0.05, d / 2 + 0.02]} size={[w, 0.1, 0.04]} color={PALETTE.FRAME} /><Block at={[0, -h / 2 + 0.05, d / 2 + 0.02]} size={[w, 0.1, 0.04]} color={PALETTE.FRAME} /></>;
}
function Carriage({ sub, highlight }: { sub: DemonstrationSubject; highlight: number }) {
    const [w, h, d] = sub.size;
    return <><Block at={[0, 0, 0]} size={[w, h, d]} color={tint(PALETTE.CARRIAGE, highlight)} outline />
        <Block at={[0, h * 0.12, d / 2 + 0.02]} size={[w * 0.8, h * 0.4, 0.03]} color={PALETTE.WINDOW} />
        <Block at={[0, h / 2 + 0.04, 0]} size={[w * 1.05, 0.08, d * 1.05]} color={PALETTE.FRAME} /><Block at={[0, -h / 2 - 0.04, 0]} size={[w * 1.05, 0.08, d * 1.05]} color={PALETTE.FRAME} /></>;
}
function DisplayBlock({ sub, highlight }: { sub: DemonstrationSubject; highlight: number }) {
    const [w, h, d] = sub.size;
    return <><Block at={[0, -h / 2 + 0.05, 0]} size={[w * 1.15, 0.1, d * 1.15]} color={PALETTE.FRAME} /><Block at={[0, 0.03, 0]} size={[w, h * 0.8, d]} color={tint(sub.color, highlight)} outline /><Block at={[0, h * 0.43, 0]} size={[w * 1.04, 0.07, d * 1.04]} color={PALETTE.STONE} /></>;
}
/** Rotor (Phase29): hub, curved blades and shaft in the XY plane (axis along Z), so a ROTATE about Z
 * spins it. Blade colour contrasts with the casing so rotation is readable at phone size. */
function Rotor({ sub, highlight }: { sub: DemonstrationSubject; highlight: number }) {
    const r = sub.size[0] / 2, depth = sub.size[2], n = 7, blade = tint('#e0a93f', highlight);
    return <>
        <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[r * 0.26, r * 0.26, depth * 1.1, 18]} /><meshToonMaterial color={PALETTE.METAL_DARK} /></mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -depth * 0.9]}><cylinderGeometry args={[r * 0.09, r * 0.09, depth * 1.6, 10]} /><meshToonMaterial color={PALETTE.METAL} /></mesh>
        {Array.from({ length: n }, (_, i) => { const a = i * Math.PI * 2 / n; return <group key={i} rotation={[0, 0, a]}>
            <Block at={[r * 0.5, r * 0.05, 0]} size={[r * 0.5, r * 0.16, depth * 0.8]} color={blade} rotation={[0, 0, 0.35]} outline />
            <Block at={[r * 0.82, r * 0.2, 0]} size={[r * 0.28, r * 0.14, depth * 0.8]} color={blade} rotation={[0, 0, 0.75]} outline /></group>; })}
        <mesh position={[0, 0, depth * 0.56]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[r * 0.13, r * 0.13, 0.03, 14]} /><meshToonMaterial color={PALETTE.TRIM} /></mesh>
    </>;
}
/** Vane ring / round machine housing (Phase29): casing ring facing +Z with static guide vanes, a dark
 * back plate and a pedestal down to the floor. size = [ring diameter, total height, depth]. */
function VaneRing({ sub, highlight }: { sub: DemonstrationSubject; highlight: number }) {
    const [d, h, depth] = sub.size, r = d / 2, cy = h / 2 - r, n = 10, casing = tint(PALETTE.METAL, highlight), foot = Math.max(0.05, h - d);
    return <>
        <mesh position={[0, cy, -depth * 0.45]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[r * 0.98, r * 0.98, 0.06, 32]} /><meshToonMaterial color={PALETTE.METAL_DARK} /></mesh>
        <mesh position={[0, cy, 0]}><torusGeometry args={[r * 0.92, r * 0.1, 10, 40]} /><meshToonMaterial color={casing} /></mesh>
        <mesh position={[0, cy, 0]} scale={[1.04, 1.04, 1.04]}><torusGeometry args={[r * 0.92, r * 0.1, 10, 40]} /><meshBasicMaterial color={PALETTE.OUTLINE} side={BackSide} /></mesh>
        <mesh position={[0, cy, -depth * 0.2]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[r * 0.98, r * 0.98, depth * 0.5, 32, 1, true]} /><meshToonMaterial color={PALETTE.METAL_DARK} side={DoubleSide} /></mesh>
        {Array.from({ length: n }, (_, i) => { const a = i * Math.PI * 2 / n + 0.2; return <group key={i} position={[0, cy, 0]} rotation={[0, 0, a]}>
            <Block at={[r * 0.72, 0, -depth * 0.05]} size={[r * 0.22, r * 0.05, depth * 0.5]} color={tint(PALETTE.FRAME, highlight)} rotation={[0, 0, 1.0]} /></group>; })}
        <Block at={[0, -h / 2 + foot / 2, -depth * 0.1]} size={[d * 0.34, foot, depth * 0.7]} color={PALETTE.STONE} outline />
        <Block at={[0, -h / 2 + 0.05, -depth * 0.1]} size={[d * 0.9, 0.1, depth * 1.1]} color={PALETTE.STONE_DARK} />
    </>;
}
/** Raised ground (Phase29): a grassy terrain step with soil sides; editorial support for elevated things. */
function RaisedGround({ sub, highlight }: { sub: DemonstrationSubject; highlight: number }) {
    const [w, h, d] = sub.size;
    return <>
        <Block at={[0, -h * 0.25, 0]} size={[w, h * 0.5, d]} color={PALETTE.SOIL_DEEP} />
        <Block at={[0, h * 0.2, 0]} size={[w, h * 0.4, d]} color={PALETTE.SOIL_MID} />
        <Block at={[0, h * 0.44, 0]} size={[w, h * 0.08, d]} color={PALETTE.SOIL_TOP} />
        <Block at={[0, h / 2 + 0.035, 0]} size={[w * 1.01, 0.07, d * 1.01]} color={tint(PALETTE.GRASS, highlight)} />
        {Array.from({ length: 4 }, (_, n) => <mesh key={n} position={[(seeded(n) - 0.5) * w * 0.8, h / 2 + 0.12, (seeded(n + 5) - 0.5) * d * 0.8]}><coneGeometry args={[0.1, 0.22, 5]} /><meshToonMaterial color={PALETTE.GRASS_DARK} /></mesh>)}
    </>;
}
/** Vessel (Phase29): a metal pot in section view (front half removed, like the pipe), with handles, the liquid at
 * fillLevel and bubbles rising while activity (boiling) is on. size = [diameter, height, diameter]. */
function Vessel({ sub, s, ctx, highlight }: { sub: DemonstrationSubject; s: SubjectState; ctx: AssemblyContext; highlight: number }) {
    const [d, h] = sub.size, r = d / 2, fill = s.parameters.fillLevel ?? 0, act = s.parameters.activity ?? 0, t = ctx.frame / ctx.fps, metal = tint('#b8c2c9', highlight), lh = h * 0.86 * fill;
    return <>
        <mesh><cylinderGeometry args={[r, r * 0.96, h, 32, 1, true, Math.PI / 2, Math.PI]} /><meshToonMaterial color={metal} side={DoubleSide} /></mesh>
        <mesh position={[0, -h / 2 + 0.03, 0]}><cylinderGeometry args={[r * 0.96, r * 0.96, 0.06, 32]} /><meshToonMaterial color={PALETTE.METAL_DARK} /></mesh>
        <mesh position={[0, h / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[r, 0.035, 8, 40, Math.PI]} /><meshToonMaterial color={PALETTE.METAL_DARK} /></mesh>
        {[-1, 1].map(x => <Block key={x} at={[x * (r + 0.12), h * 0.3, -0.02]} size={[0.26, 0.07, 0.14]} color={PALETTE.OUTLINE} />)}
        {fill > 0.01 && <mesh position={[0, -h / 2 + 0.06 + lh / 2, 0]}><cylinderGeometry args={[r * 0.94, r * 0.94, lh, 32, 1, false, Math.PI / 2, Math.PI]} /><meshToonMaterial color={PALETTE.WATER} side={DoubleSide} /></mesh>}
        {fill > 0.01 && <mesh position={[0, -h / 2 + 0.065 + lh, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[r * 0.94, 32, 0, Math.PI]} /><meshToonMaterial color={PALETTE.WATER_LIGHT} side={DoubleSide} /></mesh>}
        {act > 0.05 && fill > 0.01 && Array.from({ length: 10 }, (_, n) => { const u = (t * (0.6 + act) + seeded(n)) % 1, a = seeded(n + 9) * Math.PI; return <mesh key={n} position={[Math.cos(a) * r * 0.7 * seeded(n + 3), -h / 2 + 0.08 + u * lh, -Math.sin(a) * r * 0.6 * seeded(n + 5)]}><sphereGeometry args={[0.035 + 0.03 * act * seeded(n + 1), 8, 6]} /><meshBasicMaterial color="#ffffff" /></mesh>; })}
    </>;
}
/** Lid (Phase29): a domed disk with a knob and a dark sealing ring underneath. Opens by tilting about its back edge. */
function Lid({ sub, highlight }: { sub: DemonstrationSubject; highlight: number }) {
    const [d, h] = sub.size, r = d / 2;
    return <group position={[0, 0, r]}><group position={[0, 0, -r]}>
        <mesh><cylinderGeometry args={[r * 0.98, r, h * 0.5, 32]} /><meshToonMaterial color={tint('#c7d0d6', highlight)} /></mesh>
        <mesh position={[0, h * 0.25, 0]} scale={[1, 0.22, 1]}><sphereGeometry args={[r * 0.96, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshToonMaterial color={tint('#c7d0d6', highlight)} /></mesh>
        <mesh position={[0, -h * 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[r * 0.96, 0.03, 8, 40]} /><meshToonMaterial color="#2d2d2d" /></mesh>
        <Block at={[0, h * 0.25 + r * 0.22 + 0.05, 0]} size={[r * 0.5, 0.08, 0.12]} color={PALETTE.OUTLINE} />
    </group></group>;
}
/** Flame / heat source (Phase29): a burner ring with flickering flames whose height follows activity (0 = off). */
function Flame({ sub, ctx, s }: { sub: DemonstrationSubject; ctx: AssemblyContext; s: SubjectState }) {
    const [d, h] = sub.size, r = d / 2, act = s.parameters.activity ?? 0, t = ctx.frame / ctx.fps;
    return <>
        <mesh position={[0, -h / 2 + 0.06, 0]}><cylinderGeometry args={[r * 1.15, r * 1.2, 0.12, 24]} /><meshToonMaterial color="#3a3f44" /></mesh>
        <mesh position={[0, -h / 2 + 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[r * 0.55, 0.05, 8, 24]} /><meshToonMaterial color={PALETTE.METAL_DARK} /></mesh>
        {[-1,1].flatMap(x=>[-1,1].map(z=><Block key={'support'+x+z} at={[x*d*.32,h*.1,z*d*.32]} size={[d*.08,h*.67,d*.08]} color={PALETTE.METAL_DARK}/>))}
        {[0, 1, 2, 3].map(k => <Block key={k} at={[0, h / 2 - 0.03, 0]} size={[d * 1.1, 0.05, 0.06]} rotation={[0, k * Math.PI / 4, 0]} color={PALETTE.OUTLINE} />)}
        {act > 0.02 && Array.from({ length: 6 }, (_, n) => { const a = n * Math.PI / 3, fl = 0.75 + 0.25 * Math.sin(t * 13 + n * 1.7), fh = h * 0.7 * act * fl;
            return <group key={n} position={[Math.cos(a) * r * 0.55, -h / 2 + 0.16 + fh / 2, Math.sin(a) * r * 0.55]}>
                <mesh><coneGeometry args={[0.07, fh, 8]} /><meshBasicMaterial color="#ff8a1f" /></mesh>
                <mesh position={[0, -fh * 0.2, 0]}><coneGeometry args={[0.04, fh * 0.55, 8]} /><meshBasicMaterial color="#4f8dff" /></mesh></group>; })}
    </>;
}
/** Steam plume (Phase29): puffs rising and fading; amount follows activity (0 = none). */
function SteamPlume({ sub, ctx, s }: { sub: DemonstrationSubject; ctx: AssemblyContext; s: SubjectState }) {
    const [w, h] = sub.size, act = s.parameters.activity ?? 0, t = ctx.frame / ctx.fps;
    if (act < 0.02) return null;
    return <>{Array.from({ length: 7 }, (_, n) => { const u = (t * 0.7 + n / 7) % 1, sz = (0.08 + u * 0.22) * (0.6 + 0.4 * act) * w * 2;
        return <group key={n} position={[Math.sin(n * 2.3 + t) * w * 0.25 * u, -h / 2 + u * h, Math.cos(n * 1.7) * w * 0.15 * u]}><mesh><sphereGeometry args={[sz, 12, 10]} /><meshToonMaterial color="#e9eff4" transparent opacity={(.95-u*.3)*act} depthWrite={false} /></mesh><mesh scale={[1.065,1.065,1.065]}><sphereGeometry args={[sz,12,10]}/><meshBasicMaterial color="#718995" transparent opacity={(.60-u*.25)*act} side={BackSide} depthWrite={false}/></mesh></group>; })}</>;
}
/** Peg (Phase29): a small stem with a weighted cap (pin, small valve, knob). */
function Peg({ sub, highlight }: { sub: DemonstrationSubject; highlight: number }) {
    const [d, h] = sub.size;
    if(sub.variant==='CONTROL')return <>
      <Block at={[0,-h*.25,0]} size={[d*1.15,h*.5,d*.85]} color="#647784" />
      <mesh><cylinderGeometry args={[d*.2,d*.2,h*.7,12]}/><meshToonMaterial color={PALETTE.METAL_DARK}/></mesh>
      <Block at={[0,h*.28,0]} size={[d*1.5,h*.16,d*.3]} color={tint('#c8b17b',highlight)} />
    </>;
    if(sub.variant==='STEM')return <>
      <mesh position={[0,-h*.4,0]}><cylinderGeometry args={[d*.15,d*.15,h*1.7,12]}/><meshToonMaterial color={PALETTE.METAL_DARK}/></mesh>
      <mesh position={[0,h*.28,0]}><cylinderGeometry args={[d*.53,d*.45,h*.34,16]}/><meshToonMaterial color={tint('#aebcc5',highlight)}/></mesh>
      <mesh position={[0,h*.28,0]} scale={[1.035,1.035,1.035]}><cylinderGeometry args={[d*.53,d*.45,h*.34,16]}/><meshBasicMaterial color={PALETTE.OUTLINE} side={BackSide}/></mesh>
    </>;
    return <>
        <mesh position={[0, -h * 0.15, 0]}><cylinderGeometry args={[d * 0.18, d * 0.18, h * 0.7, 12]} /><meshToonMaterial color={PALETTE.METAL_DARK} /></mesh>
        <mesh position={[0, h * 0.25, 0]}><cylinderGeometry args={[d * 0.5, d * 0.42, h * 0.5, 16]} /><meshToonMaterial color={tint('#7d868d', highlight)} /></mesh>
        <mesh position={[0, h * 0.25, 0]} scale={[1.06, 1.06, 1.06]}><cylinderGeometry args={[d * 0.5, d * 0.42, h * 0.5, 16]} /><meshBasicMaterial color={PALETTE.OUTLINE} side={BackSide} /></mesh>
    </>;
}
export function AssemblyGeometry({ sub, s, ctx }: { sub: DemonstrationSubject; s: SubjectState; ctx: AssemblyContext }) {
    const highlight = s.parameters.highlight ?? 0;
    // Phase29: a functional silhouette (selected from the part's stated role) replaces the assembly's default shape.
    if (sub.variant && FUNCTIONAL_VARIANTS.has(sub.variant)) return <FunctionalPart sub={sub} s={s} ctx={ctx} />;
    if (sub.assembly && CONTAINMENT_ASSEMBLIES.has(sub.assembly)) return <ContainmentAssembly sub={sub} s={s} ctx={ctx} />;
    if (sub.assembly && ENERGY_ASSEMBLIES.has(sub.assembly)) return <EnergyAssembly sub={sub} s={s} ctx={ctx} />;
    switch (sub.assembly) {
        case 'TERRAIN_SECTION': return <TerrainSection sub={sub} ctx={ctx} highlight={highlight} />;
        case 'LIQUID_VOLUME': return <LiquidVolume sub={sub} ctx={ctx} highlight={highlight} />;
        case 'PIPE': return <Pipe sub={sub} s={s} ctx={ctx} highlight={highlight} />;
        case 'OPEN_BASIN': return <OpenBasin sub={sub} s={s} highlight={highlight} />;
        case 'GABLED_BUILDING': return <GabledBuilding sub={sub} highlight={highlight} />;
        case 'FRAME_PANEL': return <FramePanel sub={sub} highlight={highlight} />;
        case 'PANEL': return <Panel sub={sub} highlight={highlight} />;
        case 'CARRIAGE': return <Carriage sub={sub} highlight={highlight} />;
        case 'DISPLAY_BLOCK': return <DisplayBlock sub={sub} highlight={highlight} />;
        case 'ROTOR': return <Rotor sub={sub} highlight={highlight} />;
        case 'VANE_RING': return <VaneRing sub={sub} highlight={highlight} />;
        case 'RAISED_GROUND': return <RaisedGround sub={sub} highlight={highlight} />;
        case 'VESSEL': return <Vessel sub={sub} s={s} ctx={ctx} highlight={highlight} />;
        case 'LID': return <Lid sub={sub} highlight={highlight} />;
        case 'FLAME': return <Flame sub={sub} ctx={ctx} s={s} />;
        case 'STEAM_PLUME': return <SteamPlume sub={sub} ctx={ctx} s={s} />;
        case 'PEG': return <Peg sub={sub} highlight={highlight} />;
        default: return <MotionAssembly sub={sub} s={s} ctx={ctx} />;
    }
}
/** Soft contact shadow (blob) that grounds an object on the floor plane. */
export function ContactShadow({ at, radius, opacity = 0.22 }: { at: Vec3; radius: number; opacity?: number }) {
    return <mesh position={[at[0], at[1] + 0.012, at[2]]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[radius, 24]} /><meshBasicMaterial color="#1d2a1a" transparent opacity={opacity} depthWrite={false} /></mesh>;
}
/** Stylized backdrop used only when a program declares assemblies: ground plate with an opening around the
 * terrain section (no split slabs), gradient sky dome, distant hills and a hemisphere + key/rim light rig. */
/** setting: the medium the scene happens in, chosen from the program's medium field (sky, water) or the default ground. */
/** night: 0 = day, 1 = night (follows the brightness of a radiant source on stage; 0 when there is none). */
export interface EnvironmentStyle { stylized: true; hole?: { x: [number, number]; z: [number, number] }; cut?: number; setting?: 'GROUND' | 'SKY' | 'WATER' | 'INDOOR'; night?: number }
const SKY_VERTEX = 'varying vec3 vP; void main(){ vP = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP,1.0); }';
const SKY_FRAGMENT = 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y * 1.6 + 0.08, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0); }';
export function StylizedBackdrop({ style, ground, sky }: { style: EnvironmentStyle; ground: string; sky: [string, string] }) {
    const h = style.hole, plate = 120, y = -0.15, t = 0.25, half = plate / 2;
    const pieces: [Vec3, Vec3][] = h ? [
        [[0, y, (h.z[1] + half) / 2], [plate, t, half - h.z[1]]], [[0, y, (h.z[0] - half) / 2], [plate, t, h.z[0] + half]],
        [[(h.x[0] - half) / 2, y, (h.z[0] + h.z[1]) / 2], [h.x[0] + half, t, h.z[1] - h.z[0]]], [[(h.x[1] + half) / 2, y, (h.z[0] + h.z[1]) / 2], [half - h.x[1], t, h.z[1] - h.z[0]]]
    ] : [[[0, y, 0], [plate, t, plate]]];
    // The section opens the world like a diorama: the floor in front of the cut face fades away.
    const front = h ? Math.max(0, Math.min(1, (style.cut ?? 0) / 0.3)) : 0;
    // In the sky there is no floor at the stage: only the sky dome (the medium field draws what is far below).
    // Indoors the room draws floor and walls: only a warm ambient light here (no sky dome, no ground plate).
    if (style.setting === 'INDOOR') return <><hemisphereLight args={['#fff6ea', '#a08a70', 1.0]} /></>;
    if (style.setting === 'SKY') return <><hemisphereLight args={['#eaf6ff', '#4f8fb0', 1.0]} />
        <mesh renderOrder={-1}><sphereGeometry args={[150, 24, 12]} /><shaderMaterial side={BackSide} depthWrite={false} fog={false} vertexShader={SKY_VERTEX} fragmentShader={SKY_FRAGMENT} uniforms={{ top: { value: new Color('#3f8fd6') }, bottom: { value: new Color('#cfe8f7') } }} /></mesh></>;
    const n = style.night ?? 0;
    return <>
        <hemisphereLight args={['#dff1ff', '#6f8a55', 0.9 * (1 - 0.55 * n)]} />
        <mesh renderOrder={-1}><sphereGeometry args={[80, 24, 12]} /><shaderMaterial side={BackSide} depthWrite={false} fog={false} vertexShader={SKY_VERTEX} fragmentShader={SKY_FRAGMENT} uniforms={{ top: { value: new Color(sky[0]).lerp(new Color('#0b1638'), n) }, bottom: { value: new Color(sky[1]).lerp(new Color('#3b4a78'), n) } }} /></mesh>
        {pieces.map(([at, size], i) => (i === 0 && front >= 0.999) ? null : <mesh key={i} position={i === 0 ? [at[0], at[1] - front * front * 9, at[2]] : at}><boxGeometry args={size} /><meshToonMaterial color={ground} /></mesh>)}
        {[[-14, -26, 9, '#8fb98a'], [6, -30, 12, '#86b083'], [22, -24, 8, '#93bd8d'], [-30, -20, 10, '#9cc596']].map(([x, z, r, c], i) =>
            <mesh key={'h' + i} position={[x as number, -0.2, z as number]} scale={[1, 0.32, 0.7]}><sphereGeometry args={[r as number, 20, 10]} /><meshToonMaterial color={c as string} /></mesh>)}
    </>;
}
