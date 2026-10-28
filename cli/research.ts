import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { planResearch, buildEvidencePack, validateEvidencePack } from '../src/research';
import { writeGroundedTopic } from '../src/writer';
import { resolveSafeOutputPath } from '../src/engine3d/paths';
const command = process.argv[2], input = process.argv[3];
if (!input)
    throw Error('Usage: research plan request.json | build-pack request.json source-pack.json | inspect evidence-pack.json | ground-script writer-request.json evidence-pack.json [--out directory]');
const read = async (p: string) => JSON.parse(await readFile(p, 'utf8')), i = process.argv.indexOf('--out'), root = path.resolve(i >= 0 ? process.argv[i + 1] : 'out/engine3d/research');
let result: unknown, id = 'research';
if (command === 'plan') {
    const r = await read(input);
    result = planResearch(r);
    id = r.id + '-plan';
}
else if (command === 'build-pack') {
    const r = await read(input), sources = await read(process.argv[4]);
    result = buildEvidencePack(r, sources);
    id = r.id + '-pack';
}
else if (command === 'inspect') {
    const p = await read(input);
    validateEvidencePack(p);
    console.log(JSON.stringify(p.quality, null, 2));
    process.exit(0);
}
else if (command === 'ground-script') {
    const request = await read(input), pack = await read(process.argv[4]);
    result = writeGroundedTopic(request, pack);
    id = request.id + '-grounded-writer';
}
else
    throw Error('RESEARCH_CLI unknown command');
await mkdir(root, { recursive: true });
const file = resolveSafeOutputPath(root, id, '.json');
await writeFile(file, JSON.stringify(result, null, 2));
console.log(file);
