import type { SemanticEntity, Mention, Reference, SemanticUnit, Predicate, SemanticContext, Ambiguity, SourceSpan } from './contracts';
import { normalize, normalizedView, sourceSpan, stableIds } from './normalize';
import { entityRules, referenceWindow } from './rules';
export function extractEntities(script: string, units: SemanticUnit[], predicates: Predicate[]) {
    const entities: SemanticEntity[] = [], mentions: Mention[] = [], references: Reference[] = [], ambiguities: Ambiguity[] = [], contexts: SemanticContext[] = [];
    const lastSeen = new Map<string, number>();
    let recentSubjects: string[] = [], recentObjects: string[] = [];
    let currentPlace: string | null = null, currentProcess: string | null = null, currentMeasurement: string | null = null;
    const ambiguity = (unit: SemanticUnit, span: SourceSpan, type: Ambiguity['type'], reason: string, referenceIds: string[] = []) => { const a: Ambiguity = { id: 'A' + (ambiguities.length + 1), unitId: unit.id, type, sourceSpan: span, reason, referenceIds, critical: true }; ambiguities.push(a); return a.id; };
    for (const unit of units) {
        const view = normalizedView(unit.sourceSpan.text, unit.sourceSpan.start), ps = predicates.filter(p => p.unitId === unit.id);
        const candidates = entityRules.flatMap((rule, priority) => [...view.text.matchAll(new RegExp('(?<![\\p{L}])(?:' + rule.pattern + ')(?![\\p{L}])', 'gu'))].map(m => ({ rule, priority, span: view.span(m.index!, m.index! + m[0].length) })));
        candidates.sort((a, b) => a.span.start - b.span.start || b.span.end - a.span.end || a.priority - b.priority);
        const firstPredicate = ps[0]?.sourceSpan.start ?? unit.sourceSpan.end;
        const rawMentions: {
            span: SourceSpan;
            rule: typeof entityRules[number] | null;
            proper: boolean;
            reference: boolean;
        }[] = [];
        for (const item of candidates) {
            if (normalize(item.span.text) === 'lugar' && /\b(?:primeiro|segundo|terceiro|quarto|quinto|sexto|setimo|oitavo|nono|decimo)\s+$/.test(normalize(script.slice(unit.sourceSpan.start, item.span.start))))
                continue;
            if (rawMentions.some(m => m.span.start < item.span.end && item.span.start < m.span.end))
                continue;
            rawMentions.push({ span: item.span, rule: item.rule, proper: false, reference: false });
        }
        for (const m of unit.sourceSpan.text.matchAll(/(?<![\p{L}])[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\p{L}]+(?![\p{L}])/gu)) {
            const span = sourceSpan(script, unit.sourceSpan.start + m.index!, unit.sourceSpan.start + m.index! + m[0].length), name = normalize(m[0]);
            if (/^(o|a|os|as|um|uma|ele|ela|eles|elas|isso|isto|esse|essa|esses|essas|aquele|aquela|depois|antes|quando|conforme|parece|pouco|por|mesmo|se|talvez|em|ela|com|qual|sera|dentro|durante)$/.test(name) || rawMentions.some(x => x.span.start < span.end && span.start < x.span.end) || span.start > firstPredicate)
                continue;
            const namedPlace = rawMentions.find(x => x.rule?.type === 'PLACE' && normalize(x.span.text) === 'cidade' && /^\s+$/.test(script.slice(x.span.end, span.start)));
            if (namedPlace) {
                namedPlace.span = sourceSpan(script, namedPlace.span.start, span.end);
                continue;
            }
            if (!ps.some(p => p.sourceSpan.start >= span.end && /^\s*$/.test(script.slice(span.end, p.sourceSpan.start))))
                continue;
            rawMentions.push({ span, rule: null, proper: true, reference: false });
        }
        for (const m of view.text.matchAll(/\b(ele|ela|eles|elas|isso|isto|esse|essa|esses|essas|aquele|aquela)\b/gu)) {
            if (m[0] === 'isso' && /\bpor\s+$/.test(view.text.slice(0, m.index)))
                continue; // discourse connector, not an entity pronoun
            rawMentions.push({ span: view.span(m.index!, m.index! + m[0].length), rule: null, proper: false, reference: true });
        }
        rawMentions.sort((a, b) => a.span.start - b.span.start);
        const unitMentions: Mention[] = [];
        function resolve(mention: Mention, gender: SemanticEntity['gender'], number: SemanticEntity['number'], category: string | null) {
            let compatible = entities.filter(e => (lastSeen.get(e.id) ?? -100) >= unit.order - referenceWindow && e.sourceSpan.start < mention.sourceSpan.start && (!category || (category === '_object' ? e.type === 'OBJECT' : e.semanticTags.includes(category))) && (category || gender === 'UNKNOWN' || e.gender === gender || e.gender === 'UNKNOWN') && e.number === number && !['ENVIRONMENT', 'MEASUREMENT', 'NUMBER'].includes(e.type));
            const all = stableIds(compatible.map(e => e.id));
            // A declared lexical selection restriction: liquid flow through a pipe.
            const priorProcess = predicates.find(p => p.id === currentProcess);
            const liquidContext = priorProcess && unit.order - units.find(u => u.id === priorProcess.unitId)!.order <= 1 && entities.find(e => e.id === priorProcess.subjectEntityId)?.semanticTags.includes('liquid');
            const liquidFlow = (/\b(tubo|tubulacao)\b/.test(view.text) || liquidContext) && ps.some(p => ['FLOW', 'RISE', 'ENTER'].includes(p.name));
            if (!category && liquidFlow && compatible.some(e => e.semanticTags.includes('liquid')))
                compatible = compatible.filter(e => e.semanticTags.includes('liquid'));
            if (category === 'container') {
                const head = normalize(mention.sourceSpan.text).split(' ')[0], sameHead = compatible.filter(e => normalize(e.sourceSpan.text).split(' ')[0] === head);
                if (sameHead.length)
                    compatible = sameHead;
            }
            const selected = compatible.length === 1 ? compatible[0] : null;
            const ref: Reference = { id: 'R' + (references.length + 1), mentionId: mention.id, candidateEntityIds: all, selectedEntityId: selected?.id ?? null, confidence: selected ? (selected.gender === 'UNKNOWN' && gender !== 'UNKNOWN' ? 'MEDIUM' : 'HIGH') : compatible.length > 1 ? 'AMBIGUOUS' : 'LOW', reason: selected ? (all.length > 1 ? 'Unique antecedent under explicit descriptor or liquid-flow restriction' : 'Unique compatible antecedent in bounded narrative window') : compatible.length > 1 ? 'Multiple compatible antecedents; no arbitrary recency choice' : 'No sufficiently clear antecedent in bounded window', sourceSpan: mention.sourceSpan };
            references.push(ref);
            mention.entityId = selected?.id ?? null;
            if (!selected)
                ambiguity(unit, mention.sourceSpan, compatible.length > 1 ? 'AMBIGUOUS_REFERENCE' : 'INSUFFICIENT_CONTEXT', ref.reason, [ref.id]);
            return ref;
        }
        for (const raw of rawMentions) {
            const label = normalize(raw.span.text), prefix = normalize(script.slice(unit.sourceSpan.start, raw.span.start)), isDefinite = /\b(?:o|a|do|da|no|na|ao|pelo|pela)\s+$/.test(prefix);
            const category = raw.rule?.name === 'vehicle' ? 'vehicle' : raw.rule?.name === 'container' ? 'container' : label === 'objeto' ? 'generic_object' : label === 'local' ? 'place' : null;
            const descriptive = Boolean(category && isDefinite && ((label === 'veiculo' || label === 'objeto' || label === 'local' || label === 'recipiente') || entities.some(e => e.semanticTags.includes(category) && normalize(e.sourceSpan.text) !== label && !/inferior|superior|azul|vermelho|branco|preto|\b[ab]$/.test(label))));
            const gender: SemanticEntity['gender'] = raw.proper ? 'UNKNOWN' : raw.reference ? (/^(ela|elas|essa|essas|aquela)$/.test(label) ? 'F' : /^(ele|eles|esse|esses|aquele)$/.test(label) ? 'M' : 'UNKNOWN') : /^(caixa|tubulacao|cidade|estacao|garagem)$/.test(label) || label.startsWith('caixa ') ? 'F' : raw.rule?.gender ?? 'M';
            const number: SemanticEntity['number'] = /^(eles|elas|esses|essas|pesquisadores|equipamentos)/.test(label) ? 'PLURAL' : 'SINGULAR';
            const prepositional = /\b(?:em|no|na|do|da|pelo|pela|de|com|durante)\s+(?:um|uma|o|a)?\s*$/.test(prefix);
            const mention: Mention = { id: 'M' + (mentions.length + 1), unitId: unit.id, entityId: null, kind: raw.reference ? 'PRONOUN' : descriptive ? 'DESCRIPTIVE' : 'NOUN', sourceSpan: raw.span, role: raw.span.start < firstPredicate && !prepositional ? 'SUBJECT' : 'OBJECT' };
            if (raw.reference || descriptive) {
                // Generic "o objeto" can refer to a single existing object without claiming a new identity.
                resolve(mention, gender, number, category === 'generic_object' ? '_object' : category);
                if (!mention.entityId && descriptive && references.at(-1)!.candidateEntityIds.length === 0 && label !== 'objeto' && label !== 'recipiente' && label !== 'local') {
                    // A first definite vehicle is allowed to introduce an ordinary noun entity.
                    references.pop();
                    ambiguities.pop();
                    mention.kind = 'NOUN';
                }
            }
            if (mention.kind === 'NOUN') {
                const type = raw.proper ? (/\b(?:fica|esta|estava)\b.*\b(?:em|no|na|lugar)\b/.test(view.text) ? 'PLACE' : 'PERSON') : raw.rule!.type;
                const key = raw.proper ? label : raw.rule!.name === 'vehicle' ? label.replace(/^carro|^veiculo/, 'vehicle') : label;
                let entity = entities.find(e => e.canonicalName === key && e.number === number);
                if (!entity) {
                    entity = { id: 'E' + (entities.length + 1), type, canonicalName: key, semanticTags: raw.proper ? [type === 'PLACE' ? 'place' : 'person'] : [...raw.rule!.tags], gender, number, sourceSpan: raw.span, mentionIds: [] };
                    entities.push(entity);
                }
                mention.entityId = entity.id;
            }
            mentions.push(mention);
            unitMentions.push(mention);
            if (mention.entityId) {
                const e = entities.find(e => e.id === mention.entityId)!;
                e.mentionIds.push(mention.id);
                lastSeen.set(e.id, unit.order);
                if (e.type === 'PLACE')
                    currentPlace = e.id;
                if (e.type === 'MEASUREMENT')
                    currentMeasurement = e.id;
            }
        }
        let currentSubject: string | null = null, lastSubjectMentionEnd = unit.sourceSpan.start;
        for (const pred of ps) {
            const before = unitMentions.filter(m => m.sourceSpan.end <= pred.sourceSpan.start && m.entityId);
            const precedingPredicate = ps.filter(p => p.sourceSpan.end <= pred.sourceSpan.start).at(-1);
            // Subject of a subordinate clause may change after a comma: "água entra, o nível aumenta".
            const local = before.filter(m => !precedingPredicate || m.sourceSpan.start >= precedingPredicate.sourceSpan.end);
            const clauseNouns = local.filter(m => {
                if (entities.find(e => e.id === m.entityId)?.type === 'ENVIRONMENT')
                    return false;
                if (!precedingPredicate)
                    return m.role === 'SUBJECT';
                const prefix = normalize(script.slice(precedingPredicate.sourceSpan.end, m.sourceSpan.start));
                if (!/[,;]|\be\b/.test(prefix))
                    return false;
                const clause = prefix.split(/[,;]|\be\b/).at(-1)!;
                return /^\s*(?:o|a|os|as|um|uma)?\s*$/.test(clause);
            });
            const nearest = clauseNouns[0];
            if (nearest) {
                currentSubject = nearest.entityId;
                lastSubjectMentionEnd = nearest.sourceSpan.end;
            }
            const unresolvedBefore = unitMentions.find(m => m.sourceSpan.end <= pred.sourceSpan.start && m.sourceSpan.start >= lastSubjectMentionEnd && !m.entityId && m.kind !== 'NOUN');
            if (unresolvedBefore) {
                const ref = references.find(r => r.mentionId === unresolvedBefore.id)!;
                pred.referenceIds.push(ref.id);
                pred.ambiguityIds.push(...ambiguities.filter(a => a.referenceIds.includes(ref.id)).map(a => a.id));
                pred.subjectEntityId = null;
                continue;
            }
            if (!currentSubject) {
                const eligible = recentSubjects.filter(id => (lastSeen.get(id) ?? -100) >= unit.order - referenceWindow);
                const implicit: Mention = { id: 'M' + (mentions.length + 1), unitId: unit.id, entityId: null, kind: 'ELLIPSIS', sourceSpan: pred.sourceSpan, role: 'SUBJECT' };
                const selected = eligible.length === 1 ? eligible[0] : null;
                const ref: Reference = { id: 'R' + (references.length + 1), mentionId: implicit.id, candidateEntityIds: stableIds(eligible), selectedEntityId: selected, confidence: selected ? 'HIGH' : eligible.length > 1 ? 'AMBIGUOUS' : 'LOW', reason: selected ? 'Omitted subject inherits the single recent subject within bounded continuity' : 'Omitted subject has no unique recent antecedent', sourceSpan: pred.sourceSpan };
                references.push(ref);
                implicit.entityId = selected;
                mentions.push(implicit);
                unitMentions.push(implicit);
                pred.referenceIds.push(ref.id);
                currentSubject = selected;
                if (!selected)
                    pred.ambiguityIds.push(ambiguity(unit, pred.sourceSpan, eligible.length > 1 ? 'AMBIGUOUS_SUBJECT' : 'INSUFFICIENT_CONTEXT', ref.reason, [ref.id]));
            }
            pred.subjectEntityId = currentSubject;
            const subjectMention = unitMentions.find(m => m.entityId === currentSubject && (m.kind === 'PRONOUN' || m.kind === 'DESCRIPTIVE'));
            if (subjectMention) {
                const ref = references.find(r => r.mentionId === subjectMention.id);
                if (ref)
                    pred.referenceIds.push(ref.id);
            }
            pred.objectEntityIds = stableIds(unitMentions.filter(m => m.entityId && m.entityId !== currentSubject && m.sourceSpan.start >= pred.sourceSpan.end && (!ps.find(p => p.sourceSpan.start > pred.sourceSpan.start) || m.sourceSpan.start < ps.find(p => p.sourceSpan.start > pred.sourceSpan.start)!.sourceSpan.start)).map(m => m.entityId!));
            pred.referenceIds = stableIds(pred.referenceIds);
            if (['FLOW', 'RISE', 'ENTER', 'ACCUMULATE', 'FREEZE'].includes(pred.name))
                currentProcess = pred.id;
            if (pred.subjectEntityId)
                lastSeen.set(pred.subjectEntityId, unit.order);
        }
        const subjects = stableIds(ps.map(p => p.subjectEntityId).filter((x): x is string => Boolean(x)));
        if (subjects.length)
            recentSubjects = subjects;
        recentObjects = stableIds(ps.flatMap(p => p.objectEntityIds));
        contexts.push({ unitId: unit.id, activeEntities: entities.filter(e => (lastSeen.get(e.id) ?? -100) >= unit.order - referenceWindow).map(e => e.id), recentSubjects: [...recentSubjects], recentObjects: [...recentObjects], currentPlace, currentProcess, currentMeasurement, currentComparison: ps.find(p => p.name === 'COMPARE')?.id ?? null, currentRanking: null, pendingReferences: references.filter(ref => ref.selectedEntityId === null).map(ref => ref.id) });
    }
    return { entities, mentions, references, ambiguities, contexts };
}
