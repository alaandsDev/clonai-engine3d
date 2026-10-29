import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ResearchSession } from './contracts';
import { SnapshotCache, cacheDiscovery } from './cache';
import {saveResearchV3Artifacts} from './output-v3';
import { corroborationReview, sourceGraphReview, structuredReview } from './review';
// Review artifacts must display untrusted source data without embedding active HTML/media.
const reviewData = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([\\`*_[\]!])/g, '\\$1');
export async function saveResearchSession(session: ResearchSession, root: string, label: string) {
    if (!/^[a-z0-9-]+$/.test(label))
        throw Error('OUTPUT_LABEL');
    const json = async (dir: string, value: unknown) => { await mkdir(path.join(root, dir), { recursive: true }); await writeFile(path.join(root, dir, label + '.json'), JSON.stringify(value, null, 2)); };
    const p = session.EvidencePack;
    await json('inputs', { request: session.request, web: session.config });
    await json('research-plans', session.plan);
    await json('queries', session.queryPlan);
    await json('search-results', session.searchResults);
    await json('candidate-sources', session.candidateSources);
    await json('fetch-attempts', session.fetchAttempts.map(({ snapshot, ...a }) => ({ ...a, snapshotFingerprint: snapshot?.fingerprint ?? null })));
    await json('source-quality', p.sourceAssessments);
    await json('entities', session.entities);
    await json('evidence', p.evidence);
    await json('facts', p.groundedFacts);
    await json('conflicts', p.conflicts);
    await json('packs', p);
    await json('writer', session.writer);
    await json('semantic', session.writer?.finalPreflight?.graph ?? null);
    await json('graphs', session.writer?.finalPreflight?.graph ?? null);
    await json('plans', session.writer?.finalPreflight?.plan ?? null);
    await json('analysis', session.quality);
    if (session.v2 && p.v2) {
        await json('references', session.v2.references);
        await json('source-graphs', p.v2.sourceGraph);
        await json('origin-groups', p.v2.originGroups);
        await json('structured', p.v2.structures);
        await json('tables', p.v2.structures.filter(s => s.kind === 'HTML_TABLE' || s.kind === 'KEY_VALUE').map(s => ({ ...s, evidence: p.evidence.filter(e => s.evidenceIds.includes(e.id)).map(e => ({ id: e.id, structured: e.structured, exactText: e.exactText, normalizedText: e.normalizedText, fact: e.supports })) })));
        await json('datasets', p.v2.structures.filter(s => s.kind === 'DATASET'));
        await json('evidence-quality', p.v2.evidenceAssessments);
        await json('aliases', p.v2.aliases);
        await json('analysis/v2', { metrics: session.v2.metrics, gaps: session.v2.gaps, stageBudgets: session.v2.stageBudgets, strategies: session.v2.strategies, entityPool: session.v2.entityPool, diagnostics: p.v2.diagnostics });
        await mkdir(path.join(root, 'review'), { recursive: true });
        await writeFile(path.join(root, 'review', label + '-source-graph.md'), sourceGraphReview(session, label));
        await writeFile(path.join(root, 'review', label + '-corroboration.md'), corroborationReview(session, label));
        await writeFile(path.join(root, 'review', label + '-structured-extraction.md'), structuredReview(session, label));
    }
    await json('logs', session);
    const cache = new SnapshotCache(path.join(root, 'cache', 'snapshots'));
    for (const a of session.fetchAttempts)
        if (a.snapshot) {
            await cache.put(a.snapshot);
            await mkdir(path.join(root, 'sources/raw'), { recursive: true });
            const file = path.join(root, 'sources/raw', a.snapshot.contentHash + '.txt');
            try {
                await writeFile(file, a.snapshot.content, { flag: 'wx' });
            }
            catch (e: any) {
                if (e.code !== 'EEXIST' || await readFile(file, 'utf8') !== a.snapshot.content)
                    throw Error('RAW_SNAPSHOT_IMMUTABILITY');
            }
        }
    await json('sources/normalized', p.sources.map(s => ({ id: s.id, canonicalLocator: s.canonicalLocator, contentHash: s.contentHash, normalized: s.normalized })));
    await cacheDiscovery(path.join(root, 'cache/discovery'), { queries: session.queryPlan, results: session.searchResults, trace: session.searchTrace });
    await cacheDiscovery(path.join(root, 'cache/sessions'), session);
    await json('analysis/manifests', p.sources.map(s => ({ id: s.id, title: s.title, url: s.canonicalLocator, publisher: s.publisher, language: s.language, retrievedAt: s.retrievedAt, contentHash: s.contentHash, fixture: s.fixture, provenance: s.provenance })));
    await mkdir(path.join(root, 'review'), { recursive: true });
    const factRows = p.groundedFacts.map(f => { const e = p.evidence.find(e => f.evidenceIds.includes(e.id))!, source = p.sources.find(s => s.id === e.sourceId)!, used = Boolean(session.writer?.finalCandidate?.sentences.some(s => s.groundedFactIds.includes(f.id))); return `### ${f.id}\n\n${JSON.stringify(f.canonicalFact)}\n\nSource: [${reviewData(source.title)}](${source.canonicalLocator.replace(/[()]/g, encodeURIComponent)})\n\nExact snapshot evidence (${e.sourceSpan.start}–${e.sourceSpan.end}):\n\n> ${reviewData(e.exactText).replace(/\n/g, ' ')}\n\nStatus ${f.status}; qualifiers ${f.qualifiers.join(', ')}; used in script: ${used}; visual: ${session.writer?.finalPreflight?.matrix.filter(m => m.groundedFactIds.includes(f.id)).map(m => m.visualProof + ': ' + m.gap).join('; ') || 'NOT_PLANNED'}.\n`; }).join('\n');
    await writeFile(path.join(root, 'review', label + '.md'), `# ${reviewData(session.request.topic)}\n\nScope: ${JSON.stringify(session.scope)}\n\nCriterion: ${session.request.constraints?.residencyCriterion ?? 'not requested'}\n\nState: ${session.quality.resultState}\n\nQuality: ${JSON.stringify(session.quality)}\n\n## Queries\n\n${session.queryPlan.map(q => `- ${q.stage}: ${reviewData(q.text)} — ${reviewData(q.followupReason)}`).join('\n')}\n\n## Entities\n\n${session.entities.map(e => `- ${reviewData(e.name)}: ${e.provenance}; ${e.firstUrl}; evidence ${e.evidenceIds.join(', ')}`).join('\n')}\n\n## Facts and exact citations\n\n${factRows || 'No extractable factual evidence. No invented completion.'}\n\n## Conflicts\n\n${JSON.stringify(p.conflicts)}\n\n## Ranking and gaps\n\n${JSON.stringify(p.ranking, null, 2)}\n\nUnresolved: ${JSON.stringify(p.unresolvedQuestions)}\n\n## GROUNDED_ONLY script\n\n${reviewData(session.writer?.finalCandidate?.script ?? 'No approved script; research/semantic preflight incomplete.')}\n\n## Factual / visual matrix\n\n${JSON.stringify(session.writer?.finalPreflight?.matrix ?? [], null, 2)}\n\nNo production render was requested by this research run.\n`);
    if (session.v3)
        await saveResearchV3Artifacts(session,root,label);
    return path.join(root, 'logs', label + '.json');
}
