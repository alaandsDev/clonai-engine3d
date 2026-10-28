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
}
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
    processingFingerprint: string;
    fingerprint: string;
}
