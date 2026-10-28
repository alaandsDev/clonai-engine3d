import type { ResearchRequest, ResearchPlan, SourceInput, EvidencePack, SourceType, SourceQualityAssessment } from '../contracts';
import type { GroundedWebWriterResult } from './internal';
export interface WebResearchConfig {
    enabled: boolean;
    searchEndpoint: string;
    maxResearchRounds: number;
    maxQueries: number;
    maxResultsPerQuery: number;
    maxSearchResults: number;
    maxCandidateSources: number;
    maxFetchedSources: number;
    maxSourcesPerDomain: number;
    maxBytesPerSource: number;
    maxTotalBytes: number;
    requestTimeoutMs: number;
    maxDurationMs: number;
    maxRedirects: number;
    allowedMimeTypes: string[];
    preferredDomains: string[];
    blockedDomains: string[];
    officialDomainHints: {
        domain: string;
        sourceType: SourceType;
        reason: string;
    }[];
    userAgent: string;
    respectRobots: boolean;
    perDomainDelayMs: number;
    globalConcurrency: number;
    cachePolicy: 'REFRESH' | 'CACHED_REPLAY';
    allowSessionScopeAdjustment: boolean;
    /** Phase 21 multi-source discovery; used only with sourcePolicy.researchVersion = 2. */
    v2?: WebResearchV2Config;
}
export type DiscoveryStrategy = 'MEDIAWIKI_REFERENCE_SEARCH' | 'REFERENCE_FOLLOWING' | 'WIKIDATA_ENTITY_DISCOVERY' | 'OPENALEX_ACADEMIC_SEARCH' | 'CROSSREF_WORKS_SEARCH' | 'PUBLISHER_LINK_FOLLOWING';
export type ResearchStage = 'BROAD_DISCOVERY' | 'ORIGIN_DISCOVERY' | 'VERIFICATION' | 'CORROBORATION';
export interface WebResearchV2Config {
    strategies: DiscoveryStrategy[];
    /** Fetch attempts per stage; unused budget is reallocated deterministically to later stages. */
    budgets: Record<'broadDiscovery' | 'originDiscovery' | 'verification' | 'corroboration', number> & { entityExpansion?: number };
    maxReferencesPerSource: number;
    candidatePoolTarget: number;
    wikidataEndpoint: string;
    openAlexEndpoint: string;
    followArchivedCopies: boolean;
    /** v3: Crossref endpoint and bounded large-dataset ingestion. */
    crossrefEndpoint?: string;
    maxDatasetBytes?: number;
    maxPublisherLinksPerSource?: number;
}
export interface ReferenceCandidate {
    id: string;
    sourceId: string;
    targetUrl: string;
    anchorText: string;
    contextSpan: { start: number; end: number; text: string } | null;
    referenceType: 'FOOTNOTE_CITATION' | 'INLINE_LINK' | 'DATASET_LINK' | 'ARCHIVED_COPY' | 'PDF_DOCUMENT' | 'INSTITUTION_LINK';
    researchQuestionIds: string[];
    confidence: 'HIGH' | 'MEDIUM';
    reason: string;
    evidenceIds: string[];
    subject: string | null;
    gap: string;
    archiveUrl: string | null;
    priority: number;
    status: 'PENDING' | 'FETCHED' | 'FAILED' | 'SKIPPED_BUDGET' | 'SKIPPED_SOURCE_CAP' | 'SKIPPED_FORMAT' | 'SKIPPED_DUPLICATE';
    /** v3 PDF diagnostic from the reference context (content is never fetched). */
    pdfDiagnostic?: 'PDF_TEXT_REQUIRED' | 'PDF_TABLE_REQUIRED' | 'PDF_SCANNED_UNKNOWN';
    fetchAttemptIds: string[];
}
export interface ResearchGap {
    code: 'UNSUPPORTED_LANGUAGE' | 'JS_RENDER_REQUIRED' | 'ANTI_BOT_CHALLENGE' | 'EMPTY_STATIC_HTML' | 'PDF_TEXT_REQUIRED' | 'PDF_TABLE_REQUIRED' | 'PDF_SCANNED_UNKNOWN' | 'ENTITY_RESOLUTION_GAP' | 'SOURCE_DISCOVERY_GAP' | 'SOURCE_FETCH_GAP' | 'SOURCE_FORMAT_GAP' | 'EVIDENCE_EXTRACTION_GAP' | 'CORROBORATION_GAP' | 'FACT_CONFLICT' | 'VISUAL_GAP' | 'PRIMARY_SOURCE_DISCOVERED_BUT_PDF_UNSUPPORTED' | 'WRITER_REALIZATION_GAP';
    subject: string | null;
    url: string | null;
    detail: string;
}
export interface ResearchSessionV2 {
    version: string;
    strategies: { kind: DiscoveryStrategy; executed: boolean; queries: number; results: number; candidates: number; diagnostics: string[] }[];
    references: ReferenceCandidate[];
    stageBudgets: { stage: ResearchStage; budget: number; used: number; reallocatedIn: number }[];
    entityPool: { subject: string; provenance: 'DISCOVERED_FROM_SEARCH' | 'DISCOVERED_FROM_SOURCE'; firstSourceId: string | null; temperature: string; residency: string; corroboration: string; eligible: boolean }[];
    gaps: ResearchGap[];
    metrics: Record<string, number | string | string[]>;
}
export interface SearchQuery {
    id: string;
    round: number;
    stage: 'BROAD_DISCOVERY' | 'ENTITY_DISCOVERY' | 'FACT_VERIFICATION' | 'CORROBORATION';
    researchQuestionIds: string[];
    text: string;
    entityName: string | null;
    entitySourceIds: string[];
    followupReason: string;
    /** v3 query trace. */
    purpose?: QueryPurpose;
    derivedFrom?: string;
    targetGap?: string;
    factId?: string | null;
    excludedOrigins?: string[];
    provider?: string;
}
export type QueryPurpose = 'ENTITY_DISCOVERY' | 'METRIC_DISCOVERY' | 'RESIDENCY_DISCOVERY' | 'OFFICIAL_SOURCE_DISCOVERY' | 'ALIAS_DISCOVERY' | 'CORROBORATION_DISCOVERY';
export type DiscoveryIndependence = 'REFERENCE_DERIVED' | 'ENTITY_DERIVED' | 'QUERY_INDEPENDENT' | 'CORPUS_INDEPENDENT' | 'PUBLISHER_DISCOVERED' | 'UNKNOWN';
export interface SearchResult {
    queryId: string;
    rank: number;
    title: string;
    url: string;
    snippet: string;
    displayDomain: string;
    provider: string;
    retrievedMetadata: {
        retrievedAt: string;
        endpoint: string;
    };
    fingerprint: string;
}
export interface CandidateSource {
    id: string;
    canonicalUrl: string;
    domain: string;
    queryIds: string[];
    researchQuestionIds: string[];
    discoveryRanks: number[];
    title: string;
    expectedSourceType: SourceType;
    fetchStatus: string;
    selectionScore: number;
    reasons: string[];
    /** v3 discovery provenance; discovery independence is not evidence independence. */
    discoveryPath?: string;
    discoveryProvider?: string;
    discoveryQuery?: string | null;
    seedSourceId?: string | null;
    seedEntityId?: string | null;
    seedFactId?: string | null;
    discoveryIndependence?: DiscoveryIndependence;
}
export type FetchStatus = 'SUCCESS' | 'HTTP_ERROR' | 'TIMEOUT' | 'REDIRECT_BLOCKED' | 'SSRF_BLOCKED' | 'MIME_BLOCKED' | 'SIZE_BLOCKED' | 'ROBOTS_BLOCKED' | 'CONTENT_UNAVAILABLE' | 'PARSE_FAILED';
export interface FetchAttempt {
    id: string;
    url: string;
    finalUrl: string;
    status: FetchStatus;
    reason: string;
    httpStatus: number | null;
    headers: Record<string, string>;
    fetchedAt: string;
    elapsedMs: number;
    networkElapsedMs?: number;
    bytes: number;
    resolvedIps: string[];
    redirects: {
        from: string;
        to: string;
        status: number;
    }[];
    snapshot: WebSnapshot | null;
}
export interface WebSnapshot {
    id: string;
    url: string;
    fetchedAt: string;
    headers: Record<string, string>;
    contentHash: string;
    bytes: number;
    content: string;
    mime: string;
    fingerprint: string;
}
export interface DiscoveredEntity {
    id: string;
    name: string;
    type: 'PLACE_CANDIDATE' | 'DOCUMENT_SUBJECT';
    sourceIds: string[];
    evidenceIds: string[];
    provenance: 'DISCOVERED_FROM_SEARCH' | 'DISCOVERED_FROM_SOURCE';
    firstQueryId: string;
    firstUrl: string;
    sourceSpan: {
        start: number;
        end: number;
        text: string;
    } | null;
    discoveryConfidence: 'HIGH' | 'MEDIUM';
    eligibleForFollowup: boolean;
}
export interface SearchProvider {
    readonly kind: string;
    search(query: SearchQuery, limit: number): Promise<{
        results: SearchResult[];
        diagnostic: string | null;
        latencyMs: number;
    }>;
}
export interface HttpResponse {
    status: number;
    headers: Record<string, string>;
    body: Uint8Array;
    remoteAddress: string;
}
export interface WebEnvironment {
    resolve(host: string, signal: AbortSignal): Promise<{
        address: string;
        family: number;
    }[]>;
    transport(url: string, addresses: {
        address: string;
        family: number;
    }[], headers: Record<string, string>, signal: AbortSignal, maxBytes: number, onBytes: (n: number) => void): Promise<HttpResponse>;
    now(): number;
    sleep(ms: number): Promise<void>;
}
export interface ResearchSession {
    version: string;
    mode: 'LIVE_DISCOVERY' | 'CACHED_REPLAY';
    request: ResearchRequest;
    config: WebResearchConfig;
    plan: ResearchPlan;
    queryPlan: SearchQuery[];
    searchResults: SearchResult[];
    searchTrace: {
        query: SearchQuery;
        resultCount: number;
        diagnostic: string | null;
        latencyMs: number;
    }[];
    candidateSources: CandidateSource[];
    fetchAttempts: FetchAttempt[];
    acceptedSources: SourceInput[];
    rejectedSources: {
        url: string;
        reason: string;
    }[];
    entities: DiscoveredEntity[];
    EvidencePack: EvidencePack;
    writer: GroundedWebWriterResult | null;
    diagnostics: string[];
    scope: {
        title: string;
        scope: 'SESSION_CANDIDATES';
        adjustment: string | null;
        humanReviewRequired: boolean;
    };
    quality: {
        queries: number;
        results: number;
        uniqueDomains: number;
        candidateSources: number;
        fetchAttempts: number;
        successfulFetches: number;
        acceptedSources: number;
        rejectedSources: number;
        discoveredEntities: number;
        groundedFacts: number;
        corroboratedFacts: number;
        conflicts: number;
        researchCoverage: number;
        budgetUsage: {
            bytes: number;
            elapsedMs: number;
            rounds: number;
        };
        liveOrReplay: string;
        resultState: 'REAL_RESEARCH_READY' | 'REAL_RESEARCH_PARTIAL' | 'REAL_RESEARCH_BLOCKED';
        budgetStatus: string;
    };
    /** Present for researchVersion 2 and 3 sessions. */
    v2?: ResearchSessionV2;
    /** Present only for researchVersion 3 sessions. */
    v3?: ResearchSessionV3;
    processingFingerprint: string;
    fingerprint: string;
}
export interface CandidateEntity {
    entityId: string;
    canonicalName: string;
    kind: 'STATION' | 'SETTLEMENT' | 'PLACE' | 'UNKNOWN';
    aliases: string[];
    discoveryPaths: string[];
    sourceIds: string[];
    candidateMetrics: string[];
    candidateResidencySignals: string[];
    status: 'ELIGIBLE' | 'NEAR_ELIGIBLE' | 'NEEDS_EVIDENCE' | 'SEARCH_ONLY' | 'LOW_PRIORITY' | 'OBSERVATION_SITE';
    priority: number;
    coverage: { temperature: string; residency: string; corroboration: string };
}
export interface CorroborationTask {
    id: string;
    factKey: string;
    entity: string;
    metric: string | null;
    qualifier: string | null;
    knownOrigins: string[];
    excludedOrigins: string[];
    preferredSourceTypes: string[];
    queries: { provider: string; text: string; purpose: QueryPurpose }[];
    priority: number;
    budget: number;
    status: 'PENDING' | 'ATTEMPTED' | 'RESOLVED' | 'EXHAUSTED';
}
export interface ResearchSessionV3 {
    version: string;
    candidateEntityPool: CandidateEntity[];
    corroborationTasks: CorroborationTask[];
    discovery: { url: string; independence: DiscoveryIndependence; path: string; provider: string; query: string | null; seedSourceId: string | null; seedEntityId: string | null; seedFactId: string | null; fetchStatus: string; laterDerived: boolean }[];
    gaps: ResearchGap[];
    realWorldGates: Record<string, { passed: boolean; detail: string }>;
    fingerprints: { candidateEntityPool: string; corroborationTasks: string };
}
