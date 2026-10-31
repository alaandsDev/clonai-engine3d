import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ingestScript} from '../src/script-mode/ingest';
import {understandScript} from '../src/script-mode/understand';
import {plannerInputFromScript} from '../src/script-mode/input';
import {planVisualCausal} from '../src/visual-causal/planner';
import {validateVisualPlan} from '../src/visual-causal/verify';
import {compileVisualPlan} from '../src/visual-causal/compile';
import {demonstrationExecution,spatialRelations} from '../src/visual-causal/demonstration-execution';
/** Phase29 execution layer: a strategy the Director selects must become physical operations in the plan. */
function run(t:string){
 const u=understandScript(ingestScript(t));let at=0;
 const timing=u.segments.map(s=>{const w={sentenceId:s.id,startFrame:at,endFrame:at+90};at+=90;return w;});
 const input=plannerInputFromScript(u,timing,30),plan=planVisualCausal(input);
 assert.deepEqual(validateVisualPlan(plan,input.relations.map(r=>r.id)).issues,[]);
 const seq=compileVisualPlan(plan,{sentences:timing.map(x=>({id:x.sentenceId,text:u.segments.find(s=>s.id===x.sentenceId)!.span.text,startFrame:x.startFrame,endFrame:x.endFrame}))});
 return{u,plan,seq,x:demonstrationExecution(plan)};
}
const ops=(plan:ReturnType<typeof run>['plan'])=>plan.beats.flatMap(b=>b.operations.map(o=>({b,o})));
const FLOW='A água sai do tanque. A água escorre pelo cano até a bacia. O nível da bacia sobe.';
const CUTAWAY_STATE='Dentro da caixa, a água passa pelo filtro. A água ferve e vira vapor.';
const LEVER='A alavanca abre a comporta. A água sai pelo canal.';
const ROTOR='A água empurra a roda. A roda gira o eixo.';
const ASSEMBLY='O ventilador fica atrás do painel. O motor liga o ventilador.';
const MACHINE='Dentro do aquário, a água passa pela mangueira. A água circula pelo tubo. A bomba empurra essa água. Quando o nível baixa, a boia desliga a bomba.';

test('FLOW: source → path → destination, with movement along the path and the destination changing',()=>{
 const {plan,x}=run(FLOW);
 assert.equal(x.demonstrationExecutionRate,1);
 assert.ok(ops(plan).some(({o})=>o.operation==='FLOW'&&Array.isArray(o.parameters.path)));
 assert.ok(ops(plan).some(({o})=>o.operation==='INCREASE'&&o.parameters.parameter==='fillLevel'));
 assert.equal(x.waitOnlyFactualBeats,0);
});
test('CUTAWAY + STATE: the housing opens, the inside becomes visible and the material goes liquid → gas (after persists)',()=>{
 const {plan,x}=run(CUTAWAY_STATE);
 assert.equal(plan.world.cutaway.kind,'HOUSING_SECTION');assert.ok(plan.layout?.enclosure);
 const all=ops(plan),open=all.findIndex(({o})=>o.target===plan.layout!.enclosure&&o.operation==='INCREASE'),state=all.findIndex(({o})=>o.target==='state_tint'&&o.parameters.parameter==='fillLevel');
 assert.ok(open>=0&&state>open,'opens before the state change');
 assert.ok(all.some(({b,o})=>o.target==='state_tint'&&b.cameraZone==='CUTAWAY'));
 assert.ok(!all.some(({o})=>o.target==='state_tint'&&o.operation==='DECREASE'),'AFTER persists');
 assert.deepEqual(x.spatialRelationViolations,[]);assert.equal(x.cutaways.executed,x.cutaways.selected);
});
test('COMPONENT → ACTION → RESULT: the lever opens the gate and the water leaves along the channel',()=>{
 const {plan,x}=run(LEVER);assert.equal(x.demonstrationExecutionRate,1);
 assert.ok(ops(plan).some(({o})=>o.operation==='ROTATE'));assert.ok(ops(plan).some(({o})=>o.operation==='FLOW'));
});
test('CAUSE → EFFECT on connected parts: the pushed wheel turns the shaft',()=>{
 const {x}=run(ROTOR);assert.equal(x.demonstrationExecutionRate,1);
 assert.ok(x.executions.find(e=>e.strategy==='COMPONENT_ACTION_RESULT')?.executed);
});
test('ASSEMBLY + spatial relation: a part named for the first time enters and sits behind what the script says',()=>{
 const {plan,x}=run(ASSEMBLY);
 const pa=x.executions.find(e=>e.strategy==='PROGRESSIVE_ASSEMBLY')!;assert.ok(pa.executed);
 assert.ok(pa.actions.some(a=>a.operation==='REVEAL')&&pa.actions.some(a=>a.operation==='MOVE'));
 assert.ok(plan.layout?.placed?.some(p=>p.relation==='BEHIND'));assert.deepEqual(x.spatialRelationViolations,[]);
});
test('STATE CHANGE on a powered part: switched off means it was running (derived) and stays off afterwards',()=>{
 const {plan,x}=run(MACHINE);
 const m=plan.layout!.machines[0];assert.ok(m);
 assert.ok(plan.layout!.derivedInitialStates.some(d=>d.entityId===m&&d.value===1));
 const off=ops(plan).filter(({o})=>o.target===m&&o.operation==='DECREASE');assert.equal(off.length,1);
 assert.ok(!ops(plan).some(({b,o})=>o.target===m&&o.operation==='INCREASE'&&b.startFrame>off[0].b.startFrame));
 // A selected strategy the planner could not execute is reported, not hidden.
 assert.ok(x.notExecuted.every(n=>x.executions.some(e=>n.startsWith(e.demonstrationId)&&!e.executed)));
 assert.equal(x.demonstrationExecutionRate,+(x.executed/x.selectedExecutable).toFixed(3));
});
test('EXPERIMENT A/B on a moving body keeps its approved execution',()=>{
 const {x}=run('O peso puxa o foguete para baixo. Para subir, ele precisa de uma força que compense esse peso: o empuxo. O empuxo equilibra o peso.');
 assert.equal(x.experiments.selected,1);assert.equal(x.experiments.executed,1);
});
test('spatial relations come from stated phrases only',()=>{
 const u=understandScript(ingestScript('A água passa pelo filtro. O motor liga a bomba.'));assert.deepEqual(spatialRelations(u),[]);
 const v=understandScript(ingestScript('Dentro da caixa, a água passa pelo filtro.'));assert.equal(spatialRelations(v)[0].relation,'INSIDE');
});
test('UNSUPPORTED never counts in the execution rate',()=>{
 const {x}=run('O calor entra o tempo todo. A água passa pelo cano.');
 assert.ok(x.executions.filter(e=>e.supportLevel==='UNSUPPORTED').every(e=>!e.executable));
});
test('execution layer has no topic branches',()=>{
 const code=readFileSync('src/visual-causal/demonstration-execution.ts','utf8').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
 assert.ok(!/geladeira|evaporador|compressor|condensador|termostato|refrigerante|panela|descarga|aviao|turbina|aquario|caixa d/.test(code));
});
