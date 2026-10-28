import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { analyzeNaturalScript, directNarrative, compileNarrative, productionPlan, type PlanningPolicy } from '../src/narrative';
import { resolveSafeOutputPath } from '../src/engine3d/paths';
const source = process.argv[2];
if (!source)
    throw new Error('Usage: input.json [--out directory] [--policy PLAN_ONLY|STRICT_FULL|STRICT_ISLANDS]');
const outIndex = process.argv.indexOf('--out'), policyIndex = process.argv.indexOf('--policy'), root = path.resolve(outIndex >= 0 ? process.argv[outIndex + 1] : 'out/engine3d/narrative'), policy = (policyIndex >= 0 ? process.argv[policyIndex + 1] : 'PLAN_ONLY') as PlanningPolicy;
const input = JSON.parse(await readFile(source, 'utf8')), graph = analyzeNaturalScript(input), plan = directNarrative(graph, { policy }), compiled = compileNarrative(plan);
await mkdir(root, { recursive: true });
for (const [name, value] of Object.entries({ graph, plan, compiled, production: productionPlan(plan) }))
    await writeFile(resolveSafeOutputPath(root, input.id + '-' + name, '.json'), JSON.stringify(value, null, 2));
console.log(plan.renderability, plan.fingerprint);
