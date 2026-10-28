import type { Predicate, Reference, NormalizedQuantity, Confidence } from './contracts';
import { confidenceWeights as w, confidenceThresholds as thresholds } from './rules';
export function confidence(predicates: Predicate[], references: Reference[], quantities: NormalizedQuantity[], subject: string | null, ambiguous: boolean) {
    const breakdown: Record<string, number> = { textualEvidence: w.textualEvidence, explicitPredicate: predicates.some(p => p.name !== 'UNKNOWN') ? w.explicitPredicate : 0, clearSubject: subject ? w.clearSubject : w.unknownSubject, clearObject: predicates.some(p => p.objectEntityIds.length) ? w.clearObject : 0, quantity: quantities.length ? w.quantity : 0, highReference: references.some(r => r.confidence === 'HIGH') ? w.highReference : 0, mediumReference: references.some(r => r.confidence === 'MEDIUM') ? w.mediumReference : 0, ambiguousReference: ambiguous ? w.ambiguousReference : 0, unsupportedPredicate: predicates.some(p => p.name === 'UNKNOWN') ? w.unsupportedPredicate : 0 };
    const score = Math.round(Math.max(0, Math.min(1, Object.values(breakdown).reduce((a, b) => a + b, 0))) * 1000) / 1000;
    const level: Confidence = ambiguous ? 'LOW' : score >= thresholds.HIGH ? 'HIGH' : score >= thresholds.MEDIUM ? 'MEDIUM' : 'LOW';
    return { score, level, breakdown };
}
