import type { Predicate, SemanticUnit } from './contracts';
import { normalizedView, normalize } from './normalize';
import { predicateRules } from './rules';
export function modalityOf(text: string): Predicate['modality'] { const s = normalize(text); return /\bpoderia\b/.test(s) ? 'HYPOTHETICAL' : /\bpode(?:m)?\b/.test(s) ? 'POSSIBLE' : /\b(?:talvez|provavelmente|possivelmente|parece)\b/.test(s) ? 'UNCERTAIN' : /^\s*se\b/.test(s) ? 'HYPOTHETICAL' : 'ASSERTED'; }
export function predicates(unit: SemanticUnit): Predicate[] {
    const view = normalizedView(unit.sourceSpan.text, unit.sourceSpan.start);
    const matches = predicateRules.flatMap((rule, priority) => [...view.text.matchAll(new RegExp('(?<![\\p{L}])(?:' + rule.pattern + ')(?![\\p{L}])', 'gu'))].map(m => ({ rule, priority, m })));
    matches.sort((a, b) => a.m.index! - b.m.index! || b.m[0].length - a.m[0].length || a.priority - b.priority);
    const out: Predicate[] = [];
    for (const { rule, m } of matches) {
        const span = view.span(m.index!, m.index! + m[0].length);
        if (out.some(p => p.sourceSpan.start < span.end && span.start < p.sourceSpan.end))
            continue;
        if (rule.name === 'IS' && m[0] === 'e' && span.text !== 'é')
            continue;
        const before = view.text.slice(0, m.index), clause = before.split(/[,;]|\b(?:mas|porem|e)\b/u).at(-1)!;
        const negated = /\b(?:nao|nunca|jamais|nem)\b/.test(clause);
        const modality = modalityOf(unit.sourceSpan.text);
        out.push({ id: '', unitId: unit.id, name: rule.name, sourceSpan: span, subjectEntityId: null, objectEntityIds: [], negated, modality, interrogative: unit.sourceSpan.text.includes('?'), referenceIds: [], ambiguityIds: [] });
    }
    return out;
}
