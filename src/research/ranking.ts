import { jsonHash } from '../editorial/fingerprint';
import { normalize } from '../semantics/normalize';
import type { ResearchPlan, GroundedFact, RankingResult, ResearchPolicy } from './contracts';
/** v2 currentness: past-tense presence is historical; a dated statement older than residencyMaxAgeYears (relative to evaluationDate) is not current. */
export function residencyCurrent(f: GroundedFact, policy: ResearchPolicy): { current: boolean; reason: string } { if (f.qualifiers.includes('HISTORICAL'))
    return { current: false, reason: 'RESIDENCY_HISTORICAL past-tense presence' }; const y = f.canonicalFact.temporalContext?.match(/\b(1[6-9]\d\d|20\d\d)\b/)?.[1]; if (y && policy.evaluationDate && policy.residencyMaxAgeYears && Number(policy.evaluationDate.slice(0, 4)) - Number(y) > policy.residencyMaxAgeYears)
    return { current: false, reason: 'RESIDENCY_NOT_CURRENT dated ' + y }; return { current: true, reason: y ? 'Dated ' + y : 'Present-tense or undated presence as of the snapshot' }; }
/** v3: place key → observation sites whose measurements may stand for it (source-backed EntityGraph relations only). */
export type ObservationSites = Map<string, { stationKey: string; edgeId: string }[]>;
const subjectKey = (f: GroundedFact) => normalize(f.canonicalFact.subject).replace(/\s+/g, ' ').trim() + (f.canonicalFact.subjectKind === 'STATION' ? '|station' : '');
export function rankFacts(plan: ResearchPlan, facts: GroundedFact[], sites?: ObservationSites): RankingResult | null {
    if (plan.request.researchGoal !== 'RANKING')
        return null;
    if (plan.policy.researchVersion === 2 || plan.policy.researchVersion === 3)
        return rankFactsV2(plan, facts, sites);
    const c = plan.request.constraints ?? {}, base = { requestedCount: c.rankingCount ?? 5, criterion: c.residencyCriterion ?? null, metric: c.metric ?? null, qualifier: c.qualifier ?? null, temporalContext: c.temporalContext ?? null, tiePolicy: 'COMPETITION_INCLUDE_BOUNDARY' as const }, excluded: RankingResult['excluded'] = [];
    const finish = (status: RankingResult['status'], reason: string, eligibleItemCount: number, items: RankingResult['items'] = []) => { const raw = { ...base, status, reason, eligibleItemCount, items, excluded }; return { ...raw, fingerprint: jsonHash(raw) }; };
    if (plan.ambiguities.length)
        return finish('RANKING_NOT_SUPPORTED', plan.ambiguities.map(a => a.code).join(', '), 0);
    const items: {
        fact: GroundedFact;
        residency: GroundedFact | null;
    }[] = [];
    const subjects = [...new Set(facts.filter(f => f.factType === 'MEASUREMENT').map(f => normalize(f.canonicalFact.subject)))].sort();
    for (const subject of subjects) {
        const all = facts.filter(f => normalize(f.canonicalFact.subject) === subject), measurements = all.filter(f => f.factType === 'MEASUREMENT' && f.usableForPrimaryClaim && f.canonicalFact.metric === c.metric && f.qualifiers.includes(c.qualifier ?? '') && (!c.temporalContext || f.canonicalFact.temporalContext === c.temporalContext));
        const residency = all.find(f => f.factType === 'RESIDENCY' && f.usableForPrimaryClaim && f.canonicalFact.residency === c.residencyCriterion) ?? null;
        if (!measurements.length || c.residencyCriterion && !residency) {
            excluded.push({ subject, reason: !measurements.length ? 'Missing comparable grounded measurement / qualifier / context' : 'Missing explicitly required residency criterion' });
            continue;
        }
        if (measurements.some(m => !m.canonicalFact.temporalContext)) {
            excluded.push({ subject, reason: 'Missing temporal context' });
            continue;
        }
        const values = new Set(measurements.map(m => m.canonicalFact.quantity!.normalizedValue)), periods = new Set(measurements.map(m => m.canonicalFact.temporalContext)), units = new Set(measurements.map(m => m.canonicalFact.quantity!.normalizedUnit));
        if (values.size > 1 || units.size > 1 || periods.size > 1 && plan.policy.temporalComparison === 'SAME_CONTEXT') {
            excluded.push({ subject, reason: 'Multiple unresolved measurement contexts/values/units require an explicit criterion' });
            continue;
        }
        items.push({ fact: [...measurements].sort((a, b) => b.independentOriginCount - a.independentOriginCount || a.id.localeCompare(b.id, 'en'))[0], residency });
    }
    if (items.length < base.requestedCount)
        return finish('RANKING_INCOMPLETE', 'Insufficient comparable eligible entities; never invent the missing item', items.length);
    const contexts = new Set(items.map(i => i.fact.canonicalFact.temporalContext)), units = new Set(items.map(i => i.fact.canonicalFact.quantity!.normalizedUnit));
    if (contexts.size > 1 && plan.policy.temporalComparison === 'SAME_CONTEXT' || units.size > 1)
        return finish('RANKING_NOT_SUPPORTED', 'Incompatible temporal contexts or units under the explicit policy', items.length);
    if (items.some(i => i.fact.canonicalFact.quantity!.approximation === 'APPROXIMATE'))
        return finish('RANKING_NOT_SUPPORTED', 'Approximate values require an explicit uncertainty-comparison policy; none implemented', items.length);
    const sorted = items.sort((a, b) => a.fact.canonicalFact.quantity!.normalizedValue - b.fact.canonicalFact.quantity!.normalizedValue || normalize(a.fact.canonicalFact.subject).localeCompare(normalize(b.fact.canonicalFact.subject), 'en')), cutoff = sorted[base.requestedCount - 1].fact.canonicalFact.quantity!.normalizedValue, selected = sorted.filter(i => i.fact.canonicalFact.quantity!.normalizedValue <= cutoff);
    let rank = 1;
    const ranked = selected.map((i, index) => { const value = i.fact.canonicalFact.quantity!.normalizedValue; if (index && value !== selected[index - 1].fact.canonicalFact.quantity!.normalizedValue)
        rank = index + 1; return { subject: i.fact.canonicalFact.subject, rank, tied: selected.filter(j => j.fact.canonicalFact.quantity!.normalizedValue === value).length > 1, value, unit: i.fact.canonicalFact.quantity!.normalizedUnit, measurementFactId: i.fact.id, residencyFactId: i.residency?.id ?? null }; });
    return finish('VALID', 'Derived only within the supplied snapshot, explicit metric/qualifier/criterion; equal values share factual rank', items.length, ranked);
}
/** v2: every entity with measurement or presence facts is evaluated and excluded with a specific gap; residency must be current; the temporal anchor is the event date or observation period. */
function rankFactsV2(plan: ResearchPlan, facts: GroundedFact[], sites?: ObservationSites): RankingResult {
    const c = plan.request.constraints ?? {}, base = { requestedCount: c.rankingCount ?? 5, criterion: c.residencyCriterion ?? null, metric: c.metric ?? null, qualifier: c.qualifier ?? null, temporalContext: c.temporalContext ?? null, tiePolicy: 'COMPETITION_INCLUDE_BOUNDARY' as const }, excluded: RankingResult['excluded'] = [];
    const finish = (status: RankingResult['status'], reason: string, eligibleItemCount: number, items: RankingResult['items'] = []) => { const raw = { ...base, status, reason, eligibleItemCount, items, excluded }; return { ...raw, fingerprint: jsonHash(raw) }; };
    if (plan.ambiguities.length)
        return finish('RANKING_NOT_SUPPORTED', plan.ambiguities.map(a => a.code).join(', '), 0);
    const anchor = (f: GroundedFact) => f.canonicalFact.temporalContext ?? f.canonicalFact.observationPeriod ?? null, items: { fact: GroundedFact; residency: GroundedFact | null }[] = [];
    // v2 facts carry no subjectKind, so their keys equal normalize(subject) exactly as before.
    const keyOf = sites ? subjectKey : (f: GroundedFact) => normalize(f.canonicalFact.subject);
    for (const subject of [...new Set(facts.filter(f => f.factType === 'MEASUREMENT' || f.factType === 'RESIDENCY').map(keyOf))].sort()) {
        if (subject.endsWith('|station')) {
            excluded.push({ subject, reason: 'OBSERVATION_SITE_NOT_A_PLACE: measurements count for a place only through a source-backed relation' });
            continue;
        }
        const linked = new Set((sites?.get(subject) ?? []).map(s => s.stationKey)), all = facts.filter(f => keyOf(f) === subject || f.factType === 'MEASUREMENT' && linked.has(keyOf(f))), matching = all.filter(f => f.factType === 'MEASUREMENT' && f.canonicalFact.metric === c.metric && f.qualifiers.includes(c.qualifier ?? '') && (!c.temporalContext || f.canonicalFact.temporalContext === c.temporalContext)), measurements = matching.filter(f => f.usableForPrimaryClaim);
        const residencies = all.filter(f => f.factType === 'RESIDENCY' && f.canonicalFact.residency === c.residencyCriterion), current = residencies.filter(f => f.usableForPrimaryClaim && residencyCurrent(f, plan.policy).current), residency = current.sort((a, b) => b.independentOriginCount - a.independentOriginCount || a.id.localeCompare(b.id, 'en'))[0] ?? null;
        const measurementGap = measurements.length ? null : matching.some(f => f.status === 'CONFLICTED') ? 'MEASUREMENT_CONFLICTED' : matching.length ? 'MEASUREMENT_INSUFFICIENT_CORROBORATION' : all.some(f => f.factType === 'MEASUREMENT') ? 'MEASUREMENT_INCOMPATIBLE_CONTEXT ' + [...new Set(all.filter(f => f.factType === 'MEASUREMENT').flatMap(f => f.qualifiers))].sort().join('/') : 'MEASUREMENT_MISSING';
        const residencyGap = !c.residencyCriterion || residency ? null : residencies.some(f => f.usableForPrimaryClaim) ? residencies.map(f => residencyCurrent(f, plan.policy).reason).find(r => r.startsWith('RESIDENCY_')) ?? 'RESIDENCY_NOT_CURRENT' : residencies.some(f => f.status === 'CONFLICTED') ? 'RESIDENCY_CONFLICTED' : residencies.length ? 'RESIDENCY_INSUFFICIENT_CORROBORATION' : all.some(f => f.factType === 'RESIDENCY') ? 'RESIDENCY_INCOMPATIBLE ' + [...new Set(all.filter(f => f.factType === 'RESIDENCY').map(f => f.canonicalFact.residency))].sort().join('/') : 'RESIDENCY_MISSING';
        if (measurementGap || residencyGap) {
            excluded.push({ subject, reason: [measurementGap, residencyGap].filter(Boolean).join('; ') });
            continue;
        }
        if (measurements.some(m => !anchor(m))) {
            excluded.push({ subject, reason: 'Missing temporal context' });
            continue;
        }
        if (new Set(measurements.map(m => m.canonicalFact.quantity!.normalizedValue)).size > 1 || new Set(measurements.map(m => m.canonicalFact.quantity!.normalizedUnit)).size > 1 || new Set(measurements.map(anchor)).size > 1 && plan.policy.temporalComparison === 'SAME_CONTEXT') {
            excluded.push({ subject, reason: 'Multiple unresolved measurement contexts/values/units require an explicit criterion' });
            continue;
        }
        items.push({ fact: [...measurements].sort((a, b) => b.independentOriginCount - a.independentOriginCount || a.id.localeCompare(b.id, 'en'))[0], residency });
    }
    if (items.length < base.requestedCount)
        return finish('RANKING_INCOMPLETE', 'Insufficient comparable eligible entities; never invent the missing item. Eligible (unranked): ' + (items.map(i => i.fact.canonicalFact.subject + ' [' + i.fact.id + (i.residency ? ', ' + i.residency.id : '') + ']').sort().join('; ') || 'none'), items.length);
    if (new Set(items.map(i => anchor(i.fact))).size > 1 && plan.policy.temporalComparison === 'SAME_CONTEXT' || new Set(items.map(i => i.fact.canonicalFact.quantity!.normalizedUnit)).size > 1)
        return finish('RANKING_NOT_SUPPORTED', 'Incompatible temporal contexts or units under the explicit policy', items.length);
    if (items.some(i => i.fact.canonicalFact.quantity!.approximation === 'APPROXIMATE'))
        return finish('RANKING_NOT_SUPPORTED', 'Approximate values require an explicit uncertainty-comparison policy; none implemented', items.length);
    const sorted = items.sort((a, b) => a.fact.canonicalFact.quantity!.normalizedValue - b.fact.canonicalFact.quantity!.normalizedValue || normalize(a.fact.canonicalFact.subject).localeCompare(normalize(b.fact.canonicalFact.subject), 'en')), cutoff = sorted[base.requestedCount - 1].fact.canonicalFact.quantity!.normalizedValue, selected = sorted.filter(i => i.fact.canonicalFact.quantity!.normalizedValue <= cutoff);
    let rank = 1;
    return finish('VALID', 'Derived only within the session snapshots, explicit metric/qualifier/criterion; equal values share factual rank', items.length, selected.map((i, index) => { const value = i.fact.canonicalFact.quantity!.normalizedValue; if (index && value !== selected[index - 1].fact.canonicalFact.quantity!.normalizedValue)
        rank = index + 1; return { subject: i.fact.canonicalFact.subject, rank, tied: selected.filter(j => j.fact.canonicalFact.quantity!.normalizedValue === value).length > 1, value, unit: i.fact.canonicalFact.quantity!.normalizedUnit, measurementFactId: i.fact.id, residencyFactId: i.residency?.id ?? null }; }));
}
