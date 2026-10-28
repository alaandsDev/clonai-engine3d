import type { SemanticNarrativeGraph, Domain, NarrativeSegment } from '../semantics/narrative-contracts';
import type { SourceSpan } from '../semantics/contracts';
import type { AutoDirectorInput, AutoDirectorPlan, VisualGap } from '../autodirector/contracts';
import type { DirectedSequence, SequenceState } from '../engine3d/directed';
export const DIRECTOR_VERSION = 'narrative-director/1.0.0';
export const PARTIAL_PLAN_VERSION = 'partial-execution-plan/1.0.0';
export const NARRATIVE_COMPILER_VERSION = 'narrative-compiler/1.0.0';
export type PlanningPolicy = 'PLAN_ONLY' | 'STRICT_FULL' | 'STRICT_ISLANDS';
export interface NarrativeOptions {
    policy?: PlanningPolicy;
    fps?: number;
    canvas?: {
        width: number;
        height: number;
    };
    measuredDurations?: {
        unitId: string;
        durationSeconds: number;
    }[];
}
export interface ClauseTiming {
    clauseId: string;
    unitId: string;
    startFrame: number;
    endFrame: number;
    timing: 'MEASURED_UNIT_ESTIMATED_CLAUSE' | 'ESTIMATED';
}
export interface SemanticStateBoundary {
    entityId: string;
    state: string;
    sourceClaimId: string;
    sourceIslandId: string | null;
    provenance: 'TEXT' | 'EXECUTED_EXPORT';
}
export interface ExecutionIsland {
    id: string;
    segmentId: string;
    domain: Domain;
    clauseIds: string[];
    claimIds: string[];
    sourceSpan: SourceSpan;
    startFrame: number;
    endFrame: number;
    input: AutoDirectorInput;
    autoDirectorPlan: AutoDirectorPlan;
    initialSemanticState: SemanticStateBoundary[];
    requiredIncomingState: SemanticStateBoundary[];
    finalSemanticState: SemanticStateBoundary[];
    exportedState: SemanticStateBoundary[];
    statePolicy: 'RESET' | 'TRANSFER';
    cameraPolicy: 'RESET_CAMERA' | 'REFRAME' | 'CONTINUE_CAMERA' | 'TRANSITION_CAMERA';
    focusPolicy: 'RESET_FOCUS' | 'CONTINUE_FOCUS';
    recoveryAfterGap: boolean;
}
export interface LocalizedVisualGap extends VisualGap {
    segmentId: string;
    claimIds: string[];
    clauseIds: string[];
    sourceSpan: SourceSpan;
    timelineIntent: 'VISUAL_GAP_PLACEHOLDER';
    blocksIsland: boolean;
    recoverable: boolean;
    resumeSegmentId: string | null;
    startFrame: number;
    endFrame: number;
    blockedByClaimIds: string[];
    status: 'UNSUPPORTED' | 'BLOCKED_BY_DEPENDENCY';
}
export interface TimelineItem {
    id: string;
    kind: 'ISLAND' | 'VISUAL_GAP_PLACEHOLDER';
    islandId: string | null;
    gapIds: string[];
    clauseIds: string[];
    claimIds: string[];
    startFrame: number;
    endFrame: number;
    reviewOnly: boolean;
}
export interface PartialExecutionPlan {
    version: 1;
    planVersion: string;
    directorVersion: string;
    id: string;
    graphFingerprint: string;
    graph: SemanticNarrativeGraph;
    policy: PlanningPolicy;
    fps: number;
    canvas: {
        width: number;
        height: number;
    };
    totalFrames: number;
    clauseTiming: ClauseTiming[];
    narrativeSegments: NarrativeSegment[];
    executionIslands: ExecutionIsland[];
    localizedGaps: LocalizedVisualGap[];
    transitions: {
        fromItemId: string;
        toItemId: string;
        cameraPolicy: ExecutionIsland['cameraPolicy'];
        statePolicy: 'RESET' | 'TRANSFER';
        reason: string;
    }[];
    timeline: TimelineItem[];
    claimStatus: {
        claimId: string;
        status: 'EXECUTABLE' | 'CONTEXT' | 'GAP' | 'BLOCKED_BY_DEPENDENCY';
        islandId: string | null;
        gapId: string | null;
    }[];
    coverage: Record<string, number>;
    renderability: 'FULL' | 'PARTIAL' | 'NONE';
    productionReady: boolean;
    fingerprint: string;
}
export interface CompiledNarrative {
    version: string;
    planFingerprint: string;
    purpose: 'REVIEW' | 'PRODUCTION';
    reviewOnly: boolean;
    productionReady: boolean;
    totalFrames: number;
    fps: number;
    canvas: {
        width: number;
        height: number;
    };
    items: (TimelineItem & {
        sequence: DirectedSequence | null;
        proof: {
            claimId: string;
            proof: 'DIRECT' | 'NONE';
            evidence: string;
        }[];
        physicalInitialState: SequenceState | null;
        physicalFinalState: SequenceState | null;
    })[];
    unresolvedWindows: {
        gapId: string;
        startFrame: number;
        endFrame: number;
        reason: string;
    }[];
    fingerprint: string;
}
