import { normalize } from '../semantics/normalize';
import type { Evidence } from './contracts';
// Phase 22 fact-window similarity: deterministic word 4-gram shingles and Jaccard. Catches near-verbatim copies of the
// same factual sentence; deep paraphrase is out of reach without a semantic model (documented limitation).
export const NEAR_COPY_THRESHOLD = 0.6;
export function shingles(text: string, n = 4): Set<string> { const words = normalize(text.replace(/<[^>]*>/g, ' ')).replace(/[^a-z0-9.\- ]/g, ' ').split(/\s+/).filter(Boolean), out = new Set<string>(); for (let i = 0; i + n <= words.length; i++)
    out.add(words.slice(i, i + n).join(' ')); return out; }
export function jaccard(a: Set<string>, b: Set<string>) { if (!a.size || !b.size)
    return 0; let common = 0; for (const x of a)
    if (b.has(x))
        common++; return common / (a.size + b.size - common); }
/** Two prose evidences of the same fact that repeat practically the same sentence share an origin (POSSIBLE_SHARED_ORIGIN). Structured cells are not compared. */
export function factWindowNearCopy(a: Evidence, b: Evidence): { similar: boolean; score: number } { if (a.structured || b.structured)
    return { similar: false, score: 0 }; const x = shingles(a.normalizedText), y = shingles(b.normalizedText); if (Math.min(x.size, y.size) < 4)
    return { similar: false, score: 0 }; const score = jaccard(x, y); return { similar: score >= NEAR_COPY_THRESHOLD, score: Number(score.toFixed(3)) }; }
