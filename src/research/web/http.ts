import http from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { canonicalUrl, isPublicIp, hostMatches } from './security';
import type { WebEnvironment, HttpResponse, WebResearchConfig } from './contracts';
export const nodeEnvironment: WebEnvironment = { now: () => Date.now(), sleep: ms => new Promise(r => setTimeout(r, ms)), async resolve(host, signal) { return Promise.race([lookup(host, { all: true }), new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(Error('TIMEOUT DNS')), { once: true }))]); }, transport(url, addresses, headers, signal, maxBytes, onBytes) { return new Promise<HttpResponse>((resolve, reject) => { const u = new URL(url), request = (u.protocol === 'https:' ? https : http).request(u, { method: 'GET', headers, signal, lookup: ((_host: any, opts: any, cb: any) => { if (opts?.all)
            cb(null, addresses);
        else
            cb(null, addresses[0].address, addresses[0].family); }) as any }, res => { const remoteAddress = res.socket?.remoteAddress ?? ''; const hs: Record<string, string> = {}; for (const k of ['content-type', 'content-language', 'content-length', 'content-encoding', 'location', 'etag', 'last-modified', 'cache-control'])
        if (res.headers[k] !== undefined)
            hs[k] = String(res.headers[k]); if (res.statusCode === 200 && !headers.Accept.split(',').includes((hs['content-type'] ?? '').split(';')[0].trim().toLowerCase())) {
        res.destroy();
        reject(Error('MIME_BLOCKED response headers'));
        return;
    } const declared = Number(hs['content-length']); if (Number.isFinite(declared) && declared > maxBytes) {
        res.destroy();
        reject(Error('SIZE_BLOCKED Content-Length'));
        return;
    } const chunks: Buffer[] = []; let size = 0; res.on('data', (chunk: Buffer) => { size += chunk.length; try {
        onBytes(chunk.length);
    }
    catch (e) {
        res.destroy();
        reject(e);
        return;
    } if (size > maxBytes) {
        res.destroy();
        reject(Error('SIZE_BLOCKED stream'));
        return;
    } chunks.push(chunk); }); res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: hs, body: Buffer.concat(chunks), remoteAddress })); res.on('error', reject); }); request.on('error', reject); request.end(); }); } };
export class SecureHttpClient {
    bytes = 0;
    deadline = Infinity;
    private tail = Promise.resolve();
    private lastDomain = new Map<string, number>();
    constructor(readonly config: WebResearchConfig, readonly env: WebEnvironment = nodeEnvironment) { }
    async get(raw: string, maxBytes: number, options: {
        allowedMimes?: string[];
        beforeRequest?: (url: string) => Promise<void>;
    } = {}): Promise<{
        url: string;
        response: HttpResponse;
        addresses: string[];
        redirects: {
            from: string;
            to: string;
            status: number;
        }[];
    }> {
        let url = canonicalUrl(raw);
        const redirects: {
            from: string;
            to: string;
            status: number;
        }[] = [];
        for (let hop = 0;; hop++) {
            const remaining = this.deadline - this.env.now();
            if (remaining <= 0 || this.bytes >= this.config.maxTotalBytes)
                throw Error('TIMEOUT RESEARCH_BUDGET_EXHAUSTED');
            await options.beforeRequest?.(url);
            const u = new URL(url), host = u.hostname.replace(/^\[|\]$/g, '');
            if (this.config.blockedDomains.some(d => hostMatches(host, d)))
                throw Error(hop ? 'REDIRECT_BLOCKED domain policy' : 'SSRF_BLOCKED domain policy');
            const signal = AbortSignal.timeout(Math.max(1, Math.min(this.config.requestTimeoutMs, Math.floor(this.deadline - this.env.now()))));
            const records = await this.env.resolve(host, signal);
            if (!records.length || records.some(r => !isPublicIp(r.address)))
                throw Error(hop ? 'REDIRECT_BLOCKED DNS/private' : 'SSRF_BLOCKED DNS/private');
            const addresses = [...records].sort((a, b) => a.family - b.family || a.address.localeCompare(b.address));
            // A single queue is deliberately stricter than the configurable concurrency ceiling.
            const previous = this.tail;
            let release!: () => void;
            this.tail = new Promise<void>(r => release = r);
            await previous;
            let response: HttpResponse;
            try {
                const wait = this.config.perDomainDelayMs - (this.env.now() - (this.lastDomain.get(host) ?? -Infinity));
                if (wait > 0)
                    await this.env.sleep(Math.min(wait, this.config.requestTimeoutMs));
                signal.throwIfAborted();
                this.lastDomain.set(host, this.env.now());
                response = await this.env.transport(url, addresses, { 'User-Agent': this.config.userAgent, 'Accept-Encoding': 'identity', 'Accept': (options.allowedMimes ?? ['application/json', 'text/plain', 'text/html']).join(',') }, signal, Math.min(maxBytes, this.config.maxTotalBytes - this.bytes), n => { this.bytes += n; if (this.bytes > this.config.maxTotalBytes)
                    throw Error('SIZE_BLOCKED total byte budget'); });
            }
            finally {
                release();
            }
            const remote = response.remoteAddress.replace(/^::ffff:/i, '');
            if (!isPublicIp(remote) || !addresses.some(a => a.address === remote))
                throw Error('SSRF_BLOCKED socket differs from pinned DNS');
            if (response.body.byteLength > maxBytes)
                throw Error('SIZE_BLOCKED body');
            if (response.headers['content-encoding'] && !/^identity$/i.test(response.headers['content-encoding']))
                throw Error('MIME_BLOCKED compressed response unsupported');
            if ([301, 302, 303, 307, 308].includes(response.status)) {
                if (hop >= this.config.maxRedirects)
                    throw Error('REDIRECT_BLOCKED limit');
                let next: string;
                try {
                    next = canonicalUrl(response.headers.location ?? '', url);
                }
                catch (e) {
                    throw Error('REDIRECT_BLOCKED ' + String(e));
                }
                redirects.push({ from: url, to: next, status: response.status });
                url = next;
                continue;
            }
            return { url, response, addresses: addresses.map(a => a.address), redirects };
        }
    }
}
