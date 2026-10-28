import type { SemanticUnit, SourceSpan } from './contracts';
import type { NarrativeClause } from './narrative-contracts';
import { normalize, normalizedView, sourceSpan } from './normalize';
export const clauseRules = { coordination: ['e', 'mas', 'porém'], subordination: ['quando', 'enquanto', 'porque', 'se', 'que', 'para'], questionScopes: ['você sabe', 'será que'], epistemicScopes: ['não significa que', 'não quer dizer que'] };
export function splitClauses(script: string, units: SemanticUnit[], predicates: {
    id: string;
    sourceSpan: SourceSpan;
    unitId: string;
}[]): NarrativeClause[] {
    const out: NarrativeClause[] = [];
    for (const unit of units) {
        const view = normalizedView(unit.sourceSpan.text, unit.sourceSpan.start), ps = predicates.filter(p => p.unitId === unit.id).sort((a, b) => a.sourceSpan.start - b.sourceSpan.start), boundaries = new Map<number, {
            type: NarrativeClause['type'];
            connector: string;
        }>();
        boundaries.set(unit.sourceSpan.start, { type: /^\s*quando\b|^\s*enquanto\b/.test(view.text) ? 'TEMPORAL' : /^\s*se\b/.test(view.text) ? 'CONDITIONAL' : 'MAIN', connector: '' });
        for (let i = 1; i < ps.length; i++) {
            const from = ps[i - 1].sourceSpan.end, to = ps[i].sourceSpan.start, part = normalizedView(script.slice(from, to), from);
            const connectors = [...part.text.matchAll(/[,;:]|\b(?:e|mas|porem|quando|enquanto|porque|se|que|para)\b/gu)];
            const m = connectors.at(-1);
            if (!m)
                continue;
            const span = part.span(m.index!, m.index! + m[0].length), word = m[0];
            const type: NarrativeClause['type'] = word === 'quando' || word === 'enquanto' ? 'TEMPORAL' : word === 'porque' ? 'CAUSAL' : word === 'se' ? 'CONDITIONAL' : word === 'que' ? 'RELATIVE' : word === 'para' ? 'PURPOSE' : word === ',' || word === ';' || word === ':' ? 'MAIN' : 'COORDINATED';
            boundaries.set(word === ',' || word === ';' || word === ':' ? span.end : span.start, { type, connector: word });
        }
        // Purpose adjuncts can lack a finite verb from the visual lexicon.
        for (const m of view.text.matchAll(/\bpara\s+(?:ser|usar|guardar|utilizar|acompanhar)\b/gu)) {
            const span = view.span(m.index!, m.index! + m[0].length);
            if (ps.some(p => p.sourceSpan.end <= span.start))
                boundaries.set(span.start, { type: 'PURPOSE', connector: 'para' });
        }
        const entries = [...boundaries].sort((a, b) => a[0] - b[0]), nonAsserted = unit.sourceSpan.text.includes('?') || /\b(?:voce\s+(?:ja\s+)?sabe|sera que|nao significa que|nao quer dizer que)\b/.test(view.text);
        let previous: NarrativeClause | null = null;
        for (let i = 0; i < entries.length; i++) {
            const [start, info] = entries[i], end = entries[i + 1]?.[0] ?? unit.sourceSpan.end;
            if (!script.slice(start, end).trim())
                continue;
            const ids = ps.filter(p => p.sourceSpan.start >= start && p.sourceSpan.start < end).map(p => p.id), clause: NarrativeClause = { id: 'CL' + (out.length + 1), unitId: unit.id, order: out.length, type: info.type, sourceSpan: sourceSpan(script, start, end), predicateIds: ids, parentClauseId: previous && ['RELATIVE', 'PURPOSE', 'COORDINATED'].includes(info.type) ? previous.id : null, sharesSubjectWith: previous && info.type === 'COORDINATED' ? previous.id : null, nonAsserted, scopeReason: nonAsserted ? 'Question or epistemic non-assertion scope in original unit' : null };
            out.push(clause);
            previous = clause;
        }
    }
    return out;
}
