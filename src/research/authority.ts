import type { SourceSpan } from '../semantics/contracts';
import { attributes, cleanText, decodeEntities, staticMarkup, jsonLdSummary, parseHtmlStructures } from './structured';
import { archivedOriginal } from './origins';
import type { AuthorityAssessment, PublisherIdentity, SourceDocument, SourceType } from './contracts';
// Phase 22 publisher identity and authority. Identity comes only from explicit statements in the snapshot
// (JSON-LD publisher/organization, publisher/author meta, "produced by …", copyright line). Officiality needs an
// explicit organization statement plus a government-designated domain label or a GovernmentOrganization schema;
// a TLD alone never decides. Authority HIGH additionally needs the publisher's own domain to match the fact domain.
const GOV_LABEL = /(?:^|\.)(?:gov|gouv|gob|go|govt|gc|gv|admin)\.[a-z]{2,3}$|\.gov$|\.mil$/i;
const ACADEMIC_LABEL = /(?:^|\.)(?:edu|ac)(?:\.[a-z]{2,3})?$/i;
const GOV_NAME = /\b(?:bureau|ministry|department|agency|office|administration|commission|directorate|government|commonwealth|federal|state|national|meteorological|hydrometeorological|statistics|statistical|census|survey|service|institute)\b/i;
const ACADEMIC_NAME = /\b(?:university|college|institute of technology|academy|école|universidad|universidade)\b/i;
export const DOMAIN_VOCABULARY: Record<string, RegExp> = { TEMPERATURE: /meteorolog|weather|climat|hydromet|atmospher/i, POPULATION: /statistic|census|population|demograph/i };
function sliceSpan(raw: string, start: number, text: string): SourceSpan { return { start, end: start + text.length, text: raw.slice(start, start + text.length) }; }
export function publisherIdentity(doc: SourceDocument): PublisherIdentity {
    const raw = doc.content, active = staticMarkup(raw), signals: PublisherIdentity['signals'] = [], head = raw.slice(0, 300000);
    if (doc.contentType === 'text/html') {
        const parsed = parseHtmlStructures(head, null);
        for (const block of parsed.jsonLd) for (const n of jsonLdSummary([block])) {
            if (n.publisherTypes.length)
                signals.push({ signal: 'JSONLD_PUBLISHER_TYPE', value: n.publisherTypes.join(','), span: block.span });
            if (n.type.some(t => /Organization$/.test(t)) && n.name)
                signals.push({ signal: 'JSONLD_ORGANIZATION', value: n.name + ' [' + n.type.join(',') + ']', span: block.span });
        }
        for (const m of active.slice(0, 300000).matchAll(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
            const a = attributes(m[0]), key = (a.name ?? a.property ?? '').toLowerCase(), content = cleanText(a.content ?? '');
            if (!content)
                continue;
            if (['publisher', 'dc.publisher', 'dcterms.publisher', 'author', 'og:site_name', 'citation_publisher'].includes(key))
                signals.push({ signal: 'META_' + key.toUpperCase(), value: content.slice(0, 160), span: sliceSpan(raw, m.index!, m[0]) });
            const produced = key === 'description' ? content.match(/\b(?:produced|published|prepared|maintained|provided) by (?:the )?([A-Z][\w&'’ .-]{2,80}?)(?:[.,;]|$)/) : null;
            if (produced)
                signals.push({ signal: 'META_DESCRIPTION_PRODUCED_BY', value: produced[1].trim(), span: sliceSpan(raw, m.index!, m[0]) });
        }
    }
    const copyright = active.slice(-200000).match(/(?:©|&copy;|\bcopyright\b)\s*(?:©|&copy;)?\s*(?:\d{4}(?:\s*[-–]\s*\d{4})?,?\s*)?(?:the\s+)?([A-Z][\w&'’ .,-]{2,100}?)(?:\.|\||<|,\s*all rights|\s*all rights|$)/i);
    if (copyright) {
        const at = raw.length - Math.min(raw.length, 200000) + copyright.index!;
        signals.push({ signal: 'COPYRIGHT', value: cleanText(decodeEntities(copyright[1])).slice(0, 120), span: sliceSpan(raw, at, copyright[0]) });
    }
    const named = signals.find(s => s.signal === 'JSONLD_ORGANIZATION') ?? signals.find(s => /^META_(?:PUBLISHER|DC\.PUBLISHER|DCTERMS\.PUBLISHER|CITATION_PUBLISHER)$/.test(s.signal)) ?? signals.find(s => s.signal === 'META_DESCRIPTION_PRODUCED_BY') ?? signals.find(s => s.signal === 'COPYRIGHT') ?? signals.find(s => s.signal === 'META_OG:SITE_NAME') ?? null;
    const name = named ? named.value.replace(/\s*\[.*\]$/, '') : null, host = (() => { try {
        return new URL(archivedOriginal(doc.canonicalLocator) ?? doc.canonicalLocator).hostname;
    }
    catch {
        return '';
    } })();
    const types = signals.filter(s => s.signal.startsWith('JSONLD')).map(s => s.value).join(' ');
    const kind: PublisherIdentity['kind'] = /\bwikipedia\.org$/.test(host) ? 'REFERENCE'
        : /GovernmentOrganization|GovernmentService/.test(types) || name && GOV_NAME.test(name) && GOV_LABEL.test(host) ? 'GOVERNMENT'
            : /CollegeOrUniversity|EducationalOrganization|ResearchOrganization/.test(types) || name && ACADEMIC_NAME.test(name) && ACADEMIC_LABEL.test(host) ? 'ACADEMIC'
                : /NewsArticle|NewsMediaOrganization/.test(types) ? 'NEWS'
                    : name ? 'COMMERCIAL' : 'UNKNOWN';
    return { sourceId: doc.id, name, kind: name || kind === 'REFERENCE' ? kind : 'UNKNOWN', signals };
}
const RANK: SourceType[] = ['OTHER', 'NEWS', 'REFERENCE', 'ACADEMIC', 'INSTITUTIONAL', 'PRIMARY_DATASET', 'PRIMARY_OFFICIAL'];
/** Separates publisher identity, source class and authority; promotion always lists its reasons. Reference corpora are never promoted. */
export function assessAuthority(doc: SourceDocument, identity: PublisherIdentity, metric: string | null): AuthorityAssessment {
    const reasons: string[] = [], vocabulary = metric ? DOMAIN_VOCABULARY[metric] : undefined, description = identity.signals.map(s => s.value).join(' ');
    const compatible = vocabulary && (vocabulary.test(identity.name ?? '') || vocabulary.test(description)) ? metric : null;
    let effective: SourceType = doc.sourceType, authority: AuthorityAssessment['authority'] = 'NONE';
    if (doc.sourceType === 'REFERENCE' || identity.kind === 'REFERENCE')
        reasons.push('Reference corpus: never promoted');
    else if (identity.kind === 'GOVERNMENT') {
        reasons.push('Explicit publisher "' + identity.name + '" (' + identity.signals.map(s => s.signal).join(', ') + ') with government organization wording and a government domain label or schema');
        if (compatible) {
            authority = 'INSTITUTIONAL_HIGH';
            effective = 'PRIMARY_OFFICIAL';
            reasons.push('Publisher domain matches the ' + compatible + ' fact domain: treated as the primary official measuring/publishing body');
        }
        else {
            authority = 'INSTITUTIONAL';
            effective = 'INSTITUTIONAL';
            reasons.push('Fact domain not stated by the publisher identity: institutional, not primary');
        }
    }
    else if (identity.kind === 'ACADEMIC') {
        authority = 'INSTITUTIONAL';
        effective = 'ACADEMIC';
        reasons.push('Explicit academic publisher "' + identity.name + '"');
    }
    else
        reasons.push(identity.name ? 'Publisher "' + identity.name + '" without verifiable institutional identity' : 'No explicit publisher identity');
    // Never demote an explicitly configured/declared class.
    if (RANK.indexOf(doc.sourceType) > RANK.indexOf(effective))
        effective = doc.sourceType;
    return { sourceId: doc.id, declaredSourceType: doc.sourceType, effectiveSourceType: effective, authority, domainCompatibility: compatible, reasons };
}
