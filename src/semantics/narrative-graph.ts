import type { SemanticInput, SemanticAnalysis, SemanticEntity, Mention, Predicate, SourceSpan, Ambiguity } from './contracts';
import type { SemanticNarrativeGraph, NarrativeClause, NarrativeReference, SemanticEvent, Domain, EntityAlias } from './narrative-contracts';
import { NATURAL_SEMANTIC_VERSION, GRAPH_VERSION } from './narrative-contracts';
import { parseSemantics } from './extractor';
import { extraPredicates, naturalLexicon } from './natural-lexicon';
import { splitClauses, clauseRules } from './clauses';
import { resolveReference, referenceScoring } from './references-v2';
import { normalize, normalizedView, sourceSpan, stableIds } from './normalize';
import { modalityOf } from './predicates';
import { relations as parseRelations } from './relations';
import { claimsFromEvents } from './narrative-claims';
import { narrativeSegments, claimDependencies } from './narrative-segments';
import { jsonHash } from '../editorial/fingerprint';
import { semanticQa } from './qa';
import { validateNarrativeGraph } from './narrative-qa';
import { entityRules, predicateRules } from './rules';
import { quantityRules } from './quantities';
export const domainOf = (e: SemanticEntity | undefined): Domain => !e ? 'UNKNOWN' : e.semanticTags.includes('vehicle') ? 'VEHICLE_STATE' : e.semanticTags.includes('liquid') || e.semanticTags.includes('container') || e.semanticTags.includes('path') || e.semanticTags.includes('level') ? 'LIQUID_PROCESS' : e.semanticTags.includes('temperature') ? 'MEASUREMENT' : e.semanticTags.includes('scientific_crowd') || e.semanticTags.includes('scientific_equipment') ? 'SCIENTIFIC_ACTIVITY' : 'UNKNOWN';
export function analyzeNaturalScript(input: SemanticInput): SemanticNarrativeGraph {
    const raw = parseSemantics(input), entities = structuredClone(raw.entities);
    const lexical = [...raw.predicates.map(p => ({ id: p.id, unitId: p.unitId, name: p.name as string, sourceSpan: p.sourceSpan })), ...raw.narrativeUnits.flatMap(u => extraPredicates(u.sourceSpan.text, u.sourceSpan.start, u.id, raw.predicates).map(p => ({ id: '', unitId: p.unitId, name: p.name as string, sourceSpan: p.sourceSpan })))].filter(p => !(p.name === 'IS' && normalize(p.sourceSpan.text) === 'esta' && p.sourceSpan.text !== 'está') && !(p.name === 'COVER' && /estado\s+$/.test(normalize(input.script.slice(Math.max(0, p.sourceSpan.start - 20), p.sourceSpan.start))))).sort((a, b) => a.sourceSpan.start - b.sourceSpan.start || b.sourceSpan.end - a.sourceSpan.end);
    lexical.forEach((p, i) => p.id = 'NP' + (i + 1));
    const clauses = splitClauses(input.script, raw.narrativeUnits, lexical), mentions: Mention[] = raw.mentions.filter(m => m.kind !== 'ELLIPSIS').map(m => ({ ...structuredClone(m), entityId: m.kind === 'NOUN' ? m.entityId : null })), references: NarrativeReference[] = [], events: SemanticEvent[] = [], aliases: EntityAlias[] = [], ambiguities: Ambiguity[] = [];
    let mentionCounter = mentions.length;
    const newMentionId = () => 'NM' + (++mentionCounter);
    const activeEntities = () => entities.filter(e => mentions.some(m => m.kind === 'NOUN' && m.entityId === e.id) || events.some(v => [...v.subjectEntityIds, ...v.objectEntityIds].includes(e.id)));
    const entityLastOrder = new Map<string, number>();
    let currentDomain: Domain = 'UNKNOWN';
    const addAmbiguity = (cl: NarrativeClause, span: SourceSpan, ref: NarrativeReference | null, reason: string) => { const a: Ambiguity = { id: 'NA' + (ambiguities.length + 1), unitId: cl.unitId, type: ref?.confidence === 'AMBIGUOUS' ? 'AMBIGUOUS_REFERENCE' : 'INSUFFICIENT_CONTEXT', sourceSpan: span, reason, referenceIds: ref?.kind !== 'EVENT_REFERENCE' && ref ? [ref.id] : [], critical: true }; ambiguities.push(a); return a.id; };
    for (const clause of clauses) {
        const view = normalizedView(clause.sourceSpan.text, clause.sourceSpan.start), unitOrder = raw.narrativeUnits.find(u => u.id === clause.unitId)!.order;
        let ps = lexical.filter(p => clause.predicateIds.includes(p.id));
        if (ps.some(p => p.name !== 'IS'))
            ps = ps.filter(p => p.name !== 'IS');
        let ms = mentions.filter(m => m.sourceSpan.start >= clause.sourceSpan.start && m.sourceSpan.end <= clause.sourceSpan.end);
        // Typed event descriptions are not entity mentions.
        for (const m of view.text.matchAll(/\b(?:esse|essa|este|esta|o mesmo|o anterior|o)\s+(?:processo|mudanca|aumento|queda|trabalho|acumulo)|\b(?:esse|essa|o mesmo|o anterior)\b/gu)) {
            const span = view.span(m.index!, m.index! + m[0].length);
            if (!/processo|mudanca|aumento|queda|trabalho|acumulo/.test(m[0]) && m[0] !== 'o mesmo' && m[0] !== 'o anterior')
                continue;
            const old = ms.filter(x => x.sourceSpan.start < span.end && span.start < x.sourceSpan.end);
            for (const x of old) {
                mentions.splice(mentions.indexOf(x), 1);
                ms.splice(ms.indexOf(x), 1);
            }
            const mention: Mention = { id: newMentionId(), unitId: clause.unitId, entityId: null, kind: 'PRONOUN', sourceSpan: span, role: 'SUBJECT' };
            mentions.push(mention);
            ms.push(mention);
        }
        for (const m of view.text.matchAll(/\b(?:esse|essa|este|esta|aquele|aquela|o mesmo|o anterior)\s+(?:objeto|veiculo|local|recipiente)\b/gu)) {
            const span = view.span(m.index!, m.index! + m[0].length);
            for (const old of ms.filter(x => x.sourceSpan.start < span.end && span.start < x.sourceSpan.end)) {
                mentions.splice(mentions.indexOf(old), 1);
                ms.splice(ms.indexOf(old), 1);
            }
            const mention: Mention = { id: newMentionId(), unitId: clause.unitId, entityId: null, kind: 'DESCRIPTIVE', sourceSpan: span, role: 'SUBJECT' };
            mentions.push(mention);
            ms.push(mention);
        }
        for (const m of view.text.matchAll(/(?:\be\s+|^)([oa]s?)\s+(?=preenche|preencher|armazena|guarda)|-(l[oa]s?)\b/gu)) {
            const token = m[1] ?? m[2], local = m.index! + m[0].lastIndexOf(token), span = view.span(local, local + token.length);
            if (ms.some(x => x.sourceSpan.start === span.start))
                continue;
            const mention: Mention = { id: newMentionId(), unitId: clause.unitId, entityId: null, kind: 'PRONOUN', sourceSpan: span, role: 'OBJECT' };
            mentions.push(mention);
            ms.push(mention);
        }
        const explicit = ms.filter(m => m.entityId && m.kind === 'NOUN'), subjectNouns = explicit.filter(m => {
            const before = normalize(input.script.slice(clause.sourceSpan.start, m.sourceSpan.start)), first = ps[0]?.sourceSpan.start ?? clause.sourceSpan.end;
            return m.sourceSpan.start < first && !/\b(?:de|do|da|em|no|na|por|pelo|pela|com|durante|ate|para)\s+(?:o|a|um|uma)?\s*$/.test(before) && entities.find(e => e.id === m.entityId)?.type !== 'ENVIRONMENT' && entities.find(e => e.id === m.entityId)?.type !== 'NUMBER';
        });
        const explicitSubject = subjectNouns[0]?.entityId ?? null;
        const explicitDomain = domainOf(entities.find(e => e.id === explicitSubject));
        const predicted: Domain = ps.some(p => ['FLOW', 'RISE', 'ENTER', 'EXIT', 'FILL'].includes(p.name)) ? 'LIQUID_PROCESS' : ps.some(p => ['ACCUMULATE', 'COVER'].includes(p.name)) ? 'VEHICLE_STATE' : currentDomain;
        const domain: Domain = explicitDomain !== 'UNKNOWN' ? explicitDomain : predicted;
        const clauseRefs: NarrativeReference[] = [];
        for (const m of ms.filter(m => m.kind !== 'NOUN')) {
            const text = normalize(m.sourceSpan.text), eventRef = /processo|mudanca|aumento|queda|trabalho|acumulo/.test(text)||/^(?:isso|isto)$/.test(text)&&/^\s+(?:nao significa|nao quer dizer)/.test(normalize(input.script.slice(m.sourceSpan.end,clause.sourceSpan.end))), descriptor = /veiculo|objeto|local|recipiente|reservatorio|caixa|mesmo|anterior/.test(text) ? text : eventRef ? text : null;
            if (text === 'isso' && /\bpor\s+$/.test(normalize(input.script.slice(clause.sourceSpan.start, m.sourceSpan.start))))
                continue;
            const kind = eventRef ? 'EVENT_REFERENCE' : m.role === 'OBJECT' && /^(?:o|a|os|as|lo|la|los|las)$/.test(text) ? 'OBJECT_REFERENCE' : 'ENTITY_REFERENCE';
            const ref = resolveReference({ id: 'NR' + (references.length + 1), mentionId: m.id, clauseId: clause.id, sourceSpan: m.sourceSpan, kind, gender: /^(?:ela|elas|essa|esta|a|as|la|las)/.test(text) ? 'F' : /^(?:ele|eles|esse|este|o|os|lo|los)/.test(text) ? 'M' : 'UNKNOWN', number: /^(?:eles|elas|esses|essas|os|as|los|las)/.test(text) ? 'PLURAL' : 'SINGULAR', descriptor, predicate: ps[0]?.name ?? 'UNKNOWN', domain, order: unitOrder, role: kind === 'OBJECT_REFERENCE' || m.sourceSpan.start >= (ps[0]?.sourceSpan.start ?? clause.sourceSpan.end) ? 'OBJECT' : 'SUBJECT' }, activeEntities(), events, entityLastOrder);
            references.push(ref);
            clauseRefs.push(ref);
            m.entityId = ref.selectedEntityId;
            if (ref.selectedEntityId && m.kind === 'DESCRIPTIVE') {
                const e = entities.find(e => e.id === ref.selectedEntityId)!;
                aliases.push({ id: 'AL' + (aliases.length + 1), entityId: e.id, mentionId: m.id, type: e.semanticTags.includes('vehicle') ? 'LEXICAL_ALIAS' : 'CONTEXTUAL_ALIAS', sourceSpan: m.sourceSpan, reason: ref.reason, confidence: ref.confidence === 'HIGH' ? 'HIGH' : 'MEDIUM' });
            }
        }
        let subject = explicitSubject ?? clauseRefs.find(r => r.role === 'SUBJECT' && (r.selectedEntityId || r.selectedEventId))?.selectedEntityId ?? null;
        const eventReference = clauseRefs.find(r => r.selectedEventId), continued = events.find(e => e.id === eventReference?.selectedEventId);
        if (!subject && continued && continued.subjectEntityIds.length === 1)
            subject = continued.subjectEntityIds[0];
        if (!subject && !clauseRefs.some(r => r.role === 'SUBJECT') && ps.length) {
            const previous = events.filter(e => e.sourceSpan.end <= clause.sourceSpan.start).at(-1), canPropagate = Boolean(previous && (clause.sharesSubjectWith || previous.unitId !== clause.unitId || clause.type === 'MAIN'));
            if (canPropagate) {
                const span = ps[0].sourceSpan, mention: Mention = { id: newMentionId(), unitId: clause.unitId, entityId: null, kind: 'ELLIPSIS', sourceSpan: span, role: 'SUBJECT' };
                mentions.push(mention);
                const ref = resolveReference({ id: 'NR' + (references.length + 1), mentionId: mention.id, clauseId: clause.id, sourceSpan: span, kind: 'ENTITY_REFERENCE', gender: 'UNKNOWN', number: 'SINGULAR', descriptor: null, predicate: ps[0].name, domain, order: unitOrder, role: 'SUBJECT' }, previous?.unitId === clause.unitId ? activeEntities().filter(e => previous.subjectEntityIds.includes(e.id)) : activeEntities(), events, entityLastOrder);
                references.push(ref);
                clauseRefs.push(ref);
                subject = ref.selectedEntityId;
                mention.entityId = subject;
            }
        }
        const objectRefs = clauseRefs.filter(r => r.role === 'OBJECT'), unresolved = clauseRefs.filter(r => !r.selectedEntityId && !r.selectedEventId);
        for (const ref of unresolved)
            addAmbiguity(clause, ref.sourceSpan, ref, ref.reason);
        for (const p of ps) {
            const subjectEntity = entities.find(e => e.id === subject), objects = stableIds([...explicit.filter(m => m.entityId !== subject && m.sourceSpan.start >= p.sourceSpan.end).map(m => m.entityId!), ...objectRefs.map(r => r.selectedEntityId).filter((v): v is string => Boolean(v)), ...(continued?.objectEntityIds ?? [])]).filter(id => id !== subject);
            const containerSubjects = subjectEntity?.semanticTags.includes('container') ?? false;
            let predicate = p.name as SemanticEvent['predicate'];
            if (predicate === 'CONTINUE' && !continued)
                predicate = 'IS';
            if (predicate === 'RISE' && subjectEntity?.semanticTags.includes('level'))
                predicate = 'INCREASE';
            const before = normalize(input.script.slice(clause.sourceSpan.start, p.sourceSpan.start)), negated = /\b(?:nao|nunca|jamais|nem)\b/.test(before), modality = clause.nonAsserted ? 'HYPOTHETICAL' : modalityOf(clause.sourceSpan.text);
            const domainActual = domainOf(subjectEntity) !== 'UNKNOWN' ? domainOf(subjectEntity) : continued?.domain ?? domain;
            const quantities = raw.quantities.filter(q => q.unitId === clause.unitId && q.sourceSpan.start >= clause.sourceSpan.start && q.sourceSpan.end <= clause.sourceSpan.end);
            const ambiguity = unresolved.length > 0 || !subject && predicate !== 'MEASURE', score = Math.max(0, Math.min(1, .2 + (predicate !== 'UNKNOWN' ? .3 : 0) + (subject?.length ? .25 : 0) + (objects.length ? .1 : 0) + (quantities.length ? .15 : 0) + (clauseRefs.some(r => r.confidence === 'HIGH') ? .1 : 0) - (ambiguity ? .6 : 0)));
            let stateAfter: string | null = predicate === 'COVER' ? 'COVERED' : predicate === 'FREEZE' ? 'FROZEN' : predicate === 'STORE' ? 'STORED' : predicate === 'IS' && /\bnormal\b/.test(view.text) ? 'NORMAL' : predicate === 'IS' && /expost/.test(view.text) ? 'EXPOSED' : null;
            const event: SemanticEvent = { id: 'EV' + (events.length + 1), clauseId: clause.id, unitId: clause.unitId, predicate, subjectEntityIds: subject ? [subject] : [], objectEntityIds: objects, locationEntityIds: [], sourceEntityIds: [], destinationEntityIds: [], pathEntityIds: [], quantityIds: quantities.map(q => q.id), stateBefore: null, stateAfter, negated, modality, interrogative: raw.narrativeUnits.find(u => u.id === clause.unitId)!.sourceSpan.text.includes('?') || clause.nonAsserted && !/nao significa|nao quer dizer/.test(normalize(raw.narrativeUnits.find(u => u.id === clause.unitId)!.sourceSpan.text)), sourceSpan: p.sourceSpan, sourceEvidence: continued ? [...continued.sourceEvidence, clause.sourceSpan] : [clause.sourceSpan], confidence: ambiguity ? 'LOW' : score >= .75 ? 'HIGH' : score >= .5 ? 'MEDIUM' : 'LOW', confidenceScore: score, confidenceBreakdown: { textualEvidence: .2, predicate: predicate !== 'UNKNOWN' ? .3 : 0, subject: subject?.length ? .25 : 0, object: objects.length ? .1 : 0, quantity: quantities.length ? .15 : 0, highReference: clauseRefs.some(r => r.confidence === 'HIGH') ? .1 : 0, ambiguity: ambiguity ? -.6 : 0 }, referenceIds: clauseRefs.map(r => r.id), domain: domainActual, continuesEventId: continued?.id ?? null, processIdentity: null };
            for (const m of explicit) {
                const e = entities.find(e => e.id === m.entityId)!;
                const prefix = normalize(input.script.slice(Math.max(clause.sourceSpan.start, m.sourceSpan.start - 30), m.sourceSpan.start));
                if (e.semanticTags.includes('path'))
                    event.pathEntityIds.push(e.id);
                if (e.semanticTags.includes('container') && /\b(?:de|do|da)\s+(?:um|uma|o|a)?\s*$/.test(prefix) && predicate === 'EXIT')
                    event.sourceEntityIds.push(e.id);
                if (e.semanticTags.includes('container') && /\bate\s+(?:o|a|um|uma)\s+$/.test(prefix))
                    event.destinationEntityIds.push(e.id);
                if (e.type === 'PLACE')
                    event.locationEntityIds.push(e.id);
            }
            const previousState = events.filter(e => e.subjectEntityIds.includes(subject ?? '') && e.stateAfter && !e.negated && e.modality === 'ASSERTED' && !e.interrogative && e.confidence !== 'LOW').at(-1);
            if (predicate === 'IS' && /permanece|continua/.test(view.text) && previousState) {
                event.stateBefore = previousState.stateAfter;
                event.stateAfter = previousState.stateAfter;
            }
            if (!subject && !clauseRefs.length && predicate !== 'MEASURE')
                addAmbiguity(clause, p.sourceSpan, null, 'No unambiguous textual subject');
            const previousProcess = events.filter(e => e.domain === event.domain && e.subjectEntityIds.includes(subject ?? '') && !e.interrogative && e.modality === 'ASSERTED' && ['FLOW', 'EXIT', 'ENTER', 'RISE', 'CONTINUE'].includes(e.predicate)).at(-1);
            event.processIdentity = continued?.processIdentity ?? (event.domain === 'LIQUID_PROCESS' && ['FLOW', 'EXIT', 'ENTER', 'RISE', 'CONTINUE'].includes(event.predicate) ? previousProcess?.processIdentity ?? event.id : null);
            events.push(event);
            if (subject)
                entityLastOrder.set(subject, unitOrder);
        }
        for (const m of ms)
            if (m.entityId)
                entityLastOrder.set(m.entityId, unitOrder);
        if (domain !== 'UNKNOWN')
            currentDomain = domain;
    }
    for (const e of entities)
        e.mentionIds = mentions.filter(m => m.entityId === e.id).map(m => m.id);
    const boundPredicates: Predicate[] = events.map(e => ({ id: e.id, unitId: e.unitId, name: e.predicate === 'CONTINUE' ? 'FLOW' : e.predicate, sourceSpan: e.sourceSpan, subjectEntityId: e.subjectEntityIds[0] ?? null, objectEntityIds: e.objectEntityIds, negated: e.negated, modality: e.modality, interrogative: e.interrogative, referenceIds: e.referenceIds.filter(id => references.find(r => r.id === id)?.kind !== 'EVENT_REFERENCE'), ambiguityIds: ambiguities.filter(a => a.unitId === e.unitId && e.sourceEvidence.some(s => a.sourceSpan.start >= s.start && a.sourceSpan.end <= s.end)).map(a => a.id) }));
    const relations = parseRelations(input.script, raw.narrativeUnits, entities, mentions, boundPredicates, raw.quantities);
    // In "effect porque cause", textual order is the reverse of causal direction.
    for (const relation of relations.filter(r => r.type === 'CAUSE_EFFECT' && normalize(String(r.details.marker)) === 'porque')) {
        relation.predicateIds.reverse();
        const first = boundPredicates.find(p => p.id === relation.predicateIds[0])!, last = boundPredicates.find(p => p.id === relation.predicateIds.at(-1))!;
        relation.subjectEntityId = first.subjectEntityId;
        relation.objectEntityId = last.subjectEntityId;
        relation.details.causePredicateId = first.id;
        relation.details.effectPredicateId = last.id;
    }
    const claims = claimsFromEvents(input.script, raw.narrativeUnits, clauses, entities, events, references, relations, raw.quantities, ambiguities);
    const legacyReferences = references.filter(r => r.kind !== 'EVENT_REFERENCE').map(r => ({ id: r.id, mentionId: r.mentionId, candidateEntityIds: r.candidateEntityIds, selectedEntityId: r.selectedEntityId, confidence: r.confidence, reason: r.reason, sourceSpan: r.sourceSpan }));
    const rulesFingerprint = jsonHash({ version: NATURAL_SEMANTIC_VERSION, naturalLexicon, baseLexicon: { entityRules, predicateRules, quantityRules }, clauseRules, referenceScoring });
    const contexts=raw.narrativeUnits.map(u=>{
        const priorEvents=events.filter(e=>e.sourceSpan.start<u.sourceSpan.end),recent=priorEvents.slice(-3),asserted=priorEvents.filter(e=>!e.negated&&e.modality==='ASSERTED'&&!e.interrogative);
        return {unitId:u.id,activeEntities:stableIds(mentions.filter(m=>m.entityId&&m.sourceSpan.start<u.sourceSpan.end).map(m=>m.entityId!)),recentSubjects:stableIds(recent.flatMap(e=>e.subjectEntityIds)),recentObjects:stableIds(recent.flatMap(e=>e.objectEntityIds)),currentPlace:priorEvents.filter(e=>e.locationEntityIds.length).at(-1)?.locationEntityIds[0]??null,currentProcess:asserted.filter(e=>['FLOW','RISE','ENTER','ACCUMULATE'].includes(e.predicate)).at(-1)?.id??null,currentMeasurement:priorEvents.filter(e=>e.domain==='MEASUREMENT').at(-1)?.subjectEntityIds[0]??null,currentComparison:priorEvents.filter(e=>e.predicate==='COMPARE').at(-1)?.id??null,currentRanking:raw.quantities.filter(q=>q.dimension==='RANK'&&q.sourceSpan.start<u.sourceSpan.end).at(-1)?.id??null,pendingReferences:legacyReferences.filter(r=>r.sourceSpan.start<u.sourceSpan.end&&!r.selectedEntityId).map(r=>r.id)};
    });
    const analysisRaw: Omit<SemanticAnalysis, 'fingerprint'> = { ...raw, contexts, version: 1, id: input.id, engineVersion: NATURAL_SEMANTIC_VERSION, script: input.script, scriptFingerprint: jsonHash(input.script), language: input.language, entities, mentions, references: legacyReferences, predicates: boundPredicates, relations, claims, ambiguities, unresolvedReferences: legacyReferences.filter(r => !r.selectedEntityId).map(r => r.id), confidenceSummary: { claimCount: claims.length, highConfidenceClaimCount: claims.filter(c => c.confidence === 'HIGH').length, lowConfidenceClaimCount: claims.filter(c => c.confidence === 'LOW').length }, provenance: { rulesFingerprint, externalKnowledgeUsed: false, offsetConvention: 'UTF16_HALF_OPEN', precisionPolicy: 'PRECISION_OVER_RECALL' } };
    const analysis = { ...analysisRaw, fingerprint: jsonHash(analysisRaw) };
    semanticQa(analysis);
    const { segments, transitions } = narrativeSegments(input.script, raw.narrativeUnits, clauses, events, claims), dependencies = claimDependencies(clauses, events, claims, relations, segments);
    const { fingerprint: initialAnalysisHash, ...analysisData } = analysis;
    analysis.fingerprint = jsonHash(analysisData);
    const rawGraph: Omit<SemanticNarrativeGraph, 'fingerprint'> = { version: 1, graphVersion: GRAPH_VERSION, semanticVersion: NATURAL_SEMANTIC_VERSION, id: input.id, script: input.script, analysis, clauses, entities, mentions, references, aliases, events, states: events.filter(e => e.stateAfter && !e.negated && e.modality === 'ASSERTED' && !e.interrogative && e.confidence !== 'LOW').flatMap(e => e.subjectEntityIds.map(entityId => ({ entityId, state: e.stateAfter!, eventId: e.id, sourceSpan: e.sourceSpan }))), relations, claims, segments, transitions, dependencies, metrics: { unitCoverage: new Set(claims.filter(c => c.confidence !== 'LOW').map(c => c.unitId)).size / raw.narrativeUnits.length, clauseCoverage: new Set(claims.filter(c => c.confidence !== 'LOW').flatMap(c => c.clauseIds)).size / Math.max(1, clauses.length), claimCoverage: claims.filter(c => c.confidence !== 'LOW').length / Math.max(1, claims.length), highConfidenceRate: claims.filter(c => c.confidence === 'HIGH').length / Math.max(1, claims.length), ambiguityRate: claims.filter(c => c.status === 'AMBIGUOUS').length / Math.max(1, claims.length), abstentionRate: claims.filter(c => c.confidence === 'LOW').length / Math.max(1, claims.length), unsupportedSpanRate: clauses.filter(cl => claims.some(c => c.clauseIds.includes(cl.id) && c.confidence === 'LOW')).length / Math.max(1, clauses.length) }, rulesFingerprint };
    const graph = { ...rawGraph, fingerprint: jsonHash(rawGraph) };
    validateNarrativeGraph(graph);
    return graph;
}
