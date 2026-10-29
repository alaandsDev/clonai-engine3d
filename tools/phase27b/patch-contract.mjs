import {readFileSync,writeFileSync} from 'node:fs';
const edit=(f,pairs)=>{let s=readFileSync(f,'utf8');for(const [a,b] of pairs){if(s.split(a).length!==2)throw Error('anchor '+f+': '+a.slice(0,70));s=s.replace(a,b);}writeFileSync(f,s);};
edit('src/engine3d/demonstration-contracts.ts',[[`    layer?: 'surface' | 'subsurface' | 'deep';
}`,`    layer?: 'surface' | 'subsurface' | 'deep';
    /** Phase27B: optional generic stylized assembly composed from primitives (visual only). */
    assembly?: Assembly;
}
/** Generic stylized assemblies and the primitive kind each one renders. Editorial geometry only. */
export const ASSEMBLY_KINDS = { TERRAIN_SECTION: 'LAYER', LIQUID_VOLUME: 'LAYER', PIPE: 'PATH', OPEN_BASIN: 'CYLINDER', GABLED_BUILDING: 'BOX', FRAME_PANEL: 'BOX', PANEL: 'BOX', CARRIAGE: 'BOX', DISPLAY_BLOCK: 'BOX' } as const;
export type Assembly = keyof typeof ASSEMBLY_KINDS;
/** Estimated mesh count per assembly (budget accounting, not exact draw calls). */
export const ASSEMBLY_MESHES: Record<Assembly, number> = { TERRAIN_SECTION: 30, LIQUID_VOLUME: 12, PIPE: 14, OPEN_BASIN: 6, GABLED_BUILDING: 9, FRAME_PANEL: 6, PANEL: 3, CARRIAGE: 6, DISPLAY_BLOCK: 3 };`]]);
edit('src/engine3d/demonstration-runtime.ts',[
 [`shape(s, ['id', 'kind', 'resourceId', 'size', 'color', 'path', 'layer'], ['resourceId', 'path', 'layer']);`,`shape(s, ['id', 'kind', 'resourceId', 'size', 'color', 'path', 'layer', 'assembly'], ['resourceId', 'path', 'layer', 'assembly']);
        if (s.assembly !== undefined) { enums(s.assembly, Object.keys(ASSEMBLY_KINDS)); if (ASSEMBLY_KINDS[s.assembly] !== s.kind) fail('DEMONSTRATION_SCHEMA', 'assembly ' + s.assembly + ' requires ' + ASSEMBLY_KINDS[s.assembly]); }`],
 [`meshes += s.kind === 'CYLINDER' ? 3 : s.kind === 'PATH' ? 14 : 1;`,`meshes += s.assembly ? ASSEMBLY_MESHES[s.assembly] : s.kind === 'CYLINDER' ? 3 : s.kind === 'PATH' ? 14 : 1;`],
 [`import { carStates, DEMONSTRATION_COMPILER_VERSION, DEMONSTRATION_LIMITS,`,`import { carStates, ASSEMBLY_KINDS, ASSEMBLY_MESHES, DEMONSTRATION_COMPILER_VERSION, DEMONSTRATION_LIMITS,`]]);
