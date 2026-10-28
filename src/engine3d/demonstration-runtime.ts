import { Vector3 } from 'three';
import { fail, type ShotSpec, type Vec3 } from './contracts';
import { fields, finite, vec, text, list } from './schema';
import { resource } from './validation';
import { carStates, DEMONSTRATION_COMPILER_VERSION, DEMONSTRATION_LIMITS, type DemonstrationProgram, type DemonstrationState, type SubjectState, type NarrativeClaim, type VisualProof, type EnvironmentState } from './demonstration-contracts';
const enums = (x: unknown, values: string[]) => { if (typeof x !== 'string' || !values.includes(x))
    fail('DEMONSTRATION_SCHEMA', 'unknown enum ' + String(x)); };
function shape(v: unknown, keys: string[], optional: string[] = []) { fields(v, keys, 'demonstration'); for (const k of keys)
    if (!optional.includes(k) && !Object.hasOwn(v as object, k))
        fail('DEMONSTRATION_SCHEMA', 'missing ' + k); }
const bool = (v: unknown) => { if (typeof v !== 'boolean')
    fail('DEMONSTRATION_SCHEMA', 'boolean required'); };
const color = (v: unknown) => { if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v))
    fail('DEMONSTRATION_SCHEMA', 'hex color required'); };
const frame = (v: unknown, max: number) => { finite(v, 'frame', 0, max); if (!Number.isInteger(v))
    fail('DEMONSTRATION_SCHEMA', 'integer frame'); };
const easing = (t: number, key: string) => { const x = Math.max(0, Math.min(1, t)); return key === 'LINEAR' ? x : key === 'EASE_IN' ? x * x : key === 'EASE_OUT' ? 1 - (1 - x) ** 2 : x * x * (3 - 2 * x); };
const interpolate = (a: number, b: number, t: number) => t === 0 ? a : t === 1 ? b : a + (b - a) * t;
const mixVec = (a: Vec3, b: Vec3, t: number) => a.map((v, i) => interpolate(v, b[i], t)) as Vec3;
export function claimShape(c: NarrativeClaim) { shape(c, ['id', 'text', 'type', 'requiresVisualProof', 'cause', 'transition', 'effect'], ['cause', 'transition', 'effect']); text(c.id, 'claim id'); text(c.text, 'claim'); bool(c.requiresVisualProof); enums(c.type, ['OBJECT_STATE', 'PROCESS', 'QUANTITY_CHANGE', 'SPATIAL_RELATION', 'CAUSE_EFFECT', 'COMPARISON']); if (c.type === 'CAUSE_EFFECT')
    for (const k of ['cause', 'transition', 'effect'] as const)
        text(c[k], k);
else
    for (const k of ['cause', 'transition', 'effect'] as const)
        if (c[k] !== undefined)
            text(c[k], k); }
export function proofQa(claims: NarrativeClaim[], proofs: VisualProof[]) { const ids = new Set<string>(); for (const c of claims) {
    claimShape(c);
    if (ids.has(c.id))
        fail('PROOF_QA', 'duplicate claim');
    ids.add(c.id);
} const used = new Set(); for (const p of proofs) {
    shape(p, ['claimId', 'proofLevel', 'evidenceResources', 'demonstrationId', 'rationale'], ['demonstrationId']);
    if (!ids.has(p.claimId) || used.has(p.claimId))
        fail('PROOF_QA', 'orphan/duplicate proof');
    used.add(p.claimId);
    enums(p.proofLevel, ['NONE', 'SYMBOLIC', 'PARTIAL', 'DIRECT']);
    list(p.evidenceResources, 'evidence');
    p.evidenceResources.forEach(x => text(x, 'evidence resource'));
    text(p.rationale, 'rationale');
    if (p.demonstrationId !== undefined)
        text(p.demonstrationId, 'demonstration id');
    if (p.proofLevel !== 'NONE' && !p.evidenceResources.length)
        fail('PROOF_QA', 'missing visual evidence');
} if (used.size !== ids.size)
    fail('PROOF_QA', 'missing claim assessment'); const requires = claims.filter(c => c.requiresVisualProof); return { claimsRequiringVisualProof: requires.length, directClaims: requires.filter(c => proofs.some(p => p.claimId === c.id && p.proofLevel === 'DIRECT')).length, directVisualProofRate: requires.length ? requires.filter(c => proofs.some(p => p.claimId === c.id && p.proofLevel === 'DIRECT')).length / requires.length : null, scope: 'Structural representation only; not factual truth or aesthetic quality' }; }
export const environmentCapabilities = (id: string) => ['visibility', 'tint', 'fogIntensity', 'backgroundEmphasis', ...(id === 'ENV_LAB_001' ? ['groundCutaway'] : [])];
export function environmentShape(e: EnvironmentState, id: string) { shape(e, ['visibility', 'tint', 'fogIntensity', 'groundCutaway', 'backgroundEmphasis']); bool(e.visibility); color(e.tint); for (const k of ['fogIntensity', 'groundCutaway', 'backgroundEmphasis'] as const)
    finite(e[k], k, 0, 1); if (e.groundCutaway && !environmentCapabilities(id).includes('groundCutaway'))
    fail('UNSUPPORTED_MODIFIER', 'groundCutaway ' + id); }
const supportedParameters = (s: DemonstrationProgram['subjects'][number]) => ['highlight', ...(s.kind === 'PROP' ? (s.resourceId === 'PROP_CAR_001' ? ['frost'] : s.resourceId === 'PROP_THERMOMETER_001' ? ['value'] : []) : s.kind === 'CYLINDER' ? ['fillLevel'] : s.kind === 'PATH' ? ['connection', 'flowProgress', 'speed', 'amount', 'direction'] : [])];
export function demonstrationStateShape(state: DemonstrationState, p: DemonstrationProgram, shot: ShotSpec) { shape(state, ['subjects', 'environment', 'presenterMode']); shape(state.subjects, p.subjects.map(s => s.id)); environmentShape(state.environment, shot.environment.resourceId); enums(state.presenterMode, ['PRESENTER', 'DEMONSTRATION', 'HYBRID']); for (const sub of p.subjects) {
    const s = state.subjects[sub.id];
    shape(s, ['position', 'rotation', 'scale', 'visible', 'stateId', 'parameters']);
    vec(s.position, 'position');
    vec(s.rotation, 'rotation');
    vec(s.scale, 'scale', true);
    if (s.position.some(v => Math.abs(v) > 20) || s.scale.some(v => v > 4))
        fail('DEMONSTRATION_BOUNDS', 'transform');
    bool(s.visible);
    text(s.stateId, 'state id');
    shape(s.parameters, supportedParameters(sub), supportedParameters(sub));
    for (const [k, v] of Object.entries(s.parameters))
        finite(v, k, k === 'value' ? -150 : k === 'direction' ? -1 : 0, k === 'value' ? 150 : k === 'speed' ? 2 : 1);
    if (sub.resourceId === 'PROP_CAR_001' && !carStates.some(c => c.stateId === s.stateId))
        fail('DEMONSTRATION_STATE', 'unknown car state');
    if (sub.resourceId !== 'PROP_CAR_001' && s.stateId !== 'DEFAULT')
        fail('DEMONSTRATION_STATE', 'unsupported state');
} }
export function operationChannel(op: string, params: Record<string, unknown>) { return ['MOVE', 'ROTATE', 'SCALE'].includes(op) ? op : op === 'CHANGE_STATE' ? 'state' : op === 'FLOW' ? 'flowProgress' : op === 'CONNECT' || op === 'SEPARATE' ? 'connection' : ['INCREASE', 'DECREASE', 'ACCUMULATE'].includes(op) ? String(params.parameter) : op === 'HIGHLIGHT' ? 'highlight' : 'visibility'; }
export function validateDemonstrationProgram(p: DemonstrationProgram, shot: ShotSpec, total: number) {
    shape(p, ['version', 'compilerVersion', 'id', 'purpose', 'claim', 'subjects', 'initialState', 'steps', 'finalState', 'presenterModes']);
    if (p.version !== 1 || p.compilerVersion !== DEMONSTRATION_COMPILER_VERSION)
        fail('DEMONSTRATION_VERSION', 'version');
    text(p.id, 'id');
    text(p.purpose, 'purpose');
    claimShape(p.claim);
    list(p.subjects, 'subjects');
    list(p.steps, 'steps');
    list(p.presenterModes, 'presenterModes');
    if (p.subjects.length < 1 || p.subjects.length > DEMONSTRATION_LIMITS.subjects || p.steps.length > DEMONSTRATION_LIMITS.steps)
        fail('DEMONSTRATION_BUDGET', 'subjects/steps');
    const ids = new Set<string>();
    let meshes = 0;
    for (const s of p.subjects) {
        shape(s, ['id', 'kind', 'resourceId', 'size', 'color', 'path', 'layer'], ['resourceId', 'path', 'layer']);
        text(s.id, 'subject');
        if (ids.has(s.id) || s.id === 'ENVIRONMENT')
            fail('DEMONSTRATION_SCHEMA', 'duplicate/reserved subject');
        ids.add(s.id);
        enums(s.kind, ['PROP', 'BOX', 'CYLINDER', 'PATH', 'LAYER']);
        vec(s.size, 'size', true);
        if (s.size.some(v => v > 8))
            fail('DEMONSTRATION_BUDGET', 'primitive size');
        color(s.color);
        if (s.kind === 'PROP') {
            resource(s.resourceId!, 'prop');
            if (!shot.props.some(i => i.instanceId === s.id && i.resourceId === s.resourceId))
                fail('DEMONSTRATION_TARGET', 'missing prop subject');
            meshes += s.resourceId === 'PROP_CAR_001' ? 25 : 8;
        }
        else if (s.resourceId)
            fail('DEMONSTRATION_SCHEMA', 'primitive cannot have resourceId');
        else
            meshes += s.kind === 'CYLINDER' ? 3 : s.kind === 'PATH' ? 14 : 1;
        if (s.kind === 'PATH') {
            list(s.path, 'path');
            if (s.path!.length < 2 || s.path!.length > DEMONSTRATION_LIMITS.pathPoints)
                fail('DEMONSTRATION_BUDGET', 'path');
            s.path!.forEach(v => { vec(v, 'path point'); if (v.some(x => Math.abs(x) > 20))
                fail('DEMONSTRATION_BOUNDS', 'path point'); });
            if (s.path!.some((v, i) => i > 0 && new Vector3(...v).distanceTo(new Vector3(...s.path![i - 1])) < .01))
                fail('DEMONSTRATION_SCHEMA', 'degenerate path');
        }
        else if (s.path)
            fail('DEMONSTRATION_SCHEMA', 'path on nonpath');
        if (s.kind === 'LAYER')
            enums(s.layer, ['surface', 'subsurface', 'deep']);
        else if (s.layer)
            fail('DEMONSTRATION_SCHEMA', 'layer kind');
    }
    if (meshes > DEMONSTRATION_LIMITS.primitiveMeshes)
        fail('DEMONSTRATION_BUDGET', 'geometry mesh budget');
    demonstrationStateShape(p.initialState, p, shot);
    demonstrationStateShape(p.finalState, p, shot);
    let cursor = 0;
    for (const m of p.presenterModes) {
        shape(m, ['startFrame', 'endFrame', 'mode']);
        frame(m.startFrame, total - 1);
        frame(m.endFrame, total);
        if (m.startFrame !== cursor || m.endFrame <= cursor)
            fail('DEMONSTRATION_TIMING', 'mode coverage');
        enums(m.mode, ['PRESENTER', 'DEMONSTRATION', 'HYBRID']);
        cursor = m.endFrame;
    }
    if (cursor !== total)
        fail('DEMONSTRATION_TIMING', 'modes must cover sequence');
    for (const s of p.steps) {
        shape(s, ['startFrame', 'endFrame', 'operation', 'target', 'parameters', 'easing', 'purpose']);
        frame(s.startFrame, total - 1);
        frame(s.endFrame, total);
        if (s.endFrame <= s.startFrame)
            fail('DEMONSTRATION_TIMING', 'empty step');
        enums(s.operation, ['APPEAR', 'DISAPPEAR', 'MOVE', 'ROTATE', 'SCALE', 'CHANGE_STATE', 'REVEAL', 'HIDE', 'ACCUMULATE', 'DECREASE', 'INCREASE', 'FLOW', 'CONNECT', 'SEPARATE', 'HIGHLIGHT']);
        enums(s.easing, ['LINEAR', 'EASE_IN', 'EASE_OUT', 'EASE_IN_OUT']);
        text(s.purpose, 'purpose');
        const sub = p.subjects.find(x => x.id === s.target), env = s.target === 'ENVIRONMENT';
        if (!sub && !env)
            fail('DEMONSTRATION_TARGET', 'unknown target');
        const v = s.parameters;
        if (['MOVE', 'ROTATE', 'SCALE'].includes(s.operation)) {
            if (env)
                fail('UNSUPPORTED_MODIFIER', 'environment transform');
            shape(v, ['from', 'to']);
            vec(v.from, 'from', s.operation === 'SCALE');
            vec(v.to, 'to', s.operation === 'SCALE');
        }
        else if (s.operation === 'CHANGE_STATE') {
            shape(v, ['from', 'to', 'overrideReason'], ['overrideReason']);
            if (!sub || sub.resourceId !== 'PROP_CAR_001')
                fail('DEMONSTRATION_STATE', 'state definition unavailable');
            text(v.from, 'from');
            text(v.to, 'to');
            const a = carStates.find(c => c.stateId === v.from), b = carStates.find(c => c.stateId === v.to);
            if (!a || !b)
                fail('DEMONSTRATION_STATE', 'invalid state');
            if (!a!.allowedTransitions.includes(b!.stateId)) {
                text(v.overrideReason, 'explicit transition override reason');
            }
        }
        else if (['ACCUMULATE', 'INCREASE', 'DECREASE'].includes(s.operation)) {
            shape(v, ['parameter', 'from', 'to']);
            text(v.parameter, 'parameter');
            const key = String(v.parameter);
            if (env ? !environmentCapabilities(shot.environment.resourceId).includes(key) : !supportedParameters(sub!).includes(key))
                fail('UNSUPPORTED_MODIFIER', key);
            if (['visibility', 'tint'].includes(key))
                fail('UNSUPPORTED_MODIFIER', 'numeric modifier required');
            finite(v.from, 'from', key === 'value' ? -150 : 0, key === 'value' ? 150 : 1);
            finite(v.to, 'to', key === 'value' ? -150 : 0, key === 'value' ? 150 : 1);
            if (s.operation === 'DECREASE' ? Number(v.to) > Number(v.from) : Number(v.to) < Number(v.from))
                fail('DEMONSTRATION_PROGRESS', 'nonmonotonic operation');
            if (s.operation === 'ACCUMULATE' && key !== 'frost')
                fail('UNSUPPORTED_MODIFIER', 'ACCUMULATE frost only in v1');
        }
        else if (s.operation === 'FLOW') {
            shape(v, ['path', 'from', 'to', 'direction', 'speed', 'amount']);
            if (sub?.kind !== 'PATH')
                fail('UNSUPPORTED_MODIFIER', 'FLOW requires path');
            if (JSON.stringify(v.path) !== JSON.stringify(sub!.path))
                fail('DEMONSTRATION_SCHEMA', 'FLOW path mismatch');
            finite(v.from, 'progress', 0, 1);
            finite(v.to, 'progress', 0, 1);
            if (Number(v.to) < Number(v.from))
                fail('DEMONSTRATION_PROGRESS', 'reverse progress use direction');
            enums(v.direction, ['FORWARD', 'REVERSE']);
            finite(v.speed, 'speed', .1, 2);
            finite(v.amount, 'amount', .05, 1);
        }
        else if (s.operation === 'CONNECT' || s.operation === 'SEPARATE') {
            shape(v, ['from', 'to']);
            if (sub?.kind !== 'PATH')
                fail('UNSUPPORTED_MODIFIER', 'connection requires path');
            finite(v.from, 'from', 0, 1);
            finite(v.to, 'to', 0, 1);
            if (s.operation === 'CONNECT' ? Number(v.to) < Number(v.from) : Number(v.to) > Number(v.from))
                fail('DEMONSTRATION_PROGRESS', 'connection progress');
        }
        else if (s.operation === 'HIGHLIGHT') {
            shape(v, ['amount']);
            finite(v.amount, 'highlight', 0, .25);
            if (env)
                fail('UNSUPPORTED_MODIFIER', 'highlight subject only');
        }
        else {
            shape(v, []);
        }
    }
    for (let i = 0; i < p.steps.length; i++)
        for (let j = 0; j < i; j++) {
            const a = p.steps[i], b = p.steps[j];
            if (a.target === b.target && a.startFrame < b.endFrame && b.startFrame < a.endFrame) {
                const ca = operationChannel(a.operation, a.parameters), cb = operationChannel(b.operation, b.parameters);
                if (ca === cb || ca === 'state' || cb === 'state')
                    fail('DEMONSTRATION_CONFLICT', 'incompatible overlapping changes');
            }
        }
    const states = structuredClone(p.initialState);
    for (const s of [...p.steps].sort((a, b) => a.startFrame - b.startFrame)) {
        const subject = states.subjects[s.target];
        if (s.operation === 'CHANGE_STATE') {
            if (subject.stateId !== s.parameters.from)
                fail('DEMONSTRATION_STATE', 'transition source mismatch');
            subject.stateId = String(s.parameters.to);
            Object.assign(subject.parameters, carStates.find(c => c.stateId === s.parameters.to)!.parameters);
        }
        else if (['MOVE', 'ROTATE', 'SCALE'].includes(s.operation)) {
            const key = s.operation === 'MOVE' ? 'position' : s.operation === 'ROTATE' ? 'rotation' : 'scale';
            if (!stateEqual(subject[key], s.parameters.from))
                fail('DEMONSTRATION_STATE', 'transform start discontinuity');
            subject[key] = structuredClone(s.parameters.to as Vec3);
        }
        else if (s.operation === 'CONNECT' || s.operation === 'SEPARATE') {
            if (Math.abs((subject.parameters.connection ?? 0) - Number(s.parameters.from)) > 1e-6)
                fail('DEMONSTRATION_STATE', 'connection start discontinuity');
            subject.parameters.connection = Number(s.parameters.to);
        }
        else if (['ACCUMULATE', 'INCREASE', 'DECREASE'].includes(s.operation)) {
            const key = String(s.parameters.parameter), from = s.target === 'ENVIRONMENT' ? (states.environment as unknown as Record<string, unknown>)[key] : subject.parameters[key] ?? 0;
            if (Math.abs(Number(from) - Number(s.parameters.from)) > 1e-6)
                fail('DEMONSTRATION_STATE', 'parameter start discontinuity');
            if (s.target === 'ENVIRONMENT')
                (states.environment as unknown as Record<string, unknown>)[key] = s.parameters.to;
            else
                subject.parameters[key] = Number(s.parameters.to);
        }
    }
    for (const s of p.steps.filter(s => s.operation === 'FLOW'))
        if ((evaluateDemonstration(p, s.startFrame).subjects[s.target].parameters.connection ?? 0) < 1)
            fail('DEMONSTRATION_STATE', 'FLOW requires connected path');
    for (let f = 0; f <= total; f++) {
        if (p.steps.filter(s => f >= s.startFrame && f < s.endFrame).length > DEMONSTRATION_LIMITS.simultaneousOperations)
            fail('DEMONSTRATION_BUDGET', 'simultaneous operations');
        const e = evaluateDemonstration(p, f);
        demonstrationStateShape(e, p, shot);
    }
    if (!stateEqual(evaluateDemonstration(p, total), p.finalState))
        fail('DEMONSTRATION_STATE', 'finalState mismatch');
    return { estimatedMeshes: meshes };
}
export function evaluateDemonstration(p: DemonstrationProgram, frame: number): DemonstrationState { const state = structuredClone(p.initialState); state.presenterMode = (p.presenterModes.find(m => frame >= m.startFrame && frame < m.endFrame) ?? p.presenterModes.at(-1))!.mode; for (const s of [...p.steps].sort((a, b) => a.startFrame - b.startFrame)) {
    if (frame < s.startFrame)
        continue;
    const t = easing((frame - s.startFrame) / (s.endFrame - s.startFrame), s.easing), v = s.parameters, subject = state.subjects[s.target];
    switch (s.operation) {
        case 'APPEAR':
        case 'REVEAL':
            if (s.target === 'ENVIRONMENT')
                state.environment.visibility = true;
            else
                subject.visible = true;
            break;
        case 'DISAPPEAR':
        case 'HIDE':
            if (frame >= s.endFrame) {
                if (s.target === 'ENVIRONMENT')
                    state.environment.visibility = false;
                else
                    subject.visible = false;
            }
            break;
        case 'MOVE':
            subject.position = mixVec(v.from as Vec3, v.to as Vec3, t);
            break;
        case 'ROTATE':
            subject.rotation = mixVec(v.from as Vec3, v.to as Vec3, t);
            break;
        case 'SCALE':
            subject.scale = mixVec(v.from as Vec3, v.to as Vec3, t);
            break;
        case 'CHANGE_STATE':
            if (frame >= s.endFrame) {
                subject.stateId = String(v.to);
                Object.assign(subject.parameters, carStates.find(c => c.stateId === v.to)!.parameters);
            }
            break;
        case 'ACCUMULATE':
        case 'INCREASE':
        case 'DECREASE':
            if (s.target === 'ENVIRONMENT')
                (state.environment as unknown as Record<string, unknown>)[String(v.parameter)] = interpolate(Number(v.from), Number(v.to), t);
            else
                subject.parameters[String(v.parameter)] = interpolate(Number(v.from), Number(v.to), t);
            break;
        case 'CONNECT':
        case 'SEPARATE':
            subject.parameters.connection = interpolate(Number(v.from), Number(v.to), t);
            break;
        case 'FLOW':
            subject.parameters.flowProgress = interpolate(Number(v.from), Number(v.to), Math.min(1, t * Number(v.speed)));
            subject.parameters.direction = v.direction === 'REVERSE' ? -1 : 1;
            subject.parameters.speed = Number(v.speed);
            subject.parameters.amount = Number(v.amount);
            break;
        case 'HIGHLIGHT':
            subject.parameters.highlight = (t === 1 ? 0 : Math.sin(t * Math.PI)) * Number(v.amount);
            break;
    }
} return state; }
export function stateEqual(a: unknown, b: unknown): boolean { if (typeof a === 'number' && typeof b === 'number')
    return Math.abs(a - b) < 1e-6; if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object')
    return a === b; const x = a as Record<string, unknown>, y = b as Record<string, unknown>; return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => Object.hasOwn(y, k) && stateEqual(x[k], y[k])); }
export function pathAt(path: Vec3[], progress: number): Vec3 { finite(progress, 'path progress', 0, 1); if (progress === 0)
    return [...path[0]]; if (progress === 1)
    return [...path[path.length - 1]]; const lengths = path.slice(1).map((p, i) => new Vector3(...p).distanceTo(new Vector3(...path[i]))), total = lengths.reduce((a, b) => a + b, 0); let at = progress * total; for (let i = 0; i < lengths.length; i++) {
    if (at <= lengths[i] || i === lengths.length - 1)
        return mixVec(path[i], path[i + 1], lengths[i] ? at / lengths[i] : 0);
    at -= lengths[i];
} return [...path[0]]; }
