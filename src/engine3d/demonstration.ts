import { jsonHash, canonicalJson } from '../editorial/fingerprint';
import { validateDirected, evaluateDirected, type DirectedSequence } from './directed';
import { fields } from './schema';
import { fail } from './contracts';
import { DEMONSTRATION_COMPILER_VERSION, type VisualDemonstration, type DemonstrationProgram } from './demonstration-contracts';
import { validateDemonstrationProgram } from './demonstration-runtime';
/** Pure compiler: crypto hashes input bytes only; no filesystem, network, random or clock. */
export function compileDemonstration(input: VisualDemonstration) {
    canonicalJson(input);
    fields(input, ['version', 'id', 'purpose', 'claim', 'subjects', 'initialState', 'steps', 'finalState', 'presenterModes', 'direction'], 'VisualDemonstration');
    const { direction: authored, ...rest } = structuredClone(input);
    if (authored.demonstration)
        fail('DEMONSTRATION_SCHEMA', 'nested program');
    const program: DemonstrationProgram = { ...rest, compilerVersion: DEMONSTRATION_COMPILER_VERSION };
    validateDemonstrationProgram(program, authored.baseShot, authored.totalFrames);
    const sequence: DirectedSequence = structuredClone(authored);
    for (const s of program.subjects)
        if (s.kind === 'PROP' && (sequence.propMotions.some(p => p.propId === s.id) || sequence.actionSegments.some(a => a.targetId === s.id)))
            fail('DEMONSTRATION_CONFLICT', 'subject also controlled by directed track');
    sequence.demonstration = program;
    sequence.initialState.demonstration = structuredClone(program.initialState);
    for (const s of program.subjects.filter(s => s.kind === 'PROP')) {
        const p = program.initialState.subjects[s.id], i = sequence.initialState.props[s.id];
        Object.assign(i, { position: p.position, rotation: p.rotation, scale: p.scale, visible: p.visible });
        if (s.resourceId === 'PROP_CAR_001')
            i.parameters.frost = p.parameters.frost ?? 0;
        if (s.resourceId === 'PROP_THERMOMETER_001')
            i.parameters.value = p.parameters.value ?? 0;
    }
    sequence.finalState = evaluateDirected(sequence, sequence.totalFrames).state;
    const fingerprint = jsonHash({ compilerVersion: DEMONSTRATION_COMPILER_VERSION, demonstration: input, resourceIds: [sequence.baseShot.environment.resourceId, ...sequence.baseShot.characters.map(c => c.resourceId), ...sequence.baseShot.props.map(p => p.resourceId)].sort() });
    return { compilerVersion: DEMONSTRATION_COMPILER_VERSION, fingerprint, sequence: validateDirected(sequence) };
}
