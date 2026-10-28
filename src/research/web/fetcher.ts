import { jsonHash } from '../../editorial/fingerprint';
import { contentHash, normalizedSource, assessSource } from '../source';
import { buildEvidencePack } from '../pack';
import type { ResearchPlan, SourceInput, SourcePack, SourceProvider } from '../contracts';
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
    async fetch(candidate: CandidateSource, plan: ResearchPlan): Promise<{
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
            const lang = content.match(/<html\b[^>]*\blang=["']([^"']+)/i)?.[1]?.toLowerCase() ?? r.headers['content-language']?.toLowerCase(), language = lang?.startsWith('en') ? 'en' : lang?.startsWith('pt') ? 'pt-BR' : 'und';
            const domain = new URL(fetched.url).hostname, hint = this.client.config.officialDomainHints.find(h => hostMatches(domain, h.domain));
            const cited = [...content.matchAll(/\b(?:rel=["'](?:[^"']*\s)?(?:mw:ExtLink|external)[^"']*["'][^>]*href|href)=["'](https?:\/\/[^"'<> ]+)/gi)].map(m => { try {
                return canonicalUrl(m[1].replace(/&amp;/g, '&'));
            }
            catch {
                return null;
            } }).filter((x): x is string => Boolean(x)).slice(0, 64);
            const source: SourceInput = { id: 'WEB_' + jsonHash({ url: fetched.url, hash }).slice(0, 20), provider: 'WEB_SEARCH', sourceType: hint?.sourceType ?? (hostMatches(domain, 'wikipedia.org') ? 'REFERENCE' : 'OTHER'), title, publisher: domain, canonicalLocator: fetched.url, language, contentType: mime === 'text/csv' ? 'text/plain' : mime as SourceInput['contentType'], content, contentHash: hash, retrievedAt: raw.fetchedAt, fixture: false, metadata: { directEvidence: /\d\s*(?:°|&deg;)/.test(content) }, provenance: { originKey: domain, discovery: { queryIds: candidate.queryIds, requestedUrl: candidate.canonicalUrl, finalUrl: fetched.url }, sharedOriginKeys: cited.map(u => 'citation:' + u), description: 'Public HTTP snapshot; source class ' + (hint ? 'explicit configured domain hint: ' + hint.reason : 'heuristic reference/other') + '; outbound references are conservative reported-origin hints, not verified independent evidence' } };
            const doc = normalizedSource(source, plan.policy), assessment = assessSource(doc, plan.policy);
            if (!doc.normalized.text.trim() || /^(?:enable javascript|just a moment|access denied)/i.test(doc.normalized.text.trim()))
                throw Error('CONTENT_UNAVAILABLE client-rendered/challenge');
            if (!assessment.accepted)
                throw Error('CONTENT_UNAVAILABLE quality ' + assessment.reasons.join(','));
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
