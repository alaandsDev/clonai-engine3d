import type { SemanticClaim, SemanticUnit, SemanticEntity, Predicate, Reference, NormalizedQuantity, SemanticRelation, Ambiguity } from './contracts';
import { normalize, stableIds } from './normalize';
import { confidence } from './confidence';
import { jsonHash } from '../editorial/fingerprint';
import { modalityOf } from './predicates';
export function extractClaims(units: SemanticUnit[], entities: SemanticEntity[], predicates: Predicate[], references: Reference[], quantities: NormalizedQuantity[], relations: SemanticRelation[], ambiguities: Ambiguity[]): SemanticClaim[] {
    const claims: SemanticClaim[] = [];
    for (const u of units) {
        const ps = predicates.filter(p => p.unitId === u.id), qs = quantities.filter(q => q.unitId === u.id), rs = relations.filter(r => r.unitId === u.id), text = u.sourceSpan.text.trim(), folded = normalize(text);
        const editorial = /magicamente|parece simples/.test(folded), interrogative = text.includes('?');
        let chosen = ps.filter(p => p.name !== 'IS');
        if (/^(quando|conforme)\b/.test(folded) && chosen.length > 1)
            chosen = [chosen.at(-1)!];
        if (!chosen.length)
            chosen = ps.slice(-1);
        const specs: {
            type: SemanticClaim['type'];
            ps: Predicate[];
            qs: NormalizedQuantity[];
            relations: SemanticRelation[];
            proof: boolean;
        }[] = [];
        if (editorial || interrogative)
            specs.push({ type: interrogative ? 'QUESTION' : 'CONCLUSION', ps: chosen, qs, relations: rs, proof: false });
        else if (qs.length) {
            const change = rs.find(r => r.type === 'STATE_CHANGE' && r.quantityIds.length >= 2);
            if (change)
                specs.push({ type: 'QUANTITY_CHANGE', ps: chosen, qs: qs.filter(q => change.quantityIds.includes(q.id)), relations: [change], proof: true });
            else {
                const comparison = rs.find(r => r.type === 'COMPARISON');
                if (comparison) {
                    specs.push({ type: 'COMPARISON', ps: ps.filter(p => p.name === 'COMPARE'), qs, relations: [comparison], proof: true });
                }
                const temperatures = qs.filter(q => q.dimension === 'TEMPERATURE');
                if (temperatures.length && !comparison)
                    specs.push({ type: 'TEMPERATURE', ps: chosen, qs: temperatures, relations: rs.filter(r => r.quantityIds.some(id => temperatures.some(q => q.id === id))), proof: true });
                for (const q of qs.filter(q => q.dimension === 'RANK' || !temperatures.length && !comparison))
                    specs.push({ type: q.dimension === 'RANK' ? 'RANKING' : 'NUMBER', ps: chosen, qs: [q], relations: rs.filter(r => r.quantityIds.includes(q.id)), proof: true });
            }
        }
        else
            for (const pred of chosen) {
                const type: SemanticClaim['type'] = pred.name === 'INCREASE' || pred.name === 'DECREASE' ? 'QUANTITY_CHANGE' : pred.name === 'RISE' ? 'SPATIAL_RELATION' : ['ACCUMULATE', 'FREEZE', 'MELT', 'COVER', 'STORE', 'OPEN', 'CLOSE', 'BECOME', 'IS'].includes(pred.name) ? 'OBJECT_STATE' : pred.name === 'COMPARE' ? 'COMPARISON' : 'PROCESS';
                const contextState = pred.name === 'IS' && entities.find(e => e.id === pred.subjectEntityId)?.semanticTags.includes('vehicle') && /estacionad|expost|normal|horas/.test(folded);
                specs.push({ type, ps: [pred], qs: [], relations: rs.filter(r => r.predicateIds.includes(pred.id) || r.type === 'PART_OF' && r.subjectEntityId === pred.subjectEntityId), proof: !contextState });
            }
        if (!specs.length)
            specs.push({ type: 'CONCLUSION', ps: [], qs: [], relations: rs, proof: true });
        for (const spec of specs) {
            const primary = spec.ps[0], subject = primary ? primary.subjectEntityId : rs.find(r => r.subjectEntityId)?.subjectEntityId ?? null;
            const referenceIds = stableIds(spec.ps.flatMap(p => p.referenceIds)), refs = references.filter(r => referenceIds.includes(r.id)), ambiguityIds = stableIds([...spec.ps.flatMap(p => p.ambiguityIds), ...ambiguities.filter(a => a.unitId === u.id && a.critical).map(a => a.id)]);
            if ((!primary || primary.name==='UNKNOWN') && !spec.qs.length && !editorial && !interrogative) {
                const a: Ambiguity = { id: 'A' + (ambiguities.length + 1), unitId: u.id, type: 'UNSUPPORTED_PREDICATE', sourceSpan: u.sourceSpan, reason: 'No supported predicate; source retained without inventing a proposition', referenceIds, critical: true };
                ambiguities.push(a);
                ambiguityIds.push(a.id);
            }
            const unresolved = !subject && spec.proof && !spec.qs.length, ambiguous = ambiguityIds.length > 0 || refs.some(r => !r.selectedEntityId);
            const conf = confidence(spec.ps, refs, spec.qs, subject, ambiguous);
            const negated = spec.ps.length ? spec.ps.some(p => p.negated) : /\b(?:nao|nunca|jamais|nem)\b/.test(folded), modality = spec.ps.find(p => p.modality !== 'ASSERTED')?.modality ?? modalityOf(text);
            const evidence = [u.sourceSpan, ...spec.ps.map(p => p.sourceSpan), ...spec.qs.map(q => q.sourceSpan), ...spec.relations.flatMap(r => r.sourceEvidence)];
            const entityIds = stableIds([subject, ...spec.ps.flatMap(p => p.objectEntityIds), ...spec.relations.flatMap(r => [r.subjectEntityId, r.objectEntityId])].filter((x): x is string => Boolean(x)));
            const c: SemanticClaim = { id: 'C' + (claims.length + 1), unitId: u.id, text, type: spec.type, predicate: primary?.name ?? 'UNKNOWN', predicateIds: spec.ps.map(p => p.id), subjectEntityId: subject, entityIds, relationIds: spec.relations.map(r => r.id), referenceIds, ambiguityIds, sourceSpan: u.sourceSpan, sourceEvidence: dedupEvidence(evidence), extractionSource: 'SEMANTIC_ENGINE', confidence: editorial && !ambiguous ? 'HIGH' : conf.level, confidenceScore: conf.score, confidenceBreakdown: conf.breakdown, negated, modality, interrogative, status: ambiguous ? 'AMBIGUOUS' : unresolved ? 'UNRESOLVED' : 'RESOLVED', importance: spec.proof ? 'PRIMARY' : 'SUPPORTING', requiresVisualProof: spec.proof, stateTransition: ['ACCUMULATE', 'FREEZE', 'COVER'].includes(primary?.name ?? '') ? { initial: null, process: primary?.name === 'ACCUMULATE' ? (primary.objectEntityIds.some(id => entities.find(e => e.id === id)?.semanticTags.includes('ice')) ? 'ACCUMULATE ICE' : 'ACCUMULATE') : null, final: primary?.name === 'COVER' ? 'COVERED' : primary?.name === 'FREEZE' ? 'FROZEN' : null } : null, quantityIds: spec.qs.map(q => q.id), executionUnitIds: [u.id], previousClaimIds: [], nextClaimIds: [], sharedEntityIds: [], canonicalFingerprint: '' };
            claims.push(c);
        }
        // Causality is an additional proposition only when an explicit marker bound two textual events.
        for (const rel of rs.filter(r => r.type === 'CAUSE_EFFECT')) {
            const eventClaims = claims.filter(c => c.predicateIds.some(id => rel.predicateIds.includes(id))), base = eventClaims.at(-1);
            if (!base)
                continue;
            const c: SemanticClaim = { ...structuredClone(base), id: 'C' + (claims.length + 1), unitId: u.id, text, type: 'CAUSE_EFFECT', entityIds:stableIds([...base.entityIds,rel.subjectEntityId,rel.objectEntityId].filter((id):id is string=>Boolean(id))), relationIds: [rel.id], predicate: 'CAUSE', predicateIds: rel.predicateIds, sourceEvidence: dedupEvidence([u.sourceSpan,...units.filter(unit=>predicates.some(p=>rel.predicateIds.includes(p.id)&&p.unitId===unit.id)).map(unit=>unit.sourceSpan), ...rel.sourceEvidence]), confidence: base.status === 'RESOLVED' ? rel.confidence : 'LOW', confidenceScore: base.status === 'RESOLVED' ? (rel.confidence === 'HIGH' ? .85 : .6) : .25, confidenceBreakdown: { textualEvidence: .2, explicitMarker: .35, linkedTextualEvents: base.status !== 'RESOLVED' || rel.confidence === 'HIGH' ? .3 : .05, ambiguityPenalty: base.status !== 'RESOLVED' ? -.6 : 0 }, executionUnitIds: [u.id], stateTransition: null, canonicalFingerprint: '' };
            claims.push(c);
        }
    }
    // Join explicit accumulation and covered-state evidence for the same entity, not just adjacent words.
    for (const c of claims.filter(c => c.predicate === 'COVER' && c.subjectEntityId && !c.negated && c.modality === 'ASSERTED')) {
        const prior = claims.filter(a => a.subjectEntityId === c.subjectEntityId && a.predicate === 'ACCUMULATE' && !a.negated && a.modality === 'ASSERTED' && units.find(u => u.id === a.unitId)!.order < units.find(u => u.id === c.unitId)!.order && units.find(u => u.id === c.unitId)!.order - units.find(u => u.id === a.unitId)!.order <= 3).at(-1);
        if (prior) {
            const interval = units.filter(u => u.order >= units.find(u => u.id === prior.unitId)!.order && u.order <= units.find(u => u.id === c.unitId)!.order).map(u => u.id);
            const previousState = claims.filter(a => a.subjectEntityId === c.subjectEntityId && a.predicate === 'IS' && a.sourceSpan.start < prior.sourceSpan.start).at(-1);
            const initial = previousState && /\bnormal\b/.test(normalize(previousState.text)) ? 'NORMAL' : previousState && /expost/.test(normalize(previousState.text)) ? 'EXPOSED' : null;
            for (const member of [prior, c]) {
                member.stateTransition = { initial, process: prior.stateTransition?.process ?? 'ACCUMULATE', final: 'COVERED' };
                member.executionUnitIds = interval;
                member.sourceEvidence = dedupEvidence([...prior.sourceEvidence, ...c.sourceEvidence]);
            }
        }
    }
    const deduped: SemanticClaim[] = [];
    for (const c of claims) {
        const key = jsonHash({ stateDescription: c.predicate === 'IS' ? normalize(c.text) : null, entities: c.entityIds, relationSemantics: c.relationIds.map(id => { const r = relations.find(r => r.id === id)!; return { type: r.type, subject: r.subjectEntityId, object: r.objectEntityId, details: r.details }; }), type: c.type, subject: c.subjectEntityId, predicate: c.predicate, quantities: c.quantityIds.map(id => { const q = quantities.find(q => q.id === id)!; return [q.value, q.unit, q.dimension]; }), negated: c.negated, modality: c.modality, question: c.interrogative, transition: c.stateTransition });
        const prior = deduped.at(-1);
        const intervening = prior && claims.some(x => x.sourceSpan.start > prior.sourceSpan.end && x.sourceSpan.start < c.sourceSpan.start && x.subjectEntityId === c.subjectEntityId && x.predicate !== c.predicate);
        if (prior && (prior as SemanticClaim & {
            dedupKey?: string;
        }).dedupKey === key && !intervening && c.status === 'RESOLVED' && prior.status === 'RESOLVED') {
            prior.sourceEvidence = dedupEvidence([...prior.sourceEvidence, ...c.sourceEvidence]);
            prior.executionUnitIds = stableIds([...prior.executionUnitIds, ...c.executionUnitIds]);
            prior.referenceIds = stableIds([...prior.referenceIds, ...c.referenceIds]);
            prior.relationIds = stableIds([...prior.relationIds, ...c.relationIds]);
        }
        else {
            Object.assign(c, { dedupKey: key });
            deduped.push(c);
        }
    }
    const lastByEntity = new Map<string, SemanticClaim>();
    for (const c of deduped) {
        delete (c as SemanticClaim & {
            dedupKey?: string;
        }).dedupKey;
        const previous = stableIds(c.entityIds.map(id => lastByEntity.get(id)?.id).filter((v): v is string => Boolean(v)));
        c.previousClaimIds = previous;
        for (const id of previous) {
            const before = deduped.find(x => x.id === id)!;
            before.nextClaimIds.push(c.id);
            c.sharedEntityIds.push(...c.entityIds.filter(e => before.entityIds.includes(e)));
        }
        c.sharedEntityIds = stableIds(c.sharedEntityIds);
        for (const id of c.entityIds)
            lastByEntity.set(id, c);
        c.canonicalFingerprint = jsonHash({ type: c.type, entities: c.entityIds, predicate: c.predicate, quantities: c.quantityIds.map(id => quantities.find(q => q.id === id)!), relations: c.relationIds.map(id => relations.find(r => r.id === id)!), negated: c.negated, modality: c.modality, sourceEvidence: c.sourceEvidence });
    }
    return deduped;
}
function dedupEvidence(spans: SemanticClaim['sourceEvidence']) { return [...new Map(spans.map(s => [s.start + ':' + s.end, s])).values()].sort((a, b) => a.start - b.start || a.end - b.end); }
