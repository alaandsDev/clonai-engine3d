import { fail } from "../engine3d/contracts";
import { spokenText } from "../engine3d/director";
import type { NarrativeBeat, ResolvedAnchor, TemporalAnchor } from "./contracts";
// NFC + Unicode token boundaries. No locale-specific ordering, accent stripping or substring matching.
export function tokens(text: string) {
    return [...spokenText(text).normalize("NFC").matchAll(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)].map(m => m[0].toLowerCase());
}
export function resolveAnchor(anchor: TemporalAnchor, beat: NarrativeBeat, fps: number, startFrame = 0): ResolvedAnchor {
    if (!anchor || !["BEAT_START", "BEAT_END", "WORD", "PHRASE", "NORMALIZED"].includes(anchor.type) || !Number.isInteger(fps) || fps <= 0 || !Number.isInteger(startFrame) || startFrame < 0 || !Number.isFinite(beat.durationSeconds) || beat.durationSeconds <= 0)
        fail("EDITORIAL_ANCHOR", "invalid anchor/timeline input");
    const frames = Math.max(1, Math.round(beat.durationSeconds * fps));
    let n = 0;
    if (anchor.type === "BEAT_END")
        n = 1;
    else if (anchor.type === "NORMALIZED")
        n = anchor.value;
    else if (anchor.type === "WORD" || anchor.type === "PHRASE") {
        const words = tokens(beat.narration), needle = tokens(anchor.value);
        if (!needle.length || (anchor.type === "WORD" && needle.length !== 1))
            fail("EDITORIAL_ANCHOR", "invalid word/phrase");
        const hits: number[] = [];
        for (let i = 0; i <= words.length - needle.length; i++)
            if (needle.every((w, j) => words[i + j] === w))
                hits.push(i);
        if (!hits.length)
            fail("EDITORIAL_ANCHOR", `anchor not found in ${beat.id}`);
        if (hits.length > 1 && anchor.occurrence === undefined)
            fail("EDITORIAL_ANCHOR", "ambiguous anchor requires occurrence");
        const hit = hits[(anchor.occurrence ?? 1) - 1];
        if (hit === undefined)
            fail("EDITORIAL_ANCHOR", "occurrence outside beat");
        // Character-weighted token starts, not measured phoneme/word boundaries.
        const weights = words.map(w => w.length + 1), total = weights.reduce((a, b) => a + b, 0);
        n = weights.slice(0, hit).reduce((a, b) => a + b, 0) / total;
    }
    if (!Number.isFinite(n) || n < 0 || n > 1)
        fail("EDITORIAL_ANCHOR", "anchor outside beat");
    const beatFrame = Math.round(n * frames);
    return { beatFrame, timelineFrame: startFrame + beatFrame, normalized: beatFrame / frames, timingConfidence: "ESTIMATED", basis: "AUTHORED_DURATION_ESTIMATED_PROPORTIONAL" };
}
