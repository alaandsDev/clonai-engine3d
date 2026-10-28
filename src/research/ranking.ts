import { jsonHash } from '../editorial/fingerprint';
import { normalize } from '../semantics/normalize';
import type { ResearchPlan, GroundedFact, RankingResult } from './contracts';
export function rankFacts(plan: ResearchPlan, facts: GroundedFact[]): RankingResult | null {
    if (plan.request.researchGoal !== 'RANKING')
        return null;
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
