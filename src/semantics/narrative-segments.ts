import type { SemanticUnit, SemanticRelation } from './contracts';
import type { NarrativeClause, SemanticEvent, NarrativeClaim, NarrativeSegment, NarrativeTransition, ClaimDependency, Domain } from './narrative-contracts';
import { normalize, sourceSpan, stableIds } from './normalize';
export function narrativeSegments(script: string, units: SemanticUnit[], clauses: NarrativeClause[], events: SemanticEvent[], claims: NarrativeClaim[]) {
    const segments: NarrativeSegment[] = [], transitions: NarrativeTransition[] = [];
    for (const clause of clauses) {
        const cs = claims.filter(c => c.clauseIds.includes(clause.id)), es = events.filter(e => e.clauseId === clause.id);
        let domain: Domain = cs.find(c => c.narrativeRole === 'FACT')?.domain ?? es.find(e => e.domain !== 'UNKNOWN')?.domain ?? 'EDITORIAL';
        if (domain === 'EDITORIAL' || domain === 'UNKNOWN' && cs.every(c => !c.requiresVisualProof))
            domain = segments.at(-1)?.domain ?? claims.find(c => c.requiresVisualProof && c.domain !== 'UNKNOWN')?.domain ?? 'EDITORIAL';
        const text = normalize(clause.sourceSpan.text), explicitReturn = /\b(?:voltando|de volta|retomando|novamente no|novamente ao)\b/.test(text), previous = segments.at(-1), subjectSwitch = domain === 'VEHICLE_STATE' && es.some(e => e.subjectEntityIds.length && !previous?.dominantSubjectIds.some(id => e.subjectEntityIds.includes(id))) && Boolean(previous?.dominantSubjectIds.length), boundary = !previous || previous.domain !== domain || explicitReturn || subjectSwitch;
        let s = previous;
        if (boundary) {
            s = { id: 'SEG' + (segments.length + 1), type: cs.some(c => c.interrogative) ? segments.length ? 'QUESTION' : 'HOOK' : domain === 'LIQUID_PROCESS' ? 'PROCESS' : domain === 'VEHICLE_STATE' ? 'EXAMPLE' : domain === 'MEASUREMENT' ? 'EXPLANATION' : domain === 'SCIENTIFIC_ACTIVITY' ? 'EXPLANATION' : 'UNKNOWN', domain, unitIds: [], clauseIds: [], claimIds: [], entityIds: [], eventIds: [], dominantSubjectIds: [], locationIds: [], confidence: 'HIGH', sourceSpan: clause.sourceSpan, boundaryReason: explicitReturn ? 'Explicit narrative return marker' : previous ? 'Subject/process domain changed' : 'First source segment' };
            segments.push(s);
            if (previous)
                transitions.push({ fromSegmentId: previous.id, toSegmentId: s.id, type: explicitReturn ? 'EXPLICIT_RETURN' : previous.domain !== domain ? 'DOMAIN_SHIFT' : 'CONTINUES', sourceSpan: clause.sourceSpan, reason: s.boundaryReason });
        }
        s!.unitIds = stableIds([...s!.unitIds, clause.unitId]);
        s!.clauseIds.push(clause.id);
        s!.claimIds.push(...cs.map(c => c.id));
        s!.entityIds = stableIds([...s!.entityIds, ...cs.flatMap(c => c.entityIds)]);
        s!.eventIds.push(...es.map(e => e.id));
        s!.dominantSubjectIds = stableIds([...s!.dominantSubjectIds, ...es.flatMap(e => e.subjectEntityIds)]);
        s!.locationIds = stableIds([...s!.locationIds, ...es.flatMap(e => e.locationEntityIds)]);
        s!.sourceSpan = sourceSpan(script, s!.sourceSpan.start, clause.sourceSpan.end);
        if (cs.some(c => c.confidence === 'LOW'))
            s!.confidence = 'MEDIUM';
    }
    return { segments, transitions };
}
export function claimDependencies(clauses: NarrativeClause[], events: SemanticEvent[], claims: NarrativeClaim[], relations: SemanticRelation[], segments: NarrativeSegment[]): ClaimDependency[] {
    const out: ClaimDependency[] = [];
    const add = (from: NarrativeClaim | undefined, to: NarrativeClaim, type: ClaimDependency['type'], blocking: boolean, reason: string) => { if (!from || from.id === to.id)
        return; out.push({ id: 'D' + (out.length + 1), fromClaimId: from.id, toClaimId: to.id, type, blocking, reason, sourceSpan: to.sourceSpan }); to.previousClaimIds = stableIds([...to.previousClaimIds, from.id]); from.nextClaimIds = stableIds([...from.nextClaimIds, to.id]); to.sharedEntityIds = stableIds([...to.sharedEntityIds, ...to.entityIds.filter(id => from.entityIds.includes(id))]); };
    for (let i = 0; i < claims.length; i++) {
        const c = claims[i], e = events.find(e => c.eventIds.includes(e.id)), previous = claims[i - 1];
        if (e?.continuesEventId) {
            add(claims.find(p => p.eventIds.includes(e.continuesEventId!)), c, 'DEPENDS_ON', true, 'Explicit event reference requires the referenced event');
            continue;
        }
        const cause = relations.find(r => r.type === 'CAUSE_EFFECT' && e && r.predicateIds.at(-1) === e.id);
        if (cause) {
            add(claims.find(p => p.eventIds.some(id => cause.predicateIds[0] === id)), c, 'CAUSES', true, 'Explicit causal marker links textual events');
            continue;
        }
        const shared = claims.slice(0, i).filter(p => p.entityIds.some(id => c.entityIds.includes(id))).at(-1);
        if (c.predicate === 'COVER' && /continua|permanece|ainda/.test(normalize(c.text))) {
            const priorState = claims.slice(0, i).filter(p => p.subjectEntityId === c.subjectEntityId && p.predicate === 'COVER' && !p.negated && p.modality === 'ASSERTED').at(-1);
            if (priorState) {
                add(priorState, c, 'DEPENDS_ON', true, 'Persistent covered state requires the earlier state');
                continue;
            }
        }
        const segment = segments.find(s => s.claimIds.includes(c.id)), priorSegment = segments.find(s => s.claimIds.includes(previous?.id));
        if (previous && segment?.id !== priorSegment?.id)
            add(previous, c, 'INDEPENDENT', false, 'Domain boundary without an explicit dependency');
        else if (shared)
            add(shared, c, 'CONTINUES', false, 'Shared textual subject/object; continuity preference, not a blocking requirement');
        else if (previous)
            add(previous, c, 'INDEPENDENT', false, 'No evidenced dependency on the previous claim');
    }
    return out;
}
