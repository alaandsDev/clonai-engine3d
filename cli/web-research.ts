import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runWebResearch, replayWebResearch } from '../src/research/web';
import { saveResearchSession } from '../src/research/web/output';
const [mode, file, output = 'out/engine3d/phase20'] = process.argv.slice(2);
if (!file || !['live', 'replay', 'inspect'].includes(mode))
    throw Error('Usage: live <request.json> [output] | replay <session.json> [output] | inspect <session.json>');
const input = JSON.parse(await readFile(file, 'utf8'));
if (mode === 'inspect') {
    console.log(JSON.stringify({ quality: input.quality, scope: input.scope, diagnostics: input.diagnostics }, null, 2));
}
else {
    const result = mode === 'live' ? await runWebResearch(input.request, input.web) : replayWebResearch(input);
    const label = mode === 'live' ? result.request.id : result.request.id + '-replay';
    const saved = await saveResearchSession(result, path.resolve(output), label);
    console.log(JSON.stringify({ saved, quality: result.quality, scope: result.scope, processingFingerprint: result.processingFingerprint, writer: result.writer?.status }, null, 2));
}
