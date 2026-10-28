import type { SemanticUnit, SemanticEntity, Mention, Predicate, NormalizedQuantity, SemanticRelation } from './contracts';
import { normalizedView, normalize, sourceSpan, stableIds } from './normalize';
import { causalMarkers, temporalMarkers } from './rules';
export function relations(script: string, units: SemanticUnit[], entities: SemanticEntity[], mentions: Mention[], predicates: Predicate[], quantities: NormalizedQuantity[]): SemanticRelation[] {
    const out: SemanticRelation[] = [];
    function add(unitId: string, type: SemanticRelation['type'], subject: string | null, object: string | null, ps: Predicate[], qs: NormalizedQuantity[], span: SemanticRelation['sourceSpan'], details: SemanticRelation['details'] = {}, confidence: SemanticRelation['confidence'] = 'HIGH') {
        const evidence = [span, ...ps.map(p => p.sourceSpan)];
        const row: SemanticRelation = { id: 'L' + (out.length + 1), unitId, type, subjectEntityId: subject, objectEntityId: object, predicateIds: ps.map(p => p.id), quantityIds: qs.map(q => q.id), details, sourceSpan: span, sourceEvidence: evidence, confidence };
        out.push(row);
        return row;
    }
    for (const u of units) {
        const ps = predicates.filter(p => p.unitId === u.id), ms = mentions.filter(m => m.unitId === u.id && m.entityId), qs = quantities.filter(q => q.unitId === u.id), view = normalizedView(u.sourceSpan.text, u.sourceSpan.start);
        for (const p of ps) {
            if (p.subjectEntityId)
                add(u.id, 'SUBJECT_ACTION', p.subjectEntityId, null, [p], [], p.sourceSpan, { predicate: p.name, negated: p.negated, modality: p.modality, interrogative: p.interrogative });
            for (const id of p.objectEntityIds)
                add(u.id, 'ACTION_OBJECT', p.subjectEntityId, id, [p], [], p.sourceSpan);
            if (p.name === 'CONNECT' && p.objectEntityIds.length)
                add(u.id, 'CONNECTED_TO', p.subjectEntityId, p.objectEntityIds[0], [p], [], p.sourceSpan);
            if (['ACCUMULATE', 'FREEZE', 'COVER', 'MELT', 'OPEN', 'CLOSE', 'STORE', 'BECOME'].includes(p.name))
                add(u.id, p.name === 'STORE' ? 'STATE' : 'STATE_CHANGE', p.subjectEntityId, p.objectEntityIds[0] ?? null, [p], [], p.sourceSpan, { state: p.name === 'COVER' ? 'COVERED' : p.name === 'FREEZE' ? 'FROZEN' : p.name === 'STORE' ? 'STORED' : p.name, negated: p.negated, modality: p.modality });
        }
        for (const mention of ms) {
            const e = entities.find(e => e.id === mention.entityId)!, prefix = normalize(script.slice(Math.max(u.sourceSpan.start, mention.sourceSpan.start - 28), mention.sourceSpan.start));
            const primary = ps.find(p => p.subjectEntityId && p.subjectEntityId !== e.id) ?? ps[0];
            if (!primary)
                continue;
            if (e.semanticTags.includes('container') && /\b(?:do|da)\s+(?:o\s+|a\s+)?$/.test(prefix) && ps.some(p => p.name === 'EXIT'))
                add(u.id, 'SOURCE', primary.subjectEntityId, e.id, ps.filter(p => p.name === 'EXIT'), [], mention.sourceSpan);
            if (e.semanticTags.includes('path') && (/\b(?:por|pelo|pela)\s+(?:um[ao]?\s+)?$/.test(prefix) || ps.some(p => p.name === 'FLOW')))
                add(u.id, 'PATH', primary.subjectEntityId, e.id, ps.filter(p => ['FLOW', 'RISE', 'ENTER'].includes(p.name)), [], mention.sourceSpan);
            if (e.semanticTags.includes('container') && /\bate\s+(?:o|a|um|uma)\s+$/.test(prefix))
                add(u.id, 'DESTINATION', primary.subjectEntityId, e.id, ps.filter(p => ['FLOW', 'RISE', 'ENTER'].includes(p.name)), [], mention.sourceSpan);
            if (/\b(?:no|na|em|dentro de uma|dentro da|dentro do)\s+(?:um[ao]?\s+)?$/.test(prefix))
                add(u.id, 'LOCATION', primary.subjectEntityId, e.id, [primary], [], mention.sourceSpan);
            if (e.semanticTags.includes('container') && /dentro/.test(prefix) && ms.some(m => entities.find(e => e.id === m.entityId)?.semanticTags.includes('level')))
                add(u.id, 'PART_OF', ms.find(m => entities.find(e => e.id === m.entityId)?.semanticTags.includes('level'))!.entityId, e.id, [primary], [], mention.sourceSpan);
        }
        if (qs.length) {
            const measurement = ms.find(m => entities.find(e => e.id === m.entityId)?.type === 'MEASUREMENT')?.entityId ?? ps[0]?.subjectEntityId ?? null;
            for (const q of qs)
                add(u.id, 'QUANTITY', measurement, null, ps.filter(p => ['MEASURE', 'DECREASE', 'INCREASE'].includes(p.name)), [q], q.sourceSpan, { value: q.value, unit: q.unit, dimension: q.dimension });
            const transition = ps.find(p => ['DECREASE', 'INCREASE'].includes(p.name));
            if (transition && qs.length >= 2 && /\bde\b[\s\S]*\bpara\b/.test(view.text)) {
                const [initial, final] = qs;
                const direction = final.value < initial.value ? 'DECREASE' : final.value > initial.value ? 'INCREASE' : 'UNCHANGED';
                add(u.id, 'STATE_CHANGE', measurement, null, [transition], [initial, final], u.sourceSpan, { initial: initial.value, final: final.value, direction, statedPredicate: transition.name, dimension: initial.dimension }, initial.dimension === final.dimension ? 'HIGH' : 'LOW');
            }
        }
        const comparison = ps.find(p => p.name === 'COMPARE');
        if (comparison) {
            const left = ms.find(m => m.sourceSpan.start < comparison.sourceSpan.start), right = ms.find(m => m.sourceSpan.start > comparison.sourceSpan.end);
            const operator = /mais fri/.test(normalize(comparison.sourceSpan.text)) ? 'COLDER_THAN' : /maior/.test(normalize(comparison.sourceSpan.text)) ? 'GREATER_THAN' : /menor/.test(normalize(comparison.sourceSpan.text)) ? 'LESS_THAN' : /mais rapid/.test(normalize(comparison.sourceSpan.text)) ? 'FASTER_THAN' : /metade/.test(normalize(comparison.sourceSpan.text)) ? 'HALF' : /dobro|duas vezes/.test(normalize(comparison.sourceSpan.text)) ? 'DOUBLE' : /triplo/.test(normalize(comparison.sourceSpan.text)) ? 'TRIPLE' : 'COMPARE';
            add(u.id, 'COMPARISON', left?.entityId ?? null, right?.entityId ?? null, [comparison], qs, u.sourceSpan, { operator, difference: qs[0]?.value ?? null, absoluteValuesInferred: false }, left && right ? 'HIGH' : 'MEDIUM');
        }
        const causal = [...view.text.matchAll(new RegExp('\\b(?:' + causalMarkers + ')\\b', 'gu'))];
        for (const marker of causal) {
            const markerSpan = view.span(marker.index!, marker.index! + marker[0].length), before = ps.filter(p => p.sourceSpan.end <= markerSpan.start).at(-1) ?? predicates.filter(p => p.sourceSpan.end <= u.sourceSpan.start && units.find(x => x.id === p.unitId)!.order === u.order - 1).filter(p => p.name !== 'IS').at(-1), after = ps.find(p => p.sourceSpan.start >= markerSpan.end && p.name !== 'IS');
            if (before && after)
                add(u.id, 'CAUSE_EFFECT', before.subjectEntityId, after.subjectEntityId, [before, after], [], markerSpan, { marker: markerSpan.text, causePredicateId: before.id, effectPredicateId: after.id }, before.subjectEntityId && after.subjectEntityId && !before.negated && !after.negated && before.modality === 'ASSERTED' && after.modality === 'ASSERTED' ? 'HIGH' : 'MEDIUM');
        }
        for (const marker of view.text.matchAll(new RegExp('\\b(?:' + temporalMarkers + ')\\b', 'gu'))) {
            // Onset/overlap/spatial-until do not establish before/after by themselves.
            if (!['antes', 'depois', 'em seguida', 'entao'].includes(marker[0]))
                continue;
            const span = view.span(marker.index!, marker.index! + marker[0].length);
            if (marker[0] === 'ate' && !ps.some(p => p.sourceSpan.start > span.end))
                continue;
            const previous = predicates.filter(p => p.sourceSpan.end < span.start && p.name !== 'IS').at(-1), next = ps.find(p => p.sourceSpan.start >= span.end && p.name !== 'IS');
            if (previous && next)
                add(u.id, marker[0] === 'antes' ? 'TEMPORAL_BEFORE' : 'TEMPORAL_AFTER', previous.subjectEntityId, next.subjectEntityId, [previous, next], [], span, { marker: span.text, notAutomaticallyCausal: true }, 'MEDIUM');
        }
        // Explicit containment links liquid and container in storage clauses.
        const stored = ps.find(p => p.name === 'STORE');
        if (stored) {
            const container = ms.find(m => entities.find(e => e.id === m.entityId)?.semanticTags.includes('container'));
            if (container)
                add(u.id, 'CONTAINS', container.entityId, stored.subjectEntityId, [stored], [], u.sourceSpan);
        }
    }
    return out;
}
