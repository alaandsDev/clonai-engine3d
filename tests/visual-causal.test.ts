import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {jsonHash} from '../src/editorial/fingerprint';
import {normalize} from '../src/semantics/normalize';
import {plannerInputFromCuriosity,planVisualCausal,validateVisualPlan,verifyVisualPlan,inventedFactualRelations,compileVisualPlan,visualQa,screenBox,meaningfulChanges,visualProvenance,verifyVisualProvenance,chooseTemplate,participantLabel,type CuriosityWriterLike,type VisualCausalPlan} from '../src/visual-causal';
import {environmentCapabilities,validateDemonstrationProgram} from '../src/engine3d/demonstration-runtime';
import {evaluateDirected,validateDirected,type DirectedSequence} from '../src/engine3d/directed';
import {ASSEMBLY_KINDS} from '../src/engine3d/demonstration-contracts';
import {environmentStyleOf} from '../src/engine3d/demonstration-geometry';
// Synthetic fixtures in the Phase26 Writer contract (fictitious systems; NOT real facts).
const writer=(topic:string,sentences:{id:string;kind:'FACT'|'EDITORIAL';text:string;relationIds:string[]}[],relations:{id:string;subject:string;predicate:string;object:string;sentenceIds:string[]}[]):[string,CuriosityWriterLike]=>{
 const script=sentences.map(s=>s.text).join('\n');
 const raw={status:'SCRIPT_GROUNDED',eligible:true,script,storyFingerprint:'story-'+jsonHash(script).slice(0,8),sentences:sentences.map(s=>({...s,roles:[]})),handoff:{scriptFingerprint:jsonHash(script),relations:relations.map(r=>({...r,visualHints:[],proof:[{evidenceId:'EV_'+r.id}],storyNodeIds:['SN_'+r.id]}))}};
 return[topic,{...raw,fingerprint:jsonHash(raw)}];
};
const TERRAIN=writer('Como funciona um coletor de teste?',[
 {id:'S1',kind:'EDITORIAL',text:'O que acontece por baixo da terra?',relationIds:[]},
 {id:'S2',kind:'FACT',text:'Um coletor de teste é um tipo de coletor tubular, cujas águas subterrâneas sobem para a superfície devido à diferença de nível entre as camadas.',relationIds:['R1','R2','R3']},
 {id:'S3',kind:'FACT',text:'No uso residencial, as águas seguem através de canos.',relationIds:['R4']}],
 [{id:'R1',subject:'coletor de teste',predicate:'IS_A',object:'um tipo de coletor tubular',sentenceIds:['S2']},
  {id:'R2',subject:'águas subterrâneas',predicate:'FLOW',object:'para a superfície',sentenceIds:['S2']},
  {id:'R3',subject:'águas subterrâneas sobem para a superfície',predicate:'CAUSED_BY',object:'diferença de nível entre as camadas',sentenceIds:['S2']},
  {id:'R4',subject:'as águas',predicate:'COLLECT',object:'através de canos',sentenceIds:['S3']}]);
const ENCLOSURE=writer('Como funciona um transportador de teste?',[
 {id:'S1',kind:'EDITORIAL',text:'O que se move lá dentro?',relationIds:[]},
 {id:'S2',kind:'FACT',text:'Bandeja de teste — peça principal do conjunto.',relationIds:['Q1']},
 {id:'S3',kind:'FACT',text:'A plataforma se move dentro da coluna de teste, subindo ou descendo.',relationIds:['Q2']},
 {id:'S4',kind:'FACT',text:'A bandeja serve para apoiar a carga durante o percurso.',relationIds:['Q3']}],
 [{id:'Q1',subject:'Bandeja de teste',predicate:'IS_A',object:'peça principal do conjunto',sentenceIds:['S2']},
  {id:'Q2',subject:'a plataforma',predicate:'MOVE_WITHIN',object:'coluna de teste',sentenceIds:['S3']},
  {id:'Q3',subject:'a bandeja',predicate:'USED_FOR',object:'apoiar a carga durante o percurso',sentenceIds:['S4']}]);
const timing=(w:CuriosityWriterLike,each=150)=>w.sentences.map((s,i)=>({sentenceId:s.id,startFrame:i*each,endFrame:(i+1)*each}));
const build=([topic,w]:[string,CuriosityWriterLike],each=150)=>{const t=timing(w,each),input=plannerInputFromCuriosity(topic,w,t,30),plan=planVisualCausal(input),seq=compileVisualPlan(plan,{sentences:t.map(x=>({id:x.sentenceId,text:w.sentences.find(s=>s.id===x.sentenceId)!.text,startFrame:x.startFrame,endFrame:x.endFrame}))});return{input,plan,seq,ids:input.relations.map(r=>r.id)};};
const resign=(p:VisualCausalPlan)=>{const{fingerprint:_,...raw}=p;return{...raw,fingerprint:jsonHash(raw)} as VisualCausalPlan;};
const T=build(TERRAIN),E=build(ENCLOSURE);

test('visual-causal persistent world: deterministic, one worldId for every entity, editorial staging marked', ()=>{
 const again=build(TERRAIN);assert.equal(again.plan.fingerprint,T.plan.fingerprint);assert.equal(jsonHash(again.seq),jsonHash(T.seq));
 assert(T.plan.world.entities.every(e=>e.worldId===T.plan.worldId));
 assert.equal(T.plan.world.template,'TERRAIN_SUBSURFACE');assert.equal(T.plan.world.environmentId,'ENV_FOREST_001');
 for(const e of T.plan.world.entities)if(e.grounding==='EDITORIAL')assert(e.relationIds.length===0&&e.abstraction!=='ABSTRACT_SYSTEM_REPRESENTATION');
 assert(T.plan.world.entities.filter(e=>e.grounding==='FACTUAL').every(e=>e.abstraction==='ABSTRACT_SYSTEM_REPRESENTATION'&&e.relationIds.length));
});
test('visual-causal valid plans: factual/editorial separation, zero invented relations, sequence validates', ()=>{
 for(const x of [T,E]){assert.deepEqual(validateVisualPlan(x.plan,x.ids),{valid:true,issues:[]});assert.equal(inventedFactualRelations(x.plan,x.ids),0);validateDirected(x.seq);
  for(const b of x.plan.beats){if(b.grounding==='FACTUAL_DEMONSTRATION')assert(b.relationIds.length&&b.proof);else assert(!b.proof&&!b.relationIds.length);}}
});
test('visual-causal affordance mapping: FLOW→directional movement, MOVE_WITHIN→MOVE, purpose→NONE gap, IS_A→SYMBOLIC', ()=>{
 const by=(p:VisualCausalPlan,rid:string)=>p.beats.filter(b=>b.relationIds.includes(rid));
 assert(by(T.plan,'R2').some(b=>b.visualIntent==='DIRECTIONAL_MOVEMENT'&&b.operations.some(o=>o.operation==='FLOW')&&b.proof?.level==='DIRECT'));
 assert(by(T.plan,'R1').every(b=>b.proof?.level==='SYMBOLIC'));assert(by(T.plan,'R3').every(b=>b.proof?.level==='SYMBOLIC'&&b.label==='diferença de nível'));
 assert(by(T.plan,'R4').some(b=>b.proof?.level==='PARTIAL'&&b.operations.some(o=>o.operation==='CONNECT')));
 assert(by(E.plan,'Q2').some(b=>b.operations.some(o=>o.operation==='MOVE')&&b.proof?.level==='DIRECT'));
 assert(by(E.plan,'Q3').every(b=>b.proof?.level==='NONE'));assert(E.plan.gaps.some(g=>g.relationId==='Q3'&&g.predicate==='USED_FOR'));
});
test('visual-causal no problem/solution fabrication: no failure or solution beat without such relations', ()=>{
 for(const x of [T,E])assert(!x.plan.beats.some(b=>/FAILURE|SOLUTION|PROBLEM/.test(b.visualIntent)));
});
test('visual-causal state transitions: versioned, monotone, regression refused', ()=>{
 const versions=new Map<string,number>();for(const t of T.plan.transitions){const k=t.entityId;assert(t.stateVersion>(versions.get(k)??0));versions.set(k,t.stateVersion);}
 const bad=structuredClone(T.plan);const t=bad.transitions.find(t=>t.operation==='FLOW')!;bad.transitions.push({...t,id:'X',from:1,to:0,stateVersion:99});
 assert(validateVisualPlan(bad,T.ids).issues.some(i=>i.startsWith('STATE_REGRESSION')));
 const ungrounded=structuredClone(T.plan);ungrounded.transitions[0]={...ungrounded.transitions[0],grounding:'GROUNDED',evidenceRelationId:null};
 assert(validateVisualPlan(ungrounded,T.ids).issues.some(i=>i.startsWith('GROUNDED_TRANSITION_WITHOUT_RELATION')));
});
test('visual-causal cutaway is generic and non-destructive (ground trench and housing section)', ()=>{
 const steps=T.seq.demonstration!.steps;assert(steps.some(s=>s.target==='ENVIRONMENT'&&s.operation==='INCREASE'&&s.parameters.parameter==='groundCutaway'));
 assert(E.seq.demonstration!.steps.some(s=>s.operation==='HIDE'&&s.target==='housing_cover'));
 const ids=T.plan.world.entities.map(e=>e.entityId);for(const f of [0,T.seq.totalFrames])assert.deepEqual(Object.keys(evaluateDirected(T.seq,f).state.demonstration!.subjects).sort(),[...ids].sort());
 assert(T.plan.world.cutaway.revealsEntityIds.every(id=>T.plan.world.entities.some(e=>e.entityId===id)));
 assert.equal(T.plan.world.entities.find(e=>e.entityId==='housing_cover'),undefined);assert.equal(E.plan.world.entities.find(e=>e.entityId==='housing_cover')!.grounding,'EDITORIAL');
});
test('visual-causal ground/subsurface capability: declared terrain environments only', ()=>{
 for(const id of ['ENV_LAB_001','ENV_FOREST_001','ENV_CITY_001'])assert(environmentCapabilities(id).includes('groundCutaway'),id);
 for(const id of ['ENV_SPACE_001','ENV_OCEAN_001','ENV_WINTER_001','ENV_SHELTER_001'])assert(!environmentCapabilities(id).includes('groundCutaway'),id);
 const s=structuredClone(T.seq);s.baseShot.environment.resourceId='ENV_SPACE_001';assert.throws(()=>validateDemonstrationProgram(s.demonstration!,s.baseShot,s.totalFrames),/groundCutaway|UNSUPPORTED/);
});
test('visual-causal presenter: one persistent reused character, editorial only, visible in ≥2 moments', ()=>{
 assert.equal(T.seq.baseShot.characters.length,1);assert.equal(T.seq.baseShot.characters[0].resourceId,'CHAR_CAIO_001');
 assert(T.seq.actionSegments.every(a=>/editorial; not visual proof/.test(a.purpose)));
 assert(T.plan.beats.filter(b=>b.presenterVisible).length>=2);
 const q=visualQa(T.plan,T.seq);assert.equal(q.dims.PRESENTER_CONTINUITY,'PASS');
 const swapped=structuredClone(T.seq);swapped.baseShot.characters[0].resourceId='CHAR_LIA_001';assert(visualQa(T.plan,swapped).continuityIssues.includes('PRESENTER_IDENTITY'));
});
test('visual-causal camera zones and motivation; camera cannot claim proof', ()=>{
 assert(T.seq.cameraSegments.every(c=>/^(?:WORLD|SYSTEM|CUTAWAY|COMPONENT|ACTION|RESULT)\b/.test(c.purpose)));
 assert.deepEqual(new Set(T.plan.beats.map(b=>b.cameraZone)),new Set(['WORLD','SYSTEM','CUTAWAY','COMPONENT','ACTION','RESULT']));
 const u=structuredClone(T.seq);u.cameraSegments[0].purpose='random';assert.equal(visualQa(T.plan,u).dims.CAMERA_MOTIVATION,'FAIL');
 const p=structuredClone(T.plan);const b=p.beats.find(b=>b.relationIds.includes('R1'))!;b.proof={level:'DIRECT',rationale:'camera push'};
 assert(validateVisualPlan(p,T.ids).issues.some(i=>i.startsWith('PROOF_WITHOUT_FACTUAL_ACTION')));
});
test('visual-causal adversarial: invented relation, fake component, editorial prop as fact, world identity, editorial proof', ()=>{
 const inv=structuredClone(T.plan);inv.beats.find(b=>b.grounding==='FACTUAL_DEMONSTRATION')!.relationIds.push('INVENTED');assert(validateVisualPlan(inv,T.ids).issues.some(i=>i.startsWith('INVENTED_FACTUAL_RELATION')));assert.equal(inventedFactualRelations(inv,T.ids),1);
 const fake=structuredClone(T.plan);fake.world.entities.push({...fake.world.entities[1],entityId:'fake_component',relationIds:[],grounding:'FACTUAL'});assert(validateVisualPlan(fake,T.ids).issues.some(i=>i.startsWith('FACTUAL_ENTITY_WITHOUT_RELATION')));
 const prop=structuredClone(T.plan);const house=prop.world.entities.find(e=>e.role==='CONTEXT_PROP')!;house.relationIds=['R4'];assert(validateVisualPlan(prop,T.ids).issues.some(i=>i.startsWith('EDITORIAL_ENTITY_CLAIMS_RELATION')));
 const world=structuredClone(T.plan);world.world.entities[0].worldId='OTHER';assert(validateVisualPlan(world,T.ids).issues.some(i=>i.startsWith('WORLD_IDENTITY')));
 const ed=structuredClone(T.plan);ed.beats[0].proof={level:'SYMBOLIC',rationale:'pretty scenery'};assert(validateVisualPlan(ed,T.ids).issues.some(i=>i.startsWith('EDITORIAL_BEAT_CLAIMS_PROOF')));
 const ghost=structuredClone(T.plan);ghost.beats[3].operations.push({operation:'REVEAL',target:'ghost_part',parameters:{},startOffset:0,endOffset:1});assert(validateVisualPlan(ghost,T.ids).issues.some(i=>i.startsWith('UNKNOWN_TARGET')));
 assert.throws(()=>planVisualCausal({...T.input,sentences:[...T.input.sentences,{id:'S9',kind:'FACT',text:'x',relationIds:['NOPE'],roles:[]}]}),/unknown relation/);
});
test('visual-causal object persistence: a subject cannot disappear or teleport without an operation', ()=>{
 assert.deepEqual(visualQa(T.plan,T.seq).continuityIssues,[]);
 const s=structuredClone(T.seq) as DirectedSequence;s.demonstration!.steps=s.demonstration!.steps.filter(x=>!(x.operation==='REVEAL'&&x.target==='medium'));
 const hidden=structuredClone(s);hidden.demonstration!.initialState.subjects.system_head.visible=true;
 const t=structuredClone(T.seq);t.demonstration!.steps.push({startFrame:10,endFrame:20,operation:'HIDE',target:'system_head',parameters:{},easing:'LINEAR',purpose:'x'});const shown=visualQa(T.plan,t);assert.equal(shown.dims.OBJECT_PERSISTENCE,'PASS','explicit HIDE is allowed');
 const tele=structuredClone(T.seq);tele.demonstration!.initialState.subjects.system_head.position=[0,0.35,0];tele.demonstration!.steps.push({startFrame:40,endFrame:41,operation:'MOVE',target:'system_head',parameters:{from:[0,0.35,0],to:[3,0.35,0]},easing:'LINEAR',purpose:'jump'});
 assert(visualQa(T.plan,tele).continuityIssues.every(i=>!i.startsWith('TELEPORT')),'MOVE inside its own step is an explicit operation');
});
test('visual-causal screen occupancy and empty-frame metrics from projected bounds', ()=>{
 const cam={position:[0,1,6] as [number,number,number],target:[0,1,0] as [number,number,number]};
 const near=screenBox([[-0.5,0.5,0],[0.5,1.5,0],[-0.5,1.5,0],[0.5,0.5,0]],cam,480,854)!,far=screenBox([[-0.5,0.5,-20],[0.5,1.5,-20]],cam,480,854)!;
 assert(near.extent>far.extent);assert.equal(near.visibleFraction,1);
 const off=screenBox([[30,1,0],[31,2,0]],cam,480,854);assert(!off||off.visibleFraction===0);
 const q=visualQa(T.plan,T.seq);assert(q.beats.filter(b=>b.occupancyStatus!=='NOT_APPLICABLE').length>0);assert(q.beats.every(b=>typeof b.emptyTop30==='boolean'));
});
test('visual-causal meaningful change and stasis metric', ()=>{
 const q=visualQa(T.plan,T.seq),ev=meaningfulChanges(T.plan,T.seq);assert(ev.length>=T.plan.beats.length);
 assert(q.meaningfulBeats>=6);assert(q.longestMeaningfulStasisSeconds<=8);
 const slow=build(TERRAIN,600),sq=visualQa(slow.plan,slow.seq);assert(sq.longestMeaningfulStasisSeconds>q.longestMeaningfulStasisSeconds);
});
test('visual-causal secondary domain: different template, cutaway and operation without topic code', ()=>{
 assert.equal(chooseTemplate(E.input),'ENCLOSURE');assert.equal(E.plan.world.cutaway.kind,'HOUSING_SECTION');assert.equal(chooseTemplate(T.input),'TERRAIN_SUBSURFACE');
 const q=visualQa(E.plan,E.seq);assert.equal(q.dims.OBJECT_PERSISTENCE,'PASS');assert.equal(q.dims.STATE_CONTINUITY,'PASS');
 const comp=E.plan.beats.find(b=>b.relationIds.includes('Q1'))!;assert.equal(comp.label,'Bandeja de teste');
 assert.equal(participantLabel('diferença de pressão entre a zona X e a zona Y'),'diferença de pressão');
});
test('visual-causal replay and tamper: rebuild equality, re-signed tampering fails', ()=>{
 assert.deepEqual(verifyVisualPlan(T.plan,T.input),{valid:true,issues:[]});
 const t=structuredClone(T.plan);t.beats[5].proof={level:'DIRECT',rationale:'x'};assert(verifyVisualPlan(t,T.input).issues.includes('FINGERPRINT_MISMATCH'));
 assert(!verifyVisualPlan(resign(t),T.input).valid);
 const w=structuredClone(TERRAIN[1]);w.script+='!';assert.throws(()=>plannerInputFromCuriosity(TERRAIN[0],w,timing(w),30),/fingerprint/);
});
test('visual-causal provenance: 100% factual beats with relation+evidence IDs; editorial classified', ()=>{
 const p=visualProvenance(T.input,T.plan,T.seq,null);assert.equal(p.factualBeatProvenanceRate,1);assert(p.editorialClassified);assert(verifyVisualProvenance(p,T.input,T.plan,T.seq,null));
 assert(!verifyVisualProvenance(p,T.input,T.plan,T.seq,'deadbeef'));
});
test('visual-causal anti-hardcode: runtime has no benchmark topic nouns or coordinates keyed to a topic', ()=>{
 const banned=['poco','artesian','turbina','turbine','elevador','elevator','cabine','contrapeso','geladeira','bomba d','motor a jato','hidreletric','tratamento de agua'];
 for(const f of readdirSync('src/visual-causal')){const t=normalize(readFileSync('src/visual-causal/'+f,'utf8'));for(const b of banned)assert(!t.includes(b),f+' contains '+b);}
});
test('visual-causal legacy compatibility: existing directed example and lab cutaway still validate', ()=>{
 const door=JSON.parse(readFileSync('examples/directed-door.json','utf8'));validateDirected(door);
 assert(environmentCapabilities('ENV_LAB_001').includes('groundCutaway'));
});
// ---- Phase27B: stylized assemblies, presenter arc, gesture-led camera (capabilities, not aesthetics).
test('phase27b assemblies: generic vocabulary, kind compatibility enforced, mesh budget accounted', ()=>{
 for(const e of T.plan.world.entities.filter(x=>x.assembly))assert.equal(ASSEMBLY_KINDS[e.assembly!],e.kind,e.entityId);
 assert.deepEqual(T.plan.world.entities.map(e=>e.assembly).filter(Boolean).sort(),['GABLED_BUILDING','LIQUID_VOLUME','OPEN_BASIN','PIPE','PIPE','TERRAIN_SECTION']);
 assert.deepEqual([...new Set(E.plan.world.entities.map(e=>e.assembly).filter(Boolean))].sort(),['CARRIAGE','DISPLAY_BLOCK','FRAME_PANEL','PANEL']);
 for(const a of Object.keys(ASSEMBLY_KINDS))assert(/^[A-Z_]+$/.test(a)&&!/WELL|POCO|ELEVATOR|ARTESIAN/.test(a),a);
 const bad=structuredClone(T.seq);bad.demonstration!.subjects.find(s=>s.assembly==='PIPE')!.kind='BOX';assert.throws(()=>validateDemonstrationProgram(bad.demonstration!,bad.baseShot,bad.totalFrames),/assembly PIPE requires PATH/);
 const unknown=structuredClone(T.seq);(unknown.demonstration!.subjects[0] as {assembly?:string}).assembly='WELL_HEAD';assert.throws(()=>validateDemonstrationProgram(unknown.demonstration!,unknown.baseShot,unknown.totalFrames));
 validateDemonstrationProgram(T.seq.demonstration!,T.seq.baseShot,T.seq.totalFrames);
});
test('phase27b stylized environment: only for programs with assemblies; opening follows the terrain section', ()=>{
 const st=evaluateDirected(T.seq,0).state.demonstration!,style=environmentStyleOf(T.seq.demonstration,st)!;
 const terrain=T.plan.world.entities.find(e=>e.assembly==='TERRAIN_SECTION')!;
 assert.deepEqual(style.hole,{x:[terrain.position[0]-terrain.size[0]/2,terrain.position[0]+terrain.size[0]/2],z:[terrain.position[2]-terrain.size[2]/2,terrain.position[2]+terrain.size[2]/2]});
 const legacy=structuredClone(T.seq.demonstration!);for(const s of legacy.subjects)delete s.assembly;assert.equal(environmentStyleOf(legacy,st),undefined);
 const open=T.seq.demonstration!.steps.find(s=>s.parameters.parameter==='groundCutaway'&&s.operation==='INCREASE')!;
 assert.equal(environmentStyleOf(T.seq.demonstration,evaluateDirected(T.seq,open.endFrame).state.demonstration!)!.cut,1);
});
test('phase27b presenter arc: real look/point targets, gesture before the reveal, reaction at payoff', ()=>{
 const acts=T.seq.actionSegments,center=(id:string)=>{const e=T.plan.world.entities.find(x=>x.entityId===id)!;return e.path?e.path.reduce<number[]>((a,p)=>a.map((v,i)=>v+p[i]/e.path!.length),[0,0,0]):e.position;};
 const targets=new Set(T.plan.world.entities.map(e=>JSON.stringify(center(e.entityId))));
 const reveal=T.plan.beats.find(b=>b.visualIntent==='CUTAWAY_REVEAL')!,path=T.plan.world.entities.find(e=>e.entityId===reveal.focusEntityId)!.path!;
 for(const a of acts.filter(a=>a.targetPosition&&!/REVEAL_SYSTEM/.test(a.purpose)))assert(targets.has(JSON.stringify(a.targetPosition)),a.purpose);
 const point=acts.find(a=>/REVEAL_SYSTEM/.test(a.purpose))!;assert.equal(point.resourceId,'ACTION_POINT_001');assert.deepEqual(point.targetPosition,[...path].sort((x,y)=>y[1]-x[1])[0]);
 assert(acts.some(a=>a.resourceId==='ACTION_LOOK_001'&&a.startFrame<T.plan.beats[1].startFrame),'observe during entry');
 const last=T.plan.beats.at(-1)!;assert(acts.some(a=>a.resourceId==='ACTION_WAVE_001'&&a.startFrame>=last.startFrame));
 assert(T.seq.blocking.some(b=>b.movementType==='TURN'&&b.intent==='REACT'&&b.startFrame>=last.startFrame));
 assert(reveal.presenterVisible&&reveal.presenterIntent==='REVEAL_SYSTEM');
});
test('phase27b camera follows gesture: the reveal move starts after the point starts and is not a cut', ()=>{
 const T=build(TERRAIN,300);// a reveal long enough for a gesture-led move (short beats fall back to a motivated cut)
 const reveal=T.plan.beats.find(b=>b.visualIntent==='CUTAWAY_REVEAL')!,point=T.seq.actionSegments.find(a=>/REVEAL_SYSTEM/.test(a.purpose))!;
 const move=T.seq.cameraSegments.find(c=>c.startFrame>=reveal.startFrame&&c.startFrame<reveal.endFrame&&/CUTAWAY/.test(c.purpose))!;
 assert(move.startFrame>point.startFrame&&move.startFrame<point.endFrame);
 assert.equal(T.seq.shots.find(s=>s.startFrame===reveal.startFrame)!.transition,'CONTINUE');
 assert.equal(visualQa(T.plan,T.seq).dims.CAMERA_MOTIVATION,'PASS');
});
test('phase27b no-label review artifact: stripping labels/captions changes nothing else', ()=>{
 const strip=(s:DirectedSequence)=>{const c=structuredClone(s);c.captions=[];for(const x of c.shots)delete (x as {onScreenText?:string}).onScreenText;return c;};
 const a=strip(T.seq);assert(a.shots.every(s=>!('onScreenText' in s)));validateDirected(a);
 assert.deepEqual(evaluateDirected(a,200).state,evaluateDirected(T.seq,200).state);
});
test('phase27b layer focus: extended regions are framed by the zone, not reframed as objects', ()=>{
 const comp=T.plan.beats.filter(b=>b.cameraZone==='COMPONENT'&&T.plan.world.entities.find(e=>e.entityId===b.focusEntityId)?.kind==='LAYER');assert(comp.length>0);
 for(const b of comp){const cam=evaluateDirected(T.seq,b.startFrame+Math.min(45,b.endFrame-b.startFrame-1)).state.camera;assert.deepEqual(cam.target,T.plan.world.cameraZones.COMPONENT.target);}
});
