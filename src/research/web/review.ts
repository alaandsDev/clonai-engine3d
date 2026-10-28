import type { EvidencePack } from '../contracts';
import type { ResearchSession } from './contracts';
// Review artifacts display untrusted source data as escaped text; no active HTML/media is embedded.
export const reviewData = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([\\`*_[\]!|])/g, '\\$1').replace(/\s+/g, ' ');
const link = (url: string) => '<' + encodeURI(url).replace(/[<>()]/g, encodeURIComponent) + '>';
const fact = (p: EvidencePack, id: string) => { const f = p.groundedFacts.find(f => f.id === id); return f ? reviewData(f.canonicalFact.subject) + ' · ' + f.factType + (f.canonicalFact.quantity ? ' ' + f.canonicalFact.quantity.originalValue + ' ' + f.canonicalFact.quantity.originalUnit : '') + (f.canonicalFact.residency ? ' ' + f.canonicalFact.residency : '') + ' [' + f.qualifiers.join(', ') + '] → ' + f.status : id; };
export function sourceGraphReview(session: ResearchSession, label: string) {
    const p = session.EvidencePack, g = p.v2!.sourceGraph, name = (id: string) => { const s = p.sources.find(s => s.id === id); return s ? reviewData(s.title) + ' (' + s.sourceType + ', ' + reviewData(new URL(s.canonicalLocator).hostname) + ')' : id; };
    const out = ['# Source graph — ' + label, '', 'Graph fingerprint `' + g.fingerprint + '`; ' + g.nodes.length + ' sources, ' + p.v2!.originGroups.length + ' origin groups, ' + g.edges.length + ' relations. Relations come from snapshots only; UNKNOWN_RELATION means no relation was detectable, not that independence was proven.', '', '## Origin groups', ''];
    for (const og of p.v2!.originGroups)
        out.push('- `' + og.id + '` (' + (og.reasons.join(', ') || 'single source') + '): ' + og.sourceIds.map(name).join('; '));
    out.push('', '## Source relations', '');
    for (const e of g.edges.filter(e => !e.factId))
        out.push(name(e.from), ' └─ ' + e.relation + ' → ' + name(e.to), '');
    out.push('## Fact origins', '');
    for (const f of p.groundedFacts) {
        const edges = g.edges.filter(e => e.factId === f.id);
        if (!edges.length)
            continue;
        out.push('### ' + fact(p, f.id), '');
        for (const e of edges)
            out.push(e.relation === 'PRIMARY_ORIGIN' ? '- ' + name(e.from) + ' └─ PRIMARY_ORIGIN of ' + f.id + ' (evidence ' + e.evidenceIds.join(', ') + ')' : '- ' + name(e.from) + ' └─ ' + e.relation + ' → ' + name(e.to) + ' — ' + reviewData(e.reason));
        out.push('');
    }
    out.push('## Discovery provenance', '');
    for (const s of p.sources) {
        const d = s.provenance.discovery, ref = session.v2?.references.find(r => d?.referenceIds?.includes(r.id));
        out.push('- ' + name(s.id) + ': via ' + (d?.via ?? 'SEARCH_RESULT') + (d?.strategy ? ' / ' + d.strategy : '') + (ref ? ' from reference `' + ref.id + '` in ' + name(ref.sourceId) + ' (anchor "' + reviewData(ref.anchorText) + '")' : d?.queryIds.length ? ' from queries ' + d.queryIds.join(', ') : '') + ' — ' + link(s.canonicalLocator));
    }
    return out.join('\n') + '\n';
}
export function corroborationReview(session: ResearchSession, label: string) {
    const p = session.EvidencePack, out = ['# Corroboration — ' + label, '', 'Independent = the evidence is a root of its own origin group after removing derived evidence (citing/reporting another supporting source) and merging shared citations. Policy: ' + reviewData(JSON.stringify(p.researchPlan.policy.factTypeQuorum ?? { minIndependentSources: p.researchPlan.policy.minIndependentSources })), ''];
    for (const f of p.groundedFacts) {
        out.push('## ' + fact(p, f.id), '', 'Admission: ' + reviewData(f.origins?.admission ?? '') + '; independent origin roots ' + f.independentOriginCount + '; conflicts ' + (f.conflicts.join(', ') || 'none') + '; primary evidence ' + (f.origins?.primaryEvidenceId ?? 'none'), '', '| Evidence | Source | OriginGroup | Relation | Independent? | Status |', '|---|---|---|---|---|---|');
        for (const id of f.evidenceIds) {
            const e = p.evidence.find(e => e.id === id)!, s = p.sources.find(s => s.id === e.sourceId)!, root = f.origins?.roots.findIndex(r => r.includes(id)) ?? -1, derived = f.origins?.derivedEvidenceIds.includes(id), quality = p.sourceAssessments.find(a => a.sourceId === s.id)?.grade;
            const relation = derived ? p.v2!.sourceGraph.edges.filter(x => x.factId === f.id && x.evidenceIds.includes(id) && x.relation !== 'PRIMARY_ORIGIN').map(x => x.relation + '→' + x.to).join(', ') : root >= 0 ? 'ROOT ' + (root + 1) + (f.origins!.roots[root].length > 1 ? ' (merged: shared group/citation)' : '') : 'NOT_COUNTED quality ' + quality;
            out.push('| `' + id + '` | ' + reviewData(s.title) + ' (' + s.sourceType + ', ' + quality + ') | `' + (e.originGroupId ?? '') + '` | ' + relation + ' | ' + (root >= 0 && !derived ? 'YES' : 'NO') + ' | ' + f.status + ' |');
        }
        out.push('');
    }
    return out.join('\n') + '\n';
}
export function structuredReview(session: ResearchSession, label: string) {
    const p = session.EvidencePack, out = ['# Structured extraction — ' + label, '', 'Every value below is an exact snapshot span. Rejected structures abstain with the listed reason; first-column position never implies the subject.', '', '## Structures', '', '| Source | Structure | Status | Reason | Rows×Cols | Caption | Evidence |', '|---|---|---|---|---|---|---|'];
    for (const st of p.v2!.structures)
        out.push('| `' + st.sourceId + '` | ' + st.kind + '#' + st.index + ' | ' + st.status + ' | ' + reviewData(st.reason) + ' | ' + st.rows + '×' + st.columns + ' | ' + reviewData(st.caption ?? '') + ' | ' + st.evidenceIds.length + ' |');
    out.push('', '## Extracted values', '', '| Source | Table/list/field | Row | Column | Header | Raw value | Normalized fact | Evidence span |', '|---|---|---|---|---|---|---|---|');
    for (const e of p.evidence.filter(e => e.structured)) {
        const s = e.structured!, f = e.supports;
        out.push('| ' + reviewData(p.sources.find(x => x.id === e.sourceId)!.title) + ' | ' + s.kind + '#' + s.structureIndex + ' | ' + s.row + ' | ' + s.column + ' | ' + reviewData([s.columnHeader, s.rowHeader].filter(Boolean).join(' / ')) + ' | ' + reviewData(e.normalizedText.slice(0, 80)) + ' | ' + reviewData(f.subject + ' ' + f.factType + ' ' + (f.quantity ? f.quantity.originalValue + ' ' + f.quantity.originalUnit + ' (' + f.quantity.conversionRule + ')' : f.residency ?? '') + ' [' + f.qualifiers.join(', ') + ']' + (f.temporalContext ? ' @' + f.temporalContext : '') + (f.observationPeriod ? ' period ' + f.observationPeriod : '')) + ' | ' + e.sourceSpan.start + '–' + e.sourceSpan.end + ' |');
    }
    return out.join('\n') + '\n';
}
