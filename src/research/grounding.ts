import { jsonHash } from '../editorial/fingerprint';
import { normalize } from '../semantics/normalize';
import type { SemanticNarrativeGraph } from '../semantics/narrative-contracts';
import type { EvidencePack, GroundedFact, GroundedSentence, FactualPreflight, GroundingReconciliation } from './contracts';
import { validateEvidencePack } from './qa';
export const groundedEditorial = [
    'Observe o conteúdo do Dataset Demo, com atenção aos fatos apresentados e ao contexto fornecido por esse conjunto de dados.',
    'Acompanhe a sequência documentada no ensaio fictício, sem acrescentar acontecimentos, medidas ou explicações que não constam dos dados fornecidos.',
    'Observe as partes descritas com calma, mantendo a atenção na mesma representação durante esta explicação do conjunto de dados.',
    'Em resumo, acompanhe o exemplo documentado e compare as partes descritas, sem transformar estes dados fictícios em afirmações sobre o mundo real.',
    'Por fim, observe somente o conteúdo apresentado nesta representação, sem imaginar uma explicação adicional para os fatos do conjunto de dados.',
];
export function allowedGroundedEditorial(pack: EvidencePack): string[] { return pack.fixture ? groundedEditorial : [
    'Observe os fatos documentados nas fontes consultadas, com atenção às medidas apresentadas e ao contexto que acompanha cada informação.',
    'Acompanhe os dados apresentados nesta explicação, mantendo a atenção nas medidas e nos contextos descritos pelas fontes consultadas durante a pesquisa.',
    'Observe cada medida com calma e acompanhe a informação correspondente na representação, com atenção ao contexto descrito junto ao dado apresentado.',
    'Por fim, acompanhe os fatos documentados nesta pesquisa e mantenha a atenção no contexto apresentado pelas fontes consultadas ao longo desta explicação.',
    'Observe as informações descritas nas fontes, com atenção às medidas e aos respectivos contextos apresentados durante esta explicação dos dados documentados na pesquisa.',
]; }
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** Closed short paraphrases from grounded tuples; no source prose is copied wholesale. */
export function realizeGroundedFact(g: GroundedFact): string | null {
    const f = g.canonicalFact, subject = f.subject;
    if (f.factType === 'MEASUREMENT' && f.quantity) {
        const q = f.quantity, qualifier: Record<string, string> = { MINIMUM_RECORDED: 'mínima registrada', AVERAGE: 'média', DAILY_MINIMUM: 'mínima diária', OFFICIAL_RECORD: 'oficial recorde', REPORTED_VALUE: 'relatada', ESTIMATED_VALUE: 'estimada', RECORDED_VALUE: 'registrada' }, word = qualifier[f.qualifiers.find(k => k in qualifier) ?? ''];
        if (!word)
            return null;
        return (f.qualifiers.includes('REPORTED') ? 'Conforme o relato, a temperatura ' : 'A temperatura ') + word + ' na ' + lower(subject) + ' marca ' + (q.approximation === 'APPROXIMATE' ? 'aproximadamente ' : '') + q.originalValue + ' graus ' + (q.originalUnit === '°C' ? 'Celsius' : 'Fahrenheit') + (f.temporalContext ? ' em ' + f.temporalContext : '') + '.';
    }
    if (f.factType === 'RESIDENCY') {
        const phrases: Record<string, string> = { PERMANENT_POPULATION: 'possui população permanente', PERMANENT_SETTLEMENT: 'possui assentamento permanente', TEMPORARY_RESEARCH_STAFF: 'abriga pesquisadores temporariamente', SEASONAL_PRESENCE: 'possui presença sazonal' };
        return f.residency && phrases[f.residency] ? 'A ' + lower(subject) + ' ' + phrases[f.residency] + (f.temporalContext ? ' em ' + f.temporalContext : '') + '.' : null;
    }
    if (f.factType === 'PROCESS') {
        const prefix = f.qualifiers.includes('DEMO_EXPERIMENT') ? 'No ' + f.temporalContext + ', ' : 'No processo relatado' + (f.temporalContext ? ' no contexto ' + f.temporalContext : '') + ', ', noun = normalize(subject) === 'agua' ? 'a água' : normalize(subject) === 'nivel' ? 'o nível' : subject, object = f.object ?? '';
        const p: Record<string, string> = { EXIT: noun + ' sai de um ' + object, FLOW: noun + ' percorre o ' + object, ENTER: noun + ' entra em um ' + object, INCREASE: noun + ' aumenta no ' + object, OPERATE: noun + ' operam ' + object };
        return p[f.predicate] ? prefix + p[f.predicate] + '.' : null;
    }
    return null;
}
export function factualPreflight(pack: EvidencePack, script: string, sentences: GroundedSentence[]): FactualPreflight {
    validateEvidencePack(pack);
    const issues: FactualPreflight['issues'] = [];
    const add = (code: string, sentenceId: string | null, reason: string) => issues.push({ code, sentenceId, reason });
    if (!pack.fixture && /(?:mais fri[oa]s?|coldest)[\s\S]{0,70}(?:do mundo|on earth|in the world)|(?:global|exaustivo|exhaustive)\s+ranking/i.test(script))
        add('GLOBAL_SUPERLATIVE_NOT_ESTABLISHED', null, 'A finite source pack cannot establish exhaustive global coverage');
    if (script !== sentences.map(s => s.text).join('\n'))
        add('SCRIPT_LEDGER_MISMATCH', null, 'Script differs from its complete sentence ledger');
    const used = new Set<string>();
    for (const s of sentences) {
        if (script.slice(s.sourceSpan.start, s.sourceSpan.end) !== s.text)
            add('SCRIPT_SPAN_MISMATCH', s.id, 'Sentence span does not match the final script');
        if (s.kind === 'EDITORIAL') {
            if (s.groundedFactIds.length || !allowedGroundedEditorial(pack).includes(s.text))
                add('UNGROUNDED_SCRIPT_CLAIM', s.id, 'Unlicensed editorial text may conceal a factual addition');
            continue;
        }
        if (s.groundedFactIds.length !== 1) {
            add('MISSING_EVIDENCE', s.id, 'Each realized atomic fact requires exactly one admitted GroundedFact');
            continue;
        }
        const f = pack.groundedFacts.find(f => f.id === s.groundedFactIds[0]);
        if (!f || !f.usableForPrimaryClaim) {
            add('MISSING_EVIDENCE', s.id, 'No admissible grounded fact; conflicted and insufficient facts cannot become PRIMARY');
            continue;
        }
        used.add(f.id);
        if (realizeGroundedFact(f) !== s.text)
            add('SEMANTIC_DRIFT', s.id, 'Entity, number, qualifier, uncertainty, context, causal content or phrasing differs from the licensed grounded tuple');
    }
    for (const id of pack.essentialFactIds)
        if (!used.has(id))
            add('ESSENTIAL_FACT_OMITTED', null, id);
    if (pack.ranking?.status === 'VALID') {
        const ranks = new Map(pack.ranking.items.map(i => [i.measurementFactId, i.rank]));
        const order = sentences.flatMap(s => s.groundedFactIds).filter(id => ranks.has(id));
        if (new Set(order).size !== order.length || order.some((id, i) => i > 0 && ranks.get(id)! < ranks.get(order[i - 1])!))
            add('RANKING_ORDER_DRIFT', null, 'The realized ranking order must preserve source-derived positions; tied items may permute within their shared rank');
    }
    if (pack.quality.productionEligibility !== 'RESEARCH_READY')
        add('RESEARCH_INCOMPLETE', null, 'Critical research questions / comparable ranking are unresolved');
    const raw = { passed: !issues.length, issues, essentialFactCoverage: pack.essentialFactIds.length ? pack.essentialFactIds.filter(id => used.has(id)).length / pack.essentialFactIds.length : 0 };
    return { ...raw, fingerprint: jsonHash(raw) };
}
export function reconcileGrounding(pack: EvidencePack, script: string, sentences: GroundedSentence[], graph: SemanticNarrativeGraph): GroundingReconciliation {
    const before = factualPreflight(pack, script, sentences), links: GroundingReconciliation['links'] = [], issues: GroundingReconciliation['issues'] = [];
    if (graph.script !== script)
        throw Error('GROUNDING_GRAPH_SOURCE mismatch');
    for (const c of graph.claims.filter(c => c.requiresVisualProof)) {
        const sentence = sentences.find(s => c.sourceSpan.start >= s.sourceSpan.start && c.sourceSpan.start < s.sourceSpan.end), f = pack.groundedFacts.find(f => sentence?.groundedFactIds.includes(f.id));
        let compatible = Boolean(sentence?.kind === 'FACT' && f?.usableForPrimaryClaim && realizeGroundedFact(f) === sentence.text);
        if (compatible && f) {
            const fact = f.canonicalFact;
            if (fact.factType === 'PROCESS')
                compatible = c.predicate === fact.predicate && c.status === 'RESOLVED';
            if (fact.factType === 'MEASUREMENT') {
                const quantities = graph.analysis.quantities.filter(q => c.quantityIds.includes(q.id) && q.dimension === 'TEMPERATURE');
                compatible = quantities.some(q => q.value === Number(fact.quantity!.originalValue.replace(',', '.')) && fact.quantity!.originalUnit === '°C') && ['MEASURE', 'IS', 'HAS'].includes(c.predicate);
            }
            if (fact.factType === 'RESIDENCY')
                compatible = ['HAS', 'IS', 'OPERATE'].includes(c.predicate) && normalize(sentence!.text).includes(normalize(fact.subject));
        }
        if (!compatible || !f || !sentence) {
            issues.push({ code: 'UNGROUNDED_SCRIPT_CLAIM', claimId: c.id, reason: 'Actual extracted claim does not reconcile with an admitted grounded tuple; no hidden claims injection' });
            continue;
        }
        links.push({ claimId: c.id, sentenceId: sentence.id, groundedFactIds: [f.id], evidenceIds: [...f.evidenceIds], sourceIds: [...f.sourceIds], qualifiersPreserved: true, packFingerprint: pack.fingerprint });
    }
    // A factual sentence cannot disappear into a rhetorical/context classification.
    for (const s of sentences.filter(s => s.kind === 'FACT'))
        if (!links.some(l => l.sentenceId === s.id))
            issues.push({ code: 'SEMANTIC_FACT_NOT_RECOGNIZED', claimId: s.id, reason: 'Engine did not extract a compatible factual claim for a required sentence' });
    const count = graph.claims.filter(c => c.requiresVisualProof).length, drift = before.issues.filter(i => i.code === 'SEMANTIC_DRIFT' || i.code === 'RANKING_ORDER_DRIFT').length + issues.filter(i => i.code === 'SEMANTIC_FACT_NOT_RECOGNIZED').length, raw = { passed: before.passed && !issues.length, links, issues, metrics: { factualClaimCount: count, groundedClaimCount: links.length, ungroundedClaimCount: count - links.length, corroboratedPrimaryClaimRate: count ? links.filter(l => l.groundedFactIds.every(id => pack.groundedFacts.find(f => f.id === id)?.status === 'CORROBORATED')).length / count : 0, qualifierPreservationRate: count ? links.filter(l => l.qualifiersPreserved).length / count : 0, semanticDriftCount: drift, unsupportedSpecificClaimCount: before.issues.length + issues.length } };
    return { ...raw, fingerprint: jsonHash(raw) };
}
