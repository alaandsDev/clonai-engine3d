import { jsonHash } from '../editorial/fingerprint';
import { fail } from '../engine3d/contracts';
import type { AutoDirectorInput, AutoDirectorPlan, CapabilityNode, Selection, VisualGap } from './contracts';
import { PLANNER_VERSION } from './contracts';
import { segmentScript, extractClaims } from './claims';
import { capabilityGraph } from './capabilities';
import { selectTemplate, templates, scoreWeights } from './scoring';
import { generate } from './templates';
import { proofChecks } from './qa';
export function planAutoDirector(input: AutoDirectorInput, snapshot: CapabilityNode[] = capabilityGraph()): AutoDirectorPlan {
    const units = segmentScript(input), claims = extractClaims(input, units), graph = structuredClone(snapshot).sort((a, b) => a.id < b.id ? -1 : 1), selections: Selection[] = [], gaps: VisualGap[] = [];
    const gap = (c: typeof claims[number], reason: VisualGap['reason']) => {
        const required = templates.filter(t => c.semanticTags.includes(t.tag)).flatMap(t => t.caps);
        const available = new Set(graph.flatMap(n => n.capabilities));
        gaps.push({ id: 'gap_' + c.id, claimId: c.id, reason,
            missingCapabilities: [...new Set(required.filter(cap => !available.has(cap)))].sort(),
            missingSemanticSubjects: c.semanticTags.length ? c.semanticTags : ['unresolved_subject'],
            bestAvailableProof: 'NONE', recommendedResolution: reason === 'MISSING_SUBJECT' ? 'EXTERNAL_MEDIA' : reason === 'MISSING_CAPABILITY' ? 'ADD_ENGINE_RESOURCE' : 'HUMAN_DIRECTION' });
    };
    let candidateEvaluations = 0;
    for (const c of claims) {
        if (!c.requiresVisualProof && c.type === 'CONCLUSION') {
            selections.push({ claimId: c.id, template: 'CONTEXT', mode: 'TEXT_FOCUS', resourceIds: [], score: 0, scoreBreakdown: { editorialContext: 0 }, reason: 'Conclusão/contexto preservado; não exige prova nem presenter genérico', alternatives: [], plannedProof: 'NONE' });
            continue;
        }
        if(c.extraction?.visualSafety==='ABSTAIN'){
            gap(c,c.extraction.status!=='RESOLVED'||c.extraction.ambiguityIds.length?'EDITORIAL_AMBIGUITY':c.confidence==='LOW'?'LOW_CLAIM_CONFIDENCE':'UNSUPPORTED_RELATION');
            continue;
        }
        if (c.requiresVisualProof && (c.semanticTags.includes('negated') || c.semanticTags.includes('unsupported_process'))) {
            gap(c, 'UNSUPPORTED_RELATION');
            continue;
        }
        if (c.confidence === 'LOW' && c.requiresVisualProof) {
            gap(c, 'LOW_CLAIM_CONFIDENCE');
            continue;
        }
        // Unsupported crowd subjects exit the resolver before candidate scoring.
        if (!c.semanticTags.includes('scientific_crowd')) candidateEvaluations += templates.length;
        const s = selectTemplate(c, graph, selections.at(-1));
        if (!s) {
            gap(c, c.semanticTags.includes('scientific_crowd') ? 'MISSING_SUBJECT' : 'INSUFFICIENT_PROOF');
            continue;
        }
        selections.push(s);
    }
    const domains = new Set(claims.filter(c => c.requiresVisualProof && !gaps.some(g => g.claimId === c.id)).map(c => c.semanticTags.includes('liquid') ? 'liquid' : c.semanticTags.includes('freezable') ? 'freezable' : c.type));
    if (domains.size > 1)
        for (const c of claims.filter(c => c.requiresVisualProof && !gaps.some(g => g.claimId === c.id)))
            gap(c, 'RESOURCE_CONFLICT');
    let artifacts = { sequences: [] as AutoDirectorPlan['directedSequences'], demonstrations: [] as AutoDirectorPlan['demonstrations'] };
    if (!gaps.length) {
        try {
            artifacts = generate(input, units, claims, selections);
        }
        catch {
            for (const c of claims.filter(c => c.requiresVisualProof))
                gap(c, 'BUDGET_LIMIT');
        }
    }
    if (artifacts.sequences.some(s => (s.demonstration?.subjects.length ?? 0) > (input.constraints?.maxSubjects ?? 8)))
        for (const c of claims.filter(c => c.requiresVisualProof))
            gap(c, 'BUDGET_LIMIT');
    const proof = claims.map(c => { const selection = selections.find(s => s.claimId === c.id); const checks = proofChecks(c, selection, artifacts.sequences[0], units); if (c.requiresVisualProof && selection?.plannedProof === 'DIRECT' && !Object.values(checks).every(Boolean) && !gaps.some(g => g.claimId === c.id))
        gap(c, 'INSUFFICIENT_PROOF'); return { claimId: c.id, plannedProof: gaps.some(g => g.claimId === c.id) ? 'NONE' as const : selection?.plannedProof ?? 'NONE', checks }; });
    if (gaps.length) {
        artifacts = { sequences: [], demonstrations: [] };
        for (const p of proof)
            if (p.plannedProof === 'DIRECT') {
                p.plannedProof = 'NONE';
                const c = claims.find(c => c.id === p.claimId)!;
                if (!gaps.some(g => g.claimId === c.id))
                    gap(c, 'RESOURCE_CONFLICT');
            }
    }
    const allowed = input.constraints?.allowedGapIds ?? [];
    if (allowed.some(id => !gaps.some(g => g.id === id)))
        fail('AUTO_GAP', 'unknown allowed gap id');
    if (input.constraints?.mode === 'STRICT' && gaps.some(g => { const c = claims.find(c => c.id === g.claimId)!; return c.importance === 'PRIMARY' && c.requiresVisualProof && !allowed.includes(g.id); }))
        fail('AUTO_STRICT_GAP', gaps.map(g => g.id).join(','));
    const raw: Omit<AutoDirectorPlan, 'fingerprint'> = { version: 1, plannerVersion: PLANNER_VERSION, input: structuredClone(input), inputFingerprint: jsonHash({ input, graph, templates, scoreWeights, version: PLANNER_VERSION }), narrativeUnits: units, claims, visualRequirements: claims.map(c => ({ claimId: c.id, importance: c.importance, proofRequired: c.requiresVisualProof, preferredProofLevel: c.requiresVisualProof ? 'DIRECT' : 'NONE', subjectType: c.semanticTags.join('|') || 'unknown', requiredCapabilities: templates.find(t => t.id === selections.find(s => s.claimId === c.id)?.template)?.caps ?? [], fallbackPolicy: 'EXPLICIT_GAP; no symbolic presenter substitution' })), capabilitySnapshot: graph, resourceSelections: selections, templateSelections: selections, visualArc: units.map(u => ({ unitId: u.id, mode: gaps.some(g => claims.find(c => c.id === g.claimId)?.unitId === u.id) ? 'VISUAL_GAP' : selections.find(s => claims.find(c => c.id === s.claimId)?.unitId === u.id)?.mode ?? 'TEXT_FOCUS', sequenceId: artifacts.sequences[0]?.id ?? null })), directedSequences: artifacts.sequences, demonstrations: artifacts.demonstrations, visualProofPlan: proof, visualGaps: gaps, qaSummary: { sourceCoverage: units.map(u => u.sourceText).join('') === input.script, candidateEvaluations, templatesEvaluated: candidateEvaluations ? templates.length : 0 } };
    return { ...raw, fingerprint: jsonHash(raw) };
}
