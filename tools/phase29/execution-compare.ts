/** Operator: execution metrics of a stored plan (before) vs the current planner on the same script (after). */
import {readFileSync} from 'node:fs';
import {ingestScript} from '../../src/script-mode/ingest';import {understandScript} from '../../src/script-mode/understand';import {plannerInputFromScript} from '../../src/script-mode/input';import {planVisualCausal} from '../../src/visual-causal/planner';
import {validateVisualPlan} from '../../src/visual-causal/verify';import {compileVisualPlan} from '../../src/visual-causal/compile';import {directionMetrics} from '../../src/visual-causal/direction-metrics';
const m=(p:any)=>{const d=directionMetrics(p),e=d.execution;return{rate:e.demonstrationExecutionRate,exec:e.executed+'/'+e.selectedExecutable,not:e.notExecuted.map((x:string)=>x.split(':')[1]),wait:e.waitOnlyFactualBeats,viol:e.spatialRelationViolations.length,mc:d.meaningfulVisualChanges,per10:d.meaningfulChangesPer10s,gap:d.longestNoMeaningfulChangeSeconds};};
for(const [script,stored] of [['roteiro.txt','out/engine3d/script-mode/roteiro/visual-plan.json'],['roteiro-panela.txt','out/engine3d/script-mode/roteiro-panela/visual-plan.json'],['roteiro-aviao.txt','out/engine3d/script-mode/roteiro-aviao-director-v1/visual-plan.json']]){
 const old=JSON.parse(readFileSync(stored,'utf8')),pi=JSON.parse(readFileSync(stored.replace('visual-plan.json','planner-input.json'),'utf8'));
 const u=understandScript(ingestScript(readFileSync(script,'utf8'))),input=plannerInputFromScript(u,pi.timing,pi.fps),p=planVisualCausal(input);
 const v=validateVisualPlan(p,input.relations.map((r:any)=>r.id));compileVisualPlan(p,{sentences:input.timing.map((t:any)=>({id:t.sentenceId,text:u.segments.find(s=>s.id===t.sentenceId)!.span.text,startFrame:t.startFrame,endFrame:t.endFrame}))});
 console.log(script,'valid',v.valid,'samePlan',old.fingerprint===p.fingerprint,'\n before',JSON.stringify(m(old)),'\n after ',JSON.stringify(m(p)));}
