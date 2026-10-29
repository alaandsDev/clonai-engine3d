import {readFileSync,writeFileSync} from 'node:fs';
const edit=(f,pairs)=>{let s=readFileSync(f,'utf8');for(const [a,b] of pairs){if(s.split(a).length!==2)throw Error('anchor '+f+': '+a.slice(0,70));s=s.replace(a,b);}writeFileSync(f,s);};
edit('src/engine3d/demonstration-geometry.tsx',[
 [`import { pathAt } from './demonstration-runtime';`,`import { pathAt } from './demonstration-runtime';
import { AssemblyGeometry, ContactShadow, type AssemblyContext, type EnvironmentStyle } from './assemblies';
/** Stylized environment style derived from a program: active only when some subject declares an assembly,
 * so legacy demonstrations render unchanged. The ground opening follows the terrain section footprint. */
export function environmentStyleOf(program: DemonstrationProgram | undefined, state: DemonstrationState | undefined): EnvironmentStyle | undefined {
    if (!program || !state || !program.subjects.some(s => s.assembly)) return;
    const terrain = program.subjects.find(s => s.assembly === 'TERRAIN_SECTION' && state.subjects[s.id]?.visible);
    if (!terrain) return { stylized: true };
    const p = state.subjects[terrain.id].position, [w, , d] = terrain.size;
    return { stylized: true, hole: { x: [p[0] - w / 2, p[0] + w / 2], z: [p[2] - d / 2, p[2] + d / 2] } };
}`],
 [`export function DemonstrationGeometry({ program, state }: {
    program: DemonstrationProgram;
    state: DemonstrationState;
}) {
    return <>{program.subjects.filter(s => s.kind !== 'PROP').map(sub => {
            const s = state.subjects[sub.id];
            if (!s.visible)
                return null;`,`export function DemonstrationGeometry({ program, state, frame = 0, fps = 30 }: {
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
                    {(sub.assembly === 'GABLED_BUILDING' || sub.assembly === 'OPEN_BASIN') && <ContactShadow at={[0, -sub.size[1] / 2, 0]} radius={Math.max(sub.size[0], sub.size[2]) * 0.85} />}
                    <AssemblyGeometry sub={sub} s={s} ctx={ctx} /></group>;`]]);
edit('src/engine3d/directed-renderer.tsx',[
 [`import {DemonstrationGeometry} from './demonstration-geometry';`,`import {DemonstrationGeometry,environmentStyleOf} from './demonstration-geometry';`],
 [`environmentState={e.state.demonstration?.environment} worldExtras={direction.demonstration&&e.state.demonstration?<DemonstrationGeometry program={direction.demonstration} state={e.state.demonstration}/>:undefined}`,`environmentState={e.state.demonstration?.environment} environmentStyle={environmentStyleOf(direction.demonstration,e.state.demonstration)} worldExtras={direction.demonstration&&e.state.demonstration?<DemonstrationGeometry program={direction.demonstration} state={e.state.demonstration} frame={frame} fps={direction.fps}/>:undefined}`]]);
