import { jsonHash } from '../editorial/fingerprint';
import { normalize } from '../semantics/normalize';
import type { CanonicalFact, SourceDocument, SourceQualityAssessment, FactCandidate, FactConflict, GroundedFact, ResearchPolicy, Evidence } from './contracts';
export function factIdentity(f: CanonicalFact, withValue = true) { return { ...f, subject: normalize(f.subject), qualifiers: [...f.qualifiers].sort(), quantity: f.quantity ? (withValue ? { value: f.quantity.normalizedValue, unit: f.quantity.normalizedUnit, approximation: f.quantity.approximation } : { unit: f.quantity.normalizedUnit, approximation: f.quantity.approximation }) : null }; }
export function sourceOriginGroups(sources: SourceDocument[]): string[][] { const groups = sources.map(s => [s.id]), byId = new Map(sources.map(s => [s.id, s])); const tokens = (id: string) => { const s = byId.get(id)!; return new Set(['hash:' + s.contentHash, 'normalized:' + jsonHash(s.normalized.text), 'locator:' + s.canonicalLocator, 'publisher:' + normalize(s.publisher), 'origin:' + s.provenance.originKey, ...(s.provenance.sharedOriginKeys ?? []).map(k => 'origin:' + k)]); }; let changed = true; while (changed) {
    changed = false;
    outer: for (let i = 0; i < groups.length; i++)
        for (let j = i + 1; j < groups.length; j++) {
            const left = new Set(groups[i].flatMap(id => [...tokens(id)]));
            if (groups[j].some(id => [...tokens(id)].some(t => left.has(t)))) {
                groups[i].push(...groups[j]);
                groups.splice(j, 1);
                changed = true;
                break outer;
            }
        }
} return groups.map(g => g.sort()).sort((a, b) => a[0].localeCompare(b[0], 'en')); }
export function detectConflicts(input: FactCandidate[]): FactConflict[] { const candidates = [...input].sort((a, b) => a.id.localeCompare(b.id, 'en')), conflicts: FactConflict[] = []; for (let i = 0; i < candidates.length; i++)
    for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i], b = candidates[j];
        if (!a.canonicalFact.quantity || !b.canonicalFact.quantity || jsonHash(factIdentity(a.canonicalFact, false)) !== jsonHash(factIdentity(b.canonicalFact, false)) || a.canonicalFact.quantity.normalizedValue === b.canonicalFact.quantity.normalizedValue)
            continue;
        const raw = { factKey: jsonHash(factIdentity(a.canonicalFact, false)), evidenceA: [...a.evidenceIds].sort(), evidenceB: [...b.evidenceIds].sort(), factCandidateIds: [a.id, b.id].sort(), conflictType: 'QUANTITY_DISAGREEMENT' as const, resolutionStatus: 'UNRESOLVED' as const, reason: 'Same entity, metric, critical qualifiers and temporal context; different source quantities. No convenience-based resolution.' };
        conflicts.push({ id: 'CONFLICT_' + jsonHash(raw).slice(0, 20), ...raw });
    } return conflicts.sort((a, b) => a.id.localeCompare(b.id, 'en')); }
export function groundFacts(candidates: FactCandidate[], evidence: Evidence[], sources: SourceDocument[], assessments: SourceQualityAssessment[], conflicts: FactConflict[], policy: ResearchPolicy): GroundedFact[] {
    const grouped = new Map<string, FactCandidate[]>(), origins = sourceOriginGroups(sources), byEvidence = new Map(evidence.map(e => [e.id, e])), quality = new Map(assessments.map(a => [a.sourceId, a.grade]));
    for (const c of [...candidates].sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
        const key = jsonHash(factIdentity(c.canonicalFact));
        grouped.set(key, [...(grouped.get(key) ?? []), c]);
    }
    return [...grouped.entries()].map(([key, cs]) => {
        const evidenceIds = [...new Set(cs.flatMap(c => c.evidenceIds))].sort(), sourceIds = [...new Set(evidenceIds.map(id => byEvidence.get(id)!.sourceId))].sort(), qualified = sourceIds.filter(id => quality.get(id) === 'HIGH' || policy.minPrimaryQuality === 'MEDIUM' && quality.get(id) === 'MEDIUM'), independent = origins.filter(g => g.some(id => qualified.includes(id))), sharedOrigin = origins.filter(g => g.length > 1 && g.some(id => sourceIds.includes(id))), conflictIds = conflicts.filter(c => c.factCandidateIds.some(id => cs.some(f => f.id === id))).map(c => c.id).sort(), enough = independent.length >= policy.minIndependentSources, status = conflictIds.length ? 'CONFLICTED' as const : !enough ? 'INSUFFICIENT' as const : independent.length >= 2 ? 'CORROBORATED' as const : 'SUPPORTED' as const;
        const raw = { id: 'GF_' + key.slice(0, 20), canonicalFact: structuredClone(cs[0].canonicalFact), factType: cs[0].canonicalFact.factType, evidenceIds, sourceIds, factCandidateIds: cs.map(c => c.id).sort(), status, corroborationStatus: independent.length >= 2 ? 'CORROBORATED' as const : independent.length === 1 ? 'SINGLE_ORIGIN' as const : 'INSUFFICIENT' as const, independentOriginCount: independent.length, sharedOrigin, conflicts: conflictIds, qualifiers: [...cs[0].canonicalFact.qualifiers], usableForScript: !conflictIds.length && enough, usableForPrimaryClaim: !conflictIds.length && enough };
        return { ...raw, groundingFingerprint: jsonHash(raw) };
    }).sort((a, b) => a.id.localeCompare(b.id, 'en'));
}
