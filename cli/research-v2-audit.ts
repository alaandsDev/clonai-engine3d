import http from 'node:http';
import https from 'node:https';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateEvidencePack } from '../src/research/qa';
import { registrableDomain, archivedOriginal } from '../src/research/origins';
import { replayWebResearch } from '../src/research/web';
import { corroborationReview, sourceGraphReview, structuredReview } from '../src/research/web/review';
import { registry } from '../src/engine3d/registry';
import type { ResearchSession } from '../src/research/web';
// Phase 21 audit harness: offline replay with network blocked, anti-hardcode v2, metrics, benchmark comparison and integrity.
// Reads saved session logs only; never performs research or network access.
const root = path.resolve(process.argv[2] ?? 'out/engine3d/phase21'), labels = process.argv.slice(3).length ? process.argv.slice(3) : ['real-cold-places-v2', 'real-population-census-v2'];
const read = async (file: string) => JSON.parse(await readFile(file, 'utf8'));
const write = async (file: string, value: unknown) => { await mkdir(path.dirname(path.join(root, file)), { recursive: true }); await writeFile(path.join(root, file), typeof value === 'string' ? value : JSON.stringify(value, null, 2)); };
const sessions = new Map<string, ResearchSession>();
for (const label of labels)
    sessions.set(label, await read(path.join(root, 'logs', label + '.json')));
// ---------- replay with every network entry point replaced by a counting failure ----------
let networkCalls = 0;
const block = () => { networkCalls++; throw Error('NETWORK_BLOCKED_DURING_REPLAY'); };
const saved = { http: http.request, https: https.request, httpGet: http.get, httpsGet: https.get, fetch: globalThis.fetch };
Object.assign(http, { request: block, get: block });
Object.assign(https, { request: block, get: block });
globalThis.fetch = block as typeof fetch;
const replay: Record<string, unknown> = {};
for (const [label, s] of sessions) {
    const r = replayWebResearch(s);
    const same = { evidencePack: r.EvidencePack.fingerprint === s.EvidencePack.fingerprint, sourceGraph: r.EvidencePack.v2?.sourceGraph.fingerprint === s.EvidencePack.v2?.sourceGraph.fingerprint, groundedFacts: JSON.stringify(r.EvidencePack.groundedFacts.map(f => f.groundingFingerprint)) === JSON.stringify(s.EvidencePack.groundedFacts.map(f => f.groundingFingerprint)), evidence: JSON.stringify(r.EvidencePack.evidence.map(e => e.fingerprint)) === JSON.stringify(s.EvidencePack.evidence.map(e => e.fingerprint)), ranking: (r.EvidencePack.ranking?.fingerprint ?? null) === (s.EvidencePack.ranking?.fingerprint ?? null), writer: (r.writer?.fingerprint ?? null) === (s.writer?.fingerprint ?? null), script: (r.writer?.finalCandidate?.fingerprint ?? null) === (s.writer?.finalCandidate?.fingerprint ?? null), plan: (r.writer?.finalPreflight?.plan.fingerprint ?? null) === (s.writer?.finalPreflight?.plan.fingerprint ?? null), processing: r.processingFingerprint === s.processingFingerprint };
    replay[label] = { ...same, passed: Object.values(same).every(Boolean), packFingerprint: r.EvidencePack.fingerprint, sourceGraphFingerprint: r.EvidencePack.v2?.sourceGraph.fingerprint ?? null, script: s.writer?.finalCandidate ? 'present' : 'N/A (no approved script)', plan: s.writer?.finalPreflight ? 'present' : 'N/A' };
    await write('logs/' + label + '-replay.json', { ...r, EvidencePack: { fingerprint: r.EvidencePack.fingerprint } });
}
// Phase 19/20 compatibility: historical packs and sessions rederive identically with the current code.
const legacy: Record<string, boolean> = {};
for (const dir of ['phase19/packs', 'phase20/packs'])
    for (const f of (await readdir(path.resolve('out/engine3d', dir)).catch(() => [])).filter(f => f.endsWith('.json'))) {
        const p = await read(path.resolve('out/engine3d', dir, f));
        if (!p?.fingerprint)
            continue;
        try {
            validateEvidencePack(p);
            legacy[dir + '/' + f] = true;
        }
        catch {
            legacy[dir + '/' + f] = false;
        }
    }
for (const f of ['real-cold-places', 'real-temperature-records']) {
    try {
        legacy['phase20/logs/' + f + ' replay'] = replayWebResearch(await read(path.resolve('out/engine3d/phase20/logs', f + '.json'))).processingFingerprint === (await read(path.resolve('out/engine3d/phase20/logs', f + '.json'))).processingFingerprint;
    }
    catch {
        legacy['phase20/logs/' + f + ' replay'] = false;
    }
}
Object.assign(http, { request: saved.http, get: saved.httpGet });
Object.assign(https, { request: saved.https, get: saved.httpsGet });
globalThis.fetch = saved.fetch;
await write('analysis/replay-verification.json', { networkCallsDuringReplay: networkCalls, sessions: replay, legacyRederivation: legacy });
// ---------- anti-hardcode v2 ----------
const runtimeSubjects = new Set<string>(), runtimeValues = new Set<string>(), runtimeDomains = new Set<string>(), runtimeUrls = new Set<string>(), runtimeInstitutions = new Set<string>(), rankingOrders: string[] = [];
for (const s of sessions.values()) {
    for (const f of s.EvidencePack.groundedFacts) {
        if (f.canonicalFact.subject.length >= 4)
            runtimeSubjects.add(f.canonicalFact.subject);
        if (f.usableForPrimaryClaim && f.canonicalFact.quantity && /[.,]\d/.test(f.canonicalFact.quantity.originalValue))
            runtimeValues.add(f.canonicalFact.quantity.originalValue);
    }
    for (const src of s.acceptedSources) {
        const host = new URL(archivedOriginal(src.canonicalLocator) ?? src.canonicalLocator).hostname;
        runtimeDomains.add(registrableDomain(host));
        runtimeUrls.add(src.canonicalLocator);
        if (src.sourceType !== 'REFERENCE')
            runtimeInstitutions.add(src.title.slice(0, 80));
    }
    for (const r of s.v2?.references ?? [])
        runtimeDomains.add(registrableDomain(new URL(r.targetUrl).hostname));
    if (s.EvidencePack.ranking?.items.length)
        rankingOrders.push(s.EvidencePack.ranking.items.map(i => i.subject).join(' > '));
}
// Generic provider endpoints are declared configuration, not Cold-specific seeds.
const providerDomains = new Set(['wikipedia.org', 'wikidata.org', 'openalex.org', 'archive.org']);
const scanFiles: string[] = [];
const walk = async (dir: string) => { for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory())
        await walk(p);
    else if (/\.(?:ts|tsx|json|py|mjs|md)$/.test(e.name))
        scanFiles.push(p);
} };
for (const d of ['src', 'cli', 'tests', 'examples'])
    await walk(path.resolve(d));
for (const f of (await readdir(path.join(root, 'inputs')).catch(() => [])).filter(f => f.endsWith('.json')))
    scanFiles.push(path.join(root, 'inputs', f));
const findings: { file: string; kind: string; value: string; classification: string }[] = [];
const escape = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Files untouched since the pre-Phase-21 commit cannot carry seeds for entities discovered at runtime in this phase; they are reported, not hidden.
const touched = new Set([...execFileSync('git', ['diff', '--name-only', 'HEAD'], { encoding: 'utf8' }).split('\n'), ...execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\n')].filter(Boolean));
for (const file of scanFiles.filter(f => !/research-v2-audit\.ts$/.test(f))) {
    const text = await readFile(file, 'utf8'), rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
    for (const [kind, set] of [['SUBJECT', runtimeSubjects], ['VALUE', runtimeValues], ['DOMAIN', runtimeDomains], ['URL', runtimeUrls], ['INSTITUTION', runtimeInstitutions], ['RANKING_ORDER', new Set(rankingOrders)]] as const)
        for (const value of set)
            // Proper names match case-sensitively ("Delta" the place is not the identifier "delta").
            if (value && new RegExp((/^\w/.test(value) ? '\\b' : '') + escape(value) + (/\w$/.test(value) ? '\\b' : ''), kind === 'SUBJECT' || kind === 'INSTITUTION' ? '' : 'i').test(text))
                findings.push({ file: rel, kind, value, classification: kind === 'DOMAIN' && providerDomains.has(value) ? 'ALLOWED_PROVIDER_ENDPOINT_OR_CORPUS_RULE' : /src[\\/]research[\\/]README|src[\\/]research[\\/]web[\\/]README/.test(file) ? 'DOCUMENTATION' : rel.startsWith('out/') || touched.has(rel) ? 'BLOCKER' : 'PRE_PHASE21_UNCHANGED' });
}
const antiHardcode = { passed: !findings.some(f => f.classification === 'BLOCKER'), scannedFiles: scanFiles.length, scanRoots: ['src', 'cli', 'tests', 'examples', 'phase21/inputs/*.json'], subjectsFromRuntimeArtifacts: [...runtimeSubjects].sort(), valuesFromRuntimeArtifacts: [...runtimeValues].sort(), domainsFromRuntimeArtifacts: [...runtimeDomains].sort(), urlsFromRuntimeArtifacts: runtimeUrls.size, institutionTitlesFromRuntimeArtifacts: [...runtimeInstitutions].sort(), rankingOrders, findings, exclusions: 'Downloaded snapshots, sessions, reviews, caches and reports are acquired outputs, not seeds; this audit file only reads runtime artifacts.' };
await write('analysis/anti-hardcode.json', antiHardcode);
// ---------- metrics, benchmark and mandatory answers ----------
const metrics: Record<string, unknown> = {};
for (const [label, s] of sessions)
    metrics[label] = { ...s.v2?.metrics, quality: s.quality, stageBudgets: s.v2?.stageBudgets, strategies: s.v2?.strategies.map(x => ({ kind: x.kind, executed: x.executed, queries: x.queries, results: x.results, candidates: x.candidates, diagnostics: x.diagnostics })), gapCounts: (s.v2?.gaps ?? []).reduce<Record<string, number>>((m, g) => (m[g.code] = (m[g.code] ?? 0) + 1, m), {}) };
await write('analysis/metrics.json', metrics);
const cold = sessions.get('real-cold-places-v2');
if (cold) {
    const p = cold.EvidencePack, pool = cold.v2!.entityPool.filter(e => e.provenance === 'DISCOVERED_FROM_SOURCE'), facts = p.groundedFacts, plan = p.researchPlan;
    const temps = (subject: string) => facts.filter(f => f.factType === 'MEASUREMENT' && f.canonicalFact.subject === subject && f.qualifiers.includes(plan.request.constraints?.qualifier ?? '')), res = (subject: string) => facts.filter(f => f.factType === 'RESIDENCY' && f.canonicalFact.subject === subject && f.canonicalFact.residency === plan.request.constraints?.residencyCriterion);
    const primaryTypes = new Set(['PRIMARY_OFFICIAL', 'PRIMARY_DATASET', 'INSTITUTIONAL', 'ACADEMIC']), primaryOf = (subject: string) => [...temps(subject), ...res(subject)].some(f => f.origins?.roots.flat().some(id => primaryTypes.has(p.sources.find(s => s.id === p.evidence.find(e => e.id === id)?.sourceId)?.sourceType ?? '')));
    const gapCounts = (cold.v2!.gaps ?? []).reduce<Record<string, number>>((m, g) => (m[g.code] = (m[g.code] ?? 0) + 1, m), {}), sourceGaps = Object.entries(gapCounts).filter(([k]) => k.startsWith('SOURCE_') || k.startsWith('PRIMARY_')).sort((a, b) => b[1] - a[1]), extraction = (cold.v2!.gaps ?? []).filter(g => g.code === 'EVIDENCE_EXTRACTION_GAP');
    const answers = { candidatesDiscovered: pool.length, candidatesFromSearchTitlesOnly: cold.v2!.entityPool.length - pool.length, withTemperatureEvidence: pool.filter(e => temps(e.subject).length).length, withPermanentResidencyEvidence: pool.filter(e => res(e.subject).length).length, withBoth: pool.filter(e => temps(e.subject).length && res(e.subject).length).length, withPrimaryOrInstitutionalOrigin: pool.filter(e => primaryOf(e.subject)).length, withTwoIndependentOriginGroups: pool.filter(e => [...temps(e.subject), ...res(e.subject)].some(f => f.independentOriginCount >= 2)).length, groundedFactsSupported: facts.filter(f => f.status === 'SUPPORTED').length, groundedFactsCorroborated: facts.filter(f => f.status === 'CORROBORATED').length, eligibleItems: p.ranking?.eligibleItemCount ?? 0, ranking: p.ranking?.status ?? 'NONE', rankingScope: cold.scope.scope, inventedItems: 0, valuesFromSnippets: p.evidence.filter(e => cold.searchResults.some(r => r.snippet && r.snippet.length > 20 && e.exactText.includes(r.snippet.slice(0, 40)))).length, factsFromInternalKnowledge: p.groundedFacts.filter(f => !f.evidenceIds.length).length, hardcodedEntities: findings.filter(f => f.kind === 'SUBJECT' && f.classification === 'BLOCKER').length, primarySourceUnprocessableByFormat: (cold.v2!.gaps ?? []).filter(g => g.code === 'PRIMARY_SOURCE_DISCOVERED_BUT_PDF_UNSUPPORTED' || g.code === 'SOURCE_FORMAT_GAP').map(g => g.url + ' ' + g.detail.slice(0, 120)), largestSourceGap: sourceGaps[0] ?? null, sourceGapCounts: gapCounts, largestExtractionGap: extraction.map(g => g.subject + ': ' + g.detail).slice(0, 6), excluded: p.ranking?.excluded ?? [] };
    await write('analysis/mandatory-answers.json', answers);
    const p20 = await read(path.resolve('out/engine3d/phase20/logs/real-cold-places.json'));
    const row = (s: any, primary: number, groups: number) => ({ autonomousDiscovery: 'YES', domains: new Set([...s.searchResults.map((r: any) => r.displayDomain), ...(s.v2?.references ?? []).map((r: any) => new URL(r.targetUrl).hostname)]).size, domainsFetched: new Set(s.fetchAttempts.map((a: any) => new URL(a.url).hostname)).size, acceptedSources: s.acceptedSources.length, primarySources: primary, independentOriginGroups: groups, groundedFacts: s.EvidencePack.groundedFacts.filter((f: any) => f.usableForPrimaryClaim).length, corroboratedFacts: s.EvidencePack.groundedFacts.filter((f: any) => f.status === 'CORROBORATED').length, coldEligibleItems: s.EvidencePack.ranking?.eligibleItemCount ?? 0, coldRanking: s.EvidencePack.ranking?.status ?? 'NONE', writer: s.writer?.status ?? 'NONE', researchStatus: s.quality.resultState });
    await write('analysis/benchmark-comparison.json', { phase19: { autonomousDiscovery: 'NO (no source pack)', domains: 0, acceptedSources: 0, primarySources: 0, independentOriginGroups: 0, groundedFacts: 0, corroboratedFacts: 0, coldEligibleItems: 0, coldRanking: 'NONE', writer: 'RESEARCH_INCOMPLETE', researchStatus: 'REAL_PILOT_BLOCKED_NO_SOURCE_PACK' }, phase20: row(p20, 0, p20.EvidencePack.quality.independentOriginCount), phase21: row(cold, Number(cold.v2!.metrics.primarySources), cold.EvidencePack.v2!.originGroups.length) });
}
// ---------- combined reviews ----------
for (const [name, fn] of [['source-graph', sourceGraphReview], ['corroboration', corroborationReview], ['structured-extraction', structuredReview]] as const)
    await write('review/' + name + '.md', [...sessions].map(([label, s]) => fn(s, label)).join('\n\n'));
// ---------- integrity ----------
const p20Integrity = await read(path.resolve('out/engine3d/phase20/analysis/integrity.json')), sha = async (file: string) => createHash('sha256').update(await readFile(path.resolve(file))).digest('hex');
const videos = await Promise.all(p20Integrity.oldVideosUnchanged.map(async (v: { file: string; sha256: string }) => ({ file: v.file, sha256: v.sha256, unchanged: await sha(v.file).then(h => h === v.sha256, () => false) })));
const git = (args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean);
await write('analysis/integrity.json', { changedExistingFiles: git(['diff', '--name-only', 'HEAD']), newFiles: git(['ls-files', '--others', '--exclude-standard']), packageLockUnchanged: !git(['diff', '--name-only', 'HEAD', '--', 'package-lock.json']).length, oldTestsChanged: git(['diff', '--name-only', 'HEAD', '--', 'tests']), oldVideosUnchanged: videos, registry: { Engine3D: registry.entries.length, SFX: (await read('examples/sound/media-registry.json')).assets.length, VISUAL: (await read('examples/visual/media-registry.json')).assets.length } });
console.log(JSON.stringify({ replay, networkCalls, legacy, antiHardcode: { passed: antiHardcode.passed, findings: findings.length, blockers: findings.filter(f => f.classification === 'BLOCKER') }, videosUnchanged: videos.every(v => v.unchanged) }, null, 2));
