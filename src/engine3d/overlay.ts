import type { Vec3 } from './contracts';
/** Explainer overlay track (optional on a DirectedSequence). Pure data, rendered deterministically per frame:
 *  - words: one spoken word at a time (key words highlighted);
 *  - labels: small "pill" tags or bigger "term" tags anchored to a subject (follows it) or a fixed world point;
 *  - transitions: rewind / fast-forward marks with speed lines over the frame.
 * A sequence without an overlay keeps the classic phrase captions. */
export interface OverlayWord { text: string; startFrame: number; endFrame: number; key: boolean }
export interface OverlayLabel { id: string; text: string; kind: 'PILL' | 'TERM'; subjectId: string | null; point: Vec3; lift: number; startFrame: number; endFrame: number; tone: 'NEUTRAL' | 'GOOD' | 'BAD' }
export interface OverlayTransition { kind: 'REWIND' | 'FORWARD'; startFrame: number; endFrame: number }
export interface OverlayTrack { version: 1; captionStyle: 'WORD'; words: OverlayWord[]; labels: OverlayLabel[]; transitions: OverlayTransition[] }
const bad = (m: string): never => { throw Error('OVERLAY_SCHEMA: ' + m); };
const int = (v: unknown, lo: number, hi: number, m: string) => { if (!Number.isInteger(v) || (v as number) < lo || (v as number) > hi) bad(m); };
export function validateOverlay(o: OverlayTrack, totalFrames: number): OverlayTrack {
    if (!o || o.version !== 1 || o.captionStyle !== 'WORD') bad('version/style');
    let cursor = 0;
    for (const w of o.words) { if (typeof w.text !== 'string' || !w.text.trim()) bad('word text'); int(w.startFrame, 0, totalFrames - 1, 'word start'); int(w.endFrame, 1, totalFrames, 'word end'); if (w.startFrame < cursor || w.endFrame <= w.startFrame) bad('word overlap'); cursor = w.endFrame; if (typeof w.key !== 'boolean') bad('word key'); }
    for (const l of o.labels) { if (typeof l.text !== 'string' || !l.text.trim() || l.text.length > 40) bad('label text'); if (!['PILL', 'TERM'].includes(l.kind) || !['NEUTRAL', 'GOOD', 'BAD'].includes(l.tone)) bad('label kind/tone'); int(l.startFrame, 0, totalFrames - 1, 'label start'); int(l.endFrame, 1, totalFrames, 'label end'); if (l.endFrame <= l.startFrame) bad('label span'); if (!Array.isArray(l.point) || l.point.length !== 3 || l.point.some(v => !Number.isFinite(v))) bad('label point'); if (!Number.isFinite(l.lift)) bad('label lift'); }
    for (const t of o.transitions) { if (!['REWIND', 'FORWARD'].includes(t.kind)) bad('transition kind'); int(t.startFrame, 0, totalFrames - 1, 'transition start'); int(t.endFrame, 1, totalFrames, 'transition end'); if (t.endFrame <= t.startFrame) bad('transition span'); }
    return o;
}
