import { jsonHash } from '../editorial/fingerprint';
import { normalize } from '../semantics/normalize';
import type { SourceSpan } from '../semantics/contracts';
import { documentSubject, jsonLdSummary, titleSubject, type InheritedSubject, type ParsedHtml, type StructuredGrid } from './structured';
import { isLocationLabel, type RecordDraft } from './records';
import type { DocumentContextSummary, DocumentSubjectCandidate, SourceDocument, SubjectSource } from './contracts';
// Phase 22 DocumentContext: explicit page context beyond the cell. Subject inheritance is allowed only when every
// document-level signal names the same entity; a page naming several places/stations makes tables abstain.
// Strength (documented): table subject column > caption/title > section heading > document label > page title > lead > metadata > URL hint.
export const CONTEXT_VERSION = 'document-context/1.0.0';
const STRENGTH: Record<string, number> = { CELL: 9, ROW_HEADER: 8, TABLE_CAPTION: 7, SECTION_HEADING: 6, DOCUMENT_LABEL: 5, DOCUMENT_TITLE: 4, LEAD: 3, METADATA: 2, URL_HINT: 0 };
const PLURAL = /\b(?:locations|sites|stations|places|areas|regions|cities|towns|countries)\b/i;
/** Subject named by a data heading ("Summary statistics X", "Climate data for X", "X weather station"); arbitrary headings are never subjects. */
export function headingSubject(text: string): { name: string; kind: 'STATION' | 'PLACE' } | null {
    const titled = titleSubject(text);
    if (titled && !PLURAL.test(titled.subject))
        return { name: titled.subject, kind: /\b(?:station|site|airport|observatory)\b/i.test(titled.subject) ? 'STATION' : 'PLACE' };
    const prefixed = text.match(/^(?:summary |monthly |annual |daily )?(?:climate |weather |meteorological )?(?:statistics|data|records|observations|summary|normals|averages|extremes)\s+(?:for |at |of |from )?(.+)$/i);
    const station = text.match(/^(.+?)\s+(?:weather|meteorological|climate|automatic weather)\s+station$/i);
    const name = (prefixed?.[1] ?? station?.[1] ?? '').trim();
    if (!name || name.length > 60 || !/^[\p{Lu}\p{N}]/u.test(name) || /\b(?:locations|sites|stations|places|areas|regions|cities|towns|countries|information|years|record|records)\b/i.test(name) || /\b(?:and|or)\b|[,;/]/.test(name))
        return null;
    return { name, kind: station || /\b(?:station|site|airport|observatory)\b/i.test(name) ? 'STATION' : 'PLACE' };
}
export interface DocumentContextModel {
    summary: DocumentContextSummary;
    /** Subject for a table/record without its own subject: local (caption/heading) first, then an unambiguous document-level subject. */
    subjectAt: (start: number) => InheritedSubject | null;
}
export function buildDocumentContext(doc: SourceDocument, parsed: ParsedHtml, records: RecordDraft[]): DocumentContextModel {
    const raw = doc.content, candidates: DocumentSubjectCandidate[] = [];
    const add = (name: string, span: SourceSpan | null, sourceKind: SubjectSource | 'URL_HINT', entityKind: 'STATION' | 'PLACE', confidence: DocumentSubjectCandidate['confidence'], reason: string) => { const trimmed = name.trim(); if (trimmed && trimmed.length <= 80)
        candidates.push({ text: trimmed, normalizedText: normalize(trimmed).replace(/\s+/g, ' '), sourceSpan: span, sourceKind, entityKind, confidence, entityCandidateId: 'EC_' + jsonHash(normalize(trimmed).replace(/\s+/g, ' ') + '|' + entityKind).slice(0, 16), reason }); };
    const titleRaw = raw.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i), title = titleRaw ? titleRaw[1].replace(/<[^>]*>/g, '').trim() : null;
    const titled = title ? headingSubject(title) : null;
    if (titled && titleRaw)
        add(titled.name, { start: titleRaw.index!, end: titleRaw.index! + titleRaw[0].length, text: titleRaw[0] }, 'DOCUMENT_TITLE', titled.kind, 'MEDIUM', 'Page title names a data subject');
    for (const h of parsed.headings) {
        const s = headingSubject(h.text);
        if (s)
            add(s.name, h.span, h.level === 1 ? 'DOCUMENT_TITLE' : 'SECTION_HEADING', s.kind, 'HIGH', 'Data heading "' + h.text.slice(0, 80) + '"');
    }
    for (const r of records)
        for (const f of r.record.fields.filter(f => isLocationLabel(f.label)))
            if (r.record.semantics === 'SINGLE_SUBJECT' || r.record.semantics === 'UNKNOWN')
                add(f.value.split('\n')[0].replace(/\s*\(.*$/, '').split(',')[0], f.span, 'DOCUMENT_LABEL', /\b(?:site|station)\b/i.test(f.label) ? 'STATION' : 'PLACE', 'HIGH', 'Explicit label "' + f.label + '"');
    const lead = documentSubject(doc, parsed);
    if (lead)
        add(lead.name, lead.spans[1] ?? lead.spans[0], 'LEAD', /\b(?:research station|weather station|scientific station)\b/i.test(lead.spans[1]?.text ?? '') ? 'STATION' : 'PLACE', 'HIGH', 'Heading plus lead stating a populated place or station');
    for (const node of jsonLdSummary(parsed.jsonLd))
        if (node.name && node.type.some(t => /^(?:Place|City|AdministrativeArea|Landform|Accommodation)$/.test(t)))
            add(node.name, parsed.jsonLd[0]?.span ?? null, 'METADATA', 'PLACE', 'MEDIUM', 'JSON-LD Place name (supporting metadata)');
    // URL path tokens are supporting hints only and never decide a subject.
    const path = (() => { try {
        return decodeURIComponent(new URL(doc.canonicalLocator).pathname);
    }
    catch {
        return '';
    } })();
    for (const c of [...candidates])
        if (path && normalize(path).replace(/[_-]/g, ' ').includes(c.normalizedText))
            add(c.text, null, 'URL_HINT', c.entityKind, 'LOW', 'URL path contains the candidate (supporting only)');
    const decisive = candidates.filter(c => c.sourceKind !== 'URL_HINT'), names = [...new Set(decisive.map(c => c.normalizedText))].sort();
    const best = (list: DocumentSubjectCandidate[]) => [...list].sort((a, b) => STRENGTH[b.sourceKind] - STRENGTH[a.sourceKind] || (a.sourceSpan?.start ?? 0) - (b.sourceSpan?.start ?? 0))[0];
    const resolved = names.length === 1 ? (() => { const all = decisive.filter(c => c.normalizedText === names[0]), top = best(all); return { name: top.text, entityKind: all.some(c => c.entityKind === 'STATION') ? 'STATION' as const : 'PLACE' as const, sourceKinds: [...new Set(all.map(c => c.sourceKind))].sort() }; })() : null;
    const ambiguity = names.length > 1 ? 'DOCUMENT_SUBJECT_AMBIGUOUS: ' + names.join(' | ') : names.length ? null : 'NO_DOCUMENT_SUBJECT';
    const raw0 = { sourceId: doc.id, title, h1: parsed.h1?.text ?? null, candidates: candidates.sort((a, b) => (a.sourceSpan?.start ?? -1) - (b.sourceSpan?.start ?? -1) || a.sourceKind.localeCompare(b.sourceKind, 'en')), resolved, ambiguity };
    const summary = { ...raw0, fingerprint: jsonHash(raw0) };
    const subjectAt = (start: number): InheritedSubject | null => {
        // Local heading of the section containing the structure.
        const local = parsed.headings.filter(h => h.span.end <= start).at(-1), localSubject = local ? headingSubject(local.text) : null;
        if (localSubject && (!names.length || names.includes(normalize(localSubject.name).replace(/\s+/g, ' '))))
            return { name: localSubject.name, kind: localSubject.kind, source: 'SECTION_HEADING', spans: [local!.span] };
        if (!resolved)
            return ambiguity ? { ambiguity } : null;
        const support = decisive.filter(c => c.normalizedText === names[0]), top = best(support);
        return { name: resolved.name, kind: resolved.entityKind, source: top.sourceKind as SubjectSource, spans: support.map(c => c.sourceSpan).filter((s): s is SourceSpan => Boolean(s)).filter((s, i, a) => a.findIndex(x => x.start === s.start) === i).slice(0, 4) };
    };
    return { summary, subjectAt };
}
export const gridStart = (g: StructuredGrid) => g.span.start;
