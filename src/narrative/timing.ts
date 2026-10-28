import type { SemanticNarrativeGraph } from '../semantics/narrative-contracts';
import type { NarrativeOptions, ClauseTiming } from './contracts';
import { fail } from '../engine3d/contracts';
export function narrativeTiming(graph: SemanticNarrativeGraph, options: NarrativeOptions): ClauseTiming[] {
    const fps = options.fps ?? 30;
    if (!Number.isInteger(fps) || fps < 1 || fps > 60)
        fail('NARRATIVE_TIMING', 'integer fps 1..60 required');
    let at = 0;
    const out: ClauseTiming[] = [];
    for (const unit of graph.analysis.narrativeUnits) {
        const clauses = graph.clauses.filter(c => c.unitId === unit.id), measured = options.measuredDurations?.find(t => t.unitId === unit.id);
        if (measured && (!Number.isFinite(measured.durationSeconds) || measured.durationSeconds <= 0))
            fail('NARRATIVE_TIMING', 'positive measured duration required');
        const frames = Math.max(clauses.length, 30, Math.ceil((measured?.durationSeconds ?? Math.max(1.2, unit.sourceSpan.text.trim().split(/\s+/).length / 2.6)) * fps)), weights = clauses.map(c => Math.max(1, c.sourceSpan.text.trim().split(/\s+/).length)), sum = weights.reduce((a, b) => a + b, 0);
        let used = 0, weight = 0;
        for (let i = 0; i < clauses.length; i++) {
            weight += weights[i];
            const end = i === clauses.length - 1 ? frames : Math.max(used + 1, Math.min(frames - (clauses.length - i - 1), Math.round(frames * weight / sum)));
            out.push({ clauseId: clauses[i].id, unitId: unit.id, startFrame: at + used, endFrame: at + end, timing: measured ? 'MEASURED_UNIT_ESTIMATED_CLAUSE' : 'ESTIMATED' });
            used = end;
        }
        at += frames;
    }
    return out;
}
