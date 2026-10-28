// Phase 22 checkpoint helper (offline): rebuilds a Phase 21 session's snapshots under researchVersion 3 and prints facts/contexts/records/graph. Dev diagnostic only; no network.
import { readFileSync } from 'node:fs';
import { buildEvidencePack } from '../../src/research/pack';
const s = JSON.parse(readFileSync('out/engine3d/phase21/logs/' + (process.argv[2] ?? 'real-cold-places-v2') + '.json', 'utf8'));
const request = structuredClone(s.request);
request.sourcePolicy.researchVersion = 3;
if (request.researchGoal === 'RANKING') request.sourcePolicy.observationSitePolicy = 'SOURCED_OBSERVATION_SITE';
const t0 = Date.now();
const p = buildEvidencePack(request, { version: 1, id: 'dev', fixture: false, labels: ['DEV'], sources: s.acceptedSources });
console.log('ms', Date.now() - t0, 'evidence', p.evidence.length, 'facts', p.groundedFacts.length);
for (const f of p.groundedFacts.filter(f => f.factType !== 'QUANTITY' || f.status !== 'INSUFFICIENT').slice(0, 30)) console.log(f.status, f.factType, f.canonicalFact.subject, f.canonicalFact.subjectKind ?? '', f.canonicalFact.quantity?.originalValue ?? f.canonicalFact.residency, f.qualifiers.join(','), f.canonicalFact.observationPeriod ?? f.canonicalFact.temporalContext ?? '', '|', f.origins?.admission);
console.log('authority', p.v3!.authority.filter(a => a.authority !== 'NONE').map(a => a.sourceId + ' ' + a.effectiveSourceType + ' ' + a.authority + ' :: ' + a.reasons.join(' / ')));
console.log('publishers', p.v3!.publishers.filter(x => x.name).map(x => x.kind + ' ' + x.name + ' [' + x.signals.map(s => s.signal).join(',') + ']'));
console.log('contexts', p.v3!.documentContexts.map(c => c.sourceId.slice(0, 10) + ' ' + (c.resolved ? c.resolved.name + '/' + c.resolved.entityKind + '/' + c.resolved.sourceKinds.join('+') : c.ambiguity)));
console.log('records', p.v3!.records.length, p.v3!.records.filter(r => r.semantics !== 'UNKNOWN').map(r => r.semantics + ' ' + r.heading + ' ' + r.subjectCandidates.join('|') + ' ev' + r.evidenceIds.length));
console.log('graph', p.v3!.entityGraph.nodes.map(n => n.kind + ':' + n.name).join(', '));
console.log('edges', p.v3!.entityGraph.edges.map(e => e.relation + ' ' + e.reason.slice(0, 120)));
console.log('ranking', p.ranking?.status, p.ranking?.reason, p.ranking?.excluded);
console.log('eligibility', p.v3!.eligibility.map(e => e.entity + ' eligible=' + e.eligible + ' :: ' + e.reason));
