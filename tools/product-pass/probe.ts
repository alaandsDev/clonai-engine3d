import {readFileSync} from 'node:fs';
import {planVisualCausal} from '../../src/visual-causal/planner';
import {compileVisualPlan} from '../../src/visual-causal/compile';
import {jsonHash} from '../../src/editorial/fingerprint';
const r='out/engine3d/script-mode/roteiro-panela-product-pass',load=(f:string)=>JSON.parse(readFileSync(r+'/'+f,'utf8')),input=load('planner-input.json'),p=planVisualCausal(input),seq=compileVisualPlan(p,{sentences:input.timing.map((t:any)=>({...t,id:t.sentenceId,text:input.sentences.find((s:any)=>s.id===t.sentenceId).text}))});
console.log(JSON.stringify({planSame:p.fingerprint===load('visual-plan.json').fingerprint,sequenceSame:jsonHash(seq)===jsonHash(load('directed-sequence.json')),duration:seq.totalFrames/seq.fps}));
