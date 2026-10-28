import { jsonHash } from '../../editorial/fingerprint';
import { canonicalUrl, hostMatches } from './security';
import type { SearchProvider, SearchQuery, SearchResult, CandidateSource, WebResearchConfig } from './contracts';
import { SecureHttpClient } from './http';
export class MediaWikiSearchProvider implements SearchProvider {
    readonly kind = 'MEDIAWIKI_REST_SEARCH';
    constructor(private client: SecureHttpClient) { }
    async search(q: SearchQuery, limit: number) { const start = this.client.env.now(), u = new URL(canonicalUrl(this.client.config.searchEndpoint)); u.searchParams.set('q', q.text); u.searchParams.set('limit', String(limit)); try {
        const fetched = await this.client.get(u.href, 262144), r = fetched.response;
        if (r.status !== 200)
            return { results: [], diagnostic: 'SEARCH_PROVIDER_UNAVAILABLE HTTP ' + r.status, latencyMs: this.client.env.now() - start };
        if (!r.headers['content-type']?.includes('application/json'))
            throw Error('Search JSON required');
        const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(r.body));
        if (!Array.isArray(data.pages))
            throw Error('MediaWiki pages missing');
        const results: SearchResult[] = data.pages.slice(0, limit).map((p: any, i: number) => { const url = canonicalUrl('/wiki/' + encodeURIComponent(String(p.key ?? p.title)).replace(/%2F/g, '/'), u.origin), raw = { queryId: q.id, rank: i + 1, title: String(p.title ?? ''), url, snippet: String(p.excerpt ?? '').slice(0, 2000), displayDomain: new URL(url).hostname, provider: this.kind, retrievedMetadata: { retrievedAt: new Date(this.client.env.now()).toISOString(), endpoint: u.href } }; return { ...raw, fingerprint: jsonHash(raw) }; });
        return { results, diagnostic: null, latencyMs: this.client.env.now() - start };
    }
    catch (e) {
        return { results: [], diagnostic: 'SEARCH_PROVIDER_UNAVAILABLE ' + String(e), latencyMs: this.client.env.now() - start };
    } }
}
export function candidateSources(results: SearchResult[], queries: SearchQuery[], config: WebResearchConfig): CandidateSource[] { const map = new Map<string, CandidateSource>(); for (const r of results) {
    let url: string;
    try {
        url = canonicalUrl(r.url);
    }
    catch {
        continue;
    }
    const domain = new URL(url).hostname;
    if (config.blockedDomains.some(d => hostMatches(domain, d)))
        continue;
    const q = queries.find(q => q.id === r.queryId), hint = config.officialDomainHints.find(h => hostMatches(domain, h.domain)), preferred = config.preferredDomains.some(d => hostMatches(domain, d)), old = map.get(url), reason = hint ? 'Explicit official-domain policy hint; final quality requires content' : preferred ? 'Configured domain preference' : 'No authority inferred from TLD or keyword match';
    if (old) {
        old.queryIds = [...new Set([...old.queryIds, r.queryId])].sort();
        old.discoveryRanks.push(r.rank);
        old.researchQuestionIds = [...new Set([...old.researchQuestionIds, ...(q?.researchQuestionIds ?? [])])].sort();
        continue;
    }
    map.set(url, { id: 'C_' + jsonHash(url).slice(0, 16), canonicalUrl: url, domain, queryIds: [r.queryId], researchQuestionIds: q?.researchQuestionIds ?? [], discoveryRanks: [r.rank], title: r.title, expectedSourceType: hint?.sourceType ?? (hostMatches(domain, 'wikipedia.org') ? 'REFERENCE' : 'OTHER'), fetchStatus: 'PENDING', selectionScore: ({ PRIMARY_OFFICIAL: 100, PRIMARY_DATASET: 100, INSTITUTIONAL: 80, ACADEMIC: 70, REFERENCE: 40, NEWS: 20, OTHER: 0 }[hint?.sourceType ?? (hostMatches(domain, 'wikipedia.org') ? 'REFERENCE' : 'OTHER')]) + (preferred ? 60 : 0) + (url.startsWith('https:') ? 1 : 0) + Math.max(0, 10 - r.rank), reasons: [reason, 'Discovery title/snippet never supplies evidence'] });
} return [...map.values()].sort((a, b) => b.selectionScore - a.selectionScore || a.canonicalUrl.localeCompare(b.canonicalUrl, 'en')).slice(0, config.maxCandidateSources); }
