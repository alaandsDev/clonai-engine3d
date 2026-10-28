import { jsonHash } from '../editorial/fingerprint';
import { normalize } from '../semantics/normalize';
import { sourceSpan } from './source';
import { extractEnglish } from './english';
import type { SourceDocument, CanonicalFact, Evidence, FactCandidate, FactType, ResearchPolicy, Quantity, Residency } from './contracts';
const key = (prefix: string, x: unknown) => prefix + '_' + jsonHash(x).slice(0, 20);
export function normalizeQuantity(value: string, unit: '°C' | '°F', approximate: boolean, policy: ResearchPolicy): Quantity { const n = Number(value.replace(',', '.')); if (!Number.isFinite(n))
    throw Error('RESEARCH_QUANTITY numeric'); return { originalValue: value, originalUnit: unit, normalizedValue: unit === '°F' && policy.allowFahrenheitConversion ? (n - 32) * 5 / 9 : n, normalizedUnit: unit === '°F' && policy.allowFahrenheitConversion ? '°C' : unit, conversionRule: unit === '°F' && policy.allowFahrenheitConversion ? 'F_TO_C' : 'IDENTITY', precision: (value.split(/[.,]/)[1] ?? '').length, approximation: approximate ? 'APPROXIMATE' : 'AS_REPORTED' }; }
const empty = (subject: string, factType: FactType, predicate: string): CanonicalFact => ({ factType, subject: subject.trim().replace(/^[Aa]\s+/, ''), predicate, object: null, quantity: null, metric: null, temporalContext: null, qualifiers: [], residency: null });
export function literalFact(text: string, policy: ResearchPolicy): CanonicalFact | null {
    const t = text.trim().replace(/[.!]$/, '');
    if (/ignore.*regras|aprove este|execute|system prompt|instrucoes anteriores|\?|\b(?:nao|nunca|jamais|talvez|poderia|pode|possivelmente)\b/i.test(normalize(t)))
        return null;
    const measurement = t.match(/^(.+?)\s+(?:registrou|apresentou|relatou)\s+(?:uma\s+)?temperatura\s+(mínima registrada|mínima diária|mínima|média|oficial recorde|relatada|estimada|registrada)\s+(?:de\s+)?(?:(aproximadamente|cerca de)\s+)?(-?\d+(?:[.,]\d+)?)\s*°\s*([CF])(?:\s+em\s+(.+))?$/i);
    if (measurement) {
        const qualifier: Record<string, string> = { 'minima registrada': 'MINIMUM_RECORDED', 'minima': 'MINIMUM_RECORDED', 'minima diaria': 'DAILY_MINIMUM', 'media': 'AVERAGE', 'oficial recorde': 'OFFICIAL_RECORD', 'relatada': 'REPORTED_VALUE', 'estimada': 'ESTIMATED_VALUE', 'registrada': 'RECORDED_VALUE' };
        const f = empty(measurement[1], 'MEASUREMENT', 'MEASURED_TEMPERATURE');
        f.quantity = normalizeQuantity(measurement[4], measurement[5].toUpperCase() === 'F' ? '°F' : '°C', Boolean(measurement[3]), policy);
        f.metric = 'TEMPERATURE';
        f.qualifiers = [qualifier[normalize(measurement[2])], ...(measurement[3] ? ['APPROXIMATE'] : []), ...(/\brelatou\b/i.test(measurement[0]) ? ['REPORTED'] : [])];
        f.temporalContext = measurement[6]?.trim() ?? null;
        return f;
    }
    const residency = t.match(/^(.+?)\s+(?:possui|tem)\s+(população permanente|assentamento permanente|presença sazonal)$/i) ?? t.match(/^Há\s+(população permanente|assentamento permanente|presença sazonal)\s+na\s+(.+)$/i)?.map((x, i, a) => i === 1 ? a[2] : i === 2 ? a[1] : x);
    if (residency) {
        const f = empty(residency[1], 'RESIDENCY', 'HUMAN_PRESENCE');
        const table: Record<string, Residency> = { 'populacao permanente': 'PERMANENT_POPULATION', 'assentamento permanente': 'PERMANENT_SETTLEMENT', 'presenca sazonal': 'SEASONAL_PRESENCE' };
        f.residency = table[normalize(residency[2])];
        f.object = f.residency;
        f.qualifiers = [f.residency];
        return f;
    }
    const staff = t.match(/^(.+?)\s+abriga pesquisadores temporariamente$/i);
    if (staff) {
        const f = empty(staff[1], 'RESIDENCY', 'HUMAN_PRESENCE');
        f.residency = 'TEMPORARY_RESEARCH_STAFF';
        f.object = f.residency;
        f.qualifiers = ['TEMPORARY_RESEARCH_STAFF'];
        return f;
    }
    return null;
}
function tableFact(headers: string[], cells: string[], policy: ResearchPolicy): CanonicalFact | null {
    const h = headers.map(normalize);
    if (h.join('|') === 'sujeito|processo|complemento|contexto' && cells.length === 4) {
        const predicates: Record<string, string> = { saida: 'EXIT', percurso: 'FLOW', entrada: 'ENTER', aumento: 'INCREASE', operacao: 'OPERATE' };
        const predicate = predicates[normalize(cells[1])];
        if (!predicate)
            return null;
        const f = empty(cells[0], 'PROCESS', predicate);
        f.object = cells[2];
        f.temporalContext = cells[3];
        f.qualifiers = [normalize(cells[3]).includes('ficticio') ? 'DEMO_EXPERIMENT' : 'REPORTED_PROCESS'];
        return f;
    }
    if (h.join('|') === 'local|metrica|valor|unidade|contexto|presenca' && cells.length === 6) {
        return literalFact(cells[0] + ' registrou temperatura ' + cells[1] + ' de ' + cells[2] + ' ' + cells[3] + ' em ' + cells[4], policy);
    }
    return null;
}
export function extractSourceEvidence(s: SourceDocument, policy: ResearchPolicy, maxItems = 256): {
    evidence: Evidence[];
    candidates: FactCandidate[];
} {
    if (s.language === 'en' && policy.allowEnglishExtraction)
        return extractEnglish(s, policy, maxItems);
    if (s.language !== 'pt-BR')
        return { evidence: [], candidates: [] };
    const evidence: Evidence[] = [], candidates: FactCandidate[] = [];
    const add = (fact: CanonicalFact, start: number, end: number, method: Evidence['extractionMethod'], table: Evidence['table']) => { if (evidence.length >= maxItems)
        throw Error('RESEARCH_EVIDENCE_BUDGET'); const span = sourceSpan(s, start, end), raw = { version: 1 as const, id: key('EV', { source: s.id, hash: s.contentHash, span, type: fact.factType }), sourceId: s.id, sourceSpan: span, exactText: span.text, normalizedText: s.normalized.text.slice(start, end), evidenceType: fact.factType, supports: fact, extractionConfidence: 'HIGH' as const, truthStatus: 'EXTRACTED' as const, extractionMethod: method, contentHash: s.contentHash, table }; const e = { ...raw, fingerprint: jsonHash(raw) }; evidence.push(e); const f = { id: key('FC', { fact, evidence: e.id }), canonicalFact: structuredClone(fact), evidenceIds: [e.id], extractionConfidence: 'HIGH' as const, status: 'EXTRACTED' as const }; candidates.push({ ...f, fingerprint: jsonHash(f) }); };
    let header: {
        cells: string[];
        start: number;
        end: number;
    } | null = null, row = 0;
    for (const line of s.normalized.text.matchAll(/[^\n]+/g)) {
        const rawLine = line[0], trim = rawLine.trim(), start = line.index! + rawLine.indexOf(trim), end = start + trim.length;
        if (!trim || /ignore.*regras|aprove este|instrucoes anteriores|\?|\b(?:nao|nunca|jamais|talvez|poderia|pode|possivelmente)\b/i.test(normalize(trim)))
            continue;
        if (trim.includes('\t')) {
            const cells = trim.split('\t').map(x => x.trim()).filter((v, i, a) => v || i < a.length - 1);
            if (!header || cells.some(c => /^(?:sujeito|processo|local|métrica)$/i.test(c))) {
                header = { cells, start, end };
                row = 0;
                continue;
            }
            row++;
            const fact = tableFact(header.cells, cells, policy);
            const context = { row, column: header.cells.some(c => normalize(c) === 'valor') ? 3 : 2, headerContext: header.cells.join(' | '), headerSpan: sourceSpan(s, header.start, header.end) };
            if (fact)
                add(fact, start, end, 'TABLE_PT_V1', context);
            if (header.cells.map(normalize).join('|') === 'local|metrica|valor|unidade|contexto|presenca' && cells.length === 6) {
                const residency = literalFact(cells[0] + ' possui ' + cells[5], policy);
                if (residency) {
                    residency.temporalContext = cells[4];
                    add(residency, start, end, 'TABLE_PT_V1', { ...context, column: 6 });
                }
            }
            continue;
        }
        for (const part of trim.matchAll(/[\s\S]+?(?:[.!?](?=\s|$)|$)/g)) {
            const text = part[0].trim(), at = start + part.index! + part[0].indexOf(text);
            const fact = literalFact(text, policy);
            if (fact)
                add(fact, at, at + text.length, 'LITERAL_PT_V1', null);
        }
    }
    return { evidence: evidence.sort((a, b) => a.id.localeCompare(b.id, 'en')), candidates: candidates.sort((a, b) => a.id.localeCompare(b.id, 'en')) };
}
