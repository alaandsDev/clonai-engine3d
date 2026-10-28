import type { SemanticEntity, SourceSpan } from './contracts';
import type { NarrativeReference, ReferenceCandidate, SemanticEvent, Domain } from './narrative-contracts';
import { normalize, stableIds } from './normalize';
export const referenceScoring = { base: 20, type: 30, gender: 12, number: 12, predicate: 50, recency: 10, currentSegment: 16, segmentBoundary: -18, descriptor: 36, destinationRole: 40, sourceConflict: -24, subjectRole: 12, continuity: 8, competition: -8, minScore: 64, margin: 24, maxCandidates: 32 };
export interface ReferenceRequest {
    id: string;
    mentionId: string;
    clauseId: string;
    sourceSpan: SourceSpan;
    kind: NarrativeReference['kind'];
    gender: 'M' | 'F' | 'UNKNOWN';
    number: 'SINGULAR' | 'PLURAL';
    descriptor: string | null;
    predicate: string;
    domain: Domain;
    order: number;
    role: 'SUBJECT' | 'OBJECT';
}
export function resolveReference(req: ReferenceRequest, entities: SemanticEntity[], events: SemanticEvent[], entityLastOrder: Map<string, number>): NarrativeReference {
    const w = referenceScoring, eventRef = req.kind === 'EVENT_REFERENCE', eventCandidates = events.filter(e => e.sourceSpan.start < req.sourceSpan.start && e.predicate !== 'IS' && e.predicate !== 'UNKNOWN' && !e.interrogative && e.modality === 'ASSERTED' && !e.negated).slice(-12), raw = eventRef ? [...new Map(eventCandidates.map(e => [e.processIdentity ?? e.id, e])).values()] : entities.filter(e => e.sourceSpan.start < req.sourceSpan.start && !['NUMBER', 'ENVIRONMENT', 'MEASUREMENT'].includes(e.type)).slice(-w.maxCandidates);
    const descriptor = normalize(req.descriptor ?? ''), candidates: ReferenceCandidate[] = raw.map(value => {
        const entity = eventRef ? null : value as SemanticEntity, event = eventRef ? value as SemanticEvent : null;
        const isVehicle = /veiculo/.test(descriptor), isContainer = /recipiente|reservatorio|caixa/.test(descriptor), isObject = /objeto/.test(descriptor), isPlace = /local/.test(descriptor);
        const typeOk = eventRef ? (/acumulo/.test(descriptor) ? event!.predicate === 'ACCUMULATE' : /aumento/.test(descriptor) ? event!.predicate === 'INCREASE' : /queda/.test(descriptor) ? ['DECREASE', 'FALL'].includes(event!.predicate) : /mudanca/.test(descriptor) ? ['ACCUMULATE', 'COVER', 'FREEZE', 'INCREASE', 'DECREASE'].includes(event!.predicate) : true) : isVehicle ? entity!.semanticTags.includes('vehicle') : isContainer ? entity!.semanticTags.includes('container') : isObject ? entity!.type === 'OBJECT' : isPlace ? entity!.type === 'PLACE' : true;
        const numberOk = eventRef || req.number === entity!.number, genderOk = eventRef || descriptor.length > 0 || req.gender === 'UNKNOWN' || entity!.gender === 'UNKNOWN' || entity!.gender === req.gender;
        const liquidPredicate = ['FLOW', 'ENTER', 'EXIT', 'RISE', 'FILL'].includes(req.predicate), coldPredicate = ['ACCUMULATE', 'COVER', 'FREEZE'].includes(req.predicate);
        const predicateFit = eventRef ? true : req.role === 'OBJECT' ? (['FILL', 'ENTER'].includes(req.predicate) && entity!.semanticTags.includes('container') || req.predicate === 'STORE' && entity!.semanticTags.includes('liquid')) : liquidPredicate && entity!.semanticTags.includes('liquid') || req.predicate === 'STORE' && entity!.semanticTags.includes('container') || coldPredicate && entity!.semanticTags.includes('vehicle');
        const entityDomain = event?.domain ?? (entity!.semanticTags.includes('vehicle') ? 'VEHICLE_STATE' : entity!.semanticTags.includes('liquid') || entity!.semanticTags.includes('container') || entity!.semanticTags.includes('path') ? 'LIQUID_PROCESS' : entity!.semanticTags.includes('scientific_crowd') || entity!.semanticTags.includes('scientific_equipment') ? 'SCIENTIFIC_ACTIVITY' : 'UNKNOWN');
        const previousSubject = events.at(-1)?.subjectEntityIds.includes(value.id) ?? false, continuity = events.slice(-3).some(e => e.subjectEntityIds.includes(value.id));
        const distance = Math.max(0, req.order - (event ? Number(event.unitId.replace('unit_', '')) - 1 : entityLastOrder.get(value.id) ?? 0));
        const textualDestination = !eventRef && events.slice(-8).some(e => e.destinationEntityIds.includes(value.id)), textualSource = !eventRef && events.slice(-8).some(e => e.sourceEntityIds.includes(value.id));
        const head = descriptor.split(' ').at(-1), headMatch = eventRef || isVehicle || isObject || isPlace || entity && normalize(entity.sourceSpan.text).split(' ')[0] === head;
        const breakdown = { base: w.base, type: typeOk ? w.type : -1000, gender: genderOk ? (req.gender === 'UNKNOWN' ? 0 : w.gender) : -1000, number: numberOk ? w.number : -1000, predicate: predicateFit ? w.predicate : 0, recency: Math.max(0, w.recency - distance), currentSegment: entityDomain === req.domain ? w.currentSegment : entityDomain !== 'UNKNOWN' && req.domain !== 'EDITORIAL' ? w.segmentBoundary : 0, descriptor: descriptor && typeOk && headMatch ? w.descriptor : 0, destinationRole: descriptor && isContainer && textualDestination ? w.destinationRole : 0, sourceConflict: descriptor && isContainer && textualSource && !textualDestination ? w.sourceConflict : 0, subjectRole: req.role === 'SUBJECT' && previousSubject ? w.subjectRole : 0, continuity: continuity ? w.continuity : 0, competition: raw.length > 1 ? w.competition : 0 };
        return { id: value.id, kind: eventRef ? 'EVENT' as const : 'ENTITY' as const, compatible: Boolean(typeOk && numberOk && genderOk), score: Object.values(breakdown).reduce((a, b) => a + b, 0), semanticScore: breakdown.type + breakdown.gender + breakdown.number + breakdown.predicate + breakdown.currentSegment + breakdown.descriptor + breakdown.destinationRole + breakdown.sourceConflict, breakdown };
    }).sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const valid = candidates.filter(c => c.compatible), best = valid[0], second = valid[1], margin = best && second ? best.score - second.score : null;
    // Recency/salience alone never resolve equivalent entities or events.
    const enoughMargin = !second || best!.score - second.score >= w.margin && best!.semanticScore - second.semanticScore >= w.margin;
    const selected = best && best.score >= w.minScore && enoughMargin ? best : null;
    return { id: req.id, mentionId: req.mentionId, clauseId: req.clauseId, kind: req.kind, role: req.role, sourceSpan: req.sourceSpan, candidateEntityIds: eventRef ? [] : stableIds(candidates.filter(c => c.compatible).map(c => c.id)), candidateEventIds: eventRef ? stableIds(candidates.filter(c => c.compatible).map(c => c.id)) : [], candidates, selectedEntityId: !eventRef ? selected?.id ?? null : null, selectedEventId: eventRef ? selected?.id ?? null : null, confidence: selected ? (selected.score >= 90 ? 'HIGH' : 'MEDIUM') : valid.length > 1 ? 'AMBIGUOUS' : 'LOW', reason: selected ? 'Explicit compatibility and discriminating semantic evidence exceed score/margin gates' : valid.length > 1 ? 'Competing candidates remain equivalent or too close; recency is insufficient' : 'No sufficiently supported antecedent', margin, requiredMargin: w.margin };
}
