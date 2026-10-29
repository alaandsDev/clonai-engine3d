import type { AutoDirectorInput, NarrativeUnit, PlannedClaim, Selection } from './contracts';
import type { DirectedSequence } from '../engine3d/directed';
import { evaluateDirected, validateDirected } from '../engine3d/directed';
import { compileDemonstration } from '../engine3d/demonstration';
import { evaluateDemonstration } from '../engine3d/demonstration-runtime';
import { defaultEnvironmentState, DEMONSTRATION_COMPILER_VERSION, type VisualDemonstration, type DemonstrationStep, type DemonstrationSubject } from '../engine3d/demonstration-contracts';
import type { Vec3 } from '../engine3d/contracts';
import { captions } from '../engine3d/director';
const cam = (position: Vec3, target: Vec3) => ({ position, target });
const state = (position: Vec3, parameters: Record<string, number> = {}, stateId = 'DEFAULT') => ({ position, rotation: [0, 0, 0] as Vec3, scale: [1, 1, 1] as Vec3, visible: true, stateId, parameters });
function base(x: AutoDirectorInput, frames: number, id: string): DirectedSequence { const initialState = { actors: {}, props: {}, camera: cam([2, 3.5, 12], [0, 1.2, 0]) }; return { version: 1, id, fps: x.fps, width: x.canvas.width, height: x.canvas.height, totalFrames: frames, baseShot: { id: id + '-world', durationSeconds: frames / x.fps, environment: { resourceId: 'ENV_LAB_001' }, characters: [], props: [], actions: [], vfx: [], camera: { resourceId: 'CAM_STATIC_001' } }, initialState, finalState: structuredClone(initialState), blocking: [], actionSegments: [], cameraSegments: [], focusSegments: [], propMotions: [], shots: [{ id: id + '-continuous', startFrame: 0, endFrame: frames, transition: 'CONTINUE' }], captions: [] }; }
const step = (operation: DemonstrationStep['operation'], target: string, a: number, b: number, parameters: Record<string, unknown>, purpose: string): DemonstrationStep => ({ operation, target, startFrame: a, endFrame: Math.max(a + 1, b), parameters, purpose, easing: 'LINEAR' });
export function generate(x: AutoDirectorInput, units: NarrativeUnit[], claims: PlannedClaim[], selections: Selection[]) {
    const total = units.reduce((n, u) => n + u.durationFrames, 0), id = x.id + '-continuous', d = base(x, total, id);
    let at = 0;
    const starts = new Map<string, number>();
    for (const u of units) {
        starts.set(u.id, at);
        d.captions.push(...captions(u.sourceText, at, u.durationFrames));
        at += u.durationFrames;
    }
    const primary = claims.filter(c => c.requiresVisualProof), liquid = primary.length > 0 && primary.every(c => c.semanticTags.includes('liquid')), frozen = primary.length > 0 && primary.every(c => c.semanticTags.includes('freezable'));
    let demo: VisualDemonstration | undefined;
    if (liquid || frozen) {
        const upward = claims.some(c => c.semanticTags.includes('upward')), sourceY = upward ? .5 : 1.8, destY = upward ? 1.8 : .5;
        const subjects: DemonstrationSubject[] = liquid ? [{ id: 'source', kind: 'CYLINDER', size: [1.1, 1.2, 1.1], color: '#17364d' }, { id: 'destination', kind: 'CYLINDER', size: [1.1, 1.2, 1.1], color: '#17364d' }, { id: 'connection', kind: 'PATH', size: [.12, .12, .12], color: '#17364d', path: [[-.75, sourceY, 0], [-.25, sourceY, 0], [-.25, destY, 0], [.75, destY, 0]] }] : [{ id: 'subject', kind: 'PROP', resourceId: 'PROP_CAR_001', size: [3.2, 1.6, 1.4], color: '#e44837' }];
        const initial = { subjects: liquid ? { source: state([-1.3, sourceY, 0], { fillLevel: .85, highlight: 0 }), destination: state([1.3, destY, 0], { fillLevel: 0, highlight: 0 }), connection: state([0, 0, 0], { connection: 0, flowProgress: 0, direction: 1, speed: 1, amount: .8, highlight: 0 }) } : { subject: state([0, 0, 0], { frost: 0, highlight: 0 }, 'NORMAL') }, environment: { ...defaultEnvironmentState, visibility: false }, presenterMode: 'DEMONSTRATION' as const };
        const steps: DemonstrationStep[] = [];
        if (liquid) {
            const flowClaim = claims.find(c => selections.find(s => s.claimId === c.id)?.template === 'FLOW') ?? primary[0], flowUnit = units.find(u => u.id === flowClaim.unitId)!, a = starts.get(flowUnit.id)!, flowLastUnit=units.find(u=>u.id===(flowClaim.extraction?.executionWindow.lastUnitId??flowUnit.id))!, flowEnd = starts.get(flowLastUnit.id)!+flowLastUnit.durationFrames, connectEnd = a + Math.max(3, Math.floor(flowUnit.durationFrames * .18));
            steps.push(step('CONNECT', 'connection', a, connectEnd, { from: 0, to: 1 }, 'Estabelecer tubulação antes do fluxo'), step('FLOW', 'connection', connectEnd, flowEnd, { path: subjects[2].path, from: 0, to: 1, direction: 'FORWARD', speed: 1, amount: .8 }, upward ? 'Mostrar trajetória ascendente até reservatório' : 'Mostrar transferência pelo caminho'));
            const fillClaim = claims.find(c => c.semanticTags.includes('fill') && c.unitId !== flowClaim.unitId), fillUnit = fillClaim ? units.find(u => u.id === fillClaim.unitId)! : flowUnit, fillStart = fillClaim ? Math.max(flowEnd, starts.get(fillUnit.id)!) : a + Math.floor(flowUnit.durationFrames * .6), fillEnd = fillClaim ? fillStart + fillUnit.durationFrames : flowEnd;
            if (fillEnd > fillStart) {
                steps.push(step('INCREASE', 'destination', fillStart, fillEnd, { parameter: 'fillLevel', from: 0, to: .85 }, 'Nível aumenta quando o líquido chega'), step('DECREASE', 'source', fillStart, fillEnd, { parameter: 'fillLevel', from: .85, to: 0 }, 'Origem transfere o conteúdo'));
                const target: Vec3 = [1.3, destY, 0];
                // Phase 25: the consequence reframe still targets the destination but from a pulled-back position that keeps source and path in frame.
                d.cameraSegments = [{ startFrame: 0, endFrame: Math.max(1, connectEnd), easing: 'EASE_IN_OUT', purpose: 'Contexto e ligação', cameraId: 'CAM_PUSH_IN_001', behavior: 'MOVE', startState: d.initialState.camera, endState: cam([1.5, 3.2, 11], [0, 1.2, 0]) }, { startFrame: fillStart, endFrame: Math.max(fillStart + 1, Math.min(total, fillEnd)), easing: 'EASE_IN_OUT', purpose: 'Foco na consequência: enchimento e armazenamento', cameraId: 'CAM_ORBIT_001', behavior: 'REFRAME', startState: cam([1.5, 3.2, 11], [0, 1.2, 0]), endState: cam([target[0], 3.6, 15], target), focusTarget: { type: 'PROP', id: 'destination', offset: [0, 0, 0] } }];
            }
            d.focusSegments = [{ startFrame: 0, endFrame: fillStart, easing: 'LINEAR', purpose: 'Conexão e trajeto como prova', target: { type: 'POSITION', position: [0, (sourceY + destY) / 2, 0] } }, { startFrame: fillStart, endFrame: total, easing: 'LINEAR', purpose: 'Nível e água armazenada visíveis', target: { type: 'PROP', id: 'destination', offset: [0, 0, 0] } }];
        }
        else {
            d.baseShot.environment.resourceId = 'ENV_WINTER_001';
            d.baseShot.props = [{ instanceId: 'subject', resourceId: 'PROP_CAR_001' }];
            d.initialState.props = { subject: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], visible: true, parameters: { frost: 0 } } };
            const semanticWindow=primary.find(c=>c.extraction)?.extraction?.executionWindow;
            const windowStart=semanticWindow?starts.get(semanticWindow.firstUnitId)!:0,windowEnd=semanticWindow?starts.get(semanticWindow.lastUnitId)!+units.find(u=>u.id===semanticWindow.lastUnitId)!.durationFrames:total;
            const a = semanticWindow?windowStart:Math.floor(total * .12), b = semanticWindow?windowStart+Math.floor((windowEnd-windowStart)*.45):Math.floor(total * .48), c = semanticWindow?windowStart+Math.floor((windowEnd-windowStart)*.8):Math.floor(total * .8);
            steps.push(step('ACCUMULATE', 'subject', a, b, { parameter: 'frost', from: 0, to: .45 }, 'Acúmulo superficial em exemplar compatível'), step('CHANGE_STATE', 'subject', b, b + 1, { from: 'NORMAL', to: 'FROSTED' }, 'Registrar estágio parcial'), step('ACCUMULATE', 'subject', b + 1, c, { parameter: 'frost', from: .45, to: 1 }, 'Cobertura de gelo'), step('CHANGE_STATE', 'subject', c, c + 1, { from: 'FROSTED', to: 'FROZEN' }, 'Manter resultado'));
            d.initialState.camera = cam([2, 2.6, 8], [0, .8, 0]);
            d.cameraSegments = [{ startFrame: 0, endFrame: c, easing: 'EASE_IN_OUT', purpose: 'Revelar mudança de superfície', cameraId: 'CAM_ORBIT_001', behavior: 'MOVE', startState: d.initialState.camera, endState: cam([-2, 2.6, 8], [0, .8, 0]) }];
            d.focusSegments = [{ startFrame: 0, endFrame: total, easing: 'LINEAR', purpose: 'Foco no objeto, sem apresentador', target: { type: 'PROP', id: 'subject', offset: [0, .8, 0] } }];
        }
        const first = primary[0];
        demo = { version: 1, id: x.id + '-demonstration', purpose: 'Demonstração gerada a partir de claims e capacidades; nenhuma cena fornecida pelo fixture', claim: { id: first.id, text: first.text, type: liquid ? 'PROCESS' : 'OBJECT_STATE', requiresVisualProof: true }, subjects, initialState: initial as any, steps, finalState: initial as any, presenterModes: [{ startFrame: 0, endFrame: total, mode: 'DEMONSTRATION' }], direction: d };
        demo.finalState = evaluateDemonstration({ ...demo, compilerVersion: DEMONSTRATION_COMPILER_VERSION }, total);
        return { sequences: [compileDemonstration(demo).sequence], demonstrations: [demo] };
    }
    const temperature = selections.some(s => s.template === 'TEMPERATURE'), door = selections.some(s => s.template === 'REVEAL_DOOR');
    if (temperature) {
        const value = Number(claims.map(c => c.text).join(' ').match(/-?\d+(?:[.,]\d+)?/)?.[0].replace(',', '.') ?? 0);
        const actualValue = claims.some(c => /negativ/i.test(c.text)) ? -Math.abs(value) : value;
        d.baseShot.props = [{ instanceId: 'instrument', resourceId: 'PROP_THERMOMETER_001' }];
        d.initialState.props = { instrument: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], visible: true, parameters: { value: actualValue } } };
        d.focusSegments = [{ startFrame: 0, endFrame: total, easing: 'LINEAR', purpose: 'Valor numérico visível', target: { type: 'PROP', id: 'instrument', offset: [0, 1, 0] } }];
    }
    if (door) {
        d.baseShot.characters = [{ instanceId: 'presenter', resourceId: 'CHAR_CAIO_001' }];
        d.baseShot.props = [{ instanceId: 'door', resourceId: 'PROP_DOOR_001' }];
        d.initialState.actors = { presenter: { position: [1.3, 0, 1.1], facing: 0 } };
        d.initialState.props = { door: { position: [-.5, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], visible: true, parameters: { openProgress: 0 } } };
        d.blocking = [{ actorId: 'presenter', startFrame: 0, endFrame: Math.floor(total * .25), startPosition: [1.3, 0, 1.1], endPosition: [.7, 0, .8], startFacing: 0, endFacing: 0, movementType: 'APPROACH', intent: 'INTERACT', purpose: 'Aproximar da porta', easing: 'EASE_IN_OUT' }];
        d.actionSegments = [{ actorId: 'presenter', targetId: 'door', resourceId: 'ACTION_OPEN_DOOR_001', startFrame: Math.floor(total * .25), endFrame: Math.floor(total * .65), fromProgress: 0, toProgress: 1, easing: 'EASE_IN_OUT', purpose: 'Revelar abertura e manter estado' }];
        d.focusSegments = [{ startFrame: 0, endFrame: total, easing: 'LINEAR', purpose: 'Porta e resultado visíveis', target: { type: 'PROP', id: 'door', offset: [0, 1, 0] } }];
    }
    if (!d.focusSegments.length)
        d.focusSegments = [{ startFrame: 0, endFrame: total, easing: 'LINEAR', purpose: 'Texto editorial ou pergunta legível', target: { type: 'TEXT_TARGET', position: [0, 2, 0] } }];
    d.shots[0].onScreenText = claims.map(c => c.text).join(' ').slice(0, 110);
    const q = selections.some(s => s.template === 'QUESTION');
    if (q) {
        d.baseShot.characters = [{ instanceId: 'presenter', resourceId: x.castPreference?.[0] ?? 'CHAR_CAIO_001', position: [-1, 0, 0] }];
        d.initialState.actors = { presenter: { position: [-1, 0, 0], facing: 0 } };
        d.blocking = [{ actorId: 'presenter', startFrame: 0, endFrame: total, startPosition: [-1, 0, 0], endPosition: [-1, 0, 0], startFacing: 0, endFacing: 0, movementType: 'STAY', intent: 'OBSERVE', easing: 'LINEAR', purpose: 'Pergunta editorial legível; não fallback de prova' }];
    }
    d.finalState = evaluateDirected(d, total).state;
    return { sequences: [validateDirected(d)], demonstrations: [] };
}
