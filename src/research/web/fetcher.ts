import { jsonHash } from '../../editorial/fingerprint';
import { contentHash, normalizedSource, assessSource } from '../source';
import { buildEvidencePack } from '../pack';
import type { DiscoveryVia, ResearchPlan, SourceInput, SourcePack, SourceProvider, SourceType } from '../contracts';
import { attributes, jsonLdSummary, parseHtmlStructures } from '../structured';
import { archivedOriginal } from '../origins';
/** v2 direct-evidence flag: a measured value with a unit, a unit stated in a header, or explicit presence/census wording. Extraction is still checked separately. */
const DIRECT_V2 = /\d\s*(?:°|&deg;)|(?:°|&deg;)\s*[CF]\b|\bpermanent(?:ly)? (?:population|inhabited|populated|residents)\b|\buninhabited\b|\bcensus\b|\bpopulation\b/i;
/** v2: missing language declarations are detected only for English, from function-word frequency. Other languages stay unsupported. */
export function detectLanguage(content: string): string { const text = content.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]*>|&[a-z]+;/gi, ' ').toLowerCase(), words = text.match(/\p{L}{2,}/gu) ?? [], latin = words.filter(w => /^[a-z]+$/.test(w)); if (latin.length < 40 || latin.length < words.length * 0.9)
    return 'und'; const english = latin.filter(w => ['the', 'of', 'and', 'in', 'is', 'was', 'to', 'on', 'at', 'for', 'with', 'by', 'from', 'are', 'this', 'that'].includes(w)).length, foreign = latin.filter(w => ['der', 'die', 'und', 'les', 'des', 'el', 'los', 'las', 'del', 'il', 'het', 'een', 'och', 'da', 'do', 'em', 'que', 'una'].includes(w)).length; return english >= 20 && english / latin.length >= 0.04 && foreign * 4 < english ? 'en' : 'und'; }
/** v2 post-fetch classification. Discovery provider and TLD never decide the class; only explicit hints, the reference corpus, archived originals and declared page metadata do. */
export function classifySource(content: string, url: string, hint: { sourceType: SourceType; reason: string } | undefined): { sourceType: SourceType; reason: string } {
    if (hint)
        return { sourceType: hint.sourceType, reason: 'explicit configured domain hint: ' + hint.reason };
    const original = archivedOriginal(url), host = new URL(original ?? url).hostname;
    if (hostMatches(host, 'wikipedia.org'))
        return { sourceType: 'REFERENCE', reason: 'MediaWiki reference corpus' };
    const metas = [...content.slice(0, 200000).matchAll(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)].map(m => attributes(m[0])), meta = (name: string) => metas.find(a => (a.name ?? a.property ?? '').toLowerCase() === name)?.content ?? null;
    if (meta('citation_doi') || meta('citation_journal_title') || meta('dc.identifier')?.startsWith('doi:'))
        return { sourceType: 'ACADEMIC', reason: 'Scholarly citation metadata declared by the page' + (original ? ' (archived copy of ' + original + ')' : '') };
    const types = jsonLdSummary(parseHtmlStructures(content.slice(0, 400000), null).jsonLd).flatMap(n => [...n.type, ...n.publisherTypes]);
    if (types.some(t => /^(?:NewsArticle|NewsMediaOrganization|ReportageNewsArticle)$/.test(t)))
        return { sourceType: 'NEWS', reason: 'JSON-LD declares a news article/organization (supporting metadata)' };
    if (types.some(t => /^(?:GovernmentOrganization|GovernmentService|ResearchOrganization|CollegeOrUniversity|EducationalOrganization)$/.test(t)))
        return { sourceType: 'INSTITUTIONAL', reason: 'JSON-LD declares a government/research/educational publisher (supporting metadata, not authentication)' };
    return { sourceType: 'OTHER', reason: 'No declared class; heuristic OTHER' + (original ? ' (archived copy of ' + original + ')' : '') };
}
import type { CandidateSource, FetchAttempt, FetchStatus } from './contracts';
import { SecureHttpClient } from './http';
import { canonicalUrl, hostMatches } from './security';
import { robotsAllowed } from './robots';
import { SnapshotCache } from './cache';
export class WebSourceProvider implements SourceProvider {
    readonly kind = 'WEB_SEARCH' as const;
    private sources: SourceInput[] = [];
    private robots = new Map<string, {
        body: string;
        allowed: boolean;
    }>();
    constructor(readonly client: SecureHttpClient, readonly cache?: SnapshotCache) { }
    receive(_plan: ResearchPlan): SourcePack { return { version: 1, id: 'web-acquired-snapshots', fixture: false, labels: ['REAL_WEB_SNAPSHOTS', 'SESSION_CANDIDATES_ONLY'], sources: structuredClone(this.sources) }; }
    /** `discovery` selects the Phase 21 intake: post-fetch classification, discovery provenance and a per-source admission check. */
    async fetch(candidate: CandidateSource, plan: ResearchPlan, discovery?: { via: DiscoveryVia; referenceIds: string[]; strategy: string }): Promise<{
        attempt: FetchAttempt;
        source: SourceInput | null;
    }> {
        const start = this.client.env.now(), raw: FetchAttempt = { id: 'F_' + jsonHash(candidate.canonicalUrl).slice(0, 16), url: candidate.canonicalUrl, finalUrl: candidate.canonicalUrl, status: 'PARSE_FAILED', reason: '', httpStatus: null, headers: {}, fetchedAt: new Date(start).toISOString(), elapsedMs: 0, bytes: 0, resolvedIps: [], redirects: [], snapshot: null };
        try {
            const checkRobots = async (url: string) => { if (this.client.config.respectRobots) {
                const origin = new URL(url).origin;
                let policy = this.robots.get(origin);
                if (!policy) {
                    const r = await this.client.get(origin + '/robots.txt', 65536, { allowedMimes: ['text/plain'] });
                    policy = { body: new TextDecoder().decode(r.response.body), allowed: r.response.status === 200 || r.response.status === 404 || r.response.status === 410 };
                    if (r.response.status !== 200)
                        policy.body = '';
                    if (r.response.status === 200 && (!r.response.headers['content-type']?.startsWith('text/plain') || /<(?:html|script|body)\b/i.test(policy.body)))
                        policy.allowed = false;
                    this.robots.set(origin, policy);
                }
                if (!policy.allowed || !robotsAllowed(policy.body, url))
                    throw Error('ROBOTS_BLOCKED site policy/unavailable');
            } };
            const fetched = await this.client.get(candidate.canonicalUrl, this.client.config.maxBytesPerSource, { allowedMimes: this.client.config.allowedMimeTypes, beforeRequest: checkRobots }), r = fetched.response;
            raw.networkElapsedMs = this.client.env.now() - start;
            Object.assign(raw, { finalUrl: fetched.url, httpStatus: r.status, headers: r.headers, bytes: r.body.byteLength, resolvedIps: fetched.addresses, redirects: fetched.redirects });
            if (r.status !== 200)
                throw Error('HTTP_ERROR ' + r.status + (r.status === 403 || r.status === 429 ? ' SOURCE_FETCH_BLOCKED' : ''));
            const mime = r.headers['content-type']?.split(';')[0].trim().toLowerCase();
            if (!mime || !this.client.config.allowedMimeTypes.includes(mime))
                throw Error('MIME_BLOCKED ' + mime);
            if (/charset\s*=\s*"?(?!utf-?8\b|us-ascii\b)[\w-]+/i.test(r.headers['content-type']))
                throw Error('PARSE_FAILED unsupported charset');
            const content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(r.body);
            if (!content.trim() || content.includes('\0') || /^\s*(?:%PDF|PK\x03|MZ)/.test(content))
                throw Error('CONTENT_UNAVAILABLE empty/binary');
            const hash = contentHash(content), snapshotRaw = { id: 'SN_' + hash.slice(0, 20), url: fetched.url, fetchedAt: raw.fetchedAt, headers: r.headers, contentHash: hash, bytes: Buffer.byteLength(content), content, mime }, snapshot = { ...snapshotRaw, fingerprint: jsonHash(snapshotRaw) };
            raw.snapshot = snapshot;
            await this.cache?.put(snapshot);
            // Title/language originate in the fetched document, never from a search excerpt.
            const titleRaw = content.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1], title = titleRaw?.replace(/<[^>]*>/g, '').trim() || new URL(fetched.url).pathname;
            const lang = content.match(/<html\b[^>]*\blang=["']([^"']+)/i)?.[1]?.toLowerCase() ?? r.headers['content-language']?.toLowerCase(), language = lang?.startsWith('en') ? 'en' : lang?.startsWith('pt') ? 'pt-BR' : discovery && !lang ? detectLanguage(content) : 'und';
            const domain = new URL(fetched.url).hostname, hint = this.client.config.officialDomainHints.find(h => hostMatches(domain, h.domain));
            const cited = [...content.matchAll(/\b(?:rel=["'](?:[^"']*\s)?(?:mw:ExtLink|external)[^"']*["'][^>]*href|href)=["'](https?:\/\/[^"'<> ]+)/gi)].map(m => { try {
                return canonicalUrl(m[1].replace(/&amp;/g, '&'));
            }
            catch {
                return null;
            } }).filter((x): x is string => Boolean(x)).slice(0, 64);
            const classified = discovery ? classifySource(content, fetched.url, hint) : null;
            const source: SourceInput = { id: 'WEB_' + jsonHash({ url: fetched.url, hash }).slice(0, 20), provider: 'WEB_SEARCH', sourceType: classified?.sourceType ?? hint?.sourceType ?? (hostMatches(domain, 'wikipedia.org') ? 'REFERENCE' : 'OTHER'), title, publisher: domain, canonicalLocator: fetched.url, language, contentType: mime === 'text/csv' ? (discovery ? 'text/csv' : 'text/plain') : mime as SourceInput['contentType'], content, contentHash: hash, retrievedAt: raw.fetchedAt, fixture: false, metadata: { directEvidence: discovery ? DIRECT_V2.test(content) : /\d\s*(?:°|&deg;)/.test(content) }, provenance: { originKey: domain, discovery: { queryIds: candidate.queryIds, requestedUrl: candidate.canonicalUrl, finalUrl: fetched.url, ...(discovery ? { via: discovery.via, referenceIds: discovery.referenceIds, strategy: discovery.strategy } : {}) }, sharedOriginKeys: cited.map(u => 'citation:' + u), description: 'Public HTTP snapshot; source class ' + (classified ? classified.reason : hint ? 'explicit configured domain hint: ' + hint.reason : 'heuristic reference/other') + '; outbound references are conservative reported-origin hints, not verified independent evidence' } };
            const doc = normalizedSource(source, plan.policy), assessment = assessSource(doc, plan.policy);
            if (!doc.normalized.text.trim() || /^(?:enable javascript|just a moment|access denied)/i.test(doc.normalized.text.trim()))
                throw Error('CONTENT_UNAVAILABLE client-rendered/challenge');
            if (!assessment.accepted)
                throw Error('CONTENT_UNAVAILABLE quality ' + assessment.reasons.join(','));
            if (discovery) {
                // v2 admission: per-source pack check plus explicit session-level count/byte budgets (no quadratic re-intake).
                const total = this.sources.reduce((n, s) => n + Buffer.byteLength(s.content, 'utf8'), Buffer.byteLength(content, 'utf8'));
                if (this.sources.length + 1 > (plan.request.maxSources ?? 16) || total > plan.policy.maxTotalSourceBytes)
                    throw Error('CONTENT_UNAVAILABLE RESEARCH_SOURCE_BUDGET session source count/bytes');
                buildEvidencePack(plan.request, { version: 1, id: 'web-intake-check', fixture: false, labels: ['REAL_WEB_SNAPSHOTS', 'SESSION_CANDIDATES_ONLY'], sources: [source] });
            }
            else
                buildEvidencePack(plan.request, { version: 1, id: 'web-intake-check', fixture: false, labels: ['REAL_WEB_SNAPSHOTS', 'SESSION_CANDIDATES_ONLY'], sources: [...this.sources, source] });
            this.sources.push(source);
            raw.status = 'SUCCESS';
            raw.reason = 'Fetched raw snapshot; Phase19 quality accepted; truth requires evidence';
            raw.elapsedMs = this.client.env.now() - start;
            return { attempt: raw, source };
        }
        catch (e) {
            const message = String(e), status = (['TIMEOUT', 'REDIRECT_BLOCKED', 'SSRF_BLOCKED', 'MIME_BLOCKED', 'SIZE_BLOCKED', 'ROBOTS_BLOCKED', 'HTTP_ERROR', 'CONTENT_UNAVAILABLE', 'PARSE_FAILED'] as FetchStatus[]).find(s => message.includes(s));
            raw.status = status ?? (/abort|timed?\s*out/i.test(message) ? 'TIMEOUT' : 'PARSE_FAILED');
            raw.reason = message;
            raw.elapsedMs = this.client.env.now() - start;
            return { attempt: raw, source: null };
        }
    }
}
