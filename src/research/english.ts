import { jsonHash } from '../editorial/fingerprint';
import { sourceSpan } from './source';
import { normalizeQuantity } from './extractor';
import { temperatureQualifiers } from './structured';
import {residencyV4} from './v4/semantics';
import type { CanonicalFact, Evidence, FactCandidate, ResearchPolicy, Residency, SourceDocument } from './contracts';
// Deliberately small grammar. English quotes remain English; only tuples are realized in Portuguese.
// Version 2 (Phase 21, opt-in) adds temperature contexts, explicit "recorded in X" subjects, residency v2
// (including "no permanent population"), past-tense/dated residency and population counts. Version 1 is unchanged.
const name_ = '[\\p{Lu}][\\p{L}\\p{M}\'’-]+(?:\\s+(?:[\\p{Lu}][\\p{L}\\p{M}\'’-]+|of|de|da|do)){0,4}';
function residencyV2(t: string): { residency: Residency; historical: boolean; year: string | null } | null {
    const negated = /\b(?:no|without) permanent (?:population|residents|inhabitants)\b|\b(?:is|was|remains|became|left) uninhabited\b|\bhas no (?:permanent )?(?:population|inhabitants|residents)\b|\bwas abandoned\b/i.test(t);
    const residency: Residency | null = negated ? 'UNINHABITED'
        : /\b(?:permanent population|permanently inhabited|permanent residents|permanently populated|inhabited year-round|year-round (?:population|residents))\b/i.test(t) ? 'PERMANENT_POPULATION'
            : /\bpermanent settlement\b/i.test(t) ? 'PERMANENT_SETTLEMENT'
                : /\b(?:temporary research staff|temporarily (?:staffed|inhabited) by researchers|(?:temporary|seasonal|rotating) (?:research )?(?:staff|personnel|crews?|scientists))\b/i.test(t) ? (/research|scien/i.test(t) ? 'TEMPORARY_RESEARCH_STAFF' : 'TEMPORARY_STAFF')
                    : /\bseasonally inhabited\b|\bseasonal (?:population|residents)\b/i.test(t) ? 'SEASONAL_PRESENCE'
                        : /\bis (?:an? |the )(?:[\w-]+ ){0,4}research (?:station|base)\b/i.test(t) ? 'RESEARCH_STAFF' : null;
    if (!residency)
        return null;
    const historical = /\b(?:was|were|had been|used to be|formerly)\b/i.test(t) && !/\b(?:is|are|has|have|remains|currently|today|still)\b/i.test(t) && residency !== 'UNINHABITED';
    return { residency, historical, year: t.match(/\b(?:as of|in|since|by)\s+((?:1[6-9]|20)\d{2})\b/)?.[1] ?? null };
}
export function extractEnglish(s: SourceDocument, policy: ResearchPolicy, maxItems: number, version: 1 | 2 | 3 | 4 = 1) {
    const v2 = version >= 2;
    const evidence: Evidence[] = [], candidates: FactCandidate[] = [];
    const text = s.normalized.text;
    const heading = s.content.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    const headingStart = heading?.index ?? -1, headingEnd = headingStart + (heading?.[0].length ?? 0);
    const positions = s.normalized.mapping.flatMap((m, i) => m.start >= headingStart && m.end <= headingEnd ? [i] : []);
    const name = positions.length ? text.slice(positions[0], positions.at(-1)! + 1).trim() : '';
    const lead = name ? new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^\\n]{0,180}\\bis (?:an? |the )[^\\n]{0,100}\\b(?:town|city|village|settlement|research station|weather station|scientific station)\\b', 'i').exec(text) : null;
    const context = heading && lead ? [{ start: headingStart, end: headingEnd, text: heading[0] }, sourceSpan(s, lead.index, lead.index + lead[0].length)] : [];
    const clean = (x: string) => x.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
    const add = (fact: CanonicalFact, start: number, end: number, useContext: boolean) => {
        if (evidence.length >= maxItems)
            throw Error('RESEARCH_EVIDENCE_BUDGET');
        const span = sourceSpan(s, start, end), raw = { version: 1 as const, id: 'EV_' + jsonHash({ source: s.id, hash: s.contentHash, span, type: fact.factType, ...(fact.sharedRecordId ? { subject: fact.subject } : {}) }).slice(0, 20), sourceId: s.id, sourceSpan: span, exactText: span.text, normalizedText: text.slice(start, end), evidenceType: fact.factType, supports: fact, extractionConfidence: 'HIGH' as const, truthStatus: 'EXTRACTED' as const, extractionMethod: v2 ? 'LITERAL_EN_V2' as const : 'LITERAL_EN_V1' as const, evidenceLanguage: 'en' as const, contextSpans: useContext ? context : [], contentHash: s.contentHash, table: null };
        const e = { ...raw, fingerprint: jsonHash(raw) };
        evidence.push(e);
        const fc = { id: 'FC_' + jsonHash({ fact, evidence: e.id }).slice(0, 20), canonicalFact: fact, evidenceIds: [e.id], extractionConfidence: 'HIGH' as const, status: 'EXTRACTED' as const };
        candidates.push({ ...fc, fingerprint: jsonHash(fc) });
    };
    for (const line of text.matchAll(/[^\n]+/g))
        for (const part of line[0].matchAll(/[\s\S]+?(?:[.!?](?=\s|$)|$)/g)) {
            const sentence = part[0].trim(), at = line.index! + part.index! + part[0].indexOf(sentence), t = clean(sentence);
            if (!t || t.length > 1400 || /ignore|instruction|system prompt|execute|\?|\b(?:not|never|could|might|may|unofficial|unconfirmed|disputed|unverified|claimed)\b/i.test(t))
                continue;
            // v3: an explicit tie ("A and B share the … record of V") yields one fact per subject with a shared record id;
            // "A / B" formatting alone never does.
            const tie = version >= 3 ? t.match(new RegExp('^(' + name_ + ') and (' + name_ + ') (?:share|shared|jointly hold|jointly held|hold jointly)\\b[^.]{0,80}?\\brecord\\b[^.]{0,40}?\\bof\\s+([−–-]?\\s?\\d+(?:\\.\\d+)?)\\s*°\\s*([CF])', 'u')) : null;
            if (tie) {
                const tq = temperatureQualifiers(t.replace(/([−–-]?\s*\d+(?:\.\d+)?)\s*°\s*([CF])/g, ' ')), qualifiers = tq?.supported && tq.qualifiers.length ? tq.qualifiers : ['MINIMUM_RECORDED'];
                if (/\b(?:low|lowest|cold|coldest|minimum)\b/i.test(t)) {
                    const quantity = normalizeQuantity(tie[3].replace(/[−–]/g, '-').replace(/\s/g, ''), tie[4] === 'C' ? '°C' : '°F', false, policy), sharedRecordId = 'SR_' + jsonHash({ source: s.id, at, subjects: [tie[1], tie[2]].sort() }).slice(0, 16);
                    for (const subject of [tie[1], tie[2]])
                        add({ factType: 'MEASUREMENT', subject, predicate: 'MEASURED_TEMPERATURE', object: null, quantity, metric: 'TEMPERATURE', temporalContext: null, qualifiers, residency: null, sharedRecordId }, at, at + sentence.length, false);
                }
                continue;
            }
            const matched = t.match(v2 ? /^([\p{Lu}][\p{L}\p{M}'’ .-]{1,70}?)\s+(?:recorded|has|had|experiences|is|was|holds|remains)\b/u : /^([\p{Lu}][\p{L}\p{M}'’ .-]{1,70}?)\s+(?:recorded|has|had|experiences|is|was)\b/u)?.[1];
            // v2 explicit subjects: "… recorded in X", "The population of X …" and an appositive "X, <phrase>, is/has/recorded …".
            const located = v2 ? t.match(new RegExp('^(?:The )?(?:lowest|coldest|minimum)[\\w\\s-]{0,40}?temperatures?\\s+(?:ever\\s+)?(?:officially\\s+)?(?:recorded|measured|observed)\\s+(?:in|at)\\s+(' + name_ + ')\\b', 'u'))?.[1] ?? t.match(new RegExp('^The population of (' + name_ + ')\\s+(?:was|is|stood)\\b', 'u'))?.[1] ?? t.match(new RegExp('^(' + name_ + '),\\s+[^,]{1,80},\\s+(?:is|has|had|was|recorded|remains|holds)\\b', 'u'))?.[1] ?? null : null;
            const explicit = matched && /^[\p{Lu}][\p{L}\p{M}'’-]+(?:\s+(?:[\p{Lu}][\p{L}\p{M}'’-]+|of|de|da|do))*$/u.test(matched) && !/^(?:The|A|An|Every|It|This|In|At|On|During|According)\b/.test(matched) ? matched : located;
            const named = name && t.includes(name);
            const contextual = context.length > 0 && /^(?:The )?(?:lowest|minimum|record low|absolute minimum|station|village|town|city|settlement)\b/i.test(t);
            const subject = explicit ?? (named || contextual ? name : '');
            if (!subject || /^(?:The |A |It |This |In |At |On |During |According )/i.test(subject))
                continue;
            if(version===4&&/^(?:There|These|Those|That|They|People|Residents)$/i.test(subject))
                continue;
            // A contextual record with another explicit location is ambiguous and is left unextracted.
            if (!explicit && !named && /\b(?:at|in)\s+(?:the\s+)?[A-Z][a-z]+/.test(t))
                continue;
            const base: CanonicalFact = { factType: 'MEASUREMENT', subject, predicate: 'MEASURED_TEMPERATURE', object: null, quantity: null, metric: 'TEMPERATURE', temporalContext: null, qualifiers: [], residency: null };
            const values = [...t.matchAll(/([−–-]?\s*\d+(?:\.\d+)?)\s*°\s*([CF])/g)].filter(m => !m.index || !/[\d.]/.test(t[m.index - 1]));
            const celsius = values.filter(m => m[2] === 'C');
            // One unit/value per sentence; Fahrenheit equivalent is retained in the quote, never merged into Celsius facts.
            let val = celsius.length === 1 ? celsius[0] : values.length === 1 ? values[0] : null;
            if (v2) {
                // Worded values: "minus 67.7 degrees Celsius", "96 degrees below zero Fahrenheit". Bare "degrees" without a scale is not a measurement.
                const worded = [...t.matchAll(/\b(minus\s+|[−–-]\s*)?(\d+(?:\.\d+)?)\s+degrees\s+(below\s+zero\s+)?(?:(Celsius|Fahrenheit)|\((?:°\s*)?([CF])\))/gi)].map(m => { const r = [m[0], ((m[1] || m[3]) ? '-' : '') + m[2], (m[4]?.[0] ?? m[5]).toUpperCase()] as unknown as RegExpExecArray; return r; });
                const all = [...values, ...worded], allC = all.filter(m => m[2] === 'C');
                val = allC.length === 1 ? allC[0] : all.length === 1 ? all[0] : null;
                // Thresholds ("below −60 °C") are not measurements; surface/satellite/wind-chill/monthly/average stay distinct qualifiers.
                const tq = /\b(?:below(?! zero)|above|less than|more than|under|over|exceed)/i.test(t) ? null : temperatureQualifiers(t.replace(/([−–-]?\s*\d+(?:\.\d+)?)\s*°\s*([CF])/g, ' ').replace(/\b(?:minus\s+)?\d+(?:\.\d+)?\s+degrees\s+(?:below\s+zero\s+)?(?:celsius|fahrenheit)\b/gi, ' '));
                const estimate = /\b(?:estimated|estimate)\b/i.test(t), remote = tq?.qualifiers.some(q => q === 'SATELLITE_ESTIMATE' || q === 'SURFACE_TEMPERATURE_MINIMUM');
                if (val && tq?.supported && tq.qualifiers.length && (!estimate || remote)) {
                    base.quantity = normalizeQuantity(val[1].replace(/[−–]/g, '-').replace(/\s/g, ''), val[2] === 'C' ? '°C' : '°F', /\b(?:approximately|about|around)\b/i.test(t), policy);
                    base.qualifiers = [...tq.qualifiers, ...(base.quantity.approximation === 'APPROXIMATE' ? ['APPROXIMATE'] : []), ...(/\b(?:reported|according to)\b/i.test(t) ? ['REPORTED'] : [])];
                    base.temporalContext = t.match(/\b(?:on|in)\s+((?:\d{1,2}\s+[A-Z][a-z]+\s+)?(?:1[6-9]|20)\d{2})\b/)?.[1] ?? t.match(/\bon\s+([A-Z][a-z]+\s+\d{1,2},\s+(?:1[6-9]|20)\d{2})\b/)?.[1] ?? null;
                    add(base, at, at + sentence.length, !explicit);
                }
                const presence = version === 4 ? residencyV4(t) : residencyV2(t);
                if (presence?.residency)
                    add({ ...base, factType: 'RESIDENCY', predicate: 'HUMAN_PRESENCE', quantity: null, metric: null, temporalContext: presence.year, residency: presence.residency, object: presence.residency, qualifiers: [presence.residency, ...(presence.historical ? ['HISTORICAL'] : [])] }, at, at + sentence.length, !explicit);
                const population = t.match(/\bpopulation (?:of|was|is|stood at)\s+(approximately |about |around )?(\d{1,3}(?:,\d{3})+|\d+)\b(?!\s*(?:°|%|km|square|sq|per))/i);
                if (population) {
                    const n = Number(population[2].replace(/,/g, '')), year = t.match(/\b(?:as of|in|at) the ((?:1[6-9]|20)\d{2}) census\b/i)?.[1] ?? t.match(/\((?:as of )?((?:1[6-9]|20)\d{2})(?: census)?\)/i)?.[1] ?? t.match(/\b(?:as of|in)\s+((?:1[6-9]|20)\d{2})\b/)?.[1] ?? null;
                    add({ ...base, factType: 'QUANTITY', predicate: 'POPULATION_COUNT', metric: 'POPULATION', quantity: { originalValue: population[2], originalUnit: 'PERSONS', normalizedValue: n, normalizedUnit: 'PERSONS', conversionRule: 'IDENTITY', precision: 0, approximation: population[1] ? 'APPROXIMATE' : 'AS_REPORTED' }, temporalContext: year, residency: null, object: null, qualifiers: ['POPULATION_COUNT', ...(/\bcensus\b/i.test(t) ? ['CENSUS'] : []), ...(population[1] ? ['APPROXIMATE'] : []), ...(/\bestimat/i.test(t) ? ['ESTIMATED_VALUE'] : [])] }, at, at + sentence.length, !explicit);
                }
                continue;
            }
            const minimum = /\b(?:lowest (?:air |recorded |ever recorded )?temperature|minimum (?:recorded )?temperature|record low(?: temperature)?|low temperature record|temperature (?:record|minimum)|recorded (?:a |an? )?(?:record )?low)\b/i.test(t) && !/\b(?:highest|every day|daily|monthly|each month|below|above|less than|more than)\b/i.test(t);
            const average = /\b(?:average|mean) (?:annual |monthly )?temperature\b/i.test(t);
            if (val && (minimum || average) && !(minimum && average) && !(/\b(?:estimated|estimate)\b/i.test(t))) {
                base.quantity = normalizeQuantity(val[1].replace(/[−–]/g, '-').replace(/\s/g, ''), val[2] === 'C' ? '°C' : '°F', /\b(?:approximately|about|around)\b/i.test(t), policy);
                base.qualifiers = [minimum ? 'MINIMUM_RECORDED' : 'AVERAGE', ...(base.quantity.approximation === 'APPROXIMATE' ? ['APPROXIMATE'] : []), ...(/\b(?:reported|according to)\b/i.test(t) ? ['REPORTED'] : [])];
                const date = t.match(/\b(?:on|in)\s+((?:\d{1,2}\s+[A-Z][a-z]+\s+)?(?:1[6-9]|20)\d{2})\b/);
                base.temporalContext = date?.[1] ?? null;
                add(base, at, at + sentence.length, !explicit);
            }
            // Phase 21 safety fix, also in v1: negated permanence ("has no permanent residents") is never permanent presence.
            const residency = /\b(?:no|without) permanent\b/i.test(t) ? null : /\b(?:permanent population|permanently inhabited|permanent residents|permanently populated)\b/i.test(t) ? 'PERMANENT_POPULATION' : /\bpermanent settlement\b/i.test(t) ? 'PERMANENT_SETTLEMENT' : /\b(?:temporary research staff|temporarily (?:staffed|inhabited) by researchers)\b/i.test(t) ? 'TEMPORARY_RESEARCH_STAFF' : /\bseasonally inhabited\b/i.test(t) ? 'SEASONAL_PRESENCE' : null;
            if (residency)
                add({ ...base, factType: 'RESIDENCY', predicate: 'HUMAN_PRESENCE', quantity: null, metric: null, temporalContext: null, residency, object: residency, qualifiers: [residency] }, at, at + sentence.length, !explicit);
        }
    return { evidence: evidence.sort((a, b) => a.id.localeCompare(b.id, 'en')), candidates: candidates.sort((a, b) => a.id.localeCompare(b.id, 'en')) };
}
