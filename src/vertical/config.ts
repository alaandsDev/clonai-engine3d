import type {WebResearchConfig} from '../research/web/contracts';
/** Generic live budget for a vertical-slice run. No topic-specific domains,
 * hints, queries or sources: discovery comes from the routed request only.
 * Security knobs (robots, MIME, byte/time limits) keep their existing meaning. */
/** The MediaWiki corpus follows the topic language so discovered prose matches the extractor language. */
export function verticalWebConfig(language:'pt'|'en'='pt'):Partial<WebResearchConfig>{
 // v2/v4 blocks are partial on purpose; webConfig() fills and validates the remaining defaults.
 return {...config,searchEndpoint:'https://'+language+'.wikipedia.org/w/rest.php/v1/search/page'} as unknown as Partial<WebResearchConfig>;
}
const config={
 enabled:true,maxResearchRounds:3,maxQueries:24,maxResultsPerQuery:4,maxSearchResults:80,maxCandidateSources:32,maxFetchedSources:24,maxSourcesPerDomain:10,maxBytesPerSource:2097152,maxTotalBytes:16777216,requestTimeoutMs:30000,maxDurationMs:420000,respectRobots:true,allowSessionScopeAdjustment:true,
  v2:{strategies:['MEDIAWIKI_REFERENCE_SEARCH','REFERENCE_FOLLOWING','WIKIDATA_ENTITY_DISCOVERY','CROSSREF_WORKS_SEARCH','PUBLISHER_LINK_FOLLOWING'],budgets:{broadDiscovery:6,originDiscovery:8,verification:4,corroboration:4,entityExpansion:2},maxReferencesPerSource:4,candidatePoolTarget:10,maxDatasetBytes:4194304,maxPublisherLinksPerSource:2},
  v4:{providers:['MEDIAWIKI_REFERENCE_SEARCH','REFERENCE_FOLLOWING','WIKIDATA_ENTITY_DISCOVERY','CROSSREF_WORKS_SEARCH'],bootstrapFetches:6,maxAttemptsPerGap:3,maxFetchesPerStrategy:2,maxFamiliesPerRound:3,maxFailedFamilyAttempts:1}};
