import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { jsonHash } from '../../editorial/fingerprint';
import { contentHash } from '../source';
import type { WebSnapshot } from './contracts';
export class SnapshotCache {
    constructor(readonly root: string) { }
    async put(snapshot: WebSnapshot) { validateSnapshot(snapshot); await mkdir(this.root, { recursive: true }); const file = path.join(this.root, snapshot.fingerprint + '.json'), serialized = JSON.stringify(snapshot); try {
        await writeFile(file, serialized, { flag: 'wx' });
    }
    catch (e: any) {
        if (e.code !== 'EEXIST')
            throw e;
        if (await readFile(file, 'utf8') !== serialized)
            throw Error('CACHE_IMMUTABILITY collision');
    } return file; }
    async get(fingerprint: string) { if (!/^[a-f0-9]{64}$/.test(fingerprint))
        throw Error('CACHE_KEY'); const snapshot = JSON.parse(await readFile(path.join(this.root, fingerprint + '.json'), 'utf8')) as WebSnapshot; validateSnapshot(snapshot); if (snapshot.fingerprint !== fingerprint)
        throw Error('CACHE_KEY_MISMATCH'); return snapshot; }
}
export function validateSnapshot(s: WebSnapshot) { const { fingerprint, ...raw } = s; if (contentHash(s.content) !== s.contentHash || Buffer.byteLength(s.content) !== s.bytes || jsonHash(raw) !== fingerprint)
    throw Error('SNAPSHOT_INTEGRITY'); }
export async function cacheDiscovery(root: string, value: unknown) { await mkdir(root, { recursive: true }); const serialized = JSON.stringify(value), fingerprint = contentHash(serialized), file = path.join(root, fingerprint + '.json'); try {
    await writeFile(file, serialized, { flag: 'wx' });
}
catch (e: any) {
    if (e.code !== 'EEXIST' || await readFile(file, 'utf8') !== serialized)
        throw Error('DISCOVERY_CACHE_IMMUTABILITY');
} return { file, fingerprint }; }
