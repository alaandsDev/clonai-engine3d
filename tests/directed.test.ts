import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateDirected, evaluateDirected, ease, locomotionAt, directedQa, projectPosition, type DirectedSequence, type MovementType } from '../src/engine3d/directed';
import { directedSamples, motionMetrics, repetitionWarnings, compositionSignature } from '../src/engine3d/directed-metrics';
import { compileDirectorPlan } from '../src/engine3d/director';
import { registry } from '../src/engine3d/registry';
const fixture = () => JSON.parse(readFileSync(new URL('../examples/directed-door.json', import.meta.url), 'utf8')) as DirectedSequence;
const finish = (s: DirectedSequence) => { s.finalState = evaluateDirected(s, s.totalFrames).state; return s; };
test('directed: versioned closed schema, unknown data and missing fields fail', () => { assert.equal(validateDirected(fixture()).version, 1); for (const change of [(s: any) => s.version = 2, (s: any) => s.extra = true, (s: any) => delete s.initialState, (s: any) => s.fps = NaN, (s: any) => s.blocking[0].easing = 'BOUNCE']) {
    const s = fixture();
    change(s);
    assert.throws(() => validateDirected(s));
} });
test('directed: frames, overlap, required coverage and resource references fail before render', () => { for (const change of [(s: any) => s.blocking[0].endFrame = 0, (s: any) => s.cameraSegments[0].endFrame = 9999, (s: any) => s.shots[1].startFrame++, (s: any) => s.actionSegments[0].resourceId = 'ACTION_UNKNOWN', (s: any) => s.cameraSegments[0].cameraId = 'CAM_UNKNOWN', (s: any) => s.blocking.push(s.blocking[0])]) {
    const s = fixture();
    change(s);
    assert.throws(() => validateDirected(s));
} });
test('directed: independent deterministic random access and input immutability', () => { const s = fixture(), before = JSON.stringify(s), a = evaluateDirected(s, 210); for (const f of [509, 0, 114, 50])
    evaluateDirected(s, f); assert.deepEqual(evaluateDirected(s, 210), a); assert.equal(JSON.stringify(s), before); a.state.actors.actor.position[0] = 99; assert.notEqual(evaluateDirected(s, 210).state.actors.actor.position[0], 99); });
test('directed: four easing curves are bounded with exact endpoints', () => { for (const e of ['LINEAR', 'EASE_IN', 'EASE_OUT', 'EASE_IN_OUT'] as const) {
    assert.equal(ease(0, e), 0);
    assert.equal(ease(1, e), 1);
    let p = 0;
    for (let i = 0; i <= 100; i++) {
        const v = ease(i / 100, e);
        assert(v >= p && v <= 1);
        p = v;
    }
} assert.equal(ease(.25, 'EASE_IN'), .0625); assert.equal(ease(.25, 'EASE_OUT'), .4375); });
for (const type of ['STAY', 'STEP', 'WALK', 'APPROACH', 'RETREAT', 'SIDESTEP', 'TURN'] as MovementType[])
    test('directed: movement ' + type, () => { const s = fixture(); s.actionSegments = []; s.cameraSegments = []; s.propMotions = []; s.focusSegments = []; const b = s.blocking[0]; s.blocking = [{ ...b, startFrame: 0, endFrame: 90, startPosition: [-1, 0, 0], endPosition: ['STAY', 'TURN'].includes(type) ? [-1, 0, 0] : [-.5, 0, 0], startFacing: 0, endFacing: type === 'TURN' ? Math.PI / 2 : 0, movementType: type }]; s.initialState.actors.actor = { position: [-1, 0, 0], facing: 0 }; validateDirected(finish(s)); const mid = evaluateDirected(s, 45); assert.equal(mid.state.actors.actor.position[0], ['STAY', 'TURN'].includes(type) ? -1 : -.75); if (!['STAY', 'TURN'].includes(type))
        assert(mid.poses.actor.feet); });
test('directed: turn follows shortest arc with easing, not a facing teleport', () => { const s = fixture(); s.actionSegments = []; s.cameraSegments = []; s.blocking = [{ ...s.blocking[1], startFrame: 0, endFrame: 90, startPosition: s.initialState.actors.actor.position, endPosition: s.initialState.actors.actor.position, startFacing: 3.1, endFacing: -3.1 }]; s.initialState.actors.actor.facing = 3.1; assert(Math.abs(evaluateDirected(s, 45).state.actors.actor.facing - Math.PI) < 1e-8); });
test('directed: door progresses once, persists after its action and across shot boundaries', () => { const s = validateDirected(fixture()); assert.equal(evaluateDirected(s, 60).state.props.door.parameters.openProgress, 0); assert(Math.abs(evaluateDirected(s, 87.5).state.props.door.parameters.openProgress - .5) < 1e-9); for (const f of [115, 135, 186, 300, 509, 510])
    assert.equal(evaluateDirected(s, f).state.props.door.parameters.openProgress, 1); });
test('directed: explicit action progress supports chained 0 → .35 → 1 → hold', () => { const s = fixture(), a = s.actionSegments[0]; s.actionSegments = [{ ...a, endFrame: 85, toProgress: .35 }, { ...a, startFrame: 85, fromProgress: .35 }]; assert.equal(evaluateDirected(s, 85).state.props.door.parameters.openProgress, .35); assert.equal(evaluateDirected(s, 300).state.props.door.parameters.openProgress, 1); validateDirected(finish(s)); });
test('directed: declared final state and door start mismatch rejected', () => { const s = fixture(); s.finalState.props.door.parameters.openProgress = 0; assert.throws(() => validateDirected(s)); const t = fixture(); t.actionSegments[0].fromProgress = .35; assert.throws(() => validateDirected(finish(t))); });
test('directed: existing action compatibility retained', () => { const s = fixture(); s.baseShot.characters[0].resourceId = 'CHAR_ROBOT_001'; assert.throws(() => validateDirected(s), /INCOMPATIBLE_ACTION/); });
test('directed: prop entrance, held visibility and exit are random-access', () => { const s = fixture(); assert.equal(evaluateDirected(s, 185).state.props.map.visible, false); assert.equal(evaluateDirected(s, 200).state.props.map.visible, true); assert.equal(evaluateDirected(s, 300).state.props.map.visible, true); const p = s.propMotions[0]; s.propMotions=[p,{ ...p, startFrame: 400, endFrame: 450, type: 'LOWER', from: p.to, to: p.from }]; assert.equal(evaluateDirected(s, 450).state.props.map.visible, false); validateDirected(finish(s)); });
test('directed: conservative emphasis cap rejects large UI-like pulse', () => { const s = fixture(); s.propMotions[0].type = 'EMPHASIS'; assert.throws(() => validateDirected(s)); });
test('directed: focus targets resolve actor, prop, position and text target', () => { for (const target of [{ type: 'ACTOR', id: 'actor', offset: [0, 1, 0] }, { type: 'PROP', id: 'door', offset: [0, 1, 0] }, { type: 'POSITION', position: [0, 1, 0] }, { type: 'TEXT_TARGET', position: [1, 2, 0] }] as any[]) {
    const s = fixture();
    s.focusSegments = [{ ...s.focusSegments[0], target }];
    validateDirected(s);
    assert(evaluateDirected(s, 30).focus.every(Number.isFinite));
} const s = fixture(); s.focusSegments[0].target = { type: 'PROP', id: 'absent', offset: [0, 0, 0] }; assert.throws(() => validateDirected(s)); });
test('directed: follow, reframe and camera endpoints preserve continuity', () => { const s = validateDirected(fixture()); for (const f of [44, 45, 114, 115, 185, 186])
    assert(evaluateDirected(s, f).state.camera.position.every(Number.isFinite)); assert.deepEqual(evaluateDirected(s, 186).state.camera, s.cameraSegments[2].endState); assert.deepEqual(evaluateDirected(s, 0).state.camera, s.initialState.camera); });
test('directed: undeclared actor and camera jumps rejected, explicit cuts allowed', () => { const s = fixture(); s.blocking[0].startPosition = [20, 0, 0]; assert.throws(() => validateDirected(finish(s))); const c = fixture(); c.cameraSegments[1].startState.position = [20, 2, 8]; assert.throws(() => validateDirected(finish(c)), /camera (jump|start state mismatch)/); const cut = fixture(); cut.shots = [{ id: 'a', startFrame: 0, endFrame: 60, transition: 'CONTINUE' }, { id: 'b', startFrame: 60, endFrame: 510, transition: 'CUT' }]; cut.cameraSegments[1].startState.position = [2, 2.3, 7.2]; cut.cameraSegments[1].endState.position = [.4, 2.3, 7.2]; validateDirected(finish(cut)); });
test('directed: stance foot world X/Z is approximately planted during half-stride', () => { const s = fixture(), b = s.blocking[0], values = []; for (const t of [.02, .03, .04]) {
    const a = evaluateDirected(s, t * 45).state.actors.actor, p = locomotionAt({ ...s.baseShot.characters[0], position: a.position, rotation: [0, a.facing, 0] }, b, t * t * (3 - 2 * t)), foot = p.feet!.right, v = new (requireThreeVector())(...foot);
    v.applyAxisAngle(new (requireThreeVector())(0, 1, 0), a.facing).add(new (requireThreeVector())(...p.position));
    values.push(v);
} assert(Math.max(...values.map(x => x.x)) - Math.min(...values.map(x => x.x)) < .015); });
import { Vector3 } from 'three';
test('directed: transient body and leg channels of legacy actions are not dropped',()=>{
 for(const resourceId of ['ACTION_JUMP_001','ACTION_DANCE_001','ACTION_WALK_001','ACTION_RUN_001']){
  const s=fixture();s.blocking=[];s.cameraSegments=[];s.propMotions=[];s.focusSegments=[];
  s.actionSegments=[{resourceId,actorId:'actor',startFrame:0,endFrame:90,easing:'LINEAR',purpose:'Transient body action regression',fromProgress:0,toProgress:1}];
  validateDirected(finish(s));const root=s.initialState.actors.actor.position;
  assert(Array.from({length:89},(_,i)=>evaluateDirected(s,i+1).poses.actor).some(p=>Math.abs(p.position[0]-root[0])>.04||Math.abs(p.position[1]-root[1])>.04||Math.abs(p.leftLeg)>.04));
 }
 const s=fixture();s.actionSegments[0].resourceId='ACTION_WALK_001';s.actionSegments[0].targetPosition=[2,0,0];assert.throws(()=>validateDirected(s),/ActorBlocking/);
});
test('directed: pointing arm motion is measured even without body or camera movement',()=>{
 const s=fixture();s.blocking=[];s.cameraSegments=[];s.focusSegments=[];s.actionSegments=[s.actionSegments[1]];
 const m=motionMetrics(directedSamples(finish(s)),30,480,854);assert(m.motionDensity.actor>0);assert.equal(m.motionDensity.camera,0);
});
test('directed: existing camera trajectory contributes curvature while endpoints stay authored',()=>{
 const s=fixture(),t=fixture();t.cameraSegments[2].cameraId='CAM_STATIC_001';
 const a=evaluateDirected(s,150).state.camera.position,b=evaluateDirected(t,150).state.camera.position;
 assert(new Vector3(...a).distanceTo(new Vector3(...b))>.01);
 assert.deepEqual(evaluateDirected(s,186).state.camera,evaluateDirected(t,186).state.camera);
});
test('directed: all prop entrance/exit types and a bounded emphasis remain deterministic',()=>{
 for(const type of ['APPEAR','SLIDE','RISE','DROP','DISAPPEAR','SLIDE_OUT','LOWER','EMPHASIS'] as const){
  const s=fixture(),p=s.propMotions[0];s.actionSegments=[];const from={...p.from,visible:type==='DISAPPEAR'||type==='SLIDE_OUT'||type==='LOWER'},to={...from,position:[from.position[0],from.position[1]+.1,from.position[2]] as [number,number,number],visible:!['DISAPPEAR','SLIDE_OUT','LOWER'].includes(type)};
  s.initialState.props.map={...s.initialState.props.map,...from};s.propMotions=[{...p,type,from,to}];validateDirected(finish(s));
  assert.deepEqual(evaluateDirected(s,200),evaluateDirected(s,200));assert.equal(evaluateDirected(s,300).state.props.map.visible,to.visible);
 }
});
test('directed: bounds and unknown state parameters fail preflight',()=>{
 const s=fixture();s.initialState.camera.position=[0,2,100];s.cameraSegments[0].startState=s.initialState.camera;assert.throws(()=>validateDirected(finish(s)));
 const t=fixture();t.initialState.props.map.parameters={bogus:1};assert.throws(()=>validateDirected(finish(t)),/INVALID_PARAMETER/);
});
function requireThreeVector() { return Vector3; }
test('directed: motion density excludes snow alone; repetition warns without rejection', () => { const s = fixture(); s.blocking = []; s.actionSegments = []; s.cameraSegments = []; s.propMotions = []; s.focusSegments = []; s.shots.forEach(x => delete x.onScreenText);s.baseShot.vfx=s.baseShot.vfx.filter(v=>v.resourceId==='VFX_SNOW_001'); const m = motionMetrics(directedSamples(finish(s)), 30, 480, 854); assert.equal(m.motionDensity.narrative, 0); assert(m.motionDensity.vfx > 0); assert.equal(m.visualChangesPerMinute, 0); assert(repetitionWarnings([1, 1, 1, 1]).length === 1); });
test('directed: motion and composition measure projected position, not only camera IDs', () => { const s = fixture(), m = motionMetrics(directedSamples(s), 30, 480, 854); assert(m.motionDensity.actor > 0); assert(m.motionDensity.camera > 0); assert(m.visualChangesPerMinute > 0); assert(m.actorPositionVariety.minScreenX < m.actorPositionVariety.maxScreenX); assert(m.camera.pathLength > 0); });
test('directed: legacy plan and registry remain available without a directed layer', () => { assert.equal(registry.entries.length, 53); const p = JSON.parse(readFileSync(new URL('../examples/cold-opening.json', import.meta.url), 'utf8')); assert(compileDirectorPlan(p).totalFrames > 0); });
