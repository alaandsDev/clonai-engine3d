import type { SemanticInput, SemanticAnalysis } from './contracts';
import { SEMANTIC_VERSION } from './contracts';
import { sentences } from './sentences';
import { predicates as parsePredicates } from './predicates';
import { quantities as parseQuantities, quantityRules } from './quantities';
import { extractEntities } from './entities';
import { relations as parseRelations } from './relations';
import { extractClaims } from './claims';
import { semanticQa } from './qa';
import { entityRules, predicateRules, referenceWindow, confidenceWeights, confidenceThresholds, causalMarkers, temporalMarkers } from './rules';
const rules = { entityRules, predicateRules, referenceWindow, confidenceWeights, confidenceThresholds, causalMarkers, temporalMarkers };
import { jsonHash } from '../editorial/fingerprint';
export function parseSemantics(input: SemanticInput) {
    const narrativeUnits = sentences(input), predicates = narrativeUnits.flatMap(parsePredicates), quantities = narrativeUnits.flatMap(parseQuantities);
    predicates.forEach((p, i) => p.id = 'P' + (i + 1));
    quantities.forEach((q, i) => q.id = 'Q' + (i + 1));
    const { entities, mentions, references, ambiguities, contexts } = extractEntities(input.script, narrativeUnits, predicates);
    for (const q of quantities.filter(q => ['COUNT', 'RANK'].includes(q.dimension))) {
        const id = 'E' + (entities.length + 1), mentionId = 'M' + (mentions.length + 1);
        entities.push({ id, type: 'NUMBER', canonicalName: String(q.value), semanticTags: [q.dimension === 'RANK' ? 'ranking' : 'number'], gender: 'UNKNOWN', number: 'SINGULAR', sourceSpan: q.sourceSpan, mentionIds: [mentionId] });
        mentions.push({ id: mentionId, unitId: q.unitId, entityId: id, kind: 'NOUN', sourceSpan: q.sourceSpan, role: 'OTHER' });
    }
    for (const context of contexts)
        context.currentRanking = quantities.find(q => q.unitId === context.unitId && q.dimension === 'RANK')?.id ?? null;
    // Conservative double-negation scope: preserve negation and explicitly abstain.
    for (const u of narrativeUnits)
        if ((u.sourceSpan.text.match(/\bnão\b/gu) ?? []).length > 1) {
            const id = 'A' + (ambiguities.length + 1);
            ambiguities.push({ id, unitId: u.id, type: 'CONFLICTING_INTERPRETATIONS', sourceSpan: u.sourceSpan, reason: 'Multiple negations: scope unsupported; no cancellation into a positive assertion', referenceIds: [], critical: true });
            for (const p of predicates.filter(p => p.unitId === u.id))
                p.ambiguityIds.push(id);
        }
    const relations = parseRelations(input.script, narrativeUnits, entities, mentions, predicates, quantities);
    for (const relation of relations.filter(r => r.type === 'STATE_CHANGE' && r.quantityIds.length >= 2))
        if (relation.details.direction !== relation.details.statedPredicate || relation.confidence === 'LOW') {
            const id = 'A' + (ambiguities.length + 1);
            ambiguities.push({ id, unitId: relation.unitId, type: 'CONFLICTING_INTERPRETATIONS', sourceSpan: relation.sourceSpan, reason: 'Numeric direction/dimensions conflict with the textual change predicate; no silent factual correction', referenceIds: [], critical: true });
            relation.confidence = 'LOW';
            for (const p of predicates.filter(p => relation.predicateIds.includes(p.id)))
                p.ambiguityIds.push(id);
        }
    return { narrativeUnits, entities, mentions, references, predicates, quantities, relations, ambiguities, contexts };
}
export function compileSemanticAnalysis(input: SemanticInput, parsed: ReturnType<typeof parseSemantics>): SemanticAnalysis {
    const data = structuredClone(parsed), claims = extractClaims(data.narrativeUnits, data.entities, data.predicates, data.references, data.quantities, data.relations, data.ambiguities);
    const represented = new Set(claims.filter(c => c.status === 'RESOLVED' && c.confidence !== 'LOW').flatMap(c => c.executionUnitIds));
    const unresolved = claims.filter(c => c.status !== 'RESOLVED' || c.confidence === 'LOW');
    const confidenceSummary = { narrativeUnitCount: data.narrativeUnits.length, entityCount: data.entities.length, mentionCount: data.mentions.length, referenceCount: data.references.length, resolvedReferenceCount: data.references.filter(r => r.selectedEntityId !== null).length, ambiguousReferenceCount: data.references.filter(r => r.confidence === 'AMBIGUOUS').length, relationCount: data.relations.length, claimCount: claims.length, highConfidenceClaimCount: claims.filter(c => c.confidence === 'HIGH').length, mediumConfidenceClaimCount: claims.filter(c => c.confidence === 'MEDIUM').length, lowConfidenceClaimCount: claims.filter(c => c.confidence === 'LOW').length, unresolvedClaimCount: unresolved.length, negatedClaimCount: claims.filter(c => c.negated).length, modalClaimCount: claims.filter(c => c.modality !== 'ASSERTED').length, scriptClaimCoverage: represented.size / data.narrativeUnits.length, unsupportedSpanRate: new Set(unresolved.map(c => c.unitId)).size / data.narrativeUnits.length, ambiguityCount: data.ambiguities.length, ambiguityRate: claims.filter(c => c.ambiguityIds.length).length / Math.max(1, claims.length), abstentionRate: unresolved.length / Math.max(1, claims.length) };
    const raw: Omit<SemanticAnalysis, 'fingerprint'> = { version: 1, engineVersion: SEMANTIC_VERSION, id: input.id, script: input.script, scriptFingerprint: jsonHash(input.script), language: input.language, ...data, claims, unresolvedReferences: data.references.filter(r => r.selectedEntityId === null).map(r => r.id), confidenceSummary, provenance: { rulesFingerprint: jsonHash({ rules, quantityRules, version: SEMANTIC_VERSION }), externalKnowledgeUsed: false, offsetConvention: 'UTF16_HALF_OPEN', precisionPolicy: 'PRECISION_OVER_RECALL' } };
    const result = { ...raw, fingerprint: jsonHash(raw) };
    semanticQa(result);
    return result;
}
export function analyzeScript(input: SemanticInput) { return compileSemanticAnalysis(input, parseSemantics(input)); }
