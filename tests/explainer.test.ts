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
import {validateOverlay} from '../src/engine3d/overlay';
import type {MechRelation} from '../src/script-mode/mechanism';
/** Explainer style (reference-video gaps): one-word captions with key words, part labels, rewind/forward marks,
 * hypothetical episode undone at a rewind cue, energy-flow class, HD output. Synthetic fixtures only. */
const FX=(n:string)=>readFileSync('tests/fixtures/'+n+'.txt','utf8');
function run(t:string,style:'CLASSIC'|'EXPLAINER'='EXPLAINER',hd=false){
 const u=understandScript(ingestScript(t));let at=0;
 const timing=u.segments.map(s=>{const len=Math.round(s.span.text.split(/\s+/).length/2.7*30)+8;const w={sentenceId:s.id,startFrame:at,endFrame:at+len};at+=len;return w;});
 const input=plannerInputFromScript(u,timing,30),plan=planVisualCausal(input);
 assert.deepEqual(validateVisualPlan(plan,input.relations.map(r=>r.id)).issues,[]);
 const seq=compileVisualPlan(plan,{sentences:timing.map(x=>({id:x.sentenceId,text:u.segments.find(s=>s.id===x.sentenceId)!.span.text,startFrame:x.startFrame,endFrame:x.endFrame})),style,...(hd?{width:1080,height:1920}:{})});
 return{u,plan,seq,qa:visualQa(plan,seq)};
}
const mech=(t:string)=>(understandScript(ingestScript(t)).mechanism??[]) as MechRelation[];
test('one-word captions cover every sentence in order; words naming a part introduced there are highlighted',()=>{
 const {seq}=run(FX('containment/a-centrifuga')),o=seq.overlay!;
 assert.equal(o.captionStyle,'WORD');assert.ok(o.words.every(w=>!/\s/.test(w.text)||w.text.split(' ').length<=2));
 for(let i=1;i<o.words.length;i++)assert.ok(o.words[i].startFrame>=o.words[i-1].endFrame);
 assert.ok(o.words.some(w=>w.key));assert.ok(!o.words.some(w=>w.key&&/^(?:de|do|da|e|a|o)$/i.test(w.text)));
});
test('labels name a part with the script\'s own words at its first appearance (no verbs, no articles)',()=>{
 const {seq,plan}=run(FX('containment/a-centrifuga')),l=seq.overlay!.labels;assert.ok(l.length>=3);
 for(const x of l){assert.ok(!/^(?:O|A|OS|AS|UM|UMA)\s/.test(x.text),x.text);assert.ok(x.text.split(' ').length<=3,x.text);}
 const first=new Map<string,number>();for(const b of plan.beats)for(const id of [b.focusEntityId,...b.operations.map(o=>o.target)])if(id&&!first.has(id))first.set(id,b.startFrame);
 for(const x of l.filter(x=>x.subjectId))assert.ok(x.startFrame>=first.get(x.subjectId!)!,x.text);
});
test('classic style keeps phrase captions and no overlay; the overlay schema refuses overlapping words',()=>{
 const {seq}=run(FX('containment/a-centrifuga'),'CLASSIC');assert.equal(seq.overlay,undefined);assert.ok(seq.captions.length>0);
 assert.throws(()=>validateOverlay({version:1,captionStyle:'WORD',words:[{text:'a',startFrame:0,endFrame:10,key:false},{text:'b',startFrame:5,endFrame:12,key:false}],labels:[],transitions:[]},100));
});
test('hypothesis → shown → rewind cue → every changed state goes back; forward cue marks a time jump',()=>{
 const {plan,seq}=run(FX('explainer/hipotese-tanque'));assert.equal(plan.episodes?.length,1);
 const rw=plan.beats.find(b=>b.visualIntent==='REWIND_TO_START')!;assert.ok(rw);assert.ok(rw.operations.length>0);
 assert.ok(plan.beats.filter(b=>b.hypothetical).length>=1);assert.ok(plan.beats.filter(b=>b.hypothetical).every(b=>b.endFrame<=rw.startFrame));
 const kinds=seq.overlay!.transitions.map(t=>t.kind);assert.ok(kinds.includes('REWIND')&&kinds.includes('FORWARD'));
});
test('a negative subject ("ninguém liga X") negates the clause instead of switching X on',()=>{
 assert.ok(mech('Ninguém liga a bomba.').every(m=>m.negated||m.type!=='CONTROL'));
 const {plan}=run(FX('explainer/hipotese-tanque'));assert.ok(!plan.beats.some(b=>b.visualIntent==='TURNS_ON'));
});
test('"corrente" is a current only in a script about electricity; a chain stays a physical thing',()=>{
 assert.notEqual(mech('Uma corrente puxa a tampa para cima.').find(m=>m.lemma==='PULL')?.subject?.category,'QUANTITY');
 const m=mech('Os elétrons passam pelos fios. A corrente vai para o visor.').find(x=>x.lemma==='GO');assert.equal(m?.subject?.category,'QUANTITY');
});
test('energy-flow class from roles (a different domain): source → collector → carriers → conductor → converter → consumer',()=>{
 const {plan,qa}=run(FX('explainer/sensor-luz')),a=(x:string)=>plan.world.entities.find(e=>e.assembly===x||e.variant===x);
 for(const k of ['RADIANT_SOURCE','COLLECTOR_PANEL','CONVERTER_LIKE'])assert.ok(a(k),k);
 for(const intent of ['RADIANT_ENERGY_ARRIVES','CARRIERS_FLOW_IN_CONDUCTOR','CONVERTER_CHANGES_KIND','CONSUMER_ON'])assert.ok(plan.beats.some(b=>b.visualIntent===intent),intent);
 assert.equal(qa.demonstrationQa.verdict,'PASS',JSON.stringify(qa.demonstrationQa.failed));
});
test('energy-flow class stays off without radiant energy reaching a collector',()=>{
 for(const f of ['containment/a-centrifuga','containment/d-bomba-tubo'])assert.ok(!run(FX(f)).plan.world.entities.some(e=>e.assembly==='RADIANT_SOURCE'||e.assembly==='COLLECTOR_PANEL'),f);
});
test('HD output: 1080×1920 sequence with the same plan',()=>{const {seq}=run(FX('explainer/sensor-luz'),'EXPLAINER',true);assert.equal(seq.width,1080);assert.equal(seq.height,1920);});
test('explainer and energy code has no topic words',()=>{
 for(const f of ['src/visual-causal/energy-flow.ts','src/engine3d/energy-assemblies.tsx','src/visual-causal/overlay.ts','src/engine3d/overlay-layer.tsx']){const c=readFileSync(f,'utf8').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  assert.ok(!/solar|fotovolt|painel|inversor|silicio|celula|calculadora|\bplaca\b|\bsol\b/.test(c),f);}
});
test('energy shots: a moved part is framed where it is, a move holds start and destination, close-ups centre on the part',()=>{
 const {plan,seq}=run(FX('explainer/energia-casa')),E=(id:string)=>plan.world.entities.find(e=>e.entityId===id)!;
 const box=(pts:number[][])=>[0,1,2].map(i=>[Math.min(...pts.map(p=>p[i])),Math.max(...pts.map(p=>p[i]))]);
 const inside=(p:number[],b:number[][])=>[0,1,2].every(i=>p[i]>=b[i][0]-0.3&&p[i]<=b[i][1]+0.3);
 const mv=plan.beats.find(b=>b.operations.some(o=>o.operation==='MOVE'&&!o.observed&&b.framing))!;assert.ok(mv,'a framed move');
 const o=mv.operations.find(o=>o.operation==='MOVE')!,b0=box(mv.framing!.points);assert.ok(inside(E(o.target).position,b0)&&inside(o.parameters.to as number[],b0));
 // no camera ride-along during that move: the camera holds (no FOLLOW segment inside the beat)
 assert.ok(!seq.cameraSegments.some(c=>c.behavior==='FOLLOW'&&c.startFrame>=mv.startFrame&&c.endFrame<=mv.endFrame));
 // after the move, every beat acting on that part frames it at its destination, never at its old place
 for(const b of plan.beats.filter(b=>b.startFrame>=mv.endFrame&&b.framing&&b.operations.some(x=>x.target===o.target&&x.operation!=='HIGHLIGHT')))
  assert.ok(inside(o.parameters.to as number[],box(b.framing!.points))&&!inside(E(o.target).position,box(b.framing!.points)),b.visualIntent);
 // a small part's close-up is centred on it and crops the building instead of framing the whole facade
 const bld=plan.world.entities.find(e=>e.role==='MAIN_SYSTEM')!;
 for(const b of plan.beats.filter(b=>b.framing&&!b.framing.reveal&&b.operations.some(x=>{const e=E(x.target);return e.kind!=='PATH'&&Math.max(...e.size)<0.8&&x.operation!=='HIGHLIGHT';}))){
  const bx=box(b.framing!.points),lo=bld.position.map((v,i)=>v-bld.size[i]/2),hi=bld.position.map((v,i)=>v+bld.size[i]/2);
  assert.ok(!(inside(lo,bx)&&inside(hi,bx)),b.visualIntent);}
});
test('stated night: the light source fades before it leaves, and the plan stays valid',()=>{
 const {plan}=run(FX('explainer/energia-casa')),src=plan.world.entities.find(e=>e.assembly==='RADIANT_SOURCE')!;
 const b=plan.beats.find(b=>b.operations.some(o=>o.target===src.entityId&&o.operation==='HIDE'))!;assert.ok(b);
 const dim=b.operations.find(o=>o.target===src.entityId&&o.operation==='DECREASE'),hide=b.operations.find(o=>o.target===src.entityId&&o.operation==='HIDE')!;
 assert.equal(dim?.parameters.parameter,'activity');assert.ok(dim!.endOffset<=hide.startOffset);
});
