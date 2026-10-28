import { jsonHash } from '../editorial/fingerprint';
import { sourceSpan } from './source';
import { normalizeQuantity } from './extractor';
import type { CanonicalFact, Evidence, FactCandidate, ResearchPolicy, SourceDocument } from './contracts';
// Deliberately small grammar. English quotes remain English; only tuples are realized in Portuguese.
export function extractEnglish(s: SourceDocument, policy: ResearchPolicy, maxItems: number) {
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
        const span = sourceSpan(s, start, end), raw = { version: 1 as const, id: 'EV_' + jsonHash({ source: s.id, hash: s.contentHash, span, type: fact.factType }).slice(0, 20), sourceId: s.id, sourceSpan: span, exactText: span.text, normalizedText: text.slice(start, end), evidenceType: fact.factType, supports: fact, extractionConfidence: 'HIGH' as const, truthStatus: 'EXTRACTED' as const, extractionMethod: 'LITERAL_EN_V1' as const, evidenceLanguage: 'en' as const, contextSpans: useContext ? context : [], contentHash: s.contentHash, table: null };
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
            const matched = t.match(/^([\p{Lu}][\p{L}\p{M}'’ .-]{1,70}?)\s+(?:recorded|has|had|experiences|is|was)\b/u)?.[1];
            const explicit = matched && /^[\p{Lu}][\p{L}\p{M}'’-]+(?:\s+(?:[\p{Lu}][\p{L}\p{M}'’-]+|of|de|da|do))*$/u.test(matched) && !/^(?:The|A|An|Every|It|This|In|At|On|During|According)\b/.test(matched) ? matched : null;
            const named = name && t.includes(name);
            const contextual = context.length > 0 && /^(?:The )?(?:lowest|minimum|record low|absolute minimum|station|village|town|city|settlement)\b/i.test(t);
            const subject = explicit ?? (named || contextual ? name : '');
            if (!subject || /^(?:The |A |It |This |In |At |On |During |According )/i.test(subject))
                continue;
            // A contextual record with another explicit location is ambiguous and is left unextracted.
            if (!explicit && !named && /\b(?:at|in)\s+(?:the\s+)?[A-Z][a-z]+/.test(t))
                continue;
            const base: CanonicalFact = { factType: 'MEASUREMENT', subject, predicate: 'MEASURED_TEMPERATURE', object: null, quantity: null, metric: 'TEMPERATURE', temporalContext: null, qualifiers: [], residency: null };
            const values = [...t.matchAll(/([−–-]?\s*\d+(?:\.\d+)?)\s*°\s*([CF])/g)].filter(m => !m.index || !/[\d.]/.test(t[m.index - 1]));
            const celsius = values.filter(m => m[2] === 'C');
            // One unit/value per sentence; Fahrenheit equivalent is retained in the quote, never merged into Celsius facts.
            const val = celsius.length === 1 ? celsius[0] : values.length === 1 ? values[0] : null;
            const minimum = /\b(?:lowest (?:air |recorded |ever recorded )?temperature|minimum (?:recorded )?temperature|record low(?: temperature)?|low temperature record|temperature (?:record|minimum)|recorded (?:a |an? )?(?:record )?low)\b/i.test(t) && !/\b(?:highest|every day|daily|monthly|each month|below|above|less than|more than)\b/i.test(t);
            const average = /\b(?:average|mean) (?:annual |monthly )?temperature\b/i.test(t);
            if (val && (minimum || average) && !(minimum && average) && !(/\b(?:estimated|estimate)\b/i.test(t))) {
                base.quantity = normalizeQuantity(val[1].replace(/[−–]/g, '-').replace(/\s/g, ''), val[2] === 'C' ? '°C' : '°F', /\b(?:approximately|about|around)\b/i.test(t), policy);
                base.qualifiers = [minimum ? 'MINIMUM_RECORDED' : 'AVERAGE', ...(base.quantity.approximation === 'APPROXIMATE' ? ['APPROXIMATE'] : []), ...(/\b(?:reported|according to)\b/i.test(t) ? ['REPORTED'] : [])];
                const date = t.match(/\b(?:on|in)\s+((?:\d{1,2}\s+[A-Z][a-z]+\s+)?(?:1[6-9]|20)\d{2})\b/);
                base.temporalContext = date?.[1] ?? null;
                add(base, at, at + sentence.length, !explicit);
            }
            const residency = /\b(?:permanent population|permanently inhabited|permanent residents|permanently populated)\b/i.test(t) ? 'PERMANENT_POPULATION' : /\bpermanent settlement\b/i.test(t) ? 'PERMANENT_SETTLEMENT' : /\b(?:temporary research staff|temporarily (?:staffed|inhabited) by researchers)\b/i.test(t) ? 'TEMPORARY_RESEARCH_STAFF' : /\bseasonally inhabited\b/i.test(t) ? 'SEASONAL_PRESENCE' : null;
            if (residency)
                add({ ...base, factType: 'RESIDENCY', predicate: 'HUMAN_PRESENCE', quantity: null, metric: null, temporalContext: null, residency, object: residency, qualifiers: [residency] }, at, at + sentence.length, !explicit);
        }
    return { evidence: evidence.sort((a, b) => a.id.localeCompare(b.id, 'en')), candidates: candidates.sort((a, b) => a.id.localeCompare(b.id, 'en')) };
}
