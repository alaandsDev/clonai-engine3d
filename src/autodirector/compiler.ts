import { jsonHash } from '../editorial/fingerprint';
import { fail, type DirectorPlan } from '../engine3d/contracts';
import { validateDirected } from '../engine3d/directed';
import { editorialPlanShape, eventMapShape } from '../editorial/schema';
import { qaEditorial } from '../editorial/compiler';
import { compileDirectorPlan } from '../engine3d/director';
import type { EditorialPlan, EditorialEventMap } from '../editorial/contracts';
import type { AutoDirectorPlan } from './contracts';
import { COMPILER_VERSION } from './contracts';
export function compileAutoDirector(plan: AutoDirectorPlan) {
    const { fingerprint, ...raw } = plan;
    if (jsonHash(raw) !== fingerprint)
        fail('AUTO_FINGERPRINT', 'plan changed');
    if (!plan.qaSummary.sourceCoverage)
        fail('AUTO_COVERAGE', 'source omitted');
    const sequences = plan.directedSequences.map(validateDirected), first = sequences[0], x = plan.input;
    const editorial: EditorialPlan = { version: 1, id: x.id, title: x.id, language: x.language, format: 'vertical_short', canvas: { ...x.canvas, fps: x.fps }, source: { type: 'SCRIPT', text: x.script }, cast: {}, safeZone: { x: .08, y: .08, width: .84, height: .72 }, beats: plan.narrativeUnits.map(u => ({ id: u.id, narration: u.sourceText, intent: u.order ? 'FACT' : 'HOOK', informationType: 'SCENARIO', emphasis: 'MEDIUM', visualGoal: plan.visualArc.find(a => a.unitId === u.id)?.mode ?? 'VISUAL_GAP', durationSeconds: u.durationFrames / x.fps, staging: { environment: first?.baseShot.environment ?? { resourceId: 'ENV_LAB_001' }, characters: [], props: [{ instanceId: 'interop-container', resourceId: 'PROP_BOTTLE_001' }], actions: [], vfx: [], camera: { resourceId: 'CAM_STATIC_001' } } })) };
    const eventMap: EditorialEventMap = { version: 1, planId: x.id, events: [...plan.narrativeUnits.map(u => ({ id: 'interop-focus_' + u.id, beatId: u.id, type: 'VISUAL_FOCUS' as const, targetInstanceId: 'interop-container', anchor: { type: 'BEAT_START' as const }, purpose: 'SYMBOLIC interoperability placeholder only; DIRECT evidence is exclusively in DirectedSequence sidecar' })), ...plan.narrativeUnits.flatMap((u, i) => i < plan.narrativeUnits.length - 1 ? [{ id: 'boundary_' + u.id, beatId: u.id, type: 'CUT' as const, anchor: { type: 'BEAT_END' as const }, purpose: 'Legacy interoperability boundary; does not cut the authoritative continuous DirectedSequence' }] : [])] };
    editorialPlanShape(editorial);
    eventMapShape(eventMap);
    const interopQa = qaEditorial({ plan: editorial, eventMap, catalog: [], approvals: [] });
    if (!interopQa.valid)
        fail('AUTO_INTEROP_QA', JSON.stringify(interopQa.issues));
    const director: DirectorPlan = { id: x.id, title: x.id, format: { ...x.canvas, fps: x.fps }, style: 'AutoDirector interop projection; demonstration track authoritative', cast: {}, timingMode: 'fixed', scenes: editorial.beats.map((b, i) => ({ id: 'scene_' + b.id, order: i, narration: b.narration, environment: b.staging.environment, shots: [{ id: 'shot_' + b.id, order: 0, durationSeconds: b.durationSeconds, narrationSegment: b.narration, characters: [], props: b.staging.props, actions: [], vfx: [], camera: b.staging.camera, onScreenText: plan.visualGaps.length ? 'VISUAL_GAP' : 'Procedural demonstration executed in DirectedSequence sidecar' }] })) };
    compileDirectorPlan(director);
    return { compilerVersion: COMPILER_VERSION, editorialPlan: editorial, eventMap, directorPlan: director, directedSequences: sequences, demonstrations: plan.demonstrations, visualProof: plan.visualProofPlan, visualGaps: plan.visualGaps, renderPlan: { authoritativeContract: 'DirectedSequence', renderable: sequences.length > 0 && plan.visualGaps.length === 0, legacyProjection: 'Coarse schema-valid interoperability projection, not visual execution of primitive subjects. Do not render it as evidence of DIRECT proof.', totalFrames: plan.narrativeUnits.reduce((a, b) => a + b.durationFrames, 0) }, fingerprint: jsonHash({ plan: fingerprint, version: COMPILER_VERSION }) };
}
