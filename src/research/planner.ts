import { jsonHash } from '../editorial/fingerprint';
import { validateResearchRequest, researchPolicy } from './request';
import type { ResearchRequest, ResearchPlan, ResearchQuestion } from './contracts';
export function planResearch(input: ResearchRequest): ResearchPlan {
    validateResearchRequest(input);
    const request: ResearchRequest = JSON.parse(JSON.stringify(input)), policy = researchPolicy(request), ambiguities: ResearchPlan['ambiguities'] = [];
    const rank = request.researchGoal === 'RANKING';
    if (rank && !request.constraints?.residencyCriterion && /vive|viver|morad|habitad|popula/i.test(request.topic))
        ambiguities.push({ code: 'AMBIGUOUS_RESEARCH_CRITERION', reason: 'Permanent population, settlement, seasonal presence and temporary research staff are distinct; supply an explicit criterion' });
    if (rank && (!request.constraints?.metric || !request.constraints.qualifier))
        ambiguities.push({ code: 'AMBIGUOUS_RANKING_METRIC', reason: 'Explicit measurement metric and qualifier required before ordering facts' });
    const questions: ResearchQuestion[] = rank ? [{ id: 'RQ1', question: 'Which entities meet the explicitly requested human-presence criterion?', requiredFactTypes: ['RESIDENCY'], essential: true, requiredCorroboration: policy.minIndependentSources }, { id: 'RQ2', question: 'Which source-measured quantities and critical qualifiers apply to each entity?', requiredFactTypes: ['MEASUREMENT'], essential: true, requiredCorroboration: policy.minIndependentSources }, { id: 'RQ3', question: 'Are measurement metric, qualifiers, units and temporal contexts comparable?', requiredFactTypes: ['MEASUREMENT'], essential: true, requiredCorroboration: policy.minIndependentSources }, { id: 'RQ4', question: 'Is there enough independently grounded evidence for the requested item count?', requiredFactTypes: ['MEASUREMENT', 'RESIDENCY'], essential: true, requiredCorroboration: policy.minIndependentSources }] : [{ id: 'RQ1', question: 'Which observable facts or process operations are explicitly documented?', requiredFactTypes: request.desiredFactTypes, essential: true, requiredCorroboration: policy.minIndependentSources }, { id: 'RQ2', question: 'Are participants, relations, qualifiers and source origins sufficiently clear?', requiredFactTypes: request.desiredFactTypes, essential: true, requiredCorroboration: policy.minIndependentSources }];
    const raw = { version: 'research-plan/1.0.0', request, policy, questions, essentialResearchQuestionIds: questions.filter(q => q.essential).map(q => q.id), ambiguities };
    return { ...raw, fingerprint: jsonHash(raw) };
}
