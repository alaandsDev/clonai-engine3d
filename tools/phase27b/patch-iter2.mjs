import {readFileSync,writeFileSync} from 'node:fs';
const edit=(f,pairs)=>{let s=readFileSync(f,'utf8');for(const [a,b] of pairs){if(s.split(a).length!==2)throw Error('anchor '+f+': '+a.slice(0,70));s=s.replace(a,b);}writeFileSync(f,s);};
edit('src/engine3d/assemblies.tsx',[
 [`export interface EnvironmentStyle { stylized: true; hole?: { x: [number, number]; z: [number, number] } }`,`export interface EnvironmentStyle { stylized: true; hole?: { x: [number, number]; z: [number, number] }; cut?: number }`],
 [`    return <>
        <hemisphereLight args={['#dff1ff', '#6f8a55', 0.9]} />`,`    // The section opens the world like a diorama: the floor in front of the cut face fades away.
    const front = h ? Math.max(0, Math.min(1, style.cut ?? 0)) : 0;
    return <>
        <hemisphereLight args={['#dff1ff', '#6f8a55', 0.9]} />`],
 [`        {pieces.map(([at, size], i) => <mesh key={i} position={at}><boxGeometry args={size} /><meshToonMaterial color={ground} /></mesh>)}`,`        {pieces.map(([at, size], i) => i === 0 && front > 0 ? (front < 0.999 && <mesh key={i} position={[at[0], at[1] - front * 0.6, at[2]]}><boxGeometry args={size} /><meshToonMaterial color={ground} transparent opacity={1 - front} depthWrite={false} /></mesh>) : <mesh key={i} position={at}><boxGeometry args={size} /><meshToonMaterial color={ground} /></mesh>)}`]]);
edit('src/engine3d/demonstration-geometry.tsx',[[`return { stylized: true, hole: { x: [p[0] - w / 2, p[0] + w / 2], z: [p[2] - d / 2, p[2] + d / 2] } };`,`return { stylized: true, hole: { x: [p[0] - w / 2, p[0] + w / 2], z: [p[2] - d / 2, p[2] + d / 2] }, cut: state.environment.groundCutaway };`]]);
edit('src/visual-causal/compile.ts',[[`  const e=ent(b.focusEntityId),box=screenBox(`,`  const e=ent(b.focusEntityId);
  // A layer is an extended region (medium, stratum): the zone frames a portion of it by design.
  if(e.kind==='LAYER')return zone;
  const box=screenBox(`]]);
edit('src/visual-causal/planner.ts',[
 [`TERRAIN_SUBSURFACE:{WORLD:cam([-1.9,2.7,10.2],[0.45,0.7,-0.5]),SYSTEM:cam([-1.2,1.55,5.6],[-0.35,0.75,0]),CUTAWAY:cam([1.4,0.6,6.4],[0,-1.9,-0.3]),COMPONENT:cam([0.9,-2.2,4.6],[0,-3.4,-0.4]),ACTION:cam([1.0,-1.4,5.8],[0,-2.0,-0.4]),RESULT:cam([-0.6,1.7,5.2],[1.2,0.45,-0.7])}`,
  `TERRAIN_SUBSURFACE:{WORLD:cam([-1.5,2.2,8.4],[0.35,0.8,-0.5]),SYSTEM:cam([0.7,1.6,6.2],[-0.5,0.85,-0.1]),CUTAWAY:cam([1.5,0.9,7.6],[0,-2.0,-0.3]),COMPONENT:cam([1.0,-2.3,5.0],[0,-3.4,-0.4]),ACTION:cam([1.0,-1.4,6.0],[0,-2.0,-0.4]),RESULT:cam([-0.7,1.7,5.4],[1.2,0.45,-0.8])}`],
 [`kind:'CYLINDER',assembly:'OPEN_BASIN',relationIds:[...r.systemRelations],participant:r.system,label:sysLabel,size:[0.8,0.7,0.8],position:[0,0.35,0]`,`kind:'CYLINDER',assembly:'OPEN_BASIN',relationIds:[...r.systemRelations],participant:r.system,label:sysLabel,size:[1.0,0.75,1.0],position:[0,0.375,0]`],
 [`path:r.consumer?[[0.42,0.16,0],[1.55,0.16,0],`,`path:r.consumer?[[0.52,0.16,0],[1.55,0.16,0],`],
 [`home:template==='ENCLOSURE'?[-1.6,0,0.9]:[-1.45,0,0.9]`,`home:template==='ENCLOSURE'?[-1.6,0,0.9]:[-1.4,0,-0.2]`]]);
