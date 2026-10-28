import { jsonHash } from '../editorial/fingerprint';
import { normalize } from '../semantics/normalize';
import { assessAuthority, publisherIdentity } from './authority';
import { buildEntityGraph, entityKey, observationSites } from './entities';
import { residencyCurrent, type ObservationSites } from './ranking';
import type { AliasCandidate, AuthorityAssessment, DocumentContextSummary, EntityEligibility, EntityGraph, Evidence, FactCandidate, FactConflict, GroundedFact, PublisherIdentity, ResearchPlan, ResearchV3Section, SourceDocument, StructuredRecord } from './contracts';
// Phase 22 research model (sourcePolicy.researchVersion = 3): v2 plus DocumentContext, records, EntityGraph,
// publisher identity/authority and per-entity eligibility. Pure: snapshots in, derived structures out.
export const RESEARCH_V3_VERSION = 'research-v3/1.0.0';
export const factMetric = (plan: ResearchPlan) => plan.request.constraints?.metric ?? (plan.request.desiredFactTypes.includes('MEASUREMENT') ? 'TEMPERATURE' : plan.request.desiredFactTypes.includes('QUANTITY') ? 'POPULATION' : null);
/** Effective class for assessment and grounding; pack.sources keep the declared class so rederivation is idempotent. */
export function applyAuthority(sources: SourceDocument[], plan: ResearchPlan): { sources: SourceDocument[]; publishers: PublisherIdentity[]; authority: AuthorityAssessment[] } {
    const publishers = sources.map(publisherIdentity), authority = sources.map((s, i) => assessAuthority(s, publishers[i], factMetric(plan)));
    return { sources: sources.map((s, i) => authority[i].effectiveSourceType === s.sourceType ? s : { ...s, sourceType: authority[i].effectiveSourceType }), publishers, authority };
}
export function buildEligibility(plan: ResearchPlan, facts: GroundedFact[], graph: EntityGraph, sites: ObservationSites, conflicts: FactConflict[]): EntityEligibility[] {
    if (plan.request.researchGoal !== 'RANKING')
        return [];
    const c = plan.request.constraints ?? {}, key = (f: GroundedFact) => entityKey(f.canonicalFact.subject, f.canonicalFact.subjectKind), anchor = (f: GroundedFact) => f.canonicalFact.temporalContext ?? f.canonicalFact.observationPeriod ?? null;
    const places = [...new Set(facts.filter(f => (f.factType === 'MEASUREMENT' || f.factType === 'RESIDENCY') && f.canonicalFact.subjectKind !== 'STATION').map(key))].sort();
    return places.map(place => {
        const own = facts.filter(f => key(f) === place), linked = sites.get(place) ?? [], viaSite = facts.filter(f => f.factType === 'MEASUREMENT' && linked.some(l => l.stationKey === key(f)));
        const temps = [...own, ...viaSite].filter(f => f.factType === 'MEASUREMENT' && f.canonicalFact.metric === c.metric && f.qualifiers.includes(c.qualifier ?? '')), temp = [...temps].sort((a, b) => Number(b.usableForPrimaryClaim) - Number(a.usableForPrimaryClaim) || b.independentOriginCount - a.independentOriginCount || a.id.localeCompare(b.id, 'en'))[0] ?? null;
        const res = own.filter(f => f.factType === 'RESIDENCY' && f.canonicalFact.residency === c.residencyCriterion), current = res.filter(f => residencyCurrent(f, plan.policy).current), residency = [...current].sort((a, b) => Number(b.usableForPrimaryClaim) - Number(a.usableForPrimaryClaim) || a.id.localeCompare(b.id, 'en'))[0] ?? res[0] ?? null;
        const entityConflict = conflicts.some(x => x.conflictType === 'ENTITY_CONFLICT' && own.some(f => f.conflicts.includes(x.id)));
        const node = graph.nodes.find(n => entityKey(n.name, n.kind === 'STATION' ? 'STATION' : undefined) === place), site = temp && temp.canonicalFact.subjectKind === 'STATION' ? graph.edges.find(e => linked.some(l => l.edgeId === e.id && l.stationKey === key(temp))) ?? null : null;
        const check = (passed: boolean, detail: string) => ({ passed, detail });
        const checklist: EntityEligibility['checklist'] = {
            IDENTITY: check(Boolean(node) && !entityConflict, entityConflict ? 'ENTITY_CONFLICT' : node ? node.kind + ' ' + node.name + (site ? '; measurement via ' + site.relation + ' (' + site.reason + ')' : '') : 'No entity node'),
            TEMPERATURE: check(Boolean(temp), temp ? temp.id + ' ' + temp.canonicalFact.quantity?.originalValue + ' ' + temp.canonicalFact.quantity?.originalUnit + (temp.canonicalFact.subjectKind === 'STATION' ? ' at observation site ' + temp.canonicalFact.subject : '') : facts.some(f => key(f) === place && f.factType === 'MEASUREMENT') ? 'Only incompatible measurement contexts' : 'No measurement evidence'),
            TEMPERATURE_AUTHORITY: check(Boolean(temp?.usableForPrimaryClaim), temp?.origins?.admission ?? 'n/a'),
            TEMPERATURE_CORROBORATION: check(Boolean(temp && (temp.independentOriginCount >= 2 || temp.usableForPrimaryClaim)), temp ? temp.independentOriginCount + ' independent origin root(s)' : 'n/a'),
            RESIDENCY: check(Boolean(residency), residency ? residency.id + ' ' + residency.canonicalFact.residency : own.some(f => f.factType === 'RESIDENCY') ? 'Only incompatible presence: ' + [...new Set(own.filter(f => f.factType === 'RESIDENCY').map(f => f.canonicalFact.residency))].join('/') : 'No presence evidence'),
            RESIDENCY_CURRENTNESS: check(Boolean(residency && residencyCurrent(residency, plan.policy).current), residency ? residencyCurrent(residency, plan.policy).reason : 'n/a'),
            RESIDENCY_CORROBORATION: check(Boolean(residency?.usableForPrimaryClaim), residency?.origins?.admission ?? 'n/a'),
            METRIC_COMPARABILITY: check(Boolean(temp && anchor(temp) && temp.canonicalFact.quantity?.approximation !== 'APPROXIMATE'), temp ? (anchor(temp) ? 'Anchor ' + anchor(temp) : 'Missing temporal anchor') : 'n/a'),
            CONFLICTS: check(![temp, residency].some(f => f?.status === 'CONFLICTED'), [temp, residency].filter(f => f?.status === 'CONFLICTED').map(f => f!.id + ' ' + f!.conflicts.join(',')).join('; ') || 'none')
        };
        const failing = Object.entries(checklist).filter(([, v]) => !v.passed).map(([k, v]) => k + ': ' + v.detail);
        return { entity: node?.name ?? place, checklist, measurementFactId: temp?.id ?? null, residencyFactId: residency?.id ?? null, stationRelation: site ? site.relation + ' ' + site.id : null, eligible: !failing.length, reason: failing.join(' | ') || 'All eligibility checks satisfied' };
    });
}
export function researchV3Section(plan: ResearchPlan, effective: SourceDocument[], auth: ReturnType<typeof applyAuthority>, candidates: FactCandidate[], evidence: Evidence[], facts: GroundedFact[], conflicts: FactConflict[], contexts: DocumentContextSummary[], records: StructuredRecord[], aliases: AliasCandidate[]): { section: ResearchV3Section; sites: ObservationSites } {
    const entityGraph = buildEntityGraph(effective, candidates, evidence, contexts, aliases), sites = observationSites(entityGraph, plan.policy.observationSitePolicy);
    const sortedContexts = [...contexts].sort((a, b) => a.sourceId.localeCompare(b.sourceId, 'en')), sortedRecords = [...records].sort((a, b) => a.recordId.localeCompare(b.recordId, 'en'));
    const section: ResearchV3Section = { version: RESEARCH_V3_VERSION, documentContexts: sortedContexts, records: sortedRecords, entityGraph, publishers: auth.publishers, authority: auth.authority, eligibility: buildEligibility(plan, facts, entityGraph, sites, conflicts), fingerprints: { documentContexts: jsonHash(sortedContexts), records: jsonHash(sortedRecords), entityGraph: entityGraph.fingerprint, authority: jsonHash({ publishers: auth.publishers, authority: auth.authority }) } };
    return { section, sites };
}
export const normalizedEntity = (s: string) => normalize(s).replace(/\s+/g, ' ').trim();
