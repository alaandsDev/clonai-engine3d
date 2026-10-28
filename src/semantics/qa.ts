import type { SemanticAnalysis, SourceSpan } from './contracts';
import { fail } from '../engine3d/contracts';
export function semanticQa(a: SemanticAnalysis) {
    const valid = (s: SourceSpan) => Number.isInteger(s.start) && Number.isInteger(s.end) && s.start >= 0 && s.end > s.start && s.end <= a.script.length && a.script.slice(s.start, s.end) === s.text;
    const spanObjects = [...a.narrativeUnits, ...a.entities, ...a.mentions, ...a.references, ...a.predicates, ...a.quantities, ...a.relations, ...a.claims, ...a.ambiguities];
    if (spanObjects.some(x => !valid(x.sourceSpan)) || [...a.claims, ...a.relations].some(x => !x.sourceEvidence.length || x.sourceEvidence.some(s => !valid(s))))
        fail('SEMANTIC_SPAN', 'Invalid source provenance');
    if (a.narrativeUnits.map(u => u.sourceSpan.text).join('') !== a.script)
        fail('SEMANTIC_COVERAGE', 'source changed');
    const entities = new Set(a.entities.map(e => e.id)), references = new Set(a.references.map(r => r.id)), relations = new Set(a.relations.map(r => r.id));
    if (a.claims.some(c => c.entityIds.some(id => !entities.has(id)) || c.referenceIds.some(id => !references.has(id)) || c.relationIds.some(id => !relations.has(id))))
        fail('SEMANTIC_LINK', 'dangling semantic link');
    if (a.claims.some(c => c.confidence === 'HIGH' && (c.status !== 'RESOLVED' || c.ambiguityIds.length)))
        fail('SEMANTIC_CONFIDENCE', 'unresolved claim promoted');
    return { passed: true, sourceSpans: true, sourceCoverage: true, links: true, noHighAmbiguousClaim: true };
}
