/** Operator: rewrite an explanatory script as curiosity loops (no render). Usage: tsx tools/phase29/progressive-write.ts <in.txt> <out.txt> */
import {readFileSync,writeFileSync} from 'node:fs';
import {writeProgressive,scriptCuriosityMetrics} from '../../src/writer/progressive';
const [inp,out]=process.argv.slice(2),src=readFileSync(inp,'utf8'),p=writeProgressive(src);
if(!p.audit.passed)throw Error('PROGRESSIVE_AUDIT '+JSON.stringify(p.audit));
writeFileSync(out,p.units.map(u=>u.text).join('\n')+'\n');
writeFileSync(out.replace(/\.txt$/,'.report.json'),JSON.stringify({v1:scriptCuriosityMetrics(src),v2:scriptCuriosityMetrics(p.script,p),writer:p},null,1));
console.log(JSON.stringify({v1:scriptCuriosityMetrics(src),v2:scriptCuriosityMetrics(p.script,p)}));
