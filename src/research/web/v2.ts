import { jsonHash } from '../../editorial/fingerprint';
import { normalize } from '../../semantics/normalize';
import { planResearch } from '../planner';
import { buildEvidencePack } from '../pack';
import { residencyCurrent } from '../ranking';
import { archivedOriginal, registrableDomain } from '../origins';
import { cleanText } from '../structured';
import type { EvidencePack, GroundedFact, ResearchPlan, ResearchRequest, SourceInput } from '../contracts';
import type { CandidateSource, DiscoveryStrategy, FetchAttempt, ReferenceCandidate, ResearchGap, ResearchSession, ResearchSessionV2, ResearchStage, SearchProvider, SearchQuery, SearchResult, WebEnvironment, WebResearchConfig } from './contracts';
import { SecureHttpClient, nodeEnvironment } from './http';
import { MediaWikiSearchProvider, candidateSources } from './search';
import { WebSourceProvider } from './fetcher';
import { SnapshotCache } from './cache';
import { canonicalUrl } from './security';
import { queryPlan } from './queries';
export const WEB_RESEARCH_V2_VERSION = 'web-research/2.0.0';
// ---------- additional free discovery providers (no key, no paid fallback) ----------
async function getJson(client: SecureHttpClient, url: string, maxBytes: number) { const r = (await client.get(url, maxBytes, { allowedMimes: ['application/json'] })).response; if (r.status !== 200)
    throw Error('SEARCH_PROVIDER_UNAVAILABLE HTTP ' + r.status); if (!r.headers['content-type']?.includes('json'))
    throw Error('SEARCH_PROVIDER_UNAVAILABLE non-JSON'); return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(r.body)); }
const result = (q: SearchQuery, rank: number, title: string, url: string, provider: string, endpoint: string, now: number): SearchResult => { const raw = { queryId: q.id, rank, title: title.slice(0, 300), url, snippet: '', displayDomain: new URL(url).hostname, provider, retrievedMetadata: { retrievedAt: new Date(now).toISOString(), endpoint } }; return { ...raw, fingerprint: jsonHash(raw) }; };
/** Wikidata entity search → declared official website (P856). Labels/claims are discovery data only, never Evidence. */
export class WikidataEntityProvider implements SearchProvider {
    readonly kind = 'WIKIDATA_ENTITY_DISCOVERY';
    constructor(private client: SecureHttpClient, private endpoint: string) { }
    async search(q: SearchQuery, limit: number) { const start = this.client.env.now(); if (!q.entityName)
        return { results: [], diagnostic: 'WIKIDATA_ENTITY_REQUIRED', latencyMs: 0 }; try {
        const s = new URL(this.endpoint);
        s.search = new URLSearchParams({ action: 'wbsearchentities', search: q.entityName, language: 'en', format: 'json', type: 'item', limit: '1' }).toString();
        const id = String((await getJson(this.client, s.href, 262144)).search?.[0]?.id ?? '');
        if (!/^Q\d{1,12}$/.test(id))
            return { results: [], diagnostic: 'WIKIDATA_NO_ENTITY', latencyMs: this.client.env.now() - start };
        const g = new URL(this.endpoint);
        g.search = new URLSearchParams({ action: 'wbgetentities', ids: id, props: 'claims', format: 'json' }).toString();
        const claims = (await getJson(this.client, g.href, 2097152)).entities?.[id]?.claims?.P856 ?? [], urls: string[] = [];
        for (const c of Array.isArray(claims) ? claims : [])
            try {
                urls.push(canonicalUrl(String(c?.mainsnak?.datavalue?.value ?? '')));
            }
            catch { }
        return { results: [...new Set(urls)].slice(0, limit).map((u, i) => result(q, i + 1, 'Official website declared on Wikidata ' + id, u, this.kind, g.href, this.client.env.now())), diagnostic: urls.length ? null : 'WIKIDATA_NO_OFFICIAL_WEBSITE', latencyMs: this.client.env.now() - start };
    }
    catch (e) {
        return { results: [], diagnostic: 'SEARCH_PROVIDER_UNAVAILABLE ' + String(e), latencyMs: this.client.env.now() - start };
    } }
}
/** OpenAlex works search (academic discovery). Landing pages and DOIs are candidates; abstracts are never Evidence. */
export class OpenAlexWorksProvider implements SearchProvider {
    readonly kind = 'OPENALEX_ACADEMIC_SEARCH';
    constructor(private client: SecureHttpClient, private endpoint: string) { }
    async search(q: SearchQuery, limit: number) { const start = this.client.env.now(); try {
        const u = new URL(this.endpoint);
        u.search = new URLSearchParams({ search: q.text, per_page: String(Math.max(1, Math.min(limit, 10))), select: 'id,display_name,doi,primary_location,open_access' }).toString();
        const data = await getJson(this.client, u.href, 1048576), results: SearchResult[] = [];
        for (const w of Array.isArray(data.results) ? data.results : []) {
            const raw = w?.primary_location?.landing_page_url ?? (typeof w?.doi === 'string' ? w.doi : null) ?? w?.open_access?.oa_url;
            try {
                results.push(result(q, results.length + 1, String(w?.display_name ?? ''), canonicalUrl(String(raw)), this.kind, u.href, this.client.env.now()));
            }
            catch { }
        }
        return { results: results.slice(0, limit), diagnostic: null, latencyMs: this.client.env.now() - start };
    }
    catch (e) {
        return { results: [], diagnostic: 'SEARCH_PROVIDER_UNAVAILABLE ' + String(e), latencyMs: this.client.env.now() - start };
    } }
}
// ---------- entity pool and gaps ----------
type PoolEntry = ResearchSessionV2['entityPool'][number];
const factState = (fs: GroundedFact[]) => fs.some(f => f.usableForPrimaryClaim) ? (fs.some(f => f.status === 'CORROBORATED') ? 'CORROBORATED' : 'SUPPORTED') : fs.some(f => f.status === 'CONFLICTED') ? 'CONFLICTED' : fs.length ? 'INSUFFICIENT' : 'MISSING';
/** Per-entity coverage of the research questions. Search-only titles are listed but never treated as evidence. */
export function entityPool(pack: EvidencePack, plan: ResearchPlan, searchTitles: { title: string; queryId: string }[]): PoolEntry[] {
    const c = plan.request.constraints ?? {}, ranking = plan.request.researchGoal === 'RANKING', out = new Map<string, PoolEntry>();
    const eligible = new Set((pack.ranking?.reason.match(/Eligible \(unranked\): (.*)$/)?.[1] ?? '').split('; ').map(x => normalize(x.replace(/\s*\[.*$/, ''))).filter(Boolean)), ranked = new Set(pack.ranking?.items.map(i => normalize(i.subject)) ?? []);
    for (const f of pack.groundedFacts) {
        const subject = f.canonicalFact.subject, k = normalize(subject);
        if (out.has(k))
            continue;
        const all = pack.groundedFacts.filter(g => normalize(g.canonicalFact.subject) === k);
        const temps = all.filter(g => g.factType === 'MEASUREMENT' && g.canonicalFact.metric === (c.metric ?? 'TEMPERATURE') && (!c.qualifier || g.qualifiers.includes(c.qualifier))), counts = all.filter(g => g.factType === 'QUANTITY');
        const res = all.filter(g => g.factType === 'RESIDENCY' && g.canonicalFact.residency === c.residencyCriterion), current = res.filter(g => residencyCurrent(g, plan.policy).current);
        const temperature = ranking || c.metric !== 'POPULATION' ? factState(temps) : factState(counts), residency = !c.residencyCriterion ? 'NOT_REQUIRED' : current.length ? factState(current) : res.length ? 'NOT_CURRENT_OR_INSUFFICIENT' : all.some(g => g.factType === 'RESIDENCY') ? 'INCOMPATIBLE' : 'MISSING';
        const firstSource = pack.evidence.find(e => f.evidenceIds.includes(e.id))?.sourceId ?? null;
        out.set(k, { subject, provenance: 'DISCOVERED_FROM_SOURCE', firstSourceId: firstSource, temperature, residency, corroboration: [temperature, residency].every(s => s === 'CORROBORATED' || s === 'NOT_REQUIRED') ? 'READY' : 'NEEDS_INDEPENDENT_ORIGIN', eligible: ranked.has(k) || eligible.has(k) || !ranking && ['SUPPORTED', 'CORROBORATED'].includes(temperature) });
    }
    for (const t of searchTitles) {
        const k = normalize(t.title);
        if (!out.has(k))
            out.set(k, { subject: t.title, provenance: 'DISCOVERED_FROM_SEARCH', firstSourceId: null, temperature: 'MISSING', residency: c.residencyCriterion ? 'MISSING' : 'NOT_REQUIRED', corroboration: 'NEEDS_INDEPENDENT_ORIGIN', eligible: false });
    }
    return [...out.values()].sort((a, b) => normalize(a.subject).localeCompare(normalize(b.subject), 'en'));
}
/** Gap priority (Phase 21 §63): an entity closest to eligibility first; missing residency before missing measurement before corroboration. */
function priorityOf(e: PoolEntry) { const ok = (s: string) => ['SUPPORTED', 'CORROBORATED', 'NOT_REQUIRED'].includes(s); return (ok(e.temperature) ? 2 : e.temperature === 'INSUFFICIENT' ? 1 : 0) + (ok(e.residency) ? 2 : e.residency === 'INSUFFICIENT' || e.residency === 'NOT_CURRENT_OR_INSUFFICIENT' ? 1 : 0); }
// ---------- reference following ----------
const INSTITUTION = /(?:^|[.-])(?:gov|gouv|gob|govt|gc|edu|ac|univ|uni|meteo|met|weather|climate|climat|stat|stats|statistics|census|data|museum)(?:[.-]|$)/i;
function anchorText(raw: string, url: string) { for (const variant of [url, url.replace(/&/g, '&amp;'), url.replace(/\/$/, '')]) {
    const at = raw.indexOf('href="' + variant);
    if (at < 0)
        continue;
    const open = raw.indexOf('>', at), close = raw.indexOf('</a>', open);
    if (open > 0 && close > open && close - open < 2000)
        return cleanText(raw.slice(open + 1, close).replace(/<[^>]*>/g, ' ')).slice(0, 200);
} return ''; }
/** Footnote/inline references attached to evidence of facts that still need an origin; never a crawl of every link. */
export function referenceCandidates(pack: EvidencePack, plan: ResearchPlan, focus: Set<string>, attempted: Set<string>, maxPerSource: number): ReferenceCandidate[] {
    const c = plan.request.constraints ?? {}, map = new Map<string, ReferenceCandidate>(), perSource = new Map<string, ReferenceCandidate[]>();
    const relevant = (f: GroundedFact) => f.factType === 'RESIDENCY' ? f.canonicalFact.residency === c.residencyCriterion : f.factType === 'MEASUREMENT' ? !c.qualifier || f.qualifiers.includes(c.qualifier) : f.factType === 'QUANTITY';
    for (const f of pack.groundedFacts.filter(f => f.status !== 'CORROBORATED' && f.status !== 'CONFLICTED' && relevant(f) && focus.has(normalize(f.canonicalFact.subject))))
        for (const e of pack.evidence.filter(e => f.evidenceIds.includes(e.id))) {
            const source = pack.sources.find(s => s.id === e.sourceId)!, citations = e.citations ?? [], originals = new Map(citations.map(u => [u, archivedOriginal(u)]));
            for (const url of citations) {
                if (originals.get(url) && citations.includes(originals.get(url)!))
                    continue;
                const archive = citations.find(u => originals.get(u) === url) ?? null, host = new URL(url).hostname, pdf = /\.pdf(?:$|[?#])/i.test(url), dataset = /\.(?:csv|tsv|txt)(?:$|[?#])/i.test(url), text = anchorText(source.content, url);
                const type: ReferenceCandidate['referenceType'] = pdf ? 'PDF_DOCUMENT' : dataset ? 'DATASET_LINK' : originals.get(url) ? 'ARCHIVED_COPY' : INSTITUTION.test(host) ? 'INSTITUTION_LINK' : 'FOOTNOTE_CITATION';
                const gap = f.factType === 'RESIDENCY' ? 'RESIDENCY_' + f.status : f.factType + '_' + f.status, old = map.get(url);
                if (old) {
                    old.evidenceIds = [...new Set([...old.evidenceIds, e.id])].sort();
                    old.priority += 5;
                    continue;
                }
                const raw = { sourceId: source.id, targetUrl: url, anchorText: text, contextSpan: { start: e.sourceSpan.start, end: Math.min(e.sourceSpan.end, e.sourceSpan.start + 600), text: e.sourceSpan.text.slice(0, 600) }, referenceType: type, researchQuestionIds: (f.factType === 'RESIDENCY' ? ['RQ1'] : ['RQ2', 'RQ4']).filter(id => plan.questions.some(q => q.id === id)), confidence: e.structured ? 'MEDIUM' as const : 'HIGH' as const, reason: 'Reference attached to evidence ' + e.id + ' of ' + f.id + ' (' + f.status + '); followed to find an origin/independent support', evidenceIds: [e.id], subject: f.canonicalFact.subject, gap, archiveUrl: archive };
                const ref: ReferenceCandidate = { id: 'R_' + jsonHash({ source: source.id, url }).slice(0, 16), ...raw, priority: (e.structured ? 20 : 40) + (INSTITUTION.test(host) ? 30 : 0) + (dataset ? 10 : 0) + (pdf ? -100 : 0) + (archive ? 5 : 0), status: attempted.has(url) ? 'SKIPPED_DUPLICATE' : pdf ? 'SKIPPED_FORMAT' : 'PENDING', fetchAttemptIds: [] };
                map.set(url, ref);
                perSource.set(source.id, [...(perSource.get(source.id) ?? []), ref]);
            }
        }
    for (const refs of perSource.values())
        for (const r of refs.sort((a, b) => b.priority - a.priority || a.targetUrl.localeCompare(b.targetUrl, 'en')).slice(maxPerSource))
            if (r.status === 'PENDING')
                r.status = 'SKIPPED_SOURCE_CAP';
    return [...map.values()].sort((a, b) => b.priority - a.priority || a.targetUrl.localeCompare(b.targetUrl, 'en'));
}
// ---------- queries ----------
const POPULATION_TERMS: [RegExp, string][] = [[/municipi/, 'municipalities'], [/cidade/, 'cities'], [/vila|povoad/, 'villages'], [/assentament/, 'settlements'], [/comunidade/, 'communities'], [/lista|listad/, 'list of']];
/** Discovery text from the plan and a generic vocabulary only; never entity, URL or value seeds. */
export function broadQueriesV2(plan: ResearchPlan, config: WebResearchConfig): SearchQuery[] {
    if (plan.request.constraints?.metric !== 'POPULATION')
        return queryPlan(plan, config, 0);
    const n = normalize(plan.request.topic), nouns = POPULATION_TERMS.filter(([re]) => re.test(n)).map(([, w]) => w), list = nouns.includes('list of'), noun = nouns.filter(w => w !== 'list of')[0] ?? 'places';
    const rows: Omit<SearchQuery, 'id'>[] = [{ round: 0, stage: 'BROAD_DISCOVERY', researchQuestionIds: plan.essentialResearchQuestionIds, text: (list ? 'list of ' : '') + noun + ' by population census', entityName: null, entitySourceIds: [], followupReason: 'Discover population tables from topic vocabulary; no entity seeds' }, { round: 0, stage: 'ENTITY_DISCOVERY', researchQuestionIds: plan.essentialResearchQuestionIds, text: noun + ' population census', entityName: null, entitySourceIds: [], followupReason: 'Seek census-attributed population sources' }];
    return rows.map(q => ({ ...q, id: 'Q_' + jsonHash(q).slice(0, 16) }));
}
function entityQuery(plan: ResearchPlan, e: PoolEntry, round: number, stage: SearchQuery['stage']): SearchQuery { const c = plan.request.constraints ?? {}, population = c.metric === 'POPULATION', residencyGap = c.residencyCriterion && !['SUPPORTED', 'CORROBORATED'].includes(e.residency) && ['SUPPORTED', 'CORROBORATED', 'INSUFFICIENT'].includes(e.temperature); const text = e.subject + ' ' + (population ? 'population census' : residencyGap ? 'permanent population residents' : stage === 'CORROBORATION' ? 'lowest recorded temperature' : c.qualifier === 'AVERAGE' ? 'average temperature' : 'minimum recorded temperature'); const raw = { round, stage, researchQuestionIds: (residencyGap ? ['RQ1'] : ['RQ2', 'RQ4']).filter(id => plan.questions.some(q => q.id === id)), text, entityName: e.subject, entitySourceIds: e.firstSourceId ? [e.firstSourceId] : [], followupReason: stage + ': temperature ' + e.temperature + ', residency ' + e.residency + ', corroboration ' + e.corroboration }; return { ...raw, id: 'Q_' + jsonHash(raw).slice(0, 16) }; }
// ---------- loop ----------
const FORMAT = /MIME_BLOCKED|PARSE_FAILED|CONTENT_UNAVAILABLE (?:empty|client|quality)/;
export async function runWebResearchV2(request: ResearchRequest, config: WebResearchConfig, options: { env?: WebEnvironment; searchProvider?: SearchProvider; extraProviders?: Partial<Record<DiscoveryStrategy, SearchProvider>>; cache?: SnapshotCache } = {}, finish: (args: { request: ResearchRequest; config: WebResearchConfig; plan: ResearchPlan; queries: SearchQuery[]; results: SearchResult[]; trace: ResearchSession['searchTrace']; candidates: CandidateSource[]; attempts: FetchAttempt[]; acquired: SourceInput[]; rejected: ResearchSession['rejectedSources']; diagnostics: string[]; rounds: number; client: SecureHttpClient; start: number; env: WebEnvironment; v2: (pack: EvidencePack, writerGaps: ResearchGap[]) => ResearchSessionV2 }) => ResearchSession): Promise<ResearchSession> {
    const v = config.v2!, plan = planResearch(request), env = options.env ?? nodeEnvironment, start = env.now(), client = new SecureHttpClient(config, env);
    client.deadline = start + config.maxDurationMs;
    const mediawiki = options.searchProvider ?? new MediaWikiSearchProvider(client), providers: Partial<Record<DiscoveryStrategy, SearchProvider>> = { MEDIAWIKI_REFERENCE_SEARCH: mediawiki, WIKIDATA_ENTITY_DISCOVERY: new WikidataEntityProvider(client, v.wikidataEndpoint), OPENALEX_ACADEMIC_SEARCH: new OpenAlexWorksProvider(client, v.openAlexEndpoint), ...options.extraProviders };
    const fetcher = new WebSourceProvider(client, options.cache), queries: SearchQuery[] = [], results: SearchResult[] = [], trace: ResearchSession['searchTrace'] = [], attempts: FetchAttempt[] = [], rejected: ResearchSession['rejectedSources'] = [], diagnostics: string[] = [], candidates: CandidateSource[] = [], references: ReferenceCandidate[] = [];
    const strategyLog = new Map<DiscoveryStrategy, ResearchSessionV2['strategies'][number]>(v.strategies.map(s => [s, { kind: s, executed: false, queries: 0, results: 0, candidates: 0, diagnostics: [] }]));
    const budgets: ResearchSessionV2['stageBudgets'] = [['BROAD_DISCOVERY', v.budgets.broadDiscovery], ['VERIFICATION', v.budgets.verification], ['ORIGIN_DISCOVERY', v.budgets.originDiscovery], ['CORROBORATION', v.budgets.corroboration]].map(([stage, budget]) => ({ stage: stage as ResearchStage, budget: budget as number, used: 0, reallocatedIn: 0 }));
    const stageOf = (s: ResearchStage) => budgets.find(b => b.stage === s)!, attempted = new Set<string>(), domainCounts = new Map<string, number>(), fetchMeta = new Map<string, { stage: ResearchStage; subject: string | null; referenceId: string | null; via: string }>();
    const global = () => env.now() - start >= config.maxDurationMs || client.bytes >= config.maxTotalBytes || attempts.length >= config.maxFetchedSources;
    let pack = buildEvidencePack(request, fetcher), rounds = 0;
    const asked = new Map<string, SearchResult[]>();
    const search = async (strategy: DiscoveryStrategy, q: SearchQuery, limit: number) => { const provider = providers[strategy], log = strategyLog.get(strategy), seen = asked.get(strategy + '\n' + q.text); if (seen)
        return seen; if (!provider || !log || queries.length >= config.maxQueries || results.length >= config.maxSearchResults || global())
        return []; queries.push(q); log.executed = true; log.queries++; const found = await provider.search(q, Math.min(limit, config.maxResultsPerQuery, config.maxSearchResults - results.length)); trace.push({ query: q, resultCount: found.results.length, diagnostic: found.diagnostic, latencyMs: found.latencyMs }); if (found.diagnostic) {
        diagnostics.push(strategy + ' ' + found.diagnostic);
        log.diagnostics.push(found.diagnostic);
    } results.push(...found.results); log.results += found.results.length; asked.set(strategy + '\n' + q.text, found.results); return found.results; };
    const fetchOne = async (c: CandidateSource, stage: ResearchStage, via: string, subject: string | null, referenceId: string | null, strategy: string) => { const b = stageOf(stage); if (global() || b.used >= b.budget || attempted.has(c.canonicalUrl))
        return null; if ((domainCounts.get(c.domain) ?? 0) >= config.maxSourcesPerDomain) {
        c.fetchStatus = 'DOMAIN_QUOTA';
        return null;
    } attempted.add(c.canonicalUrl); domainCounts.set(c.domain, (domainCounts.get(c.domain) ?? 0) + 1); b.used++; const fetched = await fetcher.fetch(c, plan, { via: via as 'SEARCH_RESULT', referenceIds: referenceId ? [referenceId] : [], strategy }); attempts.push(fetched.attempt); fetchMeta.set(fetched.attempt.id, { stage, subject, referenceId, via }); c.fetchStatus = fetched.attempt.status; if (!candidates.includes(c))
        candidates.push(c); if (!fetched.source)
        rejected.push({ url: c.canonicalUrl, reason: fetched.attempt.reason }); return fetched; };
    const reallocate = (from: ResearchStage) => { const i = budgets.findIndex(b => b.stage === from), b = budgets[i], next = budgets[i + 1]; if (!next || b.used >= b.budget)
        return; const left = b.budget - b.used; b.budget = b.used; next.budget += left; next.reallocatedIn += left; diagnostics.push('BUDGET_REALLOCATED ' + left + ' ' + from + '→' + next.stage); };
    // Round 0: broad discovery through the reference corpus.
    for (const q of broadQueriesV2(plan, config).slice(0, 3))
        await search('MEDIAWIKI_REFERENCE_SEARCH', q, config.maxResultsPerQuery);
    for (const c of candidateSources(results, queries, config))
        await fetchOne(c, 'BROAD_DISCOVERY', 'SEARCH_RESULT', null, null, 'MEDIAWIKI_REFERENCE_SEARCH');
    strategyLog.get('MEDIAWIKI_REFERENCE_SEARCH')!.candidates = candidates.length;
    reallocate('BROAD_DISCOVERY');
    pack = buildEvidencePack(request, fetcher);
    rounds = 1;
    const titles = () => results.filter(r => r.provider === 'MEDIAWIKI_REST_SEARCH' || r.provider === mediawiki.kind).map(r => ({ title: r.title, queryId: r.queryId }));
    for (let round = 1; round < config.maxResearchRounds && !global(); round++) {
        rounds = round + 1;
        if (pack.ranking?.status === 'VALID') {
            diagnostics.push('EARLY_STOP_RANKING_VALID');
            break;
        }
        const before = attempts.length, pool = entityPool(pack, plan, titles()).filter(e => e.provenance === 'DISCOVERED_FROM_SOURCE' && !e.eligible).sort((a, b) => priorityOf(b) - priorityOf(a) || normalize(a.subject).localeCompare(normalize(b.subject), 'en')).slice(0, v.candidatePoolTarget);
        // VERIFICATION: the entity's own reference-corpus page for whichever fact family is missing.
        let actionable = 0;
        for (const e of pool.filter(e => e.temperature === 'MISSING' || e.residency === 'MISSING' || e.residency === 'INCOMPATIBLE')) {
            if (stageOf('VERIFICATION').used >= stageOf('VERIFICATION').budget)
                break;
            const found = await search('MEDIAWIKI_REFERENCE_SEARCH', entityQuery(plan, e, round, 'FACT_VERIFICATION'), 3), own = found.find(r => normalize(r.title) === normalize(e.subject)) ?? null;
            if (!own) {
                diagnostics.push('SOURCE_DISCOVERY_GAP entity page not found for ' + e.subject);
                continue;
            }
            const c = candidateSources([own], queries, config)[0];
            if (c && !attempted.has(c.canonicalUrl)) {
                actionable++;
                await fetchOne(c, 'VERIFICATION', 'FOLLOW_UP', e.subject, null, 'MEDIAWIKI_REFERENCE_SEARCH');
            }
        }
        if (!actionable)
            reallocate('VERIFICATION');
        pack = buildEvidencePack(request, fetcher);
        // ORIGIN_DISCOVERY: follow references attached to evidence of entities that still need an origin.
        const focus = new Set(entityPool(pack, plan, []).filter(e => !e.eligible && e.corroboration !== 'READY').map(e => normalize(e.subject))), refs = v.strategies.includes('REFERENCE_FOLLOWING') ? referenceCandidates(pack, plan, focus, attempted, v.maxReferencesPerSource) : [];
        for (const r of refs)
            if (!references.some(x => x.targetUrl === r.targetUrl))
                references.push(r);
        // Stage-budget skips are re-queued every round; per-source caps are final.
        const pending = references.filter(r => r.status === 'PENDING' || r.status === 'SKIPPED_BUDGET').sort((a, b) => b.priority - a.priority || a.targetUrl.localeCompare(b.targetUrl, 'en'));
        if (pending.length)
            strategyLog.get('REFERENCE_FOLLOWING')!.executed = true;
        for (const r of pending) {
            if (stageOf('ORIGIN_DISCOVERY').used >= stageOf('ORIGIN_DISCOVERY').budget || global()) {
                r.status = 'SKIPPED_BUDGET';
                continue;
            }
            const c: CandidateSource = { id: 'C_' + jsonHash(r.targetUrl).slice(0, 16), canonicalUrl: r.targetUrl, domain: new URL(r.targetUrl).hostname, queryIds: [], researchQuestionIds: r.researchQuestionIds, discoveryRanks: [], title: r.anchorText, expectedSourceType: 'OTHER', fetchStatus: 'PENDING', selectionScore: r.priority, reasons: [r.reason, 'Reference link; source class decided after fetch'] };
            let fetched = await fetchOne(c, 'ORIGIN_DISCOVERY', 'REFERENCE_LINK', r.subject, r.id, 'REFERENCE_FOLLOWING');
            if (fetched)
                r.fetchAttemptIds.push(fetched.attempt.id);
            // Dead, blocked or since-changed original (no evidence about the cited subject any more): the archived copy the
            // reference itself lists is the same origin (MIRRORS), never an additional one.
            const stale = fetched?.source && r.subject && !buildEvidencePack(request, { version: 1, id: 'reference-subject-check', fixture: false, labels: ['REAL_WEB_SNAPSHOTS'], sources: [fetched.source] }).evidence.some(e => normalize(e.supports.subject) === normalize(r.subject!));
            if (fetched && r.archiveUrl && v.followArchivedCopies && (stale || !fetched.source && /HTTP_ERROR|TIMEOUT|CONTENT_UNAVAILABLE|PARSE_FAILED/.test(fetched.attempt.status))) {
                const a: CandidateSource = { ...c, id: 'C_' + jsonHash(r.archiveUrl).slice(0, 16), canonicalUrl: r.archiveUrl, domain: new URL(r.archiveUrl).hostname, reasons: [...c.reasons, stale ? 'Archived copy listed by the reference; the live original no longer contains the cited subject' : 'Archived copy of the failed original'] };
                const archived = await fetchOne(a, 'ORIGIN_DISCOVERY', 'ARCHIVED_COPY', r.subject, r.id, 'REFERENCE_FOLLOWING');
                if (archived)
                    r.fetchAttemptIds.push(archived.attempt.id);
                fetched = archived?.source ? archived : fetched;
            }
            r.status = !fetched ? 'SKIPPED_BUDGET' : fetched.source ? 'FETCHED' : 'FAILED';
        }
        strategyLog.get('REFERENCE_FOLLOWING') && (strategyLog.get('REFERENCE_FOLLOWING')!.candidates = references.length);
        if (!pending.length)
            reallocate('ORIGIN_DISCOVERY');
        pack = buildEvidencePack(request, fetcher);
        // CORROBORATION: independent discovery providers for entities whose facts still have one origin.
        const needs = entityPool(pack, plan, []).filter(e => !e.eligible && e.corroboration !== 'READY' && e.temperature !== 'MISSING').sort((a, b) => priorityOf(b) - priorityOf(a) || normalize(a.subject).localeCompare(normalize(b.subject), 'en')).slice(0, 3);
        for (const e of needs)
            for (const strategy of ['WIKIDATA_ENTITY_DISCOVERY', 'OPENALEX_ACADEMIC_SEARCH'] as const) {
                if (!v.strategies.includes(strategy) || stageOf('CORROBORATION').used >= stageOf('CORROBORATION').budget)
                    continue;
                const found = await search(strategy, entityQuery(plan, e, round, 'CORROBORATION'), 2), cs = candidateSources(found, queries, config);
                strategyLog.get(strategy)!.candidates += cs.length;
                for (const c of cs) {
                    if (/\.pdf(?:$|[?#])/i.test(c.canonicalUrl)) {
                        diagnostics.push('PRIMARY_SOURCE_DISCOVERED_BUT_PDF_UNSUPPORTED ' + c.canonicalUrl);
                        continue;
                    }
                    await fetchOne(c, 'CORROBORATION', strategy === 'WIKIDATA_ENTITY_DISCOVERY' ? 'INSTITUTION_LINK' : 'SEARCH_RESULT', e.subject, null, strategy);
                }
            }
        // Unused corroboration budget returns to origin discovery when queued references remain (deterministic, recorded).
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
    const v2 = (finalPack: EvidencePack, writerGaps: ResearchGap[]): ResearchSessionV2 => {
        const gaps: ResearchGap[] = [...writerGaps], ofAttempt = (a: FetchAttempt) => references.find(r => r.fetchAttemptIds.includes(a.id));
        for (const a of attempts.filter(a => a.status !== 'SUCCESS')) {
            const ref = ofAttempt(a), pdf = /pdf/i.test(a.reason) || /\.pdf(?:$|[?#])/i.test(a.url);
            gaps.push({ code: pdf && ref && INSTITUTION.test(new URL(a.url).hostname) ? 'PRIMARY_SOURCE_DISCOVERED_BUT_PDF_UNSUPPORTED' : FORMAT.test(a.status + ' ' + a.reason) || pdf ? 'SOURCE_FORMAT_GAP' : 'SOURCE_FETCH_GAP', subject: ref?.subject ?? null, url: a.url, detail: a.status + ': ' + a.reason.slice(0, 200) });
        }
        for (const r of references.filter(r => r.status === 'SKIPPED_FORMAT'))
            gaps.push({ code: INSTITUTION.test(new URL(r.targetUrl).hostname) ? 'PRIMARY_SOURCE_DISCOVERED_BUT_PDF_UNSUPPORTED' : 'SOURCE_FORMAT_GAP', subject: r.subject, url: r.targetUrl, detail: 'PDF reference not fetched: PDF_SOURCE_UNSUPPORTED' });
        for (const d of diagnostics.filter(d => d.startsWith('SOURCE_DISCOVERY_GAP') || d.startsWith('PRIMARY_SOURCE_DISCOVERED_BUT_PDF_UNSUPPORTED')))
            gaps.push({ code: d.startsWith('SOURCE') ? 'SOURCE_DISCOVERY_GAP' : 'PRIMARY_SOURCE_DISCOVERED_BUT_PDF_UNSUPPORTED', subject: d.startsWith('SOURCE') ? d.replace(/^.* for /, '') : null, url: d.startsWith('PRIMARY') ? d.split(' ')[1] : null, detail: d });
        const pool = entityPool(finalPack, plan, titles());
        for (const e of pool.filter(e => e.provenance === 'DISCOVERED_FROM_SOURCE' && !e.eligible))
            if (!references.some(r => normalize(r.subject ?? '') === normalize(e.subject)) && e.corroboration !== 'READY')
                gaps.push({ code: 'SOURCE_DISCOVERY_GAP', subject: e.subject, url: null, detail: 'No reference/origin candidate was discovered for remaining gaps (temperature ' + e.temperature + ', residency ' + e.residency + ')' });
        for (const [k, meta] of fetchMeta) {
            const a = attempts.find(x => x.id === k);
            if (a?.status === 'SUCCESS' && meta.subject && !finalPack.evidence.some(e => finalPack.sources.find(s => s.id === e.sourceId)?.canonicalLocator === a.finalUrl && normalize(e.supports.subject) === normalize(meta.subject!)))
                gaps.push({ code: 'EVIDENCE_EXTRACTION_GAP', subject: meta.subject, url: a.finalUrl, detail: 'Fetched for ' + meta.stage + ' but no supported evidence about the entity was extracted' });
        }
        for (const d of finalPack.v2?.diagnostics ?? [])
            if (['CORROBORATION_GAP', 'FACT_CONFLICT', 'EVIDENCE_EXTRACTION_GAP'].includes(d.code))
                gaps.push({ code: d.code as ResearchGap['code'], subject: d.subject, url: null, detail: d.detail });
        const accepted = finalPack.sources, facts = finalPack.groundedFacts, usable = facts.filter(f => f.usableForPrimaryClaim), st = finalPack.v2?.structures ?? [], evidence = finalPack.evidence, grades = finalPack.sourceAssessments.map(a => a.grade);
        const count = (xs: string[]) => xs.reduce<Record<string, number>>((m, x) => (m[x] = (m[x] ?? 0) + 1, m), {});
        const metrics: ResearchSessionV2['metrics'] = { searchProvidersUsed: [...strategyLog.values()].filter(s => s.executed).map(s => s.kind), domainsDiscovered: [...new Set([...results.map(r => r.displayDomain), ...references.map(r => new URL(r.targetUrl).hostname)])].length, domainsFetched: [...new Set(attempts.map(a => new URL(a.url).hostname))].length, publishersAccepted: [...new Set(accepted.map(s => registrableDomain(new URL(archivedOriginal(s.canonicalLocator) ?? s.canonicalLocator).hostname)))].length, sourceTypesAccepted: Object.entries(count(accepted.map(s => s.sourceType))).map(([k, n]) => k + ':' + n), primarySources: accepted.filter(s => s.sourceType === 'PRIMARY_OFFICIAL' || s.sourceType === 'PRIMARY_DATASET').length, institutionalSources: accepted.filter(s => s.sourceType === 'INSTITUTIONAL' || s.sourceType === 'ACADEMIC').length, referenceSources: accepted.filter(s => s.sourceType === 'REFERENCE').length, independentOriginGroups: finalPack.v2?.originGroups.length ?? 0, supportedFacts: facts.filter(f => f.status === 'SUPPORTED').length, corroboratedFacts: facts.filter(f => f.status === 'CORROBORATED').length, conflictedFacts: facts.filter(f => f.status === 'CONFLICTED').length, insufficientFacts: facts.filter(f => f.status === 'INSUFFICIENT').length, averageOriginsPerFact: facts.length ? Number((facts.reduce((n, f) => n + f.independentOriginCount, 0) / facts.length).toFixed(3)) : 0, independentOriginsPerPrimaryFact: usable.length ? Number((usable.reduce((n, f) => n + f.independentOriginCount, 0) / usable.length).toFixed(3)) : 0, tablesDetected: st.filter(s => s.kind === 'HTML_TABLE' || s.kind === 'DATASET' || s.kind === 'KEY_VALUE').length, tablesParsed: st.filter(s => s.status === 'PARSED' && s.kind !== 'HTML_LIST' && s.kind !== 'DEFINITION_LIST').length, tablesRejected: st.filter(s => s.status === 'REJECTED').length, rowsParsed: st.filter(s => s.status === 'PARSED').reduce((n, s) => n + s.rows, 0), structuredEvidenceCount: evidence.filter(e => e.structured && ['HTML_TABLE', 'KEY_VALUE', 'DATASET'].includes(e.structured.kind)).length, paragraphEvidenceCount: evidence.filter(e => !e.structured).length, listEvidenceCount: evidence.filter(e => e.structured && (e.structured.kind === 'HTML_LIST' || e.structured.kind === 'DEFINITION_LIST')).length, datasetEvidenceCount: evidence.filter(e => e.structured?.kind === 'DATASET').length, sourceQualityHIGH: grades.filter(g => g === 'HIGH').length, sourceQualityMEDIUM: grades.filter(g => g === 'MEDIUM').length, sourceQualityLOW: grades.filter(g => g === 'LOW').length, sourceQualityREJECT: grades.filter(g => g === 'REJECT').length + attempts.filter(a => /CONTENT_UNAVAILABLE quality/.test(a.reason)).length, referencesDiscovered: references.length, referencesFetched: references.filter(r => r.status === 'FETCHED').length, evidenceQualityGrades: Object.entries(count((finalPack.v2?.evidenceAssessments ?? []).map(a => a.grade))).map(([k, n]) => k + ':' + n) };
        return { version: WEB_RESEARCH_V2_VERSION, strategies: [...strategyLog.values()], references: references.sort((a, b) => b.priority - a.priority || a.targetUrl.localeCompare(b.targetUrl, 'en')), stageBudgets: budgets, entityPool: pool, gaps: gaps.filter((g, i) => gaps.findIndex(x => x.code === g.code && x.subject === g.subject && x.url === g.url && x.detail === g.detail) === i).sort((a, b) => a.code.localeCompare(b.code, 'en') || (a.subject ?? '').localeCompare(b.subject ?? '', 'en') || (a.url ?? '').localeCompare(b.url ?? '', 'en')), metrics };
    };
    return finish({ request, config, plan, queries, results, trace, candidates, attempts, acquired: fetcher.receive(plan).sources, rejected, diagnostics, rounds, client, start, env, v2 });
}
