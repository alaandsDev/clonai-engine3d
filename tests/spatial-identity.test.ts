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
/** Phase29 object identity, persistent spatial map, location-first framing and meaningful ending. */
function run(t:string){
 const u=understandScript(ingestScript(t));let at=0;
 const timing=u.segments.map(s=>{const len=Math.round(s.span.text.split(/\s+/).length/2.7*30)+8;const w={sentenceId:s.id,startFrame:at,endFrame:at+len};at+=len;return w;});
 const input=plannerInputFromScript(u,timing,30),plan=planVisualCausal(input);
 assert.deepEqual(validateVisualPlan(plan,input.relations.map(r=>r.id)).issues,[]);
 const seq=compileVisualPlan(plan,{sentences:timing.map(x=>({id:x.sentenceId,text:u.segments.find(s=>s.id===x.sentenceId)!.span.text,startFrame:x.startFrame,endFrame:x.endFrame}))});
 return{plan,seq,qa:visualQa(plan,seq)};
}
const FRIDGE=readFileSync('roteiro-geladeira-v3.txt','utf8');
test('household appliance: a stated door gives the housing a recognizable front (structure only, no functional part)',()=>{
 const {plan,qa}=run(FRIDGE),enc=plan.world.entities.find(e=>e.entityId===plan.spatialMap!.object)!;
 assert.equal(enc.variant,'DOOR_FRONT');assert.ok(plan.spatialMap!.features.includes('DOOR'));assert.equal(qa.spatial!.objectRecognizability,1);
 assert.equal(enc.relationIds.length>0||enc.grounding==='EDITORIAL',true);
});
test('a housing without a stated door keeps the plain section (no invented door)',()=>{
 const {plan}=run('Dentro da caixa, a água passa pelo filtro. A água ferve e vira vapor.');
 const enc=plan.world.entities.find(e=>e.assembly==='ENCLOSURE')!;assert.notEqual(enc.variant,'DOOR_FRONT');
});
test('spatial map: parts live in the object frame and never move except to join it once',()=>{
 const {plan}=run(FRIDGE),m=plan.spatialMap!;
 assert.ok(m.parts.some(p=>p.region==='INSIDE')&&m.parts.some(p=>p.region==='BEHIND'||p.region==='REAR_LOW'));
 for(const p of m.parts){const moves=plan.beats.flatMap(b=>b.operations).filter(o=>o.target===p.entityId&&o.operation==='MOVE');assert.ok(moves.length<=1,p.entityId);}
 const enc=plan.beats.flatMap(b=>b.operations).filter(o=>o.target===m.object);assert.ok(!enc.some(o=>['MOVE','HIDE','REVEAL'].includes(o.operation)),'exterior and cut-away are the same object');
});
test('orientation: no extreme angles, parent object kept in view, every part located before its action, ending not frozen',()=>{
 const {qa}=run(FRIDGE),s=qa.spatial!;
 assert.equal(s.extremeCameraAngleCount,0);assert.equal(s.uncontextualizedDetailShots,0);assert.ok(s.componentLocationClarity!>=0.9);
 assert.ok(s.routeContinuity===1);assert.ok(s.endingStaticSeconds<=1.5,'static ending '+s.endingStaticSeconds);
});
test('plumbing fixture, vertical machine, container on heat and vehicle keep their own staging',()=>{
 const toilet=run(readFileSync('roteiro.txt','utf8')).plan;assert.equal(toilet.context?.context,'BATHROOM_LIKE');
 const shaft=run('O motor puxa o cabo. O cabo levanta a cabine até o último andar do prédio. A cabine sobe.').plan;assert.equal(shaft.context?.context,'BUILDING_SHAFT');
 const vessel=run('A chaleira fica sobre o fogo. O fogo aquece a água. A água ferve.').plan;assert.equal(vessel.context?.context,'KITCHEN_LIKE');
 const plane=run('O peso puxa o avião para baixo. Os motores impulsionam o avião para a frente.').plan;assert.equal(plane.world.template,'MOTION_STAGE');assert.equal(plane.spatialMap,undefined);
});
test('identity and map code has no topic branches',()=>{
 for(const f of ['src/visual-causal/demonstration-execution.ts','src/visual-causal/script-world.ts','src/engine3d/motion-assemblies.tsx']){const c=readFileSync(f,'utf8').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();assert.ok(!/geladeira|refrigerator|fridge|compressor|evaporador|condensador/.test(c),f);}
});
