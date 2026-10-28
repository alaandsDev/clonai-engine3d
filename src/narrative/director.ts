import type { SemanticNarrativeGraph, NarrativeClaim } from '../semantics/narrative-contracts';
import type { CapabilityNode, VisualGap } from '../autodirector/contracts';
import { capabilityGraph } from '../autodirector/capabilities';
import { planAutoDirector } from '../autodirector/planner';
import { selectTemplate, templates } from '../autodirector/scoring';
import { jsonHash } from '../editorial/fingerprint';
import { fail } from '../engine3d/contracts';
import { sourceSpan, stableIds } from '../semantics/normalize';
import { narrativeTiming } from './timing';
import { projectIsland } from './projection';
import { DIRECTOR_VERSION, PARTIAL_PLAN_VERSION, type NarrativeOptions, type PartialExecutionPlan, type LocalizedVisualGap, type ExecutionIsland, type SemanticStateBoundary } from './contracts';
export function directNarrative(graph: SemanticNarrativeGraph, options: NarrativeOptions = {}, snapshot: CapabilityNode[] = capabilityGraph()): PartialExecutionPlan {
    const { fingerprint, ...rawGraph } = graph;
    if (jsonHash(rawGraph) !== fingerprint)
        fail('NARRATIVE_GRAPH_FINGERPRINT', 'graph changed');
    const policy = options.policy ?? 'PLAN_ONLY';
    if (!['PLAN_ONLY', 'STRICT_FULL', 'STRICT_ISLANDS'].includes(policy))
        fail('NARRATIVE_POLICY', 'unknown policy');
    const timing = narrativeTiming(graph, options), fps = options.fps ?? 30, gaps: LocalizedVisualGap[] = [], islands: ExecutionIsland[] = [], status = new Map<string, PartialExecutionPlan['claimStatus'][number]>();
    const addGap = (c: NarrativeClaim, reason: VisualGap['reason'], blockedBy: string[] = []) => { if (status.has(c.id) && status.get(c.id)!.status !== 'EXECUTABLE')
        return; const segment = graph.segments.find(s => s.claimIds.includes(c.id))!, times = timing.filter(t => c.clauseIds.includes(t.clauseId)), g: LocalizedVisualGap = { id: 'LG_' + c.id, claimId: c.id, claimIds: [c.id], segmentId: segment.id, clauseIds: c.clauseIds, sourceSpan: c.sourceSpan, reason, missingCapabilities: stableIds(templates.filter(t => c.semanticTags.includes(t.tag)).flatMap(t => t.caps).filter(cap => !snapshot.some(n => n.capabilities.includes(cap)))), missingSemanticSubjects: c.semanticTags, bestAvailableProof: 'NONE', recommendedResolution: reason === 'MISSING_SUBJECT' ? 'EXTERNAL_MEDIA' : 'HUMAN_DIRECTION', timelineIntent: 'VISUAL_GAP_PLACEHOLDER', blocksIsland: true, recoverable: true, resumeSegmentId: null, startFrame: Math.min(...times.map(t => t.startFrame)), endFrame: Math.max(...times.map(t => t.endFrame)), blockedByClaimIds: blockedBy, status: blockedBy.length ? 'BLOCKED_BY_DEPENDENCY' : 'UNSUPPORTED' }; gaps.push(g); status.set(c.id, { claimId: c.id, status: blockedBy.length ? 'BLOCKED_BY_DEPENDENCY' : 'GAP', islandId: null, gapId: g.id }); };
    // Preflight asks the existing resource/template resolver; it does not invent a second visual planner.
    for (const c of graph.claims.filter(c => c.requiresVisualProof)) {
        if (c.blockedReason) {
            addGap(c, c.blockedReason as VisualGap['reason']);
            continue;
        }
        const candidate = selectTemplate({ ...c, startOffset: c.sourceSpan.start, endOffset: c.sourceSpan.end, unitId: c.unitId, source: 'SEMANTIC_ENGINE' }, snapshot);
        if (!candidate)
            addGap(c, c.semanticTags.includes('scientific_crowd') ? 'MISSING_SUBJECT' : 'INSUFFICIENT_PROOF');
    }
    const propagate = () => { let changed = true; while (changed) {
        changed = false;
        for (const d of graph.dependencies.filter(d => d.blocking)) {
            const prior = status.get(d.fromClaimId), current = status.get(d.toClaimId);
            if (prior && ['GAP', 'BLOCKED_BY_DEPENDENCY'].includes(prior.status) && (!current || current.status === 'EXECUTABLE' || current.status === 'GAP')) {
                const c = graph.claims.find(c => c.id === d.toClaimId)!;
                if (current?.status === 'GAP') {
                    const g = gaps.find(g => g.id === current.gapId)!;
                    g.status = 'BLOCKED_BY_DEPENDENCY';
                    g.blockedByClaimIds = stableIds([...g.blockedByClaimIds, d.fromClaimId]);
                    current.status = 'BLOCKED_BY_DEPENDENCY';
                    changed = true;
                }
                else {
                    addGap(c, 'RESOURCE_CONFLICT', [d.fromClaimId]);
                    changed = true;
                }
            }
        }
    } };
    propagate();
    function planRun(segmentId: string, clauseIds: string[]) {
        if (!clauseIds.length)
            return;
        const cs = graph.claims.filter(c => c.clauseIds.some(id => clauseIds.includes(id))), id = graph.id + '-island-' + (islands.length + 1), input = projectIsland(graph, clauseIds, timing, options, id), p = planAutoDirector(input, snapshot);
        if (!p.directedSequences.length || p.visualGaps.length) {
            if (clauseIds.length > 1) {
                const rootIds = p.visualGaps.filter(g => g.reason !== 'RESOURCE_CONFLICT').map(g => g.claimId), bad = new Set(graph.claims.filter(c => rootIds.includes(c.id)).flatMap(c => c.clauseIds));
                if (bad.size && bad.size < clauseIds.length) {
                    for (const c of cs.filter(c => c.requiresVisualProof && c.clauseIds.some(id => bad.has(id))))
                        addGap(c, p.visualGaps.find(g => g.claimId === c.id)?.reason ?? 'INSUFFICIENT_PROOF');
                    propagate();
                    let run: string[] = [];
                    for (const cid of clauseIds) {
                        if (bad.has(cid)) {
                            planRun(segmentId, run);
                            run = [];
                        }
                        else
                            run.push(cid);
                    }
                    planRun(segmentId, run);
                    return;
                }
                const mid = Math.floor(clauseIds.length / 2);
                planRun(segmentId, clauseIds.slice(0, mid));
                planRun(segmentId, clauseIds.slice(mid));
                return;
            }
            for (const c of cs.filter(c => c.requiresVisualProof))
                addGap(c, p.visualGaps.find(g => g.claimId === c.id)?.reason ?? 'INSUFFICIENT_PROOF');
            return;
        }
        const cls = graph.clauses.filter(c => clauseIds.includes(c.id)), times = timing.filter(t => clauseIds.includes(t.clauseId)), startFrame = times[0].startFrame, endFrame = times.at(-1)!.endFrame;
        if (p.directedSequences[0].totalFrames !== endFrame - startFrame)
            fail('NARRATIVE_DURATION', 'island local frames differ from preserved narrative window');
        const priorGap = gaps.some(g => g.endFrame <= startFrame && g.endFrame > (islands.at(-1)?.endFrame ?? -1)), required: SemanticStateBoundary[] = [];
        for (const d of graph.dependencies.filter(d => d.blocking && cs.some(c => c.id === d.toClaimId) && !cs.some(c => c.id === d.fromClaimId))) {
            const owner = islands.find(i => i.claimIds.includes(d.fromClaimId));
            const state = owner?.exportedState.find(s => cs.some(c => c.subjectEntityId === s.entityId));
            if (state)
                required.push({ ...state, provenance: 'EXECUTED_EXPORT' });
        }
        const initial = graph.states.filter(s => s.sourceSpan.start <= cls[0].sourceSpan.start && cs.some(c => c.entityIds.includes(s.entityId))).map(s => ({ entityId: s.entityId, state: s.state, sourceClaimId: graph.claims.find(c => c.eventIds.includes(s.eventId))?.id ?? '', sourceIslandId: null, provenance: 'TEXT' as const }));
        const final: SemanticStateBoundary[] = cs.filter(c => c.requiresVisualProof && ['COVER', 'STORE'].includes(c.predicate)).map(c => ({ entityId: c.subjectEntityId!, state: c.predicate === 'COVER' ? 'COVERED' : 'STORED', sourceClaimId: c.id, sourceIslandId: id, provenance: 'EXECUTED_EXPORT' }));
        const island: ExecutionIsland = { id, segmentId, domain: graph.segments.find(s => s.id === segmentId)!.domain, clauseIds, claimIds: cs.map(c => c.id), sourceSpan: sourceSpan(graph.script, cls[0].sourceSpan.start, cls.at(-1)!.sourceSpan.end), startFrame, endFrame, input, autoDirectorPlan: p, initialSemanticState: initial, requiredIncomingState: required, finalSemanticState: final, exportedState: final, statePolicy: required.length ? 'TRANSFER' : 'RESET', cameraPolicy: required.length && !priorGap ? 'REFRAME' : 'RESET_CAMERA', focusPolicy: 'RESET_FOCUS', recoveryAfterGap: priorGap && cs.some(c => c.requiresVisualProof) };
        islands.push(island);
        for (const c of cs)
            status.set(c.id, { claimId: c.id, status: c.requiresVisualProof ? 'EXECUTABLE' : 'CONTEXT', islandId: id, gapId: null });
    }
    for (const segment of graph.segments) {
        let run: string[] = [];
        for (const cid of segment.clauseIds) {
            const blocked = graph.claims.some(c => c.clauseIds.includes(cid) && status.has(c.id) && ['GAP', 'BLOCKED_BY_DEPENDENCY'].includes(status.get(c.id)!.status));
            if (blocked) {
                planRun(segment.id, run);
                run = [];
            }
            else
                run.push(cid);
        }
        planRun(segment.id, run);
    }
    propagate();
    // One failed clause makes its own review window; unrelated clauses/segments keep their islands.
    const items: PartialExecutionPlan['timeline'] = [];
    for (const cl of graph.clauses) {
        const t = timing.find(t => t.clauseId === cl.id)!, island = islands.find(i => i.clauseIds.includes(cl.id)), gs = gaps.filter(g => g.clauseIds.includes(cl.id));
        if (island && !gs.length) {
            if (items.at(-1)?.islandId === island.id) {
                items.at(-1)!.endFrame = t.endFrame;
                items.at(-1)!.clauseIds.push(cl.id);
                items.at(-1)!.claimIds.push(...graph.claims.filter(c => c.clauseIds.includes(cl.id)).map(c => c.id));
            }
            else
                items.push({ id: 'TL' + (items.length + 1), kind: 'ISLAND', islandId: island.id, gapIds: [], clauseIds: [cl.id], claimIds: graph.claims.filter(c => c.clauseIds.includes(cl.id)).map(c => c.id), startFrame: t.startFrame, endFrame: t.endFrame, reviewOnly: false });
        }
        else {
            const last = items.at(-1);
            if (last?.kind === 'VISUAL_GAP_PLACEHOLDER') {
                last.endFrame = t.endFrame;
                last.clauseIds.push(cl.id);
                last.gapIds.push(...gs.map(g => g.id));
                last.claimIds.push(...gs.flatMap(g => g.claimIds));
            }
            else
                items.push({ id: 'TL' + (items.length + 1), kind: 'VISUAL_GAP_PLACEHOLDER', islandId: null, gapIds: gs.map(g => g.id), clauseIds: [cl.id], claimIds: gs.flatMap(g => g.claimIds), startFrame: t.startFrame, endFrame: t.endFrame, reviewOnly: true });
        }
    }
    for (const gap of gaps) {
        const next = islands.find(i => i.startFrame >= gap.endFrame && i.claimIds.some(id => graph.claims.find(c => c.id === id)?.requiresVisualProof));
        gap.resumeSegmentId = next?.segmentId ?? null;
        gap.recoverable = Boolean(next);
    }
    const totalFrames = timing.at(-1)?.endFrame ?? 0, executableFrames = items.filter(i => i.kind === 'ISLAND').reduce((n, i) => n + i.endFrame - i.startFrame, 0), primary = graph.claims.filter(c => c.requiresVisualProof), executable = primary.filter(c => status.get(c.id)?.status === 'EXECUTABLE').length;
    const renderability = executableFrames === totalFrames ? 'FULL' : executableFrames > 0 ? 'PARTIAL' : 'NONE';
    if (policy === 'STRICT_FULL' && gaps.some(g => g.claimIds.some(id => graph.claims.find(c => c.id === id)?.importance === 'PRIMARY')))
        fail('NARRATIVE_STRICT_FULL', 'unresolved PRIMARY windows');
    const raw: Omit<PartialExecutionPlan, 'fingerprint'> = { version: 1, planVersion: PARTIAL_PLAN_VERSION, directorVersion: DIRECTOR_VERSION, id: graph.id, graphFingerprint: graph.fingerprint, graph, policy, fps, canvas: options.canvas ?? { width: 480, height: 854 }, totalFrames, clauseTiming: timing, narrativeSegments: graph.segments, executionIslands: islands, localizedGaps: gaps, transitions: items.slice(1).map((item, index) => ({ fromItemId: items[index].id, toItemId: item.id, cameraPolicy: islands.find(i => i.id === item.islandId)?.cameraPolicy ?? 'TRANSITION_CAMERA', statePolicy: islands.find(i => i.id === item.islandId)?.statePolicy ?? 'RESET', reason: item.kind === 'VISUAL_GAP_PLACEHOLDER' ? 'Explicit technical review boundary' : items[index].kind === 'VISUAL_GAP_PLACEHOLDER' ? 'Reconstruct context after localized gap' : 'Declared island boundary' })), timeline: items, claimStatus: graph.claims.map(c => status.get(c.id) ?? { claimId: c.id, status: 'CONTEXT', islandId: null, gapId: null }), coverage: { primaryClaimCount: primary.length, executableClaimRate: executable / Math.max(1, primary.length), directProofRate: executable / Math.max(1, primary.length), partialProofRate: 0, gapClaimRate: primary.filter(c => status.get(c.id)?.status === 'GAP').length / Math.max(1, primary.length), blockedDependencyRate: primary.filter(c => status.get(c.id)?.status === 'BLOCKED_BY_DEPENDENCY').length / Math.max(1, primary.length), executableFrames, totalFrames, executableTimelineRate: executableFrames / Math.max(1, totalFrames), executionIslandCount: islands.length, avgClaimsPerIsland: islands.reduce((n, i) => n + i.claimIds.length, 0) / Math.max(1, islands.length), largestIsland: Math.max(0, ...islands.map(i => i.claimIds.length)), localizedGapCount: gaps.length, recoveryAfterGapCount: islands.filter(i => i.recoveryAfterGap).length, failedRecoveryCount: graph.segments.filter(s => gaps.some(g => g.endFrame <= timing.find(t => t.clauseId === s.clauseIds[0])!.startFrame) && s.claimIds.some(id => graph.claims.find(c => c.id === id)?.requiresVisualProof) && !islands.some(i => i.segmentId === s.id && i.claimIds.some(id => graph.claims.find(c => c.id === id)?.requiresVisualProof))).length, continuityTransfers: islands.filter(i => i.statePolicy === 'TRANSFER').length, stateResets: islands.filter(i => i.statePolicy === 'RESET').length }, renderability, productionReady: renderability === 'FULL' };
    return { ...raw, fingerprint: jsonHash(raw) };
}
