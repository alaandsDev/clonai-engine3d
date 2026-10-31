import type { ResearchRequest, ResearchPolicy } from './contracts';
export function validateResearchRequest(r: ResearchRequest) {
    if (!r || typeof r !== 'object' || Array.isArray(r))
        throw Error('RESEARCH_REQUEST object');
    const allowed = ['version', 'id', 'topic', 'language', 'researchGoal', 'desiredFactTypes', 'constraints', 'sourcePolicy', 'maxSources', 'maxEvidenceItems'];
    for (const k of Object.keys(r))
        if (!allowed.includes(k))
            throw Error('RESEARCH_REQUEST unknown/hidden field ' + k);
    if (r.version !== 1 || !r.id || typeof r.id !== 'string' || typeof r.topic !== 'string' || !r.topic.trim() || r.topic.length > 4000 || r.language !== 'pt-BR' || !['RANKING', 'PROCESS', 'FACTS'].includes(r.researchGoal))
        throw Error('RESEARCH_REQUEST identity/topic/goal');
    const types = ['ENTITY_EXISTENCE', 'QUANTITY', 'MEASUREMENT', 'LOCATION', 'STATE', 'PROCESS', 'RELATION', 'COMPARISON', 'RANKING', 'TEMPORAL', 'RESIDENCY', 'DEFINITION'];
    if (!Array.isArray(r.desiredFactTypes) || !r.desiredFactTypes.length || r.desiredFactTypes.some(t => !types.includes(t)))
        throw Error('RESEARCH_REQUEST fact types');
    for (const [k, max] of [['maxSources', 32], ['maxEvidenceItems', 256]] as const)
        if (r[k] !== undefined && (!Number.isInteger(r[k]) || r[k]! < 1 || r[k]! > max))
            throw Error('RESEARCH_REQUEST budget ' + k);
    if (r.constraints) {
        for (const k of Object.keys(r.constraints))
            if (!['rankingCount', 'residencyCriterion', 'metric', 'qualifier', 'temporalContext'].includes(k))
                throw Error('RESEARCH_REQUEST constraint ' + k);
        const c = r.constraints;
        if (c.rankingCount !== undefined && (!Number.isInteger(c.rankingCount) || c.rankingCount < 1 || c.rankingCount > 20))
            throw Error('RESEARCH_REQUEST ranking count');
        if (c.residencyCriterion !== undefined && !['PERMANENT_SETTLEMENT', 'PERMANENT_POPULATION', 'TEMPORARY_RESEARCH_STAFF', 'SEASONAL_PRESENCE'].includes(c.residencyCriterion))
            throw Error('RESEARCH_REQUEST residency');
        // POPULATION counts exist only in the v2 extraction model.
        if (c.metric !== undefined && c.metric !== 'TEMPERATURE' && !(c.metric === 'POPULATION' && (r.sourcePolicy?.researchVersion ?? 1) >= 2))
            throw Error('RESEARCH_REQUEST metric');
        for (const k of ['qualifier', 'temporalContext'] as const)
            if (c[k] !== undefined && (typeof c[k] !== 'string' || !c[k]!.trim()))
                throw Error('RESEARCH_REQUEST qualifier/context');
    }
    const p = r.sourcePolicy;
    if (p) {
        for (const k of Object.keys(p))
            if (!['minIndependentSources', 'minPrimaryQuality', 'allowFahrenheitConversion', 'allowEnglishExtraction', 'temporalComparison', 'maxSourceBytes', 'maxTotalSourceBytes', 'maxNormalizedCharacters', 'evaluationDate', 'researchVersion', 'factTypeQuorum', 'residencyMaxAgeYears', 'observationSitePolicy', 'mechanismVersion', 'contextualMechanisms', 'progressiveStory', 'contextualParser'].includes(k))
                throw Error('RESEARCH_POLICY unknown ' + k);
        if(p.contextualMechanisms!==undefined&&(p.contextualMechanisms!==true||p.mechanismVersion!==2))throw Error('RESEARCH_POLICY contextualMechanisms requires mechanismVersion 2');
        if(p.progressiveStory!==undefined&&(p.progressiveStory!==true||p.mechanismVersion!==2||p.contextualMechanisms!==true||p.researchVersion!==4||r.researchGoal!=='PROCESS'))throw Error('RESEARCH_POLICY progressiveStory requires contextual PROCESS Research v4');
        if(p.contextualParser!==undefined&&(p.contextualParser!==1||p.progressiveStory!==true))throw Error('RESEARCH_POLICY contextualParser requires progressiveStory');
        if (p.mechanismVersion !== undefined && (p.mechanismVersion !== 2 || r.researchGoal !== 'PROCESS' || (p.researchVersion ?? 1) < 2))
            throw Error('RESEARCH_POLICY mechanismVersion requires PROCESS and researchVersion >= 2');
        if (p.researchVersion !== undefined && ![1, 2, 3, 4].includes(p.researchVersion))
            throw Error('RESEARCH_POLICY version');
        if ((p.factTypeQuorum !== undefined || p.residencyMaxAgeYears !== undefined) && (p.researchVersion ?? 1) < 2)
            throw Error('RESEARCH_POLICY v2 fields require researchVersion 2');
        if (p.observationSitePolicy !== undefined && ((p.researchVersion ?? 1) < 3 || !['SAME_ENTITY_ONLY', 'SOURCED_OBSERVATION_SITE'].includes(p.observationSitePolicy)))
            throw Error('RESEARCH_POLICY observationSitePolicy requires researchVersion 3');
        if (p.residencyMaxAgeYears !== undefined && (!Number.isInteger(p.residencyMaxAgeYears) || p.residencyMaxAgeYears < 1 || p.residencyMaxAgeYears > 100))
            throw Error('RESEARCH_POLICY residency age');
        if (p.factTypeQuorum !== undefined) {
            if (!p.factTypeQuorum || typeof p.factTypeQuorum !== 'object' || Array.isArray(p.factTypeQuorum))
                throw Error('RESEARCH_POLICY fact quorum');
            for (const [type, q] of Object.entries(p.factTypeQuorum)) {
                if (!['MEASUREMENT', 'RESIDENCY', 'QUANTITY'].includes(type) || !q || Object.keys(q).some(k => !['minIndependentOrigins', 'singleOriginAuthority'].includes(k)) || !Number.isInteger(q.minIndependentOrigins) || q.minIndependentOrigins < 1 || q.minIndependentOrigins > 5)
                    throw Error('RESEARCH_POLICY fact quorum ' + type);
                const a = q.singleOriginAuthority;
                // A single-origin admission is restricted to declared primary/institutional classes; reference/news/other can never stand alone.
                if (a !== undefined && (!a || Object.keys(a).some(k => !['sourceTypes', 'minGrade'].includes(k)) || !Array.isArray(a.sourceTypes) || !a.sourceTypes.length || a.sourceTypes.some(t => !['PRIMARY_OFFICIAL', 'PRIMARY_DATASET', 'ACADEMIC', 'INSTITUTIONAL'].includes(t)) || !['HIGH', 'MEDIUM'].includes(a.minGrade)))
                    throw Error('RESEARCH_POLICY single-origin authority ' + type);
            }
        }
        if (p.minIndependentSources !== undefined && (!Number.isInteger(p.minIndependentSources) || p.minIndependentSources < 1 || p.minIndependentSources > 5))
            throw Error('RESEARCH_POLICY quorum');
        if (p.minPrimaryQuality !== undefined && !['MEDIUM', 'HIGH'].includes(p.minPrimaryQuality))
            throw Error('RESEARCH_POLICY quality');
        if (p.allowFahrenheitConversion !== undefined && typeof p.allowFahrenheitConversion !== 'boolean')
            throw Error('RESEARCH_POLICY unit conversion');
        if (p.allowEnglishExtraction !== undefined && typeof p.allowEnglishExtraction !== 'boolean')
            throw Error('RESEARCH_POLICY English extraction');
        if (p.temporalComparison !== undefined && !['SAME_CONTEXT', 'EXPLICIT_CROSS_PERIOD'].includes(p.temporalComparison))
            throw Error('RESEARCH_POLICY temporal');
        for (const k of ['maxSourceBytes', 'maxTotalSourceBytes', 'maxNormalizedCharacters'] as const)
            if (p[k] !== undefined && (!Number.isInteger(p[k]) || p[k]! < 1 || p[k]! > (k === 'maxTotalSourceBytes' ? 33554432 : k === 'maxSourceBytes' ? 2097152 : 524288)))
                throw Error('RESEARCH_POLICY size');
        if (p.evaluationDate !== undefined && p.evaluationDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(p.evaluationDate))
            throw Error('RESEARCH_POLICY evaluation date');
    }
}
export function researchPolicy(r: ResearchRequest): ResearchPolicy { return { version: 'research-policy/1.0.0', minIndependentSources: 1, minPrimaryQuality: 'MEDIUM', allowFahrenheitConversion: false, temporalComparison: 'SAME_CONTEXT', maxSourceBytes: 65536, maxTotalSourceBytes: 524288, maxNormalizedCharacters: 65536, evaluationDate: null, ...r.sourcePolicy }; }
