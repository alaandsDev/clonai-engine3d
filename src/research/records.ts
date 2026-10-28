import { jsonHash } from '../editorial/fingerprint';
import { normalize } from '../semantics/normalize';
import type { SourceSpan } from '../semantics/contracts';
import { attributes, cleanText, decodeEntities, temperatureQualifiers, classifyHeader, parseTemperatureValue, type ParsedHtml, type StructuredFact, type StructuredGrid } from './structured';
import type { CanonicalFact, MultiSubjectSemantics, RecordField, ResearchPolicy, StructuredRecord } from './contracts';
// Phase 22 semi-structured records: label/value blocks outside data tables, two-column label/value tables and
// record sections under a heading. Markup is data; nothing is rendered or executed.
export const RECORD_LIMITS = { maxRecordsPerSource: 64, maxFieldsPerRecord: 24, maxValueChars: 600, maxLabelChars: 60, headingWindow: 6000 };
export interface RecordDraft {
    record: Omit<StructuredRecord, 'recordId' | 'sourceId' | 'evidenceIds'>;
    start: number;
    headingSpan: SourceSpan | null;
}
const span = (raw: string, start: number, end: number): SourceSpan => {
    while (start < end && /\s/.test(raw[start]))
        start++;
    while (end > start && /\s/.test(raw[end - 1]))
        end--;
    return { start, end, text: raw.slice(start, end) };
};
// Line breaks are kept: they separate enumerated subjects inside one field.
const text = (html: string) => decodeEntities(html.replace(/<sup\b[\s\S]*?<\/sup>/gi, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ')).split('\n').map(cleanText).filter(Boolean).join('\n').replace(/:\s*$/, '');
// Location labels are whole labels ("Site name", "Geospatial Location"), never any label containing "place".
const LOCATION = /^(?:(?:geospatial|geographic|observation)\s+)?(?:location|place|site|station|locality|town|city|village|settlement|observation site|weather station)(?:\s+name)?$/i;
const DATE = /\b(?:date|dates|year|recorded on|date of record)\b/i;
const VALUE = /^(?:record )?value$|^record$|^measurement$|^observed value$|^valor$/i;
function headingBefore(parsed: ParsedHtml, at: number) { const h = parsed.headings.filter(h => h.span.start < at && at - h.span.end < RECORD_LIMITS.headingWindow).at(-1); return h ? { text: h.text, span: h.span } : null; }
/** Label/value fields: <strong|b|label>Label</…> value inside li/p/dd/div blocks, and class-labelled sibling divs. */
function blockFields(raw: string): (RecordField & { start: number })[] {
    const out: (RecordField & { start: number })[] = [];
    for (const block of raw.matchAll(/<(li|p|dd|td)\b[^>]*>((?:(?!<\/?(?:li|p|dd|td|ul|ol|table)\b)[\s\S]){1,900}?)<\/\1>/gi)) {
        const inner = block[2], base = block.index! + block[0].indexOf(inner, block[1].length + 1), labels = [...inner.matchAll(/<(strong|b|label)\b[^>]*>([\s\S]{1,120}?)<\/\1>/gi)];
        for (const [i, l] of labels.entries()) {
            const label = text(l[2]), from = l.index! + l[0].length, to = labels[i + 1]?.index ?? inner.length, value = text(inner.slice(from, to).replace(/^\s*(?::|&nbsp;)+/, ''));
            if (!label || label.length > RECORD_LIMITS.maxLabelChars || !value || value.length > RECORD_LIMITS.maxValueChars)
                continue;
            out.push({ label, value, unit: null, span: span(raw, base + from, base + to), labelSpan: span(raw, base + l.index!, base + from), contextPath: block[1].toLowerCase() + '>' + l[1].toLowerCase(), start: base + l.index! });
        }
    }
    for (const m of raw.matchAll(/<(div|span|dt)\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]{1,160}?)<\/\1>\s*<(div|span|dd)\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]{1,700}?)<\/\4>/gi)) {
        const a = attributes('<x' + m[2] + '>'), b = attributes('<x' + m[5] + '>');
        if (!/(?:^|[\s_-])(?:label|field-label|field__label)(?:$|[\s_-])/i.test(a.class ?? '') || !/(?:item|value|content|field__item)/i.test(b.class ?? ''))
            continue;
        const label = text(m[3]), value = text(m[6]), valueStart = m.index! + m[0].lastIndexOf(m[6]);
        if (label && value && label.length <= RECORD_LIMITS.maxLabelChars && value.length <= RECORD_LIMITS.maxValueChars)
            out.push({ label, value, unit: null, span: span(raw, valueStart, valueStart + m[6].length), labelSpan: span(raw, m.index!, m.index! + m[0].indexOf(m[3]) + m[3].length), contextPath: 'div.label>div.value', start: m.index! });
    }
    return out.sort((x, y) => x.start - y.start);
}
/** Two-column label/value tables whose rows are not a headed data table (th/td or td/td rows). */
function tableFields(grid: StructuredGrid): (RecordField & { start: number })[] | null {
    const rows = grid.rows.filter(r => r.length === 2 && r[0].colspan === 1 && r[1].colspan === 1);
    if (rows.length < 2 || rows.length !== grid.rows.filter(r => r.length > 1).length || rows.some(r => r[1].header))
        return null;
    if (!rows.every(r => r[0].header) && !rows.every(r => !r[0].header && r[0].text.length <= RECORD_LIMITS.maxLabelChars && r[1].text.length > r[0].text.length))
        return null;
    return rows.map(r => ({ label: r[0].text.replace(/:\s*$/, ''), value: r[1].text, unit: null, span: r[1].span, labelSpan: r[0].span, contextPath: 'table>tr>' + (r[0].header ? 'th' : 'td'), start: r[0].span.start }));
}
/** Splits a location value into subjects; enumerations, separators and explicit tie wording decide the semantics. */
export function subjectsOf(value: string, context: string): { subjects: string[]; semantics: MultiSubjectSemantics } {
    const inline = value.split(/\s*(?=\(\s*[a-z]\s*\)\s)/i).map(s => s.trim()).filter(Boolean), lines = value.includes('\n') ? value.split('\n').map(s => s.trim()).filter(Boolean) : inline.length > 1 ? inline : [value.trim()], enumerated = /^\(?[a-z]\)\s*/i, parts = lines.length > 1 ? lines : value.split(/\s+\/\s+|;\s+|\s+&\s+|\s+and\s+/);
    const subjects = [...new Set(parts.map(p => p.replace(enumerated, '').replace(/\[[^\]]*\]/g, '').split(',')[0].trim()).filter(p => /^[\p{Lu}][\p{L}\p{M}'’ .-]{1,60}$/u.test(p)))];
    if (subjects.length <= 1)
        return { subjects, semantics: subjects.length ? 'SINGLE_SUBJECT' : 'UNKNOWN' };
    // Formatting ("A / B", "(a) A (b) B") never proves a tie; only explicit wording does.
    if (/\b(?:share|shares|shared|jointly|tied|tie for|both hold|equal(?:led)? the record)\b/i.test(context))
        return { subjects, semantics: 'TIED_RECORD' };
    return { subjects, semantics: lines.some(l => enumerated.test(l)) || parts.some(p => enumerated.test(p)) ? 'ALTERNATIVE_SUBJECTS' : 'AMBIGUOUS_SUBJECT' };
}
/** Groups label/value fields into records: same container run, no heading between, bounded size. */
export function extractRecords(raw: string, parsed: ParsedHtml, rejectedGrids: StructuredGrid[]): RecordDraft[] {
    const drafts: RecordDraft[] = [], fields = blockFields(raw);
    let run: (RecordField & { start: number })[] = [];
    const flush = () => { if (run.length) {
        const h = headingBefore(parsed, run[0].start);
        drafts.push(draft(run.map(({ start, ...f }) => f), 'LABEL_VALUE_BLOCK', h, run[0].start));
    } run = []; };
    for (const f of fields) {
        const prev = run.at(-1);
        if (prev && (f.start - prev.span.end > 600 || parsed.headings.some(h => h.span.start > prev.span.end && h.span.start < f.start) || run.length >= RECORD_LIMITS.maxFieldsPerRecord))
            flush();
        run.push(f);
    }
    flush();
    for (const g of rejectedGrids) {
        const fs = tableFields(g);
        if (fs)
            drafts.push(draft(fs.map(({ start, ...f }) => f), 'LABEL_VALUE_ROWS', headingBefore(parsed, g.span.start), g.span.start));
    }
    // Only records with a location, date or metric-capable field are kept; arbitrary bold text is not a record.
    const useful = (d: RecordDraft) => d.record.fields.some(f => LOCATION.test(f.label) || DATE.test(f.label) || VALUE.test(f.label) || ['TEMPERATURE', 'POPULATION', 'RESIDENCY'].includes(classifyHeader(f.label).role));
    return drafts.filter(useful).sort((a, b) => a.start - b.start).slice(0, RECORD_LIMITS.maxRecordsPerSource);
}
function draft(fields: RecordField[], recordType: StructuredRecord['recordType'], heading: { text: string; span: SourceSpan } | null, start: number): RecordDraft {
    const location = fields.filter(f => isLocationLabel(f.label)), context = [heading?.text ?? '', ...fields.map(f => f.label + ' ' + f.value)].join(' ');
    const split = location.length === 1 ? subjectsOf(location[0].value, context) : location.length > 1 ? { subjects: location.map(f => f.value), semantics: 'AMBIGUOUS_SUBJECT' as const } : { subjects: [], semantics: 'UNKNOWN' as const };
    const diagnostics = [...(split.semantics === 'ALTERNATIVE_SUBJECTS' || split.semantics === 'AMBIGUOUS_SUBJECT' ? ['MULTI_SUBJECT_RECORD ' + split.semantics] : []), ...(location.length ? [] : ['NO_RECORD_LOCATION_FIELD'])];
    return { record: { recordType, heading: heading?.text ?? null, fields, subjectCandidates: split.subjects, semantics: split.semantics, confidence: split.semantics === 'SINGLE_SUBJECT' || split.semantics === 'TIED_RECORD' ? 'HIGH' : split.semantics === 'UNKNOWN' ? 'MEDIUM' : 'LOW', diagnostics }, start, headingSpan: heading?.span ?? null };
}
/** Facts from a record: a temperature field (by label, or a generic value field under a metric heading) for one subject, or each subject of an explicit tie. Ambiguous multi-subject records yield nothing. */
export function recordFacts(d: RecordDraft, index: number, policy: ResearchPolicy, language: string, inherited: { name: string; kind: 'STATION' | 'PLACE'; spans: SourceSpan[]; source: StructuredFact['structured']['subjectSource'] } | null): StructuredFact[] {
    const r = d.record, out: StructuredFact[] = [];
    if (r.semantics === 'ALTERNATIVE_SUBJECTS' || r.semantics === 'AMBIGUOUS_SUBJECT')
        return out;
    const headingMetric = r.heading ? temperatureQualifiers(r.heading) : null, date = r.fields.find(f => DATE.test(f.label))?.value.match(/\b(?:\d{1,2}\s+[A-Z][a-z]+\s+)?(?:1[6-9]|20)\d{2}\b/)?.[0] ?? null;
    const location = r.fields.find(f => isLocationLabel(f.label)) ?? null, subjects = r.subjectCandidates.length ? r.subjectCandidates.map(name => ({ name, kind: /\b(?:site|station)\b/i.test(location?.label ?? '') ? 'STATION' as const : 'PLACE' as const, spans: location ? [location.span] : [], source: 'RECORD_FIELD' as const })) : inherited ? [inherited] : [];
    const sharedRecordId = r.semantics === 'TIED_RECORD' ? 'SR_' + jsonHash({ heading: r.heading, fields: r.fields.map(f => [f.label, f.value]) }).slice(0, 16) : undefined;
    for (const [column, f] of r.fields.entries()) {
        const own = classifyHeader(f.label), metric = own.role === 'TEMPERATURE' ? own.qualifiers : VALUE.test(f.label) && headingMetric?.supported ? headingMetric.qualifiers : [];
        if (!metric.length)
            continue;
        const v = parseTemperatureValue(f.value.split('\n')[0], own.unit, policy, language);
        if (!('quantity' in v))
            continue;
        for (const s of subjects) {
            const fact: CanonicalFact = { factType: 'MEASUREMENT', subject: s.name, predicate: 'MEASURED_TEMPERATURE', object: null, quantity: v.quantity, metric: 'TEMPERATURE', temporalContext: subjects.length > 1 ? null : date, qualifiers: [...metric, ...(v.quantity.approximation === 'APPROXIMATE' ? ['APPROXIMATE'] : [])], residency: null, ...(s.kind === 'STATION' ? { subjectKind: 'STATION' as const } : {}), ...(sharedRecordId ? { sharedRecordId } : {}) };
            out.push({ fact, span: f.span, normalizedText: f.value, method: 'RECORD_HTML_V3' as const, structured: { kind: 'RECORD', structureIndex: index, row: 0, column, rowHeader: f.label, columnHeader: r.heading, headerSpans: [f.labelSpan], captionSpan: d.headingSpan, subjectSpan: s.spans[0] ?? null, unitSource: v.unitSource === 'CELL' ? 'CELL' : 'HEADER', subjectSource: s.source }, contextSpans: [f.labelSpan, ...(d.headingSpan ? [d.headingSpan] : []), ...s.spans].filter((x, i, a) => x.end > x.start && a.findIndex(y => y.start === x.start && y.end === x.end) === i), anchors: [], links: [], headerSpan: f.labelSpan });
        }
    }
    return out;
}
export const recordId = (sourceId: string, d: RecordDraft) => 'REC_' + jsonHash({ sourceId, start: d.start, fields: d.record.fields.map(f => [f.label, f.span.start]) }).slice(0, 16);
export function isLocationLabel(label: string) { return LOCATION.test(label.trim()); }
export const normalizedName = (s: string) => normalize(s).replace(/\s+/g, ' ').trim();
