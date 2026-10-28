import type { SemanticNarrativeGraph } from './narrative-contracts';
import { fail } from '../engine3d/contracts';
import { jsonHash } from '../editorial/fingerprint';
export function validateNarrativeGraph(g: SemanticNarrativeGraph) {
    const { fingerprint: analysisFingerprint, ...analysisData } = g.analysis;
    if (jsonHash(analysisData) !== analysisFingerprint)
        fail('NARRATIVE_ANALYSIS_FINGERPRINT', 'nested analysis changed');
    const { fingerprint, ...raw } = g;
    if (jsonHash(raw) !== fingerprint)
        fail('NARRATIVE_GRAPH_FINGERPRINT', 'graph changed');
    const span = (s: {
        start: number;
        end: number;
        text: string;
    }) => Number.isInteger(s.start) && Number.isInteger(s.end) && s.start >= 0 && s.end > s.start && s.end <= g.script.length && g.script.slice(s.start, s.end) === s.text;
    for (const rows of [g.entities, g.mentions, g.references, g.events, g.claims, g.segments, g.dependencies]) {
        if (new Set(rows.map(r => r.id)).size !== rows.length)
            fail('NARRATIVE_IDS', 'duplicate identity');
        if (rows.some(r => !span(r.sourceSpan)))
            fail('NARRATIVE_SPAN', 'invalid source span');
    }
    if (g.clauses.map(c => c.sourceSpan.text).join('') !== g.script)
        fail('NARRATIVE_CLAUSES', 'clause partition changed source');
    for (const r of g.references) {
        if (r.kind === 'EVENT_REFERENCE' && r.selectedEntityId)
            fail('NARRATIVE_REFERENCE', 'event confused with entity');
        if (r.selectedEventId && !g.events.some(e => e.id === r.selectedEventId))
            fail('NARRATIVE_REFERENCE', 'missing event');
        if (r.selectedEntityId && !g.entities.some(e => e.id === r.selectedEntityId))
            fail('NARRATIVE_REFERENCE', 'missing entity');
        if (r.confidence === 'AMBIGUOUS' && (r.selectedEntityId || r.selectedEventId))
            fail('NARRATIVE_REFERENCE', 'ambiguity promoted');
    }
    if (g.claims.some(c => c.requiresVisualProof && c.confidence === 'HIGH' && c.status !== 'RESOLVED'))
        fail('NARRATIVE_CONFIDENCE', 'unresolved fact promoted');
    if (g.dependencies.some(d => !g.claims.some(c => c.id === d.fromClaimId) || !g.claims.some(c => c.id === d.toClaimId)))
        fail('NARRATIVE_DEPENDENCY', 'dangling claim edge');
    for(const context of g.analysis.contexts){if(context.pendingReferences.some(id=>!g.analysis.references.some(r=>r.id===id))||context.currentProcess&&!g.events.some(e=>e.id===context.currentProcess))fail('NARRATIVE_CONTEXT','context points to stale identifiers');}
    return { passed: true, sourceSpans: true, clauseCoverage: true, uniqueIds: true, referenceKinds: true };
}
