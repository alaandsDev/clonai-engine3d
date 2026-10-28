import { fields, text, finite, list } from '../engine3d/schema';
import { fail } from '../engine3d/contracts';
import { canonicalJson } from '../editorial/fingerprint';
import type { AutoDirectorInput, NarrativeUnit, PlannedClaim } from './contracts';
import {validateClaimExtraction} from './claim-evidence';
export function validateInput(x: AutoDirectorInput) { canonicalJson(x); fields(x, ['version', 'id', 'language', 'format', 'fps', 'canvas', 'script', 'targetDuration', 'styleProfile', 'castPreference', 'constraints', 'claims', 'measuredDurations'], 'AutoDirectorInput'); if (x.version !== 1 || x.format !== 'vertical_short')
    fail('AUTO_INPUT', 'version/format'); text(x.script, 'script'); if (!/^[a-z][a-z0-9_-]{0,63}$/.test(x.id))
    fail('AUTO_INPUT', 'safe id'); text(x.language, 'language'); finite(x.fps, 'fps', 1, 60); if (!Number.isInteger(x.fps))
    fail('AUTO_INPUT', 'integer fps'); fields(x.canvas, ['width', 'height'], 'canvas'); for (const v of Object.values(x.canvas))
    if (!Number.isInteger(v) || v < 2 || v > 2160 || v % 2)
        fail('AUTO_INPUT', 'even canvas'); if (x.canvas.width >= x.canvas.height)
    fail('AUTO_INPUT', 'vertical canvas'); if (x.constraints) {
    fields(x.constraints, ['mode', 'allowedGapIds', 'maxSubjects'], 'constraints');
    if (x.constraints.mode && !['PLAN_ONLY', 'STRICT'].includes(x.constraints.mode))
        fail('AUTO_INPUT', 'mode');
    if (x.constraints.maxSubjects !== undefined)
        finite(x.constraints.maxSubjects, 'subjects', 1, 8);
} if (x.targetDuration !== undefined)
    finite(x.targetDuration, 'targetDuration', 1, 120); if (x.styleProfile !== undefined)
    text(x.styleProfile, 'styleProfile'); if (x.castPreference !== undefined) {
    list(x.castPreference, 'castPreference');
    x.castPreference.forEach(v => text(v, 'cast'));
} if (x.claims !== undefined) {
    list(x.claims, 'claims');
    if (x.claims.length > 128)
        fail('AUTO_BUDGET', 'claims');
} if (x.constraints?.allowedGapIds !== undefined) {
    list(x.constraints.allowedGapIds, 'allowedGapIds');
    x.constraints.allowedGapIds.forEach(v => text(v, 'gap id'));
} if (x.constraints?.maxSubjects !== undefined && !Number.isInteger(x.constraints.maxSubjects))
    fail('AUTO_INPUT', 'integer subjects'); if (x.measuredDurations !== undefined) {
    list(x.measuredDurations, 'measuredDurations');
    const ids = new Set<string>();
    for (const m of x.measuredDurations) {
        fields(m, ['unitId', 'durationSeconds'], 'measuredDuration');
        text(m.unitId, 'unitId');
        finite(m.durationSeconds, 'duration', .1, 120);
        if (ids.has(m.unitId))
            fail('AUTO_INPUT', 'duplicate measured unit');
        ids.add(m.unitId);
    }
} if (x.script.length > 20000)
    fail('AUTO_BUDGET', 'script'); }
export function segmentScript(x: AutoDirectorInput): NarrativeUnit[] { validateInput(x); const boundaries = [...x.script.matchAll(/(?:[.!?](?:\s+|$)|\n\s*\n)/gu)].map(m => m.index! + m[0].length); if (boundaries.at(-1) !== x.script.length)
    boundaries.push(x.script.length); let start = 0; const units: NarrativeUnit[] = []; for (const end of boundaries) {
    if (end <= start || !x.script.slice(start, end).trim())
        continue;
    const sourceText = x.script.slice(start, end), id = `unit_${units.length + 1}`, measured = x.measuredDurations?.find(m => m.unitId === id);
    if (measured)
        finite(measured.durationSeconds, 'audio duration', .1, 120);
    units.push({ id, sourceText, startOffset: start, endOffset: end, order: units.length, visualBudget: { maxSubjects: x.constraints?.maxSubjects ?? 8, maxSimultaneousNarrativeMotions: 4 }, role: /\?/.test(sourceText) ? 'QUESTION' : /em (primeiro|segundo|terceiro|quarto|quinto)/i.test(sourceText) ? 'RANKING' : units.length ? 'EXPLANATION' : 'HOOK', durationFrames: Math.max(30, Math.ceil((measured?.durationSeconds ?? Math.max(1.2, sourceText.trim().split(/\s+/).length / 2.6)) * x.fps)), timingConfidence: measured ? 'MEASURED' : 'ESTIMATED' });
    start = end;
} if (start < x.script.length && units.length) {
    units.at(-1)!.sourceText += x.script.slice(start);
    units.at(-1)!.endOffset = x.script.length;
} return units; }
export function semantics(text: string) { const s = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase(); const tags = []; if (/ferv|evapor|explod|nuclear|decompo/.test(s))
    tags.push('unsupported_process'); if (/chega|atravess|passa|tubula|conexao|subir|sobe/.test(s))
    tags.push('transfer'); if (/\bnao\b|\bnunca\b/.test(s))
    tags.push('negated'); if (/agua|liquido|reservatorio|caixa d.ag|tubula|nivel/.test(s))
    tags.push('liquid'); if (/sobe|subir|acima/.test(s))
    tags.push('upward'); if (/nivel|aument|enche/.test(s))
    tags.push('fill'); if (/armazena|guardad/.test(s))
    tags.push('storage'); if (/gelo|congel|frio extremo/.test(s))
    tags.push('freezable'); if (/multidao|pesquisador|cientific/.test(s))
    tags.push('scientific_crowd'); if (/porta/.test(s))
    tags.push('door'); if (/graus|°|temperatur/.test(s))
    tags.push('temperature'); if (/\?|escolher/.test(s))
    tags.push('question'); if (/em (primeiro|segundo|terceiro|quarto|quinto)|#\d/.test(s))
    tags.push('ranking'); if (/\d/.test(s))
    tags.push('number'); if (/\bvs\b|compar| versus /.test(s))
    tags.push('comparison'); if (/localiz|situad|ao norte|ao sul/.test(s))
    tags.push('location'); if (/porque|por isso|portanto|faz com que/.test(s))
    tags.push('cause_effect'); return tags; }
export function extractClaims(x: AutoDirectorInput, units: NarrativeUnit[]): PlannedClaim[] { const explicit = x.claims ?? [], ids = new Set<string>(); const out: PlannedClaim[] = explicit.map(c => { fields(c, ['id', 'text', 'type', 'startOffset', 'endOffset', 'importance', 'requiresVisualProof','extraction'], 'claim'); text(c.id, 'id'); text(c.text, 'text'); if (ids.has(c.id))
    fail('AUTO_CLAIM', 'duplicate id'); ids.add(c.id); if (!['OBJECT_STATE', 'PROCESS', 'QUANTITY_CHANGE', 'SPATIAL_RELATION', 'CAUSE_EFFECT', 'COMPARISON', 'NUMBER', 'TEMPERATURE', 'RANKING', 'LOCATION', 'QUESTION', 'CONCLUSION'].includes(c.type) || !['PRIMARY', 'SUPPORTING', 'DECORATIVE'].includes(c.importance) || typeof c.requiresVisualProof !== 'boolean')
    fail('AUTO_CLAIM', 'type/importance'); const unit = units.find(u => c.startOffset >= u.startOffset && c.endOffset <= u.endOffset); if (!unit || !Number.isInteger(c.startOffset) || !Number.isInteger(c.endOffset) || c.endOffset <= c.startOffset)
    fail('AUTO_CLAIM', 'source offsets'); if(c.extraction)validateClaimExtraction(c.extraction,x.script,units); return { ...c, unitId: unit!.id, source: c.extraction?'SEMANTIC_ENGINE':'EXPLICIT', confidence:c.extraction?.confidence??'HIGH', semanticTags:c.extraction?[...c.extraction.semanticTags]:semantics(c.text + ' ' + unit!.sourceText) }; }); for (const u of units.filter(u => !out.some(c => c.unitId === u.id))) {
    const tags = semantics(u.sourceText), type = /magicamente|mágica|parece simples/i.test(u.sourceText) ? 'CONCLUSION' : tags.includes('question') ? 'QUESTION' : tags.includes('temperature') ? 'TEMPERATURE' : tags.includes('ranking') ? 'RANKING' : tags.includes('comparison') ? 'COMPARISON' : tags.includes('location') ? 'LOCATION' : tags.includes('cause_effect') ? 'CAUSE_EFFECT' : tags.includes('number') ? 'NUMBER' : tags.includes('freezable') ? 'OBJECT_STATE' : tags.includes('fill') ? 'QUANTITY_CHANGE' : tags.includes('liquid') ? 'PROCESS' : 'CAUSE_EFFECT';
    out.push({ id: `claim_${u.id}`, text: u.sourceText.trim(), type, startOffset: u.startOffset, endOffset: u.endOffset, importance: type === 'CONCLUSION' || type === 'QUESTION' ? 'SUPPORTING' : 'PRIMARY', requiresVisualProof: !['CONCLUSION', 'QUESTION'].includes(type), unitId: u.id, source: 'HEURISTIC', confidence: ['QUESTION', 'TEMPERATURE', 'RANKING', 'NUMBER'].includes(type) ? 'HIGH' : tags.length ? 'MEDIUM' : 'LOW', semanticTags: tags });
} return out.sort((a, b) => a.startOffset - b.startOffset || (a.id < b.id ? -1 : 1)); }
