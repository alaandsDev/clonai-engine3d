import { jsonHash } from '../editorial/fingerprint';
import { normalize } from '../semantics/normalize';
import { canonicalUrl } from './web/security';
import { sourceSpan } from './source';
import { attributes, hostOf, jsonLdSummary, parseHtmlStructures } from './structured';
import type { AliasCandidate, Evidence, OriginGroup, OriginRelation, SourceDocument, SourceGraph, SourceQualityAssessment } from './contracts';
// Phase 21 SourceGraph. Relations are detected from snapshots only; an undetectable relation is UNKNOWN_RELATION,
// never proof of independence beyond what the snapshots show.
export const SOURCE_GRAPH_VERSION = 'source-graph/1.0.0';
const SECOND_LEVEL = new Set(['co', 'com', 'gov', 'ac', 'edu', 'org', 'net', 'gob', 'go', 'or', 'ne', 'mil', 'govt', 'nic', 'gv', 'gouv']);
/** Approximate registrable domain without a public-suffix list: last two labels, or three under common second-level labels of a two-letter TLD. */
export function registrableDomain(host: string) { const labels = host.toLowerCase().replace(/\.$/, '').split('.'); if (labels.length <= 2)
    return labels.join('.'); return labels.slice(labels.at(-1)!.length === 2 && SECOND_LEVEL.has(labels.at(-2)!) ? -3 : -2).join('.'); }
/** Archived copies (web.archive.org/web/<timestamp>/<original>) mirror their original locator. */
export function archivedOriginal(locator: string): string | null { const m = locator.match(/^https?:\/\/web\.archive\.org\/web\/\d{4,14}[a-z_]*\/(https?:\/\/.+)$/i); if (!m)
    return null; try {
    return canonicalUrl(m[1]);
}
catch {
    return null;
} }
export function sourceLocators(s: Pick<SourceDocument, 'canonicalLocator' | 'provenance'>): string[] { const out = [s.canonicalLocator, s.provenance.discovery?.requestedUrl, s.provenance.discovery?.finalUrl].filter((x): x is string => Boolean(x)); const original = archivedOriginal(s.canonicalLocator); return [...new Set([...out, ...(original ? [original] : [])])]; }
const effectiveHost = (s: SourceDocument) => hostOf(archivedOriginal(s.canonicalLocator) ?? s.canonicalLocator);
function pageLinks(s: SourceDocument): Set<string> { const out = new Set<string>(); if (s.contentType !== 'text/html')
    return out; for (const m of s.content.matchAll(/<a\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    if (out.size >= 2000)
        break;
    const href = attributes(m[0]).href ?? '';
    if (/^https?:\/\//i.test(href))
        try {
            out.add(canonicalUrl(href));
        }
        catch { }
} return out; }
function chunks(t: string) { const words = t.split(/\s+/), out = new Set<string>(); for (let k = 0; k + 40 <= words.length; k += 40)
    out.add(jsonHash(words.slice(k, k + 40).join(' '))); return out; }
interface GraphBuild {
    graph: SourceGraph;
    groups: OriginGroup[];
    groupOf: Map<string, string>;
    cites: Map<string, Set<string>>;
}
/** Symmetric relations (mirror, near copy, same publisher, declared shared origin) form origin groups. Citations are directional and do not merge groups. */
export function buildSourceGraph(sources: SourceDocument[], assessments: SourceQualityAssessment[], evidence: Evidence[]): GraphBuild {
    const sorted = [...sources].sort((a, b) => a.id.localeCompare(b.id, 'en')), edges: OriginRelation[] = [], parent = new Map(sorted.map(s => [s.id, s.id])), reasons = new Map<string, Set<string>>();
    const find = (x: string): string => { const p = parent.get(x)!; if (p === x)
        return x; const r = find(p); parent.set(x, r); return r; };
    const union = (a: string, b: string, why: string) => { const ra = find(a), rb = find(b); if (ra !== rb)
        parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb); for (const id of [a, b])
        reasons.set(id, (reasons.get(id) ?? new Set()).add(why)); };
    const edge = (from: string, to: string, relation: OriginRelation['relation'], reason: string, factId: string | null = null, evidenceIds: string[] = []) => { const raw = { from, to, relation, factId, evidenceIds: [...evidenceIds].sort(), reason }; edges.push({ id: 'OR_' + jsonHash(raw).slice(0, 16), ...raw }); };
    const tokens = new Map(sorted.map(s => { const host = effectiveHost(s), declared = [s.provenance.originKey, ...(s.provenance.sharedOriginKeys ?? [])].filter(k => !k.startsWith('citation:') && !(host && k === hostOf(s.canonicalLocator))); return [s.id, { hash: s.contentHash, normalized: jsonHash(s.normalized.text), locators: sourceLocators(s), domain: host ? registrableDomain(host) : null, publisher: host ? null : normalize(s.publisher), declared }]; }));
    const chunkSets = new Map(sorted.map(s => [s.id, chunks(s.normalized.text)])), links = new Map(sorted.map(s => [s.id, pageLinks(s)]));
    for (let i = 0; i < sorted.length; i++)
        for (let j = i + 1; j < sorted.length; j++) {
            const a = sorted[i], b = sorted[j], ta = tokens.get(a.id)!, tb = tokens.get(b.id)!;
            if (ta.hash === tb.hash || ta.normalized === tb.normalized || ta.locators.some(l => tb.locators.includes(l))) {
                edge(a.id, b.id, 'MIRRORS', 'Identical content or locator / archived copy of the same original');
                union(a.id, b.id, 'MIRRORS');
                continue;
            }
            if (ta.domain && ta.domain === tb.domain || ta.publisher && ta.publisher === tb.publisher) {
                edge(a.id, b.id, 'SAME_PUBLISHER', 'Same registrable domain/publisher is never counted as a second origin');
                union(a.id, b.id, 'SAME_PUBLISHER');
                continue;
            }
            if (ta.declared.some(k => tb.declared.includes(k))) {
                edge(a.id, b.id, k(ta.declared, tb.declared).startsWith('near-copy:') ? 'NEAR_COPY' : 'MIRRORS', 'Declared shared origin key ' + k(ta.declared, tb.declared));
                union(a.id, b.id, 'DECLARED_SHARED_ORIGIN');
                continue;
            }
            const ca = chunkSets.get(a.id)!, cb = chunkSets.get(b.id)!, common = [...ca].filter(x => cb.has(x)).length;
            if (Math.min(ca.size, cb.size) >= 3 && common / Math.min(ca.size, cb.size) >= 0.8) {
                edge(a.id, b.id, 'NEAR_COPY', 'At least 80% of 40-word chunks shared');
                union(a.id, b.id, 'NEAR_COPY');
            }
        }
    const cites = new Map<string, Set<string>>();
    for (const a of sorted)
        for (const b of sorted)
            if (a.id !== b.id && find(a.id) !== find(b.id) && tokens.get(b.id)!.locators.some(l => links.get(a.id)!.has(l))) {
                cites.set(a.id, (cites.get(a.id) ?? new Set()).add(b.id));
                edge(a.id, b.id, 'CITES', 'Page links to the snapshot locator of the other source');
            }
    const members = new Map<string, string[]>();
    for (const s of sorted)
        members.set(find(s.id), [...(members.get(find(s.id)) ?? []), s.id]);
    const groups: OriginGroup[] = [...members.values()].map(ids => ({ id: 'OG_' + jsonHash(ids).slice(0, 16), sourceIds: ids, evidenceIds: evidence.filter(e => ids.includes(e.sourceId)).map(e => e.id).sort(), reasons: [...new Set(ids.flatMap(id => [...(reasons.get(id) ?? [])]))].sort() })).sort((a, b) => a.id.localeCompare(b.id, 'en'));
    const groupOf = new Map(groups.flatMap(g => g.sourceIds.map(id => [id, g.id] as const)));
    const nodes = sorted.map(s => ({ sourceId: s.id, locator: s.canonicalLocator, registrableDomain: tokens.get(s.id)!.domain ?? normalize(s.publisher), publisher: s.publisher, sourceType: s.sourceType, originGroupId: groupOf.get(s.id)! }));
    const raw = { version: SOURCE_GRAPH_VERSION, nodes, edges: edges.sort((a, b) => a.id.localeCompare(b.id, 'en')) };
    return { graph: { ...raw, fingerprint: jsonHash(raw) }, groups, groupOf, cites };
}
const k = (a: string[], b: string[]) => a.find(x => b.includes(x)) ?? '';
/** Adds fact-level relations (DERIVED_FROM, REPORTS, PRIMARY_ORIGIN, UNKNOWN_RELATION) and recomputes the graph fingerprint. */
export function withFactRelations(graph: SourceGraph, relations: Omit<OriginRelation, 'id'>[]): SourceGraph { const edges = [...graph.edges, ...relations.map(r => ({ id: 'OR_' + jsonHash({ ...r, evidenceIds: [...r.evidenceIds].sort() }).slice(0, 16), ...r, evidenceIds: [...r.evidenceIds].sort() }))].filter((e, i, all) => all.findIndex(x => x.id === e.id) === i).sort((a, b) => a.id.localeCompare(b.id, 'en')); const raw = { version: graph.version, nodes: graph.nodes, edges }; return { ...raw, fingerprint: jsonHash(raw) }; }
// ---------- aliases ----------
const NAME = "[\\p{Lu}][\\p{L}\\p{M}'’-]+(?:[ -][\\p{Lu}][\\p{L}\\p{M}'’-]+){0,3}";
function levenshtein(a: string, b: string) { const d = Array.from({ length: b.length + 1 }, (_, i) => i); for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
        const t = d[j];
        d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = t;
    }
} return d[b.length]; }
/** Aliases need explicit source wording to be CONFIRMED. Structured metadata is LIKELY; similarity alone is AMBIGUOUS; contradictions disable merging. */
export function resolveAliases(sources: SourceDocument[], subjects: string[]): { aliases: AliasCandidate[]; canonical: Map<string, string>; contradicted: [string, string][] } {
    const out: AliasCandidate[] = [], relevant = new Set(subjects.map(normalize));
    const add = (name: string, alias: string, status: AliasCandidate['status'], relation: AliasCandidate['relation'], source: SourceDocument | null, span: AliasCandidate['sourceSpan'], reason: string) => { if (normalize(name) === normalize(alias) || alias.length > 100)
        return; const raw = { name, alias, status, relation, sourceId: source?.id ?? null, sourceSpan: span, reason }; out.push({ id: 'AL_' + jsonHash(raw).slice(0, 16), ...raw }); };
    for (const s of [...sources].sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
        const t = s.normalized.text;
        const patterns: [RegExp, AliasCandidate['relation']][] = [[new RegExp('(' + NAME + '),?\\s+(?:also|commonly|formerly)\\s+(?:known|spelled|written|called)\\s+as\\s+["“]?(' + NAME + ')', 'gu'), 'ALSO_KNOWN_AS'], [new RegExp('(' + NAME + ')\\s+\\((?:also\\s+)?(?:spelled|transliterated|romani[sz]ed)(?:\\s+as)?\\s+["“]?(' + NAME + ')', 'gu'), 'TRANSLITERATION'], [new RegExp('(' + NAME + ')\\s+\\((?:[\\p{Lu}][\\p{Ll}]+(?:\\s+language)?)\\s*:\\s*([^;,()\\n]{2,60}?)\\s*[;,)]', 'gu'), 'LOCAL_NAME']];
        for (const [re, relation] of patterns)
            for (const m of t.matchAll(re)) {
                if (!relevant.has(normalize(m[1])) && !relevant.has(normalize(m[2].trim())))
                    continue;
                add(m[1], m[2].trim(), 'CONFIRMED_ALIAS', relation, s, sourceSpan(s, m.index!, m.index! + m[0].length), 'Explicit alias wording in the snapshot');
            }
        for (const m of t.matchAll(new RegExp('(' + NAME + ')[^\\n]{0,80}?\\bnot to be confused with\\s+(?:the\\s+)?(' + NAME + ')', 'gu')))
            if (relevant.has(normalize(m[1])) || relevant.has(normalize(m[2])))
                add(m[1], m[2], 'REJECTED_ALIAS', 'NOT_TO_BE_CONFUSED', s, sourceSpan(s, m.index!, m.index! + m[0].length), 'Explicit disambiguation wording');
        if (s.contentType === 'text/html') {
            const parsed = parseHtmlStructures(s.content, hostOf(s.canonicalLocator));
            for (const [i, node] of jsonLdSummary(parsed.jsonLd).entries())
                if (node.name && relevant.has(normalize(node.name)))
                    for (const alias of node.alternateNames)
                        add(node.name, alias, 'LIKELY_ALIAS', 'STRUCTURED_METADATA', s, parsed.jsonLd[Math.min(i, parsed.jsonLd.length - 1)]?.span ?? null, 'JSON-LD alternateName is supporting metadata only; not merged automatically');
        }
    }
    const names = [...new Set(subjects)].sort();
    for (let i = 0; i < names.length; i++)
        for (let j = i + 1; j < names.length; j++) {
            const a = normalize(names[i]), b = normalize(names[j]);
            if (a !== b && Math.min(a.length, b.length) >= 5 && levenshtein(a, b) <= 2 && !out.some(x => x.status === 'CONFIRMED_ALIAS' && [normalize(x.name), normalize(x.alias)].sort().join('|') === [a, b].sort().join('|')))
                add(names[i], names[j], 'AMBIGUOUS_ALIAS', 'SIMILARITY_ONLY', null, null, 'Textual similarity alone never merges entities');
        }
    const pair = (x: AliasCandidate) => [normalize(x.name), normalize(x.alias)].sort().join('|');
    const rejected = new Set(out.filter(x => x.status === 'REJECTED_ALIAS').map(pair)), contradicted: [string, string][] = [];
    const parent = new Map<string, string>(), display = new Map<string, string>();
    const find = (x: string): string => { const p = parent.get(x) ?? x; if (p === x)
        return x; const r = find(p); parent.set(x, r); return r; };
    for (const x of out.filter(x => x.status === 'CONFIRMED_ALIAS')) {
        if (rejected.has(pair(x))) {
            contradicted.push([x.name, x.alias]);
            continue;
        }
        const a = normalize(x.name), b = normalize(x.alias);
        display.set(a, display.get(a) ?? x.name);
        display.set(b, display.get(b) ?? x.alias);
        const ra = find(a), rb = find(b);
        if (ra !== rb)
            parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb);
    }
    // Canonical display name: a subject actually used by facts, preferring the alias statement's main name.
    const canonical = new Map<string, string>(), byRoot = new Map<string, string[]>();
    for (const key of display.keys())
        byRoot.set(find(key), [...(byRoot.get(find(key)) ?? []), key]);
    for (const keys of byRoot.values()) {
        const used = keys.filter(k => relevant.has(k)).sort(), main = out.find(x => x.status === 'CONFIRMED_ALIAS' && keys.includes(normalize(x.name)) && relevant.has(normalize(x.name)));
        const name = main ? main.name : display.get(used[0] ?? keys.sort()[0])!;
        for (const key of keys)
            canonical.set(key, name);
    }
    return { aliases: out.sort((a, b) => a.id.localeCompare(b.id, 'en')), canonical, contradicted };
}
