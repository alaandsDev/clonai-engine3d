import type { PartialExecutionPlan, CompiledNarrative, ExecutionIsland } from './contracts';
import { NARRATIVE_COMPILER_VERSION } from './contracts';
import { jsonHash } from '../editorial/fingerprint';
import { fail } from '../engine3d/contracts';
import { compileAutoDirector } from '../autodirector/compiler';
import { proofChecks } from '../autodirector/qa';
import { validateDirected, evaluateDirected, type DirectedSequence } from '../engine3d/directed';
import { evaluateDemonstration } from '../engine3d/demonstration-runtime';
import { compileDemonstration } from '../engine3d/demonstration';
import type { VisualDemonstration } from '../engine3d/demonstration-contracts';
import { DEMONSTRATION_COMPILER_VERSION } from '../engine3d/demonstration-contracts';
export function validatePartialPlan(plan: PartialExecutionPlan) {
    const { fingerprint, ...raw } = plan;
    if (jsonHash(raw) !== fingerprint)
        fail('NARRATIVE_PLAN_FINGERPRINT', 'plan changed');
    let at = 0;
    for (const item of plan.timeline) {
        if (item.startFrame !== at || item.endFrame <= at)
            fail('NARRATIVE_TIMELINE', 'gaps, overlaps or zero duration');
        at = item.endFrame;
        if (item.kind === 'ISLAND') {
            const island = plan.executionIslands.find(i => i.id === item.islandId)!;
            if (!island || island.endFrame - island.startFrame !== item.endFrame - item.startFrame)
                fail('NARRATIVE_TIMELINE', 'island timing mismatch');
            if (plan.graph.script.slice(island.sourceSpan.start, island.sourceSpan.end) !== island.input.script)
                fail('NARRATIVE_SOURCE', 'island source changed');
        }
    }
    if (at !== plan.totalFrames)
        fail('NARRATIVE_TIMELINE', 'source duration omitted');
    for (const d of plan.graph.dependencies.filter(d => d.blocking)) {
        const before = plan.claimStatus.find(s => s.claimId === d.fromClaimId), after = plan.claimStatus.find(s => s.claimId === d.toClaimId);
        if (before && ['GAP', 'BLOCKED_BY_DEPENDENCY'].includes(before.status) && after?.status === 'EXECUTABLE')
            fail('NARRATIVE_DEPENDENCY', 'blocked claim executed');
    }
    for (const c of plan.graph.claims.filter(c => c.requiresVisualProof && (c.negated || c.modality !== 'ASSERTED' || c.interrogative || c.confidence === 'LOW'))) {
        if (plan.claimStatus.find(s => s.claimId === c.id)?.status === 'EXECUTABLE')
            fail('NARRATIVE_ASSERTION', 'unsafe positive proof');
    }
    return { passed: true, timelineComplete: true, sourcePreserved: true, dependencies: true, assertionGuards: true };
}
function stateBoundary(plan: PartialExecutionPlan, island: ExecutionIsland, sequence: DirectedSequence, compiled: Map<string, DirectedSequence>) {
    const claims = plan.graph.claims.filter(c => island.claimIds.includes(c.id) && c.requiresVisualProof), carHold = claims.length > 0 && claims.every(c => c.predicate === 'COVER'), liquidHold = claims.length > 0 && claims.every(c => c.predicate === 'STORE');
    const owner = island.requiredIncomingState.find(s => s.sourceIslandId), previous = owner?.sourceIslandId ? compiled.get(owner.sourceIslandId) : null;
    if (owner && !previous)
        fail('NARRATIVE_INCOMING_STATE', 'required executed state unavailable');
    if (!carHold && !liquidHold)
        return { sequence, hold: false };
    if (!sequence.demonstration)
        return { sequence, hold: false };
    const { compilerVersion, ...program } = structuredClone(sequence.demonstration), direction = structuredClone(sequence);
    delete direction.demonstration;
    delete direction.initialState.demonstration;
    delete direction.finalState.demonstration;
    const demo: VisualDemonstration = { ...program, direction };
    if (carHold) {
        const state = demo.initialState.subjects.subject, prior = previous?.finalState.demonstration?.subjects.subject;
        if (prior && prior.parameters.frost !== 1)
            fail('NARRATIVE_STATE_TRANSFER', 'covered-state source is not frozen');
        Object.assign(state, prior ?? { stateId: 'FROZEN', parameters: { frost: 1, highlight: 0 } });
        demo.steps = [];
    }
    else if (liquidHold) {
        const prior = previous?.finalState.demonstration;
        if (prior) {
            demo.initialState.subjects = structuredClone(prior.subjects);
            if (previous?.demonstration)
                demo.subjects = structuredClone(previous.demonstration.subjects);
        }
        else {
            demo.initialState.subjects.destination.parameters.fillLevel = .85;
            demo.initialState.subjects.source.parameters.fillLevel = 0;
            demo.initialState.subjects.connection.parameters.connection = 1;
            demo.initialState.subjects.connection.parameters.flowProgress = 1;
        }
        demo.steps = [];
    }
    demo.finalState = evaluateDemonstration({ ...demo, compilerVersion: DEMONSTRATION_COMPILER_VERSION }, direction.totalFrames);
    const result = compileDemonstration(demo).sequence;
    return { sequence: result, hold: true };
}
export function compileNarrative(plan: PartialExecutionPlan, options: {
    purpose?: 'REVIEW' | 'PRODUCTION';
} = {}): CompiledNarrative {
    validatePartialPlan(plan);
    const purpose = options.purpose ?? 'REVIEW';
    if (purpose === 'PRODUCTION' && !plan.productionReady)
        fail('NARRATIVE_PRODUCTION_GAPS', 'technical placeholders are review-only; unresolved narrative windows remain');
    const compiled = new Map<string, DirectedSequence>();
    const items: CompiledNarrative['items'] = plan.timeline.map(item => {
        if (item.kind === 'VISUAL_GAP_PLACEHOLDER')
            return { ...item, sequence: null, proof: item.claimIds.map(claimId => ({ claimId, proof: 'NONE' as const, evidence: 'Technical review window; not a visual representation' })), physicalInitialState: null, physicalFinalState: null };
        const island = plan.executionIslands.find(i => i.id === item.islandId)!, native = compileAutoDirector(island.autoDirectorPlan).directedSequences[0], bound = stateBoundary(plan, island, native, compiled), sequence = validateDirected(bound.sequence);
        compiled.set(island.id, sequence);
        const proof = island.autoDirectorPlan.claims.map(c => {
            if (!c.requiresVisualProof)
                return { claimId: c.id, proof: 'NONE' as const, evidence: 'Source context preserved; no physical proof claim' };
            const checks = proofChecks(c, island.autoDirectorPlan.templateSelections.find(s => s.claimId === c.id), sequence, island.autoDirectorPlan.narrativeUnits);
            if (bound.hold) {
                const state = sequence.demonstration?.initialState.subjects;
                const good = Boolean(state && (c.semanticTags.includes('freezable') ? state.subject?.parameters.frost === 1 : state.destination?.parameters.fillLevel > 0) && sequence.focusSegments.length);
                if (!good)
                    fail('NARRATIVE_PROOF', 'state-hold evidence missing');
                return { claimId: c.id, proof: 'DIRECT' as const, evidence: island.statePolicy === 'TRANSFER' ? 'Explicitly transferred executed state, held visible with reset focus/camera' : 'Textual state compiled as a constant state; no invented transition' };
            }
            if (!Object.values(checks).every(Boolean))
                fail('NARRATIVE_PROOF', 'compiled per-claim evidence failed ' + c.id);
            return { claimId: c.id, proof: 'DIRECT' as const, evidence: 'Existing Auto Director operations/state/focus validated inside island' };
        });
        return { ...item, sequence, proof, physicalInitialState: sequence.initialState, physicalFinalState: sequence.finalState };
    });
    const raw: Omit<CompiledNarrative, 'fingerprint'> = { version: NARRATIVE_COMPILER_VERSION, planFingerprint: plan.fingerprint, purpose, reviewOnly: purpose === 'REVIEW' && plan.renderability !== 'FULL', productionReady: plan.productionReady, totalFrames: plan.totalFrames, fps: plan.fps, canvas: plan.canvas, items, unresolvedWindows: plan.localizedGaps.map(g => ({ gapId: g.id, startFrame: g.startFrame, endFrame: g.endFrame, reason: g.status === 'BLOCKED_BY_DEPENDENCY' ? 'BLOCKED_BY_DEPENDENCY' : g.reason })) };
    return { ...raw, fingerprint: jsonHash(raw) };
}
export function productionPlan(plan: PartialExecutionPlan) { validatePartialPlan(plan); return { version: NARRATIVE_COMPILER_VERSION, planFingerprint: plan.fingerprint, productionReady: plan.productionReady, renderability: plan.renderability, placeholderAllowed: false, masterRenderAllowed: plan.productionReady, executableIslands: plan.executionIslands.map(i => ({ id: i.id, startFrame: i.startFrame, endFrame: i.endFrame, autoDirectorFingerprint: i.autoDirectorPlan.fingerprint })), unresolvedWindows: plan.localizedGaps.map(g => ({ id: g.id, sourceSpan: g.sourceSpan, startFrame: g.startFrame, endFrame: g.endFrame, reason: g.status === 'BLOCKED_BY_DEPENDENCY' ? 'BLOCKED_BY_DEPENDENCY' : g.reason })), policy: 'Reject an entire production master while unresolved windows exist; valid islands may compile independently' }; }
