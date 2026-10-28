import type { DirectedSequence } from '../engine3d/directed';
import type { VisualDemonstration, ProofLevel } from '../engine3d/demonstration-contracts';
export const PLANNER_VERSION = 'autodirector-planner/1.0.0';
export const COMPILER_VERSION = 'autodirector-compiler/1.0.0';
export interface NarrativeUnit {
    id: string;
    sourceText: string;
    startOffset: number;
    endOffset: number;
    order: number;
    visualBudget: {
        maxSubjects: number;
        maxSimultaneousNarrativeMotions: number;
    };
    role: string;
    durationFrames: number;
    timingConfidence: 'MEASURED' | 'ESTIMATED';
}
export interface ExplicitClaim {
    id: string;
    text: string;
    type: string;
    startOffset: number;
    endOffset: number;
    importance: 'PRIMARY' | 'SUPPORTING' | 'DECORATIVE';
    requiresVisualProof: boolean;
    extraction?: ClaimExtraction;
}
/** Neutral evidence boundary for external claim producers; no parser internals. */
export interface ClaimExtraction {
    extractionSource:'SEMANTIC_ENGINE'; producerVersion:string; analysisFingerprint:string;
    confidence:'HIGH'|'MEDIUM'|'LOW'; status:'RESOLVED'|'UNRESOLVED'|'AMBIGUOUS';
    sourceEvidence:{start:number;end:number;text:string}[];
    entityIds:string[];relationIds:string[];referenceIds:string[];ambiguityIds:string[];
    previousClaimIds:string[];nextClaimIds:string[];semanticTags:string[];
    negated:boolean;modality:'ASSERTED'|'POSSIBLE'|'HYPOTHETICAL'|'UNCERTAIN';interrogative:boolean;
    visualSafety:'SAFE'|'ABSTAIN'|'EDITORIAL';reason:string;
    executionWindow:{firstUnitId:string;lastUnitId:string};
}
export interface PlannedClaim extends ExplicitClaim {
    unitId: string;
    source: 'EXPLICIT' | 'HEURISTIC' | 'SEMANTIC_ENGINE';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    semanticTags: string[];
}
export interface AutoDirectorInput {
    version: 1;
    id: string;
    language: string;
    format: 'vertical_short';
    fps: number;
    canvas: {
        width: number;
        height: number;
    };
    script: string;
    targetDuration?: number;
    styleProfile?: string;
    castPreference?: string[];
    constraints?: {
        mode?: 'PLAN_ONLY' | 'STRICT';
        allowedGapIds?: string[];
        maxSubjects?: number;
    };
    claims?: ExplicitClaim[];
    measuredDurations?: {
        unitId: string;
        durationSeconds: number;
    }[];
}
export interface CapabilityNode {
    id: string;
    kind: string;
    semanticTags: string[];
    capabilities: string[];
    evidence: string;
    metadata: unknown;
}
export type GapReason = 'MISSING_SUBJECT' | 'MISSING_CAPABILITY' | 'INSUFFICIENT_PROOF' | 'LOW_CLAIM_CONFIDENCE' | 'UNSUPPORTED_RELATION' | 'RESOURCE_CONFLICT' | 'BUDGET_LIMIT' | 'EDITORIAL_AMBIGUITY';
export type GapResolution = 'ADD_ENGINE_RESOURCE' | 'ADD_DEMONSTRATION_PRIMITIVE' | 'EXTERNAL_MEDIA' | 'HUMAN_DIRECTION' | 'TEXT_ONLY' | 'ACCEPT_PARTIAL';
export interface VisualGap {
    id: string;
    claimId: string;
    reason: GapReason;
    missingCapabilities: string[];
    missingSemanticSubjects: string[];
    bestAvailableProof: ProofLevel;
    recommendedResolution: GapResolution;
}
export interface VisualRequirement {
    claimId: string;
    importance: string;
    proofRequired: boolean;
    preferredProofLevel: ProofLevel;
    subjectType: string;
    requiredCapabilities: string[];
    fallbackPolicy: string;
}
export interface Selection {
    claimId: string;
    template: string;
    mode: string;
    resourceIds: string[];
    score: number;
    scoreBreakdown: Record<string, number>;
    reason: string;
    alternatives: {
        template: string;
        accepted: boolean;
        reason: string;
    }[];
    plannedProof: ProofLevel;
}
export interface AutoDirectorPlan {
    version: 1;
    plannerVersion: string;
    input: AutoDirectorInput;
    inputFingerprint: string;
    narrativeUnits: NarrativeUnit[];
    claims: PlannedClaim[];
    visualRequirements: VisualRequirement[];
    capabilitySnapshot: CapabilityNode[];
    resourceSelections: Selection[];
    templateSelections: Selection[];
    visualArc: {
        unitId: string;
        mode: string;
        sequenceId: string | null;
    }[];
    directedSequences: DirectedSequence[];
    demonstrations: VisualDemonstration[];
    visualProofPlan: {
        claimId: string;
        plannedProof: ProofLevel;
        checks: Record<string, boolean>;
    }[];
    visualGaps: VisualGap[];
    qaSummary: {
        sourceCoverage: boolean;
        candidateEvaluations: number;
        templatesEvaluated: number;
    };
    fingerprint: string;
}
