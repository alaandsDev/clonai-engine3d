import type { DirectedSequence } from '../engine3d/directed';
import { evaluateDirected } from '../engine3d/directed';
import type { NarrativeUnit, PlannedClaim, Selection } from './contracts';
/** Evidence for the bounded native patterns, checked per claim and time window.
 * This validates a visual construction, not the truth or full meaning of prose.
 */
export function proofChecks(claim: PlannedClaim, selection: Selection | undefined, sequence: DirectedSequence | undefined, units: NarrativeUnit[]) {
    if (!claim.requiresVisualProof)
        return { subjectRepresented: true, stateOrProcessRepresented: true, resultVisible: true, focusAllocated: true };
    if (!sequence)
        return { subjectRepresented: false, stateOrProcessRepresented: false, resultVisible: false, focusAllocated: false };
    const firstUnitId=claim.extraction?.executionWindow.firstUnitId??claim.unitId,lastUnitId=claim.extraction?.executionWindow.lastUnitId??claim.unitId;
    const start = units.slice(0, units.findIndex(u => u.id === firstUnitId)).reduce((n, u) => n + u.durationFrames, 0);
    const end = units.slice(0,units.findIndex(u=>u.id===lastUnitId)+1).reduce((n,u)=>n+u.durationFrames,0);
    const before = evaluateDirected(sequence, start).state;
    const after = evaluateDirected(sequence, Math.min(end, sequence.totalFrames)).state;
    const demo = sequence.demonstration;
    const steps = demo?.steps.filter(s => s.startFrame < end && s.endFrame > start) ?? [];
    let subject = false, process = false, result = false;
    if (demo && claim.semanticTags.includes('liquid')) {
        subject = demo.subjects.some(s => s.kind === 'CYLINDER');
        const final = after.demonstration?.subjects.destination;
        if (selection?.template === 'FLOW') {
            const path = demo.subjects.find(s => s.kind === 'PATH')?.path;
            process = steps.some(s => s.operation === 'FLOW') && demo.steps.some(s => s.operation === 'CONNECT' && s.endFrame <= end);
            if (claim.semanticTags.includes('upward'))
                process = process && Boolean(path && path.at(-1)![1] > path[0][1]);
            result = Boolean(after.demonstration?.subjects.connection?.parameters.flowProgress);
        }
        else if (selection?.template === 'QUANTITY') {
            process = steps.some(s => s.operation === 'INCREASE' && s.target === 'destination');
            result = Boolean(final && final.parameters.fillLevel > (before.demonstration?.subjects.destination?.parameters.fillLevel ?? 0));
        }
        else if (selection?.template === 'REVEAL') {
            process = Boolean(final && final.parameters.fillLevel > 0);
            result = Boolean(final?.visible);
        }
    }
    else if (demo && selection?.template === 'STATE_CHANGE') {
        subject = demo.subjects.some(s => s.kind === 'PROP');
        process = steps.some(s => s.operation === 'ACCUMULATE') && steps.some(s => s.operation === 'CHANGE_STATE');
        result = Object.values(after.demonstration?.subjects ?? {}).some(s => s.visible && s.stateId === 'FROZEN' && s.parameters.frost === 1);
    }
    else if (selection?.template === 'TEMPERATURE') {
        subject = sequence.baseShot.props.some(p => p.resourceId === 'PROP_THERMOMETER_001');
        process = subject;
        result = Object.values(after.props).some(p => p.visible && Number.isFinite(p.parameters.value));
    }
    else if (selection?.template === 'REVEAL_DOOR') {
        subject = sequence.baseShot.props.some(p => p.resourceId === 'PROP_DOOR_001');
        process = sequence.actionSegments.some(s => s.resourceId === 'ACTION_OPEN_DOOR_001' && s.startFrame < end && s.endFrame > start);
        result = Object.values(after.props).some(p => p.visible && p.parameters.openProgress === 1);
    }
    else if (['RANKING', 'COMPARISON'].includes(selection?.template ?? '')) {
        subject = sequence.shots.some(s => s.onScreenText?.includes(claim.text));
        process = subject;
        result = subject;
    }
    return { subjectRepresented: subject, stateOrProcessRepresented: process, resultVisible: result, focusAllocated: sequence.focusSegments.some(s => s.startFrame <= start && s.endFrame >= end) || sequence.focusSegments.filter(s => s.startFrame < end && s.endFrame > start).reduce((n, s) => n + Math.min(end, s.endFrame) - Math.max(start, s.startFrame), 0) >= end - start };
}
