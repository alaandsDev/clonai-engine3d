import { isIP } from 'node:net';
export function canonicalUrl(raw: string, base?: string): string { const u = new URL(raw, base); if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.port && !['80', '443'].includes(u.port))
    throw Error('SSRF_BLOCKED scheme/credentials/port'); u.hostname = u.hostname.toLowerCase().replace(/\.$/, ''); u.hash = ''; for (const k of [...u.searchParams.keys()])
    if (/^utm_|^(?:fbclid|gclid|msclkid|mc_cid|mc_eid)$/i.test(k))
        u.searchParams.delete(k); const host = u.hostname.replace(/^\[|\]$/g, ''); if (!host || /^(?:localhost|0)$|\.(?:localhost|local|internal|lan|home)$/i.test(host))
    throw Error('SSRF_BLOCKED local hostname'); if (isIP(host) && !isPublicIp(host))
    throw Error('SSRF_BLOCKED non-public literal'); return u.href; }
export function isPublicIp(ip: string): boolean {
    const kind = isIP(ip);
    if (kind === 4) {
        const a = ip.split('.').map(Number);
        return !(ip === '168.63.129.16' || a[0] === 0 || a[0] === 10 || a[0] === 127 || a[0] >= 224 || a[0] === 100 && a[1] >= 64 && a[1] <= 127 || a[0] === 169 && a[1] === 254 || a[0] === 172 && a[1] >= 16 && a[1] <= 31 || a[0] === 192 && (a[1] === 168 || a[1] === 0 || a[1] === 2 || a[1] === 88 && a[2] === 99) || a[0] === 198 && (a[1] === 18 || a[1] === 19 || a[1] === 51 && a[2] === 100) || a[0] === 203 && a[1] === 0 && a[2] === 113);
    }
    if (kind === 6) {
        const h = ip.toLowerCase();
        if (h.includes('.') || h.startsWith('::'))
            return false;
        const first = parseInt(h.split(':')[0], 16), second = parseInt(h.split(':')[1] || '0', 16);
        return first >= 0x2000 && first <= 0x3fff && first !== 0x2002 && !(first === 0x2001 && (second < 0x200 || second === 0xdb8));
    }
    return false;
}
export function hostMatches(host: string, domain: string) { return host === domain.toLowerCase() || host.endsWith('.' + domain.toLowerCase()); }
