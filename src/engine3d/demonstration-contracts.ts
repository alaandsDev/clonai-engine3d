import type { Vec3 } from './contracts';
import type { DirectedSequence, Easing } from './directed';
export const DEMONSTRATION_COMPILER_VERSION = 'demonstration-compiler/1.0.0' as const;
export type ClaimType = 'OBJECT_STATE' | 'PROCESS' | 'QUANTITY_CHANGE' | 'SPATIAL_RELATION' | 'CAUSE_EFFECT' | 'COMPARISON';
export type ProofLevel = 'NONE' | 'SYMBOLIC' | 'PARTIAL' | 'DIRECT';
export interface NarrativeClaim {
    id: string;
    text: string;
    type: ClaimType;
    requiresVisualProof: boolean;
    cause?: string;
    transition?: string;
    effect?: string;
}
export interface VisualProof {
    claimId: string;
    proofLevel: ProofLevel;
    evidenceResources: string[];
    demonstrationId?: string;
    rationale: string;
}
export type Operation = 'APPEAR' | 'DISAPPEAR' | 'MOVE' | 'ROTATE' | 'SCALE' | 'CHANGE_STATE' | 'REVEAL' | 'HIDE' | 'ACCUMULATE' | 'DECREASE' | 'INCREASE' | 'FLOW' | 'CONNECT' | 'SEPARATE' | 'HIGHLIGHT';
export interface PropStateDefinition {
    stateId: string;
    parameters: Record<string, number>;
    visualModifiers: {
        tint: string;
    };
    allowedTransitions: string[];
}
export interface EnvironmentState {
    visibility: boolean;
    tint: string;
    fogIntensity: number;
    groundCutaway: number;
    backgroundEmphasis: number;
}
export interface DemonstrationSubject {
    id: string;
    kind: 'PROP' | 'BOX' | 'CYLINDER' | 'PATH' | 'LAYER';
    resourceId?: string;
    size: Vec3;
    color: string;
    path?: Vec3[];
    layer?: 'surface' | 'subsurface' | 'deep';
    /** Phase27B: optional generic stylized assembly composed from primitives (visual only). */
    assembly?: Assembly;
    parentId?:string;
    variant?:'STEM'|'CONTROL'|'PHASE'|'THERMAL'|'KITCHEN_LIKE'|'BATHROOM_LIKE'|'BUILDING_SHAFT'|'WORKSHOP'|'DOOR_FRONT'|'COMPRESSOR_LIKE'|'VALVE_LIKE'|'HEAT_EXCHANGER'|'CONTROL_UNIT'|'COMPRESSION'|'PRESSURE'|'PERFORATED'|'PUMP_LIKE'|'NEUTRAL_INTERIOR'|'CONVERTER_LIKE'|'DISTRIBUTOR_LIKE'|'OUTLET_LIKE'|'METER_LIKE'|'TREE_LIKE'|'LIGHT'|'CHARGE'|'ALTERNATING';
}
/** Generic stylized assemblies and the primitive kind each one renders. Editorial geometry only. */
export const ASSEMBLY_KINDS = { TERRAIN_SECTION: 'LAYER', LIQUID_VOLUME: 'LAYER', PIPE: 'PATH', OPEN_BASIN: 'CYLINDER', GABLED_BUILDING: 'BOX', FRAME_PANEL: 'BOX', PANEL: 'BOX', CARRIAGE: 'BOX', DISPLAY_BLOCK: 'BOX', ROTOR: 'CYLINDER', VANE_RING: 'CYLINDER', RAISED_GROUND: 'BOX', VESSEL: 'CYLINDER', LID: 'CYLINDER', FLAME: 'CYLINDER', STEAM_PLUME: 'CYLINDER', PEG: 'CYLINDER', FUSELAGE: 'BOX', HULL: 'BOX', CAR_BODY: 'BOX', LIFT_SURFACE: 'BOX', PROPULSOR: 'CYLINDER', STREAMLINES: 'CYLINDER', FORCE_ARROW: 'CYLINDER', PRESSURE_FIELD: 'CYLINDER', CLOUD_FIELD: 'CYLINDER', WATER_SURFACE: 'CYLINDER', ROAD_STRIP: 'CYLINDER', STUDIO_BACKDROP: 'CYLINDER', ENCLOSURE: 'CYLINDER', STATE_TINT: 'CYLINDER', MACHINE_UNIT: 'CYLINDER', TRANSFER_PATH: 'PATH', INTERIOR_ROOM: 'CYLINDER', ROTATING_CONTAINER: 'CYLINDER', OUTER_CONTAINER: 'CYLINDER', CONTENT_ITEMS: 'CYLINDER', RADIANT_SOURCE: 'CYLINDER', COLLECTOR_PANEL: 'CYLINDER', CONSUMER_LAMP: 'CYLINDER', UTILITY_POLE: 'CYLINDER', NEIGHBORHOOD: 'CYLINDER', SHADE_TREE: 'CYLINDER' } as const;
export type Assembly = keyof typeof ASSEMBLY_KINDS;
/** Conservative mesh budgets for registered props whose geometry differs from the legacy default. */
export const PROP_MESHES:Record<string,number>={PROP_CAR_001:25,PROP_AIRCRAFT_001:48,PROP_AIRFOIL_001:2,PROP_VECTOR_ARROW_001:2};
/** Estimated mesh count per assembly (budget accounting, not exact draw calls). */
export const ASSEMBLY_MESHES: Record<Assembly, number> = { TERRAIN_SECTION: 22, LIQUID_VOLUME: 14, PIPE: 12, OPEN_BASIN: 6, GABLED_BUILDING: 9, FRAME_PANEL: 6, PANEL: 3, CARRIAGE: 6, DISPLAY_BLOCK: 3, ROTOR: 12, VANE_RING: 16, RAISED_GROUND: 8, VESSEL: 16, LID: 6, FLAME: 22, STEAM_PLUME: 15, PEG: 4, FUSELAGE: 14, HULL: 6, CAR_BODY: 7, LIFT_SURFACE: 6, PROPULSOR: 8, STREAMLINES: 12, FORCE_ARROW: 3, PRESSURE_FIELD: 3, CLOUD_FIELD: 20, WATER_SURFACE: 6, ROAD_STRIP: 6, STUDIO_BACKDROP: 4, ENCLOSURE: 14, STATE_TINT: 10, MACHINE_UNIT: 8, TRANSFER_PATH: 12, INTERIOR_ROOM: 9, ROTATING_CONTAINER: 7, OUTER_CONTAINER: 5, CONTENT_ITEMS: 9, RADIANT_SOURCE: 10, COLLECTOR_PANEL: 12, CONSUMER_LAMP: 4, UTILITY_POLE: 5, NEIGHBORHOOD: 10, SHADE_TREE: 4 };
/** Phase29 functional silhouettes: mesh estimate of a variant that draws a different shape than its assembly's default. */
export const VARIANT_MESHES: Partial<Record<NonNullable<DemonstrationSubject['variant']>, number>> = { COMPRESSOR_LIKE: 8, CONTROL_UNIT: 5, VALVE_LIKE: 6, HEAT_EXCHANGER: 10, COMPRESSION: 10, PRESSURE: 10, PUMP_LIKE: 7, CONVERTER_LIKE: 6, DISTRIBUTOR_LIKE: 6, OUTLET_LIKE: 4, METER_LIKE: 4, TREE_LIKE: 4 };
export interface SubjectState {
    position: Vec3;
    rotation: Vec3;
    scale: Vec3;
    visible: boolean;
    stateId: string;
    parameters: Record<string, number>;
}
export type PresenterMode = 'PRESENTER' | 'DEMONSTRATION' | 'HYBRID';
export interface DemonstrationState {
    subjects: Record<string, SubjectState>;
    environment: EnvironmentState;
    presenterMode: PresenterMode;
}
export interface DemonstrationStep {
    startFrame: number;
    endFrame: number;
    operation: Operation;
    target: string;
    parameters: Record<string, unknown>;
    easing: Easing;
    purpose: string;
}
export interface DemonstrationProgram {
    version: 1;
    compilerVersion: typeof DEMONSTRATION_COMPILER_VERSION;
    id: string;
    purpose: string;
    claim: NarrativeClaim;
    subjects: DemonstrationSubject[];
    initialState: DemonstrationState;
    steps: DemonstrationStep[];
    finalState: DemonstrationState;
    presenterModes: {
        startFrame: number;
        endFrame: number;
        mode: PresenterMode;
    }[];
}
export interface VisualDemonstration extends Omit<DemonstrationProgram, 'compilerVersion'> {
    direction: DirectedSequence;
}
/** subjects / primitiveMeshes bound what is VISIBLE at any frame (simultaneous visual load).
 * subjectsTotal / primitiveMeshesTotal are hard safety ceilings on the whole program (Phase29). */
export const DEMONSTRATION_LIMITS = Object.freeze({ subjects: 10, subjectsTotal: 24, /* Phase29: mechanism scenes show parts plus local state carriers; the mesh budgets below stay the real render guard */ steps: 96, pathPoints: 8, simultaneousOperations: 4, primitiveMeshes: 100, primitiveMeshesTotal: 240, frostPatches: 12, flowParticles: 0 });
export const carStates: PropStateDefinition[] = [
    { stateId: 'NORMAL', parameters: { frost: 0 }, visualModifiers: { tint: '#e44837' }, allowedTransitions: ['FROSTED'] },
    { stateId: 'FROSTED', parameters: { frost: .45 }, visualModifiers: { tint: '#a8d9ed' }, allowedTransitions: ['FROZEN'] },
    { stateId: 'FROZEN', parameters: { frost: 1 }, visualModifiers: { tint: '#b8d9e7' }, allowedTransitions: [] }
];
export const defaultEnvironmentState: EnvironmentState = { visibility: true, tint: '#ffffff', fogIntensity: 0, groundCutaway: 0, backgroundEmphasis: 0 };
