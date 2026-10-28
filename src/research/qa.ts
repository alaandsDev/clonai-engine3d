import { jsonHash } from '../editorial/fingerprint';
import { buildEvidencePack, packFingerprint } from './pack';
import type { EvidencePack, EvidenceReviewDecision, SourceInput } from './contracts';
// Full rederivation is costly; a pack object whose content still hashes to the fingerprint it was validated under needs no second rebuild.
const validated = new WeakMap<EvidencePack, string>();
export function validateEvidencePack(pack: EvidencePack) {
    if (packFingerprint(pack) !== pack.fingerprint)
        throw Error('EVIDENCE_PACK_FINGERPRINT changed');
    if (validated.get(pack) === pack.fingerprint)
        return { passed: true, sourceSpans: true, sourceHash: true, derivedFacts: true, ranking: true, fingerprint: pack.fingerprint };
    for (const a of [pack.sources, pack.evidence, pack.factCandidates, pack.groundedFacts])
        if (new Set(a.map(x => x.id)).size !== a.length)
            throw Error('EVIDENCE_PACK duplicate ID');
    for (const e of pack.evidence) {
        const s = pack.sources.find(s => s.id === e.sourceId);
        if (!s || e.contentHash !== s.contentHash || s.content.slice(e.sourceSpan.start, e.sourceSpan.end) !== e.exactText || e.exactText !== e.sourceSpan.text || e.sourceSpan.start < 0 || e.sourceSpan.end > s.content.length || e.sourceSpan.end <= e.sourceSpan.start)
            throw Error('EVIDENCE_SOURCE_SPAN invalid');
        if (e.table && s.content.slice(e.table.headerSpan.start, e.table.headerSpan.end) !== e.table.headerSpan.text)
            throw Error('EVIDENCE_TABLE_CONTEXT invalid');
        for (const span of e.contextSpans ?? [])
            if (span.start < 0 || span.end <= span.start || s.content.slice(span.start, span.end) !== span.text)
                throw Error('EVIDENCE_CONTEXT_SPAN invalid');
        for (const span of [...(e.structured?.headerSpans ?? []), ...(e.structured?.captionSpan ? [e.structured.captionSpan] : []), ...(e.structured?.subjectSpan ? [e.structured.subjectSpan] : [])])
            if (span.start < 0 || span.end < span.start || s.content.slice(span.start, span.end) !== span.text)
                throw Error('EVIDENCE_STRUCTURED_SPAN invalid');
        const { fingerprint, ...raw } = e;
        if (jsonHash(raw) !== fingerprint)
            throw Error('EVIDENCE_FINGERPRINT invalid');
    }
    const sources: SourceInput[] = pack.sources.map(({ normalized, fingerprint, ...source }) => source), rebuilt = buildEvidencePack(pack.researchPlan.request, { version: 1, id: 'snapshot-revalidation', fixture: pack.fixture, labels: pack.labels, sources });
    if (rebuilt.fingerprint !== pack.fingerprint)
        throw Error('EVIDENCE_PACK_REDERIVATION facts/qualifiers/ranking/quality differ from the source snapshot');
    validated.set(pack, pack.fingerprint);
    return { passed: true, sourceSpans: true, sourceHash: true, derivedFacts: true, ranking: true, fingerprint: pack.fingerprint };
}
export function evidenceReviewQueue(pack: EvidencePack): EvidenceReviewDecision[] { return pack.evidence.filter(e => pack.groundedFacts.some(f => f.evidenceIds.includes(e.id) && (f.status === 'CONFLICTED' || f.status === 'INSUFFICIENT'))).map(e => ({ evidenceId: e.id, decision: 'NEEDS_REVIEW', reason: 'Policy conflict/insufficient independent support; this is a recommendation, not human approval', reviewer: 'UNASSIGNED' })); }
