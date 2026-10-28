// Phase 22 checkpoint helper (offline): historical Phase 19/20 rederivation and replay check. Run from repo root with npx tsx.
import { readdirSync, readFileSync } from 'node:fs';
import { validateEvidencePack } from '../../src/research/qa';
import { replayWebResearch } from '../../src/research/web';
const base = 'out/engine3d/';
for (const dir of ['phase19/packs', 'phase20/packs'])
    for (const f of readdirSync(base + dir).filter(f => f.endsWith('.json'))) {
        const p = JSON.parse(readFileSync(base + dir + '/' + f, 'utf8'));
        if (!p?.fingerprint) { console.log(dir, f, 'not a pack'); continue; }
        try { validateEvidencePack(p); console.log(dir, f, 'REDERIVED_IDENTICAL'); } catch (e) { console.log(dir, f, 'FAIL', String(e)); }
    }
for (const f of ['real-cold-places', 'real-temperature-records']) {
    const s = JSON.parse(readFileSync(base + 'phase20/logs/' + f + '.json', 'utf8'));
    try { console.log('phase20 replay', f, replayWebResearch(s).processingFingerprint === s.processingFingerprint); } catch (e) { console.log('phase20 replay', f, 'FAIL', String(e)); }
}
