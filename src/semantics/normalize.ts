import type { SourceSpan } from './contracts';
export const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
export const sourceSpan = (script: string, start: number, end: number): SourceSpan => ({ start, end, text: script.slice(start, end) });
/** Search on accent-folded text while retaining UTF-16 offsets, including decomposed accents. */
export function normalizedView(script: string, offset = 0) {
    let text = '';
    const starts: number[] = [], ends: number[] = [];
    let pos = 0;
    for (const character of script) {
        const folded = normalize(character), end = pos + character.length;
        if (!folded.length && ends.length)
            ends[ends.length - 1] = end;
        for (const c of folded) {
            text += c;
            for (let i = 0; i < c.length; i++) {
                starts.push(pos);
                ends.push(end);
            }
        }
        pos = end;
    }
    return { text, span: (start: number, end: number): SourceSpan => ({ start: offset + (starts[start] ?? script.length), end: offset + (ends[end - 1] ?? script.length), text: script.slice(starts[start] ?? script.length, ends[end - 1] ?? script.length) }) };
}
export const stableIds = (values: string[]) => [...new Set(values)].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
