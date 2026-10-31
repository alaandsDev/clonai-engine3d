/** Operator: V1 → V2 (curiosity loops) → V3 (retention compression); no render.
 * Usage: tsx tools/phase29/retention-write.ts <v1.txt> [<expected-v2.txt>] [<out-v3.txt>] */
import {readFileSync,writeFileSync} from 'node:fs';
import {writeProgressive} from '../../src/writer/progressive';
import {compressRetention} from '../../src/writer/retention';
const [inp,v2file,out]=process.argv.slice(2),v2=writeProgressive(readFileSync(inp,'utf8'));
if(v2file&&v2.units.map(u=>u.text).join('\n')+'\n'!==readFileSync(v2file,'utf8'))throw Error('V2 differs from '+v2file);
const r=compressRetention(v2);
if(!r.result.audit.passed)throw Error('RETENTION_AUDIT '+JSON.stringify(r.result.audit));
if(out){writeFileSync(out,r.result.units.map(u=>u.text).join('\n')+'\n');writeFileSync(out.replace(/\.txt$/,'.report.json'),JSON.stringify(r,null,1));}
console.log(r.result.units.map(u=>u.id+' '+u.kind[0]+' '+u.role+' | '+u.text).join('\n'));
for(const o of r.operations)console.log('OP',o.op,o.units.join('+'),'-',JSON.stringify(o.removedWords),'+',JSON.stringify(o.addedWords));
console.log(JSON.stringify(r.metrics));console.log('audit',JSON.stringify(r.result.audit));
for(const x of r.rejected)console.log('REJECTED',x.op,x.units.join('+'),x.reason);
