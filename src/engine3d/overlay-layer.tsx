import React from 'react';
import type { Vec3 } from './contracts';
import { projectPosition, type CameraState } from './directed';
import type { OverlayTrack } from './overlay';
/** Explainer overlay renderer. Sizes are designed at 1080 px wide and scale with the output width. */
const TONE = { NEUTRAL: '#2a9df4', GOOD: '#2fbf71', BAD: '#e63946' } as const;
const fade = (f: number, a: number, b: number, k = 6) => Math.max(0, Math.min(1, (f - a) / k, (b - f) / k));
export function OverlayLayer({ overlay, frame, camera, subjects, width, height }: { overlay: OverlayTrack; frame: number; camera: CameraState; subjects: Record<string, { position: Vec3; visible: boolean }> | undefined; width: number; height: number }) {
    const u = width / 1080, word = overlay.words.find(w => frame >= w.startFrame && frame < w.endFrame);
    const labels = overlay.labels.filter(l => frame >= l.startFrame && frame < l.endFrame).map(l => {
        const s = l.subjectId ? subjects?.[l.subjectId] : undefined; if (l.subjectId && s && !s.visible) return null;
        const base = s ? s.position : l.point, p = projectPosition([base[0], base[1] + l.lift, base[2]] as Vec3, camera, width, height);
        if (!(p.depth < 1 && p.x > 0.04 && p.x < 0.96 && p.y > 0.05 && p.y < 0.6)) return null;
        return { l, x: p.x, y: p.y, a: fade(frame, l.startFrame, l.endFrame) };
    }).filter((x): x is NonNullable<typeof x> => Boolean(x));
    const tr = overlay.transitions.find(t => frame >= t.startFrame && frame < t.endFrame);
    return <>
        {tr && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: fade(frame, tr.startFrame, tr.endFrame, 4) }}>
            {Array.from({ length: 12 }, (_, i) => { const y = (i * 83) % 100, shift = ((frame - tr.startFrame) * (tr.kind === 'REWIND' ? -60 : 60) * u + i * 97) % width;
                return <div key={i} style={{ position: 'absolute', top: y + '%', left: shift - width * 0.3, width: width * (0.35 + (i % 3) * 0.12), height: Math.max(2, 4 * u), background: 'rgba(255,255,255,0.55)' }} />; })}
            <svg style={{ position: 'absolute', right: 60 * u, top: 70 * u }} width={150 * u} height={80 * u} viewBox="0 0 150 80">
                {(tr.kind === 'REWIND' ? ['75,0 75,80 10,40', '140,0 140,80 75,40'] : ['10,0 10,80 75,40', '75,0 75,80 140,40']).map((pts, i) =>
                    <polygon key={i} points={pts} fill={tr.kind === 'REWIND' ? '#ffffff' : '#ffd21f'} stroke="#1a1a1a" strokeWidth={6} strokeLinejoin="round" />)}
            </svg>
        </div>}
        {labels.map(({ l, x, y, a }) => l.kind === 'TERM'
            ? <div key={l.id} style={{ position: 'absolute', left: x * width, top: y * height, transform: `translate(-50%,-100%) rotate(-3deg) scale(${0.85 + 0.15 * a})`, opacity: a, color: '#ffd21f', fontFamily: 'Trebuchet MS', fontWeight: 900, fontSize: 64 * u, letterSpacing: 1, textTransform: 'uppercase', WebkitTextStroke: `${7 * u}px #1a1a1a`, paintOrder: 'stroke fill', whiteSpace: 'nowrap' }}>{l.text}</div>
            : <div key={l.id} style={{ position: 'absolute', left: x * width, top: y * height, transform: `translate(-50%,-100%) scale(${0.85 + 0.15 * a})`, opacity: a, display: 'flex', alignItems: 'center', gap: 10 * u, background: '#ffffff', border: `${4 * u}px solid #1a1a1a`, borderRadius: 50 * u, padding: `${10 * u}px ${26 * u}px`, fontFamily: 'Trebuchet MS', fontWeight: 900, fontSize: 40 * u, color: '#1a1a1a', textTransform: 'uppercase', whiteSpace: 'nowrap', boxShadow: `0 ${4 * u}px 0 rgba(0,0,0,0.25)` }}>
                <span style={{ width: 20 * u, height: 20 * u, borderRadius: '50%', background: TONE[l.tone], display: 'inline-block' }} />{l.text}</div>)}
        {word && <div style={{ position: 'absolute', left: 0, right: 0, top: '64%', display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ fontFamily: 'Trebuchet MS', fontWeight: 900, fontSize: 108 * u, color: word.key ? '#ffd21f' : '#ffffff', WebkitTextStroke: `${12 * u}px #1a1a1a`, paintOrder: 'stroke fill', textShadow: `0 ${6 * u}px 0 rgba(0,0,0,0.35)`, transform: `scale(${0.88 + 0.12 * Math.min(1, (frame - word.startFrame) / 3)})`, whiteSpace: 'nowrap' }}>{word.text}</div>
        </div>}
    </>;
}
