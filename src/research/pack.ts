import { jsonHash } from '../editorial/fingerprint';
import { planResearch } from './planner';
import { intakeSources, assessSource } from './source';
import { extractSourceEvidence } from './extractor';
import { detectConflicts, groundFacts, sourceOriginGroups } from './facts';
import { rankFacts } from './ranking';
import { researchV2 } from './v2';
import type { ResearchRequest, SourcePack, EvidencePack, SourceProvider } from './contracts';
export function canonicalPack(p: Omit<EvidencePack, 'fingerprint'> | EvidencePack) { const { fingerprint, ...raw } = p as EvidencePack; return { ...raw, sources: [...p.sources].sort((a, b) => a.id.localeCompare(b.id, 'en')), sourceAssessments: [...p.sourceAssessments].sort((a, b) => a.sourceId.localeCompare(b.sourceId, 'en')), evidence: [...p.evidence].sort((a, b) => a.id.localeCompare(b.id, 'en')), factCandidates: [...p.factCandidates].sort((a, b) => a.id.localeCompare(b.id, 'en')), groundedFacts: [...p.groundedFacts].sort((a, b) => a.id.localeCompare(b.id, 'en')), conflicts: [...p.conflicts].sort((a, b) => a.id.localeCompare(b.id, 'en')) }; }
export const packFingerprint = (p: Omit<EvidencePack, 'fingerprint'> | EvidencePack) => jsonHash(canonicalPack(p));
export function buildEvidencePack(request: ResearchRequest, input: SourcePack | SourceProvider): EvidencePack {
    const plan = planResearch(request), snapshot = 'receive' in input ? input.receive(plan) : structuredClone(input), sources = intakeSources(plan, snapshot), sourceAssessments = sources.map(s => assessSource(s, plan.policy)), accepted = new Set(sourceAssessments.filter(a => a.accepted).map(a => a.sourceId));
    // researchVersion 2 (Phase 21) replaces extraction/origins/conflicts/grounding; the v1 path is unchanged.
    const v2 = plan.policy.researchVersion === 2 ? researchV2(plan, sources, sourceAssessments, accepted, request.maxEvidenceItems ?? 128) : null;
    const extracted = v2 ? [] : sources.filter(s => accepted.has(s.id)).map(s => extractSourceEvidence(s, plan.policy, request.maxEvidenceItems ?? 128)), evidence = v2?.evidence ?? extracted.flatMap(x => x.evidence).sort((a, b) => a.id.localeCompare(b.id, 'en')), factCandidates = v2?.factCandidates ?? extracted.flatMap(x => x.candidates).sort((a, b) => a.id.localeCompare(b.id, 'en'));
    if (evidence.length > (request.maxEvidenceItems ?? 128))
        throw Error('RESEARCH_EVIDENCE_BUDGET pack');
    // v2 FACTS packs license the admitted facts; insufficient/conflicted candidates stay recorded but are not essential.
    const conflicts = v2?.conflicts ?? detectConflicts(factCandidates), groundedFacts = v2?.groundedFacts ?? groundFacts(factCandidates, evidence, sources, sourceAssessments, conflicts, plan.policy), ranking = rankFacts(plan, groundedFacts), usable = groundedFacts.filter(f => f.usableForPrimaryClaim), critical = ranking ? ranking.status === 'VALID' : v2 ? usable.length > 0 : usable.length > 0 && groundedFacts.every(f => f.usableForPrimaryClaim), unresolvedQuestions = plan.questions.filter(q => !critical || plan.ambiguities.length).map(q => ({ id: q.id, reason: plan.ambiguities.map(a => a.code).join(', ') || ranking?.reason || 'Missing/conflicted/insufficient grounded facts' })), essentialFactIds = ranking?.status === 'VALID' ? [...new Set(ranking.items.flatMap(i => [i.measurementFactId, ...(i.residencyFactId ? [i.residencyFactId] : [])]))].sort() : (v2 ? usable : groundedFacts).map(f => f.id).sort();
    let criticalCoverage = ranking ? ranking.status === 'VALID' ? 1 : Math.min(1, ranking.eligibleItemCount / ranking.requestedCount) : groundedFacts.length ? usable.length / groundedFacts.length : 0;
    const origins = sourceOriginGroups(sources), coverage = { researchQuestionCoverage: (plan.questions.length - unresolvedQuestions.length) / plan.questions.length, sourceCoverage: sources.length ? sourceAssessments.filter(a => a.accepted).length / sources.length : 0, evidenceCoverage: factCandidates.length ? factCandidates.filter(f => f.evidenceIds.length).length / factCandidates.length : 0, criticalFactCoverage: criticalCoverage, corroboratedFactRate: groundedFacts.length ? groundedFacts.filter(f => f.status === 'CORROBORATED').length / groundedFacts.length : 0, conflictRate: groundedFacts.length ? groundedFacts.filter(f => f.status === 'CONFLICTED').length / groundedFacts.length : 0, unresolvedQuestionRate: unresolvedQuestions.length / plan.questions.length };
    const missingRequestedTypes = request.desiredFactTypes.filter(t => !usable.some(f => f.factType === t) && !(t === 'RANKING' && ranking?.status === 'VALID'));
    if (missingRequestedTypes.length) {
        for (const q of plan.questions)
            if (!unresolvedQuestions.some(x => x.id === q.id))
                unresolvedQuestions.push({ id: q.id, reason: 'Missing requested fact types: ' + missingRequestedTypes.join(', ') });
        coverage.researchQuestionCoverage = 0;
        coverage.unresolvedQuestionRate = 1;
        coverage.criticalFactCoverage = 0;
        criticalCoverage = 0;
    }
    const raw = { version: 'evidence-pack/1.0.0', topic: request.topic, fixture: snapshot.fixture, labels: [...snapshot.labels].sort(), researchPlan: plan, sources, sourceAssessments, evidence, factCandidates, groundedFacts, conflicts, unresolvedQuestions, ranking, essentialResearchQuestionIds: plan.essentialResearchQuestionIds, essentialFactIds, coverage, quality: { sourceCount: sources.length, acceptedSourceCount: accepted.size, rejectedSourceCount: sources.length - accepted.size, evidenceCount: evidence.length, groundedFactCount: usable.length, corroboratedFactCount: groundedFacts.filter(f => f.status === 'CORROBORATED').length, conflictCount: conflicts.length, unresolvedCount: unresolvedQuestions.length, criticalCoverage, rankingValidity: ranking?.status ?? 'NOT_REQUESTED', productionEligibility: critical && !plan.ambiguities.length && !missingRequestedTypes.length ? 'RESEARCH_READY' as const : 'RESEARCH_INCOMPLETE' as const, publisherCount: new Set(sources.map(s => s.publisher.toLowerCase())).size, independentOriginCount: v2 ? v2.independentOriginGroups : origins.length }, ...(v2 ? { v2: v2.section } : {}) };
    return { ...canonicalPack(raw), fingerprint: packFingerprint(raw) };
}
