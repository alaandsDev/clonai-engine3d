import type { WebResearchConfig, WebResearchV2Config } from './contracts';
import {V4_DEFAULTS,providerCapabilities} from '../v4/planning';
import type {WebResearchV4Config} from '../v4/contracts';
export function webConfig(input: Partial<WebResearchConfig> = {}): WebResearchConfig { const defaults: WebResearchConfig = { enabled: false, searchEndpoint: 'https://en.wikipedia.org/w/rest.php/v1/search/page', maxResearchRounds: 2, maxQueries: 8, maxResultsPerQuery: 5, maxSearchResults: 40, maxCandidateSources: 20, maxFetchedSources: 4, maxSourcesPerDomain: 2, maxBytesPerSource: 1048576, maxTotalBytes: 4194304, requestTimeoutMs: 15000, maxDurationMs: 120000, maxRedirects: 4, allowedMimeTypes: ['text/html', 'text/plain', 'text/tab-separated-values', 'text/csv'], preferredDomains: [], blockedDomains: [], officialDomainHints: [], userAgent: 'ClonAIResearch/0.1 (local experimental public source discovery)', respectRobots: true, perDomainDelayMs: 750, globalConcurrency: 1, cachePolicy: 'REFRESH', allowSessionScopeAdjustment: true }; const c = { ...defaults, ...input }; for (const k of Object.keys(input))
    if (!Object.hasOwn(defaults, k) && k !== 'v2' && k !== 'v4')
        throw Error('WEB_CONFIG unknown ' + k); for (const [k, max] of [['maxResearchRounds', 4], ['maxQueries', 48], ['maxResultsPerQuery', 10], ['maxSearchResults', 200], ['maxCandidateSources', 64], ['maxFetchedSources', 48], ['maxSourcesPerDomain', 16], ['maxBytesPerSource', 2097152], ['maxTotalBytes', 33554432], ['requestTimeoutMs', 30000], ['maxDurationMs', 900000], ['maxRedirects', 8], ['perDomainDelayMs', 10000], ['globalConcurrency', 4]] as const)
    if (!Number.isInteger(c[k]) || c[k] < (k === 'perDomainDelayMs' || k === 'maxRedirects' ? 0 : 1) || c[k] > max)
        throw Error('WEB_CONFIG bound ' + k); if (typeof c.enabled !== 'boolean' || typeof c.respectRobots !== 'boolean' || typeof c.allowSessionScopeAdjustment !== 'boolean' || !c.userAgent.trim() || /[\r\n]/.test(c.userAgent) || !['REFRESH', 'CACHED_REPLAY'].includes(c.cachePolicy))
    throw Error('WEB_CONFIG flags/UA'); if (!Array.isArray(c.allowedMimeTypes) || !c.allowedMimeTypes.length || c.allowedMimeTypes.some(m => !['text/html', 'text/plain', 'text/tab-separated-values', 'text/csv'].includes(m)))
    throw Error('WEB_CONFIG unsupported textual MIME'); for (const d of [...c.preferredDomains, ...c.blockedDomains, ...c.officialDomainHints.map(h => h.domain)])
    if (!/^[a-z0-9.-]+$/i.test(d) || d.includes('..') || d.startsWith('.'))
        throw Error('WEB_CONFIG domain'); new URL(c.searchEndpoint); if (input.v2 !== undefined)
    c.v2 = webV2Config(input.v2, c.maxFetchedSources); if(input.v4!==undefined){c.v4=webV4Config(input.v4);if(c.v4.bootstrapFetches>c.maxFetchedSources)throw Error('WEB_CONFIG v4 bootstrap exceeds fetch budget');} return c; }
export function webV4Config(input:Partial<WebResearchV4Config>):WebResearchV4Config {
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!Object.hasOwn(V4_DEFAULTS,k)))throw Error('WEB_CONFIG v4 fields');
 const c={...V4_DEFAULTS,...input};
 for(const key of ['bootstrapFetches','maxAttemptsPerGap','maxFetchesPerStrategy','maxFamiliesPerRound','maxFailedFamilyAttempts'] as const)if(!Number.isInteger(c[key])||c[key]<1||c[key]>(key==='bootstrapFetches'?12:key==='maxAttemptsPerGap'?8:4))throw Error('WEB_CONFIG v4 bound '+key);
 const known=providerCapabilities().filter(c=>c.enabled).map(c=>c.provider);
 if(!Array.isArray(c.providers)||!c.providers.length||new Set(c.providers).size!==c.providers.length||c.providers.some(p=>!known.includes(p)))throw Error('WEB_CONFIG v4 provider disabled/unsupported');
 for(const endpoint of [c.dataCiteEndpoint,c.ckanEndpoint]){const u=new URL(endpoint);if(u.protocol!=='https:'||u.username||u.password)throw Error('WEB_CONFIG v4 endpoint');}
 return c;
}
const STRATEGIES = ['MEDIAWIKI_REFERENCE_SEARCH', 'REFERENCE_FOLLOWING', 'WIKIDATA_ENTITY_DISCOVERY', 'OPENALEX_ACADEMIC_SEARCH', 'CROSSREF_WORKS_SEARCH', 'PUBLISHER_LINK_FOLLOWING'];
const V3_KEYS = ['crossrefEndpoint', 'maxDatasetBytes', 'maxPublisherLinksPerSource'];
/** Phase 21 discovery configuration. Stage budgets are fetch attempts and together may not exceed maxFetchedSources. */
export function webV2Config(input: Partial<WebResearchV2Config>, maxFetchedSources: number): WebResearchV2Config { const defaults: WebResearchV2Config = { strategies: ['MEDIAWIKI_REFERENCE_SEARCH', 'REFERENCE_FOLLOWING'], budgets: { broadDiscovery: 4, originDiscovery: 6, verification: 6, corroboration: 4 }, maxReferencesPerSource: 6, candidatePoolTarget: 12, wikidataEndpoint: 'https://www.wikidata.org/w/api.php', openAlexEndpoint: 'https://api.openalex.org/works', followArchivedCopies: true }; if (!input || typeof input !== 'object' || Array.isArray(input))
    throw Error('WEB_CONFIG v2 object'); for (const k of Object.keys(input))
    if (!Object.hasOwn(defaults, k) && !V3_KEYS.includes(k))
        throw Error('WEB_CONFIG v2 unknown ' + k); const c = { ...defaults, ...input, budgets: { ...defaults.budgets, ...input.budgets } }; if (!Array.isArray(c.strategies) || !c.strategies.length || c.strategies.some(s => !STRATEGIES.includes(s)) || new Set(c.strategies).size !== c.strategies.length)
    throw Error('WEB_CONFIG v2 strategies'); for (const k of Object.keys(c.budgets))
    if (!['broadDiscovery', 'originDiscovery', 'verification', 'corroboration', 'entityExpansion'].includes(k) || !Number.isInteger(c.budgets[k as 'broadDiscovery']) || c.budgets[k as 'broadDiscovery'] < 0 || c.budgets[k as 'broadDiscovery'] > 32)
        throw Error('WEB_CONFIG v2 budget ' + k); if (Object.values(c.budgets).reduce((n, v) => n + v, 0) > maxFetchedSources)
    throw Error('WEB_CONFIG v2 stage budgets exceed maxFetchedSources'); if (!Number.isInteger(c.maxReferencesPerSource) || c.maxReferencesPerSource < 1 || c.maxReferencesPerSource > 32 || !Number.isInteger(c.candidatePoolTarget) || c.candidatePoolTarget < 1 || c.candidatePoolTarget > 40 || typeof c.followArchivedCopies !== 'boolean')
    throw Error('WEB_CONFIG v2 bounds'); if (c.maxDatasetBytes !== undefined && (!Number.isInteger(c.maxDatasetBytes) || c.maxDatasetBytes < 1 || c.maxDatasetBytes > 16777216) || c.maxPublisherLinksPerSource !== undefined && (!Number.isInteger(c.maxPublisherLinksPerSource) || c.maxPublisherLinksPerSource < 0 || c.maxPublisherLinksPerSource > 8))
    throw Error('WEB_CONFIG v3 bounds'); for (const e of [c.wikidataEndpoint, c.openAlexEndpoint, ...(c.crossrefEndpoint ? [c.crossrefEndpoint] : [])])
    if (new URL(e).protocol !== 'https:')
        throw Error('WEB_CONFIG v2 endpoint'); return c; }
