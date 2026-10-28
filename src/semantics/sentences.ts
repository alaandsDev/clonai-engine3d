import { fields, text } from '../engine3d/schema';
import { fail } from '../engine3d/contracts';
import type { SemanticInput, SemanticUnit } from './contracts';
import { sourceSpan } from './normalize';
export function sentences(input: SemanticInput): SemanticUnit[] {
    fields(input, ['version', 'id', 'language', 'script'], 'SemanticInput');
    text(input.script, 'script');
    if (input.version !== 1 || input.language !== 'pt-BR' || !/^[a-z][a-z0-9_-]{0,63}$/.test(input.id) || input.script.length > 20000)
        fail('SEMANTIC_INPUT', 'invalid version, language, id or script budget');
    const boundaries = [...input.script.matchAll(/(?:[.!?](?:\s+|$)|\n\s*\n)/gu)].map(m => m.index! + m[0].length);
    if (boundaries.at(-1) !== input.script.length)
        boundaries.push(input.script.length);
    const units: SemanticUnit[] = [];
    let start = 0;
    for (const end of boundaries) {
        if (end <= start || !input.script.slice(start, end).trim())
            continue;
        units.push({ id: 'unit_' + (units.length + 1), order: units.length, sourceSpan: sourceSpan(input.script, start, end) });
        start = end;
    }
    if (start < input.script.length && units.length) {
        units.at(-1)!.sourceSpan = sourceSpan(input.script, units.at(-1)!.sourceSpan.start, input.script.length);
    }
    return units;
}
