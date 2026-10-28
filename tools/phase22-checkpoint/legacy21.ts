// Phase 22 checkpoint helper (offline): Phase 21 v2 sessions must replay identically. Run from repo root with npx tsx.
import { readFileSync } from 'node:fs';
import { replayWebResearch } from '../../src/research/web';
for (const f of ['real-cold-places-v2', 'real-population-census-v2']) {
    const s = JSON.parse(readFileSync('out/engine3d/phase21/logs/' + f + '.json', 'utf8'));
    try {
        const r = replayWebResearch(s);
        console.log('phase21 replay', f, r.processingFingerprint === s.processingFingerprint, r.EvidencePack.fingerprint === s.EvidencePack.fingerprint);
    }
    catch (e) { console.log('phase21 replay', f, 'FAIL', String(e).slice(0, 200)); }
}
