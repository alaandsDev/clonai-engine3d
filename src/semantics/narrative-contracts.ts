import type { SemanticAnalysis, SemanticClaim, SourceSpan, Confidence, Modality, PredicateName } from './contracts';
export const NATURAL_SEMANTIC_VERSION = 'semantic-engine/1.1.0';
export const GRAPH_VERSION = 'narrative-graph/1.0.0';
export type Domain = 'LIQUID_PROCESS' | 'VEHICLE_STATE' | 'MEASUREMENT' | 'SCIENTIFIC_ACTIVITY' | 'EDITORIAL' | 'UNKNOWN';
export type ClauseType = 'MAIN' | 'COORDINATED' | 'TEMPORAL' | 'CAUSAL' | 'CONDITIONAL' | 'RELATIVE' | 'PURPOSE' | 'UNKNOWN';
export interface NarrativeClause {
    id: string;
    unitId: string;
    order: number;
    type: ClauseType;
    sourceSpan: SourceSpan;
    predicateIds: string[];
    parentClauseId: string | null;
    sharesSubjectWith: string | null;
    nonAsserted: boolean;
    scopeReason: string | null;
}
export interface ReferenceCandidate {
    id: string;
    kind: 'ENTITY' | 'EVENT';
    compatible: boolean;
    score: number;
    semanticScore: number;
    breakdown: Record<string, number>;
}
export interface NarrativeReference {
    id: string;
    mentionId: string;
    clauseId: string;
    kind: 'ENTITY_REFERENCE' | 'EVENT_REFERENCE' | 'OBJECT_REFERENCE';
    role: 'SUBJECT' | 'OBJECT';
    sourceSpan: SourceSpan;
    candidateEntityIds: string[];
    candidateEventIds: string[];
    candidates: ReferenceCandidate[];
    selectedEntityId: string | null;
    selectedEventId: string | null;
    confidence: Confidence | 'AMBIGUOUS';
    reason: string;
    margin: number | null;
    requiredMargin: number;
}
export interface EntityAlias {
    id: string;
    entityId: string;
    mentionId: string;
    type: 'LEXICAL_ALIAS' | 'CONTEXTUAL_ALIAS';
    sourceSpan: SourceSpan;
    reason: string;
    confidence: Confidence;
}
export interface SemanticEvent {
    id: string;
    clauseId: string;
    unitId: string;
    predicate: PredicateName | 'CONTINUE';
    subjectEntityIds: string[];
    objectEntityIds: string[];
    locationEntityIds: string[];
    sourceEntityIds: string[];
    destinationEntityIds: string[];
    pathEntityIds: string[];
    quantityIds: string[];
    stateBefore: string | null;
    stateAfter: string | null;
    negated: boolean;
    modality: Modality;
    interrogative: boolean;
    sourceSpan: SourceSpan;
    sourceEvidence: SourceSpan[];
    confidence: Confidence;
    confidenceScore: number;
    confidenceBreakdown: Record<string, number>;
    referenceIds: string[];
    domain: Domain;
    continuesEventId: string | null;
    processIdentity: string | null;
}
export interface NarrativeClaim extends SemanticClaim {
    clauseIds: string[];
    eventIds: string[];
    eventReferenceIds: string[];
    domain: Domain;
    semanticTags: string[];
    narrativeRole: 'FACT' | 'CONTEXT' | 'QUESTION' | 'PURPOSE';
    blockedReason: string | null;
}
export type DependencyType = 'INDEPENDENT' | 'SUPPORTS' | 'DEPENDS_ON' | 'CONTINUES' | 'CAUSES' | 'CONTRASTS' | 'ELABORATES' | 'RESOLVES';
export interface ClaimDependency {
    id: string;
    fromClaimId: string;
    toClaimId: string;
    type: DependencyType;
    blocking: boolean;
    reason: string;
    sourceSpan: SourceSpan;
}
export interface NarrativeSegment {
    id: string;
    type: 'HOOK' | 'CONTEXT' | 'EXPLANATION' | 'PROCESS' | 'EXAMPLE' | 'COMPARISON' | 'ESCALATION' | 'REVEAL' | 'CONCLUSION' | 'QUESTION' | 'TRANSITION' | 'UNKNOWN';
    domain: Domain;
    unitIds: string[];
    clauseIds: string[];
    claimIds: string[];
    entityIds: string[];
    eventIds: string[];
    dominantSubjectIds: string[];
    locationIds: string[];
    confidence: Confidence;
    sourceSpan: SourceSpan;
    boundaryReason: string;
}
export interface NarrativeTransition {
    fromSegmentId: string;
    toSegmentId: string;
    type: 'CONTINUES' | 'DOMAIN_SHIFT' | 'EXPLICIT_RETURN' | 'CONTRAST';
    sourceSpan: SourceSpan;
    reason: string;
}
export interface SemanticNarrativeGraph {
    version: 1;
    graphVersion: string;
    semanticVersion: string;
    id: string;
    script: string;
    analysis: SemanticAnalysis;
    clauses: NarrativeClause[];
    entities: SemanticAnalysis['entities'];
    mentions: SemanticAnalysis['mentions'];
    references: NarrativeReference[];
    aliases: EntityAlias[];
    events: SemanticEvent[];
    states: {
        entityId: string;
        state: string;
        eventId: string;
        sourceSpan: SourceSpan;
    }[];
    relations: SemanticAnalysis['relations'];
    claims: NarrativeClaim[];
    segments: NarrativeSegment[];
    transitions: NarrativeTransition[];
    dependencies: ClaimDependency[];
    metrics: Record<string, number>;
    rulesFingerprint: string;
    fingerprint: string;
}
