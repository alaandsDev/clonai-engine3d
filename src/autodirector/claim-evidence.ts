import type { ClaimExtraction, NarrativeUnit } from './contracts';
import { fields, list, text } from '../engine3d/schema';
import { fail } from '../engine3d/contracts';
export function validateClaimExtraction(e: ClaimExtraction, script: string, units: NarrativeUnit[]) {
    fields(e, ['extractionSource', 'producerVersion', 'analysisFingerprint', 'confidence', 'status', 'sourceEvidence', 'entityIds', 'relationIds', 'referenceIds', 'ambiguityIds', 'previousClaimIds', 'nextClaimIds', 'semanticTags', 'negated', 'modality', 'interrogative', 'visualSafety', 'reason', 'executionWindow'], 'ClaimExtraction');
    if (e.extractionSource !== 'SEMANTIC_ENGINE' || !['HIGH', 'MEDIUM', 'LOW'].includes(e.confidence) || !['RESOLVED', 'UNRESOLVED', 'AMBIGUOUS'].includes(e.status) || !['ASSERTED', 'POSSIBLE', 'HYPOTHETICAL', 'UNCERTAIN'].includes(e.modality) || !['SAFE', 'ABSTAIN', 'EDITORIAL'].includes(e.visualSafety) || typeof e.negated !== 'boolean' || typeof e.interrogative !== 'boolean')
        fail('AUTO_EXTRACTION', 'invalid evidence contract');
    text(e.producerVersion, 'producer');
    text(e.analysisFingerprint, 'analysis fingerprint');
    text(e.reason, 'reason');
    for (const key of ['entityIds', 'relationIds', 'referenceIds', 'ambiguityIds', 'previousClaimIds', 'nextClaimIds', 'semanticTags'] as const) {
        list(e[key], key);
        e[key].forEach(s => text(s, key));
    }
    list(e.sourceEvidence, 'sourceEvidence');
    if (!e.sourceEvidence.length)
        fail('AUTO_EXTRACTION', 'evidence required');
    for (const span of e.sourceEvidence) {
        fields(span, ['start', 'end', 'text'], 'sourceSpan');
        if (!Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start < 0 || span.end <= span.start || span.end > script.length || script.slice(span.start, span.end) !== span.text)
            fail('AUTO_EXTRACTION', 'invalid source span');
    }
    fields(e.executionWindow, ['firstUnitId', 'lastUnitId'], 'executionWindow');
    const first = units.findIndex(u => u.id === e.executionWindow.firstUnitId), last = units.findIndex(u => u.id === e.executionWindow.lastUnitId);
    if (first < 0 || last < first)
        fail('AUTO_EXTRACTION', 'invalid evidence timeline');
    if (e.visualSafety === 'SAFE' && (e.status !== 'RESOLVED' || e.confidence === 'LOW' || e.negated || e.modality !== 'ASSERTED' || e.interrogative || e.ambiguityIds.length))
        fail('AUTO_EXTRACTION', 'unsafe claim promoted');
}
