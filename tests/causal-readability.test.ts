import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ingestScript} from '../src/script-mode/ingest';
import {understandScript} from '../src/script-mode/understand';
import {plannerInputFromScript} from '../src/script-mode/input';
import {planVisualCausal} from '../src/visual-causal/planner';
import {validateVisualPlan} from '../src/visual-causal/verify';
import {compileVisualPlan} from '../src/visual-causal/compile';
import {visualQa} from '../src/visual-causal/qa';
/** Phase29 visual causal readability: functional silhouettes from stated roles, before → action → after, questions,
 * payoff recap, meaningful stasis. */
function run(t:string){
 const u=understandScript(ingestScript(t));let at=0;
 const timing=u.segments.map(s=>{const len=Math.round(s.span.text.split(/\s+/).length/2.7*30)+8;const w={sentenceId:s.id,startFrame:at,endFrame:at+len};at+=len;return w;});
 const input=plannerInputFromScript(u,timing,30),plan=planVisualCausal(input);
 assert.deepEqual(validateVisualPlan(plan,input.relations.map(r=>r.id)).issues,[]);
 const seq=compileVisualPlan(plan,{sentences:timing.map(x=>({id:x.sentenceId,text:u.segments.find(s=>s.id===x.sentenceId)!.span.text,startFrame:x.startFrame,endFrame:x.endFrame}))});
 return{plan,seq,qa:visualQa(plan,seq)};
}
const FRIDGE=readFileSync('roteiro-geladeira-v3.txt','utf8');
const forms=(p:ReturnType<typeof run>['plan'])=>Object.fromEntries((p.functionalForms??[]).map(f=>[f.form,f]));
test('functional silhouettes come from stated roles, each backed by a relation',()=>{
 const {plan}=run(FRIDGE),f=forms(plan);
 for(const k of ['COMPRESSOR_LIKE','VALVE_LIKE','HEAT_EXCHANGER','CONTROL_UNIT','CONDUIT','COIL'])assert.ok(f[k],k);
 for(const c of plan.functionalForms!)assert.ok(c.relationIds.length>0,c.entityId);
 assert.equal(f.CONTROL_UNIT.controls,f.COMPRESSOR_LIKE.entityId);assert.ok(f.CONTROL_UNIT.staged,'an unstated location is declared as staging');
});
test('renaming every part gives the same silhouettes (no name rule)',()=>{
 const renamed=FRIDGE.replace(/compressor/g,'motor').replace(/válvula/g,'peça').replace(/grade/g,'placa').replace(/termostato/g,'sensor');
 const a=Object.keys(forms(run(FRIDGE).plan)).sort(),b=Object.keys(forms(run(renamed).plan)).sort();assert.deepEqual(b,a);
});
test('a mechanism without those roles keeps its own shapes (no invented compressor, valve or exchanger)',()=>{
 const f=forms(run('A chaleira fica sobre o fogo. O fogo aquece a água. A água ferve.').plan);
 for(const k of ['COMPRESSOR_LIKE','VALVE_LIKE','HEAT_EXCHANGER','CONTROL_UNIT'])assert.equal(f[k],undefined,k);
});
test('causal readability: what it is, what happens, what changed and the result are visible for every factual demonstration',()=>{
 const r=run(FRIDGE).qa.readability;assert.ok(r.checked>=15);assert.ok(r.causalReadabilityRate!>=0.9,JSON.stringify(r.fails));
});
test('the controller switches before the part it controls (cause → effect)',()=>{
 const {plan}=run(FRIDGE),f=forms(plan),b=plan.beats.find(b=>b.operations.some(o=>o.target===f.CONTROL_UNIT.entityId&&o.operation==='DECREASE'))!;
 const ctl=b.operations.find(o=>o.target===f.CONTROL_UNIT.entityId)!,part=b.operations.find(o=>o.target===f.COMPRESSOR_LIKE.entityId)!;assert.ok(ctl.endOffset<=part.startOffset);
});
test('question: hold, then the quantity starts along the stated circuit toward the part that answers it (editorial, no relation)',()=>{
 const {plan}=run(FRIDGE),q=plan.beats.filter(b=>b.visualIntent==='QUESTION_HOLD');assert.ok(q.length>=2);
 const ant=q.find(b=>b.operations.some(o=>o.operation==='FLOW'))!;assert.equal(ant.grounding,'EDITORIAL_CONTEXT');assert.deepEqual(ant.relationIds,[]);
 const flow=ant.operations.find(o=>o.operation==='FLOW')!;assert.ok(flow.startOffset>=0.25,'small hold before the trajectory begins');
 const e=plan.world.entities.find(x=>x.entityId===flow.target)!,enc=plan.world.entities.find(x=>x.entityId===plan.layout!.enclosure)!;
 assert.ok([0,1,2].every(i=>Math.abs(e.path![0][i]-enc.position[i])<=enc.size[i]/2),'starts inside');assert.ok(e.path!.at(-1)![2]<enc.position[2]-enc.size[2]/2,'ends behind');
});
test('payoff: the stated chain is replayed from the inside to the back, then the object closes and the last shot is not frozen',()=>{
 const {plan,qa}=run(FRIDGE),i=plan.beats.findIndex(b=>b.visualIntent==='PAYOFF_RECAP');assert.ok(i>0);
 const recap=plan.beats[i],flow=recap.operations.find(o=>o.operation==='FLOW')!,e=plan.world.entities.find(x=>x.entityId===flow.target)!,enc=plan.world.entities.find(x=>x.entityId===plan.layout!.enclosure)!;
 assert.equal(e.grounding,'EDITORIAL');assert.deepEqual(e.relationIds,[]);assert.equal(recap.presenterVisible,false);
 assert.ok([0,1,2].every(k=>Math.abs(e.path![0][k]-enc.position[k])<=enc.size[k]/2),'starts inside');assert.ok(e.path!.at(-1)![2]<enc.position[2]-enc.size[2]/2,'ends behind');
 const last=plan.beats.at(-1)!;assert.ok(i<plan.beats.length-1);assert.ok(last.operations.some(o=>o.target===enc.entityId&&o.operation==='DECREASE'));
 assert.ok(qa.spatial!.endingStaticSeconds<=1.5);
});
test('meaningful stasis ignores camera motion: the presenter hook with a moving camera is still stasis; the mechanism has no long dead time',()=>{
 const {qa}=run(FRIDGE),m=qa.meaningfulStasis!;assert.ok(m.stasisOver.some(s=>s.from===0&&s.seconds>=5),'camera drift is not progress');
 const inside=m.stasisOver.filter(s=>s.from>12);assert.ok(inside.every(s=>s.seconds<=3),JSON.stringify(inside));assert.ok(m.meaningfulChangesPer10s>=2);
});
test('readability code has no topic branches',()=>{
 for(const f of ['src/visual-causal/functional-form.ts','src/engine3d/functional-parts.tsx','src/visual-causal/readability.ts']){const c=readFileSync(f,'utf8').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();assert.ok(!/geladeira|refrigerator|fridge|evaporador|condensador|termostato|valvula|grade\b/.test(c),f);}
});
