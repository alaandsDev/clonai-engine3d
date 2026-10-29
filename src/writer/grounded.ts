import { jsonHash } from '../editorial/fingerprint';
import { capabilityGraph } from '../autodirector/capabilities';
import type { CapabilityNode } from '../autodirector/contracts';
import { analyzeNaturalScript, directNarrative, compileNarrative } from '../narrative';
import { evaluateDirected } from '../engine3d/directed';
import { normalize } from '../semantics/normalize';
import type { EvidencePack, GroundedFact, GroundedSentence } from '../research/contracts';
import { validateEvidencePack } from '../research/qa';
import { allowedGroundedEditorial, realizeGroundedFact, factualPreflight, reconcileGrounding } from '../research/grounding';
import type { TopicScriptRequest } from './contracts';
import { validateRequest, wordCount } from './request';
import { buildCapabilityProfile } from './capability-profile';
import { naturalness } from './preflight';
export interface GroundedCandidate {
    version: string;
    id: string;
    strategy: 'PROCESS_EXPLAINER' | 'PATH_JOURNEY' | 'QUESTION_REVEAL' | 'GROUNDED_RANKING';
    script: string;
    sentences: GroundedSentence[];
    packFingerprint: string;
    fingerprint: string;
}
export function assembleGroundedCandidate(id: string, strategy: GroundedCandidate['strategy'], rows: {
    text: string;
    groundedFactIds: string[];
    kind: GroundedSentence['kind'];
}[], packFingerprint: string): GroundedCandidate { let at = 0; const sentences = rows.map((s, i) => { const span = { start: at, end: at + s.text.length, text: s.text }; at += s.text.length + 1; return { ...structuredClone(s), id: 'S' + (i + 1), sourceSpan: span }; }); const raw = { version: 'grounded-candidate/1.0.0', id, strategy, script: sentences.map(s => s.text).join('\n'), sentences, packFingerprint }; return { ...raw, fingerprint: jsonHash(raw) }; }
function orderedFacts(pack: EvidencePack) { if (pack.ranking?.status === 'VALID')
    return pack.ranking.items.flatMap(i => [...(i.residencyFactId ? [pack.groundedFacts.find(f => f.id === i.residencyFactId)!] : []), pack.groundedFacts.find(f => f.id === i.measurementFactId)!]); const position = (f: GroundedFact) => { const e = pack.evidence.filter(e => f.evidenceIds.includes(e.id)).sort((a, b) => a.sourceId.localeCompare(b.sourceId, 'en') || a.sourceSpan.start - b.sourceSpan.start)[0]; return e ? e.sourceId + ':' + String(e.sourceSpan.start).padStart(8, '0') + ':' + String(e.sourceSpan.end).padStart(8, '0') : f.id; }; return pack.groundedFacts.filter(f => pack.essentialFactIds.includes(f.id)).sort((a, b) => position(a).localeCompare(position(b), 'en')); }
export function generateGroundedCandidates(request: TopicScriptRequest, pack: EvidencePack): GroundedCandidate[] { const facts = orderedFacts(pack); if (facts.some(f => !f.usableForPrimaryClaim || !realizeGroundedFact(f)))
    return []; return [0, 1, 2].map(index => { const physical = facts.map(f => ({ text: realizeGroundedFact(f)!, groundedFactIds: [f.id], kind: 'FACT' as const })), context = allowedGroundedEditorial(pack).map(text => ({ text, groundedFactIds: [] as string[], kind: 'EDITORIAL' as const })); let rows = index === 0 ? [context[0], ...physical, context[1], context[3]] : index === 1 ? [physical[0], context[1], ...physical.slice(1), context[2], context[4]] : [context[2], context[0], ...physical, context[3]]; const min = request.targetWords?.min ?? 110, max = request.targetWords?.max ?? 160; for (const c of context)
    if (wordCount(rows.map(r => r.text).join(' ')) < min && !rows.some(r => r.text === c.text))
        rows.push(c); while (wordCount(rows.map(r => r.text).join(' ')) > max) {
    const at = rows.map(r => r.kind).lastIndexOf('EDITORIAL');
    if (at < 0)
        break;
    rows.splice(at, 1);
} return assembleGroundedCandidate('grounded-candidate-' + (index + 1), pack.ranking ? 'GROUNDED_RANKING' : index === 0 ? 'PROCESS_EXPLAINER' : index === 1 ? 'PATH_JOURNEY' : 'QUESTION_REVEAL', rows, pack.fingerprint); }); }
export function preflightGroundedCandidate(request: TopicScriptRequest, pack: EvidencePack, candidate: GroundedCandidate, snapshot: CapabilityNode[] = capabilityGraph(), measuredDurations?: {
    unitId: string;
    durationSeconds: number;
}[]) {
    const { fingerprint, ...rawCandidate } = candidate;
    if (jsonHash(rawCandidate) !== fingerprint || candidate.packFingerprint !== pack.fingerprint)
        throw Error('GROUNDED_CANDIDATE_FINGERPRINT');
    const factual = factualPreflight(pack, candidate.script, candidate.sentences);
    const graph = analyzeNaturalScript({ version: 1, id: 'grounded-' + jsonHash({ topic: request.topic, pack: pack.fingerprint, candidate: candidate.id }).slice(0, 16), language: 'pt-BR', script: candidate.script }), reconciliation = reconcileGrounding(pack, candidate.script, candidate.sentences, graph), plan = directNarrative(graph, { policy: 'STRICT_ISLANDS', measuredDurations }, snapshot), compiled = compileNarrative(plan, { purpose: plan.productionReady ? 'PRODUCTION' : 'REVIEW' });
    const matrix = graph.claims.filter(c => c.requiresVisualProof).map(c => {
        const link = reconciliation.links.find(l => l.claimId === c.id), fact = pack.groundedFacts.find(f => link?.groundedFactIds.includes(f.id)), item = compiled.items.find(i => i.claimIds.includes(c.id)), proof = item?.proof.find(p => p.claimId === c.id)?.proof ?? 'NONE';
        let visualProof: 'DIRECT' | 'NONE' = proof;
        let gap: string | null = plan.localizedGaps.find(g => g.claimIds.includes(c.id))?.reason ?? null;
        // Legacy thermometer proof checks only a finite display. Independently require
        // the actual linked value and entity label to avoid treating another value as DIRECT.
        if (visualProof === 'DIRECT' && fact?.canonicalFact.quantity && item?.sequence) {
            const timing = plan.clauseTiming.find(t => c.clauseIds.includes(t.clauseId))!, state = evaluateDirected(item.sequence, timing.endFrame - item.startFrame - 1).state, expected = Number(fact.canonicalFact.quantity.originalValue.replace(',', '.')), valueVisible = Object.values(state.props).some(p => p.visible && p.parameters.value === expected), labelVisible = item.sequence.shots.some(s => normalize(s.onScreenText ?? '').includes(normalize(fact.canonicalFact.subject)));
            if (!valueVisible || !labelVisible) {
                visualProof = 'NONE';
                gap = !valueVisible ? 'VISUAL_VALUE_MISMATCH' : 'VISUAL_ENTITY_LABEL_MISSING';
            }
        }
        return { claimId: c.id, groundedFactIds: link?.groundedFactIds ?? [], factStatus: fact?.status ?? 'UNSUPPORTED', evidenceCount: link?.evidenceIds.length ?? 0, sourceQuality: pack.sourceAssessments.filter(a => link?.sourceIds.includes(a.sourceId)).map(a => a.grade), visualProof, declaredVisualProof: proof, gap, productionEligible: Boolean(link && fact?.usableForPrimaryClaim && visualProof === 'DIRECT' && !gap), proofScope: fact?.factType === 'MEASUREMENT' ? 'Named numeric display; does not depict the real place or its population' : 'Native process contract or explicit visual gap' };
    });
    // Phase 25: grounded non-physical explanations are listed with declared proof NONE; they are
    // eligible only through their evidence link and never count as visual proof.
    for (const l of reconciliation.links.filter(l => l.nonPhysical)) {
        const fact = pack.groundedFacts.find(f => l.groundedFactIds.includes(f.id));
        matrix.push({ claimId: l.claimId, groundedFactIds: l.groundedFactIds, factStatus: fact?.status ?? 'UNSUPPORTED', evidenceCount: l.evidenceIds.length, sourceQuality: pack.sourceAssessments.filter(a => l.sourceIds.includes(a.sourceId)).map(a => a.grade), visualProof: 'NONE', declaredVisualProof: 'NONE', gap: null, productionEligible: Boolean(fact?.usableForPrimaryClaim), proofScope: 'NON_PHYSICAL_EXPLANATION (' + l.nonPhysical + '): narrated over the continuing demonstration; no visual proof claimed' });
    }
    const issues = [...factual.issues.map(i => i.code), ...reconciliation.issues.map(i => i.code)];
    if (wordCount(candidate.script) < (request.targetWords?.min ?? 110) || wordCount(candidate.script) > (request.targetWords?.max ?? 160))
        issues.push('WORD_BUDGET');
    if (graph.claims.filter(c => c.requiresVisualProof).length > (request.constraints?.maxPrimaryClaims ?? 8))
        issues.push('PRIMARY_BUDGET');
    const factsSafe = factual.passed && reconciliation.passed && !issues.length, visualReady = plan.productionReady && matrix.length > 0 && matrix.every(r => r.productionEligible), n = naturalness(candidate.script), scoreBreakdown = { factualGrounding: reconciliation.metrics.factualClaimCount ? reconciliation.metrics.groundedClaimCount / reconciliation.metrics.factualClaimCount * 30 : 0, qualifierPreservation: reconciliation.metrics.qualifierPreservationRate * 15, semanticClarity: graph.metrics.highConfidenceRate * 15, executableCoverage: plan.coverage.executableTimelineRate * 15, visualProof: matrix.length ? matrix.filter(m => m.visualProof === 'DIRECT').length / matrix.length * 10 : 0, continuity: (1 - Math.min(1, plan.coverage.failedRecoveryCount)) * 5, lowAmbiguity: (1 - Math.min(1, graph.metrics.ambiguityRate)) * 3, lowGapRate: (1 - plan.coverage.gapClaimRate - plan.coverage.blockedDependencyRate) * 3, naturalness: n.naturalness * 2, repetition: (1 - n.repetitionRisk) * 2 };
    const raw = { candidateId: candidate.id, factualPreflight: factual, reconciliation, graph, plan, compiled, matrix, factualReady: factsSafe, visualReady, productionReady: factsSafe && visualReady, masterState: !factsSafe ? 'RESEARCH_INCOMPLETE' as const : visualReady ? 'PRODUCTION_ELIGIBLE' as const : 'SCRIPT_GROUNDED' as const, hardRejections: [...new Set(issues)], quality: { wordCount: wordCount(candidate.script), estimatedDuration: wordCount(candidate.script) / 2.6, ...n, factCoverage: factual.essentialFactCoverage, visualCoverage: matrix.length ? matrix.filter(m => m.visualProof === 'DIRECT').length / matrix.length : 0 }, score: factsSafe ? Object.values(scoreBreakdown).reduce((n, v) => n + v, 0) : -1, scoreBreakdown, fixture: pack.fixture, labels: [...pack.labels], packFingerprint: pack.fingerprint };
    return { ...raw, fingerprint: jsonHash(raw) };
}
export function writeGroundedTopic(request: TopicScriptRequest, pack: EvidencePack, snapshot: CapabilityNode[] = capabilityGraph()) {
    validateRequest(request);
    if (request.factPolicy !== 'GROUNDED_ONLY' || request.sourceMaterial !== undefined)
        throw Error('WRITER_GROUNDED_POLICY only EvidencePack may license facts');
    validateEvidencePack(pack);
    if (normalize(request.topic) !== normalize(pack.topic))
        throw Error('WRITER_GROUNDED_TOPIC pack/topic mismatch');
    const before = pack.fingerprint, profile = buildCapabilityProfile(snapshot), candidates = pack.quality.productionEligibility === 'RESEARCH_READY' ? generateGroundedCandidates(request, pack) : [], preflights = candidates.map(c => preflightGroundedCandidate(request, pack, c, profile.snapshot)), winner = [...preflights].filter(p => p.factualReady).sort((a, b) => b.score - a.score || a.candidateId.localeCompare(b.candidateId, 'en'))[0] ?? null, selected = candidates.find(c => c.id === winner?.candidateId) ?? null, finalPreflight = selected ? preflightGroundedCandidate(request, pack, selected, profile.snapshot) : null;
    if (pack.fingerprint !== before)
        throw Error('WRITER_CHANGED_EVIDENCE_PACK');
    const raw = { version: 'grounded-writer/1.0.0', request: structuredClone(request), packFingerprint: pack.fingerprint, capabilityProfile: profile, candidates, preflights, selectedCandidateId: selected?.id ?? null, finalCandidate: selected, finalPreflight, status: finalPreflight?.masterState ?? 'RESEARCH_INCOMPLETE', fixture: pack.fixture, labels: [...pack.labels], reason: finalPreflight ? 'Factual and visual eligibility evaluated independently; essential facts retained' : 'No admissible facts for all essential research questions; no invented completion' };
    return { ...raw, fingerprint: jsonHash(raw) };
}
export function finalizeGroundedWriter(result: ReturnType<typeof writeGroundedTopic>, pack: EvidencePack, measuredDurations: {
    unitId: string;
    durationSeconds: number;
}[]) { const { fingerprint, ...rawResult } = result; if (jsonHash(rawResult) !== fingerprint || result.packFingerprint !== pack.fingerprint || !result.finalCandidate)
    throw Error('GROUNDED_FINAL provenance/selection'); const ids = result.finalPreflight!.graph.analysis.narrativeUnits.map(u => u.id); if (measuredDurations.length !== ids.length || new Set(measuredDurations.map(t => t.unitId)).size !== ids.length || measuredDurations.some(t => !ids.includes(t.unitId) || !Number.isFinite(t.durationSeconds) || t.durationSeconds <= 0))
    throw Error('GROUNDED_FINAL complete measured timing required'); const p = preflightGroundedCandidate(result.request, pack, result.finalCandidate, result.capabilityProfile.snapshot, measuredDurations), durationSeconds = p.plan.totalFrames / p.plan.fps, target = result.request.targetDurationSeconds ?? { min: 40, max: 60 }, durationPassed = durationSeconds >= target.min && durationSeconds <= target.max, productionReady = p.productionReady && durationPassed; const raw = { version: 'grounded-finalization/1.0.0', writerFingerprint: fingerprint, packFingerprint: pack.fingerprint, finalCandidate: result.finalCandidate, finalPreflight: p, measuredDurations, durationSeconds, durationPassed, productionReady, realWorldProductionEligible: productionReady && !pack.fixture, fixture: pack.fixture, labels: [...pack.labels] }; return { ...raw, fingerprint: jsonHash(raw) }; }
