import { normalize } from '../semantics/normalize';
import type { SourceSpan } from '../semantics/contracts';
import { canonicalUrl } from './web/security';
import type { CanonicalFact, Quantity, ResearchPolicy, Residency, SourceDocument, StructuredKind, StructuredProvenance, StructuredSummary, SubjectSource } from './contracts';
// Phase 21 structured extraction. Markup is tokenized as data; nothing is executed, fetched or rendered.
// Every value keeps a raw-content span; headers, captions and subjects keep their own spans.
export const STRUCTURED_LIMITS = { maxTablesPerSource: 64, maxRowsPerTable: 400, maxColumnsPerTable: 40, maxSpan: 40, maxCellChars: 2000, maxListsPerSource: 128, maxItemsPerList: 300, maxDefinitionListsPerSource: 64, maxDatasetRows: 5000, maxDatasetColumns: 64, maxJsonLdBlocks: 4, maxJsonLdBytes: 65536, maxJsonLdDepth: 8, maxCitationsPerEvidence: 12, maxFragmentChars: 20000 };
/** v3 regex-based readers use this offset-preserving view; hidden markup cannot supply facts or publisher declarations. */
export function staticMarkup(raw: string): string {
    return raw.replace(/<!--[\s\S]*?(?:-->|$)|<(script|style|nav|aside|iframe|noscript)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, match => ' '.repeat(match.length));
}
export interface StructuredCell {
    text: string;
    span: SourceSpan;
    header: boolean;
    scope: string | null;
    colspan: number;
    rowspan: number;
    anchors: string[];
    links: string[];
}
export interface StructuredGrid {
    kind: 'HTML_TABLE' | 'DATASET';
    index: number;
    caption: { text: string; span: SourceSpan } | null;
    rows: StructuredCell[][];
    span: SourceSpan;
    nested: boolean;
    anchors: string[];
    rejected: string | null;
}
export interface StructuredItem {
    text: string;
    span: SourceSpan;
    anchors: string[];
    links: string[];
}
export interface StructuredList {
    kind: 'HTML_LIST';
    index: number;
    heading: { text: string; span: SourceSpan } | null;
    items: StructuredItem[];
}
export interface DefinitionList {
    kind: 'DEFINITION_LIST';
    index: number;
    heading: { text: string; span: SourceSpan } | null;
    pairs: { term: StructuredItem; definition: StructuredItem }[];
}
export interface ParsedHtml {
    grids: StructuredGrid[];
    lists: StructuredList[];
    definitions: DefinitionList[];
    h1: { text: string; span: SourceSpan } | null;
    jsonLd: { span: SourceSpan; value: unknown; error: string | null }[];
    /** Every h1–h4 in document order (used by the v3 DocumentContext). */
    headings: { level: number; text: string; span: SourceSpan }[];
}
export interface StructuredFact {
    fact: CanonicalFact;
    span: SourceSpan;
    normalizedText: string;
    method: 'TABLE_HTML_V2' | 'LIST_HTML_V2' | 'DEFINITION_HTML_V2' | 'KEY_VALUE_HTML_V2' | 'DATASET_V2' | 'RECORD_HTML_V3';
    structured: StructuredProvenance;
    contextSpans: SourceSpan[];
    anchors: string[];
    links: string[];
    headerSpan: SourceSpan | null;
}
const span = (raw: string, start: number, end: number): SourceSpan => {
    while (start < end && /\s/.test(raw[start]))
        start++;
    while (end > start && /\s/.test(raw[end - 1]))
        end--;
    return { start, end, text: raw.slice(start, end) };
};
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', deg: '°', minus: '−', ndash: '–', mdash: '—', thinsp: ' ', ensp: ' ', emsp: ' ', times: '×' };
export function decodeEntities(value: string) { return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, v: string) => { const k = v.toLowerCase(); if (k[0] === '#') {
    const n = parseInt(k.slice(k[1] === 'x' ? 2 : 1), k[1] === 'x' ? 16 : 10);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '�';
} return ENTITIES[k] ?? all; }); }
export const cleanText = (t: string) => t.replace(/\[\s*(?:\d{1,3}|[a-z]|note \d+|nb \d+|citation needed)\s*\]/gi, '').replace(/[\s  ]+/g, ' ').trim();
export function attributes(tag: string): Record<string, string> { const out: Record<string, string> = {}; for (const m of tag.replace(/^<\s*\/?\s*[a-z0-9]+/i, '').matchAll(/([a-z_:][-a-z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gi))
    out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? ''); return out; }
// Quote-aware tag token: attribute values may legitimately contain '>'.
const TOKEN = /<!--[\s\S]*?-->|<(?:[^>"']|"[^"]*"|'[^']*')*>|[^<]+/g;
interface Sink {
    kind: 'cell' | 'caption' | 'li' | 'dt' | 'dd' | 'heading' | 'table';
    text: string;
    start: number;
    anchors: string[];
    links: string[];
}
export function parseHtmlStructures(raw: string, sourceHost: string | null): ParsedHtml {
    const out: ParsedHtml = { grids: [], lists: [], definitions: [], h1: null, jsonLd: [], headings: [] };
    const tables: { grid: StructuredGrid; row: StructuredCell[] | null; cell: { sink: Sink; tag: Record<string, string>; header: boolean } | null; caption: Sink | null; start: number }[] = [];
    const lists: { list: StructuredList; item: Sink | null }[] = [], dls: { dl: DefinitionList; term: Sink | null; termItem: StructuredItem | null; dd: Sink | null }[] = [];
    const sinks: Sink[] = [];
    let heading: { sink: Sink; level: number } | null = null, lastHeading: { text: string; span: SourceSpan } | null = null, ignored: string | null = null, supDepth = 0, tableCount = 0;
    const push = (kind: Sink['kind'], start: number) => { const s: Sink = { kind, text: '', start, anchors: [], links: [] }; sinks.push(s); return s; };
    const pop = (s: Sink | null) => { if (!s)
        return; const i = sinks.lastIndexOf(s); if (i >= 0)
        sinks.splice(i, 1); };
    const each = (fn: (s: Sink) => void) => { for (let i = sinks.length - 1; i >= 0; i--) {
        if (sinks[i].kind === 'table')
            break;
        if (i === sinks.length - 1 || ['cell', 'caption', 'heading'].includes(sinks[i].kind))
            fn(sinks[i]);
    } };
    const closeCell = (t: typeof tables[number], at: number) => { if (!t.cell)
        return; const c = t.cell; pop(c.sink); if (!t.row)
        t.row = []; const text = cleanText(c.sink.text); if (text.length > STRUCTURED_LIMITS.maxCellChars)
        t.grid.rejected ??= 'STRUCTURED_LIMIT cell length'; const colspan = Number.parseInt(c.tag.colspan ?? '1', 10), rowspan = Number.parseInt(c.tag.rowspan ?? '1', 10); t.row.push({ text, span: span(raw, c.sink.start, at), header: c.header, scope: c.tag.scope?.toLowerCase() ?? null, colspan: Number.isFinite(colspan) && colspan > 0 ? colspan : 1, rowspan: Number.isFinite(rowspan) && rowspan >= 0 ? Math.max(rowspan, 1) : 1, anchors: [...new Set(c.sink.anchors)], links: [...new Set(c.sink.links)] }); t.cell = null; };
    const closeRow = (t: typeof tables[number], at: number) => { closeCell(t, at); if (t.row?.length) {
        if (t.grid.rows.length >= STRUCTURED_LIMITS.maxRowsPerTable)
            t.grid.rejected ??= 'STRUCTURED_LIMIT rows';
        else
            t.grid.rows.push(t.row);
    } t.row = null; };
    const closeItem = (l: typeof lists[number], at: number) => { if (!l.item)
        return; pop(l.item); if (l.list.items.length < STRUCTURED_LIMITS.maxItemsPerList)
        l.list.items.push({ text: cleanText(l.item.text), span: span(raw, l.item.start, at), anchors: [...new Set(l.item.anchors)], links: [...new Set(l.item.links)] }); l.item = null; };
    const finishTerm = (d: typeof dls[number], at: number) => { if (!d.term)
        return; pop(d.term); d.termItem = { text: cleanText(d.term.text), span: span(raw, d.term.start, at), anchors: d.term.anchors, links: d.term.links }; d.term = null; };
    const finishDefinition = (d: typeof dls[number], at: number) => { if (!d.dd)
        return; pop(d.dd); if (d.termItem)
        d.dl.pairs.push({ term: d.termItem, definition: { text: cleanText(d.dd.text), span: span(raw, d.dd.start, at), anchors: d.dd.anchors, links: d.dd.links } }); d.dd = null; };
    const closeDl = (d: typeof dls[number], at: number) => { finishTerm(d, at); finishDefinition(d, at); };
    for (const m of raw.matchAll(TOKEN)) {
        const token = m[0], at = m.index!, end = at + token.length;
        if (token.startsWith('<!--'))
            continue;
        if (!token.startsWith('<')) {
            if (ignored || supDepth)
                continue;
            const text = decodeEntities(token);
            each(s => s.text += text);
            continue;
        }
        const tag = token.match(/^<\s*(\/?)\s*([a-z0-9]+)/i);
        if (!tag)
            continue;
        const closing = Boolean(tag[1]), name = tag[2].toLowerCase();
        if (ignored) {
            if (closing && name === ignored)
                ignored = null;
            continue;
        }
        if (!closing && name === 'script' && /type\s*=\s*["']?application\/ld\+json/i.test(token)) {
            const close = raw.indexOf('</script', end);
            if (close > 0 && out.jsonLd.length < STRUCTURED_LIMITS.maxJsonLdBlocks) {
                const body = raw.slice(end, close);
                out.jsonLd.push({ span: span(raw, end, close), ...parseJsonLd(body) });
            }
        }
        if (!closing && ['script', 'style', 'noscript', 'template', 'svg', 'math', 'nav', 'aside', 'iframe'].includes(name)) {
            if (!/\/>$/.test(token))
                ignored = name;
            continue;
        }
        const attrs = closing ? {} : attributes(token);
        if (name === 'sup') {
            if (!closing && /reference|footnote|cite/i.test(attrs.class ?? ''))
                supDepth++;
            else if (closing && supDepth)
                supDepth--;
            continue;
        }
        if (name === 'a' && !closing) {
            const href = attrs.href ?? '';
            if (href.startsWith('#'))
                each(s => s.anchors.push(href.slice(1)));
            else if (/^https?:\/\//i.test(href) && !/mw:WikiLink/i.test(attrs.rel ?? '')) {
                try {
                    const u = canonicalUrl(href);
                    if (!sourceHost || new URL(u).hostname !== sourceHost)
                        each(s => s.links.push(u));
                }
                catch { }
            }
            continue;
        }
        if (supDepth)
            continue;
        if (['br', 'p', 'div'].includes(name))
            each(s => s.text += ' ');
        const t = tables.at(-1);
        if (name === 'table') {
            if (!closing) {
                tableCount++;
                if (t?.cell)
                    t.grid.nested = true;
                const grid: StructuredGrid = { kind: 'HTML_TABLE', index: tableCount - 1, caption: null, rows: [], span: { start: at, end: at, text: '' }, nested: false, anchors: [], rejected: tableCount > STRUCTURED_LIMITS.maxTablesPerSource ? 'STRUCTURED_LIMIT tables per source' : null };
                tables.push({ grid, row: null, cell: null, caption: null, start: at });
                push('table', end);
            }
            else if (t) {
                closeRow(t, at);
                tables.pop();
                const marker = sinks.map(s => s.kind).lastIndexOf('table');
                if (marker >= 0)
                    sinks.splice(marker);
                t.grid.anchors = [...new Set(t.grid.rows.flat().flatMap(c => c.anchors))];
                t.grid.span = { start: t.start, end, text: '' };
                if (t.grid.index < STRUCTURED_LIMITS.maxTablesPerSource)
                    out.grids.push(t.grid);
            }
            continue;
        }
        if (t && name === 'caption') {
            if (!closing)
                t.caption = push('caption', end);
            else if (t.caption) {
                pop(t.caption);
                t.grid.caption = { text: cleanText(t.caption.text), span: span(raw, t.caption.start, at) };
                t.caption = null;
            }
            continue;
        }
        if (t && name === 'tr') {
            closeRow(t, at);
            if (!closing)
                t.row = [];
            continue;
        }
        if (t && (name === 'td' || name === 'th')) {
            closeCell(t, at);
            if (!closing) {
                if (!t.row)
                    t.row = [];
                t.cell = { sink: push('cell', end), tag: attrs, header: name === 'th' };
            }
            continue;
        }
        if (name === 'ul' || name === 'ol') {
            if (!closing)
                lists.push({ list: { kind: 'HTML_LIST', index: lists.length + out.lists.length, heading: lastHeading, items: [] }, item: null });
            else {
                const l = lists.pop();
                if (l) {
                    closeItem(l, at);
                    if (out.lists.length < STRUCTURED_LIMITS.maxListsPerSource)
                        out.lists.push(l.list);
                }
            }
            continue;
        }
        if (name === 'li' && lists.length) {
            const l = lists.at(-1)!;
            closeItem(l, at);
            if (!closing)
                l.item = push('li', end);
            continue;
        }
        if (name === 'dl') {
            if (!closing)
                dls.push({ dl: { kind: 'DEFINITION_LIST', index: dls.length + out.definitions.length, heading: lastHeading, pairs: [] }, term: null, termItem: null, dd: null });
            else {
                const d = dls.pop();
                if (d) {
                    closeDl(d, at);
                    if (out.definitions.length < STRUCTURED_LIMITS.maxDefinitionListsPerSource)
                        out.definitions.push(d.dl);
                }
            }
            continue;
        }
        if ((name === 'dt' || name === 'dd') && dls.length) {
            const d = dls.at(-1)!;
            if (closing)
                (name === 'dt' ? finishTerm : finishDefinition)(d, at);
            else {
                closeDl(d, at);
                if (name === 'dt')
                    d.term = push('dt', end);
                else
                    d.dd = push('dd', end);
            }
            continue;
        }
        const h = name.match(/^h([1-4])$/);
        if (h) {
            if (!closing) {
                heading = { sink: push('heading', end), level: Number(h[1]) };
            }
            else if (heading) {
                pop(heading.sink);
                const value = { text: cleanText(heading.sink.text), span: span(raw, heading.sink.start, at) };
                out.headings.push({ level: heading.level, ...value });
                if (heading.level === 1 && !out.h1)
                    out.h1 = value;
                else if (heading.level > 1)
                    lastHeading = value;
                heading = null;
            }
        }
    }
    return out;
}
function parseJsonLd(body: string): { value: unknown; error: string | null } {
    if (Buffer.byteLength(body, 'utf8') > STRUCTURED_LIMITS.maxJsonLdBytes)
        return { value: null, error: 'JSONLD_SIZE' };
    try {
        const value = JSON.parse(body.trim()), depth = (x: unknown, d: number): number => d > STRUCTURED_LIMITS.maxJsonLdDepth ? d : x && typeof x === 'object' ? Math.max(d, ...Object.values(x as object).map(v => depth(v, d + 1))) : d;
        return depth(value, 0) > STRUCTURED_LIMITS.maxJsonLdDepth ? { value: null, error: 'JSONLD_DEPTH' } : { value, error: null };
    }
    catch {
        return { value: null, error: 'JSONLD_PARSE' };
    }
}
/** Supporting metadata only: never a fact. Unknown schemas are ignored. */
export function jsonLdSummary(parsed: ParsedHtml['jsonLd']) {
    const nodes: { type: string[]; name: string | null; alternateNames: string[]; publisherTypes: string[] }[] = [];
    const visit = (x: any, depth: number) => { if (!x || typeof x !== 'object' || depth > 3 || nodes.length > 16)
        return; if (Array.isArray(x)) {
        x.forEach(v => visit(v, depth + 1));
        return;
    } if (Array.isArray(x['@graph']))
        visit(x['@graph'], depth + 1); const type = ([] as unknown[]).concat(x['@type'] ?? []).filter((t): t is string => typeof t === 'string'); if (type.length) {
        const names = ([] as unknown[]).concat(x.alternateName ?? []).filter((n): n is string => typeof n === 'string' && n.length <= 100);
        const publisher = x.publisher && typeof x.publisher === 'object' ? ([] as unknown[]).concat(x.publisher['@type'] ?? []).filter((t): t is string => typeof t === 'string') : [];
        nodes.push({ type, name: typeof x.name === 'string' && x.name.length <= 200 ? x.name : null, alternateNames: names.slice(0, 10), publisherTypes: publisher });
    } };
    for (const block of parsed)
        if (!block.error)
            visit(block.value, 0);
    return nodes;
}
// ---------- CSV / TSV subset ----------
/** RFC4180-style subset. Cells are DATA: formulas are never evaluated and formula-like text is flagged and never parsed as a number. */
export function parseDelimited(raw: string, delimiter: ',' | '\t', index = 0): StructuredGrid {
    const rows: StructuredCell[][] = [];
    let row: StructuredCell[] = [], i = raw.charCodeAt(0) === 0xfeff ? 1 : 0, rejected: string | null = null;
    const cell = (start: number, end: number, text: string) => { if (text.length > STRUCTURED_LIMITS.maxCellChars)
        rejected ??= 'DATASET_LIMIT cell length'; row.push({ text: text.replace(/\s+/g, ' ').trim(), span: { start, end, text: raw.slice(start, end) }, header: rows.length === 0, scope: null, colspan: 1, rowspan: 1, anchors: [], links: [] }); };
    while (i <= raw.length && !rejected) {
        if (raw[i] === '"') {
            let j = i + 1, text = '';
            for (;;) {
                if (j >= raw.length) {
                    rejected = 'DATASET_PARSE unterminated quote';
                    break;
                }
                if (raw[j] === '"') {
                    if (raw[j + 1] === '"') {
                        text += '"';
                        j += 2;
                        continue;
                    }
                    break;
                }
                text += raw[j++];
            }
            if (rejected)
                break;
            cell(i + 1, j, text);
            i = j + 1;
            if (i < raw.length && raw[i] !== delimiter && raw[i] !== '\n' && raw[i] !== '\r') {
                rejected = 'DATASET_PARSE text after quote';
                break;
            }
        }
        else {
            let j = i;
            while (j < raw.length && raw[j] !== delimiter && raw[j] !== '\n' && raw[j] !== '\r')
                j++;
            cell(i, j, raw.slice(i, j));
            i = j;
        }
        if (i >= raw.length || raw[i] === '\n' || raw[i] === '\r') {
            if (row.some(c => c.text))
                rows.push(row);
            row = [];
            if (raw[i] === '\r' && raw[i + 1] === '\n')
                i++;
            i++;
            if (rows.length > STRUCTURED_LIMITS.maxDatasetRows)
                rejected = 'DATASET_LIMIT rows';
        }
        else
            i++;
        if (row.length > STRUCTURED_LIMITS.maxDatasetColumns)
            rejected = 'DATASET_LIMIT columns';
    }
    return { kind: 'DATASET', index, caption: null, rows, span: { start: 0, end: raw.length, text: '' }, nested: false, anchors: [], rejected };
}
export const formulaLike = (t: string) => /^[=+@]/.test(t) || /^-(?!\s*\d+(?:[.,]\d+)?\s*(?:°\s*[CF])?$)/.test(t);
// ---------- generic header vocabulary (EN + PT), no entity or domain seeds ----------
export type ColumnRole = { role: 'SUBJECT' | 'CONTAINER' | 'TEMPERATURE' | 'POPULATION' | 'RESIDENCY' | 'DATE' | 'UNKNOWN' | 'AMBIGUOUS_METRIC' | 'UNSUPPORTED_METRIC'; qualifiers: string[]; unit: '°C' | '°F' | null; year: string | null; reason: string };
export function headerUnit(text: string): '°C' | '°F' | null { const m = text.match(/°\s*([CF])\b|\b(celsius|fahrenheit)\b/i); return !m ? null : (m[1] ?? m[2]).toUpperCase().startsWith('C') ? '°C' : '°F'; }
/** Temperature context. Record lows of air temperature, monthly/daily/average values, surface or satellite estimates and wind chill are distinct facts. */
export function temperatureQualifiers(label: string): { qualifiers: string[]; supported: boolean; reason: string } | null {
    const n = normalize(label);
    const temp = /\btemp|°\s*[cf]\b|celsius|fahrenheit|\blows?\b|\bhighs?\b|\bminim|\bmaxim|\bcold|\bwind ?chill|\bfrio|\bsensacao termica/.test(n);
    if (!temp)
        return null;
    if (/wind ?chill|sensacao termica|apparent temperature|feels like/.test(n))
        return { qualifiers: ['WIND_CHILL'], supported: true, reason: 'Wind chill is not an air-temperature record' };
    const surface = /surface|skin temperature|ground temperature|superficie/.test(n), satellite = /satellite|remote sensing|satelite/.test(n);
    const recordLow = /record low|\blowest\b|absolute minimum|record minimum|minimum recorded|recorded minimum|all-time low|extreme minimum|coldest temperature|minima (?:absoluta|registrada)|recorde de (?:frio|minima)|menor temperatura/.test(n);
    const high = /record high|\bhighest\b|\bmaximum\b|\bmax\b|\bhighs?\b|mean maximum|\bmaxima\b|warmest|hottest/.test(n);
    if (high && !recordLow)
        return { qualifiers: [], supported: false, reason: 'MAXIMUM_NOT_SUPPORTED' };
    // Phase 22: "lowest maximum"/"highest minimum", day counts and time-of-day means are other statistics, not these qualifiers.
    if (recordLow && high || /\bhighest minimum\b/.test(n))
        return { qualifiers: [], supported: false, reason: 'STATISTIC_NOT_SUPPORTED lowest-maximum/highest-minimum' };
    if (/\b(?:number of days|days? (?:of|with|>=|<=|≥|≤|above|below))\b|\bdays\b.*[≥≤<>]/.test(n))
        return { qualifiers: [], supported: false, reason: 'STATISTIC_NOT_SUPPORTED day count' };
    if (/\b\d{1,2}\s?(?:am|pm)\b|\bat \d{1,2}(?::\d\d)?\b/.test(n))
        return { qualifiers: [], supported: false, reason: 'STATISTIC_NOT_SUPPORTED time-of-day mean' };
    if (recordLow && /\b(?:mean|average|avg)\b|\bmedia\b/.test(n))
        return { qualifiers: [], supported: false, reason: 'STATISTIC_NOT_SUPPORTED average of record extrema' };
    if (recordLow)
        return { qualifiers: [satellite ? 'SATELLITE_ESTIMATE' : surface ? 'SURFACE_TEMPERATURE_MINIMUM' : 'MINIMUM_RECORDED'], supported: true, reason: satellite || surface ? 'Surface/satellite minimum kept apart from recorded air minimum' : 'Explicit record-low label' };
    if (/monthly min|mean monthly minimum|minima mensal/.test(n))
        return { qualifiers: ['MONTHLY_MINIMUM'], supported: true, reason: 'Monthly minimum' };
    if (/daily min|average low|mean low|daily low|mean min\b|mean minimum|minima diaria|minima media/.test(n))
        return { qualifiers: ['AVERAGE_DAILY_MINIMUM'], supported: true, reason: 'Average of daily minima' };
    if (/\b(?:mean|average|avg)\b|daily mean|\bmedia\b/.test(n))
        return { qualifiers: ['AVERAGE'], supported: true, reason: 'Average temperature' };
    return { qualifiers: [], supported: false, reason: 'TABLE_METRIC_AMBIGUOUS temperature without qualifier' };
}
export function residencyFromText(text: string): Residency | null {
    const n = normalize(text);
    if (/\bno permanent (?:population|residents|inhabitants)|\buninhabited\b|\bunpopulated\b|\babandoned\b|desabitad|sem populacao permanente/.test(n))
        return 'UNINHABITED';
    if (/permanent settlement|assentamento permanente/.test(n))
        return 'PERMANENT_SETTLEMENT';
    if (/^permanent$|^permanente$|permanent(?:ly)? (?:population|inhabited|populated|residents)|year-round (?:population|residents)|populacao permanente/.test(n))
        return 'PERMANENT_POPULATION';
    if (/seasonal|sazonal/.test(n))
        return 'SEASONAL_PRESENCE';
    if (/temporar/.test(n))
        return /research|scien|pesquis/.test(n) ? 'TEMPORARY_RESEARCH_STAFF' : 'TEMPORARY_STAFF';
    if (/research (?:station|staff|personnel)|scientists|estacao de pesquisa|pesquisadores/.test(n))
        return 'RESEARCH_STAFF';
    return null;
}
export function classifyHeader(text: string): ColumnRole {
    const n = normalize(cleanText(text)), year = n.match(/\b(1[6-9]\d\d|20\d\d)\b/)?.[1] ?? null, base = { qualifiers: [] as string[], unit: headerUnit(text), year };
    if (!n)
        return { ...base, role: 'UNKNOWN', reason: 'empty header' };
    if (/^(?:place|location|locality|settlement|town|city|village|community|municipality|name|station|site|local|lugar|localidade|cidade|vila|municipio|povoado|assentamento)s?\b|^[a-z ]{0,30}\bname$/.test(n))
        return { ...base, role: 'SUBJECT', reason: 'Explicit place/name header' };
    if (/^(?:country|region|state|province|territory|district|federal subject|continent|pais|estado|regiao|provincia|territorio)s?\b/.test(n))
        return { ...base, role: 'CONTAINER', reason: 'Container header, not the row subject' };
    if (/^(?:date|year|data|ano|recorded on|date recorded)\b/.test(n))
        return { ...base, role: 'DATE', reason: 'Date header' };
    // Ranks, changes, densities and areas next to a population header are not counts.
    if (/\b(?:population|inhabitants|habitantes|populacao)\b/.test(n) && /\b(?:rank|ranking|change|growth|density|percent|area|posicao|variacao|densidade)\b|%|\/\s*km|per\s/.test(n))
        return { ...base, role: 'UNKNOWN', reason: 'Population-derived column (rank/change/density/area), not a count' };
    if (/\b(?:population|inhabitants|habitantes|populacao)\b/.test(n) && !/permanent|permanente/.test(n))
        return { ...base, role: 'POPULATION', qualifiers: ['POPULATION_COUNT', ...(/census|censo/.test(n) ? ['CENSUS'] : []), ...(/estimat|estimativa/.test(n) ? ['ESTIMATED_VALUE'] : [])], reason: 'Population count header' };
    if (/\b(?:residents|residency|presence|habitation|inhabited|human presence|status|presenca|residencia|permanent population|populacao permanente)\b/.test(n))
        return { ...base, role: 'RESIDENCY', reason: 'Residency/presence header' };
    const t = temperatureQualifiers(text);
    if (t)
        return t.supported ? { ...base, role: 'TEMPERATURE', qualifiers: t.qualifiers, reason: t.reason } : { ...base, role: /NOT_SUPPORTED/.test(t.reason) ? 'UNSUPPORTED_METRIC' : 'AMBIGUOUS_METRIC', reason: t.reason };
    return { ...base, role: 'UNKNOWN', reason: 'No supported header semantics' };
}
// ---------- value parsing ----------
export function parseTemperatureValue(text: string, unit: '°C' | '°F' | null, policy: ResearchPolicy, language: string): { quantity: Quantity; unitSource: 'CELL' | 'HEADER' | 'CAPTION' | 'NONE' } | { error: string } {
    let t = text.replace(/[−–—‒]/g, '-').replace(/\s+/g, ' ').trim();
    const approx = /^(?:c\.|ca\.|~|≈|about|approx\.?|aprox\.?|cerca de)\s*/i.exec(t);
    if (approx)
        t = t.slice(approx[0].length);
    const m = t.match(/^(-?\s?\d+(?:[.,]\d+)?)\s*(?:°\s*([CF]))?(?:\s*\(\s*-?\s?\d+(?:[.,]\d+)?\s*(?:°\s*[CF])?\s*\))?(?:\s*\((\d{4})\))?$/i);
    if (!m)
        return { error: 'TABLE_VALUE_NOT_A_MEASUREMENT' };
    const value = m[1].replace(/\s/g, '');
    if (value.includes(',') && language !== 'pt-BR')
        return { error: 'TABLE_VALUE_DECIMAL_AMBIGUOUS' };
    const cellUnit = m[2] ? (m[2].toUpperCase() === 'C' ? '°C' : '°F') as '°C' | '°F' : null;
    if (cellUnit && unit && cellUnit !== unit)
        return { error: 'TABLE_UNIT_CONFLICT' };
    const finalUnit = cellUnit ?? unit;
    if (!finalUnit)
        return { error: 'TABLE_UNIT_MISSING' };
    const n = Number(value.replace(',', '.')), f = finalUnit === '°F' && policy.allowFahrenheitConversion;
    return { quantity: { originalValue: value, originalUnit: finalUnit, normalizedValue: f ? (n - 32) * 5 / 9 : n, normalizedUnit: f ? '°C' : finalUnit, conversionRule: f ? 'F_TO_C' : 'IDENTITY', precision: (value.split(/[.,]/)[1] ?? '').length, approximation: approx ? 'APPROXIMATE' : 'AS_REPORTED' }, unitSource: cellUnit ? 'CELL' : 'HEADER' };
}
export function parsePopulationValue(text: string): { quantity: Quantity; year: string | null } | { error: string } {
    let t = text.replace(/\s+/g, ' ').trim();
    const approx = /^(?:c\.|ca\.|~|≈|about|approx\.?|aprox\.?|cerca de)\s*/i.exec(t);
    if (approx)
        t = t.slice(approx[0].length);
    const m = t.match(/^(\d{1,3}(?:[,   ]\d{3})+|\d+)(?:\s*\((\d{4})(?:\s*(?:census|censo|est\.?|estimate))?\))?$/i);
    if (!m)
        return { error: 'TABLE_VALUE_NOT_A_COUNT' };
    const n = Number(m[1].replace(/[,   ]/g, ''));
    return { quantity: { originalValue: m[1], originalUnit: 'PERSONS', normalizedValue: n, normalizedUnit: 'PERSONS', conversionRule: 'IDENTITY', precision: 0, approximation: approx ? 'APPROXIMATE' : 'AS_REPORTED' }, year: m[2] ?? null };
}
const fact = (subject: string, over: Partial<CanonicalFact>): CanonicalFact => ({ factType: 'MEASUREMENT', subject, predicate: 'MEASURED_TEMPERATURE', object: null, quantity: null, metric: 'TEMPERATURE', temporalContext: null, qualifiers: [], residency: null, ...over });
const subjectLike = (t: string) => t.length >= 2 && t.length <= 100 && /^[\p{Lu}\p{Lt}]/u.test(t) && !/^\d/.test(t) && !/\b(?:and|&|or|e|ou)\b|\//.test(t);
/** Subject named by a table title or caption ("... data for X (...)"). Never the first column by position. */
export function titleSubject(title: string): { subject: string; period: string | null } | null {
    // Subject ends at the first parenthesis/comma; trailing station identifiers, coordinates or notes are context, never part of the subject.
    const m = title.match(/^(?:\w+\s+)?(?:data|records?|extremes|normals|dados(?: climatol[oó]gicos)?|registros)\s+(?:for|of|at|de|para|em)\s+([^(,;]+?)\s*(?=[(,;]|$)([\s\S]*)$/i) ?? title.match(/^([^(,;]+?)\s+(?:climate|weather|clima)\s+(?:data|records?|dados)\s*([\s\S]*)$/i);
    if (!m || !subjectLike(m[1].trim()))
        return null;
    const parts = [...m[2].matchAll(/\(([^)]*)\)/g)].flatMap(p => p[1].split(/[,;]/)).map(s => s.trim()).filter(Boolean), extremes = parts.find(p => /extreme|record|recorde|extremo/i.test(p)) ?? m[2].match(/\b(?:extremes?|records?|extremos?)\s+\d{4}\s*[–-]\s*(?:present|\d{4}|atual)/i)?.[0] ?? null;
    return { subject: m[1].trim(), period: extremes ?? (parts.join(', ') || null) };
}
function subjectSpan(raw: string, container: SourceSpan, subject: string): SourceSpan { const at = raw.slice(container.start, container.end).indexOf(subject); return at >= 0 ? { start: container.start + at, end: container.start + at + subject.length, text: subject } : container; }
type Slot = { cell: StructuredCell; origin: boolean };
function layout(grid: StructuredGrid): { slots: Slot[][]; width: number } | { error: string } {
    const slots: Slot[][] = [];
    for (let r = 0; r < grid.rows.length; r++) {
        slots[r] ??= [];
        let c = 0;
        for (const cell of grid.rows[r]) {
            while (slots[r][c])
                c++;
            if (cell.colspan > STRUCTURED_LIMITS.maxSpan || cell.rowspan > STRUCTURED_LIMITS.maxSpan)
                return { error: 'STRUCTURED_TABLE_UNSUPPORTED span limit' };
            for (let dr = 0; dr < cell.rowspan; dr++)
                for (let dc = 0; dc < cell.colspan; dc++) {
                    const rr = r + dr;
                    if (rr >= grid.rows.length)
                        continue;
                    slots[rr] ??= [];
                    if (slots[rr][c + dc])
                        return { error: 'STRUCTURED_TABLE_UNSUPPORTED overlapping spans' };
                    slots[rr][c + dc] = { cell, origin: dr === 0 && dc === 0 };
                }
            c += cell.colspan;
        }
    }
    const width = Math.max(0, ...slots.map(r => r.length));
    if (width > STRUCTURED_LIMITS.maxColumnsPerTable)
        return { error: 'STRUCTURED_LIMIT columns' };
    if (slots.some(r => r.length !== width || r.some(s => !s)))
        return { error: 'STRUCTURED_TABLE_UNSUPPORTED ragged rows' };
    return { slots, width };
}
export interface GridInterpretation {
    summary: Omit<StructuredSummary, 'sourceId' | 'evidenceIds'>;
    facts: StructuredFact[];
}
/** Interprets a grid with restricted header semantics. Unknown, ambiguous or unresolvable structures abstain with a reason. */
/** v3: a subject inherited from the DocumentContext for a table that names none itself. */
export type InheritedSubject = { name: string; kind: 'STATION' | 'PLACE'; source: SubjectSource; spans: SourceSpan[] } | { ambiguity: string };
export interface GridOptions {
    version: 3;
    inherit: (grid: StructuredGrid) => InheritedSubject | null;
}
export function interpretGrid(raw: string, grid: StructuredGrid, policy: ResearchPolicy, language: string, docSubject: { name: string; spans: SourceSpan[] } | null, options?: GridOptions): GridInterpretation {
    const kind: StructuredKind = grid.kind, summary = (status: 'PARSED' | 'REJECTED', reason: string, rows = grid.rows.length, columns = 0) => ({ kind, index: grid.index, status, reason, rows, columns, caption: grid.caption?.text ?? null });
    if (grid.rejected)
        return { summary: summary('REJECTED', grid.rejected), facts: [] };
    if (grid.nested)
        return { summary: summary('REJECTED', 'STRUCTURED_TABLE_UNSUPPORTED nested table'), facts: [] };
    const l = layout(grid);
    if ('error' in l)
        return { summary: summary('REJECTED', l.error), facts: [] };
    const { slots, width } = l, method = kind === 'DATASET' ? 'DATASET_V2' as const : 'TABLE_HTML_V2' as const;
    // A single cell spanning the whole first row is a title, not a header level.
    const titleRow = width > 1 && slots[0]?.every(s => s.cell === slots[0][0].cell) && kind === 'HTML_TABLE' ? slots[0][0].cell : null;
    const title = titleRow ? { text: titleRow.text, span: titleRow.span } : grid.caption;
    let first = titleRow ? 1 : 0, headerRows = 0;
    if (kind === 'DATASET')
        headerRows = 1;
    else
        // v3: after the first header row, a row led by a cell spanning half the table is a section label, not a header level.
        while (first + headerRows < slots.length && slots[first + headerRows].every(s => s.cell.header) && headerRows < 4 && !(options?.version === 3 && headerRows > 0 && slots[first + headerRows][0].cell.colspan * 2 >= width))
            headerRows++;
    const body = slots.slice(first + headerRows), facts: StructuredFact[] = [];
    const ctxSpans = (extra: SourceSpan[]) => [...(title ? [title.span] : []), ...extra].filter((s, i, a) => s.end > s.start && a.findIndex(x => x.start === s.start && x.end === s.end) === i);
    // Single-subject structures carry the table-level footnotes; row-subject tables only carry their own row's footnotes.
    // Both also carry the dataset attribution stated in the section text that introduces the table.
    const attribution = kind === 'HTML_TABLE' ? tableAttributionAnchors(raw, grid.span.start) : [];
    const headerAnchors = [...slots.slice(0, first + headerRows).flat().flatMap(s => s.cell.anchors), ...attribution];
    const make = (f: CanonicalFact, cell: StructuredCell, r: number, c: number, rowHeader: StructuredCell | null, colHeader: { text: string; spans: SourceSpan[] } | null, subject: SourceSpan | null, unitSource: StructuredProvenance['unitSource'], m: StructuredFact['method'], extraContext: SourceSpan[], anchors: string[], subjectSource?: SubjectSource) => { const headerSpans = [...(colHeader?.spans ?? []), ...(rowHeader ? [rowHeader.span] : [])]; facts.push({ fact: f, span: cell.span, normalizedText: cell.text, method: m, structured: { kind: m === 'KEY_VALUE_HTML_V2' ? 'KEY_VALUE' : kind, structureIndex: grid.index, row: r, column: c, rowHeader: rowHeader?.text ?? null, columnHeader: colHeader?.text ?? null, headerSpans, captionSpan: title?.span ?? null, subjectSpan: subject, unitSource, ...(subjectSource ? { subjectSource } : {}) }, contextSpans: ctxSpans([...headerSpans, ...(subject ? [subject] : []), ...extraContext]), anchors: [...new Set([...cell.anchors, ...anchors])], links: cell.links, headerSpan: headerSpans[0] ?? null }); };
    // Key/value structures (infobox-like): label/value rows, optionally separated by full-width section rows.
    const kvRows = slots.slice(first), pairs = kvRows.filter(r => r[0].cell !== r[1]?.cell);
    const kv = width === 2 && pairs.length >= 2 && pairs.every(r => r[0].cell.header && !r[1].cell.header);
    if (kv) {
        const titled = title ? titleSubject(title.text) ?? (subjectLike(title.text) ? { subject: title.text, period: null } : null) : null;
        const named = titled && docSubject && normalize(titled.subject).startsWith(normalize(docSubject.name)) ? { subject: docSubject.name, period: titled.period } : titled;
        const subject = named ? { name: named.subject, spans: [subjectSpan(raw, title!.span, named.subject)] } : docSubject;
        if (!subject)
            return { summary: summary('REJECTED', 'TABLE_SUBJECT_AMBIGUOUS key/value without title or document subject', kvRows.length, 2), facts: [] };
        let section: StructuredCell | null = null;
        for (const [i, row] of kvRows.entries()) {
            if (row[0].cell === row[1].cell) {
                section = row[0].cell;
                continue;
            }
            const label = row[0].cell, value = row[1].cell, inherited = /^[•·\-–]\s*/.test(label.text) && section ? section : null, text = (inherited ? inherited.text + ' ' : '') + label.text.replace(/^[•·\-–]\s*/, ''), role = classifyHeader(text), headers = { text, spans: [...(inherited ? [inherited.span] : []), label.span] }, r = first + i;
            if (!inherited && !/^[•·\-–]/.test(label.text))
                section = null;
            if (role.role === 'TEMPERATURE') {
                const v = parseTemperatureValue(value.text, role.unit, policy, language);
                if ('quantity' in v)
                    make(fact(subject.name, { quantity: v.quantity, qualifiers: [...role.qualifiers, ...(v.quantity.approximation === 'APPROXIMATE' ? ['APPROXIMATE'] : [])], observationPeriod: named?.period ?? null }), value, r, 1, null, headers, subject.spans[0] ?? null, v.unitSource, 'KEY_VALUE_HTML_V2', subject.spans, [...grid.anchors, ...attribution]);
            }
            if (role.role === 'POPULATION') {
                const v = parsePopulationValue(value.text);
                if ('quantity' in v)
                    make(fact(subject.name, { factType: 'QUANTITY', predicate: 'POPULATION_COUNT', metric: 'POPULATION', quantity: v.quantity, qualifiers: [...role.qualifiers, ...(v.quantity.approximation === 'APPROXIMATE' ? ['APPROXIMATE'] : [])], temporalContext: v.year ?? role.year }), value, r, 1, null, headers, subject.spans[0] ?? null, 'NONE', 'KEY_VALUE_HTML_V2', subject.spans, [...grid.anchors, ...attribution]);
            }
            if (role.role === 'RESIDENCY') {
                const residency = residencyFromText(value.text);
                if (residency)
                    make(fact(subject.name, { factType: 'RESIDENCY', predicate: 'HUMAN_PRESENCE', metric: null, residency, object: residency, qualifiers: [residency], temporalContext: role.year }), value, r, 1, null, headers, subject.spans[0] ?? null, 'NONE', 'KEY_VALUE_HTML_V2', subject.spans, [...grid.anchors, ...attribution]);
            }
        }
        return { summary: summary('PARSED', facts.length ? 'Key/value structure' : 'Key/value structure without supported labels', kvRows.length, 2), facts };
    }
    if (headerRows === 0)
        return { summary: summary('REJECTED', 'TABLE_HEADER_MISSING', body.length, width), facts: [] };
    if (headerRows > 2)
        return { summary: summary('REJECTED', 'STRUCTURED_TABLE_UNSUPPORTED header hierarchy deeper than two rows', body.length, width), facts: [] };
    // Header hierarchy: parent / child only when every column resolves to header cells.
    const headers: { text: string; spans: SourceSpan[] }[] = [];
    for (let c = 0; c < width; c++) {
        const cells = slots.slice(first, first + headerRows).map(r => r[c].cell).filter((x, i, a) => a.indexOf(x) === i);
        headers.push({ text: cells.map(x => x.text).filter(Boolean).join(' / '), spans: cells.map(x => x.span) });
    }
    const roles = headers.map(h => classifyHeader(h.text)), captionUnit = title ? headerUnit(title.text) : null;
    // V4 dataset matching needs administrative columns as context beside an explicit locality/name column.
    if(policy.researchVersion===4&&headers.some(h=>/^(?:place|locality|city|town|village|settlement|name)$/i.test(h.text.trim())))
        for(let i=0;i<headers.length;i++)if(/^(?:country|state|province|region|administrative context|(?:site|station|entity|locality|place) (?:id|code|number))$/i.test(headers[i].text.trim()))roles[i]={...roles[i],role:'CONTAINER',reason:'V4 explicit identifier/administrative context beside a locality subject'};
    // Transposed metric tables: row headers carry metrics and an explicit annual column carries the aggregate.
    const annual = headers.findIndex((h, i) => i > 0 && /^(?:year|annual|ano|anual)$/i.test(cleanText(h.text.split(' / ').at(-1) ?? '')));
    // v3 accepts metric row labels written as plain cells (many official tables use <td> labels).
    const rowLabel = (r: Slot[]) => (r[0].cell.header || options?.version === 3) && classifyHeader(r[0].cell.text).role === 'TEMPERATURE';
    const rowMetrics = body.filter(rowLabel);
    if (annual > 0 && rowMetrics.length) {
        const named = title ? titleSubject(title.text) : null;
        // v3: a table without its own subject may inherit one only when the DocumentContext resolves it unambiguously.
        const inherited = !named && options ? options.inherit(grid) : null;
        if (!named && (!inherited || 'ambiguity' in inherited))
            return { summary: summary('REJECTED', inherited && 'ambiguity' in inherited ? inherited.ambiguity : 'TABLE_SUBJECT_AMBIGUOUS transposed table without explicit subject title', body.length, width), facts: [] };
        const ctx = inherited && !('ambiguity' in inherited) ? inherited : null, subjectName = named?.subject ?? ctx!.name, subject = named ? subjectSpan(raw, title!.span, named.subject) : ctx!.spans[0] ?? null;
        // v3: an explicit period-of-record column ('Years' with two years) bounds the record when the title gives none.
        const years = options?.version === 3 ? headers.findIndex((h, i) => i > annual && /^(?:years?|period|record period)$/i.test(cleanText(h.text.split(' / ').at(-1) ?? ''))) : -1;
        for (const [i, row] of body.entries()) {
            const label = row[0].cell, role = classifyHeader(label.text);
            if (!rowLabel(row) || !row[annual].origin)
                continue;
            const span = years > 0 ? row.slice(years).map(s => s.cell.text).join(' ').match(/\b(1[6-9]\d\d|20\d\d)\D+(1[6-9]\d\d|20\d\d)\b/) : null, period = named?.period ?? (span ? span[1] + '–' + span[2] : null);
            const v = parseTemperatureValue(row[annual].cell.text, role.unit ?? captionUnit, policy, language);
            if ('quantity' in v && role.qualifiers.length)
                make(fact(subjectName, { quantity: v.quantity, qualifiers: [...role.qualifiers, ...(v.quantity.approximation === 'APPROXIMATE' ? ['APPROXIMATE'] : [])], observationPeriod: period, ...(ctx?.kind === 'STATION' ? { subjectKind: 'STATION' as const } : {}) }), row[annual].cell, first + headerRows + i, annual, label, headers[annual], subject, v.unitSource === 'CELL' ? 'CELL' : role.unit ? 'HEADER' : 'CAPTION', method, ctx ? ctx.spans.slice(1) : [], [...grid.anchors, ...attribution], ctx?.source);
        }
        return { summary: summary('PARSED', 'Transposed metric table; annual column only, monthly columns not extracted', body.length, width), facts };
    }
    const subjects = roles.flatMap((r, i) => r.role === 'SUBJECT' ? [i] : []);
    const measured = roles.some(r => ['TEMPERATURE', 'POPULATION', 'RESIDENCY'].includes(r.role));
    if (!measured)
        return { summary: summary('REJECTED', roles.some(r => r.role === 'AMBIGUOUS_METRIC') ? 'TABLE_METRIC_AMBIGUOUS' : 'TABLE_NO_SUPPORTED_COLUMNS', body.length, width), facts: [] };
    if (subjects.length !== 1)
        return { summary: summary('REJECTED', subjects.length ? 'TABLE_SUBJECT_AMBIGUOUS multiple subject columns' : 'TABLE_SUBJECT_AMBIGUOUS no explicit subject column', body.length, width), facts: [] };
    const sc = subjects[0], dates = roles.flatMap((r, i) => r.role === 'DATE' ? [i] : []);
    for (const [i, row] of body.entries()) {
        const r = first + headerRows + i, subjectCell = row[sc].cell, name = subjectCell.text.split(',')[0].replace(/[\s†‡§¶*#]+$/u, '').trim();
        if (!subjectLike(name))
            continue;
        const sSpan = subjectSpan(raw, subjectCell.span, name), date = dates.length === 1 ? row[dates[0]].cell : null, rowAnchors = [...headerAnchors, ...row.flatMap(s => s.cell.anchors)];
        for (let c = 0; c < width; c++) {
            const role = roles[c], cell = row[c].cell;
            if (c === sc || !cell.text || formulaLike(cell.text) && role.role !== 'TEMPERATURE')
                continue;
            if (role.role === 'TEMPERATURE' && role.qualifiers.length) {
                const v = parseTemperatureValue(cell.text, role.unit ?? captionUnit, policy, language);
                if ('quantity' in v)
                    make(fact(name, { quantity: v.quantity, qualifiers: [...role.qualifiers, ...(v.quantity.approximation === 'APPROXIMATE' ? ['APPROXIMATE'] : [])], temporalContext: date && /\d{4}/.test(date.text) ? date.text : null }), cell, r, c, null, headers[c], sSpan, v.unitSource === 'CELL' ? 'CELL' : role.unit ? 'HEADER' : 'CAPTION', method, date ? [date.span] : [], rowAnchors);
            }
            if (role.role === 'POPULATION') {
                const v = parsePopulationValue(cell.text);
                if ('quantity' in v)
                    make(fact(name, { factType: 'QUANTITY', predicate: 'POPULATION_COUNT', metric: 'POPULATION', quantity: v.quantity, qualifiers: [...role.qualifiers, ...(v.quantity.approximation === 'APPROXIMATE' ? ['APPROXIMATE'] : [])], temporalContext: v.year ?? role.year }), cell, r, c, null, headers[c], sSpan, 'NONE', method, [], rowAnchors);
            }
            if (role.role === 'RESIDENCY') {
                const residency = residencyFromText(cell.text);
                if (residency)
                    make(fact(name, { factType: 'RESIDENCY', predicate: 'HUMAN_PRESENCE', metric: null, residency, object: residency, qualifiers: [residency], temporalContext: role.year }), cell, r, c, null, headers[c], sSpan, 'NONE', method, [], rowAnchors);
            }
        }
    }
    return { summary: summary('PARSED', 'Row-subject table with explicit header semantics', body.length, width), facts };
}
const valuePattern = /([−–\-]?\s?\d+(?:\.\d+)?)\s*°\s*([CF])/;
/** "Entity — value" / "Entity: value" items. Metric must be explicit in the item or in the nearest heading; list position never implies meaning. */
export function interpretList(list: StructuredList | DefinitionList, policy: ResearchPolicy, language: string, docSubject: { name: string; spans: SourceSpan[] } | null): GridInterpretation {
    const facts: StructuredFact[] = [], kind = list.kind, method = kind === 'HTML_LIST' ? 'LIST_HTML_V2' as const : 'DEFINITION_HTML_V2' as const, headingMetric = list.heading ? temperatureQualifiers(list.heading.text) : null;
    const items = kind === 'HTML_LIST' ? list.items.map(i => ({ label: null as StructuredItem | null, item: i })) : list.pairs.map(p => ({ label: p.term, item: p.definition }));
    for (const [row, { label, item }] of items.entries()) {
        let subject: string | null = null, subjectSpanValue: SourceSpan | null = null, rest = item.text, context: SourceSpan[] = [];
        if (label) {
            const role = classifyHeader(label.text);
            if (role.role === 'TEMPERATURE' && docSubject) {
                subject = docSubject.name;
                context = [label.span, ...docSubject.spans];
                rest = label.text + ' ' + item.text;
            }
            else if (subjectLike(label.text)) {
                subject = label.text;
                subjectSpanValue = label.span;
            }
        }
        else {
            const m = item.text.match(/^([\p{Lu}][\p{L}\p{M}'’ .-]{1,80}?)(?:,[^—–:]{1,60})?\s*(?:—|–|:| - )\s*(.+)$/u);
            if (m && subjectLike(m[1].trim())) {
                subject = m[1].trim();
                rest = m[2];
                const at = item.span.text.indexOf(subject);
                subjectSpanValue = at >= 0 ? { start: item.span.start + at, end: item.span.start + at + subject.length, text: subject } : null;
            }
        }
        if (!subject)
            continue;
        const own = temperatureQualifiers(rest.replace(valuePattern, '')), metric = own?.supported && own.qualifiers.length ? own : headingMetric?.supported && headingMetric.qualifiers.length ? headingMetric : null;
        const values = [...rest.matchAll(new RegExp(valuePattern, 'g'))], celsius = values.filter(v => v[2].toUpperCase() === 'C'), v = celsius.length === 1 ? celsius[0] : values.length === 1 ? values[0] : null;
        if (!metric || !v || /\b(?:not|never|unofficial|disputed|unconfirmed|claimed|may|might|could)\b/i.test(rest))
            continue;
        const parsed = parseTemperatureValue(v[0], null, policy, language);
        if (!('quantity' in parsed))
            continue;
        const year = rest.match(/\b(?:on|in|em)?\s*((?:\d{1,2}\s+[A-Z][a-z]+\s+)?(?:1[6-9]|20)\d{2})\b/)?.[1] ?? null;
        if (!own?.supported && list.heading)
            context.push(list.heading.span);
        facts.push({ fact: fact(subject, { quantity: parsed.quantity, qualifiers: [...metric.qualifiers, ...(/\b(?:approximately|about|around|cerca de)\b/i.test(rest) ? ['APPROXIMATE'] : [])], temporalContext: year }), span: item.span, normalizedText: item.text, method, structured: { kind, structureIndex: list.index, row, column: label ? 1 : 0, rowHeader: label?.text ?? null, columnHeader: own?.supported ? null : list.heading?.text ?? null, headerSpans: label ? [label.span] : [], captionSpan: list.heading?.span ?? null, subjectSpan: subjectSpanValue, unitSource: 'CELL' }, contextSpans: [...context, ...(subjectSpanValue ? [subjectSpanValue] : [])], anchors: item.anchors, links: item.links, headerSpan: null });
    }
    const n = kind === 'HTML_LIST' ? list.items.length : list.pairs.length;
    return { summary: { kind, index: list.index, status: 'PARSED', reason: facts.length ? 'Explicit entity/value items' : 'No explicit measurement items', rows: n, columns: kind === 'HTML_LIST' ? 1 : 2, caption: list.heading?.text ?? null }, facts };
}
// ---------- references attached to evidence ----------
/** Element extent for an id, bounded; nested same-name elements are counted. */
export function fragmentExtent(raw: string, id: string): SourceSpan | null {
    if (!/^[\w:.\-]{1,120}$/.test(id))
        return null;
    const m = new RegExp('<([a-z0-9]+)\\b[^>]*\\sid=["\']' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\']', 'i').exec(raw);
    if (!m)
        return null;
    const name = m[1].toLowerCase(), open = new RegExp('<\\s*(/?)\\s*' + name + '\\b', 'gi');
    open.lastIndex = m.index + 1;
    let depth = 1, at: RegExpExecArray | null;
    while ((at = open.exec(raw)) && at.index - m.index < STRUCTURED_LIMITS.maxFragmentChars) {
        depth += at[1] ? -1 : 1;
        if (!depth)
            return { start: m.index, end: raw.indexOf('>', at.index) + 1, text: raw.slice(m.index, raw.indexOf('>', at.index) + 1) };
    }
    return null;
}
export function externalLinks(fragment: string, sourceHost: string | null): string[] {
    const out: string[] = [];
    for (const m of fragment.matchAll(/<a\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
        const a = attributes(m[0]), href = a.href ?? '';
        if (!/^https?:\/\//i.test(href) || /mw:WikiLink/i.test(a.rel ?? ''))
            continue;
        try {
            const u = canonicalUrl(href);
            if (!sourceHost || new URL(u).hostname !== sourceHost)
                out.push(u);
        }
        catch { }
    }
    return [...new Set(out)];
}
/** Dataset attribution: footnotes in the section text that introduces a table (after the last heading, at most 6000 chars), only when that text states a data source. */
export function tableAttributionAnchors(raw: string, tableStart: number): string[] {
    const before = raw.slice(Math.max(0, tableStart - 6000), tableStart), heading = Math.max(before.lastIndexOf('</h2'), before.lastIndexOf('</h3'), before.lastIndexOf('</h4')), section = before.slice(Math.max(0, heading));
    if (!/\b(?:census|survey|data(?:set)?|sources?|sourced|according to|estimated|enumerated|statistics|censo|recenseamento|fonte|dados)\b/i.test(section.replace(/<[^>]*>/g, ' ')))
        return [];
    return [...new Set([...section.matchAll(/href=["']#([^"']+)["']/g)].map(m => m[1]))].slice(0, 6);
}
/** Footnote anchors inside a raw span plus footnote markers directly following it, resolved to external URLs. */
export function attachedCitations(raw: string, start: number, end: number, sourceHost: string | null, extraAnchors: string[] = [], inlineLinks: string[] = []): string[] {
    const anchors = new Set(extraAnchors), slice = raw.slice(start, end);
    for (const m of slice.matchAll(/href=["']#([^"']+)["']/g))
        anchors.add(m[1]);
    let tail = end;
    for (;;) {
        const rest = raw.slice(tail, tail + 4000), sup = rest.match(/^\s*(?:<\/?(?:span|i|b)\b[^>]*>\s*)*<sup\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/sup>/i);
        if (!sup)
            break;
        for (const m of sup[0].matchAll(/href=["']#([^"']+)["']/g))
            anchors.add(m[1]);
        tail += sup[0].length;
    }
    const urls = [...inlineLinks, ...externalLinks(slice, sourceHost)];
    for (const id of anchors) {
        const extent = fragmentExtent(raw, id);
        if (extent)
            urls.push(...externalLinks(extent.text, sourceHost));
    }
    return [...new Set(urls)].sort().slice(0, STRUCTURED_LIMITS.maxCitationsPerEvidence);
}
/** Contextual document subject: an h1 plus a lead stating it is a populated place or station. */
export function documentSubject(doc: SourceDocument, parsed: ParsedHtml): { name: string; spans: SourceSpan[] } | null {
    if (!parsed.h1 || !subjectLike(parsed.h1.text))
        return null;
    const name = parsed.h1.text, text = doc.normalized.text, lead = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^\\n]{0,180}\\bis (?:an? |the )[^\\n]{0,100}\\b(?:town|city|village|settlement|hamlet|municipality|community|locality|research station|weather station|scientific station)\\b', 'i').exec(text);
    if (!lead)
        return null;
    const a = doc.normalized.mapping[lead.index].start, b = doc.normalized.mapping[lead.index + lead[0].length - 1].end;
    return { name, spans: [parsed.h1.span, { start: a, end: b, text: doc.content.slice(a, b) }] };
}
export function hostOf(locator: string) { try {
    return new URL(locator).hostname;
}
catch {
    return null;
} }
