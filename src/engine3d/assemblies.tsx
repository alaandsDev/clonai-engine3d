import React from 'react';
import { Vector3, Quaternion, Color, Shape, BackSide, FrontSide, DoubleSide } from 'three';
import type { Vec3 } from './contracts';
import type { DemonstrationSubject, SubjectState } from './demonstration-contracts';
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
export function AssemblyGeometry({ sub, s, ctx }: { sub: DemonstrationSubject; s: SubjectState; ctx: AssemblyContext }) {
    const highlight = s.parameters.highlight ?? 0;
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
        default: return null;
    }
}
/** Soft contact shadow (blob) that grounds an object on the floor plane. */
export function ContactShadow({ at, radius, opacity = 0.22 }: { at: Vec3; radius: number; opacity?: number }) {
    return <mesh position={[at[0], at[1] + 0.012, at[2]]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[radius, 24]} /><meshBasicMaterial color="#1d2a1a" transparent opacity={opacity} depthWrite={false} /></mesh>;
}
/** Stylized backdrop used only when a program declares assemblies: ground plate with an opening around the
 * terrain section (no split slabs), gradient sky dome, distant hills and a hemisphere + key/rim light rig. */
export interface EnvironmentStyle { stylized: true; hole?: { x: [number, number]; z: [number, number] }; cut?: number }
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
    return <>
        <hemisphereLight args={['#dff1ff', '#6f8a55', 0.9]} />
        <mesh renderOrder={-1}><sphereGeometry args={[80, 24, 12]} /><shaderMaterial side={BackSide} depthWrite={false} fog={false} vertexShader={SKY_VERTEX} fragmentShader={SKY_FRAGMENT} uniforms={{ top: { value: new Color(sky[0]) }, bottom: { value: new Color(sky[1]) } }} /></mesh>
        {pieces.map(([at, size], i) => (i === 0 && front >= 0.999) ? null : <mesh key={i} position={i === 0 ? [at[0], at[1] - front * front * 9, at[2]] : at}><boxGeometry args={size} /><meshToonMaterial color={ground} /></mesh>)}
        {[[-14, -26, 9, '#8fb98a'], [6, -30, 12, '#86b083'], [22, -24, 8, '#93bd8d'], [-30, -20, 10, '#9cc596']].map(([x, z, r, c], i) =>
            <mesh key={'h' + i} position={[x as number, -0.2, z as number]} scale={[1, 0.32, 0.7]}><sphereGeometry args={[r as number, 20, 10]} /><meshToonMaterial color={c as string} /></mesh>)}
    </>;
}
