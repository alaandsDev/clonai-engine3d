import { Vector3 } from 'three';
import { cameraAt, poseAt, type Pose } from './motion';
import { evaluateDirected, projectPosition, type DirectedSequence, type CameraState } from './directed';
import type { Vec3, ProceduralSequence } from './contracts';
interface Sample {
    camera: CameraState;
    actors: Record<string, {
        position: Vec3;
        facing: number;
        motion: number[];
    }>;
    props: Record<string, {
        position: Vec3;
        visible: boolean;
        value: number;
    }>;
    environment: string;
    focus: Vec3;
    text: string;
    vfx: boolean; narrativeVfx:string[];
    cut: boolean;
    continuous: boolean;
}
const dist = (a: Vec3, b: Vec3) => new Vector3(...a).distanceTo(new Vector3(...b));
const bucket = (x: number, size: number) => Math.round(x / size);
export function compositionSignature(s: Sample, width: number, height: number, moving = false) { const actor = Object.values(s.actors)[0]??{position:s.focus,facing:0,motion:[]}, screen = projectPosition([actor.position[0], actor.position[1] + 1.2, actor.position[2]], s.camera, width, height), focus = projectPosition(s.focus, s.camera, width, height), distance = dist(actor.position, s.camera.position), angle = Math.atan2(s.camera.position[0] - actor.position[0], s.camera.position[2] - actor.position[2]); return { actorScreenRegion: !Object.keys(s.actors).length?'ABSENT':screen.x < .36 ? 'LEFT' : screen.x > .64 ? 'RIGHT' : 'CENTER', actorApparentSize: Object.keys(s.actors).length?bucket(2.7 / (distance * .81), .12):0, focusRegion: focus.x < .36 ? 'LEFT' : focus.x > .64 ? 'RIGHT' : 'CENTER', cameraAngleBucket: bucket(angle, Math.PI / 12), dominantProp: Object.keys(s.props).find(id => s.props[id].visible) ?? 'NONE', environment: s.environment, motionState: moving ? 'MOVING' : 'STILL' }; }
export function repetitionWarnings(signatures: unknown[], threshold = 3) { const warnings = []; let run = 1; for (let i = 1; i < signatures.length; i++) {
    run = JSON.stringify(signatures[i]) === JSON.stringify(signatures[i - 1]) ? run + 1 : 1;
    if (run === threshold)
        warnings.push({ index: i, consecutive: run });
} return warnings; }
export function directedSamples(s: DirectedSequence): Sample[] { return Array.from({ length: s.totalFrames }, (_, f) => { const e = evaluateDirected(s, f); return { camera: e.state.camera, actors: Object.fromEntries(Object.entries(e.state.actors).map(([id, a]) => [id, { ...a, motion: poseChannels(e.poses[id]) }])), props: Object.fromEntries(Object.entries(e.state.props).map(([id, p]) => [id, { position: p.position, visible: p.visible, value: p.parameters.openProgress ?? 0 }])), environment: s.baseShot.environment.resourceId, focus: e.focus, text: e.shot.onScreenText ?? '', narrativeVfx:s.baseShot.vfx.filter(v=>v.resourceId!=='VFX_SNOW_001'&&f/s.totalFrames>=v.start&&f/s.totalFrames<v.end).map(v=>v.resourceId), vfx: s.baseShot.vfx.some(v => f / s.totalFrames >= v.start && f / s.totalFrames < v.end), cut: s.shots.some(x => x.startFrame === f && x.transition === 'CUT'), continuous: true }; }); }
export function legacySamples(s: ProceduralSequence): Sample[] { return Array.from({ length: s.totalFrames }, (_, f) => { const shot = s.shots.find(x => f >= x.startFrame && f < x.endFrame)!, t = (f - shot.startFrame) / Math.max(1, shot.durationFrames - 1), camera = cameraAt(shot.camera.resourceId, t, shot.camera.parameters?.strength ?? 1); return { camera, actors: Object.fromEntries(shot.characters.map(i => { const p = poseAt(i, shot, t); return [i.instanceId, { position: p.position, facing: i.rotation?.[1] ?? 0, motion: poseChannels(p) }]; })), props: Object.fromEntries(shot.props.map(i => [i.instanceId, { position: i.position ?? [0, 0, 0], visible: true, value: i.resourceId === 'PROP_DOOR_001' ? Math.max(i.parameters?.openProgress ?? 0, ...shot.actions.filter(a => a.resourceId === 'ACTION_OPEN_DOOR_001' && a.target === i.instanceId).map(a => { const p = Math.max(0, Math.min(1, (t - a.start) / (a.end - a.start))); return p * p * (3 - 2 * p); })) : 0 }])), environment: shot.environment.resourceId, focus: camera.target, text: shot.onScreenText ?? '', narrativeVfx:shot.vfx.filter(v=>v.resourceId!=='VFX_SNOW_001'&&t>=v.start&&t<v.end).map(v=>v.resourceId), vfx: shot.vfx.some(v => t >= v.start && t < v.end), cut: f === shot.startFrame && f !== 0, continuous: false }; }); }
/** Semantic transform thresholds, not pixel difference or an aesthetic model. Captions and snow do not create events. */
export function motionMetrics(samples: Sample[], fps: number, width: number, height: number) {
    const events: {
        frame: number;
        categories: string[];
    }[] = [], density = { camera: 0, actor: 0, prop: 0, vfx: 0, narrative: 0 }, signatures = [], cameraPositions: Vec3[] = [], actorScreenX: number[] = [];
    let baseline = samples[0], lastEvent = 0;
    for (let f = 0; f < samples.length; f++) {
        const s = samples[f], prev = samples[Math.max(0, f - 1)], cameraMotion = !s.cut && (dist(s.camera.position, prev.camera.position) > .0008 || dist(s.camera.target, prev.camera.target) > .0008), actorMotion = !s.cut && Object.keys(s.actors).some(id => prev.actors[id] && (dist(s.actors[id].position, prev.actors[id].position) > .0008 || Math.abs(s.actors[id].facing - prev.actors[id].facing) > .001 || s.actors[id].motion.some((v,i)=>Math.abs(v-prev.actors[id].motion[i])>.003))), propMotion = !s.cut && Object.keys(s.props).some(id => prev.props[id] && (dist(s.props[id].position, prev.props[id].position) > .0008 || Math.abs(s.props[id].value - prev.props[id].value) > .001 || s.props[id].visible !== prev.props[id].visible));
        density.camera += Number(cameraMotion);
        density.actor += Number(actorMotion);
        density.prop += Number(propMotion);
        density.vfx += Number(s.vfx);
        density.narrative += Number(cameraMotion || actorMotion || propMotion);
        const categories = [];if(JSON.stringify(s.narrativeVfx)!==JSON.stringify(baseline.narrativeVfx))categories.push('VFX');
        if (dist(s.camera.position, baseline.camera.position) > .25 || dist(s.camera.target, baseline.camera.target) > .18)
            categories.push('CAMERA');
        if (Object.keys(s.actors).some(id => baseline.actors[id] && (dist(s.actors[id].position, baseline.actors[id].position) > .2 || Math.abs(s.actors[id].facing - baseline.actors[id].facing) > .25 || s.actors[id].motion.some((v,i)=>Math.abs(v-baseline.actors[id].motion[i])>.25))))
            categories.push('ACTOR');
        if (JSON.stringify(Object.keys(s.props)) !== JSON.stringify(Object.keys(baseline.props)) || Object.keys(s.props).some(id => baseline.props[id] && (s.props[id].visible !== baseline.props[id].visible || dist(s.props[id].position, baseline.props[id].position) > .2 || Math.abs(s.props[id].value - baseline.props[id].value) > .2)))
            categories.push('PROP');
        if (s.environment !== baseline.environment)
            categories.push('ENVIRONMENT');
        if (dist(s.focus, baseline.focus) > .3)
            categories.push('FOCUS');
        if (s.text !== baseline.text)
            categories.push('TEXT');
        if (categories.length && f - lastEvent >= Math.round(fps * .5)) {
            events.push({ frame: f, categories });
            lastEvent = f;
            baseline = s;
        }
        if (f % Math.round(fps * .5) === 0)
            signatures.push({ frame: f, signature: compositionSignature(s, width, height, actorMotion) });
        const actor = Object.values(s.actors)[0]??{position:s.focus,facing:0,motion:[]};
        if(Object.keys(s.actors).length)actorScreenX.push(projectPosition([actor.position[0], actor.position[1] + 1.2, actor.position[2]], s.camera, width, height).x);
        cameraPositions.push(s.camera.position);
    }
    const gaps = [0, ...events.map(e => e.frame), samples.length].slice(1).map((x, i) => (x - [0, ...events.map(e => e.frame)][i]) / fps), duration = samples.length / fps;
    return { method: { visualChange: 'semantic transform threshold accumulation, 0.5s refractory; captions excluded; snow/decorative VFX excluded; narrative VFX activation edges included', density: 'per-frame transform/pose deltas; cuts excluded from motion; snow never narrative', thresholds: { camera: .25, target: .18, actor: .2, facingRadians: .25, prop: .2, minimumEventSeconds: .5 }, crossSourceLimit: 'Reference is manual 1fps annotation; do not treat rates as equally precise.' }, durationSeconds: duration, cutsPerMinute: samples.filter(x => x.cut).length / duration * 60, visualChangesPerMinute: events.length / duration * 60, averageSecondsBetweenVisualChanges: duration / (events.length + 1), longestSecondsWithoutVisualChange: Math.max(...gaps), visualChanges: events, motionDensity: Object.fromEntries(Object.entries(density).map(([k, v]) => [k, v / samples.length])), actorPositionVariety: { centralFramePercent: actorScreenX.filter(x => x >= .36 && x <= .64).length / samples.length * 100, leftFramePercent: actorScreenX.filter(x => x < .36).length / samples.length * 100, rightFramePercent: actorScreenX.filter(x => x > .64).length / samples.length * 100, minScreenX: actorScreenX.length?Math.min(...actorScreenX):0, maxScreenX: actorScreenX.length?Math.max(...actorScreenX):0 }, camera: { distanceReference: samples.some(s=>Object.keys(s.actors).length)?'ACTOR':'FOCUS_WHEN_ACTOR_ABSENT', minX: Math.min(...cameraPositions.map(x => x[0])), maxX: Math.max(...cameraPositions.map(x => x[0])), pathLength: cameraPositions.reduce((n, p, i) => n + (i && !samples[i].cut ? dist(p, cameraPositions[i - 1]) : 0), 0), minActorDistance: Math.min(...samples.map(s => dist((Object.values(s.actors)[0]??{position:s.focus}).position, s.camera.position))), maxActorDistance: Math.max(...samples.map(s => dist((Object.values(s.actors)[0]??{position:s.focus}).position, s.camera.position))) }, compositionSignatures: signatures, repetitionWarnings: repetitionWarnings(signatures.map(x => x.signature)), continuousSequenceLength: samples[0].continuous ? duration : longestShot(samples, fps), continuousSequenceLengthMethod: samples[0].continuous ? 'full directed sequence' : 'longest legacy shot between explicit cut boundaries; shot-local state' };
}
function longestShot(samples: Sample[], fps: number) { const boundaries = [0, ...samples.flatMap((s, i) => s.cut ? [i] : []), samples.length]; return Math.max(...boundaries.slice(1).map((x, i) => (x - boundaries[i]) / fps)); }

function poseChannels(p:Pose){return [p.leftArm,p.rightArm,p.leftLeg,p.rightLeg,p.headYaw,...(p.handReach??[0,0,0]),...(p.leftHandReach??[0,0,0])];}
