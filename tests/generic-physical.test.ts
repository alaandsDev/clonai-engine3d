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
import {demonstrationQa} from '../src/visual-causal/demonstration-qa';
import type {MechRelation} from '../src/script-mode/mechanism';
/** Phase29 generic physical relations (containment class): parser constructions, functional roles, nested containers,
 * rotation with content, crossing a boundary, actuator + route, context ladder and demonstration QA.
 * Synthetic domains only (none of the zero-shot benchmark's sentences or nouns). */
const mech=(t:string)=>(understandScript(ingestScript(t)).mechanism??[]) as MechRelation[];
const one=(t:string,lemma:string)=>mech(t).find(m=>m.lemma===lemma);
function run(t:string){
 const u=understandScript(ingestScript(t));let at=0;
 const timing=u.segments.map(s=>{const len=Math.round(s.span.text.split(/\s+/).length/2.7*30)+8;const w={sentenceId:s.id,startFrame:at,endFrame:at+len};at+=len;return w;});
 const input=plannerInputFromScript(u,timing,30),plan=planVisualCausal(input);
 assert.deepEqual(validateVisualPlan(plan,input.relations.map(r=>r.id)).issues,[]);
 const sentences=timing.map(x=>({id:x.sentenceId,text:u.segments.find(s=>s.id===x.sentenceId)!.span.text,startFrame:x.startFrame,endFrame:x.endFrame}));
 const seq=compileVisualPlan(plan,{sentences});return{u,plan,seq,sentences,qa:visualQa(plan,seq)};
}
const FX=(n:string)=>readFileSync('tests/fixtures/containment/'+n+'.txt','utf8');
// ---------------- parser constructions ----------------
test('ROTATE: aspect ("começa a girar"), trend ("cada vez mais"), time prefix ("Durante X,") never the subject, manner never an object',()=>{
 const a=one('O disco começa a girar cada vez mais rápido.','ROTATE')!;assert.equal(a.subject?.head,'disco');assert.ok(a.qualifiers.includes('ASPECT:START')&&a.qualifiers.includes('INCREASING'));
 const b=one('Durante a moagem, o rotor gira em alta velocidade.','ROTATE')!;assert.equal(b.subject?.head,'rotor');assert.equal(b.object,undefined);
 const c=one('O barril gira sem parar.','ROTATE')!;assert.equal(c.object,undefined);
});
test('PRESS_AGAINST keeps the surface and its stated owner; PASS_THROUGH keeps the openings and their boundary',()=>{
 const p=one('As bolinhas ficam pressionadas contra a parede do cilindro.','PRESS_AGAINST')!;assert.equal(p.type,'CONTACT');assert.equal(p.subject?.head,'bolinhas');assert.equal(p.destination?.head,'parede');assert.equal(p.propertyOwner?.head,'cilindro');
 const x=one('O óleo atravessa as pequenas perfurações do cilindro.','PASS')!;assert.equal(x.object?.head,'perfuracoes');assert.equal(x.propertyOwner?.head,'cilindro');
 const s=one('A água suja atravessa a malha do cilindro.','PASS')!;assert.equal(s.object?.head,'malha');assert.equal(s.destination,undefined,'"a" after "atravessa" is an article, not "to"');
 const r=one('O óleo passa para a parte externa do cilindro.','PASS')!;assert.equal(r.destination?.region,'OUTSIDE');assert.equal(r.destination?.head,'cilindro');
});
test('ACCUMULATE + SURROUND with a local pronoun; CONTAIN ("está dentro de", "fica no"); nothing invented',()=>{
 const m=mech('O óleo sai do cilindro e se acumula no tanque que fica em volta dele.');
 assert.equal(m.find(x=>x.lemma==='ACCUMULATE')?.destination?.head,'tanque');const s=m.find(x=>x.lemma==='SURROUND')!;assert.equal(s.subject?.head,'tanque');assert.equal(s.object?.head,'cilindro');
 const c=one('A areia ainda está dentro do silo.','CONTAIN')!;assert.equal(c.subject?.head,'areia');assert.equal(c.destination?.head,'silo');
 const d=one('As pedras ficam no barril.','CONTAIN')!;assert.equal(d.destination?.head,'barril');
 assert.equal(mech('O cilindro gira.').filter(x=>x.type==='CONTACT'||x.lemma==='PASS'||x.type==='CONTAIN').length,0);
});
test('PULL source from "X da Y"; SEND shares the coordinated material; passive drain; passive action without agent → nothing',()=>{
 const m=mech('Um motor puxa o óleo do tanque e envia pelo cano.');const p=m.find(x=>x.lemma==='PULL')!,s=m.find(x=>x.lemma==='SEND')!;
 assert.equal(p.source?.head,'tanque');assert.equal(s.quantity?.head,'oleo');assert.equal(s.path?.head,'cano');
 const d=one('O óleo é drenado para fora.','DRAIN')!;assert.equal(d.subject?.head,'oleo');assert.equal(d.destination?.region,'OUTSIDE');assert.ok(d.qualifiers.includes('PASSIVE'));
 assert.equal(mech('A tampa é empurrada.').filter(x=>x.type==='ACTION').length,0,'no agent stated → no action invented');
});
test('LEAVE from a source, causative "deixa X alinhado" is not a movement, partitive loss, simultaneity is asserted',()=>{
 assert.equal(one('A água deixa as folhas.','LEAVE')?.source?.head,'folhas');
 assert.equal(mech('O ajuste deixa a peça alinhada.').filter(x=>x.type==='MOVE').length,0);
 const l=one('As folhas perderam boa parte da água.','RELEASE')!;assert.equal(l.quantity?.head,'agua');assert.ok(l.qualifiers.includes('PARTIAL'));
 const w=mech('Enquanto o disco gira, a água escorre.');assert.ok(w.length>=2);assert.ok(w.every(x=>x.modality==='ASSERTED'));
});
test('pronoun number agreement, negation and modality kept, a noun that looks like a verb stays a noun',()=>{
 const m=mech('As pedras ficam no tanque enquanto a água atravessa a tela do tanque. Ela passa para a parte externa do tanque.');
 assert.equal(m.find(x=>x.sentenceId==='SEG_02')?.subject?.head,'agua');
 assert.equal(one('O cilindro não gira.','ROTATE')?.negated,true);assert.equal(one('O cilindro pode girar.','ROTATE')?.modality,'POSSIBLE');
 assert.equal(one('A roda gira.','ROTATE')?.subject?.head,'roda');
});
test('entities: manner phrases, deictics and verbs are never objects; "parte externa do X" is X; the opening question names the system',()=>{
 const u=understandScript(ingestScript('Como uma prensa separa o suco das frutas? O rotor gira em alta velocidade. Então como ela sai dali? A fruta entra na prensa. A fruta fica na parte externa do cesto. A fruta cai.'));
 assert.ok(!u.entities.some(e=>e.heads.some(h=>/^(?:velocidade|alta|dali|como)$/.test(h))),u.entities.map(e=>e.label).join(','));
 assert.equal(u.entities.find(e=>e.id===u.mainSubjectId)?.heads[0],'prensa');
});
// ---------------- planning by function (synthetic domains) ----------------
test('A) perforated drum with small parts, rotating, liquid through the openings, collected around it, pumped out',()=>{
 const {plan,qa}=run(FX('a-centrifuga')),f=plan.physical!.features;
 for(const k of ['INNER_ROTATING_CONTAINER','PERFORATED_WALL','OUTER_CONTAINER','CONTENT','PUMP_LIKE'])assert.ok(f.includes(k),k+' in '+f.join(','));
 const content=plan.world.entities.find(e=>e.assembly==='CONTENT_ITEMS')!,drum=plan.world.entities.find(e=>e.assembly==='ROTATING_CONTAINER')!;
 assert.equal(content.parentId,drum.entityId,'stated contact: the content moves with the drum');assert.equal(qa.demonstrationQa.verdict,'PASS',JSON.stringify(qa.demonstrationQa.failed));
});
test('B) basket with openings inside an outer vessel: nested, never replaced; liquid crosses its wall; not rotating',()=>{
 const {plan,qa}=run(FX('b-cesto'));assert.ok(plan.world.entities.some(e=>e.assembly==='OUTER_CONTAINER'));const inner=plan.world.entities.find(e=>e.assembly==='ROTATING_CONTAINER')!;
 assert.equal(inner.variant,'PERFORATED');assert.ok(!plan.beats.some(b=>b.operations.some(o=>o.operation==='ROTATE'&&o.target===inner.entityId)),'no rotation stated → none shown');
 assert.ok(plan.beats.some(b=>b.visualIntent==='MATERIAL_PASSES_THROUGH_BOUNDARY'));assert.equal(qa.demonstrationQa.gates.NESTED_CONTAINER_CONTINUITY.status,'PASS');
});
test('C) rotary filter: crossing INTO the cylinder (stated direction), drawn openings, then pumped out — indoor by structure',()=>{
 const {plan,qa}=run(FX('c-filtro-rotativo')),drum=plan.world.entities.find(e=>e.assembly==='ROTATING_CONTAINER')!,r=drum.size[0]/2;
 const cross=plan.beats.filter(b=>b.visualIntent==='MATERIAL_PASSES_THROUGH_BOUNDARY').map(b=>plan.world.entities.find(e=>e.entityId===b.operations.find(o=>o.operation==='FLOW')!.target)!);assert.ok(cross.length>=1);
 const rad=(p:number[])=>Math.hypot(p[0]-drum.position[0],p[2]-drum.position[2]);for(const c of cross){assert.ok(rad(c.path![0])>r&&rad(c.path!.at(-1)!)<r,'outside → inside');}
 assert.equal(plan.context?.context,'NEUTRAL_INTERIOR');assert.equal(qa.demonstrationQa.verdict,'PASS',JSON.stringify(qa.demonstrationQa.failed));
});
test('D) container + actuator + tube: source → actuator → route stay connected',()=>{
 const {plan,qa}=run(FX('d-bomba-tubo'));assert.ok(plan.world.entities.some(e=>e.variant==='PUMP_LIKE'));assert.equal(qa.demonstrationQa.gates.SOURCE_ACTUATOR_DESTINATION_VISIBILITY.status,'PASS');assert.equal(qa.demonstrationQa.gates.MATERIAL_ROUTE_CONTINUITY.status,'PASS');
});
test('E) no openings stated: nothing perforated, no crossing invented',()=>{
 const {plan}=run(FX('e-sem-aberturas'));assert.ok(!plan.world.entities.some(e=>e.variant==='PERFORATED'));assert.ok(!plan.beats.some(b=>b.visualIntent==='MATERIAL_PASSES_THROUGH_BOUNDARY'));
});
test('F) a rotating container whose content behaviour is not stated: only the container turns',()=>{
 const {plan,qa}=run(FX('f-sem-comportamento')),c=plan.world.entities.find(e=>e.assembly==='CONTENT_ITEMS')!,drum=plan.world.entities.find(e=>e.assembly==='ROTATING_CONTAINER')!;
 assert.equal(c.parentId,undefined);assert.ok(!plan.beats.some(b=>b.operations.some(o=>o.target===c.entityId&&o.parameters.parameter==='activity')));
 assert.ok(plan.beats.some(b=>b.operations.some(o=>o.operation==='ROTATE'&&o.target===drum.entityId)));assert.equal(qa.demonstrationQa.gates.ROTATION_CONTENT_COHERENCE.status,'PASS');
});
test('G) household-type systems are staged indoors without a room type or benchmark words; an outdoor place stays outdoors',()=>{
 for(const n of ['g-domestico','g2-aquecedor']){const {plan}=run(FX(n));assert.notEqual(plan.context?.context,'OUTDOOR_GROUND',n);}
 assert.equal(run(FX('h-ao-ar-livre')).plan.context?.context,'OUTDOOR_GROUND');
});
// ---------------- demonstration QA catches the failure class ----------------
test('a perfect camera filming the wrong mechanism (generic blocks) fails demonstration QA',()=>{
 const {plan,sentences}=run(FX('a-centrifuga'));const bad=JSON.parse(JSON.stringify(plan)) as typeof plan;
 for(const e of bad.world.entities)if(['ROTATING_CONTAINER','OUTER_CONTAINER','CONTENT_ITEMS'].includes(e.assembly??'')||e.variant==='PUMP_LIKE'){e.assembly='MACHINE_UNIT';delete e.variant;delete e.parentId;}
 const q=demonstrationQa(bad,compileVisualPlan(bad,{sentences}));assert.equal(q.verdict,'FAIL');assert.equal(q.gates.MAIN_SYSTEM_RECOGNIZABILITY.status,'FAIL');
});
test('the old generic fallback is caught: a housed machine with moving parts on the default outdoor ground fails context coherence',()=>{
 assert.equal(run(FX('e-sem-aberturas')).qa.demonstrationQa.gates.CONTEXT_COHERENCE.status,'FAIL');
});
test('technical QA and demonstration QA stay separate',()=>{const {qa}=run(FX('a-centrifuga'));assert.ok('dims' in qa&&'demonstrationQa' in qa);assert.ok(!('MAIN_SYSTEM_RECOGNIZABILITY' in qa.dims));});
test('generic physical code has no benchmark or topic words',()=>{
 for(const f of ['src/visual-causal/containment.ts','src/visual-causal/demonstration-qa.ts','src/engine3d/containment-assemblies.tsx','src/script-mode/mechanism.ts','src/script-mode/understand.ts']){const c=readFileSync(f,'utf8').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  assert.ok(!/lavar|lavadora|lavagem|tambor|centrifug|roupa|cuba|furos?\b|bomba|mangueira|drenagem/.test(c),f);}
});
