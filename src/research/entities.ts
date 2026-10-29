import { jsonHash } from '../editorial/fingerprint';
import { normalize } from '../semantics/normalize';
import { sourceSpan } from './source';
import { sourceLocators } from './origins';
import type { AliasCandidate, DocumentContextSummary, EntityGraph, EntityRelationType, Evidence, FactCandidate, SourceDocument } from './contracts';
// Phase 22 EntityGraph. Observation sites (stations) and places stay separate nodes; a relation between them must be
// stated by a source (wording or a data attribution citing the station's own document), never inferred from a name.
export const ENTITY_GRAPH_VERSION = 'entity-graph/1.0.0';
export const entityKey = (name: string, kind?: string) => normalize(name).replace(/\s+/g, ' ').trim() + (kind === 'STATION' ? '|station' : '');
const nodeId = (key: string) => 'EN_' + jsonHash(key).slice(0, 16);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const tokens = (s: string) => new Set(normalize(s).split(/[^a-z0-9]+/).filter(t => t.length >= 3));
export function buildEntityGraph(sources: SourceDocument[], candidates: FactCandidate[], evidence: Evidence[], contexts: DocumentContextSummary[], aliases: AliasCandidate[]): EntityGraph {
    const nodes = new Map<string, EntityGraph['nodes'][number]>(), edges: EntityGraph['edges'] = [];
    const node = (name: string, kind: 'STATION' | 'SETTLEMENT' | 'PLACE', sourceId: string | null, why: string) => { const key = entityKey(name, kind === 'STATION' ? 'STATION' : undefined), id = nodeId(key), old = nodes.get(id); if (old) {
        if (sourceId && !old.sourceIds.includes(sourceId))
            old.sourceIds.push(sourceId);
        if (kind === 'SETTLEMENT' && old.kind === 'PLACE')
            old.kind = 'SETTLEMENT';
        if (!old.kindEvidence.includes(why))
            old.kindEvidence.push(why);
        return old;
    } const n = { id, name, kind, sourceIds: sourceId ? [sourceId] : [], kindEvidence: [why] }; nodes.set(id, n); return n; };
    const edge = (from: string, to: string, relation: EntityRelationType, sourceId: string | null, span: Evidence['sourceSpan'] | null, reason: string) => { if (from === to)
        return; const raw = { from, to, relation, sourceId, span, reason }; edges.push({ id: 'EE_' + jsonHash(raw).slice(0, 16), ...raw }); };
    const byEvidence = new Map(evidence.map(e => [e.id, e]));
    for (const c of [...candidates].sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
        const e = byEvidence.get(c.evidenceIds[0]);
        node(c.canonicalFact.subject, c.canonicalFact.subjectKind === 'STATION' ? 'STATION' : 'PLACE', e?.sourceId ?? null, c.canonicalFact.subjectKind === 'STATION' ? 'Fact subject from an observation-site label/heading' : 'Fact subject');
    }
    for (const ctx of [...contexts].sort((a, b) => a.sourceId.localeCompare(b.sourceId, 'en'))) {
        if (ctx.resolved)
            node(ctx.resolved.name, ctx.resolved.entityKind, ctx.sourceId, 'Document context ' + ctx.resolved.sourceKinds.join('+'));
        for (const c of ctx.candidates.filter(c => c.sourceKind === 'LEAD' && c.sourceSpan && /\b(?:town|city|village|hamlet|settlement|locality|municipality|community)\b/i.test(c.sourceSpan.text)))
            node(c.text, 'SETTLEMENT', ctx.sourceId, 'Lead states a populated place');
    }
    const places = [...nodes.values()].filter(n => n.kind !== 'STATION'), stations = [...nodes.values()].filter(n => n.kind === 'STATION');
    // Data attribution: a place's measurement whose citation is the station's own document, with overlapping names.
    const stationDoc = new Map<string, { node: EntityGraph['nodes'][number]; sourceId: string }>();
    for (const ctx of contexts.filter(c => c.resolved?.entityKind === 'STATION').sort((a, b) => a.sourceId.localeCompare(b.sourceId, 'en'))) {
        const s = sources.find(x => x.id === ctx.sourceId), n = nodes.get(nodeId(entityKey(ctx.resolved!.name, 'STATION')));
        if (s && n)
            for (const l of sourceLocators(s))
                stationDoc.set(l, { node: n, sourceId: s.id });
    }
    for (const e of evidence.filter(e => e.evidenceType === 'MEASUREMENT' && e.supports.subjectKind !== 'STATION'))
        for (const u of e.citations ?? []) {
            const st = stationDoc.get(u), place = nodes.get(nodeId(entityKey(e.supports.subject)));
            if (!st || !place || ![...tokens(st.node.name)].some(t => tokens(place.name).has(t)))
                continue;
            edge(st.node.id, place.id, 'OBSERVATION_SITE_FOR', e.sourceId, e.structured?.captionSpan ?? e.sourceSpan, 'Measurement data for "' + place.name + '" is attributed to the document of observation site "' + st.node.name + '" (' + u + ')');
        }
    // Explicit wording between known entities only.
    for (const s of [...sources].sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
        const t = s.normalized.text;
        for (const st of stations)
            for (const p of places) {
                if (!t.includes(st.name) || !t.includes(p.name))
                    continue;
                for (const [re, relation] of [[new RegExp(escape(st.name) + '[^.\\n]{0,60}?\\b(?:serves|is the (?:official )?(?:weather |climate )?(?:station|observing site) for)\\s+' + escape(p.name), 'i'), 'OBSERVATION_SITE_FOR'], [new RegExp(escape(st.name) + '[^.\\n]{0,60}?\\b(?:near|close to|\\d+(?:\\.\\d+)?\\s?km (?:from|of))\\s+(?:the\\s+)?' + escape(p.name), 'i'), 'NEAR']] as const) {
                    const m = re.exec(t);
                    if (m)
                        edge(st.id, p.id, relation, s.id, sourceSpan(s, m.index, m.index + m[0].length), relation === 'NEAR' ? 'Explicit proximity wording; proximity never makes the same entity' : 'Explicit service wording');
                }
            }
        for (const p of places) {
            const m = new RegExp('\\b' + escape(p.name) + '\\b[^.\\n]{0,40}?\\bis an? (?:[\\w-]+ ){0,3}(?:village|town|hamlet|settlement|locality|municipality|community|city) in (?:the )?([\\p{Lu}][\\p{L}\\p{M}\' -]{1,60}?)(?=[,.;(]|$)', 'u').exec(t);
            if (m) {
                const container = node(m[1].trim(), 'PLACE', s.id, 'Container named by a LOCATED_IN statement');
                edge(p.id, container.id, 'LOCATED_IN', s.id, sourceSpan(s, m.index, m.index + m[0].length), 'Explicit "is a … in" statement');
            }
        }
    }
    for (const a of aliases.filter(a => a.status === 'CONFIRMED_ALIAS')) {
        const x = nodes.get(nodeId(entityKey(a.name))), y = nodes.get(nodeId(entityKey(a.alias)));
        if (x && y)
            edge(y.id, x.id, 'ALIAS_OF', a.sourceId, a.sourceSpan, a.reason);
    }
    const raw = { version: ENTITY_GRAPH_VERSION, nodes: [...nodes.values()].map(n => ({ ...n, sourceIds: [...n.sourceIds].sort(), kindEvidence: [...n.kindEvidence].sort() })).sort((a, b) => a.id.localeCompare(b.id, 'en')), edges: edges.filter((e, i) => edges.findIndex(x => x.id === e.id) === i).sort((a, b) => a.id.localeCompare(b.id, 'en')) };
    return { ...raw, fingerprint: jsonHash(raw) };
}
/** Observation sites that may stand for a place under the policy: source-backed OBSERVATION_SITE_FOR or SAME_ENTITY only. */
export function observationSites(graph: EntityGraph, policy: 'SAME_ENTITY_ONLY' | 'SOURCED_OBSERVATION_SITE' | undefined): Map<string, { stationKey: string; edgeId: string }[]> {
    const out = new Map<string, { stationKey: string; edgeId: string }[]>(), byId = new Map(graph.nodes.map(n => [n.id, n]));
    for (const e of graph.edges.filter(e => e.relation === 'SAME_ENTITY' || policy === 'SOURCED_OBSERVATION_SITE' && e.relation === 'OBSERVATION_SITE_FOR')) {
        const from = byId.get(e.from)!, to = byId.get(e.to)!;
        if (from.kind !== 'STATION' || to.kind === 'STATION')
            continue;
        const k = entityKey(to.name);
        out.set(k, [...(out.get(k) ?? []), { stationKey: entityKey(from.name, 'STATION'), edgeId: e.id }]);
    }
    return out;
}
/** Algorithmic transliteration similarity: a candidate for review, never a confirmation. */
export function transliterationKey(name: string) { return normalize(name).replace(/kh/g, 'h').replace(/[yji]/g, 'i').replace(/(.)\1+/g, '$1').replace(/[^a-z]/g, ''); }
