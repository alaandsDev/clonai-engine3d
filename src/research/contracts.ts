import type { SourceSpan } from '../semantics/contracts';
export const RESEARCH_VERSION = 'research-engine/1.0.0';
export type SourceType = 'PRIMARY_OFFICIAL' | 'PRIMARY_DATASET' | 'ACADEMIC' | 'INSTITUTIONAL' | 'REFERENCE' | 'NEWS' | 'OTHER';
export type ProviderType = 'STATIC_SOURCE_PACK' | 'LOCAL_DOCUMENTS' | 'WEB_SEARCH' | 'OFFICIAL_API' | 'CURATED_DATASET';
export type FactType = 'ENTITY_EXISTENCE' | 'QUANTITY' | 'MEASUREMENT' | 'LOCATION' | 'STATE' | 'PROCESS' | 'RELATION' | 'COMPARISON' | 'RANKING' | 'TEMPORAL' | 'RESIDENCY' | 'DEFINITION';
// Phase 21 adds RESEARCH_STAFF/TEMPORARY_STAFF/UNINHABITED. SEASONAL_POPULATION is represented by the existing SEASONAL_PRESENCE.
export type Residency = 'PERMANENT_SETTLEMENT' | 'PERMANENT_POPULATION' | 'TEMPORARY_RESEARCH_STAFF' | 'SEASONAL_PRESENCE' | 'RESEARCH_STAFF' | 'TEMPORARY_STAFF' | 'UNINHABITED';
export type FactStatus = 'EXTRACTED' | 'SUPPORTED' | 'CORROBORATED' | 'CONFLICTED' | 'INSUFFICIENT' | 'REJECTED';
export interface ResearchPolicy {
    version: string;
    minIndependentSources: number;
    minPrimaryQuality: 'HIGH' | 'MEDIUM';
    allowFahrenheitConversion: boolean;
    temporalComparison: 'SAME_CONTEXT' | 'EXPLICIT_CROSS_PERIOD';
    maxSourceBytes: number;
    maxTotalSourceBytes: number;
    maxNormalizedCharacters: number;
    evaluationDate: string | null;
    allowEnglishExtraction?: boolean;
    /** Opt-in Phase 21 model: structured extraction, SourceGraph origin groups, corroboration/conflicts v2. Absent = Phase 19/20 behaviour. */
    researchVersion?: 1 | 2;
    /** Per fact type admission rule (v2 only). Absent = minIndependentSources for every type. */
    factTypeQuorum?: Partial<Record<'MEASUREMENT' | 'RESIDENCY' | 'QUANTITY', FactTypeQuorum>>;
    /** Residency currentness (v2): dated residency older than this, relative to evaluationDate, is not current. */
    residencyMaxAgeYears?: number;
}
export interface FactTypeQuorum {
    minIndependentOrigins: number;
    /** A single non-derived origin may admit the fact when its declared class and grade satisfy this rule. */
    singleOriginAuthority?: { sourceTypes: SourceType[]; minGrade: 'HIGH' | 'MEDIUM' };
}
export interface ResearchRequest {
    version: 1;
    id: string;
    topic: string;
    language: 'pt-BR';
    researchGoal: 'RANKING' | 'PROCESS' | 'FACTS';
    desiredFactTypes: FactType[];
    constraints?: {
        rankingCount?: number;
        residencyCriterion?: Residency;
        metric?: 'TEMPERATURE' | 'POPULATION';
        qualifier?: string;
        temporalContext?: string;
    };
    sourcePolicy?: Partial<Omit<ResearchPolicy, 'version'>>;
    maxSources?: number;
    maxEvidenceItems?: number;
}
export interface ResearchQuestion {
    id: string;
    question: string;
    requiredFactTypes: FactType[];
    essential: boolean;
    requiredCorroboration: number;
}
export interface ResearchPlan {
    version: string;
    request: ResearchRequest;
    policy: ResearchPolicy;
    questions: ResearchQuestion[];
    essentialResearchQuestionIds: string[];
    ambiguities: {
        code: string;
        reason: string;
    }[];
    fingerprint: string;
}
export interface SourceInput {
    id: string;
    provider: ProviderType;
    sourceType: SourceType;
    title: string;
    publisher: string;
    author?: string;
    publishedAt?: string;
    retrievedAt?: string;
    canonicalLocator: string;
    language: string;
    contentType: 'text/plain' | 'text/html' | 'text/tab-separated-values' | 'text/csv';
    content: string;
    contentHash: string;
    metadata: {
        methodology?: string;
        directEvidence?: boolean;
    };
    license?: string;
    fixture: boolean;
    provenance: {
        originKey: string;
        sharedOriginKeys?: string[];
        discovery?: {queryIds: string[]; requestedUrl: string; finalUrl: string; via?: DiscoveryVia; referenceIds?: string[]; strategy?: string};
        description: string;
    };
}
export type DiscoveryVia = 'SEARCH_RESULT' | 'REFERENCE_LINK' | 'INSTITUTION_LINK' | 'ORIGIN_HINT' | 'FOLLOW_UP' | 'ARCHIVED_COPY';
export interface SourceDocument extends SourceInput {
    normalized: {
        text: string;
        mapping: {
            start: number;
            end: number;
        }[];
    };
    fingerprint: string;
}
export interface SourcePack {
    version: 1;
    id: string;
    fixture: boolean;
    labels: string[];
    sources: SourceInput[];
}
export interface SourceProvider {
    readonly kind: ProviderType;
    receive(plan: ResearchPlan): SourcePack;
}
export interface SourceQualityAssessment {
    sourceId: string;
    grade: 'HIGH' | 'MEDIUM' | 'LOW' | 'REJECT';
    accepted: boolean;
    breakdown: Record<string, {
        score: number;
        reason: string;
    }>;
    reasons: string[];
    fingerprint: string;
}
export interface Quantity {
    originalValue: string;
    originalUnit: '°C' | '°F' | 'PERSONS';
    normalizedValue: number;
    normalizedUnit: '°C' | '°F' | 'PERSONS';
    conversionRule: 'IDENTITY' | 'F_TO_C';
    precision: number;
    approximation: 'AS_REPORTED' | 'APPROXIMATE';
}
export interface CanonicalFact {
    factType: FactType;
    subject: string;
    predicate: string;
    object: string | null;
    quantity: Quantity | null;
    metric: string | null;
    temporalContext: string | null;
    qualifiers: string[];
    residency: Residency | null;
    /** v2: observation window of a record (e.g. a table caption period); distinct from the event date in temporalContext. */
    observationPeriod?: string | null;
}
export type StructuredKind = 'HTML_TABLE' | 'HTML_LIST' | 'DEFINITION_LIST' | 'KEY_VALUE' | 'DATASET';
export interface StructuredProvenance {
    kind: StructuredKind;
    structureIndex: number;
    row: number;
    column: number;
    rowHeader: string | null;
    columnHeader: string | null;
    headerSpans: SourceSpan[];
    captionSpan: SourceSpan | null;
    subjectSpan: SourceSpan | null;
    unitSource: 'CELL' | 'HEADER' | 'CAPTION' | 'NONE';
}
export interface Evidence {
    version: 1;
    id: string;
    sourceId: string;
    sourceSpan: SourceSpan;
    exactText: string;
    normalizedText: string;
    evidenceType: FactType;
    supports: CanonicalFact;
    extractionConfidence: 'HIGH' | 'MEDIUM';
    truthStatus: 'EXTRACTED';
    extractionMethod: 'LITERAL_PT_V1' | 'TABLE_PT_V1' | 'LITERAL_EN_V1' | 'LITERAL_EN_V2' | 'TABLE_HTML_V2' | 'LIST_HTML_V2' | 'DEFINITION_HTML_V2' | 'KEY_VALUE_HTML_V2' | 'DATASET_V2';
    evidenceLanguage?: 'en';
    contextSpans?: SourceSpan[];
    contentHash: string;
    table: {
        row: number;
        column: number;
        headerContext: string;
        headerSpan: SourceSpan;
    } | null;
    /** v2 only. */
    structured?: StructuredProvenance;
    /** v2 only: canonical footnote/inline reference URLs attached to this exact evidence. */
    citations?: string[];
    /** v2 only: assigned from the SourceGraph after extraction. */
    originGroupId?: string;
    fingerprint: string;
}
export interface FactCandidate {
    id: string;
    canonicalFact: CanonicalFact;
    evidenceIds: string[];
    extractionConfidence: 'HIGH' | 'MEDIUM';
    status: 'EXTRACTED';
    fingerprint: string;
}
export interface FactConflict {
    id: string;
    factKey: string;
    evidenceA: string[];
    evidenceB: string[];
    factCandidateIds: string[];
    conflictType: 'QUANTITY_DISAGREEMENT' | 'VALUE_CONFLICT' | 'QUALIFIER_CONFLICT' | 'TEMPORAL_CONFLICT' | 'ENTITY_CONFLICT' | 'RESIDENCY_CONFLICT' | 'SOURCE_ORIGIN_CONFLICT';
    resolutionStatus: 'UNRESOLVED';
    reason: string;
}
export interface GroundedFact {
    id: string;
    canonicalFact: CanonicalFact;
    factType: FactType;
    evidenceIds: string[];
    sourceIds: string[];
    factCandidateIds: string[];
    status: FactStatus;
    corroborationStatus: 'CORROBORATED' | 'SINGLE_ORIGIN' | 'INSUFFICIENT';
    independentOriginCount: number;
    sharedOrigin: string[][];
    conflicts: string[];
    qualifiers: string[];
    usableForScript: boolean;
    usableForPrimaryClaim: boolean;
    /** v2 only: evidence IDs per independent origin root, derivations and the preferred primary evidence. */
    origins?: { roots: string[][]; derivedEvidenceIds: string[]; primaryEvidenceId: string | null; admission: string; supportScore: number };
    groundingFingerprint: string;
}
export interface RankingResult {
    status: 'VALID' | 'RANKING_NOT_SUPPORTED' | 'RANKING_INCOMPLETE';
    reason: string;
    requestedCount: number;
    eligibleItemCount: number;
    criterion: Residency | null;
    metric: string | null;
    qualifier: string | null;
    temporalContext: string | null;
    tiePolicy: 'COMPETITION_INCLUDE_BOUNDARY';
    items: {
        subject: string;
        rank: number;
        tied: boolean;
        value: number;
        unit: string;
        measurementFactId: string;
        residencyFactId: string | null;
    }[];
    excluded: {
        subject: string;
        reason: string;
    }[];
    fingerprint: string;
}
export interface EvidencePack {
    version: string;
    topic: string;
    fixture: boolean;
    labels: string[];
    researchPlan: ResearchPlan;
    sources: SourceDocument[];
    sourceAssessments: SourceQualityAssessment[];
    evidence: Evidence[];
    factCandidates: FactCandidate[];
    groundedFacts: GroundedFact[];
    conflicts: FactConflict[];
    unresolvedQuestions: {
        id: string;
        reason: string;
    }[];
    ranking: RankingResult | null;
    essentialResearchQuestionIds: string[];
    essentialFactIds: string[];
    coverage: Record<string, number>;
    quality: ResearchQualityReport;
    /** Present only for researchVersion 2 packs. */
    v2?: ResearchV2Section;
    fingerprint: string;
}
export type OriginRelationType = 'PRIMARY_ORIGIN' | 'DERIVED_FROM' | 'CITES' | 'REPORTS' | 'MIRRORS' | 'NEAR_COPY' | 'SAME_PUBLISHER' | 'UNKNOWN_RELATION';
export interface OriginRelation {
    id: string;
    from: string;
    to: string;
    relation: OriginRelationType;
    factId: string | null;
    evidenceIds: string[];
    reason: string;
}
export interface SourceGraph {
    version: string;
    nodes: { sourceId: string; locator: string; registrableDomain: string; publisher: string; sourceType: SourceType; originGroupId: string }[];
    edges: OriginRelation[];
    fingerprint: string;
}
export interface OriginGroup {
    id: string;
    sourceIds: string[];
    evidenceIds: string[];
    reasons: string[];
}
export type AliasStatus = 'CONFIRMED_ALIAS' | 'LIKELY_ALIAS' | 'AMBIGUOUS_ALIAS' | 'REJECTED_ALIAS';
export interface AliasCandidate {
    id: string;
    name: string;
    alias: string;
    status: AliasStatus;
    relation: 'ALSO_KNOWN_AS' | 'TRANSLITERATION' | 'LOCAL_NAME' | 'ABBREVIATION' | 'STRUCTURED_METADATA' | 'SIMILARITY_ONLY' | 'NOT_TO_BE_CONFUSED';
    sourceId: string | null;
    sourceSpan: SourceSpan | null;
    reason: string;
}
export interface EvidenceQualityAssessment {
    evidenceId: string;
    grade: 'STRONG' | 'ADEQUATE' | 'WEAK';
    breakdown: Record<'directness' | 'subjectClarity' | 'metricClarity' | 'qualifierClarity' | 'temporalClarity' | 'structuredContext' | 'extractability', { score: number; reason: string }>;
    score: number;
    fingerprint: string;
}
export interface StructuredSummary {
    sourceId: string;
    kind: StructuredKind;
    index: number;
    status: 'PARSED' | 'REJECTED';
    reason: string;
    rows: number;
    columns: number;
    caption: string | null;
    evidenceIds: string[];
}
export interface ResearchV2Section {
    version: string;
    sourceGraph: SourceGraph;
    originGroups: OriginGroup[];
    evidenceAssessments: EvidenceQualityAssessment[];
    aliases: AliasCandidate[];
    structures: StructuredSummary[];
    diagnostics: { code: string; subject: string | null; detail: string }[];
}
export interface ResearchQualityReport {
    sourceCount: number;
    acceptedSourceCount: number;
    rejectedSourceCount: number;
    evidenceCount: number;
    groundedFactCount: number;
    corroboratedFactCount: number;
    conflictCount: number;
    unresolvedCount: number;
    criticalCoverage: number;
    rankingValidity: string;
    productionEligibility: 'RESEARCH_INCOMPLETE' | 'RESEARCH_READY';
    publisherCount: number;
    independentOriginCount: number;
}
export interface ClaimEvidenceLink {
    claimId: string;
    sentenceId: string;
    groundedFactIds: string[];
    evidenceIds: string[];
    sourceIds: string[];
    qualifiersPreserved: boolean;
    packFingerprint: string;
}
export interface GroundedSentence {
    id: string;
    text: string;
    sourceSpan: SourceSpan;
    groundedFactIds: string[];
    kind: 'FACT' | 'EDITORIAL';
}
export interface FactualPreflight {
    passed: boolean;
    issues: {
        code: string;
        sentenceId: string | null;
        reason: string;
    }[];
    essentialFactCoverage: number;
    fingerprint: string;
}
export interface GroundingReconciliation {
    passed: boolean;
    links: ClaimEvidenceLink[];
    issues: {
        code: string;
        claimId: string;
        reason: string;
    }[];
    metrics: {
        factualClaimCount: number;
        groundedClaimCount: number;
        ungroundedClaimCount: number;
        corroboratedPrimaryClaimRate: number;
        qualifierPreservationRate: number;
        semanticDriftCount: number;
        unsupportedSpecificClaimCount: number;
    };
    fingerprint: string;
}
export interface EvidenceReviewDecision {
    evidenceId: string;
    decision: 'APPROVE' | 'REJECT' | 'NEEDS_REVIEW';
    reason: string;
    reviewer: string;
}
