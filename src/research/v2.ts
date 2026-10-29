import { jsonHash } from '../editorial/fingerprint';
import { extractMechanismEvidence } from './mechanism';
import { normalize } from '../semantics/normalize';
import { extractSourceEvidence } from './extractor';
import { extractEnglish } from './english';
import { attachedCitations, documentSubject, hostOf, interpretGrid, interpretList, parseDelimited, parseHtmlStructures, type StructuredFact } from './structured';
import { buildSourceGraph, resolveAliases, sourceLocators, withFactRelations } from './origins';
import { structuredV3 } from './v3-extract';
import { factWindowNearCopy } from './similarity';
import {evidenceAllowedV4, separateMeasurementContexts} from './v4/semantics';
import type { CanonicalFact, DocumentContextSummary, StructuredRecord, Evidence, EvidenceQualityAssessment, FactCandidate, FactConflict, FactTypeQuorum, GroundedFact, OriginRelation, ResearchPlan, ResearchPolicy, ResearchV2Section, SourceDocument, SourceQualityAssessment, StructuredSummary } from './contracts';
// Phase 21 research model (opt-in via sourcePolicy.researchVersion = 2). Reuses the Phase 19 contracts and
// policy vocabulary; differences from v1 are documented in src/research/README.md.
export const RESEARCH_V2_VERSION = 'research-v2/1.0.0';
const key = (prefix: string, x: unknown) => prefix + '_' + jsonHash(x).slice(0, 20);
/** Facts outside the request's fact types/metric are not extracted into a v2 pack. */
export function relevantFact(f: CanonicalFact, plan: ResearchPlan) { const desired = plan.request.desiredFactTypes, metric = plan.request.constraints?.metric; if (plan.request.researchGoal === 'PROCESS' && f.qualifiers.includes('MECHANISM_PROSE'))
    return true; // Phase 25: mechanism facts about the requested subject are relevant to a PROCESS route; readiness still requires every desired type.
 if (f.factType === 'MEASUREMENT')
    return desired.includes('MEASUREMENT') && (!metric || metric === 'TEMPERATURE'); if (f.factType === 'RESIDENCY')
    return desired.includes('RESIDENCY'); if (f.factType === 'QUANTITY')
    return desired.includes('QUANTITY') && (!metric || metric === 'POPULATION'); return desired.includes(f.factType); }
function record(s: SourceDocument, f: StructuredFact): { evidence: Evidence; candidate: FactCandidate } {
    const host = hostOf(s.canonicalLocator), citations = attachedCitations(s.content, f.span.start, f.span.end, host, f.anchors, f.links);
    const raw = { version: 1 as const, id: key('EV', { source: s.id, hash: s.contentHash, span: f.span, type: f.fact.factType, ...(f.fact.sharedRecordId ? { subject: f.fact.subject } : {}), structured: { kind: f.structured.kind, index: f.structured.structureIndex, row: f.structured.row, column: f.structured.column } }), sourceId: s.id, sourceSpan: f.span, exactText: f.span.text, normalizedText: f.normalizedText, evidenceType: f.fact.factType, supports: f.fact, extractionConfidence: 'HIGH' as const, truthStatus: 'EXTRACTED' as const, extractionMethod: f.method, ...(s.language === 'en' ? { evidenceLanguage: 'en' as const } : {}), contextSpans: f.contextSpans, contentHash: s.contentHash, table: f.headerSpan ? { row: f.structured.row, column: f.structured.column, headerContext: f.structured.columnHeader ?? f.structured.rowHeader ?? '', headerSpan: f.headerSpan } : null, structured: f.structured, citations };
    const evidence = { ...raw, fingerprint: jsonHash(raw) }, c = { id: key('FC', { fact: f.fact, evidence: evidence.id }), canonicalFact: structuredClone(f.fact), evidenceIds: [evidence.id], extractionConfidence: 'HIGH' as const, status: 'EXTRACTED' as const };
    return { evidence, candidate: { ...c, fingerprint: jsonHash(c) } };
}
export function extractSourceEvidenceV2(s: SourceDocument, plan: ResearchPlan, maxItems: number,allSources:SourceDocument[]=[s]) {
    const policy = plan.policy, structures: Omit<StructuredSummary, 'evidenceIds'>[] = [], structuredFacts: StructuredFact[] = [], host = hostOf(s.canonicalLocator);
    if (s.language !== 'en' && s.language !== 'pt-BR')
        return { evidence: [] as Evidence[], candidates: [] as FactCandidate[], structures: [] as StructuredSummary[], truncated: 0, contexts: [] as DocumentContextSummary[], records: [] as StructuredRecord[] };
    const v3 = (policy.researchVersion ?? 1) >= 3, contexts: DocumentContextSummary[] = [], records: Omit<StructuredRecord, 'evidenceIds'>[] = [];
    const prose = s.language === 'en' ? extractEnglish(s, policy, Number.MAX_SAFE_INTEGER, policy.researchVersion === 4 ? 4 : v3 ? 3 : 2) : extractSourceEvidence(s, { ...policy, researchVersion: 1 }, Number.MAX_SAFE_INTEGER);
    // Phase 25: PROCESS routes also read literal mechanism clauses from documents about the requested subject.
    if (plan.request.researchGoal === 'PROCESS') { const m = extractMechanismEvidence(s, plan); prose.evidence.push(...m.evidence); prose.candidates.push(...m.candidates); }
    if (v3 && s.contentType === 'text/html') {
        // Phase 22: DocumentContext + context-aware tables + semi-structured records.
        const x = structuredV3(s, plan, parseHtmlStructures(s.content, host));
        structures.push(...x.structures);
        structuredFacts.push(...x.facts);
        contexts.push(x.context);
        records.push(...x.records.map(r => r.record));
    }
    else if (s.contentType === 'text/html') {
        const parsed = parseHtmlStructures(s.content, host), subject = documentSubject(s, parsed);
        for (const g of parsed.grids) {
            const r = interpretGrid(s.content, g, policy, s.language, subject);
            structures.push({ sourceId: s.id, ...r.summary });
            structuredFacts.push(...r.facts);
        }
        for (const l of [...parsed.lists, ...parsed.definitions]) {
            const r = interpretList(l, policy, s.language, subject);
            if (r.facts.length)
                structures.push({ sourceId: s.id, ...r.summary });
            structuredFacts.push(...r.facts);
        }
    }
    if (s.contentType === 'text/csv' || s.contentType === 'text/tab-separated-values') {
        const r = interpretGrid(s.content, parseDelimited(s.content, s.contentType === 'text/csv' ? ',' : '\t'), policy, s.language, null);
        structures.push({ sourceId: s.id, ...r.summary });
        structuredFacts.push(...r.facts);
    }
    const all: { evidence: Evidence; candidate: FactCandidate; structuredRef: string | null }[] = [];
    for (const f of structuredFacts.filter(f => relevantFact(f.fact, plan))) {
        const r = record(s, f);
        all.push({ ...r, structuredRef: f.structured.kind + ':' + f.structured.structureIndex });
    }
    for (const e of prose.evidence) {
        const candidate = prose.candidates.find(c => c.evidenceIds.includes(e.id))!;
        if (!relevantFact(candidate.canonicalFact, plan))
            continue;
        const { fingerprint, ...raw } = e, withCitations = { ...raw, citations: attachedCitations(s.content, e.sourceSpan.start, e.sourceSpan.end, host) };
        all.push({ evidence: { ...withCitations, fingerprint: jsonHash(withCitations) }, candidate, structuredRef: null });
    }
    const unique = all.filter((x, i) => all.findIndex(y => y.evidence.id === x.evidence.id) === i).filter(x => policy.researchVersion !== 4 || evidenceAllowedV4(x.evidence,s,allSources)).sort((a, b) => a.evidence.sourceSpan.start - b.evidence.sourceSpan.start || a.evidence.id.localeCompare(b.evidence.id, 'en'));
    const kept = unique.slice(0, maxItems);
    return { evidence: kept.map(x => x.evidence).sort((a, b) => a.id.localeCompare(b.id, 'en')), candidates: kept.map(x => x.candidate).sort((a, b) => a.id.localeCompare(b.id, 'en')), structures: structures.map(x => ({ ...x, evidenceIds: kept.filter(k => k.structuredRef === x.kind + ':' + x.index).map(k => k.evidence.id).sort() })), truncated: unique.length - kept.length, contexts, records: records.map((r, i) => ({ ...r, evidenceIds: kept.filter(k => k.structuredRef === 'RECORD:' + i).map(k => k.evidence.id).sort() })) };
}
// ---------- evidence quality (separate from source quality) ----------
export function assessEvidence(e: Evidence): EvidenceQualityAssessment {
    const f = e.supports, structured = Boolean(e.structured), contextual = (e.contextSpans?.length ?? 0) > 0 && !e.structured?.subjectSpan;
    const date = f.temporalContext ?? f.observationPeriod ?? null;
    const breakdown = {
        directness: { score: contextual ? 1 : 2, reason: contextual ? 'Subject supplied by document heading/lead context' : 'Subject stated in the evidence or its row' },
        subjectClarity: { score: e.structured?.subjectSpan || !contextual ? 2 : 1, reason: e.structured?.subjectSpan ? 'Subject cell/title span' : contextual ? 'Contextual subject' : 'Explicit subject' },
        metricClarity: { score: f.factType === 'RESIDENCY' ? 2 : f.metric ? 2 : 0, reason: f.metric ? 'Explicit metric ' + f.metric : f.factType === 'RESIDENCY' ? 'Explicit presence wording' : 'No metric' },
        qualifierClarity: { score: f.qualifiers.length ? (f.qualifiers.includes('REPORTED') || f.qualifiers.includes('APPROXIMATE') ? 1 : 2) : 0, reason: f.qualifiers.join(', ') || 'No qualifier' },
        temporalClarity: { score: f.qualifiers.includes('HISTORICAL') ? 0 : date && /\d{1,2}\s+[A-Z][a-z]+|[A-Z][a-z]+\s+\d{1,2},/.test(date) ? 2 : date ? 1 : f.factType === 'RESIDENCY' ? 1 : 0, reason: f.qualifiers.includes('HISTORICAL') ? 'Past-tense presence' : date ? 'Temporal anchor ' + date : 'No temporal anchor' },
        structuredContext: { score: structured ? (e.structured!.headerSpans.length ? 2 : 1) : 0, reason: structured ? e.structured!.kind + ' with header context' : 'Prose sentence' },
        extractability: { score: f.quantity && !normalize(e.exactText.replace(/[−–]/g, '-')).includes(normalize(f.quantity.originalValue)) ? 1 : 2, reason: 'Literal value/wording located inside the exact span' }
    };
    const score = Object.values(breakdown).reduce((n, v) => n + v.score, 0), raw = { evidenceId: e.id, grade: score >= 11 ? 'STRONG' as const : score >= 8 ? 'ADEQUATE' as const : 'WEAK' as const, breakdown, score };
    return { ...raw, fingerprint: jsonHash(raw) };
}
// ---------- identity, conflicts and grounding ----------
const EPISTEMIC = new Set(['REPORTED']);
const CONTEXT_EXCLUSIVE = ['MINIMUM_RECORDED', 'SURFACE_TEMPERATURE_MINIMUM', 'SATELLITE_ESTIMATE', 'WIND_CHILL', 'MONTHLY_MINIMUM', 'AVERAGE_DAILY_MINIMUM', 'AVERAGE', 'DAILY_MINIMUM'];
const year = (t: string | null | undefined) => t?.match(/\b(1[6-9]\d\d|20\d\d)\b/)?.[1] ?? null;
export function identityV2(f: CanonicalFact, canonical: Map<string, string>, withValue = true) { const subject = canonical.get(normalize(f.subject)) ?? f.subject; return { factType: f.factType, subject: normalize(subject), ...(f.subjectKind ? { subjectKind: f.subjectKind } : {}), predicate: f.predicate, object: f.object, metric: f.metric, residency: f.residency, qualifiers: f.qualifiers.filter(q => !EPISTEMIC.has(q)).sort(), quantity: f.quantity ? (withValue ? { value: f.quantity.normalizedValue, unit: f.quantity.normalizedUnit, approximation: f.quantity.approximation } : { unit: f.quantity.normalizedUnit, approximation: f.quantity.approximation }) : null, census: f.factType === 'QUANTITY' ? year(f.temporalContext) : null }; }
function conflict(type: FactConflict['conflictType'], a: FactCandidate[], b: FactCandidate[], factKey: string, reason: string): FactConflict { const raw = { factKey, evidenceA: [...new Set(a.flatMap(c => c.evidenceIds))].sort(), evidenceB: [...new Set(b.flatMap(c => c.evidenceIds))].sort(), factCandidateIds: [...new Set([...a, ...b].map(c => c.id))].sort(), conflictType: type, resolutionStatus: 'UNRESOLVED' as const, reason }; return { id: 'CONFLICT_' + jsonHash(raw).slice(0, 20), ...raw }; }
export function detectConflictsV2(candidates: FactCandidate[], evidence: Map<string, Evidence>, groupOf: Map<string, string>, canonical: Map<string, string>, contradicted: [string, string][], version=2): FactConflict[] {
    const out: FactConflict[] = [], cs = [...candidates].sort((a, b) => a.id.localeCompare(b.id, 'en')), group = (c: FactCandidate) => groupOf.get(evidence.get(c.evidenceIds[0])!.sourceId);
    for (let i = 0; i < cs.length; i++)
        for (let j = i + 1; j < cs.length; j++) {
            const a = cs[i], b = cs[j], fa = a.canonicalFact, fb = b.canonicalFact, ia = identityV2(fa, canonical), ib = identityV2(fb, canonical);
            if (ia.subject !== ib.subject || fa.factType !== fb.factType)
                continue;
            if (version === 4 && separateMeasurementContexts(fa, fb))
                continue;
            if (fa.quantity && fb.quantity && jsonHash(identityV2(fa, canonical, false)) === jsonHash(identityV2(fb, canonical, false)) && fa.quantity.normalizedValue !== fb.quantity.normalizedValue)
                out.push(conflict(group(a) === group(b) ? 'SOURCE_ORIGIN_CONFLICT' : 'VALUE_CONFLICT', [a], [b], jsonHash(identityV2(fa, canonical, false)), group(a) === group(b) ? 'One origin group reports two values for the same entity/metric/qualifiers' : 'Same entity, metric and qualifiers with different values; unresolved'));
            if (jsonHash(ia) === jsonHash(ib) && fa.factType === 'MEASUREMENT' && year(fa.temporalContext) && year(fb.temporalContext) && year(fa.temporalContext) !== year(fb.temporalContext))
                out.push(conflict('TEMPORAL_CONFLICT', [a], [b], jsonHash(ia), 'Same record value attributed to different dates'));
            if (fa.quantity && fb.quantity && fa.metric === fb.metric && fa.quantity.normalizedValue === fb.quantity.normalizedValue && fa.quantity.normalizedUnit === fb.quantity.normalizedUnit) {
                const qa = fa.qualifiers.filter(q => CONTEXT_EXCLUSIVE.includes(q)), qb = fb.qualifiers.filter(q => CONTEXT_EXCLUSIVE.includes(q));
                if (qa.length && qb.length && qa.join() !== qb.join())
                    out.push(conflict('QUALIFIER_CONFLICT', [a], [b], jsonHash({ subject: ia.subject, value: fa.quantity.normalizedValue }), 'The same value is described with incompatible measurement contexts'));
            }
            const present = (f: CanonicalFact) => (f.residency === 'PERMANENT_POPULATION' || f.residency === 'PERMANENT_SETTLEMENT') && !f.qualifiers.includes('HISTORICAL');
            if (fa.factType === 'RESIDENCY' && (present(fa) && fb.residency === 'UNINHABITED' || present(fb) && fa.residency === 'UNINHABITED'))
                out.push(conflict('RESIDENCY_CONFLICT', [a], [b], jsonHash({ subject: ia.subject, type: 'RESIDENCY' }), 'Current permanent presence and uninhabited status both asserted'));
        }
    for (const [x, y] of contradicted) {
        const a = cs.filter(c => normalize(c.canonicalFact.subject) === normalize(x)), b = cs.filter(c => normalize(c.canonicalFact.subject) === normalize(y));
        if (a.length && b.length)
            out.push(conflict('ENTITY_CONFLICT', a, b, jsonHash([x, y].map(normalize).sort()), 'Sources both assert and reject that these names denote the same entity'));
    }
    return out.filter((c, i) => out.findIndex(d => d.id === c.id) === i).sort((a, b) => a.id.localeCompare(b.id, 'en'));
}
const TYPE_RANK: Record<string, number> = { PRIMARY_OFFICIAL: 0, PRIMARY_DATASET: 0, ACADEMIC: 1, INSTITUTIONAL: 1, REFERENCE: 2, NEWS: 2, OTHER: 3 };
const gradeOk = (g: string | undefined, min: 'HIGH' | 'MEDIUM') => g === 'HIGH' || min === 'MEDIUM' && g === 'MEDIUM';
export function quorumFor(policy: ResearchPolicy, type: string): FactTypeQuorum { return policy.factTypeQuorum?.[type as 'MEASUREMENT'] ?? { minIndependentOrigins: policy.minIndependentSources }; }
/** Corroboration counts independent origin roots, not pages: derived evidence (citing or reporting another supporting session source) adds no origin; shared citations merge roots. */
export function groundFactsV2(candidates: FactCandidate[], evidence: Evidence[], sources: SourceDocument[], assessments: SourceQualityAssessment[], conflicts: FactConflict[], policy: ResearchPolicy, groupOf: Map<string, string>, cites: Map<string, Set<string>>, canonical: Map<string, string>, quality: Map<string, EvidenceQualityAssessment>): { facts: GroundedFact[]; relations: Omit<OriginRelation, 'id'>[] } {
    const byEvidence = new Map(evidence.map(e => [e.id, e])), bySource = new Map(sources.map(s => [s.id, s])), grade = new Map(assessments.map(a => [a.sourceId, a.grade])), grouped = new Map<string, FactCandidate[]>(), relations: Omit<OriginRelation, 'id'>[] = [];
    const windows=new Map<string,Set<string>>();
    if(policy.researchVersion===4)for(const c of candidates){const k=jsonHash(identityV2(c.canonicalFact,canonical)),period=c.canonicalFact.observationPeriod;if(period)windows.set(k,(windows.get(k)??new Set()).add(period));}
    for (const c of [...candidates].sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
        const tuple=identityV2(c.canonicalFact,canonical),baseKey=jsonHash(tuple),k=policy.researchVersion===4&&(windows.get(baseKey)?.size??0)>1?jsonHash({...tuple,observationPeriod:c.canonicalFact.observationPeriod??null}):baseKey;
        grouped.set(k, [...(grouped.get(k) ?? []), c]);
    }
    const facts = [...grouped.entries()].map(([k, cs]) => {
        const id = 'GF_' + k.slice(0, 20), evidenceIds = [...new Set(cs.flatMap(c => c.evidenceIds))].sort(), ev = evidenceIds.map(x => byEvidence.get(x)!), sourceIds = [...new Set(ev.map(e => e.sourceId))].sort();
        const qualified = ev.filter(e => gradeOk(grade.get(e.sourceId), policy.minPrimaryQuality));
        const supporting = new Set(sourceIds), locatorOwner = new Map(sourceIds.flatMap(sid => sourceLocators(bySource.get(sid)!).map(l => [l, sid] as const)));
        const attribution = (e: Evidence) => normalize(e.exactText.replace(/<[^>]*>/g, ' ')).match(/\baccording to (?:the )?([a-z][\w .&'-]{2,60})/)?.[1]?.trim() ?? null;
        const derivedFrom = (e: Evidence) => { const own = groupOf.get(e.sourceId), out = new Map<string, OriginRelation['relation']>(); for (const u of e.citations ?? []) {
            const target = locatorOwner.get(u);
            if (target && groupOf.get(target) !== own)
                out.set(target, 'DERIVED_FROM');
        } for (const target of cites.get(e.sourceId) ?? [])
            if (supporting.has(target) && groupOf.get(target) !== own)
                out.set(target, out.get(target) ?? 'DERIVED_FROM'); const who = attribution(e); if (who)
            for (const sid of sourceIds) {
                const s = bySource.get(sid)!;
                if (groupOf.get(sid) !== own && (normalize(s.publisher).includes(who) || normalize(s.title).startsWith(who)))
                    out.set(sid, 'REPORTS');
            } return out; };
        // Mutual derivation cannot erase both sides: a cycle keeps the evidence as a root.
        const derivation = new Map(ev.map(e => [e.id, derivedFrom(e)])), derived = ev.filter(e => [...derivation.get(e.id)!.keys()].some(t => !ev.filter(x => x.sourceId === t).every(x => [...derivation.get(x.id)!.keys()].includes(e.sourceId))));
        for (const e of derived)
            for (const [target, relation] of derivation.get(e.id)!)
                relations.push({ from: e.sourceId, to: target, relation, factId: id, evidenceIds: [e.id], reason: relation === 'REPORTS' ? 'Evidence attributes the value to the publisher of another supporting source' : 'Evidence cites another session source that supports the same fact' });
        const roots = qualified.filter(e => !derived.includes(e)), parent = new Map(roots.map(e => [e.id, e.id])), owner = new Map<string, string>();
        const find = (x: string): string => { const p = parent.get(x)!; if (p === x)
            return x; const r = find(p); parent.set(x, r); return r; };
        for (const e of roots)
            for (const token of ['group:' + groupOf.get(e.sourceId), ...(e.citations ?? []).map(u => 'cite:' + u), ...[...derivation.get(e.id)!.keys()].map(t => 'group:' + groupOf.get(t))]) {
                const o = owner.get(token);
                if (o)
                    parent.set(find(e.id), find(o));
                else
                    owner.set(token, e.id);
            }
        if ((policy.researchVersion ?? 1) >= 3)
            for (let i = 0; i < roots.length; i++)
                for (let j = i + 1; j < roots.length; j++) {
                    const a = roots[i], b = roots[j], near = find(a.id) !== find(b.id) ? factWindowNearCopy(a, b) : { similar: false, score: 0 };
                    if (near.similar) {
                        parent.set(find(b.id), find(a.id));
                        relations.push({ from: a.sourceId, to: b.sourceId, relation: 'NEAR_COPY', factId: id, evidenceIds: [a.id, b.id], reason: 'POSSIBLE_SHARED_ORIGIN: the factual sentences share ' + near.score + ' of their word 4-grams' });
                    }
                }
        const rootSets = new Map<string, string[]>();
        for (const e of roots)
            rootSets.set(find(e.id), [...(rootSets.get(find(e.id)) ?? []), e.id]);
        const originRoots = [...rootSets.values()].map(x => x.sort()).sort((a, b) => a[0].localeCompare(b[0], 'en')), q = quorumFor(policy, cs[0].canonicalFact.factType);
        const authority = q.singleOriginAuthority ? roots.find(e => q.singleOriginAuthority!.sourceTypes.includes(bySource.get(e.sourceId)!.sourceType) && gradeOk(grade.get(e.sourceId), q.singleOriginAuthority!.minGrade)) : undefined;
        const conflictIds = conflicts.filter(c => c.factCandidateIds.some(x => cs.some(f => f.id === x))).map(c => c.id).sort(), enough = originRoots.length >= q.minIndependentOrigins || Boolean(authority);
        const status = conflictIds.length ? 'CONFLICTED' as const : !enough ? 'INSUFFICIENT' as const : originRoots.length >= 2 ? 'CORROBORATED' as const : 'SUPPORTED' as const;
        const primary = [...roots].sort((a, b) => TYPE_RANK[bySource.get(a.sourceId)!.sourceType] - TYPE_RANK[bySource.get(b.sourceId)!.sourceType] || (quality.get(b.id)?.score ?? 0) - (quality.get(a.id)?.score ?? 0) || a.id.localeCompare(b.id, 'en'))[0] ?? null;
        for (const root of originRoots) {
            const e = byEvidence.get(root[0])!;
            relations.push({ from: e.sourceId, to: 'FACT:' + id, relation: 'PRIMARY_ORIGIN', factId: id, evidenceIds: root, reason: 'Earliest detectable origin of this fact within the session (source class ' + bySource.get(e.sourceId)!.sourceType + '); not proof of the original publisher' });
        }
        for (let i = 0; i < originRoots.length; i++)
            for (let j = i + 1; j < originRoots.length; j++)
                relations.push({ from: byEvidence.get(originRoots[i][0])!.sourceId, to: byEvidence.get(originRoots[j][0])!.sourceId, relation: 'UNKNOWN_RELATION', factId: id, evidenceIds: [originRoots[i][0], originRoots[j][0]], reason: 'No mirror, publisher, citation or attribution relation detectable in the snapshots; counted as independent origins' });
        // Canonical tuple: compatible dates collapse to the most specific; reported only if every evidence is reported.
        const first = structuredClone(cs[0].canonicalFact), dates = [...new Set(cs.map(c => c.canonicalFact.temporalContext).filter((x): x is string => Boolean(x)))].sort((a, b) => b.length - a.length || a.localeCompare(b, 'en'));
        first.subject = canonical.get(normalize(first.subject)) ?? first.subject;
        if (first.factType === 'RESIDENCY')
            first.temporalContext = dates.sort((a, b) => Number(year(b) ?? 0) - Number(year(a) ?? 0))[0] ?? null;
        else if (first.factType === 'MEASUREMENT')
            first.temporalContext = new Set(dates.map(year)).size <= 1 ? dates[0] ?? null : first.temporalContext;
        first.observationPeriod = cs.map(c => c.canonicalFact.observationPeriod).find(Boolean) ?? null;
        first.qualifiers = [...first.qualifiers.filter(q => !EPISTEMIC.has(q)), ...(cs.every(c => c.canonicalFact.qualifiers.includes('REPORTED')) ? ['REPORTED'] : [])];
        const groups = [...new Set(sourceIds.map(s => groupOf.get(s)!))], sharedOrigin = groups.map(g => sourceIds.filter(s => groupOf.get(s) === g)).filter(g => g.length > 1);
        const admission = conflictIds.length ? 'CONFLICTED' : originRoots.length >= q.minIndependentOrigins ? 'QUORUM ' + originRoots.length + '/' + q.minIndependentOrigins + ' independent origin roots' : authority ? 'SINGLE_ORIGIN_AUTHORITY ' + bySource.get(authority.sourceId)!.sourceType + ' ' + grade.get(authority.sourceId) : 'INSUFFICIENT ' + originRoots.length + '/' + q.minIndependentOrigins + ' independent origin roots';
        const raw = { id, canonicalFact: first, factType: first.factType, evidenceIds, sourceIds, factCandidateIds: cs.map(c => c.id).sort(), status, corroborationStatus: originRoots.length >= 2 ? 'CORROBORATED' as const : originRoots.length === 1 ? 'SINGLE_ORIGIN' as const : 'INSUFFICIENT' as const, independentOriginCount: originRoots.length, sharedOrigin, conflicts: conflictIds, qualifiers: [...first.qualifiers], usableForScript: !conflictIds.length && enough, usableForPrimaryClaim: !conflictIds.length && enough, origins: { roots: originRoots, derivedEvidenceIds: derived.map(e => e.id).sort(), primaryEvidenceId: primary?.id ?? null, admission, supportScore: originRoots.length * 10 + (primary ? quality.get(primary.id)?.score ?? 0 : 0) + (primary && TYPE_RANK[bySource.get(primary.sourceId)!.sourceType] === 0 ? 5 : 0) } };
        return { ...raw, groundingFingerprint: jsonHash(raw) };
    }).sort((a, b) => a.id.localeCompare(b.id, 'en'));
    return { facts, relations };
}
/** Pure v2 core used by buildEvidencePack: extraction, SourceGraph, aliases, evidence quality, conflicts and grounding. */
export function researchV2(plan: ResearchPlan, sources: SourceDocument[], assessments: SourceQualityAssessment[], accepted: Set<string>, maxEvidence: number) {
    const diagnostics: ResearchV2Section['diagnostics'] = [], extracted = sources.filter(s => accepted.has(s.id)).map(s => ({ s, x: extractSourceEvidenceV2(s, plan, maxEvidence,sources) }));
    if(plan.policy.researchVersion===4)for(const {s,x} of extracted)if(['text/csv','text/tab-separated-values'].includes(s.contentType)&&!x.evidence.length)diagnostics.push({code:'EVIDENCE_EXTRACTION_GAP',subject:s.metadata.datasetTarget?.name??null,detail:s.id+' DATASET_ENTITY_MATCH_GAP: no row with validated identifier/administrative context; name-only rows remain candidates'});
    for (const { s, x } of extracted)
        if (x.truncated)
            diagnostics.push({ code: 'EVIDENCE_BUDGET_TRUNCATED', subject: null, detail: s.id + ' dropped ' + x.truncated + ' items beyond the per-source evidence budget' });
    // Pack-level budget: round-robin across sources in id order, preserving each source's span order.
    const queues = extracted.map(({ x }) => x.evidence.slice().sort((a, b) => a.sourceSpan.start - b.sourceSpan.start || a.id.localeCompare(b.id, 'en'))), kept: Evidence[] = [];
    for (let round = 0; kept.length < maxEvidence && queues.some(q => q.length > round); round++)
        for (const q of queues)
            if (q[round] && kept.length < maxEvidence)
                kept.push(q[round]);
    const total = queues.reduce((n, q) => n + q.length, 0);
    if (total > kept.length)
        diagnostics.push({ code: 'EVIDENCE_BUDGET_TRUNCATED', subject: null, detail: 'Pack kept ' + kept.length + ' of ' + total + ' evidence items (round-robin by source)' });
    const keptIds = new Set(kept.map(e => e.id)), candidates = extracted.flatMap(({ x }) => x.candidates).filter(c => c.evidenceIds.every(id => keptIds.has(id)));
    const built = buildSourceGraph(sources, assessments, kept), subjects = [...new Set(candidates.map(c => c.canonicalFact.subject))], alias = resolveAliases(sources.filter(s => accepted.has(s.id)), subjects, (plan.policy.researchVersion ?? 1) >= 3 ? 3 : 2);
    const evidence = kept.map(e => { const { fingerprint, ...raw } = e, withGroup = { ...raw, originGroupId: built.groupOf.get(e.sourceId)! }; return { ...withGroup, fingerprint: jsonHash(withGroup) }; }).sort((a, b) => a.id.localeCompare(b.id, 'en'));
    const byId = new Map(evidence.map(e => [e.id, e])), assessmentsE = evidence.map(assessEvidence), quality = new Map(assessmentsE.map(a => [a.evidenceId, a]));
    const conflicts = detectConflictsV2(candidates, byId, built.groupOf, alias.canonical, alias.contradicted, plan.policy.researchVersion), grounded = groundFactsV2(candidates, evidence, sources, assessments, conflicts, plan.policy, built.groupOf, built.cites, alias.canonical, quality);
    for (const f of grounded.facts) {
        if (f.status === 'INSUFFICIENT')
            diagnostics.push({ code: 'CORROBORATION_GAP', subject: f.canonicalFact.subject, detail: f.id + ' ' + (f.origins?.admission ?? '') });
        if (f.status === 'CONFLICTED')
            diagnostics.push({ code: 'FACT_CONFLICT', subject: f.canonicalFact.subject, detail: f.id + ' ' + f.conflicts.join(',') });
    }
    const structures = extracted.flatMap(({ x }) => x.structures).map(st => ({ ...st, evidenceIds: st.evidenceIds.filter(id => keptIds.has(id)) }));
    for (const st of structures.filter(st => st.status === 'REJECTED'))
        diagnostics.push({ code: 'EVIDENCE_EXTRACTION_GAP', subject: null, detail: st.sourceId + ' ' + st.kind + '#' + st.index + ' ' + st.reason });
    const section: ResearchV2Section = { version: RESEARCH_V2_VERSION, sourceGraph: withFactRelations(built.graph, grounded.relations), originGroups: built.groups.map(g => ({ ...g, evidenceIds: g.evidenceIds.filter(id => keptIds.has(id)) })), evidenceAssessments: assessmentsE, aliases: alias.aliases, structures, diagnostics: diagnostics.sort((a, b) => a.code.localeCompare(b.code, 'en') || (a.subject ?? '').localeCompare(b.subject ?? '', 'en') || a.detail.localeCompare(b.detail, 'en')) };
    return { evidence, factCandidates: candidates.sort((a, b) => a.id.localeCompare(b.id, 'en')), conflicts, groundedFacts: grounded.facts, section, independentOriginGroups: built.groups.length, contexts: extracted.flatMap(({ x }) => x.contexts), records: extracted.flatMap(({ x }) => x.records).map(r => ({ ...r, evidenceIds: r.evidenceIds.filter(id => keptIds.has(id)) })), aliases: alias.aliases };
}
