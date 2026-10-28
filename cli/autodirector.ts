import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { planAutoDirector } from '../src/autodirector/planner';
import { compileAutoDirector } from '../src/autodirector/compiler';
import { resolveSafeOutputPath } from '../src/engine3d/paths';
const mode = process.argv[2], source = process.argv[3];
if (!['plan', 'compile'].includes(mode) || !source)
    throw new Error('Usage: plan|compile input.json [--out directory]');
const outIndex = process.argv.indexOf('--out'), root = path.resolve(outIndex >= 0 ? process.argv[outIndex + 1] : 'out/engine3d/autodirector');
await mkdir(root, { recursive: true });
const input = JSON.parse(await readFile(source, 'utf8'));
if (mode === 'plan') {
    const p = planAutoDirector(input);
    await writeFile(resolveSafeOutputPath(root, p.input.id + '-autodirector-plan', '.json'), JSON.stringify(p, null, 2));
    console.log(p.fingerprint);
}
else {
    const c = compileAutoDirector(input);
    for (const [name, value] of Object.entries({ 'editorial-plan': c.editorialPlan, 'event-map': c.eventMap, 'director-plan': c.directorPlan, 'directed-sequences': c.directedSequences, demonstrations: c.demonstrations, 'visual-proof': c.visualProof, 'render-plan': c.renderPlan }))
        await writeFile(resolveSafeOutputPath(root, input.input.id + '-' + name, '.json'), JSON.stringify(value, null, 2));
    console.log(c.fingerprint);
}
