import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ingestScript} from '../src/script-mode/ingest';
import {understandScript} from '../src/script-mode/understand';
import {plannerInputFromScript} from '../src/script-mode/input';
import {planVisualCausal} from '../src/visual-causal/planner';
import {validateVisualPlan} from '../src/visual-causal/verify';
import {compileVisualPlan} from '../src/visual-causal/compile';
import {selectDemonstrations,demonstrationSummary} from '../src/visual-causal/demonstrations';
import {directionMetrics} from '../src/visual-causal/direction-metrics';
import type {VisualCausalPlan} from '../src/visual-causal/contracts';
/** Phase29 Demonstration-First director: every script idea gets a strategy chosen from its actions (never its topic). */
const demos=(t:string)=>{const u=understandScript(ingestScript(t));return selectDemonstrations(u,new Set(u.claims.filter(c=>c.status==='SCRIPT_ASSERTED').map(c=>c.id)));};
const strategies=(t:string)=>new Set(demos(t).map(d=>d.strategy));
function plan(t:string){
 const u=understandScript(ingestScript(t));let at=0;
 const timing=u.segments.map(s=>{const len=Math.max(45,Math.round(s.span.text.split(/\s+/).length/2.6*30));const w={sentenceId:s.id,startFrame:at,endFrame:at+len};at+=len;return w;});
 const input=plannerInputFromScript(u,timing,30),p=planVisualCausal(input);
 return{u,input,timing,plan:p};
}
const COOKER='Quando a panela fecha, o vapor fica preso. O fogo aquece a água. A água ferve e vira vapor. O vapor empurra o pino para cima. O pino desce de novo.';
const FLUSH='A tampa de borracha abre a saída. A água da caixa escorre para o vaso. O nível no vaso sobe. A boia desce e abre a válvula.';
const BOAT='O vento empurra o barco para a frente. A vela recebe o vento. O barco navega pelo rio.';
// Domain never used while developing the director.
const DAM='A comporta abre. A água escorre pelo canal. O nível da represa desce. A comporta fecha.';
const BALANCE='O peso puxa o foguete para baixo. Para subir, ele precisa de uma força que compense esse peso: o empuxo. O empuxo equilibra o peso.';

test('closed vessel ideas become state changes, a cutaway of the hidden change and motion of the moving part',()=>{
 const s=strategies(COOKER);
 for(const k of ['STATE_CHANGE','CUTAWAY_REVEAL','MOTION_RESPONSE'] as const)assert.ok(s.has(k),k);
 assert.ok(!s.has('EXPERIMENT_AB'),'no A/B without two stated conditions');
 assert.ok(demos(COOKER).filter(d=>d.strategy==='CUTAWAY_REVEAL').every(d=>d.stage==='CUTAWAY_STAGE'));
 // A part moving inside its own system stays on the system stage (no isolation studio).
 assert.ok(demos(COOKER).filter(d=>d.strategy==='MOTION_RESPONSE').every(d=>d.stage==='SYSTEM_STAGE'));
});
test('tank and outlet ideas become opening, flow and level accumulation',()=>{
 const s=strategies(FLUSH);
 for(const k of ['STATE_CHANGE','FLOW_DEMONSTRATION','ACCUMULATION'] as const)assert.ok(s.has(k),k);
 assert.ok(!s.has('EXPERIMENT_AB'));
});
test('a pushed vessel becomes component→action→result and a followed travel',()=>{
 const ds=demos(BOAT);
 assert.equal(ds[0].strategy,'COMPONENT_ACTION_RESULT');
 assert.ok(ds.some(d=>d.strategy==='FOLLOW_ACTION'&&d.stage==='WORLD_STAGE'));
});
test('an unseen domain is directed by the same generic rules (open → flow → depletion → close)',()=>{
 assert.deepEqual(demos(DAM).map(d=>d.strategy),['STATE_CHANGE','FLOW_DEMONSTRATION','DEPLETION','STATE_CHANGE']);
 assert.deepEqual(demos(DAM).map(d=>d.observable),['OPEN','FLOW','EMPTY','CLOSE']);
});
test('A/B experiment only when the script states both conditions, each condition tied to a script claim',()=>{
 const ds=demos(BALANCE),ab=ds.filter(d=>d.strategy==='EXPERIMENT_AB');
 assert.equal(ab.length,1);
 const x=ab[0].experiment!;assert.deepEqual(x.conditions.map(c=>c.label),['A','B']);
 const u=understandScript(ingestScript(BALANCE)),claims=new Set(u.claims.map(c=>c.id));
 assert.ok(x.conditions.every(c=>claims.has(c.claimId))&&claims.has(x.verdictClaimId));
 assert.equal(ab[0].stage,'EXPERIMENT_STAGE');
 // Only one stated condition: the director must not invent the other side.
 assert.ok(!strategies('O peso puxa o foguete para baixo. O foguete continua no ar.').has('EXPERIMENT_AB'));
});
test('ideas without a visible manifestation are UNSUPPORTED, never drawn as physical results',()=>{
 const ds=demos('O peso puxa o foguete para baixo. Uma força ajuda o foguete.');
 const unsupported=ds.filter(d=>d.support==='UNSUPPORTED');
 assert.ok(unsupported.every(d=>d.strategy==='NAMED_ONLY'||d.strategy==='PROGRESSIVE_ASSEMBLY'));
 const s=demonstrationSummary(ds);assert.equal(Object.values(s.support).reduce((a,b)=>a+b,0),ds.length);
});
test('the persistent subject grows in versions as parts are named for the first time',()=>{
 const ds=demos(FLUSH);
 const versions=ds.map(d=>d.subjectVersion);
 assert.deepEqual(versions,[...versions].sort((a,b)=>a-b),'versions never go back');
 assert.ok(Math.max(...versions)>=2);
 assert.ok(ds.filter(d=>d.assembles.length).every(d=>d.assembles.every(p=>ds.filter(x=>x.assembles.includes(p)).length===1)),'each part assembled once');
});
test('selection is deterministic',()=>{assert.deepEqual(demos(DAM),demos(DAM));assert.deepEqual(demos(BALANCE),demos(BALANCE));});

test('moving-subject plan: demonstrations are planned, valid, compilable and change the subject over time',()=>{
 const {plan:p,timing,u}=plan(BALANCE);
 assert.equal(p.world.template,'MOTION_STAGE');
 assert.ok(p.demonstrations?.length);
 assert.deepEqual(validateVisualPlan(p,p.beats.flatMap(b=>b.relationIds)).issues.filter(i=>!i.startsWith('UNKNOWN')),[]);
 const seq=compileVisualPlan(p,{sentences:timing.map(t=>({id:t.sentenceId,text:u.segments.find(s=>s.id===t.sentenceId)!.span.text,startFrame:t.startFrame,endFrame:t.endFrame}))});
 assert.ok(seq.totalFrames>0);
 const m=directionMetrics(p);
 assert.ok(m.meaningfulVisualChanges>=3);assert.equal(m.labelOnlyExplanations,0);
 // Arrows alone may only illustrate (SYMBOLIC); a DIRECT/PARTIAL idea always moves or changes the subject itself.
 const arrowsOnly=p.beats.filter(b=>b.grounding==='FACTUAL_DEMONSTRATION'&&b.operations.length&&b.operations.filter(o=>o.operation!=='HIGHLIGHT').every(o=>p.world.entities.find(e=>e.entityId===o.target)?.assembly==='FORCE_ARROW'||p.world.entities.find(e=>e.entityId===o.target)?.role==='CONTEXT_PROP'));
 assert.ok(arrowsOnly.every(b=>b.proof?.level==='SYMBOLIC'));assert.ok(m.arrowOnlyExplanations<=arrowsOnly.length);
 assert.ok(m.microStageSwitches>=1,'experiment isolates the subject on its own stage');
 // Experiment conditions are beats with their own labels A / B.
 assert.ok(p.beats.some(b=>b.label==='A ✗')&&p.beats.some(b=>b.label==='B ✓'));
});
test('density counts subject changes only: camera choices, cuts and empty beats cannot inflate it',()=>{
 const {plan:p}=plan(BALANCE),m=directionMetrics(p);
 const recut:VisualCausalPlan={...p,beats:p.beats.flatMap(b=>{const mid=Math.floor((b.startFrame+b.endFrame)/2);
  return[{...b,endFrame:mid},{...b,id:b.id+'_cut',startFrame:mid,operations:[],cameraVariant:(b.cameraVariant??0)+1}];})};
 const r=directionMetrics(recut);
 assert.equal(r.meaningfulVisualChanges,m.meaningfulVisualChanges);
 const highlights:VisualCausalPlan={...p,beats:p.beats.map(b=>({...b,operations:[...b.operations,{operation:'HIGHLIGHT',target:b.focusEntityId??'body',parameters:{},startOffset:0,endOffset:1}]}))};
 assert.equal(directionMetrics(highlights).meaningfulVisualChanges,m.meaningfulVisualChanges,'highlights are support, not change');
 assert.ok(m.longestNoMeaningfulChangeSeconds>0&&m.longestNoMeaningfulChangeSeconds<=p.totalFrames/p.fps);
});
test('director code has no topic branches',()=>{
 const words=/avi[aã]o|airplane|aircraft|\bwing\b|\basas?\b|panela|cooker|descarga|toilet|flush|barco|\bboat\b|foguete|rocket|comporta|represa|sustenta[cç][aã]o/i;
 for(const f of ['src/visual-causal/demonstrations.ts','src/visual-causal/direction-metrics.ts','src/visual-causal/motion-world.ts','src/visual-causal/motion-camera.ts'])
  assert.ok(!words.test(readFileSync(f,'utf8')),f);
});
