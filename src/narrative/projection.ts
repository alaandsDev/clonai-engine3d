import type { SemanticNarrativeGraph, NarrativeClaim } from '../semantics/narrative-contracts';
import type { AutoDirectorInput, ExplicitClaim, ClaimExtraction } from '../autodirector/contracts';
import type { ClauseTiming, NarrativeOptions } from './contracts';
import { segmentScript } from '../autodirector/claims';
import { sourceSpan } from '../semantics/normalize';
import { jsonHash } from '../editorial/fingerprint';
export const NARRATIVE_ADAPTER_VERSION = 'narrative-claim-adapter/1.0.0';
export function projectIsland(graph: SemanticNarrativeGraph, clauseIds: string[], timing: ClauseTiming[], options: NarrativeOptions, id: string): AutoDirectorInput {
    const clauses = graph.clauses.filter(c => clauseIds.includes(c.id)), start = clauses[0].sourceSpan.start, end = clauses.at(-1)!.sourceSpan.end, script = graph.script.slice(start, end), cs = graph.claims.filter(c => c.clauseIds.some(id => clauseIds.includes(id))), fps = options.fps ?? 30;
    const base: AutoDirectorInput = { version: 1, id, language: graph.analysis.language, format: 'vertical_short', fps, canvas: options.canvas ?? { width: 480, height: 854 }, script, constraints: { mode: 'PLAN_ONLY' } };
    const units = segmentScript(base), localUnit = (offset: number) => units.find(u => offset >= u.startOffset && offset < u.endOffset)?.id ?? units.at(-1)!.id;
    const unitAt = (c: NarrativeClaim) => localUnit(c.sourceSpan.start - start), firstTransfer = cs.find(c => c.requiresVisualProof && c.semanticTags.includes('transfer')), lastTransfer = cs.filter(c => c.requiresVisualProof && c.semanticTags.includes('transfer')).at(-1);
    const firstAccum = cs.find(c => c.requiresVisualProof && c.predicate === 'ACCUMULATE'), lastCover = cs.filter(c => c.requiresVisualProof && c.predicate === 'COVER').at(-1);
    const claims: ExplicitClaim[] = cs.map(c => {
        let first = unitAt(c), last = first;
        if (c.semanticTags.includes('transfer') && firstTransfer && lastTransfer) {
            first = unitAt(firstTransfer);
            last = unitAt(lastTransfer);
        }
        if (c.semanticTags.includes('freezable') && firstAccum && lastCover) {
            first = unitAt(firstAccum);
            last = unitAt(lastCover);
        }
        const evidence = c.sourceEvidence.filter(s => s.start >= start && s.end <= end).map(s => ({ start: s.start - start, end: s.end - start, text: s.text }));
        if (!evidence.length)
            evidence.push({ start: c.sourceSpan.start - start, end: c.sourceSpan.end - start, text: c.sourceSpan.text });
        const safe: ClaimExtraction['visualSafety'] = !c.requiresVisualProof ? 'EDITORIAL' : c.blockedReason ? 'ABSTAIN' : 'SAFE';
        const extraction: ClaimExtraction = { extractionSource: 'SEMANTIC_ENGINE', producerVersion: NARRATIVE_ADAPTER_VERSION, analysisFingerprint: graph.fingerprint, confidence: c.confidence, status: c.status, sourceEvidence: evidence, entityIds: c.entityIds, relationIds: c.relationIds, referenceIds: c.referenceIds, ambiguityIds: c.ambiguityIds, previousClaimIds: c.previousClaimIds, nextClaimIds: c.nextClaimIds, semanticTags: c.semanticTags, negated: c.negated, modality: c.modality, interrogative: c.interrogative, visualSafety: safe, reason: c.blockedReason ?? 'Narrative graph claim projected into a bounded execution island; global provenance retained by the island', executionWindow: { firstUnitId: first, lastUnitId: last } };
        return { id: c.id, text: c.text, type: c.type, startOffset: c.sourceSpan.start - start, endOffset: c.sourceSpan.end - start, importance: c.importance, requiresVisualProof: c.requiresVisualProof, extraction };
    });
    const measuredDurations = units.map(u => { const a = start + u.startOffset, b = start + u.endOffset, duration = timing.filter(t => clauseIds.includes(t.clauseId)).reduce((n, t) => { const cl = graph.clauses.find(c => c.id === t.clauseId)!; const overlap = Math.max(0, Math.min(b, cl.sourceSpan.end) - Math.max(a, cl.sourceSpan.start)); return n + (t.endFrame - t.startFrame) * overlap / (cl.sourceSpan.end - cl.sourceSpan.start); }, 0); return { unitId: u.id, durationSeconds: Math.round(duration) / fps }; });
    return { ...base, claims, measuredDurations };
}
