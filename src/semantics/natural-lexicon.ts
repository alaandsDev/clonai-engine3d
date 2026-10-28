import type { Predicate } from './contracts';
import { normalizedView } from './normalize';
/** Lexical additions, separate from clause/reference/graph algorithms. */
export const naturalLexicon = [
    { name: 'FILL', forms: 'preenche|preencheu|preencher|preenchido|preenchida' },
    { name: 'STORE', forms: 'armazenar|armazenando|guard(?:a|ou|ar)' },
    { name: 'FLOW', forms: 'percorreu|percorrer|circula|circulou' },
    { name: 'IS', forms: 'permanece|permanecia|exposto|exposta' },
    { name: 'MEASURE', forms: 'marca|marcava' },
    { name: 'COVER', forms: 'cobrir|cobriu' },
    { name: 'CONTINUE', forms: 'continua|continuou|prossegue' },
    { name: 'UNKNOWN', forms: 'analisa|analisam|analisou|controla|controlam|investiga|investigam' }
] as const;
export function extraPredicates(text: string, offset: number, unitId: string, existing: Predicate[]) {
    const view = normalizedView(text, offset);
    return naturalLexicon.flatMap(rule => [...view.text.matchAll(new RegExp('(?<![\\p{L}])(?:' + rule.forms + ')(?![\\p{L}])', 'gu'))].map(m => ({ name: rule.name, span: view.span(m.index!, m.index! + m[0].length) }))).filter(x => !existing.some(p => p.sourceSpan.start < x.span.end && x.span.start < p.sourceSpan.end)).map(x => ({ id: '', unitId, name: x.name, sourceSpan: x.span }));
}
