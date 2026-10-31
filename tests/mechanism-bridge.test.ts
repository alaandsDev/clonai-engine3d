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
/** Phase29 bridge: admitted mechanism relations drive visible changes (or recorded gaps), filmed where they happen. */
function run(t:string){
 const u=understandScript(ingestScript(t));let at=0;
 const timing=u.segments.map(s=>{const len=Math.round(s.span.text.split(/\s+/).length/2.7*30)+8;const w={sentenceId:s.id,startFrame:at,endFrame:at+len};at+=len;return w;});
 const input=plannerInputFromScript(u,timing,30),plan=planVisualCausal(input);
 assert.deepEqual(validateVisualPlan(plan,input.relations.map(r=>r.id)).issues,[]);
 const seq=compileVisualPlan(plan,{sentences:timing.map(x=>({id:x.sentenceId,text:u.segments.find(s=>s.id===x.sentenceId)!.span.text,startFrame:x.startFrame,endFrame:x.endFrame}))});
 return{u,input,plan,seq,qa:visualQa(plan,seq)};
}
const FRIDGE=readFileSync('roteiro-geladeira-v3.txt','utf8');
test('every admitted mechanism relation is executed by a carrier, already executed by a claim, or recorded as a gap',()=>{
 const {u,plan}=run(FRIDGE),m=plan.mechanismExecution!;
 const admitted=(u.mechanism??[]).filter(r=>!r.negated&&r.modality!=='POSSIBLE').map(r=>r.id).sort();
 const accounted=[...m.carriers.map(c=>c.relationId),...m.gaps.map(g=>g.relationId),...m.coveredByClaims].sort();
 assert.deepEqual([...new Set(accounted)].sort(),admitted);
 assert.ok(m.carriers.length>=8,'transfers, routes, states, action and property are carried');
});
test('each carried relation is a beat with an observable change on its carrier and a camera target',()=>{
 const {plan}=run(FRIDGE);
 for(const c of plan.mechanismExecution!.carriers){const b=plan.beats.find(b=>b.relationIds.includes(c.relationId)&&b.operations.some(o=>o.target===c.entityId&&o.operation!=='REVEAL'&&o.operation!=='HIDE'));
  assert.ok(b,'beat for '+c.relationId);assert.equal(b!.focusEntityId,c.cameraTarget);assert.ok(c.observableChange&&c.result);}
});
test('heat has no geometry of its own: it is never DIRECT proof, only a representation',()=>{
 const {plan}=run(FRIDGE);
 assert.ok(plan.mechanismExecution!.carriers.filter(c=>c.entityId.startsWith('transfer_')).every(c=>c.supportLevel!=='DIRECT'));
});
test('changes happen inside the frame (no off-frame state change)',()=>{
 const {qa}=run(FRIDGE);assert.deepEqual(qa.offFrameChanges,[]);
});
test('a transfer is an event (gone after its beat); a state at a component stays until the material leaves it',()=>{
 const {plan}=run(FRIDGE),ops=plan.beats.flatMap(b=>b.operations.map(o=>({b,o})));
 for(const c of plan.mechanismExecution!.carriers.filter(c=>c.operation==='FLOW')){const flow=ops.find(x=>x.o.target===c.entityId&&x.o.operation==='FLOW')!,hide=ops.find(x=>x.o.target===c.entityId&&x.o.operation==='HIDE');assert.ok(hide&&hide.b===flow.b);}
 const leaving=plan.mechanismExecution!.carriers.filter(c=>c.fromEntityId);
 for(const c of plan.mechanismExecution!.carriers.filter(c=>c.atEntityId&&leaving.some(l=>l.fromEntityId===c.atEntityId))){const set=ops.find(x=>x.o.target===c.entityId&&x.o.operation!=='REVEAL'&&x.o.operation!=='HIDE')!,hide=ops.find(x=>x.o.target===c.entityId&&x.o.operation==='HIDE');
  assert.ok(hide&&hide.b.startFrame>set.b.startFrame,'state persists past its own beat: '+c.entityId);}
});
test('the bridge is generic: another enclosed mechanism gets transfer, action and state carriers',()=>{
 const {plan}=run('Dentro da caixa, a água passa pelo cano. A água absorve o calor da caixa. Depois, a bomba comprime o gás, que fica quente.');
 const kinds=new Set(plan.mechanismExecution!.carriers.map(c=>c.entityId.split('_')[0]));
 assert.ok(kinds.has('transfer')&&kinds.has('tint'),JSON.stringify([...kinds]));
});
test('a moving-body script is untouched by the mechanism bridge',()=>{
 const {plan}=run('O peso puxa o foguete para baixo. Para subir, ele precisa de uma força que compense esse peso: o empuxo. O empuxo equilibra o peso.');
 assert.equal(plan.world.template,'MOTION_STAGE');assert.equal(plan.mechanismExecution,undefined);
});
test('bridge code has no topic branches',()=>{
 const code=readFileSync('src/visual-causal/mechanism-bridge.ts','utf8').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
 assert.ok(!/geladeira|evaporador|compressor|condensador|termostato|refrigerante|grade|valvula/.test(code));
});
