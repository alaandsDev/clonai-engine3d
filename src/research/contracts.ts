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
    researchVersion?: 1 | 2 | 3 | 4;
    /** Per fact type admission rule (v2 only). Absent = minIndependentSources for every type. */
    factTypeQuorum?: Partial<Record<'MEASUREMENT' | 'RESIDENCY' | 'QUANTITY', FactTypeQuorum>>;
    /** Residency currentness (v2): dated residency older than this, relative to evaluationDate, is not current. */
    residencyMaxAgeYears?: number;
    /** v3: whether a measurement at an observation site may stand for a place. SOURCED_OBSERVATION_SITE requires a source-backed OBSERVATION_SITE_FOR/SAME_ENTITY relation; never name similarity alone. */
    observationSitePolicy?: 'SAME_ENTITY_ONLY' | 'SOURCED_OBSERVATION_SITE';
    /** Phase26 process grammar/story opt-in; absent keeps historical extraction and replay. */
    mechanismVersion?: 2;
    /** Phase26B conservative contextual recovery; absent preserves Phase26 goldens. */
    contextualMechanisms?: true;
    /** Phase28: grounded question/progression planning over the same v4 evidence. */
    progressiveStory?: true;
    /** Phase28B bounded parser/retrieval opt-in; absent preserves Phase28. */
    contextualParser?: 1;
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
        /** v4 discovery metadata constrains lineage/matching, never supplies factual values. */
        dataset?: import('./v4/contracts').DatasetIdentity;
        datasetTarget?: {name:string;identifier:string|null;admin:string|null;proof:{sourceId:string;span:{start:number;end:number;text:string}}[]};
        methodology?: string;
        directEvidence?: boolean;
        /** v3 bounded large-dataset ingestion: the snapshot keeps header + selected rows; the full payload is described here. */
        partial?: { fullBytes: number; fullSha256: string; rule: string; terms: string[]; keptRows: number; totalRows: number };
    };
    license?: string;
    fixture: boolean;
    provenance: {
        originKey: string;
        sharedOriginKeys?: string[];
        discovery?: {queryIds: string[]; requestedUrl: string; finalUrl: string; via?: DiscoveryVia; referenceIds?: string[]; strategy?: string; independence?: string};
        description: string;
    };
}
export type DiscoveryVia = 'SEARCH_RESULT' | 'REFERENCE_LINK' | 'INSTITUTION_LINK' | 'ORIGIN_HINT' | 'FOLLOW_UP' | 'ARCHIVED_COPY' | 'PUBLISHER_LINK';
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
    /** v3: STATION subjects are observation sites; they never merge with a place of the same name without an EntityGraph relation. */
    subjectKind?: 'STATION';
    /** v3: an explicitly shared/tied record stated by the source. */
    sharedRecordId?: string;
}
export type StructuredKind = 'HTML_TABLE' | 'HTML_LIST' | 'DEFINITION_LIST' | 'KEY_VALUE' | 'DATASET' | 'RECORD';
export type SubjectSource = 'CELL' | 'ROW_HEADER' | 'TABLE_CAPTION' | 'SECTION_HEADING' | 'DOCUMENT_LABEL' | 'DOCUMENT_TITLE' | 'LEAD' | 'METADATA' | 'RECORD_FIELD';
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
    /** v3: where the subject came from when it is not the row's own subject cell. */
    subjectSource?: SubjectSource;
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
    extractionMethod: 'MECHANISM_V2' | 'MECHANISM_PT_V1' | 'LITERAL_PT_V1' | 'TABLE_PT_V1' | 'LITERAL_EN_V1' | 'LITERAL_EN_V2' | 'TABLE_HTML_V2' | 'LIST_HTML_V2' | 'DEFINITION_HTML_V2' | 'KEY_VALUE_HTML_V2' | 'DATASET_V2' | 'RECORD_HTML_V3';
    evidenceLanguage?: 'en';
    contextSpans?: SourceSpan[];
    mechanismContext?: {kind:'EXPLICIT_RELATION'|'CONTEXT_RESOLVED_RELATION';documentId:string;paragraphIndex:number;sentenceIndex:number;supportingSpans:SourceSpan[];cleaningRules:string[];parse?:import('./mechanism-parser').MechanismParseProof};
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
    /** Present for researchVersion 2 and 3 packs. */
    v2?: ResearchV2Section;
    /** Present only for researchVersion 3 packs. */
    v3?: ResearchV3Section;
    /** Opt-in Phase 23 fact-centric requirements and acquisition planning. */
    v4?: import('./v4/contracts').ResearchV4Section;
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
// SUPPORTED_ALIAS / CANDIDATE_ALIAS are Phase 22 (v3) states; only CONFIRMED_ALIAS ever merges entities.
export type AliasStatus = 'CONFIRMED_ALIAS' | 'SUPPORTED_ALIAS' | 'LIKELY_ALIAS' | 'CANDIDATE_ALIAS' | 'AMBIGUOUS_ALIAS' | 'REJECTED_ALIAS';
export interface AliasCandidate {
    id: string;
    name: string;
    alias: string;
    status: AliasStatus;
    relation: 'ALSO_KNOWN_AS' | 'TRANSLITERATION' | 'LOCAL_NAME' | 'ABBREVIATION' | 'STRUCTURED_METADATA' | 'SIMILARITY_ONLY' | 'NOT_TO_BE_CONFUSED' | 'TRANSLITERATION_CANDIDATE';
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
    /** Phase 25: a grounded non-physical explanation (definition / abstract cause); never visual proof. */
    nonPhysical?: 'definition' | 'causal_explanation';
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
export interface DocumentSubjectCandidate {
    text: string;
    normalizedText: string;
    sourceSpan: SourceSpan | null;
    sourceKind: SubjectSource | 'URL_HINT';
    entityKind: 'STATION' | 'PLACE';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    entityCandidateId: string | null;
    reason: string;
}
export interface DocumentContextSummary {
    sourceId: string;
    title: string | null;
    h1: string | null;
    candidates: DocumentSubjectCandidate[];
    resolved: { name: string; entityKind: 'STATION' | 'PLACE'; sourceKinds: string[] } | null;
    ambiguity: string | null;
    fingerprint: string;
}
export interface RecordField {
    label: string;
    value: string;
    unit: string | null;
    span: SourceSpan;
    labelSpan: SourceSpan;
    contextPath: string;
}
export type MultiSubjectSemantics = 'SINGLE_SUBJECT' | 'SHARED_VALUE_EXPLICIT' | 'TIED_RECORD' | 'ALTERNATIVE_SUBJECTS' | 'AMBIGUOUS_SUBJECT' | 'UNKNOWN';
export interface StructuredRecord {
    recordId: string;
    sourceId: string;
    recordType: 'LABEL_VALUE_BLOCK' | 'LABEL_VALUE_ROWS';
    heading: string | null;
    fields: RecordField[];
    subjectCandidates: string[];
    semantics: MultiSubjectSemantics;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    diagnostics: string[];
    evidenceIds: string[];
}
export type EntityRelationType = 'ALIAS_OF' | 'SAME_ENTITY' | 'OBSERVATION_SITE_FOR' | 'LOCATED_IN' | 'PART_OF' | 'NEAR' | 'SERVES' | 'UNKNOWN';
export interface EntityGraph {
    version: string;
    nodes: { id: string; name: string; kind: 'STATION' | 'SETTLEMENT' | 'PLACE'; sourceIds: string[]; kindEvidence: string[] }[];
    edges: { id: string; from: string; to: string; relation: EntityRelationType; sourceId: string | null; span: SourceSpan | null; reason: string }[];
    fingerprint: string;
}
export interface PublisherIdentity {
    sourceId: string;
    name: string | null;
    kind: 'GOVERNMENT' | 'ACADEMIC' | 'NEWS' | 'REFERENCE' | 'COMMERCIAL' | 'UNKNOWN';
    signals: { signal: string; value: string; span: SourceSpan | null }[];
}
export interface AuthorityAssessment {
    sourceId: string;
    declaredSourceType: SourceType;
    effectiveSourceType: SourceType;
    authority: 'INSTITUTIONAL_HIGH' | 'INSTITUTIONAL' | 'NONE';
    domainCompatibility: string | null;
    reasons: string[];
}
export interface EntityEligibility {
    entity: string;
    checklist: Record<'IDENTITY' | 'TEMPERATURE' | 'TEMPERATURE_AUTHORITY' | 'TEMPERATURE_CORROBORATION' | 'RESIDENCY' | 'RESIDENCY_CURRENTNESS' | 'RESIDENCY_CORROBORATION' | 'METRIC_COMPARABILITY' | 'CONFLICTS', { passed: boolean; detail: string }>;
    measurementFactId: string | null;
    residencyFactId: string | null;
    stationRelation: string | null;
    eligible: boolean;
    reason: string;
}
export interface ResearchV3Section {
    version: string;
    documentContexts: DocumentContextSummary[];
    records: StructuredRecord[];
    entityGraph: EntityGraph;
    publishers: PublisherIdentity[];
    authority: AuthorityAssessment[];
    eligibility: EntityEligibility[];
    fingerprints: Record<'documentContexts' | 'records' | 'entityGraph' | 'authority', string>;
}
