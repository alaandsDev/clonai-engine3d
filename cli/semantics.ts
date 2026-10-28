import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { analyzeScript, toAutoDirectorInput, semanticQa } from '../src/semantics';
import { planAutoDirector } from '../src/autodirector/planner';
import { compileAutoDirector } from '../src/autodirector/compiler';
import { resolveSafeOutputPath } from '../src/engine3d/paths';
const [mode, source] = process.argv.slice(2);
if (!['analyze', 'plan'].includes(mode) || !source)
    throw new Error('Usage: analyze|plan script-only.json [--out directory] [--strict]');
const index = process.argv.indexOf('--out'), root = path.resolve(index >= 0 ? process.argv[index + 1] : 'out/engine3d/semantics');
const input = JSON.parse(await readFile(source, 'utf8')), analysis = analyzeScript(input), strict = process.argv.includes('--strict');
await mkdir(root, { recursive: true });
const save = async (suffix: string, data: unknown) => writeFile(resolveSafeOutputPath(root, input.id + '-' + suffix, '.json'), JSON.stringify(data, null, 2));
for (const [suffix, data] of Object.entries({ 'semantic-analysis': analysis, claims: analysis.claims, references: analysis.references, ambiguities: analysis.ambiguities, confidence: analysis.confidenceSummary, qa: semanticQa(analysis) }))
    await save(suffix, data);
if (mode === 'plan') {
    const adapterInput = toAutoDirectorInput(analysis, { mode: strict ? 'SEMANTIC_STRICT' : 'SEMANTIC_PLAN_ONLY', constraints: { mode: strict ? 'STRICT' : 'PLAN_ONLY' } }), plan = planAutoDirector(adapterInput), compiled = compileAutoDirector(plan);
    for (const [suffix, data] of Object.entries({ 'autodirector-input': adapterInput, 'autodirector-plan': plan, compiled }))
        await save(suffix, data);
}
console.log(analysis.fingerprint);
