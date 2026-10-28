import { jsonHash } from '../../editorial/fingerprint';
import { normalize } from '../../semantics/normalize';
import type { EvidencePack } from '../contracts';
import type { CandidateSource, DiscoveredEntity, SearchResult } from './contracts';
const entityKey = (name: string) => jsonHash(normalize(name).replace(/\s+/g, ' ').trim());
export function discoverEntities(pack: EvidencePack, candidates: CandidateSource[], results: SearchResult[]): DiscoveredEntity[] {
    const map = new Map<string, DiscoveredEntity>();
    for (const s of pack.sources) {
        const candidate = candidates.find(c => c.canonicalUrl === s.canonicalLocator), queryId = s.provenance.discovery?.queryIds[0] ?? candidate?.queryIds[0] ?? '';
        for (const e of pack.evidence.filter(e => e.sourceId === s.id)) {
            const name = e.supports.subject, id = 'E_' + entityKey(name).slice(0, 16), old = map.get(id);
            if (old) {
                old.sourceIds = [...new Set([...old.sourceIds, s.id])];
                old.evidenceIds.push(e.id);
                continue;
            }
            map.set(id, { id, name, type: 'PLACE_CANDIDATE', sourceIds: [s.id], evidenceIds: [e.id], provenance: 'DISCOVERED_FROM_SOURCE', firstQueryId: queryId, firstUrl: s.canonicalLocator, sourceSpan: e.contextSpans?.[0] ?? e.sourceSpan, discoveryConfidence: 'HIGH', eligibleForFollowup: true });
        }
        // A page heading establishes a document subject, not temperature or residency.
        const h = s.content.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
        if (h) {
            const name = h[1].replace(/<[^>]*>/g, '').trim();
            if (name && name.length <= 100 && !map.has('E_' + entityKey(name).slice(0, 16))) {
                const id = 'E_' + entityKey(name).slice(0, 16);
                map.set(id, { id, name, type: 'DOCUMENT_SUBJECT', sourceIds: [s.id], evidenceIds: [], provenance: 'DISCOVERED_FROM_SOURCE', firstQueryId: queryId, firstUrl: s.canonicalLocator, sourceSpan: { start: h.index!, end: h.index! + h[0].length, text: h[0] }, discoveryConfidence: 'MEDIUM', eligibleForFollowup: /\bis (?:an? |the )[^\n]{0,100}\b(?:town|city|village|settlement|research station|weather station)\b/i.test(s.normalized.text.slice(s.normalized.text.indexOf(name), s.normalized.text.indexOf(name) + 400)) });
            }
        }
    }
    for (const r of results) {
        const id = 'E_' + entityKey(r.title).slice(0, 16);
        if (!map.has(id))
            map.set(id, { id, name: r.title, type: 'DOCUMENT_SUBJECT', sourceIds: [], evidenceIds: [], provenance: 'DISCOVERED_FROM_SEARCH', firstQueryId: r.queryId, firstUrl: r.url, sourceSpan: null, discoveryConfidence: 'MEDIUM', eligibleForFollowup: false });
    }
    return [...map.values()].sort((a, b) => a.id.localeCompare(b.id, 'en'));
}
