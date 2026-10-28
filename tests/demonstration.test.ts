import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileDemonstration } from '../src/engine3d/demonstration';
import { evaluateDemonstration, proofQa, pathAt, validateDemonstrationProgram } from '../src/engine3d/demonstration-runtime';
import { DEMONSTRATION_COMPILER_VERSION, DEMONSTRATION_LIMITS, carStates, type VisualDemonstration, type DemonstrationStep } from '../src/engine3d/demonstration-contracts';
import { evaluateDirected, validateDirected } from '../src/engine3d/directed';
import { canonicalJson } from '../src/editorial/fingerprint';
import { resources } from '../src/engine3d/registry';
import { Prop } from '../src/engine3d/library';
const fixture = (kind = 'car-freezing') => JSON.parse(readFileSync(new URL('../examples/demonstration/' + kind + '.json', import.meta.url), 'utf8')) as VisualDemonstration;
const finish = (d: VisualDemonstration) => { d.finalState = evaluateDemonstration({ ...d, compilerVersion: DEMONSTRATION_COMPILER_VERSION }, d.direction.totalFrames); return d; };
const isolated = () => { const d = fixture(); d.steps = []; d.direction.cameraSegments = []; d.direction.focusSegments = []; return d; };
const step = (operation: DemonstrationStep['operation'], parameters: Record<string, unknown>, target = 'car'): DemonstrationStep => ({ startFrame: 30, endFrame: 90, operation, target, parameters, easing: 'LINEAR', purpose: 'Contract regression' });
test('demonstration: versioned compiler emits a valid DirectedSequence, not an alternate renderer', () => { for (const f of ['car-freezing', 'process']) {
    const result = compileDemonstration(fixture(f));
    assert.equal(result.compilerVersion, DEMONSTRATION_COMPILER_VERSION);
    assert(validateDirected(result.sequence));
    assert(result.sequence.demonstration);
} });
test('demonstration: unknown fields, versions, operations and targets fail', () => { for (const change of [(d: any) => d.extra = 1, (d: any) => d.version = 2, (d: any) => d.steps[0].operation = 'FREEZE_CAR', (d: any) => d.steps[0].target = 'absent', (d: any) => d.subjects[0].kind = 'CAR_ASSET', (d: any) => delete d.claim]) {
    const d = fixture();
    change(d);
    assert.throws(() => compileDemonstration(d));
} });
test('demonstration: all six claim types work, causality requires cause/transition/effect', () => { for (const type of ['OBJECT_STATE', 'PROCESS', 'QUANTITY_CHANGE', 'SPATIAL_RELATION', 'CAUSE_EFFECT', 'COMPARISON'] as const) {
    const d = fixture();
    d.claim.type = type;
    assert(compileDemonstration(d));
} const d = fixture(); delete d.claim.cause; assert.throws(() => compileDemonstration(d)); });
test('demonstration: nonfinite values, invalid progress, frames and unsupported modifiers fail', () => { for (const change of [(d: any) => d.steps[2].parameters.to = NaN, (d: any) => d.steps[2].parameters.to = 2, (d: any) => d.steps[0].endFrame = 400, (d: any) => d.steps[0].startFrame = -1, (d: any) => d.steps[2].parameters.parameter = 'temperatureMagic', (d: any) => d.initialState.environment.groundCutaway = .5, (d: any) => d.subjects[0].size = [0, 1, 1]]) {
    const d = fixture();
    change(d);
    assert.throws(() => compileDemonstration(d));
} });
test('demonstration: bounded subjects/steps/geometry and simultaneous operations', () => { const d = fixture(); d.steps = Array.from({ length: 33 }, () => d.steps[0]); assert.throws(() => compileDemonstration(d), /BUDGET/); assert.equal(DEMONSTRATION_LIMITS.frostPatches, 12); const p = fixture('process'); p.subjects[2].path![0] = [1e99, 0, 0]; assert.throws(() => compileDemonstration(p)); });
test('demonstration: pure deterministic compilation, canonical fingerprint and input immutability', () => { const d = fixture(), before = canonicalJson(d), a = compileDemonstration(d), b = compileDemonstration(JSON.parse(before)); assert.equal(a.fingerprint, b.fingerprint); assert.equal(canonicalJson(a.sequence), canonicalJson(b.sequence)); assert.equal(canonicalJson(d), before); for (const f of [0, 45, 120, 150, 210, 299])
    assert.deepEqual(evaluateDirected(a.sequence, f), evaluateDirected(b.sequence, f)); assert(!canonicalJson(a.sequence).includes('C:\\')); });
test('demonstration: fingerprint changes with parameters/claim and excludes host-specific metadata', () => { const a = fixture(), b = fixture(); b.claim.text += ' Mais contexto.'; assert.notEqual(compileDemonstration(a).fingerprint, compileDemonstration(b).fingerprint); const c = fixture() as any; c.machineName = 'host'; assert.throws(() => compileDemonstration(c)); });
test('demonstration: car definitions declare only allowed state transitions', () => { assert.deepEqual(carStates.map(s => s.stateId), ['NORMAL', 'FROSTED', 'FROZEN']); assert.deepEqual(carStates[0].allowedTransitions, ['FROSTED']); const d = fixture(); d.steps[3].parameters.to = 'FROZEN'; assert.throws(() => compileDemonstration(d)); });
test('demonstration: explicit contextual reverse transition requires a reason', () => { const d = isolated(); d.initialState.subjects.car.stateId = 'FROZEN'; d.initialState.subjects.car.parameters.frost = 1; d.steps = [step('CHANGE_STATE', { from: 'FROZEN', to: 'NORMAL' })]; assert.throws(() => compileDemonstration(finish(d))); d.steps[0].parameters.overrideReason = 'Separate thawing example, explicitly authored'; assert(compileDemonstration(finish(d))); });
test('demonstration: conflicting state transitions and incompatible parameter tracks fail', () => { const d = fixture(); d.steps.push({ ...d.steps[3], parameters: { from: 'NORMAL', to: 'NORMAL' } }); assert.throws(() => compileDemonstration(d), /CONFLICT|STATE|reason/); const p = fixture(); p.steps.push({ ...p.steps[2], parameters: { parameter: 'frost', from: 0, to: .8 } }); assert.throws(() => compileDemonstration(p), /CONFLICT/); });
test('demonstration: declared final state cannot lie about the result', () => { const d = fixture(); d.finalState.subjects.car.stateId = 'NORMAL'; assert.throws(() => compileDemonstration(d), /finalState/); });
test('demonstration: ACCUMULATE car frost monotonic and final frozen state persists', () => { const s = compileDemonstration(fixture()).sequence; let previous = 0; for (let f = 0; f <= 300; f++) {
    const state = evaluateDirected(s, f).state.demonstration!.subjects.car;
    assert(state.parameters.frost >= previous);
    previous = state.parameters.frost;
} assert.equal(previous, 1); assert.equal(evaluateDirected(s, 299).state.demonstration!.subjects.car.stateId, 'FROZEN'); });
for (const operation of ['MOVE', 'ROTATE', 'SCALE'] as const)
    test('demonstration: generic ' + operation + ' interpolates and persists', () => { const d = isolated(), p = d.initialState.subjects.car, key = operation === 'MOVE' ? 'position' : operation === 'ROTATE' ? 'rotation' : 'scale', from = p[key], to = from.map((v, i) => v + (i === 0 ? .1 : 0)) as [
        number,
        number,
        number
    ]; d.steps = [step(operation, { from, to })]; const s = compileDemonstration(finish(d)).sequence; assert(Math.abs(evaluateDirected(s, 60).state.demonstration!.subjects.car[key][0] - (from[0] + .05)) < 1e-8); assert.deepEqual(evaluateDirected(s, 200).state.demonstration!.subjects.car[key], to); });
for (const operation of ['APPEAR', 'REVEAL', 'HIDE', 'DISAPPEAR'] as const)
    test('demonstration: ' + operation + ' visibility is explicit', () => { const d = isolated(); d.initialState.subjects.car.visible = ['HIDE', 'DISAPPEAR'].includes(operation); d.steps = [step(operation, {})]; const s = compileDemonstration(finish(d)).sequence; assert.equal(evaluateDirected(s, 100).state.props.car.visible, ['APPEAR', 'REVEAL'].includes(operation)); });
test('demonstration: transform start discontinuities and directed competing tracks fail', () => { const d = isolated(); d.steps = [step('MOVE', { from: [12, 0, 0], to: [12.1, 0, 0] })]; assert.throws(() => compileDemonstration(finish(d)), /discontinuity/); const p = fixture(); p.direction.actionSegments = [{ resourceId: 'ACTION_POINT_001', actorId: 'actor', targetId: 'car', startFrame: 0, endFrame: 20, easing: 'LINEAR', purpose: 'competing ownership', fromProgress: 0, toProgress: 1 }]; assert.throws(() => compileDemonstration(p), /competing|controlled/); });
test('demonstration: HIGHLIGHT pulse affects actual prop transform and returns to zero', () => { const d = isolated(); d.steps = [step('HIGHLIGHT', { amount: .2 })]; const s = compileDemonstration(finish(d)).sequence, e = evaluateDirected(s, 60); assert.equal(e.state.demonstration!.subjects.car.parameters.highlight, .2); const node = Prop({ instance: e.shot.props[0], shot: e.shot, t: .2, highlight: .2 }); assert(Math.abs((node.props as any).scale[0] - .918) < 1e-8); assert.equal(evaluateDirected(s, 100).state.demonstration!.subjects.car.parameters.highlight, 0); });
test('demonstration: environment state/cutaway supported only where declared', () => { const p = fixture('process'), s = compileDemonstration(p).sequence; assert.equal(evaluateDirected(s, 45).state.demonstration!.environment.groundCutaway, .85); p.direction.baseShot.environment.resourceId = 'ENV_WINTER_001'; assert.throws(() => compileDemonstration(p), /UNSUPPORTED_MODIFIER/); });
test('demonstration: environment visibility uses generic operations', () => { const d = isolated(); d.steps = [step('HIDE', {}, 'ENVIRONMENT')]; const s = compileDemonstration(finish(d)).sequence; assert.equal(evaluateDirected(s, 100).state.demonstration!.environment.visibility, false); });
test('demonstration: FLOW requires CONNECT and an explicit matching path', () => { const p = fixture('process'); p.steps = p.steps.filter(s => s.operation !== 'CONNECT'); assert.throws(() => compileDemonstration(finish(p)), /connected/); const q = fixture('process'); q.steps.find(s => s.operation === 'FLOW')!.parameters.path = [[0, 0, 0], [1, 0, 0]]; assert.throws(() => compileDemonstration(q), /path mismatch/); });
test('demonstration: FLOW .0 .25 .5 .75 1 has monotonic progress/arc length', () => { const p = fixture('process'), s = compileDemonstration(p).sequence, path = p.subjects.find(s => s.kind === 'PATH')!.path!; let previous = -1; for (const v of [0, .25, .5, .75, 1]) {
    const a = evaluateDirected(s, 90 + 90 * v).state.demonstration!.subjects.connection.parameters.flowProgress;
    assert(a >= previous);
    assert(Math.abs(a - v) < 1e-8);
    assert(pathAt(path, a).every(Number.isFinite));
    previous = a;
} assert.deepEqual(pathAt(path, 0), path[0]); assert.deepEqual(pathAt(path, 1), path.at(-1)); });
test('demonstration: INCREASE/DECREASE fill levels are monotonic and observable in final state', () => { const s = compileDemonstration(fixture('process')).sequence; let old = 0, source = .85; for (let f = 180; f <= 330; f++) {
    const e = evaluateDirected(s, f).state.demonstration!.subjects;
    assert(e.destination.parameters.fillLevel >= old);
    assert(e.source.parameters.fillLevel <= source);
    old = e.destination.parameters.fillLevel;
    source = e.source.parameters.fillLevel;
} assert.equal(old, .85); assert.equal(source, 0); });
test('demonstration: SEPARATE connection shrinks via the same primitive', () => { const d = fixture('process'); d.steps = d.steps.filter(s => !['FLOW', 'INCREASE', 'DECREASE', 'HIGHLIGHT'].includes(s.operation)); d.initialState.environment.groundCutaway = 0; d.steps.push({ ...step('SEPARATE', { from: 1, to: 0 }, 'connection'), startFrame: 180, endFrame: 240 }); const s = compileDemonstration(finish(d)).sequence; assert.equal(evaluateDirected(s, 240).state.demonstration!.subjects.connection.parameters.connection, 0); });
test('demonstration: Presenter modes reduce actual renderer visibility without deleting cast state', () => { const s = compileDemonstration(fixture()).sequence; assert.equal(evaluateDirected(s, 0).state.demonstration!.presenterMode, 'HYBRID'); assert.equal(evaluateDirected(s, 60).state.demonstration!.presenterMode, 'DEMONSTRATION'); assert(evaluateDirected(s, 299).state.actors.actor); });
test('demonstration: VisualProof validates structural coverage, not factual truth', () => { const claim = fixture().claim; const p = { claimId: claim.id, proofLevel: 'DIRECT' as const, evidenceResources: ['PROP_CAR_001'], demonstrationId: 'car-freezing-demo', rationale: 'Object changes visible state' }; assert.equal(proofQa([claim], [p]).directVisualProofRate, 1); assert.equal(proofQa([{ ...claim, requiresVisualProof: false }], [{ ...p, proofLevel: 'NONE', evidenceResources: [] }]).directVisualProofRate, null); assert.throws(() => proofQa([claim], [{ ...p, claimId: 'unknown' }])); assert.throws(() => proofQa([claim], [{ ...p, evidenceResources: [] }])); });
test('demonstration: only one resource ID added, no hidden process assets', () => { assert.equal(resources.length, 50); assert.equal(resources.filter(r => r.type === 'prop').length, 15); assert(resources.some(r => r.id === 'PROP_CAR_001')); assert(!resources.some(r => /PIPE|GROUND|LIQUID/.test(r.id))); });
