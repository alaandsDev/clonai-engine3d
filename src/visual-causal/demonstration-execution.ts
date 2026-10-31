import type {Vec3} from '../engine3d/contracts';
import type {ScriptEntity,ScriptUnderstanding} from '../script-mode/contracts';
import type {CameraZone,VisualCausalPlan,WorldEntity} from './contracts';
import type {VisualDemonstrationIntent,DemonstrationStrategy} from './demonstrations';
/** Phase29 demonstration execution layer. The Director chooses WHAT must be seen (strategy); this layer turns it
 * into world structure and checks that the planner really executed it:
 *  - spatial relations stated in the script (inside / behind / under / above) drive the layout: a container with
 *    something inside becomes an ENCLOSURE that can open into a section (cutaway), parts behind it sit behind it;
 *  - a conduit the fluid circulates through becomes a closed circuit through the parts that act on that fluid;
 *  - a part the script switches on/off becomes a MACHINE_UNIT (running/stopped is visible);
 *  - a state change of the material inside an enclosed path gets a STATE_TINT volume (liquid→gas, cold→hot).
 * Nothing here adds facts: positions are staging, and only relations/actions the parser produced are used. */
const fold=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const r3=(v:Vec3):Vec3=>v.map(x=>+x.toFixed(3)) as Vec3;
export type SpatialRelation='INSIDE'|'BEHIND'|'BELOW'|'ABOVE';
export interface SpatialFact {child:string;relation:SpatialRelation;parent:string;segmentId:string;phrase:string}
const PHRASES:[RegExp,SpatialRelation][]=[[/(?<!\bpara )\bdentro d(?:o|a|os|as) ([a-z0-9]+)/,'INSIDE'],[/\batras d(?:o|a|os|as) ([a-z0-9]+)/,'BEHIND'],[/\b(?:embaixo|debaixo|abaixo) d(?:o|a|os|as) ([a-z0-9]+)/,'BELOW'],[/\b(?:em cima|acima) d(?:o|a|os|as) ([a-z0-9]+)/,'ABOVE']];
const PHYSICAL=new Set(['CONTAINER','CONDUIT','COMPONENT','BODY','SYSTEM','GATE','ROTATING','VANES','HEAT_SOURCE']);
/** Relations stated by a phrase in the script. When an entity's own name carries the phrase ("a grade atrás da X"), only that
 * entity is placed; otherwise the physical things named in the same sentence are. */
export function spatialRelations(u:ScriptUnderstanding):SpatialFact[]{
 const out:SpatialFact[]=[];
 for(const seg of u.segments){const t=fold(seg.span.text),named=u.entities.filter(e=>e.mentions.some(m=>u.claims.find(c=>c.id===m.claimId)?.segmentId===seg.id));
  for(const [re,relation] of PHRASES){const m=re.exec(t);if(!m)continue;const head=m[1].replace(/[^a-z0-9]/g,'');
   // A container named only in the phrase ("dentro da caixa") is still a stated thing: it is referenced by its word.
   const parent=u.entities.find(e=>e.heads.some(h=>fold(h)===head)||fold(e.label)===head)??{id:'PHRASE:'+head,label:head} as ScriptEntity;
   const own=u.entities.filter(e=>e!==parent&&fold(e.label).includes(fold(m[0])));
   const kids=own.length?own:named.filter(e=>e!==parent&&(PHYSICAL.has(e.role)||e.role==='FLUID')&&!fold(e.label).includes(head)).filter(e=>e.role!=='FLUID'||named.every(x=>x.role==='FLUID'||x===parent));
   for(const k of kids)if(!out.some(x=>x.child===k.id&&x.parent===parent.id))out.push({child:k.id,relation,parent:parent.id,segmentId:seg.id,phrase:m[0]});}}
 return out;
}
export interface MechanismLayout {enclosure:WorldEntity|null;relations:SpatialFact[];placed:{child:string;relation:SpatialRelation;parent:string}[];inside:string[];behind:string[];circuit:string|null;machines:string[];tints:string[];assemblyTargets:Record<string,Vec3>;persistAfterReveal:string[];derivedInitialStates:{entityId:string;parameter:string;value:number;reason:string}[]}
/** Layout pass (before beats are drafted). `entities` is mutated in place: one position/state per entity. */
export function layoutMechanism(u:ScriptUnderstanding,entities:WorldEntity[],demos:VisualDemonstrationIntent[],worldId:string,known:Set<string>):MechanismLayout{
 const relations=spatialRelations(u),of=(se:string)=>entities.find(e=>e.scriptEntityIds?.includes(se))??null;
 const L:MechanismLayout={enclosure:null,relations,placed:[],inside:[],behind:[],circuit:null,machines:[],tints:[],assemblyTargets:{},persistAfterReveal:[],derivedInitialStates:[]};
 // ---- Enclosure: the parent of an INSIDE relation ----
 const insideRel=relations.filter(r=>r.relation==='INSIDE'),parentSe=insideRel[0]?.parent;
 const solids=entities.filter(e=>e.kind!=='PATH'&&e.assembly!=='RAISED_GROUND');
 const minX=solids.length?Math.min(...solids.map(e=>e.position[0]-e.size[0]/2)):0;
 // Open containers (basins, vessels) already show their inside; only a closed housing becomes an enclosure.
 if(parentSe&&!['OPEN_BASIN','VESSEL'].includes(of(parentSe)?.assembly??'')){let enc=of(parentSe);const size:Vec3=[2.0,2.6,1.4];
  if(!enc){const se=u.entities.find(e=>e.id===parentSe),rel=se?se.claimIds.filter(c=>known.has(c)):[],label=se?.label??parentSe.replace(/^PHRASE:/,'');
   enc={entityId:'enclosure',worldId,role:'MAIN_SYSTEM',grounding:rel.length?'FACTUAL':'EDITORIAL',abstraction:rel.length?'ABSTRACT_SYSTEM_REPRESENTATION':'EDITORIAL_CONTEXT_FROM_SENTENCE',relationIds:rel,participant:label,label,scriptEntityIds:se?[se.id]:[],kind:'CYLINDER',assembly:'ENCLOSURE',size,position:[0,0,0],rotation:[0,0,0],color:'#e9eef2',initiallyVisible:true};entities.push(enc);}
  Object.assign(enc,{kind:'CYLINDER',assembly:'ENCLOSURE',size,rotation:[0,0,0],color:'#e9eef2',initiallyVisible:true,initial:{activity:0}});
  enc.position=r3([minX-size[0]/2-0.9,size[1]/2,0]);delete enc.parentId;L.enclosure=enc;
  // Structural identity (affordances the script names): a stated door gives the housing a hinged front; never a functional part.
  const words=(u.source.normalized.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z]+/g)??[]);
  if(words.some(w=>/^(?:porta|portas|door|doors)$/.test(w)))enc.variant='DOOR_FRONT';
  const [ex,ey,ez]=enc.position,[w,h,d]=size;
  // Inside: a path runs as a serpentine in the upper interior; other parts sit low inside.
  let slot=0;
  for(const r of insideRel.filter(r=>r.parent===parentSe)){const c=of(r.child);if(!c||c===enc)continue;L.inside.push(c.entityId);L.persistAfterReveal.push(c.entityId);
   if(c.kind==='PATH'){const x0=ex-w/2+0.3,x1=ex+w/2-0.3,y1=ey+h*0.36,y0=ey+h*0.14,z=ez;c.path=([[x0,y1,z],[x1,y1,z],[x1,(y0+y1)/2,z],[x0,(y0+y1)/2,z],[x0,y0,z],[x1,y0,z]] as Vec3[]).map(r3);c.initiallyVisible=true;}
   else{c.position=r3([ex+(slot%2?0.45:-0.45),ey-h*0.3,ez]);slot++;}}
  // Behind: just behind the back wall, at mid height.
  for(const r of relations.filter(r=>r.relation==='BEHIND'&&r.parent===parentSe)){const c=of(r.child);if(!c||c===enc||c.kind==='PATH')continue;L.behind.push(c.entityId);L.persistAfterReveal.push(c.entityId);
   // Behind and toward the side the camera works from, so a three-quarter view sees it without breaking the relation.
   // Flush against the back, upper part (attached to the parent's rear face).
   c.size=r3([w*0.8,h*0.55,0.08]);c.position=r3([ex,ey+h*0.18,ez-d/2-0.06]);c.assembly='PANEL';c.kind='BOX';}
 }
 // ---- Behind / below / above without an enclosure: placed relative to the parent's world object ----
 for(const r of relations.filter(r=>r.relation!=='INSIDE'&&!(L.enclosure&&r.parent===parentSe))){const c=of(r.child);let p=of(r.parent);
  // A reference object named only in the phrase ("atrás do painel") is drawn as a plain context object next to the child.
  if(!p&&c&&r.parent.startsWith('PHRASE:')){const label=r.parent.slice(7);p={entityId:'context_'+label,worldId,role:'CONTEXT_PROP',grounding:'EDITORIAL',abstraction:'EDITORIAL_CONTEXT_FROM_SENTENCE',relationIds:[],participant:label,label,scriptEntityIds:[],kind:'BOX',assembly:'DISPLAY_BLOCK',size:[1.2,1.0,0.3],position:r3([c.position[0],0.5,c.position[2]+0.5]),rotation:[0,0,0],color:'#c3ccd3',initiallyVisible:true};entities.push(p);}
  if(!c||!p||c===p||c.kind==='PATH'||p.kind==='PATH')continue;
  const [px,py,pz]=p.position,[pw,ph,pd]=p.size;c.position=r3(r.relation==='BEHIND'?[px,py,pz-pd/2-c.size[2]/2-0.2]:r.relation==='BELOW'?[px,Math.max(c.size[1]/2,py-ph/2-c.size[1]/2-0.1),pz]:[px,py+ph/2+c.size[1]/2+0.05,pz]);
  if(r.relation==='BEHIND')L.behind.push(c.entityId);L.persistAfterReveal.push(c.entityId);L.placed.push({child:c.entityId,relation:r.relation,parent:p.entityId});}
 // ---- Machines: parts the script switches on/off; their running state is visible ----
 for(const a of u.actions.filter(a=>(a.action==='ACTIVATE'||a.action==='DEACTIVATE')&&known.has(a.claimId))){const m=a.entityIds.map(of).find(e=>e&&e.kind!=='PATH'&&e!==L.enclosure);
  if(!m||m.assembly==='FLAME'||m.assembly==='VESSEL'||L.machines.includes(m.entityId))continue;
  const firstOff=u.actions.find(x=>(x.action==='ACTIVATE'||x.action==='DEACTIVATE')&&x.entityIds.some(id=>m.scriptEntityIds?.includes(id)))!.action==='DEACTIVATE';
  Object.assign(m,{kind:'CYLINDER',assembly:'MACHINE_UNIT',size:[0.8,0.7,0.6],color:'#9fb0bb',initial:{activity:firstOff?1:0}});L.machines.push(m.entityId);L.persistAfterReveal.push(m.entityId);
  if(firstOff)L.derivedInitialStates.push({entityId:m.entityId,parameter:'activity',value:1,reason:'Switched off by the script: it must be running before (derived from the stated action)'});}
 // A part that acts on the circulating material sits on the circuit (outside, beside the enclosure) and is assembled when first named.
 const fluids=u.entities.filter(e=>e.role==='FLUID');
 const onCircuit=entities.filter(e=>e.kind!=='PATH'&&e!==L.enclosure&&!L.inside.includes(e.entityId)&&!L.behind.includes(e.entityId)&&u.entities.some(se=>e.scriptEntityIds?.includes(se.id)&&fluids.some(f=>f.heads.some(h=>fold(se.label).includes(fold(h))))));
 // ---- Circuit: a conduit the material circulates through closes the loop inside → parts → behind → inside ----
 const circ=u.claims.find(c=>known.has(c.id)&&/\bcircul/.test(fold(c.trigger.text))),pipe=circ?entities.find(e=>e.kind==='PATH'&&u.entities.some(se=>e.scriptEntityIds?.includes(se.id)&&se.claimIds.includes(circ.id))):null;
 if(pipe&&L.enclosure){const enc=L.enclosure,[ex,ey,ez]=enc.position,[w,h,d]=enc.size,inner=entities.find(e=>e.kind==='PATH'&&L.inside.includes(e.entityId));
  const start=inner?.path?.at(-1)??[ex+w/2-0.3,ey,ez],end=inner?.path?.[0]??[ex-w/2+0.3,ey+h*0.36,ez];
  // Anchored to the parent: at its back, low, side by side (location unstated: staging inside the object's own frame).
  onCircuit.forEach((m,i)=>{const target=r3([ex+w*0.25-i*0.9,m.size[1]/2+0.02,ez-d/2-m.size[2]/2-0.08]);L.assemblyTargets[m.entityId]=target;m.position=r3([target[0],target[1]+1.2,target[2]]);m.initiallyVisible=false;L.persistAfterReveal.push(m.entityId);});
  const via=onCircuit.map(m=>L.assemblyTargets[m.entityId]),back=L.behind.map(id=>entities.find(e=>e.entityId===id)!.position);
  const pts:Vec3[]=[start,[ex+w/2+0.15,start[1],ez],...via.map(p=>[p[0],p[1]+0.45,p[2]] as Vec3),...back.map(p=>[ex+w/2-0.2,p[1]-h*0.25,p[2]] as Vec3),...back.map(p=>[ex-w/2+0.2,p[1]+h*0.25,p[2]] as Vec3),[ex-w/2-0.15,end[1],ez],end];
  pipe.path=pts.map(r3).filter((p,i,a)=>i===0||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1],p[2]-a[i-1][2])>0.05);pipe.initiallyVisible=true;L.circuit=pipe.entityId;L.persistAfterReveal.push(pipe.entityId);}
 // ---- Progressive assembly: a part first introduced by naming it joins the persistent subject (enters, then sits in place) ----
 for(const d of demos.filter(d=>d.strategy==='PROGRESSIVE_ASSEMBLY')){const se=d.actorEntityIds[0];const w=se?of(se):null;if(!w||w===L.enclosure||w.kind==='PATH'||w.entityId in L.assemblyTargets||w.role==='MAIN_SYSTEM'&&!L.enclosure)continue;
  const first=u.claims.filter(c=>w.scriptEntityIds?.some(id=>u.entities.find(e=>e.id===id)?.claimIds.includes(c.id))).map(c=>u.segments.findIndex(s=>s.id===c.segmentId)).sort((a,b)=>a-b)[0];
  if(u.segments[first]?.id!==d.segmentId)continue;L.assemblyTargets[w.entityId]=r3(w.position);w.position=r3([w.position[0],w.position[1]+1.2,w.position[2]]);w.initiallyVisible=false;L.persistAfterReveal.push(w.entityId);}
 // ---- State tint: the material inside an enclosed path changes state (only when such a change is demonstrated) ----
 const stateDemos=demos.filter(d=>d.strategy==='CUTAWAY_REVEAL'),innerPath=entities.find(e=>e.kind==='PATH'&&L.inside.includes(e.entityId))??entities.find(e=>L.inside.includes(e.entityId));
 if(stateDemos.length&&innerPath&&L.enclosure){// The volume covers the enclosed path (or the enclosed part) where the change happens.
  const p:Vec3[]=innerPath.path??[innerPath.position.map((v,i)=>v-innerPath.size[i]/2) as Vec3,innerPath.position.map((v,i)=>v+innerPath.size[i]/2) as Vec3],lo=[0,1,2].map(i=>Math.min(...p.map(q=>q[i]))),hi=[0,1,2].map(i=>Math.max(...p.map(q=>q[i])));
  const claims=[...new Set(stateDemos.flatMap(d=>d.claimIds))].sort();
  entities.push({entityId:'state_tint',worldId,role:'SYSTEM_COMPONENT',grounding:'FACTUAL',abstraction:'ABSTRACT_SYSTEM_REPRESENTATION',relationIds:claims,participant:null,label:null,scriptEntityIds:[],kind:'CYLINDER',assembly:'STATE_TINT',variant:'PHASE',size:r3([hi[0]-lo[0]+0.3,hi[1]-lo[1]+0.3,0.5]),position:r3([(lo[0]+hi[0])/2,(lo[1]+hi[1])/2,(lo[2]+hi[2])/2]),rotation:[0,0,0],color:'#7fb6ff',initiallyVisible:false,initial:{fillLevel:0,activity:0}});
  L.tints.push('state_tint');L.persistAfterReveal.push('state_tint');}
 return L;
}
// ---------------------------------------------------------------------------------------------------------------
export interface DemonstrationExecutionPlan {demonstrationId:string;strategy:DemonstrationStrategy;subject:string|null;components:string[];initialState:Record<string,Record<string,number>>;
 actions:{beatId:string;entityId:string;operation:string;parameter:string|null}[];stateChanges:{entityId:string;parameter:string;from:unknown;to:unknown}[];observableResult:string;cameraIntent:CameraZone[];
 supportLevel:VisualDemonstrationIntent['support'];sourceSentenceIds:string[];executable:boolean;executed:boolean;resultShown:boolean;reason:string}
const EXECUTABLE=(d:VisualDemonstrationIntent)=>d.support!=='UNSUPPORTED'&&d.strategy!=='NAMED_ONLY';
/** What each selected demonstration became in the plan (pure, on the final plan). */
export function demonstrationExecution(plan:VisualCausalPlan){
 const ent=new Map(plan.world.entities.map(e=>[e.entityId,e])),demos=plan.demonstrations??[];
 const execs:DemonstrationExecutionPlan[]=demos.map(d=>{
  const beats=plan.beats.filter(b=>b.relationIds.some(r=>d.claimIds.includes(r))||b.demonstrationId===d.id),ops=beats.flatMap(b=>b.operations.filter(o=>o.operation!=='HIGHLIGHT'&&o.target!=='ENVIRONMENT').map(o=>({b,o})));
  const acting=ops.filter(x=>ent.get(x.o.target)?.role!=='CONTEXT_PROP'||ent.get(x.o.target)?.parentId);
  const on=(pred:(e:WorldEntity|undefined,op:string,p:string|null)=>boolean)=>acting.filter(x=>pred(ent.get(x.o.target),x.o.operation,(x.o.parameters.parameter as string)??null));
  const targets=new Set(acting.map(x=>x.o.target));
  let executed=false,reason='';
  switch(d.strategy){
   case 'FLOW_DEMONSTRATION':case 'ACCUMULATION':case 'DEPLETION':executed=on((e,op,p)=>op==='FLOW'||p==='fillLevel'||e?.assembly==='STREAMLINES').length>0;reason='movement along a path or a level change';break;
   case 'CUTAWAY_REVEAL':executed=on((e,op)=>Boolean(e&&(e.assembly==='VESSEL'||e.assembly==='STATE_TINT'))&&op!=='REVEAL').length>0;reason='state shown inside an open section (vessel section or enclosure cutaway)';break;
   case 'STATE_CHANGE':executed=on((_,op)=>['INCREASE','DECREASE','ROTATE','MOVE'].includes(op)).length>0;reason='before → transition → after on the stated part';break;
   case 'COMPONENT_ACTION_RESULT':executed=acting.length>0;reason='the component acts';break;
   case 'CAUSE_EFFECT':executed=targets.size>=2;reason='cause and effect on two connected things';break;
   case 'PROGRESSIVE_ASSEMBLY':executed=on((e,op)=>(op==='REVEAL'||op==='MOVE')&&Boolean(e?.scriptEntityIds?.some(id=>d.actorEntityIds.includes(id)))).length>0;reason='the part joins the persistent subject';break;
   case 'EXPERIMENT_AB':executed=plan.beats.some(b=>b.demonstrationId===d.id&&/^A/.test(b.label??''))&&plan.beats.some(b=>b.demonstrationId===d.id&&/^B/.test(b.label??''));reason='conditions A and B with results';break;
   case 'MOTION_RESPONSE':case 'FOLLOW_ACTION':executed=acting.length>0;reason='the body moves';break;
   default:executed=false;reason='named only';}
  // A component action must end in something observable beyond the component itself.
  const resultShown=d.strategy==='COMPONENT_ACTION_RESULT'?targets.size>=2||plan.beats.some(b=>b.sentenceId===beats[0]?.sentenceId&&/RESULT/.test(b.visualIntent)):executed;
  return{demonstrationId:d.id,strategy:d.strategy,subject:d.subjectEntityId,components:[...targets],initialState:Object.fromEntries([...targets].map(t=>[t,{...(ent.get(t)?.initial??{})} as Record<string,number>])),
   actions:acting.map(x=>({beatId:x.b.id,entityId:x.o.target,operation:x.o.operation,parameter:(x.o.parameters.parameter as string)??null})),
   stateChanges:acting.filter(x=>'from' in x.o.parameters&&'to' in x.o.parameters&&!Array.isArray(x.o.parameters.to)).map(x=>({entityId:x.o.target,parameter:String(x.o.parameters.parameter??x.o.operation),from:x.o.parameters.from,to:x.o.parameters.to})),
   observableResult:d.observable,cameraIntent:[...new Set(beats.map(b=>b.cameraZone))],supportLevel:d.support,sourceSentenceIds:[d.segmentId],executable:EXECUTABLE(d),executed:EXECUTABLE(d)&&executed,resultShown,reason:EXECUTABLE(d)?(executed?'Executed: '+reason:'Selected but not executed: no '+reason+' in its beats'):d.reason};});
 const selected=execs.filter(e=>e.executable),done=selected.filter(e=>e.executed);
 const by=(s:DemonstrationStrategy[])=>({selected:selected.filter(e=>s.includes(e.strategy)).length,executed:done.filter(e=>s.includes(e.strategy)).length});
 // Factual beats whose only content is a highlight or a pause.
 const waitOnly=plan.beats.filter(b=>b.grounding==='FACTUAL_DEMONSTRATION'&&b.operations.every(o=>o.operation==='HIGHLIGHT'||o.operation==='REVEAL'||o.operation==='HIDE'||(o.observed&&o.operation!=='FLOW'))).length;
 return{executions:execs,selectedExecutable:selected.length,executed:done.length,demonstrationExecutionRate:selected.length?+(done.length/selected.length).toFixed(3):null,
  notExecuted:selected.filter(e=>!e.executed).map(e=>e.demonstrationId+':'+e.strategy),
  cutaways:by(['CUTAWAY_REVEAL']),flows:by(['FLOW_DEMONSTRATION','ACCUMULATION','DEPLETION']),stateChanges:by(['STATE_CHANGE']),causeEffects:by(['CAUSE_EFFECT']),componentActionResults:by(['COMPONENT_ACTION_RESULT']),progressiveAssemblies:by(['PROGRESSIVE_ASSEMBLY']),experiments:by(['EXPERIMENT_AB']),
  waitOnlyFactualBeats:waitOnly,spatialRelationViolations:spatialViolations(plan)};
}
/** INSIDE: the child (or every point of its path) is within the parent's box; BEHIND: the child is behind the parent's back face. */
export function spatialViolations(plan:VisualCausalPlan){
 const L=plan.layout;if(!L)return[];const ent=new Map(plan.world.entities.map(e=>[e.entityId,e])),enc=L.enclosure?ent.get(L.enclosure):null;
 const placed=(L.placed??[]).flatMap(p=>{const c=ent.get(p.child),q=ent.get(p.parent);if(!c||!q)return[];const ok=p.relation==='BEHIND'?c.position[2]+c.size[2]/2<=q.position[2]-q.size[2]/2+1e-6:p.relation==='BELOW'?c.position[1]<q.position[1]:c.position[1]>q.position[1];return ok?[]:[p.relation+':'+p.child];});
 if(!enc)return placed;
 const inBox=(p:Vec3)=>[0,1,2].every(i=>Math.abs(p[i]-enc.position[i])<=enc.size[i]/2+1e-6);
 const out:string[]=[];
 for(const id of L.inside){const e=ent.get(id);if(!e)continue;const pts=e.kind==='PATH'?e.path!:[e.position];if(!pts.every(inBox))out.push('INSIDE:'+id);}
 for(const id of L.behind.filter(id=>!(L.placed??[]).some(p=>p.child===id))){const e=ent.get(id);if(e&&!(e.position[2]+e.size[2]/2<=enc.position[2]-enc.size[2]/2+1e-6))out.push('BEHIND:'+id);}
 return[...out,...placed];
}
export type {ScriptEntity};
