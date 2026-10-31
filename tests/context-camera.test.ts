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
/** Phase29 context scene planner, relation-driven cutaway, causal camera, narration sync and visual callback. */
function run(t:string){
 const u=understandScript(ingestScript(t));let at=0;
 const timing=u.segments.map(s=>{const len=Math.round(s.span.text.split(/\s+/).length/2.7*30)+8;const w={sentenceId:s.id,startFrame:at,endFrame:at+len};at+=len;return w;});
 const input=plannerInputFromScript(u,timing,30),plan=planVisualCausal(input);
 assert.deepEqual(validateVisualPlan(plan,input.relations.map(r=>r.id)).issues,[]);
 const seq=compileVisualPlan(plan,{sentences:timing.map(x=>({id:x.sentenceId,text:u.segments.find(s=>s.id===x.sentenceId)!.span.text,startFrame:x.startFrame,endFrame:x.endFrame}))});
 return{plan,seq,qa:visualQa(plan,seq)};
}
const room=(p:ReturnType<typeof run>['plan'])=>p.world.entities.find(e=>e.assembly==='INTERIOR_ROOM');
const FRIDGE=readFileSync('roteiro-geladeira-v3.txt','utf8');
test('appliance with a housing is staged indoors (kitchen-like), never on the lawn',()=>{
 const {plan}=run(FRIDGE);assert.equal(plan.context?.context,'KITCHEN_LIKE');assert.equal(room(plan)?.variant,'KITCHEN_LIKE');
});
test('plumbing fixture is staged in a bathroom-like room',()=>{
 const {plan}=run(readFileSync('roteiro.txt','utf8'));assert.equal(plan.context?.context,'BATHROOM_LIKE');assert.ok(room(plan));
});
test('vertical machine gets a building-shaft context',()=>{
 const {plan}=run('O motor puxa o cabo. O cabo levanta a cabine até o último andar do prédio. A cabine sobe.');assert.equal(plan.context?.context,'BUILDING_SHAFT');
});
test('outdoor machine is not put inside a house; a vehicle stays in its medium',()=>{
 const {plan}=run('A água empurra a roda. A roda gira o eixo do moinho.');assert.equal(room(plan),undefined);assert.equal(plan.context?.context,'OUTDOOR_GROUND');
 const v=run('O peso puxa o avião para baixo. Os motores impulsionam o avião para a frente.');assert.equal(v.plan.world.template,'MOTION_STAGE');assert.equal(room(v.plan),undefined);
 assert.ok(v.plan.world.entities.some(e=>e.assembly==='CLOUD_FIELD'));
});
test('a relation inside a closed housing opens the section BEFORE its action',()=>{
 const {plan}=run(FRIDGE),enc=plan.layout!.enclosure!;
 const first=plan.beats.flatMap(b=>b.operations.map(o=>({b,o,f:b.startFrame+(b.endFrame-b.startFrame)*o.startOffset}))),open=first.find(x=>x.o.target===enc&&x.o.operation==='INCREASE')!;
 const inside=plan.mechanismExecution!.carriers.filter(c=>{const e=plan.world.entities.find(x=>x.entityId===c.entityId)!,E=plan.world.entities.find(x=>x.entityId===enc)!;return(e.path??[e.position]).some(p=>[0,1,2].every(i=>Math.abs(p[i]-E.position[i])<=E.size[i]/2));});
 for(const c of inside){const act=first.find(x=>x.o.target===c.entityId&&x.o.operation!=='REVEAL'&&x.o.operation!=='HIDE')!;assert.ok(open.f<=act.f,'section opens before '+c.relationId);}
});
test('causal camera: changes on screen, readable, rarely occluded; sync measured on the spoken predicate',()=>{
 const {qa}=run(FRIDGE);assert.deepEqual(qa.offFrameChanges,[]);assert.ok(qa.causalCamera.passRate!>=0.9,JSON.stringify(qa.causalCamera.fails));
 assert.ok(qa.semanticSync.beats>=10);assert.ok(qa.semanticSync.medianMs!<=500,'median sync '+qa.semanticSync.medianMs);
});
test('visual callback: the opened housing closes and the last shot returns to the complete object',()=>{
 const {plan}=run(FRIDGE),last=plan.beats.at(-1)!;
 assert.ok(last.operations.some(o=>o.target===plan.layout!.enclosure&&o.operation==='DECREASE'));assert.equal(last.cameraZone,'WORLD');
});
test('context and camera code have no topic branches (categories live in the shared vocabulary)',()=>{
 for(const f of ['src/visual-causal/script-world.ts','src/visual-causal/cinematic.ts','src/visual-causal/mechanism-bridge.ts','src/visual-causal/qa.ts']){
  const code=readFileSync(f,'utf8').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();assert.ok(!/geladeira|cozinha|banheiro|privada|elevador|aviao|compressor|evaporador/.test(code),f);}
});
