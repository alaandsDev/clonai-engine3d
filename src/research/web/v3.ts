import { jsonHash } from '../../editorial/fingerprint';
import { normalize } from '../../semantics/normalize';
import { planResearch } from '../planner';
import { buildEvidencePack } from '../pack';
import { registrableDomain, archivedOriginal } from '../origins';
import { entityKey } from '../entities';
import { attributes, cleanText } from '../structured';
import type { EvidencePack, GroundedFact, ResearchPlan, ResearchRequest, SourceInput } from '../contracts';
import type { CandidateEntity, CandidateSource, CorroborationTask, DiscoveryIndependence, DiscoveryStrategy, FetchAttempt, QueryPurpose, ReferenceCandidate, ResearchGap, ResearchSession, ResearchSessionV2, ResearchSessionV3, ResearchStage, SearchProvider, SearchQuery, SearchResult, WebEnvironment, WebResearchConfig } from './contracts';
import { SecureHttpClient, nodeEnvironment } from './http';
import { MediaWikiSearchProvider, candidateSources } from './search';
import { WebSourceProvider } from './fetcher';
import { SnapshotCache } from './cache';
import { canonicalUrl } from './security';
import { OpenAlexWorksProvider, WikidataEntityProvider, broadQueriesV2, referenceCandidates } from './v2';
export const WEB_RESEARCH_V3_VERSION = 'web-research/3.0.0';
// ---------- Crossref (free, keyless) ----------
/** Crossref works search: DOI landing pages as candidates; metadata is discovery data only, never Evidence. */
export class CrossrefWorksProvider implements SearchProvider {
    readonly kind = 'CROSSREF_WORKS_SEARCH';
    constructor(private client: SecureHttpClient, private endpoint: string) { }
    async search(q: SearchQuery, limit: number) { const start = this.client.env.now(); try {
        const u = new URL(this.endpoint);
        u.search = new URLSearchParams({ query: q.text, rows: String(Math.max(1, Math.min(limit, 10))), select: 'DOI,title,URL' }).toString();
        const r = (await this.client.get(u.href, 1048576, { allowedMimes: ['application/json'] })).response;
        if (r.status !== 200 || !r.headers['content-type']?.includes('json'))
            return { results: [], diagnostic: 'SEARCH_PROVIDER_UNAVAILABLE HTTP ' + r.status, latencyMs: this.client.env.now() - start };
        const items = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(r.body))?.message?.items, results: SearchResult[] = [];
        for (const w of Array.isArray(items) ? items : [])
            try {
                const url = canonicalUrl(String(w?.URL ?? '')), raw = { queryId: q.id, rank: results.length + 1, title: String(Array.isArray(w?.title) ? w.title[0] ?? '' : '').slice(0, 300), url, snippet: '', displayDomain: new URL(url).hostname, provider: this.kind, retrievedMetadata: { retrievedAt: new Date(this.client.env.now()).toISOString(), endpoint: u.href } };
                results.push({ ...raw, fingerprint: jsonHash(raw) });
            }
            catch { }
        return { results: results.slice(0, limit), diagnostic: null, latencyMs: this.client.env.now() - start };
    }
    catch (e) {
        return { results: [], diagnostic: 'SEARCH_PROVIDER_UNAVAILABLE ' + String(e), latencyMs: this.client.env.now() - start };
    } }
}
// ---------- vocabulary (generic; derived from plan constraints, never entities) ----------
function vocabulary(plan: ResearchPlan) {
    const c = plan.request.constraints ?? {}, population = c.metric === 'POPULATION';
    return { metric: population ? 'population census' : c.qualifier === 'AVERAGE' ? 'average temperature' : 'lowest temperature recorded', record: population ? 'population' : 'record low temperature', residency: c.residencyCriterion === 'PERMANENT_POPULATION' || c.residencyCriterion === 'PERMANENT_SETTLEMENT' ? 'permanently inhabited settlement' : c.residencyCriterion ? 'research station staff' : '', official: population ? 'census statistics' : 'climate statistics weather station' };
}
const query = (plan: ResearchPlan, round: number, purpose: QueryPurpose, text: string, extra: Partial<SearchQuery> = {}): SearchQuery => { const stage: SearchQuery['stage'] = purpose === 'ENTITY_DISCOVERY' ? 'ENTITY_DISCOVERY' : purpose === 'CORROBORATION_DISCOVERY' ? 'CORROBORATION' : purpose === 'METRIC_DISCOVERY' && round === 0 ? 'BROAD_DISCOVERY' : 'FACT_VERIFICATION'; const raw = { round, stage, researchQuestionIds: plan.essentialResearchQuestionIds, text: text.replace(/\s+/g, ' ').trim(), entityName: null, entitySourceIds: [], followupReason: purpose, purpose, ...extra }; return { ...raw, id: 'Q_' + jsonHash(raw).slice(0, 16) }; };
/** R0 queries: the Phase 21 plan queries plus list/record vocabulary for a larger candidate pool. */
export function broadQueriesV3(plan: ResearchPlan, config: WebResearchConfig): SearchQuery[] {
    const v = vocabulary(plan), base = broadQueriesV2(plan, config).map(q => ({ ...q, purpose: 'ENTITY_DISCOVERY' as QueryPurpose, derivedFrom: 'PLAN', targetGap: 'CANDIDATE_POOL' }));
    const extra = plan.request.constraints?.metric === 'POPULATION' ? [] : [query(plan, 0, 'ENTITY_DISCOVERY', 'list of extreme temperatures', { derivedFrom: 'PLAN_VOCABULARY', targetGap: 'CANDIDATE_POOL' }), query(plan, 0, 'METRIC_DISCOVERY', v.metric + ' ' + v.residency, { derivedFrom: 'PLAN_VOCABULARY', targetGap: 'CANDIDATE_POOL' })];
    return [...base, ...extra];
}
// ---------- candidate entity pool ----------
const state = (fs: GroundedFact[]) => fs.some(f => f.usableForPrimaryClaim) ? (fs.some(f => f.status === 'CORROBORATED') ? 'CORROBORATED' : 'SUPPORTED') : fs.some(f => f.status === 'CONFLICTED') ? 'CONFLICTED' : fs.length ? 'INSUFFICIENT' : 'MISSING';
const score = (s: string) => s === 'SUPPORTED' || s === 'CORROBORATED' || s === 'NOT_REQUIRED' ? 2 : s === 'INSUFFICIENT' ? 1 : 0;
/** Deterministic pool from the pack (facts, EntityGraph, eligibility, aliases) and search titles; priority is value of information. */
export function candidateEntityPool(pack: EvidencePack, plan: ResearchPlan, searchResults: SearchResult[], queries: SearchQuery[]): CandidateEntity[] {
    const c = plan.request.constraints ?? {}, ranking = plan.request.researchGoal === 'RANKING', graph = pack.v3?.entityGraph, out = new Map<string, CandidateEntity>();
    const keyOf = (f: GroundedFact) => entityKey(f.canonicalFact.subject, f.canonicalFact.subjectKind), aliases = pack.v2?.aliases ?? [];
    for (const k of [...new Set(pack.groundedFacts.map(keyOf))].sort()) {
        const fs = pack.groundedFacts.filter(f => keyOf(f) === k), name = fs[0].canonicalFact.subject, station = k.endsWith('|station'), node = graph?.nodes.find(n => entityKey(n.name, n.kind === 'STATION' ? 'STATION' : undefined) === k);
        const metricFacts = fs.filter(f => ranking ? f.factType === 'MEASUREMENT' && f.canonicalFact.metric === c.metric && f.qualifiers.includes(c.qualifier ?? '') : f.factType === 'QUANTITY' || f.factType === 'MEASUREMENT');
        const linkedSites = graph ? graph.edges.filter(e => e.relation === 'OBSERVATION_SITE_FOR' && node && e.to === node.id).map(e => graph.nodes.find(n => n.id === e.from)!) : [];
        const viaSites = pack.groundedFacts.filter(f => f.canonicalFact.subjectKind === 'STATION' && linkedSites.some(n => entityKey(n.name, 'STATION') === keyOf(f)) && f.qualifiers.includes(c.qualifier ?? ''));
        const res = fs.filter(f => f.factType === 'RESIDENCY'), wanted = res.filter(f => f.canonicalFact.residency === c.residencyCriterion);
        const temperature = state([...metricFacts, ...viaSites]), residency = !c.residencyCriterion ? 'NOT_REQUIRED' : state(wanted), eligibility = pack.v3?.eligibility.find(e => normalize(e.entity) === normalize(name));
        const incompatible = c.residencyCriterion && !wanted.length && res.length > 0, total = score(temperature) + score(residency);
        const status: CandidateEntity['status'] = station ? 'OBSERVATION_SITE' : eligibility?.eligible || !ranking && score(temperature) === 2 ? 'ELIGIBLE' : incompatible || !metricFacts.length && fs.some(f => f.factType === 'MEASUREMENT') && !wanted.length ? 'LOW_PRIORITY' : total === 3 ? 'NEAR_ELIGIBLE' : 'NEEDS_EVIDENCE';
        // Value of information: a task that can move an entity to eligibility (1/2 → 2/2 with the other check complete) ranks first.
        const priority = status === 'ELIGIBLE' || status === 'OBSERVATION_SITE' ? 0 : status === 'LOW_PRIORITY' ? 1 : total * 10 + (total === 3 ? 15 : 0) + (temperature === 'CONFLICTED' || residency === 'CONFLICTED' ? -5 : 0);
        out.set(k, { entityId: 'EC_' + jsonHash(k).slice(0, 16), canonicalName: name, kind: station ? 'STATION' : node?.kind ?? 'PLACE', aliases: aliases.filter(a => (a.status === 'CONFIRMED_ALIAS' || a.status === 'SUPPORTED_ALIAS') && normalize(a.name) === normalize(name)).map(a => a.alias + ' (' + a.status + ')').sort(), discoveryPaths: [...new Set(fs.flatMap(f => f.sourceIds).map(id => 'SOURCE:' + id))].sort(), sourceIds: [...new Set(fs.flatMap(f => f.sourceIds))].sort(), candidateMetrics: [...new Set(fs.filter(f => f.factType !== 'RESIDENCY').flatMap(f => f.qualifiers))].sort(), candidateResidencySignals: [...new Set(res.map(f => f.canonicalFact.residency!))].sort(), status, priority, coverage: { temperature, residency, corroboration: [temperature, residency].every(s => s === 'CORROBORATED' || s === 'NOT_REQUIRED') ? 'READY' : 'NEEDS_INDEPENDENT_ORIGIN' } });
    }
    const purposeOf = new Map(queries.map(q => [q.id, q.purpose ?? q.stage]));
    for (const r of searchResults.filter(r => /wikipedia|MEDIAWIKI/i.test(r.provider) || r.provider === 'MOCK_MEDIAWIKI')) {
        const k = entityKey(r.title);
        if (out.has(k))
            continue;
        out.set(k, { entityId: 'EC_' + jsonHash(k).slice(0, 16), canonicalName: r.title, kind: 'UNKNOWN', aliases: [], discoveryPaths: ['SEARCH_TITLE:' + (purposeOf.get(r.queryId) ?? 'UNKNOWN') + ':' + r.queryId], sourceIds: [], candidateMetrics: [], candidateResidencySignals: [], status: 'SEARCH_ONLY', priority: 2, coverage: { temperature: 'MISSING', residency: c.residencyCriterion ? 'MISSING' : 'NOT_REQUIRED', corroboration: 'NEEDS_INDEPENDENT_ORIGIN' } });
    }
    return [...out.values()].sort((a, b) => b.priority - a.priority || normalize(a.canonicalName).localeCompare(normalize(b.canonicalName), 'en'));
}
// ---------- corroboration tasks ----------
/** One task per relevant single-origin fact: search for a second origin while excluding the known origin chain. */
export function corroborationTasks(pack: EvidencePack, plan: ResearchPlan, pool: CandidateEntity[], attempts: { seedFactId: string | null; independence?: DiscoveryIndependence }[] = []): CorroborationTask[] {
    const c = plan.request.constraints ?? {}, v = vocabulary(plan), ranking = plan.request.researchGoal === 'RANKING', priority = new Map(pool.map(p => [normalize(p.canonicalName), p.priority]));
    const relevant = (f: GroundedFact) => ranking ? f.factType === 'MEASUREMENT' && f.qualifiers.includes(c.qualifier ?? '') || f.factType === 'RESIDENCY' && f.canonicalFact.residency === c.residencyCriterion : f.factType === 'QUANTITY' || f.factType === 'MEASUREMENT';
    const tasks = pack.groundedFacts.filter(f => relevant(f) && f.status === 'INSUFFICIENT' && f.independentOriginCount >= 1).map(f => {
        const ev = pack.evidence.filter(e => f.evidenceIds.includes(e.id)), domains = new Set<string>();
        for (const e of ev) {
            const s = pack.sources.find(x => x.id === e.sourceId)!;
            domains.add(registrableDomain(new URL(archivedOriginal(s.canonicalLocator) ?? s.canonicalLocator).hostname));
            for (const u of e.citations ?? [])
                domains.add(registrableDomain(new URL(u).hostname));
        }
        const entity = f.canonicalFact.subject, text = entity + ' ' + (f.factType === 'RESIDENCY' ? v.residency : v.record), resolved = f.usableForPrimaryClaim;
        const raw = { factKey: f.id, entity, metric: f.canonicalFact.metric, qualifier: f.factType === 'RESIDENCY' ? f.canonicalFact.residency : f.qualifiers[0] ?? null, knownOrigins: [...new Set(ev.map(e => e.originGroupId ?? ''))].filter(Boolean).sort(), excludedOrigins: [...domains].sort(), preferredSourceTypes: ['PRIMARY_OFFICIAL', 'PRIMARY_DATASET', 'INSTITUTIONAL', 'ACADEMIC'], queries: [{ provider: 'OPENALEX_ACADEMIC_SEARCH', text, purpose: 'CORROBORATION_DISCOVERY' as const }, { provider: 'CROSSREF_WORKS_SEARCH', text, purpose: 'CORROBORATION_DISCOVERY' as const }, { provider: 'WIKIDATA_ENTITY_DISCOVERY', text: entity, purpose: 'OFFICIAL_SOURCE_DISCOVERY' as const }], priority: priority.get(normalize(entity)) ?? 0, budget: 2 };
        const spent = attempts.filter(a => a.seedFactId === f.id && (a.independence === 'CORPUS_INDEPENDENT' || a.independence === 'QUERY_INDEPENDENT')).length;
        return { id: 'CT_' + jsonHash(raw).slice(0, 16), ...raw, status: resolved ? 'RESOLVED' as const : spent >= raw.budget ? 'EXHAUSTED' as const : spent ? 'ATTEMPTED' as const : 'PENDING' as const };
    });
    return tasks.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id, 'en')).slice(0, 24);
}
// ---------- publisher links (official sources only) ----------
/** Same-publisher data links in an official snapshot (dataset files or full-statistics pages for the same subject). Never guessed endpoints. */
export function publisherLinks(source: SourceInput, subject: string, max: number): { url: string; text: string }[] {
    if (max <= 0)
        return [];
    const out: { url: string; text: string }[] = [], domain = registrableDomain(new URL(source.canonicalLocator).hostname);
    for (const m of source.content.matchAll(/<a\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]{0,200}?)<\/a>/gi)) {
        const a = attributes('<a' + m[1] + '>'), text = cleanText(m[2].replace(/<[^>]*>/g, ' '));
        if (!a.href || a.href.startsWith('#') || a.href.startsWith('javascript:'))
            continue;
        let url: string;
        try {
            url = canonicalUrl(a.href, source.canonicalLocator);
        }
        catch {
            continue;
        }
        const dataLink = /\.(?:csv|tsv|txt)(?:$|[?#])/i.test(url) && /\b(?:data|statistics|csv|file)\b/i.test(text + ' ' + (a.title ?? '')), sameSubject = /\b(?:all|full|extended|complete) (?:available |)?(?:statistics|data|records)\b/i.test(text) || normalize(text).includes(normalize(subject));
        if (registrableDomain(new URL(url).hostname) === domain && url !== source.canonicalLocator && (dataLink || sameSubject) && !out.some(x => x.url === url))
            out.push({ url, text });
        if (out.length >= max)
            break;
    }
    return out;
}
const pdfDiagnostic = (r: ReferenceCandidate): ReferenceCandidate['pdfDiagnostic'] => /\b(?:table|data|statistic|dataset|appendix)\b/i.test(r.anchorText + ' ' + r.targetUrl) ? 'PDF_TABLE_REQUIRED' : /\b(?:thesis|report|paper|article|study|chapter|front|whole)\b/i.test(r.anchorText + ' ' + r.targetUrl) ? 'PDF_TEXT_REQUIRED' : 'PDF_SCANNED_UNKNOWN';
// ---------- loop ----------
export type Finish = (args: { request: ResearchRequest; config: WebResearchConfig; plan: ResearchPlan; queries: SearchQuery[]; results: SearchResult[]; trace: ResearchSession['searchTrace']; candidates: CandidateSource[]; attempts: FetchAttempt[]; acquired: SourceInput[]; rejected: ResearchSession['rejectedSources']; diagnostics: string[]; rounds: number; client: SecureHttpClient; start: number; env: WebEnvironment; v2: (pack: EvidencePack, writerGaps: ResearchGap[]) => ResearchSessionV2; v3?: (pack: EvidencePack, v2: ResearchSessionV2) => ResearchSessionV3; v4?: (pack:EvidencePack) => import('../v4/contracts').ResearchSessionV4 }) => ResearchSession;
export async function runWebResearchV3(request: ResearchRequest, config: WebResearchConfig, options: { env?: WebEnvironment; searchProvider?: SearchProvider; extraProviders?: Partial<Record<DiscoveryStrategy, SearchProvider>>; cache?: SnapshotCache } = {}, finish: Finish): Promise<ResearchSession> {
    const v = config.v2!, plan = planResearch(request), env = options.env ?? nodeEnvironment, start = env.now(), client = new SecureHttpClient(config, env);
    client.deadline = start + config.maxDurationMs;
    const mediawiki = options.searchProvider ?? new MediaWikiSearchProvider(client), providers: Partial<Record<DiscoveryStrategy, SearchProvider>> = { MEDIAWIKI_REFERENCE_SEARCH: mediawiki, WIKIDATA_ENTITY_DISCOVERY: new WikidataEntityProvider(client, v.wikidataEndpoint), OPENALEX_ACADEMIC_SEARCH: new OpenAlexWorksProvider(client, v.openAlexEndpoint), CROSSREF_WORKS_SEARCH: new CrossrefWorksProvider(client, v.crossrefEndpoint ?? 'https://api.crossref.org/works'), ...options.extraProviders };
    const fetcher = new WebSourceProvider(client, options.cache), queries: SearchQuery[] = [], results: SearchResult[] = [], trace: ResearchSession['searchTrace'] = [], attempts: FetchAttempt[] = [], rejected: ResearchSession['rejectedSources'] = [], diagnostics: string[] = [], candidates: CandidateSource[] = [], references: ReferenceCandidate[] = [], discovery: ResearchSessionV3['discovery'] = [];
    const strategyLog = new Map<DiscoveryStrategy, ResearchSessionV2['strategies'][number]>(v.strategies.map(s => [s, { kind: s, executed: false, queries: 0, results: 0, candidates: 0, diagnostics: [] }]));
    const budgets: ResearchSessionV2['stageBudgets'] = ([['BROAD_DISCOVERY', v.budgets.broadDiscovery], ['VERIFICATION', (v.budgets.entityExpansion ?? 0) + v.budgets.verification], ['ORIGIN_DISCOVERY', v.budgets.originDiscovery], ['CORROBORATION', v.budgets.corroboration]] as const).map(([stage, budget]) => ({ stage: stage as ResearchStage, budget, used: 0, reallocatedIn: 0 }));
    const stageOf = (s: ResearchStage) => budgets.find(b => b.stage === s)!, attempted = new Set<string>(), domainCounts = new Map<string, number>(), asked = new Map<string, SearchResult[]>();
    const global = () => env.now() - start >= config.maxDurationMs || client.bytes >= config.maxTotalBytes || attempts.length >= config.maxFetchedSources;
    const search = async (strategy: DiscoveryStrategy, q: SearchQuery, limit: number) => { const provider = providers[strategy], log = strategyLog.get(strategy), seen = asked.get(strategy + '\n' + q.text); if (seen)
        return seen; if (!provider || !log || queries.length >= config.maxQueries || results.length >= config.maxSearchResults || global())
        return []; const traced = { ...q, provider: strategy }; queries.push(traced); log.executed = true; log.queries++; const found = await provider.search(traced, Math.min(limit, config.maxResultsPerQuery, config.maxSearchResults - results.length)); trace.push({ query: traced, resultCount: found.results.length, diagnostic: found.diagnostic, latencyMs: found.latencyMs }); if (found.diagnostic) {
        diagnostics.push(strategy + ' ' + found.diagnostic);
        log.diagnostics.push(found.diagnostic);
    } results.push(...found.results); log.results += found.results.length; asked.set(strategy + '\n' + q.text, found.results); return found.results; };
    const terms = () => [...new Set(buildEvidencePack(request, fetcher).groundedFacts.map(f => f.canonicalFact.subject))];
    const fetchOne = async (c: CandidateSource, stage: ResearchStage, via: string, independence: DiscoveryIndependence, meta: { path: string; provider: string; query: string | null; seedSourceId?: string | null; seedEntityId?: string | null; seedFactId?: string | null; referenceId?: string | null }) => { const b = stageOf(stage); if (global() || b.used >= b.budget || attempted.has(c.canonicalUrl))
        return null; if ((domainCounts.get(c.domain) ?? 0) >= config.maxSourcesPerDomain) {
        c.fetchStatus = 'DOMAIN_QUOTA';
        return null;
    } attempted.add(c.canonicalUrl); domainCounts.set(c.domain, (domainCounts.get(c.domain) ?? 0) + 1); b.used++; Object.assign(c, { discoveryPath: meta.path, discoveryProvider: meta.provider, discoveryQuery: meta.query, seedSourceId: meta.seedSourceId ?? null, seedEntityId: meta.seedEntityId ?? null, seedFactId: meta.seedFactId ?? null, discoveryIndependence: independence }); const dataset = /\.(?:csv|tsv|txt)(?:$|[?#])/i.test(c.canonicalUrl) && v.maxDatasetBytes ? { maxBytes: v.maxDatasetBytes, terms: terms() } : undefined; const fetched = await fetcher.fetch(c, plan, { via: via as 'SEARCH_RESULT', referenceIds: meta.referenceId ? [meta.referenceId] : [], strategy: meta.provider, independence, version: 3, ...(dataset ? { dataset } : {}) }); attempts.push(fetched.attempt); discovery.push({ url: c.canonicalUrl, independence, path: meta.path, provider: meta.provider, query: meta.query, seedSourceId: meta.seedSourceId ?? null, seedEntityId: meta.seedEntityId ?? null, seedFactId: meta.seedFactId ?? null, fetchStatus: fetched.attempt.status, laterDerived: false }); c.fetchStatus = fetched.attempt.status; if (!candidates.includes(c))
        candidates.push(c); if (!fetched.source)
        rejected.push({ url: c.canonicalUrl, reason: fetched.attempt.reason }); return fetched; };
    const reallocate = (from: ResearchStage) => { const i = budgets.findIndex(b => b.stage === from), b = budgets[i], next = budgets[i + 1]; if (!next || b.used >= b.budget)
        return; const left = b.budget - b.used; b.budget = b.used; next.budget += left; next.reallocatedIn += left; diagnostics.push('BUDGET_REALLOCATED ' + left + ' ' + from + '→' + next.stage); };
    // R0 broad candidate discovery through the reference corpus.
    for (const q of broadQueriesV3(plan, config))
        await search('MEDIAWIKI_REFERENCE_SEARCH', q, config.maxResultsPerQuery);
    for (const c of candidateSources(results, queries, config))
        await fetchOne(c, 'BROAD_DISCOVERY', 'SEARCH_RESULT', 'QUERY_INDEPENDENT', { path: 'R0 search result', provider: 'MEDIAWIKI_REFERENCE_SEARCH', query: queries.find(q => c.queryIds.includes(q.id))?.text ?? null });
    reallocate('BROAD_DISCOVERY');
    let pack = buildEvidencePack(request, fetcher), rounds = 1;
    const vocab = vocabulary(plan);
    for (let round = 1; round < config.maxResearchRounds && !global(); round++) {
        rounds = round + 1;
        if (pack.ranking?.status === 'VALID') {
            diagnostics.push('EARLY_STOP_RANKING_VALID');
            break;
        }
        const before = attempts.length, pool = candidateEntityPool(pack, plan, results, queries);
        // R1/R2 entity pool expansion and metric/residency verification: the entity's own reference page.
        let actionable = 0;
        for (const e of pool.filter(e => e.status !== 'ELIGIBLE' && e.status !== 'OBSERVATION_SITE' && e.status !== 'LOW_PRIORITY').slice(0, v.candidatePoolTarget)) {
            if (stageOf('VERIFICATION').used >= stageOf('VERIFICATION').budget || global())
                break;
            const own = results.find(r => normalize(r.title) === normalize(e.canonicalName) && /wikipedia|MEDIAWIKI/i.test(r.provider + r.url));
            const purpose: QueryPurpose = e.coverage.temperature === 'MISSING' ? 'METRIC_DISCOVERY' : 'RESIDENCY_DISCOVERY';
            const found = own ? [own] : e.status === 'SEARCH_ONLY' ? [] : await search('MEDIAWIKI_REFERENCE_SEARCH', query(plan, round, purpose, e.canonicalName + ' ' + (purpose === 'METRIC_DISCOVERY' ? vocab.metric : vocab.residency || vocab.metric), { entityName: e.canonicalName, derivedFrom: e.entityId, targetGap: purpose === 'METRIC_DISCOVERY' ? 'TEMPERATURE_MISSING' : 'RESIDENCY_' + e.coverage.residency }), 3);
            const page = found.find(r => normalize(r.title) === normalize(e.canonicalName));
            if (!page) {
                if (e.status !== 'SEARCH_ONLY')
                    diagnostics.push('SOURCE_DISCOVERY_GAP entity page not found for ' + e.canonicalName);
                continue;
            }
            const c = candidateSources([page], queries, config)[0];
            if (c && !attempted.has(c.canonicalUrl)) {
                actionable++;
                await fetchOne(c, 'VERIFICATION', 'FOLLOW_UP', own ? 'QUERY_INDEPENDENT' : 'ENTITY_DERIVED', { path: (e.status === 'SEARCH_ONLY' ? 'R1 entity pool expansion' : 'R2 ' + purpose) + ' for ' + e.canonicalName, provider: 'MEDIAWIKI_REFERENCE_SEARCH', query: queries.find(q => q.id === page.queryId)?.text ?? null, seedEntityId: e.entityId });
            }
        }
        if (!actionable)
            reallocate('VERIFICATION');
        pack = buildEvidencePack(request, fetcher);
        // R3 official/source-origin pursuit: references attached to evidence, then same-publisher data links of official sources.
        const focus = new Set(candidateEntityPool(pack, plan, [], []).filter(e => e.status !== 'ELIGIBLE' && e.coverage.corroboration !== 'READY').map(e => normalize(e.canonicalName).replace(/\s+/g, ' ')));
        if (v.strategies.includes('REFERENCE_FOLLOWING'))
            for (const r of referenceCandidates(pack, plan, focus, attempted, v.maxReferencesPerSource))
                if (!references.some(x => x.targetUrl === r.targetUrl))
                    references.push(r.status === 'SKIPPED_FORMAT' ? { ...r, pdfDiagnostic: pdfDiagnostic(r) } : r);
        const pending = references.filter(r => r.status === 'PENDING' || r.status === 'SKIPPED_BUDGET').sort((a, b) => b.priority - a.priority || a.targetUrl.localeCompare(b.targetUrl, 'en'));
        if (pending.length)
            strategyLog.get('REFERENCE_FOLLOWING')!.executed = true;
        for (const r of pending) {
            if (stageOf('ORIGIN_DISCOVERY').used >= stageOf('ORIGIN_DISCOVERY').budget || global()) {
                r.status = 'SKIPPED_BUDGET';
                continue;
            }
            const c: CandidateSource = { id: 'C_' + jsonHash(r.targetUrl).slice(0, 16), canonicalUrl: r.targetUrl, domain: new URL(r.targetUrl).hostname, queryIds: [], researchQuestionIds: r.researchQuestionIds, discoveryRanks: [], title: r.anchorText, expectedSourceType: 'OTHER', fetchStatus: 'PENDING', selectionScore: r.priority, reasons: [r.reason, 'Reference link; source class decided after fetch'] };
            let fetched = await fetchOne(c, 'ORIGIN_DISCOVERY', 'REFERENCE_LINK', 'REFERENCE_DERIVED', { path: 'R3 reference of ' + r.sourceId, provider: 'REFERENCE_FOLLOWING', query: null, seedSourceId: r.sourceId, seedFactId: pack.groundedFacts.find(f => r.evidenceIds.some(id => f.evidenceIds.includes(id)))?.id ?? null, referenceId: r.id });
            if (fetched)
                r.fetchAttemptIds.push(fetched.attempt.id);
            const stale = fetched?.source && r.subject && !buildEvidencePack(request, { version: 1, id: 'reference-subject-check', fixture: false, labels: ['REAL_WEB_SNAPSHOTS'], sources: [fetched.source] }).evidence.some(e => normalize(e.supports.subject) === normalize(r.subject!));
            if (fetched && r.archiveUrl && v.followArchivedCopies && (stale || !fetched.source && /HTTP_ERROR|TIMEOUT|CONTENT_UNAVAILABLE|PARSE_FAILED/.test(fetched.attempt.status))) {
                const a: CandidateSource = { ...c, id: 'C_' + jsonHash(r.archiveUrl).slice(0, 16), canonicalUrl: r.archiveUrl, domain: new URL(r.archiveUrl).hostname, reasons: [...c.reasons, 'Archived copy listed by the reference'] };
                const archived = await fetchOne(a, 'ORIGIN_DISCOVERY', 'ARCHIVED_COPY', 'REFERENCE_DERIVED', { path: 'R3 archived copy listed by reference ' + r.id, provider: 'REFERENCE_FOLLOWING', query: null, seedSourceId: r.sourceId, referenceId: r.id });
                if (archived)
                    r.fetchAttemptIds.push(archived.attempt.id);
                fetched = archived?.source ? archived : fetched;
            }
            r.status = !fetched ? 'SKIPPED_BUDGET' : fetched.source ? 'FETCHED' : 'FAILED';
        }
        strategyLog.get('REFERENCE_FOLLOWING') && (strategyLog.get('REFERENCE_FOLLOWING')!.candidates = references.length);
        pack = buildEvidencePack(request, fetcher);
        if (v.strategies.includes('PUBLISHER_LINK_FOLLOWING'))
            for (const a of (pack.v3?.authority ?? []).filter(a => a.authority === 'INSTITUTIONAL_HIGH')) {
                const source = fetcher.receive(plan).sources.find(s => s.id === a.sourceId), ctx = pack.v3?.documentContexts.find(x => x.sourceId === a.sourceId);
                if (!source || !ctx?.resolved)
                    continue;
                for (const link of publisherLinks(source, ctx.resolved.name, v.maxPublisherLinksPerSource ?? 2)) {
                    strategyLog.get('PUBLISHER_LINK_FOLLOWING')!.executed = true;
                    strategyLog.get('PUBLISHER_LINK_FOLLOWING')!.candidates++;
                    const c: CandidateSource = { id: 'C_' + jsonHash(link.url).slice(0, 16), canonicalUrl: link.url, domain: new URL(link.url).hostname, queryIds: [], researchQuestionIds: plan.essentialResearchQuestionIds, discoveryRanks: [], title: link.text, expectedSourceType: 'OTHER', fetchStatus: 'PENDING', selectionScore: 50, reasons: ['Same-publisher data link in an official snapshot ("' + link.text + '")'] };
                    await fetchOne(c, 'ORIGIN_DISCOVERY', 'PUBLISHER_LINK', 'PUBLISHER_DISCOVERED', { path: 'R3 publisher link in ' + a.sourceId, provider: 'PUBLISHER_LINK_FOLLOWING', query: null, seedSourceId: a.sourceId });
                }
            }
        pack = buildEvidencePack(request, fetcher);
        // R4 independent corroboration: second-origin search excluding the known origin chain.
        const tasks = corroborationTasks(pack, plan, candidateEntityPool(pack, plan, results, queries), discovery);
        const taskSpent = (id: string) => discovery.filter(d => d.seedFactId === id && (d.independence === 'CORPUS_INDEPENDENT' || d.independence === 'QUERY_INDEPENDENT')).length;
        for (const t of tasks.filter(t => t.status === 'PENDING' || t.status === 'ATTEMPTED').slice(0, 6))
            for (const q of t.queries) {
                if (taskSpent(t.factKey) >= t.budget || stageOf('CORROBORATION').used >= stageOf('CORROBORATION').budget || global() || !v.strategies.includes(q.provider as DiscoveryStrategy))
                    continue;
                const found = await search(q.provider as DiscoveryStrategy, query(plan, round, q.purpose, q.text, { entityName: t.entity, factId: t.factKey, derivedFrom: t.id, targetGap: 'CORROBORATION', excludedOrigins: t.excludedOrigins }), 2), cs = candidateSources(found, queries, config);
                strategyLog.get(q.provider as DiscoveryStrategy) && (strategyLog.get(q.provider as DiscoveryStrategy)!.candidates += cs.length);
                for (const c of cs) {
                    if (taskSpent(t.factKey) >= t.budget)
                        break;
                    if (t.excludedOrigins.includes(registrableDomain(c.domain))) {
                        diagnostics.push('CORROBORATION_EXCLUDED_KNOWN_ORIGIN ' + c.canonicalUrl);
                        continue;
                    }
                    if (/\.pdf(?:$|[?#])/i.test(c.canonicalUrl)) {
                        diagnostics.push('PRIMARY_SOURCE_DISCOVERED_BUT_PDF_UNSUPPORTED ' + c.canonicalUrl);
                        continue;
                    }
                    await fetchOne(c, 'CORROBORATION', q.provider === 'WIKIDATA_ENTITY_DISCOVERY' ? 'INSTITUTION_LINK' : 'SEARCH_RESULT', 'CORPUS_INDEPENDENT', { path: 'R4 corroboration task ' + t.id, provider: q.provider, query: q.text, seedFactId: t.factKey });
                }
            }
        const corroboration = stageOf('CORROBORATION'), origin = stageOf('ORIGIN_DISCOVERY'), queued = references.filter(r => r.status === 'SKIPPED_BUDGET').length;
        if (queued && corroboration.budget > corroboration.used) {
            const left = Math.min(queued, corroboration.budget - corroboration.used);
            corroboration.budget -= left;
            origin.budget += left;
            origin.reallocatedIn += left;
            diagnostics.push('BUDGET_REALLOCATED ' + left + ' CORROBORATION→ORIGIN_DISCOVERY');
        }
        pack = buildEvidencePack(request, fetcher);
        if (attempts.length === before && !queued) {
            diagnostics.push('NO_ACTIONABLE_GAP_FOLLOWUP round ' + round);
            break;
        }
    }
    // Session-level v2 view (strategies, references, budgets, gaps, metrics) and the v3 view (pool, tasks, discovery provenance).
    const v2 = (finalPack: EvidencePack, writerGaps: ResearchGap[]): ResearchSessionV2 => {
        const gaps: ResearchGap[] = [...writerGaps];
        for (const a of attempts.filter(a => a.status !== 'SUCCESS' || /UNSUPPORTED_LANGUAGE/.test(a.reason))) {
            const code = /UNSUPPORTED_LANGUAGE/.test(a.reason) ? 'UNSUPPORTED_LANGUAGE' : /JS_RENDER_REQUIRED|ANTI_BOT_CHALLENGE|EMPTY_STATIC_HTML/.exec(a.reason)?.[0] ?? (/MIME_BLOCKED|PARSE_FAILED|CONTENT_UNAVAILABLE/.test(a.status + a.reason) ? 'SOURCE_FORMAT_GAP' : 'SOURCE_FETCH_GAP');
            gaps.push({ code: code as ResearchGap['code'], subject: references.find(r => r.fetchAttemptIds.includes(a.id))?.subject ?? null, url: a.url, detail: a.status + ': ' + a.reason.slice(0, 200) });
        }
        for (const r of references.filter(r => r.status === 'SKIPPED_FORMAT'))
            gaps.push({ code: r.pdfDiagnostic ?? 'PDF_SCANNED_UNKNOWN', subject: r.subject, url: r.targetUrl, detail: 'PDF reference not fetched (PDF_SOURCE_UNSUPPORTED); diagnostic from reference context only' });
        for (const d of diagnostics.filter(d => d.startsWith('SOURCE_DISCOVERY_GAP') || d.startsWith('PRIMARY_SOURCE_DISCOVERED_BUT_PDF_UNSUPPORTED')))
            gaps.push({ code: d.startsWith('SOURCE') ? 'SOURCE_DISCOVERY_GAP' : 'PRIMARY_SOURCE_DISCOVERED_BUT_PDF_UNSUPPORTED', subject: d.startsWith('SOURCE') ? d.replace(/^.* for /, '') : null, url: d.startsWith('PRIMARY') ? d.split(' ')[1] : null, detail: d });
        for (const d of finalPack.v2?.diagnostics ?? [])
            if (['CORROBORATION_GAP', 'FACT_CONFLICT', 'EVIDENCE_EXTRACTION_GAP'].includes(d.code))
                gaps.push({ code: d.code as ResearchGap['code'], subject: d.subject, url: null, detail: d.detail });
        for (const r of finalPack.v3?.records.filter(r => r.semantics === 'ALTERNATIVE_SUBJECTS' || r.semantics === 'AMBIGUOUS_SUBJECT') ?? [])
            gaps.push({ code: 'ENTITY_RESOLUTION_GAP', subject: r.subjectCandidates.join(' | ').slice(0, 120), url: null, detail: 'MULTI_SUBJECT_RECORD ' + r.semantics + ' in ' + r.sourceId + ' (' + (r.heading ?? '') + '): no individual fact' });
        for (const c of finalPack.v3?.documentContexts.filter(c => c.ambiguity?.startsWith('DOCUMENT_SUBJECT_AMBIGUOUS')) ?? [])
            gaps.push({ code: 'ENTITY_RESOLUTION_GAP', subject: null, url: null, detail: c.sourceId + ' ' + c.ambiguity });
        for (const n of finalPack.v3?.entityGraph.nodes.filter(n => n.kind === 'STATION' && !finalPack.v3!.entityGraph.edges.some(e => e.from === n.id && (e.relation === 'OBSERVATION_SITE_FOR' || e.relation === 'SAME_ENTITY'))) ?? [])
            gaps.push({ code: 'ENTITY_RESOLUTION_GAP', subject: n.name, url: null, detail: 'Observation site without a source-backed relation to a place; its measurements cannot count for any place' });
        const accepted = finalPack.sources, facts = finalPack.groundedFacts, usable = facts.filter(f => f.usableForPrimaryClaim), st = finalPack.v2?.structures ?? [], evidence = finalPack.evidence, grades = finalPack.sourceAssessments.map(a => a.grade), count = (xs: string[]) => xs.reduce<Record<string, number>>((m, x) => (m[x] = (m[x] ?? 0) + 1, m), {});
        const effective = new Map((finalPack.v3?.authority ?? []).map(a => [a.sourceId, a.effectiveSourceType]));
        const metrics: ResearchSessionV2['metrics'] = { searchProvidersUsed: [...strategyLog.values()].filter(s => s.executed).map(s => s.kind), domainsDiscovered: [...new Set([...results.map(r => r.displayDomain), ...references.map(r => new URL(r.targetUrl).hostname)])].length, domainsFetched: [...new Set(attempts.map(a => new URL(a.url).hostname))].length, publishersAccepted: [...new Set(accepted.map(s => registrableDomain(new URL(archivedOriginal(s.canonicalLocator) ?? s.canonicalLocator).hostname)))].length, sourceTypesAccepted: Object.entries(count(accepted.map(s => effective.get(s.id) ?? s.sourceType))).map(([k, n]) => k + ':' + n), primarySources: accepted.filter(s => /^PRIMARY_/.test(effective.get(s.id) ?? s.sourceType)).length, institutionalSources: accepted.filter(s => ['INSTITUTIONAL', 'ACADEMIC'].includes(effective.get(s.id) ?? s.sourceType)).length, referenceSources: accepted.filter(s => s.sourceType === 'REFERENCE').length, independentOriginGroups: finalPack.v2?.originGroups.length ?? 0, supportedFacts: facts.filter(f => f.status === 'SUPPORTED').length, corroboratedFacts: facts.filter(f => f.status === 'CORROBORATED').length, conflictedFacts: facts.filter(f => f.status === 'CONFLICTED').length, insufficientFacts: facts.filter(f => f.status === 'INSUFFICIENT').length, averageOriginsPerFact: facts.length ? Number((facts.reduce((n, f) => n + f.independentOriginCount, 0) / facts.length).toFixed(3)) : 0, independentOriginsPerPrimaryFact: usable.length ? Number((usable.reduce((n, f) => n + f.independentOriginCount, 0) / usable.length).toFixed(3)) : 0, tablesDetected: st.filter(s => s.kind === 'HTML_TABLE' || s.kind === 'DATASET' || s.kind === 'KEY_VALUE').length, tablesParsed: st.filter(s => s.status === 'PARSED' && s.kind !== 'HTML_LIST' && s.kind !== 'DEFINITION_LIST').length, tablesRejected: st.filter(s => s.status === 'REJECTED').length, rowsParsed: st.filter(s => s.status === 'PARSED').reduce((n, s) => n + s.rows, 0), structuredEvidenceCount: evidence.filter(e => e.structured && ['HTML_TABLE', 'KEY_VALUE', 'DATASET', 'RECORD'].includes(e.structured.kind)).length, paragraphEvidenceCount: evidence.filter(e => !e.structured).length, listEvidenceCount: evidence.filter(e => e.structured && (e.structured.kind === 'HTML_LIST' || e.structured.kind === 'DEFINITION_LIST')).length, datasetEvidenceCount: evidence.filter(e => e.structured?.kind === 'DATASET').length, recordEvidenceCount: evidence.filter(e => e.structured?.kind === 'RECORD').length, contextSubjectEvidence: evidence.filter(e => e.structured?.subjectSource && !['CELL', 'ROW_HEADER', 'TABLE_CAPTION', 'RECORD_FIELD'].includes(e.structured.subjectSource)).length, structuredRecords: finalPack.v3?.records.length ?? 0, multiSubjectRecordsRefused: finalPack.v3?.records.filter(r => r.semantics === 'ALTERNATIVE_SUBJECTS' || r.semantics === 'AMBIGUOUS_SUBJECT').length ?? 0, publisherIdentities: finalPack.v3?.publishers.filter(p => p.name).length ?? 0, authorityHigh: finalPack.v3?.authority.filter(a => a.authority === 'INSTITUTIONAL_HIGH').length ?? 0, sourceQualityHIGH: grades.filter(g => g === 'HIGH').length, sourceQualityMEDIUM: grades.filter(g => g === 'MEDIUM').length, sourceQualityLOW: grades.filter(g => g === 'LOW').length, sourceQualityREJECT: grades.filter(g => g === 'REJECT').length + attempts.filter(a => /CONTENT_UNAVAILABLE quality/.test(a.reason)).length, referencesDiscovered: references.length, referencesFetched: references.filter(r => r.status === 'FETCHED').length, evidenceQualityGrades: Object.entries(count((finalPack.v2?.evidenceAssessments ?? []).map(a => a.grade))).map(([k, n]) => k + ':' + n) };
        return { version: WEB_RESEARCH_V3_VERSION, strategies: [...strategyLog.values()], references: references.sort((a, b) => b.priority - a.priority || a.targetUrl.localeCompare(b.targetUrl, 'en')), stageBudgets: budgets, entityPool: [], gaps: gaps.filter((g, i) => gaps.findIndex(x => x.code === g.code && x.subject === g.subject && x.url === g.url && x.detail === g.detail) === i).sort((a, b) => a.code.localeCompare(b.code, 'en') || (a.subject ?? '').localeCompare(b.subject ?? '', 'en') || (a.url ?? '').localeCompare(b.url ?? '', 'en')), metrics };
    };
    const v3 = (finalPack: EvidencePack, view: ResearchSessionV2): ResearchSessionV3 => sessionV3(finalPack, plan, results, queries, discovery, view);
    return finish({ request, config, plan, queries, results, trace, candidates, attempts, acquired: fetcher.receive(plan).sources, rejected, diagnostics, rounds, client, start, env, v2, v3 });
}
/** Pure v3 session view, recomputed by replay from the pack and recorded discovery data. */
export function sessionV3(pack: EvidencePack, plan: ResearchPlan, results: SearchResult[], queries: SearchQuery[], discoveryIn: ResearchSessionV3['discovery'], view: ResearchSessionV2): ResearchSessionV3 {
    const pool = candidateEntityPool(pack, plan, results, queries), tasks = corroborationTasks(pack, plan, pool, discoveryIn);
    // Discovery independence vs evidence independence: an independently discovered source whose evidence turned out derived/merged.
    const derivedSources = new Set(pack.groundedFacts.flatMap(f => (f.origins?.derivedEvidenceIds ?? []).map(id => pack.evidence.find(e => e.id === id)!.sourceId)));
    const merged = new Set(pack.groundedFacts.flatMap(f => (f.origins?.roots ?? []).filter(r => new Set(r.map(id => pack.evidence.find(e => e.id === id)!.sourceId)).size > 1).flat().map(id => pack.evidence.find(e => e.id === id)!.sourceId)));
    const locatorToSource = new Map(pack.sources.flatMap(s => [s.canonicalLocator, s.provenance.discovery?.requestedUrl ?? ''].filter(Boolean).map(l => [l, s.id] as const)));
    const discovery = discoveryIn.map(d => { const sid = locatorToSource.get(d.url); return { ...d, laterDerived: Boolean(sid && (derivedSources.has(sid) || merged.has(sid)) && (d.independence === 'QUERY_INDEPENDENT' || d.independence === 'CORPUS_INDEPENDENT')) }; });
    const usable = pack.groundedFacts.filter(f => f.usableForPrimaryClaim), places = pool.filter(p => p.kind !== 'STATION' && p.status !== 'SEARCH_ONLY'), eligible = (pack.v3?.eligibility ?? []).filter(e => e.eligible).length;
    const contextual = pack.evidence.filter(e => e.structured?.subjectSource && !['CELL', 'ROW_HEADER', 'TABLE_CAPTION', 'RECORD_FIELD'].includes(e.structured.subjectSource) && (pack.v3?.authority.find(a => a.sourceId === e.sourceId)?.authority ?? 'NONE') !== 'NONE');
    const realWorldGates = { R1_FIVE_CANDIDATE_ENTITIES: { passed: places.length >= 5, detail: places.length + ' place entities with source evidence' }, R2_OFFICIAL_CONTEXT_EVIDENCE: { passed: contextual.length > 0, detail: contextual.length + ' evidence items from official/institutional sources with a DocumentContext subject' }, R3_ADMITTED_FACT: { passed: usable.some(f => f.factType === 'MEASUREMENT' || f.factType === 'RESIDENCY' || f.factType === 'QUANTITY'), detail: usable.map(f => f.canonicalFact.subject + ' ' + f.factType + ' ' + f.status).slice(0, 8).join('; ') || 'none' }, R4_ONE_ELIGIBLE: { passed: eligible >= 1, detail: eligible + ' eligible' }, R5_THREE_ELIGIBLE: { passed: eligible >= 3, detail: eligible + ' eligible' }, R6_FIVE_ELIGIBLE: { passed: eligible >= 5, detail: eligible + ' eligible' } };
    return { version: WEB_RESEARCH_V3_VERSION, candidateEntityPool: pool, corroborationTasks: tasks, discovery, gaps: view.gaps, realWorldGates, fingerprints: { candidateEntityPool: jsonHash(pool), corroborationTasks: jsonHash(tasks) } };
}
