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
}
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
export const DEMONSTRATION_LIMITS = Object.freeze({ subjects: 8, steps: 32, pathPoints: 8, simultaneousOperations: 4, primitiveMeshes: 80, frostPatches: 12, flowParticles: 0 });
export const carStates: PropStateDefinition[] = [
    { stateId: 'NORMAL', parameters: { frost: 0 }, visualModifiers: { tint: '#e44837' }, allowedTransitions: ['FROSTED'] },
    { stateId: 'FROSTED', parameters: { frost: .45 }, visualModifiers: { tint: '#a8d9ed' }, allowedTransitions: ['FROZEN'] },
    { stateId: 'FROZEN', parameters: { frost: 1 }, visualModifiers: { tint: '#b8d9e7' }, allowedTransitions: [] }
];
export const defaultEnvironmentState: EnvironmentState = { visibility: true, tint: '#ffffff', fogIntensity: 0, groundCutaway: 0, backgroundEmphasis: 0 };
