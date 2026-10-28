import type { SemanticUnit, SemanticEntity, SemanticRelation, NormalizedQuantity, Ambiguity, SourceSpan } from './contracts';
import type { NarrativeClause, SemanticEvent, NarrativeReference, NarrativeClaim } from './narrative-contracts';
import { normalize, stableIds } from './normalize';
import { jsonHash } from '../editorial/fingerprint';
const evidence = (spans: SourceSpan[]) => [...new Map(spans.map(s => [s.start + ':' + s.end, s])).values()].sort((a, b) => a.start - b.start || a.end - b.end);
export function claimsFromEvents(script: string, units: SemanticUnit[], clauses: NarrativeClause[], entities: SemanticEntity[], events: SemanticEvent[], references: NarrativeReference[], relations: SemanticRelation[], quantities: NormalizedQuantity[], ambiguities: Ambiguity[]): NarrativeClaim[] {
    const claims: NarrativeClaim[] = [];
    for (const cl of clauses) {
        const es = events.filter(e => e.clauseId === cl.id), folded = normalize(cl.sourceSpan.text), unit = units.find(u => u.id === cl.unitId)!;
        const question = es.some(e => e.interrogative) || unit.sourceSpan.text.includes('?') || cl.nonAsserted && !/nao significa|nao quer dizer/.test(normalize(unit.sourceSpan.text));
        const editorial = /^\s*(?:acompanhe|observe|veja|imagine)\b/.test(folded) && !es.some(e => ['FREEZE', 'COVER', 'ACCUMULATE', 'FLOW', 'ENTER'].includes(e.predicate)) || cl.type === 'PURPOSE' || /^(?:\s*(?:e|mas)\s+)?(?:assim|em resumo|por fim|no fim|nesta explicacao|nesse exemplo)\b/.test(folded) && es.every(e => ['IS', 'CONTINUE', 'UNKNOWN'].includes(e.predicate)) || /\b(?:trajeto|caminho|processo)\b.*\b(?:claro|passo a passo)\b/.test(folded) && es.every(e => e.predicate === 'IS');
        const work = question || editorial ? [es[0] ?? null] : es.length ? es : [null];
        for (const event of work) {
            const subject = entities.find(e => e.id === event?.subjectEntityIds[0]), predicate = event?.predicate === 'IS' && event.stateAfter === 'STORED' ? 'STORE' : event?.predicate === 'IS' && event.stateAfter === 'COVERED' ? 'COVER' : event?.predicate === 'INCREASE' && events.find(e => e.id === event.continuesEventId)?.predicate === 'ACCUMULATE' ? 'ACCUMULATE' : event?.predicate === 'CONTINUE' ? events.find(e => e.id === event.continuesEventId)?.predicate ?? 'UNKNOWN' : event?.predicate ?? 'UNKNOWN';
            const contextState = predicate === 'IS' && subject?.semanticTags.includes('vehicle') && /normal|estacionad|expost|frio/.test(folded);
            const conditionSupport = cl.type === 'TEMPORAL' && event && ['ENTER', 'FLOW'].includes(predicate) && events.some(e => e.unitId === cl.unitId && e.sourceSpan.start > event.sourceSpan.end && e.predicate === 'INCREASE');
            const purpose = cl.type === 'PURPOSE', role: NarrativeClaim['narrativeRole'] = question ? 'QUESTION' : editorial || contextState || conditionSupport ? 'CONTEXT' : purpose ? 'PURPOSE' : 'FACT';
            const q = quantities.filter(q => event?.quantityIds.includes(q.id)), quantityTransition = q.length > 1 && ['INCREASE', 'DECREASE'].includes(predicate);
            const type: NarrativeClaim['type'] = question ? 'QUESTION' : role !== 'FACT' ? 'CONCLUSION' : q.length && q[0].dimension === 'TEMPERATURE' && !quantityTransition ? 'TEMPERATURE' : q.length && q[0].dimension === 'RANK' ? 'RANKING' : quantityTransition || ['INCREASE', 'DECREASE', 'FILL'].includes(predicate) ? 'QUANTITY_CHANGE' : predicate === 'RISE' ? 'SPATIAL_RELATION' : ['ACCUMULATE', 'COVER', 'FREEZE', 'STORE', 'IS', 'OPEN', 'CLOSE'].includes(predicate) ? 'OBJECT_STATE' : predicate === 'COMPARE' ? 'COMPARISON' : 'PROCESS';
            const refs = references.filter(r => r.clauseId === cl.id), entityRefs = refs.filter(r => r.kind !== 'EVENT_REFERENCE'), amb = ambiguities.filter(a => a.sourceSpan.start >= cl.sourceSpan.start && a.sourceSpan.end <= cl.sourceSpan.end), status = role !== 'FACT' && !amb.length ? 'RESOLVED' : amb.length ? 'AMBIGUOUS' : event?.subjectEntityIds.length ? 'RESOLVED' : 'UNRESOLVED';
            let tags: string[] = [];
            const domain = event?.domain ?? 'UNKNOWN';
            if (domain === 'LIQUID_PROCESS')
                tags.push('liquid');
            if (['FLOW', 'ENTER', 'EXIT', 'RISE'].includes(predicate) && domain === 'LIQUID_PROCESS')
                tags.push('transfer');
            if (predicate === 'RISE')
                tags.push('upward');
            if (['INCREASE', 'FILL'].includes(predicate) && domain === 'LIQUID_PROCESS')
                tags.push('fill');
            if (predicate === 'STORE' && domain === 'LIQUID_PROCESS')
                tags.push('storage');
            if (domain === 'VEHICLE_STATE' && ['ACCUMULATE', 'COVER', 'FREEZE'].includes(predicate))
                tags.push('freezable');
            if (domain === 'SCIENTIFIC_ACTIVITY')
                tags.push('scientific_crowd');
            if (type === 'TEMPERATURE')
                tags.push('temperature');
            if (type === 'RANKING')
                tags.push('ranking');
            if (question)
                tags.push('question');
            const confidence = role !== 'FACT' && !amb.length ? 'HIGH' : status !== 'RESOLVED' ? 'LOW' : event?.confidence ?? 'LOW';
            const blockedReason = role !== 'FACT' ? null : status !== 'RESOLVED' ? 'EDITORIAL_AMBIGUITY' : confidence === 'LOW' ? 'LOW_CLAIM_CONFIDENCE' : event?.negated || event?.modality !== 'ASSERTED' ? 'UNSUPPORTED_RELATION' : predicate === 'UNKNOWN' ? 'INSUFFICIENT_PROOF' : quantityTransition ? 'UNSUPPORTED_RELATION' : null;
            const claim: NarrativeClaim = { id: 'NC' + (claims.length + 1), unitId: cl.unitId, text: cl.sourceSpan.text.trim(), type, predicate: predicate === 'CONTINUE' ? 'FLOW' : predicate, subjectEntityId: event?.subjectEntityIds[0] ?? null, predicateIds: event ? [event.id] : [], entityIds: stableIds([...(event?.subjectEntityIds ?? []), ...(event?.objectEntityIds ?? [])]), relationIds: relations.filter(r => event && r.predicateIds.includes(event.id)).map(r => r.id), referenceIds: entityRefs.map(r => r.id), eventReferenceIds: refs.filter(r => r.kind === 'EVENT_REFERENCE').map(r => r.id), ambiguityIds: amb.map(a => a.id), sourceSpan: cl.sourceSpan, sourceEvidence: evidence([cl.sourceSpan, ...(event?.sourceEvidence ?? [])]), extractionSource: 'SEMANTIC_ENGINE', confidence, confidenceScore: role !== 'FACT' && !amb.length ? .8 : event?.confidenceScore ?? 0, confidenceBreakdown: role !== 'FACT' ? { editorialClassification: .8 } : event?.confidenceBreakdown ?? { unresolved: 0 }, negated: event?.negated ?? false, modality: event?.modality ?? 'ASSERTED', interrogative: question, status, importance: role === 'FACT' ? 'PRIMARY' : 'SUPPORTING', requiresVisualProof: role === 'FACT', stateTransition: ['ACCUMULATE', 'COVER', 'FREEZE'].includes(predicate) ? { initial: null, process: predicate === 'ACCUMULATE' && [...(event?.objectEntityIds ?? []), ...(events.find(e => e.id === event?.continuesEventId)?.objectEntityIds ?? [])].some(id => entities.find(e => e.id === id)?.semanticTags.includes('ice')) ? 'ACCUMULATE ICE' : null, final: predicate === 'COVER' ? 'COVERED' : predicate === 'FREEZE' ? 'FROZEN' : null } : null, quantityIds: q.map(q => q.id), executionUnitIds: [cl.unitId], previousClaimIds: [], nextClaimIds: [], sharedEntityIds: [], canonicalFingerprint: '', clauseIds: [cl.id], eventIds: event ? [event.id] : [], domain: role !== 'FACT' && domain === 'UNKNOWN' ? 'EDITORIAL' : domain, semanticTags: stableIds(tags), narrativeRole: role, blockedReason };
            claims.push(claim);
        }
    }
    // A completed chain is explicit evidence, not a guess that every accumulation reaches completion.
    for (const c of claims.filter(c => c.predicate === 'COVER' && c.subjectEntityId && !c.negated && c.modality === 'ASSERTED')) {
        const previousCovered = claims.filter(p => p.subjectEntityId === c.subjectEntityId && p.predicate === 'COVER' && p.sourceSpan.start < c.sourceSpan.start && p.stateTransition?.process === 'ACCUMULATE ICE').at(-1);
        if (/continua|permanece|ainda/.test(normalize(c.text)) && previousCovered) {
            c.stateTransition = { initial: 'COVERED', process: 'ACCUMULATE ICE', final: 'COVERED' };
            c.sourceEvidence = evidence([...previousCovered.sourceEvidence, ...c.sourceEvidence]);
            continue;
        }
        const allPrior = claims.filter(p => p.subjectEntityId === c.subjectEntityId && p.predicate === 'ACCUMULATE' && p.stateTransition?.process === 'ACCUMULATE ICE' && p.status === 'RESOLVED' && p.confidence !== 'LOW' && p.sourceSpan.start < c.sourceSpan.start && !p.negated && p.modality === 'ASSERTED');
        const before = allPrior[0];
        if (before) {
            const interval = units.filter(u => u.order >= units.find(u => u.id === before.unitId)!.order && u.order <= units.find(u => u.id === c.unitId)!.order).map(u => u.id);
            for (const member of [...allPrior, c]) {
                member.stateTransition = { initial: null, process: 'ACCUMULATE ICE', final: 'COVERED' };
                member.executionUnitIds = interval;
                member.sourceEvidence = evidence([...allPrior.flatMap(a => a.sourceEvidence), ...c.sourceEvidence]);
            }
        }
    }
    for (const c of claims) {
        if (c.semanticTags.includes('freezable') && c.predicate === 'COVER' && c.stateTransition?.process !== 'ACCUMULATE ICE' && !c.entityIds.some(id => entities.find(e => e.id === id)?.semanticTags.includes('ice')))
            c.blockedReason ??= 'INSUFFICIENT_PROOF';
        if (c.semanticTags.includes('freezable') && c.stateTransition?.final !== 'COVERED' && c.predicate !== 'COVER' && c.narrativeRole === 'FACT')
            c.blockedReason ??= 'UNSUPPORTED_RELATION';
        c.canonicalFingerprint = jsonHash({ type: c.type, predicate: c.predicate, entities: c.entityIds, negated: c.negated, modality: c.modality, quantities: c.quantityIds.map(id => quantities.find(q => q.id === id)), evidence: c.sourceEvidence });
    }
    return claims;
}
