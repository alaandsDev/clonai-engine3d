import { jsonHash } from '../../editorial/fingerprint';
import { planResearch } from '../planner';
import { buildEvidencePack } from '../pack';
import { validateEvidencePack } from '../qa';
import { normalizedSource } from '../source';
import { normalize } from '../../semantics/normalize';
import { writeGroundedTopic } from '../../writer/grounded';
import type { ResearchRequest, EvidencePack } from '../contracts';
import type { DiscoveryStrategy, ResearchGap, ResearchSession, SearchProvider, WebEnvironment, WebResearchConfig } from './contracts';
import { runWebResearchV2, WEB_RESEARCH_V2_VERSION } from './v2';
import { runWebResearchV3, sessionV3, WEB_RESEARCH_V3_VERSION } from './v3';
import {runWebResearchV4,WEB_RESEARCH_V4_VERSION} from './v4';
import {buildSessionV4} from '../v4/session';
import { webConfig } from './config';
import { SecureHttpClient, nodeEnvironment } from './http';
import { MediaWikiSearchProvider, candidateSources } from './search';
import { WebSourceProvider } from './fetcher';
import { SnapshotCache, validateSnapshot } from './cache';
import { queryPlan } from './queries';
import { discoverEntities } from './entities';
function scopeFor(request: ResearchRequest, config: WebResearchConfig) { const ranking = request.researchGoal === 'RANKING', superlative = /mais frio|coldest|mundo|global|world/.test(normalize(request.topic)); return { title: ranking ? 'Comparação entre candidatos encontrados nesta sessão' : request.topic, scope: 'SESSION_CANDIDATES' as const, adjustment: ranking && superlative ? 'SUPERLATIVE_SCOPE_ADJUSTMENT: GLOBAL_SUPERLATIVE_NOT_ESTABLISHED; finite session candidates only; no exhaustive world ranking' : null, humanReviewRequired: ranking && superlative && !config.allowSessionScopeAdjustment }; }
function write(pack: EvidencePack, scope: ResearchSession['scope']) { return scope.humanReviewRequired ? null : writeGroundedTopic({ version: 1, id: 'web-grounded-' + pack.fingerprint.slice(0, 16), topic: pack.topic, language: 'pt-BR', factPolicy: 'GROUNDED_ONLY', targetWords: { min: 110, max: 160 } }, pack); }
export function processingFingerprint(pack: EvidencePack, writer: ResearchSession['writer'], scope: ResearchSession['scope']) { return jsonHash({ pack: pack.fingerprint, ranking: pack.ranking?.fingerprint ?? null, script: writer?.finalCandidate?.fingerprint ?? null, plan: writer?.finalPreflight?.plan.fingerprint ?? null, writer: writer?.fingerprint ?? null, scope }); }
/** Phase 21 session assembly: same final pack/writer/scope contract as v1, plus discovery, references, gaps and metrics. */
function finishV2(a: Parameters<Parameters<typeof runWebResearchV3>[3]>[0]): ResearchSession {
    const pack = buildEvidencePack(a.request, { version: 1, id: 'web-session-final', fixture: false, labels: ['REAL_WEB_SNAPSHOTS', 'SESSION_CANDIDATES_ONLY'], sources: a.acquired });
    validateEvidencePack(pack);
    const scope = scopeFor(a.request, a.config), writer = write(pack, scope), entities = discoverEntities(pack, a.candidates, a.results), diagnostics = [...a.diagnostics], writerGaps: ResearchGap[] = [];
    if (pack.quality.productionEligibility === 'RESEARCH_READY' && writer && !writer.finalCandidate)
        writerGaps.push({ code: 'WRITER_REALIZATION_GAP', subject: null, url: null, detail: 'Research-ready facts have no licensed realization in the existing GROUNDED_ONLY writer (no Writer v2 in this phase)' });
    for (const m of writer?.finalPreflight?.matrix ?? [])
        if (m.visualProof !== 'DIRECT' || m.gap)
            writerGaps.push({ code: 'VISUAL_GAP', subject: null, url: null, detail: m.claimId + ' ' + (m.gap ?? m.visualProof) });
    const exhausted = a.env.now() - a.start >= a.config.maxDurationMs || a.client.bytes >= a.config.maxTotalBytes || a.attempts.length >= a.config.maxFetchedSources || a.rounds === a.config.maxResearchRounds && pack.ranking?.status !== 'VALID' && pack.quality.productionEligibility !== 'RESEARCH_READY';
    if (exhausted)
        diagnostics.push('RESEARCH_BUDGET_EXHAUSTED');
    if (scope.humanReviewRequired)
        diagnostics.push('HUMAN_REVIEW_REQUIRED_SCOPE_ADJUSTMENT');
    const quality: ResearchSession['quality'] = { queries: a.queries.length, results: a.results.length, uniqueDomains: new Set(a.results.map(r => r.displayDomain)).size, candidateSources: a.candidates.length, fetchAttempts: a.attempts.length, successfulFetches: a.attempts.filter(x => x.httpStatus === 200 && x.snapshot).length, acceptedSources: a.acquired.length, rejectedSources: a.rejected.length, discoveredEntities: entities.filter(e => e.provenance === 'DISCOVERED_FROM_SOURCE').length, groundedFacts: pack.quality.groundedFactCount, corroboratedFacts: pack.quality.corroboratedFactCount, conflicts: pack.conflicts.length, researchCoverage: pack.quality.criticalCoverage, budgetUsage: { bytes: a.client.bytes, elapsedMs: a.env.now() - a.start, rounds: a.rounds }, liveOrReplay: 'LIVE_DISCOVERY', resultState: pack.quality.productionEligibility === 'RESEARCH_READY' && !scope.humanReviewRequired ? 'REAL_RESEARCH_READY' : pack.quality.groundedFactCount ? 'REAL_RESEARCH_PARTIAL' : 'REAL_RESEARCH_BLOCKED', budgetStatus: exhausted ? 'RESEARCH_BUDGET_EXHAUSTED' : 'COVERAGE_STOP' };
    const view = a.v2(pack, writerGaps);
    const raw = { version: a.v4 ? WEB_RESEARCH_V4_VERSION : a.v3 ? WEB_RESEARCH_V3_VERSION : WEB_RESEARCH_V2_VERSION, mode: 'LIVE_DISCOVERY' as const, request: structuredClone(a.request), config: a.config, plan: a.plan, queryPlan: a.queries, searchResults: a.results, searchTrace: a.trace, candidateSources: a.candidates, fetchAttempts: a.attempts, acceptedSources: a.acquired, rejectedSources: a.rejected, entities, EvidencePack: pack, writer, diagnostics: [...new Set(diagnostics)], scope, quality, v2: view, ...(a.v3 ? { v3: a.v3(pack, view) } : {}), ...(a.v4 ? {v4:a.v4(pack)} : {}), processingFingerprint: processingFingerprint(pack, writer, scope) };
    return { ...raw, fingerprint: jsonHash(raw) };
}
export async function runWebResearch(request: ResearchRequest, input: Partial<WebResearchConfig>, options: {
    env?: WebEnvironment;
    searchProvider?: SearchProvider;
    cache?: SnapshotCache;
    extraProviders?: Partial<Record<DiscoveryStrategy, SearchProvider>>;
} = {}): Promise<ResearchSession> {
    const config = webConfig(input);
    if (!config.enabled || config.cachePolicy === 'CACHED_REPLAY')
        throw Error('WEB_DISABLED_OR_REPLAY_REQUIRES_SESSION');
    if (request.sourcePolicy?.researchVersion === 4) {
        if(!config.v4)throw Error('WEB_V4_CONFIG_REQUIRED');
        return runWebResearchV4(request,config,options,finishV2);
    }
    if (request.sourcePolicy?.researchVersion === 3) {
        if (!config.v2)
            throw Error('WEB_V2_CONFIG_REQUIRED researchVersion 3 needs web.v2');
        return runWebResearchV3(request, config, options, finishV2);
    }
    if (request.sourcePolicy?.researchVersion === 2) {
        if (!config.v2)
            throw Error('WEB_V2_CONFIG_REQUIRED researchVersion 2 needs web.v2');
        return runWebResearchV2(request, config, options, finishV2);
    }
    const plan = planResearch(request), env = options.env ?? nodeEnvironment, start = env.now(), client = new SecureHttpClient(config, env);
    client.deadline = start + config.maxDurationMs;
    const search = options.searchProvider ?? new MediaWikiSearchProvider(client), provider = new WebSourceProvider(client, options.cache), scope = scopeFor(request, config);
    let pack = buildEvidencePack(request, provider), rounds = 0;
    const queries: ResearchSession['queryPlan'] = [], results: ResearchSession['searchResults'] = [], trace: ResearchSession['searchTrace'] = [], attempts: ResearchSession['fetchAttempts'] = [], rejected: ResearchSession['rejectedSources'] = [], diagnostics: string[] = [];
    let candidates: ResearchSession['candidateSources'] = [], entities: ResearchSession['entities'] = [];
    const domainCounts = new Map<string, number>(), attempted = new Set<string>();
    const budget = () => env.now() - start >= config.maxDurationMs || client.bytes >= config.maxTotalBytes || queries.length >= config.maxQueries || attempts.length >= config.maxFetchedSources || results.length >= config.maxSearchResults;
    for (let round = 0; round < config.maxResearchRounds; round++) {
        if (budget())
            break;
        rounds = round + 1;
        const next = queryPlan(plan, config, round, entities, pack);
        for (const q of next) {
            if (budget())
                break;
            queries.push(q);
            const found = await search.search(q, Math.min(config.maxResultsPerQuery, config.maxSearchResults - results.length));
            trace.push({ query: q, resultCount: found.results.length, diagnostic: found.diagnostic, latencyMs: found.latencyMs });
            if (found.diagnostic)
                diagnostics.push(found.diagnostic);
            results.push(...found.results.slice(0, config.maxSearchResults - results.length));
        }
        candidates = candidateSources(results, queries, config);
        // Domain quotas include failed attempts, preventing repeated pressure on a blocked site.
        for (const c of candidates) {
            if (env.now() - start >= config.maxDurationMs || client.bytes >= config.maxTotalBytes || attempts.length >= config.maxFetchedSources)
                break;
            if (attempted.has(c.canonicalUrl))
                continue;
            if ((domainCounts.get(c.domain) ?? 0) >= config.maxSourcesPerDomain) {
                c.fetchStatus = 'DOMAIN_QUOTA';
                continue;
            }
            attempted.add(c.canonicalUrl);
            domainCounts.set(c.domain, (domainCounts.get(c.domain) ?? 0) + 1);
            const fetched = await provider.fetch(c, plan);
            attempts.push(fetched.attempt);
            c.fetchStatus = fetched.attempt.status;
            if (!fetched.source)
                rejected.push({ url: c.canonicalUrl, reason: fetched.attempt.reason });
            pack = buildEvidencePack(request, provider);
            if (pack.quality.productionEligibility === 'RESEARCH_READY')
                break;
        }
        entities = discoverEntities(pack, candidates, results);
        if (pack.quality.productionEligibility === 'RESEARCH_READY') {
            diagnostics.push('EARLY_STOP_COVERAGE_READY');
            break;
        }
    }
    // Near-identical snapshots conservatively share an origin. This may undercount independence.
    const acquired = provider.receive(plan).sources;
    for (let i = 0; i < acquired.length; i++)
        for (let j = 0; j < i; j++) {
            const a = normalizedSource(acquired[i], plan.policy).normalized.text, b = normalizedSource(acquired[j], plan.policy).normalized.text;
            const chunks = (t: string) => new Set(t.split(/\s+/).reduce<string[]>((out, w, k, all) => { if (k % 40 === 0)
                out.push(jsonHash(all.slice(k, k + 40).join(' '))); return out; }, []));
            const aa = chunks(a), bb = chunks(b), common = [...aa].filter(x => bb.has(x)).length;
            if (aa.size >= 3 && common / Math.min(aa.size, bb.size) >= 0.8) {
                const key = 'near-copy:' + jsonHash([acquired[i].contentHash, acquired[j].contentHash].sort());
                for (const source of [acquired[i], acquired[j]])
                    source.provenance.sharedOriginKeys = [...(source.provenance.sharedOriginKeys ?? []), key];
            }
        }
    pack = buildEvidencePack(request, { version: 1, id: 'web-session-final', fixture: false, labels: ['REAL_WEB_SNAPSHOTS', 'SESSION_CANDIDATES_ONLY'], sources: acquired });
    validateEvidencePack(pack);
    entities = discoverEntities(pack, candidates, results);
    const writer = write(pack, scope), exhausted = budget() || rounds === config.maxResearchRounds && pack.quality.productionEligibility !== 'RESEARCH_READY';
    if (exhausted)
        diagnostics.push('RESEARCH_BUDGET_EXHAUSTED');
    if (scope.humanReviewRequired)
        diagnostics.push('HUMAN_REVIEW_REQUIRED_SCOPE_ADJUSTMENT');
    const quality: ResearchSession['quality'] = { queries: queries.length, results: results.length, uniqueDomains: new Set(results.map(r => r.displayDomain)).size, candidateSources: candidates.length, fetchAttempts: attempts.length, successfulFetches: attempts.filter(a => a.httpStatus === 200 && a.snapshot).length, acceptedSources: acquired.length, rejectedSources: rejected.length, discoveredEntities: entities.filter(e => e.provenance === 'DISCOVERED_FROM_SOURCE').length, groundedFacts: pack.quality.groundedFactCount, corroboratedFacts: pack.quality.corroboratedFactCount, conflicts: pack.conflicts.length, researchCoverage: pack.quality.criticalCoverage, budgetUsage: { bytes: client.bytes, elapsedMs: env.now() - start, rounds }, liveOrReplay: 'LIVE_DISCOVERY', resultState: pack.quality.productionEligibility === 'RESEARCH_READY' && !scope.humanReviewRequired ? 'REAL_RESEARCH_READY' : pack.quality.groundedFactCount ? 'REAL_RESEARCH_PARTIAL' : 'REAL_RESEARCH_BLOCKED', budgetStatus: exhausted ? 'RESEARCH_BUDGET_EXHAUSTED' : 'COVERAGE_STOP' };
    const raw = { version: 'web-research/1.0.0', mode: 'LIVE_DISCOVERY' as const, request: structuredClone(request), config, plan, queryPlan: queries, searchResults: results, searchTrace: trace, candidateSources: candidates, fetchAttempts: attempts, acceptedSources: acquired, rejectedSources: rejected, entities, EvidencePack: pack, writer, diagnostics: [...new Set(diagnostics)], scope, quality, processingFingerprint: processingFingerprint(pack, writer, scope) };
    return { ...raw, fingerprint: jsonHash(raw) };
}
export function replayWebResearch(session: ResearchSession): ResearchSession {
    const { fingerprint, ...raw } = session;
    if (jsonHash(raw) !== fingerprint)
        throw Error('SESSION_INTEGRITY');
    for (const a of session.fetchAttempts)
        if (a.snapshot)
            validateSnapshot(a.snapshot);
    for (const source of session.acceptedSources) {
        const snapshot = session.fetchAttempts.find(a => a.snapshot?.contentHash === source.contentHash && a.finalUrl === source.canonicalLocator)?.snapshot;
        if (!snapshot || snapshot.content !== source.content)
            throw Error('REPLAY_SOURCE_SNAPSHOT_MISMATCH');
    }
    const pack = buildEvidencePack(session.request, { version: 1, id: 'offline-reprocessed-web', fixture: false, labels: ['REAL_WEB_SNAPSHOTS', 'SESSION_CANDIDATES_ONLY'], sources: session.acceptedSources });
    validateEvidencePack(pack);
    const scope = scopeFor(session.request, session.config), writer = write(pack, scope), processed = processingFingerprint(pack, writer, scope);
    if (processed !== session.processingFingerprint)
        throw Error('REPLAY_PROCESSING_MISMATCH');
    // v3: CandidateEntityPool and CorroborationTasks are recomputed from the rebuilt pack and recorded discovery data.
    const v3 = session.v3 ? sessionV3(pack, session.plan, session.searchResults, session.queryPlan, session.v3.discovery, session.v2!) : undefined;
    if (v3 && (v3.fingerprints.candidateEntityPool !== session.v3!.fingerprints.candidateEntityPool || v3.fingerprints.corroborationTasks !== session.v3!.fingerprints.corroborationTasks || jsonHash(session.v3!.candidateEntityPool) !== session.v3!.fingerprints.candidateEntityPool || jsonHash(session.v3!.corroborationTasks) !== session.v3!.fingerprints.corroborationTasks))
        throw Error('REPLAY_V3_MISMATCH candidate pool / corroboration tasks');
    const v4=session.v4?buildSessionV4(session.request,session.acceptedSources,pack,session.v4.bootstrapSourceIds,session.v4.intents,session.queryPlan,session.searchResults,session.fetchAttempts,session.config):undefined;
    if(v4&&jsonHash(v4)!==jsonHash(session.v4))throw Error('REPLAY_V4_MISMATCH');
    const result = { ...raw, mode: 'CACHED_REPLAY' as const, EvidencePack: pack, writer, scope, quality: { ...session.quality, liveOrReplay: 'CACHED_REPLAY' }, ...(v3 ? { v3 } : {}), ...(v4 ? {v4}:{}), processingFingerprint: processed };
    return { ...result, fingerprint: jsonHash(result) };
}
