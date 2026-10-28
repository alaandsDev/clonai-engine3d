import { createHash } from 'node:crypto';
import { jsonHash } from '../editorial/fingerprint';
import type { SourceDocument, SourceInput, SourcePack, SourceProvider, ResearchPlan, SourceQualityAssessment, ResearchPolicy } from './contracts';
export const contentHash = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
export function normalizedSource(input: SourceInput, policy: ResearchPolicy): SourceDocument {
    if (!input || typeof input !== 'object' || typeof input.content !== 'string' || !input.id || !input.title || !input.publisher || !input.canonicalLocator || !input.language || !input.provenance?.originKey || !input.provenance.description || typeof input.fixture !== 'boolean')
        throw Error('RESEARCH_SOURCE metadata');
    if (!['PRIMARY_OFFICIAL', 'PRIMARY_DATASET', 'ACADEMIC', 'INSTITUTIONAL', 'REFERENCE', 'NEWS', 'OTHER'].includes(input.sourceType) || !['STATIC_SOURCE_PACK', 'LOCAL_DOCUMENTS', 'WEB_SEARCH', 'OFFICIAL_API', 'CURATED_DATASET'].includes(input.provider))
        throw Error('RESEARCH_SOURCE type/provider');
    if (!['text/plain', 'text/html', 'text/tab-separated-values', 'text/csv'].includes(input.contentType) || input.content.includes('\0') || Buffer.byteLength(input.content, 'utf8') > policy.maxSourceBytes)
        throw Error('RESEARCH_SOURCE size/content type');
    if (contentHash(input.content) !== input.contentHash)
        throw Error('RESEARCH_SOURCE_HASH mismatch');
    const chars: string[] = [], mapping: {
        start: number;
        end: number;
    }[] = [];
    const append = (text: string, start: number, end: number) => { for (let i = 0; i < text.length; i++) {
        const ch = text[i] === '\r' ? '\n' : text[i];
        if ((ch === '\n' || ch === '\t' || ch === ' ') && chars.at(-1) === ch) {
            mapping.at(-1)!.end = end;
            continue;
        }
        chars.push(ch);
        mapping.push({ start, end });
        if (chars.length > policy.maxNormalizedCharacters)
            throw Error('RESEARCH_SOURCE normalized size');
    } };
    const raw = input.content;
    const text = (value: string, offset: number) => { for (let i = 0; i < value.length;) {
        const e = value.slice(i).match(/^&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|deg);/i);
        if (e) {
            const v = e[1].toLowerCase(), dict: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', deg: '°' };
            let decoded = dict[v];
            if (v[0] === '#') {
                const n = parseInt(v.slice(v[1] === 'x' ? 2 : 1), v[1] === 'x' ? 16 : 10);
                decoded = n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '�';
            }
            append(decoded, offset + i, offset + i + e[0].length);
            i += e[0].length;
        }
        else {
            append(value[i], offset + i, offset + i + 1);
            i++;
        }
    } };
    if (input.contentType !== 'text/html')
        text(raw, 0);
    else {
        let ignored: string | null = null;
        for (const m of raw.matchAll(/<!--[\s\S]*?-->|<[^>]*>|[^<]+/g)) {
            const token = m[0], at = m.index!;
            if (token.startsWith('<!--'))
                continue;
            if (token.startsWith('<')) {
                const tag = token.match(/^<\s*(\/?)\s*([a-z0-9]+)/i);
                if (!tag)
                    continue;
                const closing = Boolean(tag[1]), name = tag[2].toLowerCase();
                if (ignored) {
                    if (closing && name === ignored)
                        ignored = null;
                    continue;
                }
                if (!closing && ['script', 'style', 'nav', 'aside', 'noscript', 'iframe'].includes(name)) {
                    ignored = name;
                    continue;
                }
                if (closing && ['td', 'th'].includes(name))
                    append('\t', at, at + token.length);
                else if (['p', 'h1', 'h2', 'h3', 'h4', 'tr', 'div', 'br', 'title'].includes(name))
                    append('\n', at, at + token.length);
            }
            else if (!ignored)
                text(token, at);
        }
    }
    let start = 0, end = chars.length;
    while (start < end && /\s/.test(chars[start]))
        start++;
    while (end > start && /\s/.test(chars[end - 1]))
        end--;
    const normalized = { text: chars.slice(start, end).join(''), mapping: mapping.slice(start, end) }, rawDoc = { ...structuredClone(input), normalized };
    return { ...rawDoc, fingerprint: jsonHash(rawDoc) };
}
export function sourceSpan(doc: SourceDocument, start: number, end: number) { if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > doc.normalized.mapping.length)
    throw Error('RESEARCH_EVIDENCE_SPAN invalid normalized boundary'); const a = doc.normalized.mapping[start].start, b = doc.normalized.mapping[end - 1].end; return { start: a, end: b, text: doc.content.slice(a, b) }; }
export class StaticSourcePackProvider implements SourceProvider {
    readonly kind = 'STATIC_SOURCE_PACK' as const;
    private readonly snapshot: SourcePack;
    constructor(pack: SourcePack) { this.snapshot = structuredClone(pack); }
    receive(_plan: ResearchPlan) { return structuredClone(this.snapshot); }
}
export function intakeSources(plan: ResearchPlan, pack: SourcePack): SourceDocument[] { if (pack.version !== 1 || !pack.id || typeof pack.fixture !== 'boolean' || !Array.isArray(pack.labels) || !Array.isArray(pack.sources) || pack.sources.length > (plan.request.maxSources ?? 16))
    throw Error('RESEARCH_SOURCE_PACK contract/budget'); if (pack.fixture && (!pack.labels.includes('DEMO_FIXTURE') || !pack.labels.includes('NOT_REAL_WORLD_FACTS')))
    throw Error('RESEARCH_FIXTURE labels required'); if (pack.sources.some(s => s.fixture !== pack.fixture))
    throw Error('RESEARCH_FIXTURE mixed real/synthetic sources'); const ids = new Set<string>(); let total = 0; for (const s of pack.sources) {
    if (ids.has(s.id))
        throw Error('RESEARCH_SOURCE duplicate ID');
    ids.add(s.id);
    total += Buffer.byteLength(s.content ?? '', 'utf8');
} if (total > plan.policy.maxTotalSourceBytes)
    throw Error('RESEARCH_SOURCE total size'); return pack.sources.map(s => normalizedSource(s, plan.policy)).sort((a, b) => a.id.localeCompare(b.id, 'en')); }
export function assessSource(s: SourceDocument, policy: ResearchPolicy): SourceQualityAssessment { const reasons: string[] = []; if (s.language !== 'pt-BR' && !(policy.allowEnglishExtraction && s.language === 'en'))
    reasons.push('LANGUAGE_UNSUPPORTED_FOR_EXTRACTION'); if (!s.normalized.text.trim())
    reasons.push('EMPTY_SOURCE'); const authority = { PRIMARY_OFFICIAL: 3, PRIMARY_DATASET: 3, ACADEMIC: 2, INSTITUTIONAL: 2, REFERENCE: 1, NEWS: 1, OTHER: 0 }[s.sourceType]; const breakdown = { authority: { score: authority, reason: 'Declared source class; not a guarantee of truth' }, directness: { score: s.metadata.directEvidence ? 2 : 0, reason: 'Manifest direct-evidence declaration; quote extraction is separately checked' }, specificity: { score: /\d|\t/.test(s.normalized.text) ? 2 : 1, reason: 'Explicit values or structured rows versus general prose' }, recencyRelevance: { score: 1, reason: policy.evaluationDate ? 'Evaluation date supplied; fact temporal contexts still control comparability' : 'No core clock or automatic freshness assertion' }, methodTransparency: { score: s.metadata.methodology ? 1 : 0, reason: s.metadata.methodology ? 'Method described in manifest' : 'No method declaration' }, independence: { score: s.provenance.originKey ? 1 : 0, reason: 'Origin metadata available; duplicate/shared-origin clustering is separate' }, extractability: { score: s.normalized.text ? 1 : 0, reason: 'Bounded text snapshot with source-offset mapping' } }; const sum = Object.values(breakdown).reduce((n, v) => n + v.score, 0), grade = reasons.length ? 'REJECT' as const : sum >= 9 ? 'HIGH' as const : sum >= 6 ? 'MEDIUM' as const : 'LOW' as const; const raw = { sourceId: s.id, grade, accepted: grade !== 'REJECT', breakdown, reasons }; return { ...raw, fingerprint: jsonHash(raw) }; }
