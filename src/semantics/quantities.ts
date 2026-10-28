import type { NormalizedQuantity, SemanticUnit } from './contracts';
import { normalizedView } from './normalize';
const words: Record<string, number> = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100 };
const ordinal: Record<string, number> = { primeiro: 1, segundo: 2, terceiro: 3, quarto: 4, quinto: 5, sexto: 6, setimo: 7, oitavo: 8, nono: 9, decimo: 10 };
export const quantityRules = { words, ordinal, numeric: 'signed decimal or closed Portuguese words <=100; unit required for word values', units: ['°C', 'graus', '%', 'por cento', 'quilômetros', 'metros', 'horas', 'minutos', 'segundos', 'km/h', 'm/s', 'número', 'ranking'] };
function parseNumber(raw: string): number | null {
    const neg = /^-|^menos\b|negativ/.test(raw);
    const value = raw.replace(/^menos\s+|^-|\s+negativ[oa]s?/g, '').trim();
    if (/^\d+(?:[.,]\d+)?$/.test(value))
        return (neg ? -1 : 1) * Number(value.replace(',', '.'));
    const parts = value.split(/\s+e\s+|\s+/);
    if (parts.some(p => words[p] === undefined))
        return null;
    if (parts.length > 2 || parts.length === 2 && (words[parts[0]] < 20 || words[parts[1]] > 9))
        return null;
    return (neg ? -1 : 1) * parts.reduce((n, p) => n + words[p], 0);
}
export function quantities(unit: SemanticUnit): NormalizedQuantity[] {
    const view = normalizedView(unit.sourceSpan.text, unit.sourceSpan.start), out: NormalizedQuantity[] = [];
    const number = '(?:-?\\d+(?:[.,]\\d+)?|(?:menos\\s+)?(?:' + Object.keys(words).sort((a, b) => b.length - a.length).join('|') + ')(?:\\s+e\\s+(?:um|dois|tres|quatro|cinco|seis|sete|oito|nove))?)';
    const rx = new RegExp('(?<![\\p{L}\\d])(' + number + ')\\s*(°\\s*c|graus?(?:\\s+(?:celsius|negativos?))?|%|por cento|quilometros?|metros?|horas?|minutos?|segundos?|km/h|m/s)(?![\\p{L}])', 'gu');
    for (const m of view.text.matchAll(rx)) {
        const token = m[2], negative = /negativ/.test(token);
        let value = parseNumber(m[1]);
        if (value === null)
            continue;
        if (negative)
            value = -Math.abs(value);
        const dimension: NormalizedQuantity['dimension'] = /grau|°/.test(token) ? 'TEMPERATURE' : /%|por cento/.test(token) ? 'PERCENTAGE' : /km\/h|m\/s/.test(token) ? 'SPEED' : /hora|minuto|segundo/.test(token) ? 'TIME' : 'DISTANCE';
        const unitName = dimension === 'TEMPERATURE' ? 'Celsius' : dimension === 'PERCENTAGE' ? 'percent' : token.startsWith('quilometro') ? 'kilometer' : token.startsWith('metro') ? 'meter' : token.startsWith('hora') ? 'hour' : token.startsWith('minuto') ? 'minute' : token.startsWith('segundo') ? 'second' : token;
        out.push({ id: '', unitId: unit.id, value, unit: unitName, dimension, comparisonOperator: null, sourceSpan: view.span(m.index!, m.index! + m[0].length), confidence: 'HIGH' });
    }
    const ranks = new RegExp('(?:#\\s*(\\d+)|(?:em\\s+)?(' + Object.keys(ordinal).join('|') + ')(?:\\s+lugar)?|posicao\\s+(' + number + ')|numero\\s+(' + number + '))', 'gu');
    for (const m of view.text.matchAll(ranks)) {
        if (out.some(q => view.span(m.index!, m.index! + m[0].length).start < q.sourceSpan.end && q.sourceSpan.start < view.span(m.index!, m.index! + m[0].length).end))
            continue;
        const rank = m[1] ? Number(m[1]) : m[2] ? ordinal[m[2]] : parseNumber(m[3] ?? m[4]);
        if (rank === null)
            continue;
        out.push({ id: '', unitId: unit.id, value: rank, unit: m[4] ? 'count' : 'position', dimension: m[4] ? 'COUNT' : 'RANK', comparisonOperator: null, sourceSpan: view.span(m.index!, m.index! + m[0].length), confidence: 'HIGH' });
    }
    // Bare numeric values are retained without assigning a physical dimension.
    for (const m of view.text.matchAll(/(?<![\p{L}\d])-?\d+(?:[.,]\d+)?/gu)) {
        const span = view.span(m.index!, m.index! + m[0].length);
        if (out.some(q => span.start >= q.sourceSpan.start && span.end <= q.sourceSpan.end))
            continue;
        out.push({ id: '', unitId: unit.id, value: Number(m[0].replace(',', '.')), unit: 'count', dimension: 'COUNT', comparisonOperator: null, sourceSpan: span, confidence: 'MEDIUM' });
    }
    return out.sort((a, b) => a.sourceSpan.start - b.sourceSpan.start);
}
