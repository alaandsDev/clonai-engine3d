import { PerspectiveCamera, Vector3 } from 'three';
import { fail, type Vec3, type ShotSpec, type CaptionCue, type Instance } from './contracts';
import { fields, finite, text, vec, list } from './schema';
import { resolveShot, resource, parameters } from './validation';
import { poseAt, type Pose, cameraAt } from './motion';
import type {DemonstrationProgram,DemonstrationState} from './demonstration-contracts';
import {evaluateDemonstration,validateDemonstrationProgram,stateEqual} from './demonstration-runtime';
export type Easing = 'LINEAR' | 'EASE_IN' | 'EASE_OUT' | 'EASE_IN_OUT';
export type MovementType = 'STAY' | 'STEP' | 'WALK' | 'APPROACH' | 'RETREAT' | 'SIDESTEP' | 'TURN';
export type BlockingIntent = 'PRESENT_OBJECT' | 'REVEAL_OBJECT' | 'MAKE_SPACE_FOR_TEXT' | 'OBSERVE' | 'INTERACT' | 'REACT' | 'ENTER_SCENE' | 'EXIT_SCENE';
export type FocusTarget = {
    type: 'ACTOR' | 'PROP';
    id: string;
    offset: Vec3;
} | {
    type: 'POSITION' | 'TEXT_TARGET';
    position: Vec3;
};
export interface CameraState {
    position: Vec3;
    target: Vec3;
}
export interface SequenceState {
    demonstration?:DemonstrationState;
    actors: Record<string, {
        position: Vec3;
        facing: number;
    }>;
    props: Record<string, {
        position: Vec3;
        rotation: Vec3;
        scale: Vec3;
        visible: boolean;
        parameters: Record<string, number>;
    }>;
    camera: CameraState;
}
interface Segment {
    startFrame: number;
    endFrame: number;
    easing: Easing;
    purpose: string;
}
export interface ActorBlocking extends Segment {
    actorId: string;
    startPosition: Vec3;
    endPosition: Vec3;
    startFacing: number;
    endFacing: number;
    movementType: MovementType;
    intent: BlockingIntent;
    target?: FocusTarget;
}
export interface ActionSegment extends Segment {
    resourceId: string;
    actorId: string;
    targetId?: string;
    targetPosition?: Vec3;
    fromProgress: number;
    toProgress: number;
}
export interface CameraSegment extends Segment {
    cameraId: string;
    behavior: 'MOVE' | 'FOLLOW' | 'REFRAME';
    startState: CameraState;
    endState: CameraState;
    focusTarget?: FocusTarget;
}
export interface PropMotion extends Segment {
    propId: string;
    type: 'APPEAR' | 'SLIDE' | 'RISE' | 'DROP' | 'DISAPPEAR' | 'SLIDE_OUT' | 'LOWER' | 'EMPHASIS';
    from: {
        position: Vec3;
        rotation: Vec3;
        scale: Vec3;
        visible: boolean;
    };
    to: {
        position: Vec3;
        rotation: Vec3;
        scale: Vec3;
        visible: boolean;
    };
}
export interface FocusSegment extends Segment {
    target: FocusTarget;
}
export interface DirectedSequence {
    demonstration?:DemonstrationProgram;
    version: 1;
    id: string;
    fps: number;
    width: number;
    height: number;
    totalFrames: number;
    baseShot: ShotSpec;
    initialState: SequenceState;
    finalState: SequenceState;
    blocking: ActorBlocking[];
    actionSegments: ActionSegment[];
    cameraSegments: CameraSegment[];
    focusSegments: FocusSegment[];
    propMotions: PropMotion[];
    shots: {
        id: string;
        startFrame: number;
        endFrame: number;
        transition: 'CONTINUE' | 'CUT';
        onScreenText?: string;
    }[];
    captions: CaptionCue[];
}
export const ease = (t: number, e: Easing) => { const x = Math.max(0, Math.min(1, t)); return e === 'LINEAR' ? x : e === 'EASE_IN' ? x * x : e === 'EASE_OUT' ? 1 - (1 - x) ** 2 : x * x * (3 - 2 * x); };
const mix = (a: number, b: number, t: number) => t === 0 ? a : t === 1 ? b : a + (b - a) * t;
const lerp = (a: Vec3, b: Vec3, t: number) => a.map((x, i) => mix(x, b[i], t)) as Vec3;
const distance = (a: Vec3, b: Vec3) => new Vector3(...a).distanceTo(new Vector3(...b));
const angle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const progress = (s: Segment, f: number) => ease((f - s.startFrame) / (s.endFrame - s.startFrame), s.easing);
export const compositionZones = { LEFT: [.08, .36], CENTER: [.36, .64], RIGHT: [.64, .92] } as const;
export const depthPlacement = { FOREGROUND: 1.5, MIDGROUND: 0, BACKGROUND: -3 } as const;
function keys(v: unknown, k: string[], label: string) { fields(v, k, label); for (const key of k)
    if (!(key in (v as object)))
        fail('DIRECTED_SCHEMA', label + '.' + key + ' required'); }
function enumValue(v: unknown, values: string[]) { if (typeof v !== 'string' || !values.includes(v))
    fail('DIRECTED_SCHEMA', 'invalid enum ' + String(v)); }
function int(v: unknown, min: number, max: number) { finite(v, 'frame', min, max); if (!Number.isInteger(v))
    fail('DIRECTED_SCHEMA', 'integer required'); }
function stateShape(s: SequenceState, shot: ShotSpec) {
    fields(s, ['actors', 'props', 'camera','demonstration'], 'state');
    keys(s.actors, shot.characters.map(i => i.instanceId), 'actors');
    keys(s.props, shot.props.map(i => i.instanceId), 'props');
    cameraShape(s.camera);
    for (const a of Object.values(s.actors)) {
        keys(a, ['position', 'facing'], 'actor state');
        vec(a.position, 'position');
        finite(a.facing, 'facing');
    }
    for (const p of Object.values(s.props)) {
        keys(p, ['position', 'rotation', 'scale', 'visible', 'parameters'], 'prop state');
        vec(p.position, 'position');
        vec(p.rotation, 'rotation');
        vec(p.scale, 'scale', true);
        if (typeof p.visible !== 'boolean')
            fail('DIRECTED_SCHEMA', 'visible boolean');
        fields(p.parameters, Object.keys(p.parameters), 'parameters');
        for (const v of Object.values(p.parameters))
            finite(v, 'parameter');
    }
}
function cameraShape(c: CameraState) { keys(c, ['position', 'target'], 'camera state'); vec(c.position, 'camera position'); vec(c.target, 'camera target'); if (distance(c.position, c.target) < .1)
    fail('DIRECTED_SCHEMA', 'camera target degeneracy'); }
function focusShape(t: FocusTarget, s: DirectedSequence) {
    if (t?.type === 'ACTOR' || t?.type === 'PROP') {
        keys(t, ['type', 'id', 'offset'], 'focus');
        text(t.id, 'focus id');
        vec(t.offset, 'focus offset');
        if (!(t.type === 'ACTOR' ? s.baseShot.characters : s.baseShot.props).some(i => i.instanceId === t.id) && !(t.type==='PROP'&&s.demonstration?.subjects.some(x=>x.id===t.id)))
            fail('DIRECTED_SCHEMA', 'unknown focus');
    }
    else {
        keys(t, ['type', 'position'], 'focus');
        enumValue(t.type, ['POSITION', 'TEXT_TARGET']);
        vec((t as {
            position: Vec3;
        }).position, 'focus position');
    }
}
const segmentKeys = ['startFrame', 'endFrame', 'easing', 'purpose'];
function segment(s: Segment, total: number) { int(s.startFrame, 0, total - 1); int(s.endFrame, 1, total); if (s.startFrame >= s.endFrame)
    fail('DIRECTED_SCHEMA', 'empty segment'); enumValue(s.easing, ['LINEAR', 'EASE_IN', 'EASE_OUT', 'EASE_IN_OUT']); text(s.purpose, 'purpose'); }
function noOverlap<T extends Segment>(items: T[], key: (s: T) => string) { for (let i = 0; i < items.length; i++)
    for (let j = 0; j < i; j++)
        if (key(items[i]) === key(items[j]) && items[i].startFrame < items[j].endFrame && items[j].startFrame < items[i].endFrame)
            fail('DIRECTED_SCHEMA', 'overlapping tracks'); }
export function validateDirected(input: DirectedSequence): DirectedSequence {
    const s = structuredClone(input);
    fields(s, ['version', 'id', 'fps', 'width', 'height', 'totalFrames', 'baseShot', 'initialState', 'finalState', 'blocking', 'actionSegments', 'cameraSegments', 'focusSegments', 'propMotions', 'shots', 'captions','demonstration'], 'DirectedSequence');
    if (s.version !== 1)
        fail('DIRECTED_SCHEMA', 'version');
    text(s.id, 'id');
    int(s.fps, 1, 120);
    int(s.width, 2, 4096);
    int(s.height, 2, 4096);
    int(s.totalFrames, 1, 14400);
    if (s.width % 2 || s.height % 2)
        fail('DIRECTED_SCHEMA', 'even canvas');
    s.baseShot = resolveShot(s.baseShot);
    if (Math.abs(s.baseShot.durationSeconds * s.fps - s.totalFrames) > 1e-6)
        fail('DIRECTED_SCHEMA', 'duration mismatch');
    if (s.baseShot.actions.length)
        fail('DIRECTED_SCHEMA', 'actions belong to actionSegments');
    if(s.demonstration){validateDemonstrationProgram(s.demonstration,s.baseShot,s.totalFrames);if(!stateEqual(s.initialState.demonstration,s.demonstration.initialState)||!stateEqual(s.finalState.demonstration,s.demonstration.finalState))fail('DEMONSTRATION_STATE','directed/program state mismatch');}else if(s.initialState.demonstration||s.finalState.demonstration)fail('DEMONSTRATION_STATE','state without program');
    stateShape(s.initialState, s.baseShot);
    stateShape(s.finalState, s.baseShot);
    for (const state of [s.initialState, s.finalState])
        for (const i of s.baseShot.props)
            parameters(i.resourceId, state.props[i.instanceId].parameters);
    for (const name of ['blocking', 'actionSegments', 'cameraSegments', 'focusSegments', 'propMotions', 'shots', 'captions'] as const) {
        list(s[name], name);
        if (s[name].length > 256)
            fail('DIRECTED_SCHEMA', 'track cap');
    }
    for (const b of s.blocking) {
        fields(b, [...segmentKeys, 'actorId', 'startPosition', 'endPosition', 'startFacing', 'endFacing', 'movementType', 'intent', 'target'], 'blocking');
        segment(b, s.totalFrames);
        if (!s.initialState.actors[b.actorId])
            fail('DIRECTED_SCHEMA', 'actor');
        vec(b.startPosition, 'start');
        vec(b.endPosition, 'end');
        finite(b.startFacing, 'facing');
        finite(b.endFacing, 'facing');
        enumValue(b.movementType, ['STAY', 'STEP', 'WALK', 'APPROACH', 'RETREAT', 'SIDESTEP', 'TURN']);
        enumValue(b.intent, ['PRESENT_OBJECT', 'REVEAL_OBJECT', 'MAKE_SPACE_FOR_TEXT', 'OBSERVE', 'INTERACT', 'REACT', 'ENTER_SCENE', 'EXIT_SCENE']);
        if (b.target)
            focusShape(b.target, s);
        if (['STAY', 'TURN'].includes(b.movementType) && distance(b.startPosition, b.endPosition) > 1e-8)
            fail('DIRECTED_SCHEMA', 'stationary type translates');
        if (b.movementType === 'STAY' && Math.abs(b.endFacing - b.startFacing) > 1e-8)
            fail('DIRECTED_SCHEMA', 'STAY turns');
        if (b.movementType === 'STEP' && distance(b.startPosition, b.endPosition) > .85)
            fail('DIRECTED_SCHEMA', 'STEP exceeds single stride');
    }
    for (const a of s.actionSegments) {
        fields(a, [...segmentKeys, 'resourceId', 'actorId', 'targetId', 'targetPosition', 'fromProgress', 'toProgress'], 'action');
        segment(a, s.totalFrames);
        resource(a.resourceId, 'action');
        finite(a.fromProgress, 'progress', 0, 1);
        finite(a.toProgress, 'progress', 0, 1);
        if (['ACTION_WALK_001','ACTION_RUN_001'].includes(a.resourceId) && a.targetPosition)
            fail('DIRECTED_SCHEMA','root locomotion belongs to ActorBlocking, not transient action poses');
        resolveShot({ ...s.baseShot, actions: [{ resourceId: a.resourceId, actor: a.actorId, ...(a.targetId ? { target: a.targetId } : {}), ...(a.targetPosition ? { targetPosition: a.targetPosition } : {}), start: 0, end: 1 }] });
    }
    for (const c of s.cameraSegments) {
        fields(c, [...segmentKeys, 'cameraId', 'behavior', 'startState', 'endState', 'focusTarget'], 'camera');
        segment(c, s.totalFrames);
        resource(c.cameraId, 'camera');
        enumValue(c.behavior, ['MOVE', 'FOLLOW', 'REFRAME']);
        cameraShape(c.startState);
        cameraShape(c.endState);
        if (c.focusTarget)
            focusShape(c.focusTarget, s);
        if (c.behavior !== 'MOVE' && !c.focusTarget)
            fail('DIRECTED_SCHEMA', 'focus required');
    }
    for (const f of s.focusSegments) {
        keys(f, [...segmentKeys, 'target'], 'focus segment');
        segment(f, s.totalFrames);
        focusShape(f.target, s);
    }
    for (const p of s.propMotions) {
        keys(p, [...segmentKeys, 'propId', 'type', 'from', 'to'], 'prop motion');
        segment(p, s.totalFrames);
        if (!s.initialState.props[p.propId])
            fail('DIRECTED_SCHEMA', 'prop');
        enumValue(p.type, ['APPEAR', 'SLIDE', 'RISE', 'DROP', 'DISAPPEAR', 'SLIDE_OUT', 'LOWER', 'EMPHASIS']);
        for (const x of [p.from, p.to]) {
            keys(x, ['position', 'rotation', 'scale', 'visible'], 'prop transform');
            vec(x.position, 'position');
            vec(x.rotation, 'rotation');
            vec(x.scale, 'scale', true);
            if (typeof x.visible !== 'boolean')
                fail('DIRECTED_SCHEMA', 'visible');
        }
        if (p.type === 'EMPHASIS' && (distance(p.from.position, p.to.position) > .25 || p.to.scale.some((v, i) => Math.abs(v / p.from.scale[i] - 1) > .15) || p.to.rotation.some((v, i) => Math.abs(v - p.from.rotation[i]) > .3)))
            fail('DIRECTED_SCHEMA', 'emphasis cap');
    }
    noOverlap(s.blocking, b => b.actorId);
    noOverlap(s.actionSegments, a => a.actorId);
    noOverlap(s.cameraSegments, () => 'camera');
    noOverlap(s.propMotions, p => p.propId);
    noOverlap(s.focusSegments, () => 'focus');
    let cursor = 0;
    const ids = new Set<string>();
    for (const shot of s.shots) {
        fields(shot, ['id', 'startFrame', 'endFrame', 'transition', 'onScreenText'], 'shot');
        text(shot.id, 'shot id');
        if (ids.has(shot.id))
            fail('DIRECTED_SCHEMA', 'duplicate shot');
        ids.add(shot.id);
        int(shot.startFrame, 0, s.totalFrames - 1);
        int(shot.endFrame, 1, s.totalFrames);
        if (shot.startFrame !== cursor || shot.endFrame <= cursor)
            fail('DIRECTED_SCHEMA', 'shot coverage');
        enumValue(shot.transition, ['CONTINUE', 'CUT']);
        if (shot.onScreenText !== undefined)
            text(shot.onScreenText, 'text');
        cursor = shot.endFrame;
    }
    if (cursor !== s.totalFrames)
        fail('DIRECTED_SCHEMA', 'incomplete shots');
    cursor = 0;
    for (const c of s.captions) {
        keys(c, ['text', 'startFrame', 'endFrame'], 'caption');
        text(c.text, 'caption');
        int(c.startFrame, 0, s.totalFrames - 1);
        int(c.endFrame, 1, s.totalFrames);
        if (c.startFrame < cursor || c.endFrame <= c.startFrame)
            fail('DIRECTED_SCHEMA', 'caption overlap');
        cursor = c.endFrame;
    }
    for (const id of Object.keys(s.initialState.actors)) {
        let prior = s.initialState.actors[id];
        for (const b of s.blocking.filter(x => x.actorId === id).sort((a, b) => a.startFrame - b.startFrame)) {
            const cut = s.shots.some(x => x.startFrame === b.startFrame && x.transition === 'CUT');
            if (!cut && (distance(prior.position, b.startPosition) > 1e-6 || Math.abs(Math.atan2(Math.sin(prior.facing - b.startFacing), Math.cos(prior.facing - b.startFacing))) > 1e-6))
                fail('DIRECTED_CONTINUITY', 'blocking start state');
            prior = { position: b.endPosition, facing: b.endFacing };
        }
    }
    for (const id of Object.keys(s.initialState.props)) {
        let prior = s.initialState.props[id].parameters.openProgress;
        for (const a of s.actionSegments.filter(x => x.targetId === id && x.resourceId === 'ACTION_OPEN_DOOR_001').sort((a, b) => a.startFrame - b.startFrame)) {
            if (Math.abs((prior ?? 0) - a.fromProgress) > 1e-6)
                fail('DIRECTED_CONTINUITY', 'door progress reset');
            prior = a.toProgress;
        }
    }
    let priorCamera = s.initialState.camera;
    for (const c of [...s.cameraSegments].sort((a, b) => a.startFrame - b.startFrame)) {
        if (!s.shots.some(x => x.startFrame === c.startFrame && x.transition === 'CUT') && !closeState(c.startState, priorCamera))
            fail('DIRECTED_CONTINUITY', 'camera start state mismatch');
        priorCamera = c.endState;
    }
    for (const id of Object.keys(s.initialState.props)) {
        let prior = s.initialState.props[id];
        for (const p of s.propMotions.filter(x => x.propId === id).sort((a, b) => a.startFrame - b.startFrame)) {
            for (const k of ['position', 'rotation', 'scale', 'visible'] as const)
                if (!closeState(prior[k], p.from[k]))
                    fail('DIRECTED_CONTINUITY', 'prop start state mismatch');
            prior = { ...prior, ...(p.type === 'EMPHASIS' ? p.from : p.to) };
        }
    }
    const end = evaluateDirected(s, s.totalFrames).state;
    if (!closeState(end, s.finalState))
        fail('DIRECTED_STATE', 'finalState differs from deterministic evolution');
    const qa = directedQa(s);
    if (qa.errors.length)
        fail('DIRECTED_CONTINUITY', qa.errors.join('; '));
    return s;
}
function closeState(a: unknown, b: unknown): boolean { if (typeof a === 'number' && typeof b === 'number')
    return Math.abs(a - b) < 1e-6; if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object')
    return a === b; const x = a as Record<string, unknown>, y = b as Record<string, unknown>; return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => k in y && closeState(x[k], y[k])); }
function focusPosition(t: FocusTarget, state: SequenceState): Vec3 { return t.type === 'ACTOR' || t.type === 'PROP' ? lerp((t.type === 'ACTOR' ? state.actors[t.id] : state.props[t.id]??state.demonstration!.subjects[t.id]).position, t.offset, 0).map((v, i) => v + t.offset[i]) as Vec3 : (t as {
    position: Vec3;
}).position; }
/** Pure random-access evaluation; call validateDirected once before evaluating frames. */
export function evaluateDirected(s: DirectedSequence, frame: number) {
    finite(frame, 'frame', 0, s.totalFrames);
    const state = structuredClone(s.initialState), locomotion: Record<string, Pose> = {};
    applyDemonstration(s,state,frame);
    for (const b of [...s.blocking].sort((a, b) => a.startFrame - b.startFrame)) {
        if (frame < b.startFrame)
            continue;
        const t = progress(b, frame), a = state.actors[b.actorId];
        a.position = lerp(b.startPosition, b.endPosition, t);
        a.facing = angle(b.startFacing, b.endFacing, t);
    }
    for (const p of [...s.propMotions].sort((a, b) => a.startFrame - b.startFrame)) {
        if (frame < p.startFrame)
            continue;
        const t = progress(p, frame), v = state.props[p.propId], pulse = p.type === 'EMPHASIS' ? Math.sin(t * Math.PI) : t;
        v.position = lerp(p.from.position, p.to.position, pulse);
        v.rotation = lerp(p.from.rotation, p.to.rotation, pulse);
        v.scale = lerp(p.from.scale, p.to.scale, pulse);
        v.visible = frame >= p.endFrame ? p.to.visible : p.type === 'DISAPPEAR' ? p.from.visible : p.type === 'APPEAR' ? p.to.visible : p.from.visible || p.to.visible;
    }
    for (const a of [...s.actionSegments].sort((a, b) => a.startFrame - b.startFrame)) {
        if (frame < a.startFrame)
            continue;
        if (a.resourceId === 'ACTION_OPEN_DOOR_001') {
            const door = state.props[a.targetId!];
            door.parameters.openProgress = mix(a.fromProgress, a.toProgress, progress(a, frame));
        }
    }
    let activeCamera: CameraSegment | undefined;
    for (const c of [...s.cameraSegments].sort((a, b) => a.startFrame - b.startFrame)) {
        if (frame < c.startFrame)
            continue;
        const t = progress(c, frame);
        state.camera = cameraCurve(c, t);
        if (frame < c.endFrame) {
            activeCamera = c;
            if (c.focusTarget) {
                const target = focusPosition(c.focusTarget, state), initial = focusPosition(c.focusTarget, evaluateActorPropsAtStart(s, c.startFrame));
                if (c.behavior === 'FOLLOW') {
                    const endTarget = focusPosition(c.focusTarget, evaluateActorPropsAtStart(s, c.endFrame));
                    const delta = target.map((v, i) => v - initial[i] - (endTarget[i] - initial[i]) * t) as Vec3;
                    state.camera.position = state.camera.position.map((v, i) => v + delta[i]) as Vec3;
                    state.camera.target = state.camera.target.map((v, i) => v + delta[i]) as Vec3;
                }
                else if (c.behavior === 'REFRAME')
                    state.camera.target = lerp(c.startState.target, target, t);
            }
        }
    }
    // FOLLOW/REFRAME endpoints remain explicit and must match the following camera start state.
    const characters = s.baseShot.characters.map(i => ({ ...i, position: state.actors[i.instanceId].position, rotation: [i.rotation?.[0] ?? 0, state.actors[i.instanceId].facing, i.rotation?.[2] ?? 0] as Vec3 }));
    const props = s.baseShot.props.map(i => { const p = state.props[i.instanceId]; return { ...i, position: p.position, rotation: p.rotation, scale: p.scale, parameters: p.parameters, initialState: { ...p.parameters }, finalState: undefined }; });
    const moment = s.shots.find(x => frame >= x.startFrame && frame < x.endFrame) ?? s.shots[s.shots.length - 1];
    const shot: ShotSpec = { ...s.baseShot, characters, props, actions: [], onScreenText: moment.onScreenText };
    const poses: Record<string, Pose> = {};
    for (const i of characters) {
        let pose = poseAt(i, shot, 0);
        const b = s.blocking.find(b => b.actorId === i.instanceId && frame >= b.startFrame && frame < b.endFrame);
        if (b && !['STAY', 'TURN'].includes(b.movementType) && distance(b.startPosition, b.endPosition) > 1e-8) {
            pose = locomotionAt(i, b, progress(b, frame));
            locomotion[i.instanceId] = pose;
        }
        for (const a of s.actionSegments.filter(a => a.actorId === i.instanceId && frame >= a.startFrame && frame <= a.endFrame)) {
            const p = poseAt(i, { ...shot, actions: [{ resourceId: a.resourceId, actor: a.actorId, ...(a.targetId ? { target: a.targetId } : {}), ...(a.targetPosition ? { targetPosition: a.targetPosition } : {}), start: 0, end: 1 }] }, mix(a.fromProgress, a.toProgress, progress(a, frame)));
            const w = Math.min(1, Math.max(0, (frame - a.startFrame) / (a.endFrame - a.startFrame)) * 8, Math.max(0, (a.endFrame - frame) / (a.endFrame - a.startFrame)) * 8);
            // Retain transient body/leg channels too (Jump/Dance/Walk/Run), while
            // persistent root translation remains owned by ActorBlocking.
            pose.position = pose.position.map((v,k)=>v+(p.position[k]-i.position![k])*w) as Vec3;
            pose.lean += p.lean*w;
            pose.leftLeg = mix(pose.leftLeg,p.leftLeg,w);
            pose.rightLeg = mix(pose.rightLeg,p.rightLeg,w);
            pose = { ...pose, leftArm: p.leftArm * w, rightArm: p.rightArm * w, headYaw: p.headYaw * w, handReach: p.handReach ? lerp([Math.sin(.3) * .57, -Math.cos(.3) * .57, 0], p.handReach, w) : undefined, leftHandReach: p.leftHandReach ? lerp([-Math.sin(.3) * .57, -Math.cos(.3) * .57, 0], p.leftHandReach, w) : undefined };
        }
        poses[i.instanceId] = pose;
    }
    const focus = [...s.focusSegments].sort((a, b) => a.startFrame - b.startFrame).filter(f => frame >= f.startFrame).at(-1)?.target;
    return { state, shot, poses, visibleProps: Object.fromEntries(Object.entries(state.props).map(([id, p]) => [id, p.visible])), focus: focus ? focusPosition(focus, state) : state.camera.target, activeCamera, locomotion };
}
function evaluateActorPropsAtStart(s: DirectedSequence, f: number): SequenceState { const state = structuredClone(s.initialState);applyDemonstration(s,state,f); for (const b of [...s.blocking].sort((a, b) => a.startFrame - b.startFrame))
    if (f >= b.startFrame) {
        state.actors[b.actorId] = { position: lerp(b.startPosition, b.endPosition, progress(b, f)), facing: angle(b.startFacing, b.endFacing, progress(b, f)) };
    } for (const p of [...s.propMotions].sort((a, b) => a.startFrame - b.startFrame))
    if (f >= p.startFrame)
        state.props[p.propId].position = lerp(p.from.position, p.to.position, progress(p, f)); return state; }
/** Distance-driven short strides, stance foot planted in world ground plane. No IK/physics. */
export function locomotionAt(i: Instance, b: ActorBlocking, t: number): Pose {
    const p: Pose = { position: [...i.position!], lean: 0, headYaw: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 };
    const d = distance(b.startPosition, b.endPosition), steps = Math.max(1, Math.ceil(d / .38)), phase = t * steps, index = Math.min(steps - 1, Math.floor(phase)), u = phase - index, stride = d / steps, sign = index % 2 === 0 ? 1 : -1;
    const dir = new Vector3(...b.endPosition).sub(new Vector3(...b.startPosition)).normalize(), q = index / steps, planted = lerp(b.startPosition, b.endPosition, q), next = lerp(b.startPosition, b.endPosition, (index + 1) / steps), facing = i.rotation?.[1] ?? 0;
    const local = (world: Vec3) => new Vector3(...world).sub(new Vector3(...p.position)).applyAxisAngle(new Vector3(0, 1, 0), -facing).toArray() as Vec3;
    const foot = (side: number) => { const stance = side === sign, world = stance ? planted : lerp(planted, next, u); const lateral = new Vector3(.19 * side, 0, 0).applyAxisAngle(new Vector3(0, 1, 0), facing); world[0] += lateral.x; world[2] += lateral.z; world[1] = .12 + (stance ? 0 : Math.sin(Math.PI * u) * .12); return local(world); };
    p.feet = { left: foot(-1), right: foot(1) };
    const wave = Math.sin(phase * Math.PI), envelope = Math.min(1, t * 10, (1 - t) * 10);
    p.leftArm = wave * .35 * envelope;
    p.rightArm = -p.leftArm;
    p.position[1] += Math.sin(Math.PI * u) ** 2 * .025 * envelope;
    p.lean = .025 * envelope;
    return p;
}
export function projectPosition(position: Vec3, camera: CameraState, width: number, height: number) { const c = new PerspectiveCamera(44, width / height, .1, 100); c.position.set(...camera.position); c.lookAt(...camera.target); c.updateMatrixWorld(); const v = new Vector3(...position).project(c); return { x: (v.x + 1) / 2, y: (1 - v.y) / 2, depth: v.z }; }
export function directedQa(s: DirectedSequence) {
    const errors: string[] = [], warnings: string[] = [], samples = [];
    let prev: ReturnType<typeof evaluateDirected> | undefined;
    for (let f = 0; f <= s.totalFrames; f++) {
        const e = evaluateDirected(s, f), cut = s.shots.some(x => x.startFrame === f && x.transition === 'CUT');
        for (const [id, a] of Object.entries(e.state.actors)) {
            if (a.position.some(v => !Number.isFinite(v) || Math.abs(v) > 30))
                errors.push(`actor bounds ${id}/${f}`);
            if (prev && !cut && distance(a.position, prev.state.actors[id].position) > .18)
                errors.push(`teleport ${id}/${f}`);
            for (const [pid, p] of Object.entries(e.state.props))
                if (p.visible && Math.hypot(a.position[0] - p.position[0], a.position[2] - p.position[2]) < .24)
                    warnings.push(`coarse actor/prop intersection ${id}/${pid}/${f}`);
        }
        if (prev && !cut && (distance(e.state.camera.position, prev.state.camera.position) > .22 || distance(e.state.camera.target, prev.state.camera.target) > .22))
            errors.push(`camera jump ${f}`);
        if ([...e.state.camera.position, ...e.state.camera.target].some(v => !Number.isFinite(v) || Math.abs(v) > 50))
            errors.push(`camera bounds ${f}`);
        for (const [id, p] of Object.entries(e.state.props)) {
            if (p.position.some(v => Math.abs(v) > 30) || p.scale.some(v => v < .05 || v > 4))
                errors.push(`prop bounds ${id}/${f}`);
        }
        for (const [id, a] of Object.entries(e.state.actors)) {
            const projected = projectPosition([a.position[0], a.position[1] + 1.2, a.position[2]], e.state.camera, s.width, s.height);
            if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y) || projected.depth > 1 || projected.depth < -1)
                errors.push(`actor behind camera ${id}/${f}`);
            if (projected.x < .08 || projected.x > .92 || projected.y < .08 || projected.y > .72)
                warnings.push(`actor center outside conservative safe zone ${id}/${f}`);
        }
        for (const [id, p] of Object.entries(e.state.props))
            if (prev && !cut && distance(p.position, prev.state.props[id].position) > .22)
                errors.push(`prop teleport ${id}/${f}`);
        for (const p of [...Object.values(e.state.actors), ...Object.values(e.state.props)])
            if (!p.position.every(Number.isFinite))
                errors.push(`nonfinite ${f}`);
        const active = s.blocking.filter(x => f >= x.startFrame && f < x.endFrame && x.movementType !== 'STAY').length + s.cameraSegments.filter(x => f >= x.startFrame && f < x.endFrame && (distance(x.startState.position, x.endState.position) > 0 || distance(x.startState.target, x.endState.target) > 0 || x.behavior === 'FOLLOW')).length + s.propMotions.filter(x => f >= x.startFrame && f < x.endFrame).length + s.actionSegments.filter(x => f >= x.startFrame && f < x.endFrame).length;
        if (active > 2)
            warnings.push(`motion budget ${f}: ${active}`);
        if (f < s.totalFrames)
            samples.push(e);
        prev = e;
    }
    return { errors: [...new Set(errors)], warnings: [...new Set(warnings)], samples };
}
/** Preserve authored endpoints; existing camera executor supplies bounded trajectory curvature. */
function cameraCurve(c: CameraSegment, t: number): CameraState {
    if (t === 0)
        return structuredClone(c.startState);
    if (t === 1)
        return structuredClone(c.endState);
    const a = cameraAt(c.cameraId, 0, .18), b = cameraAt(c.cameraId, 1, .18), p = cameraAt(c.cameraId, t, .18);
    const curve = (key: 'position' | 'target') => lerp(c.startState[key], c.endState[key], t).map((v, i) => v + p[key][i] - mix(a[key][i], b[key][i], t)) as Vec3;
    return { position: curve('position'), target: curve('target') };
}
function applyDemonstration(s:DirectedSequence,state:SequenceState,frame:number){
 if(!s.demonstration)return;const demo=evaluateDemonstration(s.demonstration,frame);state.demonstration=demo;
 for(const subject of s.demonstration.subjects.filter(x=>x.kind==='PROP')){const p=demo.subjects[subject.id],target=state.props[subject.id];Object.assign(target,{position:p.position,rotation:p.rotation,scale:p.scale,visible:p.visible});if(subject.resourceId==='PROP_CAR_001')target.parameters.frost=p.parameters.frost??0;if(subject.resourceId==='PROP_THERMOMETER_001')target.parameters.value=p.parameters.value??0;}
}
