import { interpretGrid, interpretList, documentSubject, type ParsedHtml, type StructuredFact, type StructuredGrid } from './structured';
import { extractRecords, recordFacts, recordId, type RecordDraft } from './records';
import { buildDocumentContext } from './context';
import type { DocumentContextSummary, ResearchPlan, SourceDocument, StructuredRecord, StructuredSummary } from './contracts';
// Phase 22 structured extraction for one HTML snapshot: DocumentContext first (from data headings and label/value
// records), then tables with context inheritance, then semi-structured records.
export interface V3Extraction {
    facts: StructuredFact[];
    structures: Omit<StructuredSummary, 'evidenceIds'>[];
    context: DocumentContextSummary;
    records: { record: Omit<StructuredRecord, 'evidenceIds'>; facts: StructuredFact[] }[];
}
export function structuredV3(s: SourceDocument, plan: ResearchPlan, parsed: ParsedHtml): V3Extraction {
    const policy = plan.policy, facts: StructuredFact[] = [], structures: Omit<StructuredSummary, 'evidenceIds'>[] = [], docSubject = documentSubject(s, parsed);
    const blockRecords = extractRecords(s.content, parsed, []), context = buildDocumentContext(s, parsed, blockRecords), rejected: StructuredGrid[] = [];
    for (const g of parsed.grids) {
        const r = interpretGrid(s.content, g, policy, s.language, docSubject, { version: 3, inherit: grid => context.subjectAt(grid.span.start) });
        structures.push({ sourceId: s.id, ...r.summary });
        facts.push(...r.facts);
        if (r.summary.status === 'REJECTED' && !r.facts.length)
            rejected.push(g);
    }
    for (const l of [...parsed.lists, ...parsed.definitions]) {
        const r = interpretList(l, policy, s.language, docSubject);
        if (r.facts.length)
            structures.push({ sourceId: s.id, ...r.summary });
        facts.push(...r.facts);
    }
    const drafts: RecordDraft[] = [...blockRecords, ...extractRecords(s.content, parsed, rejected).filter(d => d.record.recordType === 'LABEL_VALUE_ROWS')].sort((a, b) => a.start - b.start);
    const records = drafts.map((d, i) => {
        const inherited = d.record.subjectCandidates.length ? null : context.subjectAt(d.start), usable = inherited && !('ambiguity' in inherited) ? inherited : null;
        const out = recordFacts(d, i, policy, s.language, usable), id = recordId(s.id, d);
        if (inherited && 'ambiguity' in inherited)
            d.record.diagnostics.push(inherited.ambiguity);
        facts.push(...out);
        return { record: { recordId: id, sourceId: s.id, ...d.record }, facts: out };
    });
    return { facts, structures, context: context.summary, records };
}
