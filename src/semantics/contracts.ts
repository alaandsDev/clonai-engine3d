export const SEMANTIC_VERSION = 'semantic-engine/1.0.0';
export const ADAPTER_VERSION = 'semantic-claim-adapter/1.0.0';
export interface SourceSpan {
    start: number;
    end: number;
    text: string;
}
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type Modality = 'ASSERTED' | 'POSSIBLE' | 'HYPOTHETICAL' | 'UNCERTAIN';
export type EntityType = 'PERSON' | 'GROUP' | 'OBJECT' | 'PLACE' | 'SUBSTANCE' | 'ENVIRONMENT' | 'MEASUREMENT' | 'NUMBER' | 'UNKNOWN';
export interface SemanticInput {
    version: 1;
    id: string;
    language: 'pt-BR';
    script: string;
}
export interface SemanticUnit {
    id: string;
    order: number;
    sourceSpan: SourceSpan;
}
export interface SemanticEntity {
    id: string;
    type: EntityType;
    canonicalName: string;
    semanticTags: string[];
    gender: 'M' | 'F' | 'UNKNOWN';
    number: 'SINGULAR' | 'PLURAL';
    sourceSpan: SourceSpan;
    mentionIds: string[];
}
export interface Mention {
    id: string;
    unitId: string;
    entityId: string | null;
    kind: 'NOUN' | 'PRONOUN' | 'DESCRIPTIVE' | 'ELLIPSIS';
    sourceSpan: SourceSpan;
    role: 'SUBJECT' | 'OBJECT' | 'OTHER';
}
export interface Reference {
    id: string;
    mentionId: string;
    candidateEntityIds: string[];
    selectedEntityId: string | null;
    confidence: Confidence | 'AMBIGUOUS';
    reason: string;
    sourceSpan: SourceSpan;
}
export type PredicateName = 'IS' | 'HAS' | 'MOVE' | 'ENTER' | 'EXIT' | 'RISE' | 'FALL' | 'FLOW' | 'CONNECT' | 'SEPARATE' | 'OPEN' | 'CLOSE' | 'INCREASE' | 'DECREASE' | 'ACCUMULATE' | 'FREEZE' | 'MELT' | 'FILL' | 'EMPTY' | 'STORE' | 'REVEAL' | 'COVER' | 'ROTATE' | 'APPEAR' | 'DISAPPEAR' | 'COMPARE' | 'MEASURE' | 'CAUSE' | 'BECOME' | 'OPERATE' | 'UNKNOWN';
export interface Predicate {
    id: string;
    unitId: string;
    name: PredicateName;
    sourceSpan: SourceSpan;
    subjectEntityId: string | null;
    objectEntityIds: string[];
    negated: boolean;
    modality: Modality;
    interrogative: boolean;
    referenceIds: string[];
    ambiguityIds: string[];
}
export interface NormalizedQuantity {
    id: string;
    unitId: string;
    value: number;
    unit: string;
    dimension: 'TEMPERATURE' | 'DISTANCE' | 'TIME' | 'SPEED' | 'PERCENTAGE' | 'COUNT' | 'RANK';
    comparisonOperator: string | null;
    sourceSpan: SourceSpan;
    confidence: Confidence;
}
export type RelationType = 'SUBJECT_ACTION' | 'ACTION_OBJECT' | 'LOCATION' | 'SOURCE' | 'DESTINATION' | 'PATH' | 'STATE' | 'STATE_CHANGE' | 'QUANTITY' | 'COMPARISON' | 'CAUSE_EFFECT' | 'TEMPORAL_BEFORE' | 'TEMPORAL_AFTER' | 'CONTAINS' | 'CONNECTED_TO' | 'PART_OF';
export interface SemanticRelation {
    id: string;
    unitId: string;
    type: RelationType;
    subjectEntityId: string | null;
    objectEntityId: string | null;
    predicateIds: string[];
    quantityIds: string[];
    details: Record<string, string | number | boolean | null | string[]>;
    sourceSpan: SourceSpan;
    sourceEvidence: SourceSpan[];
    confidence: Confidence;
}
export type AmbiguityType = 'AMBIGUOUS_REFERENCE' | 'AMBIGUOUS_SUBJECT' | 'AMBIGUOUS_OBJECT' | 'AMBIGUOUS_RELATION' | 'UNSUPPORTED_PREDICATE' | 'INSUFFICIENT_CONTEXT' | 'EXTERNAL_KNOWLEDGE_REQUIRED' | 'CONFLICTING_INTERPRETATIONS';
export interface Ambiguity {
    id: string;
    unitId: string;
    type: AmbiguityType;
    sourceSpan: SourceSpan;
    reason: string;
    referenceIds: string[];
    critical: boolean;
}
export interface SemanticContext {
    unitId: string;
    activeEntities: string[];
    recentSubjects: string[];
    recentObjects: string[];
    currentPlace: string | null;
    currentProcess: string | null;
    currentMeasurement: string | null;
    currentComparison: string | null;
    currentRanking: string | null;
    pendingReferences: string[];
}
export interface SemanticClaim {
    id: string;
    unitId: string;
    text: string;
    type: 'OBJECT_STATE' | 'PROCESS' | 'QUANTITY_CHANGE' | 'SPATIAL_RELATION' | 'CAUSE_EFFECT' | 'COMPARISON' | 'NUMBER' | 'TEMPERATURE' | 'RANKING' | 'LOCATION' | 'QUESTION' | 'CONCLUSION';
    predicate: PredicateName;
    predicateIds: string[];
    entityIds: string[];
    subjectEntityId: string | null;
    relationIds: string[];
    referenceIds: string[];
    ambiguityIds: string[];
    sourceSpan: SourceSpan;
    sourceEvidence: SourceSpan[];
    extractionSource: 'SEMANTIC_ENGINE';
    confidence: Confidence;
    confidenceScore: number;
    confidenceBreakdown: Record<string, number>;
    negated: boolean;
    modality: Modality;
    interrogative: boolean;
    status: 'RESOLVED' | 'UNRESOLVED' | 'AMBIGUOUS';
    importance: 'PRIMARY' | 'SUPPORTING';
    requiresVisualProof: boolean;
    stateTransition: {
        initial: string | null;
        process: string | null;
        final: string | null;
    } | null;
    quantityIds: string[];
    executionUnitIds: string[];
    previousClaimIds: string[];
    nextClaimIds: string[];
    sharedEntityIds: string[];
    canonicalFingerprint: string;
}
export interface SemanticAnalysis {
    version: 1;
    engineVersion: string;
    id: string;
    script: string;
    scriptFingerprint: string;
    language: 'pt-BR';
    narrativeUnits: SemanticUnit[];
    entities: SemanticEntity[];
    mentions: Mention[];
    references: Reference[];
    predicates: Predicate[];
    quantities: NormalizedQuantity[];
    relations: SemanticRelation[];
    claims: SemanticClaim[];
    ambiguities: Ambiguity[];
    unresolvedReferences: string[];
    contexts: SemanticContext[];
    confidenceSummary: Record<string, number>;
    provenance: {
        rulesFingerprint: string;
        externalKnowledgeUsed: false;
        offsetConvention: 'UTF16_HALF_OPEN';
        precisionPolicy: 'PRECISION_OVER_RECALL';
    };
    fingerprint: string;
}
