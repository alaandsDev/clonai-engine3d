import type { SemanticAnalysis, SemanticClaim } from './contracts';
import { ADAPTER_VERSION } from './contracts';
import type { AutoDirectorInput, ExplicitClaim, ClaimExtraction } from '../autodirector/contracts';
import { jsonHash } from '../editorial/fingerprint';
import { semanticQa } from './qa';
import { fail } from '../engine3d/contracts';
export interface AdapterOptions {
    fps?: number;
    canvas?: {
        width: number;
        height: number;
    };
    mode?: 'SEMANTIC_PLAN_ONLY' | 'SEMANTIC_STRICT';
    constraints?: AutoDirectorInput['constraints'];
    measuredDurations?: AutoDirectorInput['measuredDurations'];
}
export function toAutoDirectorInput(a: SemanticAnalysis, options: AdapterOptions = {}): AutoDirectorInput {
    const { fingerprint, ...raw } = a;
    if (jsonHash(raw) !== fingerprint)
        fail('SEMANTIC_FINGERPRINT', 'analysis changed');
    semanticQa(a);
    const physicalSubjects = new Set(a.claims.filter(c => c.requiresVisualProof && ['ACCUMULATE', 'COVER', 'FREEZE'].includes(c.predicate)).map(c => c.subjectEntityId));
    const unitIndex = (id: string) => a.narrativeUnits.findIndex(u => u.id === id);
    function adapt(c: SemanticClaim): ExplicitClaim {
        const subject = a.entities.find(e => e.id === c.subjectEntityId), related = a.entities.filter(e => c.entityIds.includes(e.id));
        const inUnitPredicates = a.predicates.filter(p => p.unitId === c.unitId), level = subject?.semanticTags.includes('level');
        const liquid = Boolean(subject?.semanticTags.includes('liquid') || (level && inUnitPredicates.some(p => a.entities.find(e => e.id === p.subjectEntityId)?.semanticTags.includes('liquid'))));
        const tags: string[] = [];
        let safety: ClaimExtraction['visualSafety'] = 'SAFE', reason = 'Resolved textual proposition; supported semantic-to-visual pattern';
        if (liquid)
            tags.push('liquid');
        if (['FLOW', 'ENTER', 'RISE', 'EXIT'].includes(c.predicate) && liquid)
            tags.push('transfer');
        if (c.predicate === 'RISE')
            tags.push('upward');
        if (c.predicate === 'INCREASE' && level)
            tags.push('fill');
        if (c.predicate === 'STORE' && liquid)
            tags.push('storage');
        if (subject?.semanticTags.includes('vehicle') && ['ACCUMULATE', 'COVER', 'FREEZE'].includes(c.predicate))
            tags.push('freezable');
        if (subject?.semanticTags.includes('scientific_crowd') || related.some(e => e.semanticTags.includes('scientific_crowd')))
            tags.push('scientific_crowd');
        if (c.type === 'TEMPERATURE')
            tags.push('temperature');
        if (c.type === 'NUMBER')
            tags.push('number');
        if (c.type === 'RANKING')
            tags.push('ranking');
        if (c.type === 'COMPARISON')
            tags.push('comparison');
        if (c.interrogative) {
            tags.push('question');
            safety = 'EDITORIAL';
            reason = 'Interrogative preserved as question, never asserted physical state';
        }
        else if (!c.requiresVisualProof) {
            safety = 'EDITORIAL';
            reason = 'Supporting context retained as source, without claiming DIRECT proof';
        }
        else if (c.status !== 'RESOLVED' || c.ambiguityIds.length || c.confidence === 'LOW') {
            safety = 'ABSTAIN';
            reason = 'Unresolved, ambiguous or low-confidence source proposition';
        }
        else if (c.negated || c.modality !== 'ASSERTED') {
            safety = 'ABSTAIN';
            reason = 'Negation/modality cannot be executed as an asserted positive demonstration';
        }
        else if (tags.includes('freezable') && (c.stateTransition?.process !== 'ACCUMULATE ICE' || c.stateTransition.final !== 'COVERED')) {
            safety = 'ABSTAIN';
            reason = 'The existing completed-freezing template would invent a final state not evidenced by this claim chain';
        }
        else if (c.type === 'CAUSE_EFFECT' || c.type === 'QUANTITY_CHANGE' && a.quantities.some(q => c.quantityIds.includes(q.id) && q.dimension === 'TEMPERATURE') || ['FREEZE', 'MELT'].includes(c.predicate) && liquid || physicalSubjects.size > 1 && tags.includes('freezable')) {
            safety = 'ABSTAIN';
            reason = 'Text understood, but this exact relation/subject transition lacks an adequate existing visual template';
        }
        const window = [...c.executionUnitIds].sort((x, y) => unitIndex(x) - unitIndex(y));
        const extraction: ClaimExtraction = { extractionSource: 'SEMANTIC_ENGINE', producerVersion: ADAPTER_VERSION, analysisFingerprint: a.fingerprint, confidence: c.confidence, status: c.status, sourceEvidence: c.sourceEvidence, entityIds: c.entityIds, relationIds: c.relationIds, referenceIds: c.referenceIds, ambiguityIds: c.ambiguityIds, previousClaimIds: c.previousClaimIds, nextClaimIds: c.nextClaimIds, semanticTags: [...new Set(tags)].sort(), negated: c.negated, modality: c.modality, interrogative: c.interrogative, visualSafety: safety, reason, executionWindow: { firstUnitId: window[0], lastUnitId: window.at(-1)! } };
        return { id: c.id, text: c.text, type: !c.requiresVisualProof && !c.interrogative ? 'CONCLUSION' : c.type, startOffset: c.sourceSpan.start, endOffset: c.sourceSpan.end, importance: c.importance, requiresVisualProof: c.requiresVisualProof, extraction };
    }
    const claims = a.claims.map(adapt);
    // A deduplicated claim can cite later units. Cover them explicitly so the legacy heuristic
    // extractor cannot re-interpret their pronouns without semantic context.
    for (const u of a.narrativeUnits.filter(u => !claims.some(c => c.startOffset >= u.sourceSpan.start && c.endOffset <= u.sourceSpan.end))) {
        const owner = claims.find(c => c.extraction!.sourceEvidence.some(s => s.start <= u.sourceSpan.start && s.end >= u.sourceSpan.end));
        if (!owner)
            fail('SEMANTIC_ADAPTER', 'unit lacks semantic evidence');
        claims.push({ ...structuredClone(owner!), id: 'context_' + u.id, text: u.sourceSpan.text.trim(), type: 'CONCLUSION', startOffset: u.sourceSpan.start, endOffset: u.sourceSpan.end, importance: 'SUPPORTING', requiresVisualProof: false, extraction: { ...structuredClone(owner!.extraction!), visualSafety: 'EDITORIAL', reason: 'Evidence-only continuation of deduplicated claim; no independent asserted proof' } });
    }
    if (options.mode === 'SEMANTIC_STRICT' && claims.some(c => c.importance === 'PRIMARY' && c.extraction!.visualSafety === 'ABSTAIN' && (c.extraction!.status !== 'RESOLVED' || c.extraction!.confidence === 'LOW')))
        fail('SEMANTIC_STRICT', 'critical semantic ambiguity/abstention');
    return { version: 1, id: a.id, language: a.language, format: 'vertical_short', fps: options.fps ?? 30, canvas: options.canvas ?? { width: 480, height: 854 }, script: a.script, claims, constraints: options.constraints ?? { mode: 'PLAN_ONLY' }, ...(options.measuredDurations ? { measuredDurations: options.measuredDurations } : {}) };
}
