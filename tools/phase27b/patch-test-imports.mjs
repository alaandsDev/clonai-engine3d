import {readFileSync,writeFileSync} from 'node:fs';
const f='tests/visual-causal.test.ts';let s=readFileSync(f,'utf8');
const a=`import {evaluateDirected,validateDirected,type DirectedSequence} from '../src/engine3d/directed';`;
if(s.split(a).length!==2)throw Error('anchor');
s=s.replace(a,a+`\nimport {ASSEMBLY_KINDS} from '../src/engine3d/demonstration-contracts';\nimport {environmentStyleOf} from '../src/engine3d/demonstration-geometry';`);writeFileSync(f,s);
