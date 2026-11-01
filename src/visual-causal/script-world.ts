import {jsonHash} from '../editorial/fingerprint';
import type {Vec3} from '../engine3d/contracts';
import type {CameraState} from '../engine3d/directed';
import type {Assembly} from '../engine3d/demonstration-contracts';
import type {ClaimAction,ScriptEntity,ScriptUnderstanding} from '../script-mode/contracts';
import {NON_NOMINAL,VESSEL,LID,PEG,GAS,OBJECT_CONTEXT,PLACE_CONTEXT,OUTDOOR_PLACE,HYPOTHESIS_CUE,REWIND_CUE} from '../script-mode/lexicon';
import {DEMONSTRATION_LIMITS} from '../engine3d/demonstration-contracts';
import {VISUAL_CAUSAL_VERSION} from './contracts';
import {hasMotionSubject,planMotionWorld} from './motion-world';
import {selectDemonstrations} from './demonstrations';
import {layoutMechanism} from './demonstration-execution';
import {planMechanismCarriers} from './mechanism-bridge';
import {cameraSpaceOf,scaleOf,OCCUPANCY_THRESHOLDS} from './camera-space';
import {assignFunctionalForms,POWERED_FORMS} from './functional-form';
import {planContainment,type PhysicalCarrier} from './containment';
import {planEnergyFlow} from './energy-flow';
import type {BeatOperation,CameraZone,CausalVisualBeat,PersistentWorld,PlannerInput,VisualCausalPlan,VisualGap,VisualScope,VisualScopeEntry,VisualStateTransition,WorldEntity} from './contracts';
/** Phase29 Script Mode world: a generic MECHANISM_STAGE built from the script's entity inventory and
 * actions (what happens), then filmed (camera zones from the layout). Positions, colours, supports and
 * the presenter are editorial staging; only script-asserted claims drive factual operations. */
const id=(prefix:string,x:unknown)=>prefix+'_'+jsonHash(x).slice(0,12);
const add3=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const r3=(v:Vec3):Vec3=>v.map(x=>+x.toFixed(3)) as Vec3;
type Kind='container'|'machine'|'rotor'|'gate'|'body';
interface Station {kind:Kind;entity:ScriptEntity|null;aliases:ScriptEntity[];world:WorldEntity;inlet:Vec3;outlet:Vec3;top:Vec3}
/** Camera that frames a set of points from a viewing direction (44° vertical FOV, 9:16). */
export function frameCamera(points:Vec3[],dir:Vec3,margin=1.25,minDistance=3):CameraState{
 const lo=[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),hi=[0,1,2].map(i=>Math.max(...points.map(p=>p[i])));
 const c=lo.map((v,i)=>(v+hi[i])/2) as Vec3,n=Math.hypot(...dir),d=dir.map(v=>v/n) as Vec3;
 const halfW=Math.max(hi[0]-lo[0],(hi[2]-lo[2])*0.6)/2,halfH=(hi[1]-lo[1])/2;
 const dist=Math.max(minDistance,margin*Math.max(halfH/0.404,halfW/0.227));
 return{position:r3(add3(c,d.map(v=>v*dist) as Vec3)),target:r3(c)};
}
export function planScriptWorld(input:PlannerInput):VisualCausalPlan{
 const u=input.scriptUnderstanding as ScriptUnderstanding;
 if(!u)throw Error('SCRIPT_WORLD requires scriptUnderstanding');
 if(!input.sentences.length||!input.timing.length)throw Error('VISUAL_PLAN_INPUT sentences/timing required');
 const known=new Set(input.relations.map(r=>r.id));
 // A body that moves through a medium (any vehicle) gets the motion stage instead of the mechanism stage.
 if(hasMotionSubject(u,known))return planMotionWorld(input);
 for(const s of input.sentences)for(const rid of s.relationIds)if(!known.has(rid))throw Error('VISUAL_PLAN_INPUT sentence cites unknown relation '+rid);
 const worldId=id('WORLD',{script:input.scriptFingerprint,story:input.storyFingerprint});
 const asserted=(e:ScriptEntity)=>e.claimIds.filter(c=>known.has(c));
 // ---- World complexity management: visual necessity → persistence scope → simultaneous load ----
 // The budget applies to what is visible at the same time (DEMONSTRATION_LIMITS.subjects), not to how many
 // things the script mentions. Concepts get no object, apertures share their gate, one-segment objects are beat-local.
 const segOrder=new Map(u.segments.map((x,i)=>[x.id,i])),segsOf=(e:ScriptEntity)=>[...new Set(asserted(e).map(c=>u.claims.find(x=>x.id===c)!.segmentId))].sort((a,b)=>segOrder.get(a)!-segOrder.get(b)!);
 const scope=new Map<string,{scope:VisualScope;reason:string;host?:string}>();
 const hasVessel=u.entities.some(e=>e.role==='CONTAINER'&&e.heads.some(h=>VESSEL.test(h))&&asserted(e).length>0);
 for(const e of u.entities){
  const set=(sc:VisualScope,reason:string,host?:string)=>scope.set(e.id,{scope:sc,reason,...(host?{host}:{})});
  if(e.role==='FLUID'&&hasVessel&&e.heads.some(h=>GAS.test(h))&&asserted(e).length){set('PERSISTENT_WORLD','Gas next to a vessel: drawn as a steam plume');continue;}
  const vesselE=hasVessel?u.entities.find(x=>x.role==='CONTAINER'&&x.heads.some(h=>VESSEL.test(h))&&asserted(x).length>0):undefined;
  if(e.role==='FLUID'&&vesselE&&!e.heads.some(h=>GAS.test(h))&&asserted(e).length){set('CONTEXT_ONLY','Liquid drawn by the vessel that holds it',vesselE.id);continue;}
  if(e.role==='FLUID'){set('NON_VISUAL','Fluid: shown as flow/fill inside paths and containers, not as an object');continue;}
  if(e.role==='ABSTRACT'){set('NON_VISUAL','Concept (energy, force, speed): no physical object');continue;}
  // Time expressions, regions, properties, quantities and discourse words are not objects (they keep their meaning in relations).
  if(e.category&&['TIME','REGION','PROPERTY','QUANTITY','DISCOURSE','ABSTRACT_CONCEPT'].includes(e.category)){set('NON_VISUAL','Not a physical object ('+e.category.toLowerCase()+'): no geometry');continue;}
  if(e.role==='ACTOR'){set('NON_VISUAL','Person/agent/pronoun: embodied by the presenter, not a separate object');continue;}
  if(!asserted(e).length){set('NON_VISUAL','Only in questions or negated statements: not shown as a real thing');continue;}
  if(e.heads.every(h=>NON_NOMINAL.test(h))){set('NON_VISUAL','Closed-class word (quantifier/adverb/negation) in a noun slot: attribute, not an object');continue;}
  // An aperture that only opens/closes is drawn by the gate that closes it; what something becomes is drawn by that thing.
  const pred=(m:{claimId:string})=>u.claims.find(c=>c.id===m.claimId)!.predicate;
  const host=e.role!=='GATE'&&e.mentions.every(m=>['OPEN','CLOSE'].includes(pred(m)))?u.entities.find(g=>g.role==='GATE'&&e.mentions.some(m=>m.slot==='OBJECT'&&g.claimIds.includes(m.claimId))):undefined;
  if(host){set('CONTEXT_ONLY','Aperture opened/closed by a gate: represented by the gate assembly',host.id);continue;}
  const becomes=e.mentions.every(m=>m.slot==='OBJECT'&&pred(m)==='BECOME')?u.entities.find(x=>x.id!==e.id&&e.mentions.some(m=>x.mentions.some(y=>y.claimId===m.claimId&&y.slot==='SUBJECT'))):undefined;
  if(becomes){set('CONTEXT_ONLY','New name/state of an existing entity: drawn by that entity',becomes.id);continue;}
  const owner=e.mentions.every(m=>m.slot==='OBJECT'&&pred(m)==='HAS')?u.entities.find(x=>x.id!==e.id&&e.mentions.some(m=>x.mentions.some(y=>y.claimId===m.claimId&&y.slot==='SUBJECT'))):undefined;
  if(owner){set('CONTEXT_ONLY','Part of another object ("X tem um Y"): drawn by its owner',owner.id);continue;}
  const segs=segsOf(e);
  const routeLink=e.role==='CONDUIT'&&u.entities.some(x=>(x.role==='CONTAINER'&&asserted(x).length>0)||x.role==='VANES');
  const hosted=e.role==='ROTATING'&&u.entities.some(x=>x.role==='VANES');
  if(routeLink){set('PERSISTENT_WORLD','Route link between persistent stations');continue;}
  if(hosted){set('PERSISTENT_WORLD','Hosted inside the machine housing');continue;}
  if(e.id===u.mainSubjectId||segs.length>=2||e.role==='CONTAINER'||e.role==='VANES')set('PERSISTENT_WORLD',e.id===u.mainSubjectId?'Main subject':segs.length>=2?'Mentioned in '+segs.length+' segments':'Route station');
  else set('BEAT_LOCAL','Needed only in segment '+segs[0]);
 }
 const drawn=u.entities.filter(e=>['PERSISTENT_WORLD','BEAT_LOCAL'].includes(scope.get(e.id)!.scope));
 // Beat-local scoping is only used when the world would not fit: a small world keeps everything on stage.
 const estimate=drawn.filter(e=>e.role!=='VANES'||!drawn.some(x=>x.id===u.mainSubjectId)).length+drawn.filter(e=>e.role==='CONTAINER'&&e.level==='HIGH').length;
 if(estimate<=DEMONSTRATION_LIMITS.subjects)for(const e of drawn)if(scope.get(e.id)!.scope==='BEAT_LOCAL')scope.set(e.id,{scope:'PERSISTENT_WORLD',reason:'Fits the simultaneous visual budget ('+estimate+'/'+DEMONSTRATION_LIMITS.subjects+')'});
 const local=(e:ScriptEntity|null)=>Boolean(e&&scope.get(e.id)?.scope==='BEAT_LOCAL');
 const vanes=drawn.filter(e=>e.role==='VANES'),rotors=drawn.filter(e=>e.role==='ROTATING');
 const system=drawn.find(e=>e.id===u.mainSubjectId)??null;
 const hasFluid=u.entities.some(e=>e.role==='FLUID');
 // ---- Stations (non-conduit things) in route order ----
 const entities:WorldEntity[]=[],stations:Station[]=[];
 const machineHost=system&&!['CONTAINER','CONDUIT','GATE','ROTATING'].includes(system.role)&&(vanes.length||rotors.length)?system:vanes[0]??null;
 const containers=drawn.filter(e=>e.role==='CONTAINER');
 const isSource=(e:ScriptEntity)=>e.level==='HIGH'||e.mentions.some(m=>m.slot==='SOURCE');
 const isDest=(e:ScriptEntity)=>e.level==='LOW'||e.mentions.some(m=>m.slot==='DESTINATION');
 const before=containers.filter(e=>isSource(e)&&!(e.level==='LOW')),after=containers.filter(e=>!before.includes(e));
 // ---- Common-object composition: a vessel with what sits under it, on it and above it ----
 const vessel=drawn.find(e=>e.role==='CONTAINER'&&e.heads.some(h=>VESSEL.test(h)))??null;
 const stackLid=vessel?drawn.find(e=>e.role==='GATE'&&e.heads.some(h=>LID.test(h)))??null:null;
 const stackHeat=vessel?drawn.filter(e=>e.role==='HEAT_SOURCE'):[],stackPegs=vessel?drawn.filter(e=>e!==stackLid&&e!==vessel&&e.heads.some(h=>PEG.test(h))):[],stackGas=vessel?drawn.filter(e=>e.role==='FLUID'):[];
 const inStack=new Set([stackLid,...stackHeat,...stackPegs,...stackGas].filter((e):e is ScriptEntity=>Boolean(e)).map(e=>e.id));
 const order:{kind:Kind;entity:ScriptEntity|null;aliases:ScriptEntity[]}[]=[];
 for(const e of before)order.push({kind:'container',entity:e,aliases:[]});
 if(machineHost)order.push({kind:'machine',entity:machineHost,aliases:vanes.filter(v=>v!==machineHost)});
 const others=drawn.filter(e=>!containers.includes(e)&&e.role!=='CONDUIT'&&e!==machineHost&&!vanes.includes(e)&&!(machineHost&&rotors[0]===e)&&!local(e)&&!inStack.has(e.id)&&e.role!=='FLUID');
 const localBodies=drawn.filter(e=>!containers.includes(e)&&e.role!=='CONDUIT'&&e!==machineHost&&!vanes.includes(e)&&!(machineHost&&rotors[0]===e)&&local(e)&&!inStack.has(e.id)&&e.role!=='FLUID');
 // Drivers before what they drive (script order otherwise).
 for(const e of others)order.push({kind:e.role==='ROTATING'?'rotor':e.role==='GATE'?'gate':'body',entity:e,aliases:[]});
 for(const e of after)order.push({kind:'container',entity:e,aliases:[]});
 if(!order.length&&system)order.push({kind:'body',entity:system,aliases:[]});
 const n=order.length,elevated=before.some(e=>e.level==='HIGH'),span=n>3?4.6:n===3?(elevated?4.4:3.8):2.6;
 const xs=order.map((_,i)=>n===1?0:-span/2+i*span/(n-1));
 const wid=(prefix:string,e:ScriptEntity|null,i:number)=>prefix+'_'+(i+1);
 const factual=(es:(ScriptEntity|null)[]):Pick<WorldEntity,'grounding'|'abstraction'|'relationIds'|'participant'|'label'|'scriptEntityIds'>=>{const list=es.filter((e):e is ScriptEntity=>Boolean(e)),rel=[...new Set(list.flatMap(asserted))].sort();
  return rel.length?{grounding:'FACTUAL',abstraction:'ABSTRACT_SYSTEM_REPRESENTATION',relationIds:rel,participant:list[0].label,label:list[0].label,scriptEntityIds:list.map(e=>e.id)}:{grounding:'EDITORIAL',abstraction:'EDITORIAL_CONTEXT_FROM_SENTENCE',relationIds:[],participant:null,label:null,scriptEntityIds:list.map(e=>e.id)};};
 order.forEach((o,i)=>{
  const x=xs[i],z=i%2?-0.35:0;let w:WorldEntity,inlet:Vec3,outlet:Vec3,top:Vec3;
  if(o.kind==='container'&&o.entity===vessel){
   // A vessel: on its heat source if one exists, holding liquid (editorial initial level), section view.
   const ground=stackHeat.length?0.45:0,size:Vec3=[1.5,1.1,1.5],pos:Vec3=[x,ground+0.55,z];
   w={entityId:'vessel',worldId,role:'MAIN_SYSTEM',...factual([o.entity]),kind:'CYLINDER',assembly:'VESSEL',size,position:pos,rotation:[0,0,0],color:'#b8c2c9',initiallyVisible:true,initial:{fillLevel:0.55,activity:0}};
   inlet=[x-0.8,pos[1]+0.4,z];outlet=[x+0.8,pos[1]-0.3,z];top=[x,pos[1]+0.55,z];
  }else if(o.kind==='container'){
   const high=elevated&&o.entity!.level==='HIGH',ground=high?1.9:0,size:Vec3=[1.5,0.7,1.5],pos:Vec3=[x,ground+0.35,z-0.3];
   // Editorial terrain step under an elevated container; narrow enough for a conduit to run down its outside face.
   if(high)entities.push({entityId:'support_'+(i+1),worldId,role:'CONTEXT_PROP',grounding:'EDITORIAL',abstraction:'EDITORIAL_DECORATION',kind:'BOX',assembly:'RAISED_GROUND',relationIds:[],participant:null,label:null,size:[1.8,ground,1.6],position:[x,ground/2,z-0.3],rotation:[0,0,0],color:'#6d4a33',initiallyVisible:true});
   const source=before.includes(o.entity!);
   w={entityId:wid('container',o.entity,i),worldId,role:'MAIN_SYSTEM',...factual([o.entity]),kind:'CYLINDER',assembly:'OPEN_BASIN',size,position:pos,rotation:[0,0,0],color:'#3d5260',initiallyVisible:true,initial:{fillLevel:source?0.85:0.2}};
   w.role=o.entity===system?'MAIN_SYSTEM':'SYSTEM_COMPONENT';
   // Inlet on the rim facing the previous station (pouring in), outlet low on the wall facing the next one.
   const toNext=i<n-1?1:-1,fromPrev=i>0?-1:1;inlet=[x+fromPrev*0.62,pos[1]+0.42,pos[2]];outlet=[x+toNext*0.62,pos[1]-0.12,pos[2]];top=[x,pos[1]+0.45,pos[2]];
  }else if(o.kind==='machine'){
   const size:Vec3=[1.5,2.0,0.6],pos:Vec3=[x,1.0,z];
   w={entityId:'machine',worldId,role:'MAIN_SYSTEM',...factual([o.entity,...o.aliases]),kind:'CYLINDER',assembly:'VANE_RING',size,position:pos,rotation:[0,0,0],color:'#a3aeb6',initiallyVisible:true};
   const cy=pos[1]+size[1]/2-size[0]/2;inlet=[x-size[0]*0.47,cy+0.1,z];outlet=[x+size[0]*0.3,cy-size[0]*0.42,z];top=[x,cy,z];
  }else if(o.kind==='rotor'){
   const pos:Vec3=[x,0.75,z];
   w={entityId:'rotor_'+(i+1),worldId,role:'SYSTEM_COMPONENT',...factual([o.entity]),kind:'CYLINDER',assembly:'ROTOR',size:[1.1,1.1,0.3],position:pos,rotation:[0,0,0],color:'#e0a93f',initiallyVisible:true};
   inlet=[x-0.6,0.75,z];outlet=[x+0.6,0.75,z];top=pos;
  }else if(o.kind==='gate'){
   const pos:Vec3=[x,0.6,z];
   w={entityId:'gate_'+(i+1),worldId,role:'SYSTEM_COMPONENT',...factual([o.entity]),kind:'BOX',assembly:'PANEL',size:[1.0,1.2,0.14],position:pos,rotation:[0,0,0],color:'#a9bcc6',initiallyVisible:true};
   inlet=[x-0.55,0.4,z];outlet=[x+0.55,0.4,z];top=pos;
  }else{
   const pos:Vec3=[x,0.4,z];
   w={entityId:'body_'+(i+1),worldId,role:o.entity===system?'MAIN_SYSTEM':'SYSTEM_COMPONENT',...factual([o.entity]),kind:'BOX',assembly:'DISPLAY_BLOCK',size:[0.9,0.8,0.7],position:pos,rotation:[0,0,0],color:'#b9c7cf',initiallyVisible:true};
   inlet=[x-0.5,0.3,z];outlet=[x+0.5,0.3,z];top=pos;
  }
  entities.push(w);stations.push({kind:o.kind,entity:o.entity,aliases:o.aliases,world:w,inlet,outlet,top});
 });
 const vesselW=stations.find(s=>s.entity===vessel&&vessel)?.world;
 if(vesselW){const [vx,vy,vz]=vesselW.position,rim=vy+vesselW.size[1]/2;
  stackHeat.forEach((e,k)=>entities.push({entityId:'heat_'+(k+1),worldId,role:'SYSTEM_COMPONENT',...factual([e]),kind:'CYLINDER',assembly:'FLAME',size:[1.3,0.45,1.3],position:r3([vx+k*1.6,0.225,vz]),rotation:[0,0,0],color:'#3a3f44',initiallyVisible:true,initial:{activity:0}}));
  if(stackLid)entities.push({entityId:'lid',worldId,role:'SYSTEM_COMPONENT',...factual([stackLid]),kind:'CYLINDER',assembly:'LID',size:[1.56,0.18,1.56],position:r3([vx,rim+0.09,vz]),rotation:[0,0,0],color:'#c7d0d6',initiallyVisible:true});
  const lidTop=stackLid?rim+0.18:rim;
  stackPegs.forEach((e,k)=>entities.push({entityId:'peg_'+(k+1),worldId,role:e.id===u.mainSubjectId?'MAIN_SYSTEM':'SYSTEM_COMPONENT',...factual([e]),kind:'CYLINDER',assembly:'PEG',variant:u.actions.some(a=>a.action==='MOVE_VERTICAL'&&a.entityIds.includes(e.id))?'STEM':'CONTROL',size:[0.24,0.34,0.24],position:r3([vx+(k-(stackPegs.length-1)/2)*0.5,lidTop+0.17,vz]),rotation:[0,0,0],color:'#7d868d',initiallyVisible:true}));
  const vent=entities.find(e=>e.assembly==='PEG')?.position??[vx,lidTop,vz];
  stackGas.forEach((e,k)=>entities.push({entityId:'steam_'+(k+1),worldId,role:'SYSTEM_COMPONENT',...factual([e]),kind:'CYLINDER',assembly:'STEAM_PLUME',size:[0.7,1.8,0.7],position:r3([vent[0]+k*0.3,vent[1]+1.05,vent[2]]),rotation:[0,0,0],color:'#f4f7f9',initiallyVisible:true,initial:{activity:0}}));
  const parent=entities.find(e=>e.assembly==='LID');if(parent)for(const e of entities.filter(e=>e.assembly==='PEG')){e.parentId=parent.entityId;e.position=r3(e.position.map((v,i)=>v-parent.position[i]) as Vec3);}
  for(const e of entities.filter(e=>e.assembly==='STEAM_PLUME')){const emission=u.actions.find(a=>a.action==='PUFF'&&e.scriptEntityIds?.some(id=>a.entityIds.includes(id))),emitter=entities.find(p=>p.assembly==='PEG'&&p.scriptEntityIds?.some(id=>emission?.entityIds.includes(id)))??entities.find(p=>p.assembly==='PEG');if(emitter){e.parentId=emitter.entityId;e.position=r3([0,e.size[1]/2+emitter.size[1]/2,0]);}}
 }
 // Beat-local objects share a few showcase slots next to the main station (their lifetimes rarely overlap).
 const anchor=(stations.find(s=>s.kind==='machine')??stations.find(s=>s.world.role==='MAIN_SYSTEM')??stations[0])?.world.position??[0,0,0];
 const slots:Vec3[]=[[1.45,0.4,0.9],[-1.45,0.4,0.9],[0.9,0.4,1.6],[-0.9,0.4,1.6]];
 localBodies.forEach((e,k)=>{const at=add3([anchor[0],0,anchor[2]],slots[k%slots.length]),kind=e.role==='ROTATING'?'rotor':e.role==='GATE'?'gate':'body';
  const w:WorldEntity=kind==='rotor'?{entityId:'local_'+(k+1),worldId,role:'SYSTEM_COMPONENT',...factual([e]),kind:'CYLINDER',assembly:'ROTOR',size:[0.9,0.9,0.25],position:r3([at[0],0.7,at[2]]),rotation:[0,0,0],color:'#e0a93f',initiallyVisible:false}
   :kind==='gate'?{entityId:'local_'+(k+1),worldId,role:'SYSTEM_COMPONENT',...factual([e]),kind:'BOX',assembly:'PANEL',size:[0.8,1.0,0.12],position:r3([at[0],0.5,at[2]]),rotation:[0,0,0],color:'#a9bcc6',initiallyVisible:false}
   :{entityId:'local_'+(k+1),worldId,role:'SYSTEM_COMPONENT',...factual([e]),kind:'BOX',assembly:'DISPLAY_BLOCK',size:[0.7,0.6,0.55],position:r3(at),rotation:[0,0,0],color:'#b9c7cf',initiallyVisible:false};
  entities.push(w);});
 // Rotor hosted inside the machine housing.
 const machine=stations.find(s=>s.kind==='machine');
 if(machine&&rotors[0]&&!stations.some(s=>s.entity===rotors[0])){const m=machine.world,cy=m.position[1]+m.size[1]/2-m.size[0]/2;
  entities.push({entityId:'rotor',worldId,role:'SYSTEM_COMPONENT',...factual([rotors[0]]),kind:'CYLINDER',assembly:'ROTOR',size:[1.05,1.05,0.3],position:[m.position[0],cy,m.position[2]+0.08],rotation:[0,0,0],color:'#e0a93f',initiallyVisible:true});}
 // ---- Conduits link adjacent stations along the route ----
 const conduits=drawn.filter(e=>e.role==='CONDUIT');
 const mi=stations.findIndex(s=>s.kind==='machine');
 conduits.forEach((c,k)=>{
  let a=0;
  if(mi>=0)a=c.stage==='DOWNSTREAM'?mi:c.stage==='UPSTREAM'?Math.max(0,mi-1):Math.max(0,mi-1);
  else a=Math.min(k,Math.max(0,stations.length-2));
  const A=stations[a],B=stations[a+1];
  let path:Vec3[];
  if(A&&B&&A!==B){const p0=A.outlet,p3=B.inlet,dx=(p3[0]-p0[0]),support=entities.find(e=>e.assembly==='RAISED_GROUND'&&Math.abs(e.position[0]-A.world.position[0])<0.01);
   // Leaving an elevated container: run past the edge of its support, then down its outside face (a visible penstock).
   if(support){const edge=support.position[0]+Math.sign(dx)*(support.size[0]/2+0.18);path=[p0,[edge,p0[1],p0[2]],[edge,p3[1]+0.25,p0[2]],[p3[0],p3[1],p3[2]]];}
   else path=[p0,[p0[0]+dx*0.25,p0[1],p0[2]],[p0[0]+dx*0.6,p3[1],p3[2]],p3];}
  // No station at all (only a path is named): the path runs on its own across the stage.
  else{const p0:Vec3=(A??stations[0])?.outlet??[-0.7,0.4,0];path=[p0,[p0[0]+0.7,p0[1],p0[2]],[p0[0]+1.4,p0[1]-0.1,p0[2]+0.2]];}
  path=path.filter((p,i)=>i===0||Math.hypot(p[0]-path[i-1][0],p[1]-path[i-1][1],p[2]-path[i-1][2])>0.05);
  if(path.length<2){const p0=path[0];path=[p0,[p0[0]+0.9,p0[1],p0[2]+0.2]];}
  entities.push({entityId:'conduit_'+(k+1),worldId,role:'CONDUIT',...factual([c]),kind:'PATH',assembly:'PIPE',size:[0.13,0.13,0.13],position:[0,0,0],path:path.map(r3),rotation:[0,0,0],color:'#5c6f7c',initiallyVisible:!local(c),initial:{connection:1}});
 });
 // Gates on a conduit sit at the conduit midpoint (same sentence mentions both).
 for(const g of entities.filter(e=>e.assembly==='PANEL')){const se=u.entities.find(e=>g.scriptEntityIds?.includes(e.id))!,seg=new Set(u.claims.filter(c=>se.claimIds.includes(c.id)).map(c=>c.segmentId));
  const host=entities.find(e=>e.kind==='PATH'&&u.entities.some(c=>e.scriptEntityIds?.includes(c.id)&&u.claims.some(cl=>c.claimIds.includes(cl.id)&&seg.has(cl.segmentId))));
  if(host){const p=host.path!,m=p[Math.floor(p.length/2)];g.position=r3([m[0],m[1],m[2]]);g.size=[0.5,0.5,0.08];}}
 // A context-only entity (aperture, new name of a thing) is represented by its host: the host carries its claims.
 for(const e of u.entities){const sc=scope.get(e.id)!;if(sc.scope!=='CONTEXT_ONLY'||!sc.host)continue;const w=entities.find(x=>x.scriptEntityIds?.includes(sc.host!));if(!w)continue;
  w.relationIds=[...new Set([...w.relationIds,...asserted(e)])].sort();w.scriptEntityIds=[...(w.scriptEntityIds??[]),e.id];if(w.relationIds.length&&w.grounding==='EDITORIAL'){w.grounding='FACTUAL';w.abstraction='ABSTRACT_SYSTEM_REPRESENTATION';}}
 // ---- Demonstration-first layout: the Director's strategies and the script's spatial relations shape the world ----
 const demonstrations=selectDemonstrations(u,known),layout=layoutMechanism(u,entities,demonstrations,worldId,known);
 // Mechanism relations (transfer, move, state/property change, action) get their visual carriers in the same world.
 const mech=planMechanismCarriers(u,entities,layout,worldId,known),carrierIds=new Set(mech.carriers.map(c=>c.entityId));
 // Each part's silhouette comes from its stated role (powered part, restriction, exchange surface, controller...).
 const forms=assignFunctionalForms(u,entities,layout,known);
 // Containment class (containers, rotation with content, crossing a boundary, actuator + route): generic physical relations
 // get their own parts and carriers; the bridge's generic carriers for those same relations step aside.
 const phys=planContainment(u,entities,layout,worldId,known,{fps:input.fps,total:input.totalFrames,startOf:sid=>timing(sid).startFrame,read:(id,p)=>{const v=state[id]?.[p];return typeof v==='number'?v:undefined;}});
 if(phys){const own=new Set(phys.handled),drop=new Set(mech.carriers.filter(c=>own.has(c.relationId)).map(c=>c.entityId));
  for(let i=mech.carriers.length-1;i>=0;i--)if(own.has(mech.carriers[i].relationId))mech.carriers.splice(i,1);
  for(let i=mech.gaps.length-1;i>=0;i--)if(own.has(mech.gaps[i].relationId))mech.gaps.splice(i,1);
  for(const id of drop)if(!mech.carriers.some(c=>c.entityId===id)){const k=entities.findIndex(e=>e.entityId===id);if(k>=0)entities.splice(k,1);carrierIds.delete(id);}
  mech.gaps.push(...phys.gaps);for(const id of phys.carrierIds)carrierIds.add(id);}
 // Energy-flow class (radiant source → collector → carriers → conductor → converter → consumers / grid): same contract.
 const energy=planEnergyFlow(u,entities,layout,worldId,known,{read:(id,p)=>{const v=state[id]?.[p];return typeof v==='number'?v:typeof v==='boolean'?(v?1:0):undefined;}});
 if(energy){const own=new Set(energy.handled),drop=new Set(mech.carriers.filter(c=>own.has(c.relationId)).map(c=>c.entityId));
  for(let i=mech.carriers.length-1;i>=0;i--)if(own.has(mech.carriers[i].relationId))mech.carriers.splice(i,1);
  for(let i=mech.gaps.length-1;i>=0;i--)if(own.has(mech.gaps[i].relationId))mech.gaps.splice(i,1);
  for(const id of drop){const k=entities.findIndex(e=>e.entityId===id);if(k>=0)entities.splice(k,1);carrierIds.delete(id);}
  mech.gaps.push(...energy.gaps);for(const id of energy.carrierIds)carrierIds.add(id);
  // A housing the energy drawing removed (its parts are drawn by this class) no longer frames the scene.
  if(layout.enclosure&&!entities.includes(layout.enclosure)){layout.enclosure=null;layout.inside.length=0;layout.behind.length=0;}}
 // ---- Editorial carriers drawn only along relations already stated: a question's anticipation and the payoff recap ----
 const editorialPaths=planEditorialPaths();for(const p of Object.values(editorialPaths))if(p){entities.push(p.entity);carrierIds.add(p.entity.entityId);}
 for(const e of entities)if(carrierIds.has(e.entityId))e.initiallyVisible=false;
 // Simultaneous visual load per segment. Overflow demotes the least-mentioned persistent entities to beat-local,
 // then leaves the lowest-priority beat-local objects out as visual gaps. A hard total ceiling stays as a last guard.
 const budget=DEMONSTRATION_LIMITS.subjects,worldSegs=(w:WorldEntity)=>[...new Set(u.entities.filter(e=>w.scriptEntityIds?.includes(e.id)).flatMap(segsOf))].sort((a,b)=>segOrder.get(a)!-segOrder.get(b)!);
 const priority=(w:WorldEntity)=>(w.role==='MAIN_SYSTEM'?1000:0)+w.relationIds.length*10+worldSegs(w).length;
 const windowOf=(w:WorldEntity):[number,number]=>{const s=worldSegs(w).map(x=>segOrder.get(x)!);return s.length?[Math.min(...s),Math.max(...s)]:[0,u.segments.length-1];};
 // Mechanism carriers are short events / local states with their own lifecycle (below), not world objects.
 const STAGING=new Set(['RADIANT_SOURCE','SHADE_TREE','NEIGHBORHOOD','INTERIOR_ROOM']);
 const loadAt=(i:number)=>entities.filter(w=>!carrierIds.has(w.entityId)&&!STAGING.has(w.assembly??'')&&(w.initiallyVisible||(windowOf(w)[0]<=i&&i<=windowOf(w)[1]))).length;
 const persistentCount=()=>entities.filter(w=>w.initiallyVisible&&!STAGING.has(w.assembly??'')).length;
 const classParts=new Set([...Object.values(phys?.entityIds??{}),...Object.values(energy?.entityIds??{})]);
 while(persistentCount()>budget){const v=entities.filter(w=>w.initiallyVisible&&w.grounding==='FACTUAL'&&w.role!=='MAIN_SYSTEM'&&!classParts.has(w.entityId)).sort((a,b)=>priority(a)-priority(b)||a.entityId.localeCompare(b.entityId,'en'))[0];if(!v)break;v.initiallyVisible=false;for(const id of v.scriptEntityIds??[])scope.set(id,{scope:'BEAT_LOCAL',reason:'Demoted from persistent: simultaneous visual budget '+budget});}

 const dropped:WorldEntity[]=[];
 const demote=(v:WorldEntity)=>{v.initiallyVisible=false;for(const id of v.scriptEntityIds??[])scope.set(id,{scope:'BEAT_LOCAL',reason:'Demoted from persistent: simultaneous visual budget '+budget});};
 for(let i=0;i<u.segments.length;i++)while(loadAt(i)>budget){
  // First make room with a persistent object that this segment does not need; only then leave something out.
  const idle=entities.filter(w=>w.initiallyVisible&&w.grounding==='FACTUAL'&&w.role!=='MAIN_SYSTEM'&&w.kind!=='PATH'&&!classParts.has(w.entityId)&&!(windowOf(w)[0]<=i&&i<=windowOf(w)[1])).sort((a,b)=>priority(a)-priority(b)||a.entityId.localeCompare(b.entityId,'en'))[0];
  if(idle){demote(idle);continue;}
  const v=entities.filter(w=>!w.initiallyVisible&&!carrierIds.has(w.entityId)&&windowOf(w)[0]<=i&&i<=windowOf(w)[1]).sort((a,b)=>priority(a)-priority(b)||a.entityId.localeCompare(b.entityId,'en'))[0];if(!v)break;entities.splice(entities.indexOf(v),1);dropped.push(v);for(const id of v.scriptEntityIds??[])scope.set(id,{scope:'BUDGET_GAP',reason:'Would exceed '+budget+' simultaneously visible objects in segment '+u.segments[i].id});}
 if(entities.length>DEMONSTRATION_LIMITS.subjectsTotal)throw Error('SCRIPT_WORLD world exceeds hard ceiling ('+entities.length+'/'+DEMONSTRATION_LIMITS.subjectsTotal+' objects) after scope planning');
 if(entities.filter(w=>w.initiallyVisible&&!STAGING.has(w.assembly??'')).length>budget)throw Error('SCRIPT_WORLD persistent objects exceed the simultaneous budget after demotion');
 const visualScope:VisualScopeEntry[]=u.entities.map(e=>{const sc=scope.get(e.id)!,w=entities.find(x=>x.scriptEntityIds?.includes(e.id))??(sc.host?entities.find(x=>x.scriptEntityIds?.includes(sc.host!)):undefined);return{scriptEntityId:e.id,label:e.label,role:e.role,scope:sc.scope,worldEntityId:w?.entityId??null,segments:segsOf(e),reason:sc.reason};});
 const maxSimultaneousVisible=Math.max(...u.segments.map((_,i)=>loadAt(i)));
 // ---- Camera zones from the layout ----
 const pts=(es:WorldEntity[])=>es.flatMap(e=>e.kind==='PATH'?e.path!:[add3(e.position,e.size.map(v=>-v/2) as Vec3),add3(e.position,e.size.map(v=>v/2) as Vec3)]);
 const mainW=layout.enclosure??(machine?.world)??vesselW??entities.find(e=>e.role==='MAIN_SYSTEM')??entities[0];
 // Presenter stands beside the system on the near side of the stage (not between the camera and the system).
 const persistentEnts=entities.filter(e=>e.initiallyVisible);
 const leftmost=Math.min(...persistentEnts.map(e=>e.kind==='PATH'?Math.min(...e.path!.map(p=>p[0])):e.position[0]-e.size[0]/2));
 // Beside the system at its depth when that spot is free (never between camera and system); otherwise in front-left.
 const footprint=(p:Vec3)=>persistentEnts.some(e=>{if(e.kind==='PATH')return e.path!.some(q=>Math.hypot(q[0]-p[0],q[2]-p[2])<0.6);return Math.abs(e.position[0]-p[0])<e.size[0]/2+0.55&&Math.abs(e.position[2]-p[2])<e.size[2]/2+0.55;});
 const half=mainW.size[0]/2,beside:Vec3[]=[[mainW.position[0]-half-1.05,0,mainW.position[2]+0.35],[mainW.position[0]+half+1.05,0,mainW.position[2]+0.35]];
 const presenterHome:Vec3=r3(beside.find(p=>!footprint(p))??[Math.max(leftmost+0.35,mainW.position[0]-1.75),0,mainW.position[2]+0.95]);
 const presenterPts:Vec3[]=[add3(presenterHome,[-0.55,0,-0.4]),add3(presenterHome,[0.55,1.55,0.4])];
 const left:Vec3=[-0.42,0.26,1],front:Vec3=[0.28,0.18,1];
 // Pipe ends next to the main system, so close shots show what enters and leaves it.
 const stubs:Vec3[]=entities.filter(e=>e.kind==='PATH').flatMap(e=>e.path!).filter(p=>Math.hypot(p[0]-mainW.position[0],p[2]-mainW.position[2])<1.1);
 const last=(stations.at(-1)??{world:mainW}).world;
 const cameraZones:Record<CameraZone,CameraState>={
  WORLD:frameCamera([...pts(persistentEnts),...presenterPts],left,1.12),
  SYSTEM:frameCamera([...pts([mainW]),...presenterPts],[0.12,0.2,1],1.32),
  // MECHANISM_STAGE has no section view: the CUTAWAY slot holds an alternate inspection angle of the main system.
  // With an enclosure the CUTAWAY zone looks into its open section; otherwise it is an alternate inspection angle.
  CUTAWAY:layout.enclosure?frameCamera(pts([layout.enclosure]),[0.08,0.16,1],1.02,3):frameCamera([...pts([mainW]),...stubs],[-0.75,0.6,1],1.1,3),
  COMPONENT:frameCamera([...pts([mainW]),...stubs],front,1.0,2.8),
  ACTION:frameCamera(pts(persistentEnts.filter(e=>e.assembly!=='RAISED_GROUND')),front,1.05),
  RESULT:frameCamera(pts([last]),[0.1,0.35,1],1.6,3),
 };
 // ---- Context scene planner: where such an object is plausibly seen (staging, not a fact) ----
 const fold=(x:string)=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const candidates=[...(layout.enclosure?[layout.enclosure]:[]),...entities.filter(e=>e.role==='MAIN_SYSTEM'),...entities.filter(e=>e.grounding==='FACTUAL')].flatMap(e=>(e.scriptEntityIds??[]).flatMap(id=>u.entities.find(x=>x.id===id)?.heads??[]).concat(e.label?[e.label.split(/\s+/)[0]]:[])).map(fold);
 const words=(u.source.normalized.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().match(/[a-z]+/g)??[]),place=PLACE_CONTEXT.find(c=>words.some(w=>c.pattern.test(w)));
 // Context ladder: 1) a place the script states, 2) the object's category, 3) structure — a closed housing with powered
 // parts inside it is an indoor machine (neutral interior, no room type claimed) unless the script names an outdoor place,
 // 4) the neutral default.
 const powered=entities.some(e=>e.assembly==='MACHINE_UNIT'||e.variant==='PUMP_LIKE'||Boolean(e.form&&POWERED_FORMS.has(e.form))||e.assembly==='ROTATING_CONTAINER'&&Boolean(phys?.model.rotating.some(r=>phys.entityIds[r.subject]===e.entityId)));
 const structural=layout.enclosure&&powered&&!words.some(w=>OUTDOOR_PLACE.test(w))?{category:'STRUCTURAL_HOUSED_MACHINE',context:'NEUTRAL_INTERIOR' as const}:undefined;
 const exterior=energy?.model.building?{category:'STATED_BUILDING_EXTERIOR',context:'RESIDENTIAL_EXTERIOR' as const}:undefined;
 const hit=exterior??(place?{category:'STATED_PLACE',context:place.context}:undefined)??OBJECT_CONTEXT.find(c=>candidates.some(h=>c.pattern.test(h)))??structural,sceneContext={category:hit?.category??null,context:hit?.context??'OUTDOOR_GROUND',reason:hit?(hit===structural?'Closed housing with powered parts inside (structure, no room type claimed): neutral interior (staging)':'Main object category '+hit.category+' (staging choice)'):'No indoor category: default outdoor ground'};
 if(hit&&hit.context==='RESIDENTIAL_EXTERIOR')entities.push({entityId:'context_neighborhood',worldId,role:'CONTEXT_PROP',grounding:'EDITORIAL',abstraction:'EDITORIAL_DECORATION',relationIds:[],participant:null,label:null,scriptEntityIds:[],kind:'CYLINDER',assembly:'NEIGHBORHOOD',size:[4,1,4],position:[0,0,0],rotation:[0,0,0],color:'#ffffff',initiallyVisible:true});
 else if(hit&&hit.context!=='OUTDOOR_GROUND'){const sol=entities.filter(e=>e.kind!=='PATH'),minX=Math.min(...sol.map(e=>e.position[0]-e.size[0]/2)),maxX=Math.max(...sol.map(e=>e.position[0]+e.size[0]/2)),minZ=Math.min(...sol.map(e=>e.position[2]-e.size[2]/2));
  // Neutral staging clearance: the object stands well away from the back wall, so rear parts can be filmed from inside the room.
  const W2=maxX-minX+10,D=10;entities.push({entityId:'context_room',worldId,role:'CONTEXT_PROP',grounding:'EDITORIAL',abstraction:'EDITORIAL_DECORATION',relationIds:[],participant:null,label:null,scriptEntityIds:[],kind:'CYLINDER',assembly:'INTERIOR_ROOM',...(hit.context==='DOMESTIC_INTERIOR'?{}:{variant:hit.context as 'KITCHEN_LIKE'}),size:r3([W2/4,3.4/4,D/4]),position:r3([(minX+maxX)/2,0,minZ-2.8+D/2]),rotation:[0,0,0],color:'#f1e6d6',initiallyVisible:true});}
 const world:PersistentWorld={worldId,template:'MECHANISM_STAGE',environmentId:input.environmentId??'ENV_FOREST_001',presenter:{entityId:'presenter',resourceId:'CHAR_CAIO_001',home:presenterHome,facing:1.05,scale:0.82},cutaway:layout.enclosure?{kind:'HOUSING_SECTION',openAmount:1,revealsEntityIds:[...layout.inside,...layout.tints]}:{kind:'NONE',openAmount:0,revealsEntityIds:[]},cameraZones,entities,visualScope,maxSimultaneousVisible};
 // ---- Beats: what happens (actions) → how to film it ----
 const beats:CausalVisualBeat[]=[],transitions:VisualStateTransition[]=[],gaps:VisualGap[]=[];
 const state:Record<string,Record<string,number|boolean>>={};
 for(const e of entities)state[e.entityId]={openness:Math.abs(e.rotation[0])>0.01||Math.abs(e.rotation[1])>0.01?1:0,activity:e.initial?.activity??0,visible:e.initiallyVisible,flowProgress:0,fillLevel:e.initial?.fillLevel??0,spin:0,x:e.position[0],y:e.position[1]};
 const version:Record<string,number>={};
 // Planned state at draft time (drafts are created before scheduling; decisions must see earlier drafts).
 const flowing=new Set<string>(),spinning=new Set<string>(),fill:Record<string,number>={},at:Record<string,Vec3>={};for(const e of entities){fill[e.entityId]=e.initial?.fillLevel??0;at[e.entityId]=[...e.position] as Vec3;}
 const activity:Record<string,number>={};for(const e of entities)activity[e.entityId]=e.initial?.activity??0;
 const revealed=new Set<string>();
 // A gate whose first stated change is closing starts open (the stated change must be visible), and vice versa.
 const lidOf=(e:WorldEntity|null)=>e&&e.assembly==='VESSEL'?entities.find(x=>x.assembly==='LID')??e:e;
 const gateAngle=(e:WorldEntity,v:number):Vec3=>e.assembly==='LID'?[-v*0.9,0,0]:[0,v*1.25,0];
 // A lid opens by lifting; whatever sits on it (pins, valves) rides with it. restY keeps each object's closed height.
 const restY:Record<string,number>={};for(const e of entities)restY[e.entityId]=e.position[1];
 // An open lid rests on the ground beside the vessel, on the side away from the presenter (never floating).
 const sideOf=(g:WorldEntity)=>world.presenter.home[0]<=g.position[0]?1:-1;
 const sidePose=(g:WorldEntity,e:WorldEntity):Vec3=>r3([restX(e)+sideOf(g)*1.9,g.size[1]/2+(restY[e.entityId]-restY[g.entityId]),e.position[2]]);
 const restXs:Record<string,number>={};for(const e of entities)restXs[e.entityId]=e.position[0];const restX=(e:WorldEntity)=>restXs[e.entityId];
 const seenGate=new Set<string>();for(const a of u.actions)if(a.action==='OPEN'||a.action==='CLOSE'){const g=lidOf(a.entityIds.map(id=>entities.find(e=>e.scriptEntityIds?.includes(id))).find(Boolean)??null);if(!g||seenGate.has(g.entityId))continue;seenGate.add(g.entityId);if(a.action==='CLOSE'&&!g.initialStateFrom){if(g.assembly==='LID'){g.position=sidePose(g,g);at[g.entityId]=[...g.position] as Vec3;}else g.rotation=gateAngle(g,1);state[g.entityId].openness=1;}}
 // One planned position per object: every MOVE (horizontal or vertical) starts where the previous one ended.
 const change=(beatId:string,entityId:string,operation:VisualStateTransition['operation'],parameter:string|null,to:number|boolean,grounded:string|null,reason:string|null)=>{
  if(!state[entityId])throw Error('SCRIPT_WORLD transition on an entity that is not in the world: '+entityId);
  const key=parameter??'visible',from=state[entityId][key];if(from===to)return null;version[entityId]=(version[entityId]??0)+1;state[entityId][key]=to;
  const t:VisualStateTransition={id:id('VT',{beatId,entityId,key,to}),beatId,entityId,operation,parameter,from,to,grounding:grounded?'GROUNDED':'EDITORIAL',evidenceRelationId:grounded,editorialReason:reason,stateVersion:version[entityId]};transitions.push(t);return t.id;};
 const timing=(sid:string)=>input.timing.find(t=>t.sentenceId===sid)!;
 type Draft=Omit<CausalVisualBeat,'id'|'order'|'startFrame'|'endFrame'|'timing'|'transitionIds'>&{weight:number;apply?:(beatId:string)=>(string|null)[]};
 const visualOf=(seId:string):WorldEntity|null=>{const own=entities.find(e=>e.scriptEntityIds?.includes(seId));if(own)return own;const h=scope.get(seId)?.host;return h?entities.find(e=>e.scriptEntityIds?.includes(h))??null:null;};
 const schedule=(drafts:Draft[],start:number,end:number,sentenceId:string|null,exact:boolean)=>{
  const total=drafts.reduce((a,d)=>a+d.weight,0),len=end-start;let cursor=start;
  // Narration sync: a beat whose relation has a spoken predicate starts so that its first action lands on that word
  // (character position within the sentence ≈ time within its narration). Others share the remaining time.
  const seg=sentenceId?u.segments.find(x=>x.id===sentenceId):null,predAt=(rid:string)=>{const c=u.claims.find(x=>x.id===rid);if(c)return c.trigger.start;const m=(u.mechanism??[]).find(x=>x.id===rid);return m?m.predicate.start:null;};
  const anchors=drafts.map(d=>{if(!exact||!seg||d.grounding!=='FACTUAL_DEMONSTRATION')return null;const p=d.relationIds.map(predAt).find(x=>x!==null);if(p==null)return null;return Math.round(start+len*Math.max(0,Math.min(1,(p-seg.span.start)/Math.max(1,seg.span.text.length))));});
  const firstOff=(d:Draft)=>Math.min(1,...d.operations.filter(o=>!['REVEAL','HIDE','HIGHLIGHT'].includes(o.operation)&&!o.observed).map(o=>o.startOffset));
  const starts:number[]=[];let est=start;drafts.forEach((d,i)=>{const share=Math.max(12,Math.round(len*d.weight/total)),want=anchors[i]!==null?anchors[i]!-Math.round(firstOff(d)*share):est;const minS=i?starts[i-1]+12:start,maxS=end-12*(drafts.length-i);starts.push(Math.max(minS,Math.min(maxS,i===0?start:want)));est=starts[i]+share;});
  if(anchors.some(a=>a!==null)&&anchors[0]!==null){const share=Math.max(12,Math.round(len*drafts[0].weight/total));starts[0]=start;void share;}
  drafts.forEach((d,i)=>{const a=anchors.some(x=>x!==null)?starts[i]:cursor,l=i===drafts.length-1?end-a:anchors.some(x=>x!==null)?starts[i+1]-starts[i]:Math.max(12,Math.round(len*d.weight/total)),b=Math.min(end,a+l);cursor=b;
   const beatId=id('BEAT',{sentenceId,i,intent:d.visualIntent,relationIds:d.relationIds,focus:d.focusEntityId});const tids=(d.apply?.(beatId)??[]).filter((x):x is string=>Boolean(x));
   // A beat that cannot start later (first in its sentence) delays its action toward the spoken predicate (at most 0.8 s, so
   // the picture does not wait on the words); the action keeps its end so the after-state still holds on screen.
   const anc=anchors[i],f=firstOff(d);if(anc!==null&&b>a&&f<1){const want=(anc-a)/(b-a),minEnd=Math.min(...d.operations.filter(o=>o.startOffset>=f&&!o.observed&&!['REVEAL','HIDE','HIGHLIGHT'].includes(o.operation)).map(o=>o.endOffset)),s0=Math.min(want,f+0.8*input.fps/(b-a),0.5,minEnd-0.2);
    if(s0>f+0.01)d.operations=d.operations.map(o=>o.observed||o.startOffset<f||['REVEAL','HIDE','HIGHLIGHT'].includes(o.operation)?o:{...o,startOffset:+Math.max(o.startOffset,s0).toFixed(3),endOffset:+Math.max(o.endOffset,Math.max(o.startOffset,s0)+0.2).toFixed(3)});}
   const {weight:_w,apply:_a,...rest}=d;beats.push({...rest,...(anchors[i]!==null?{anchorFrame:anchors[i]!}:{}),id:beatId,order:beats.length,startFrame:a,endFrame:b,timing:exact&&drafts.length===1?'SENTENCE_BOUNDARY':'ESTIMATED_WITHIN_SENTENCE',transitionIds:tids});});
 };
 const ops=(...o:Omit<BeatOperation,'startOffset'|'endOffset'>[]):BeatOperation[]=>o.map(x=>({...x,startOffset:0,endOffset:1}));
 const rotorW=entities.find(e=>e.assembly==='ROTOR'&&e.entityId==='rotor')??null;
 const spinRate=-Math.PI*2*0.55/input.fps;
 const feeding=(target:WorldEntity)=>entities.filter(e=>e.kind==='PATH').find(p=>{const end=p.path!.at(-1)!;const d=Math.hypot(end[0]-target.position[0],end[2]-target.position[2]);return d<1.2;})??null;
 const flowDraft=(rel:string,base:Pick<CausalVisualBeat,'sentenceId'|'storyNodeIds'|'relationIds'|'evidenceIds'>,p:WorldEntity,level:'DIRECT'|'PARTIAL'|'SYMBOLIC',why:string,weight:number,zone:CameraZone='ACTION'):Draft=>{
  const on=flowing.has(p.entityId);flowing.add(p.entityId);
  // A path inside a closed enclosure is seen through a section: the housing opens before the flow starts.
  const enc=layout.enclosure&&layout.inside.includes(p.entityId)&&activity[layout.enclosure.entityId]<1?layout.enclosure:null;if(enc)activity[enc.entityId]=1;
  const d:Draft={...base,grounding:'FACTUAL_DEMONSTRATION',visualIntent:on?'CONTINUING_FLOW':'DIRECTIONAL_MOVEMENT',presenterIntent:'NONE',presenterVisible:false,cameraZone:zone,cameraMotivation:'Follow the movement along its stated path',focusEntityId:p.entityId,label:null,
   operations:on?[{operation:'FLOW',target:p.entityId,parameters:{path:p.path,from:1,to:1,direction:'FORWARD',speed:1,amount:0.85},startOffset:0,endOffset:1,observed:'SUSTAINED_STEP'}]:[{operation:'FLOW',target:p.entityId,parameters:{path:p.path,from:0,to:1,direction:'FORWARD',speed:1,amount:0.85},startOffset:0.05,endOffset:0.8}],
   proof:{level,rationale:why},weight,apply:b=>[change(b,p.entityId,'FLOW','flowProgress',1,rel,null)]};
  if(!enc)return d;
  return{...d,cameraZone:'CUTAWAY',cameraMotivation:'Open the housing to see the movement inside',operations:[{operation:'INCREASE',target:enc.entityId,parameters:{parameter:'activity',from:0,to:1},startOffset:0,endOffset:0.3},...d.operations.map(o=>o.observed?o:{...o,startOffset:0.3,endOffset:0.9})],apply:b=>[change(b,enc.entityId,'INCREASE','activity',1,null,'Section view opens to show the inside'),...d.apply!(b)]};};
 const facts=input.sentences.filter(s=>s.kind==='FACT'),firstFact=input.sentences.findIndex(s=>s.kind==='FACT');
 const lead=input.sentences.slice(0,Math.max(0,firstFact));
 if(lead.length){const a=timing(lead[0].id).startFrame,b=timing(lead[lead.length-1].id).endFrame;
  schedule([{sentenceId:lead[0].id,storyNodeIds:[],relationIds:[],evidenceIds:[],grounding:'EDITORIAL_CONTEXT',visualIntent:'WORLD_ESTABLISHING',presenterIntent:'ESTABLISH_CONTEXT',presenterVisible:true,cameraZone:'WORLD',cameraMotivation:'Establish the world before any explanation',focusEntityId:null,label:null,operations:[],proof:null,weight:0.55},
   {sentenceId:lead[lead.length-1].id,storyNodeIds:[],relationIds:[],evidenceIds:[],grounding:'PRESENTER_ACTION',visualIntent:'SYSTEM_ESTABLISHING',presenterIntent:'POINT_TO_SYSTEM',presenterVisible:true,cameraZone:'SYSTEM',cameraMotivation:'New focus: the system the script talks about',focusEntityId:mainW.entityId,label:null,operations:ops({operation:'HIGHLIGHT',target:mainW.entityId,parameters:{amount:0.2}}),proof:null,weight:0.45}],a,b,lead[0].id,false);}
 let presenterOn=true;const mergedInto=new Map<string,string>(),absorbed:string[]=[];
 const physIntents=new Set(['CONTAINER_ROTATES','CONTAINER_KEEPS_ROTATING','CONTENT_PRESSED_AGAINST_WALL','CONTENT_MOVES_WITH_CONTAINER','MATERIAL_PASSES_THROUGH_BOUNDARY','MATERIAL_COLLECTS','OUTER_AROUND_INNER','CONTENT_INSIDE_CONTAINER','ACTUATOR_PULLS_FROM_SOURCE','ACTUATOR_SENDS_ALONG_ROUTE','MATERIAL_LEAVES_SYSTEM','CONTENT_LOSES_MATERIAL',
  'PART_PLACED','COLLECTOR_SHADED','PART_MOVES_TO_PLACE','RADIANT_ENERGY_ARRIVES','CARRIERS_PUSHED','CARRIERS_FLOW_IN_CONDUCTOR','CURRENT_FORMED','ONE_DIRECTION_CURRENT','CONVERTER_RECEIVES','CONVERTER_CHANGES_KIND','CURRENT_TO_DISTRIBUTION','CURRENT_REACHES_CONSUMERS','CONSUMER_ON','CONSUMER_OFF','COLLECTOR_PRODUCES','SURPLUS_TO_GRID','METER_COUNTS','BUILDING_USES_GRID','BUILDING_USES']);
 // ---- Hypothetical episodes: "Imagine… / E se…" up to a stated rewind cue ("Vamos voltar."). What the script says inside is
 // shown (marked hypothetical); at the cue every state the episode changed goes back to how it was before it.
 const foldS=(x:string)=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9' ]+/g,' ').replace(/\s+/g,' ').trim();
 const episodes:{start:number;rewind:number}[]=[];for(let i=0;i<input.sentences.length;i++)if(HYPOTHESIS_CUE.test(foldS(input.sentences[i].text))){const j=input.sentences.findIndex((x,k)=>k>i&&REWIND_CUE.test(foldS(x.text)));if(j>i){episodes.push({start:i,rewind:j});i=j;}}
 const sIndex=(sid:string)=>input.sentences.findIndex(x=>x.id===sid),rewound=new Set<string>(),snapped=new Set<number>();
 let snap:{state:typeof state;at:typeof at;activity:typeof activity;fill:typeof fill}|null=null;
 const takeSnap=()=>{snap={state:JSON.parse(JSON.stringify(state)),at:JSON.parse(JSON.stringify(at)),activity:{...activity},fill:{...fill}};};
 const rewindDraft=(sid:string):Draft|null=>{if(!snap)return null;const sn=snap;snap=null;const o:BeatOperation[]=[],ch:{id:string;op:VisualStateTransition['operation'];key:string|null;to:number|boolean}[]=[];
  for(const e of entities){const cur=state[e.entityId],was=sn.state[e.entityId];if(!cur||!was)continue;
   if(cur.visible!==was.visible){o.push({operation:was.visible?'REVEAL':'HIDE',target:e.entityId,parameters:{},startOffset:0.1,endOffset:0.2});ch.push({id:e.entityId,op:was.visible?'REVEAL':'HIDE',key:null,to:Boolean(was.visible)});}
   for(const k of ['activity','fillLevel'] as const){const a=Number(cur[k]),b=Number(was[k]);if(Math.abs(a-b)>1e-6&&e.kind!=='PATH'){o.push({operation:b<a?'DECREASE':'INCREASE',target:e.entityId,parameters:{parameter:k,from:a,to:b},startOffset:0.15,endOffset:0.7});ch.push({id:e.entityId,op:b<a?'DECREASE':'INCREASE',key:k,to:b});}}
   const p0=at[e.entityId],p1=sn.at[e.entityId];if(p0&&p1&&p0.some((v,i)=>Math.abs(v-p1[i])>1e-6)){o.push({operation:'MOVE',target:e.entityId,parameters:{from:[...p0],to:[...p1]},startOffset:0.15,endOffset:0.75});ch.push({id:e.entityId,op:'MOVE',key:Math.abs(p0[1]-p1[1])>1e-6?'y':'x',to:Math.abs(p0[1]-p1[1])>1e-6?p1[1]:p1[0]});}}
  Object.assign(activity,sn.activity);Object.assign(fill,sn.fill);phys?.forget();energy?.forget();for(const k of Object.keys(sn.at))at[k]=sn.at[k];rewound.add(sid);
  return{sentenceId:sid,storyNodeIds:[],relationIds:[],evidenceIds:[],grounding:'EDITORIAL_TRANSITION',visualIntent:'REWIND_TO_START',presenterIntent:'NONE',presenterVisible:false,cameraZone:'WORLD',cameraMotivation:'Rewind: back to before the hypothesis',focusEntityId:mainW.entityId,label:null,operations:o,proof:null,weight:0.8,
   apply:b=>ch.map(c=>change(b,c.id,c.op,c.key,c.to,null,'Rewind: back to before the hypothesis'))};};
 const flushRewinds=(beforeIndex:number)=>{for(const ep of episodes){const r=input.sentences[ep.rewind];if(ep.rewind>=beforeIndex||rewound.has(r.id)||r.kind==='FACT')continue;const d=rewindDraft(r.id);if(d){const t=timing(r.id);schedule([d],t.startFrame,t.endFrame,r.id,true);}}};
 for(const s of facts){
  const t=timing(s.id),drafts:Draft[]=[],si=sIndex(s.id);
  flushRewinds(si);
  // The world as it was before the hypothesis is remembered at its first factual sentence.
  const ep0=episodes.find(ep=>ep.start<=si&&si<ep.rewind);if(ep0&&!snapped.has(ep0.start)){snapped.add(ep0.start);takeSnap();}
  if(episodes.some(ep=>ep.rewind===si)){const d=rewindDraft(s.id);if(d)drafts.push(d);}
  // Relations in the order they are spoken ("when X, Y does Z": X is shown before Z); unplaced ones keep their order.
  // A part is introduced (joins the system) before anything it does.
  const spoken=(rid:string)=>u.actions.some(a=>a.claimId===rid&&a.action==='IDENTIFY')?-1:u.claims.find(c=>c.id===rid)?.trigger.start??(u.mechanism??[]).find(m=>m.id===rid)?.predicate.start??Infinity;
  const claimIds=s.relationIds.map((r,i)=>({r,i})).sort((a,b)=>spoken(a.r)-spoken(b.r)||a.i-b.i).map(x=>x.r);
  for(const cid of claimIds){
   const acts=u.actions.filter(a=>a.claimId===cid),base={sentenceId:s.id,storyNodeIds:[],relationIds:[cid],evidenceIds:[] as string[]};
   // A claim only named here (no generic operation) whose predicate a mechanism carrier of this sentence executes is shown by that carrier.
   const pred=u.claims.find(c=>c.id===cid)?.predicate,shownBy=acts.length&&acts.every(a=>a.action==='NAME_ONLY')?mech.carriers.find(c=>c.sentenceId===s.id&&(u.mechanism??[]).find(m=>m.id===c.relationId)?.lemma===pred):undefined;
   if(shownBy){mergedInto.set(cid,shownBy.relationId);continue;}
   for(const a of acts)drafts.push(...draftsFor(a,cid,base));
   for(const c of mech.carriers.filter(c=>c.relationId===cid))drafts.push(carrierDraft(c,base));
   const pc=phys?.draftFor(cid)??energy?.draftFor(cid)??null;if(pc)drafts.push(physicalDraft(pc,base));
   else if(phys?.handled.includes(cid)||energy?.handled.includes(cid))absorbed.push(cid);
  }
  // A clause-level draft that only re-animates a part the containment plan already demonstrates in this sentence is
  // absorbed by that demonstration (its claim is cited there): one demonstration per thing, not two.
  if((phys||energy)&&drafts.some(d=>physIntents.has(d.visualIntent))){const physIds=new Set([...Object.values(phys?.entityIds??{}),...(phys?.carrierIds??[]),...Object.values(energy?.entityIds??{}),...(energy?.carrierIds??[])]),host=drafts.find(d=>physIntents.has(d.visualIntent))!;
   for(let i=drafts.length-1;i>=0;i--){const d=drafts[i];if(physIntents.has(d.visualIntent))continue;const touches=d.operations.some(o=>physIds.has(o.target))||Boolean(d.focusEntityId&&physIds.has(d.focusEntityId));
    if(touches||d.operations.every(o=>o.operation==='HIGHLIGHT')){host.relationIds=[...new Set([...host.relationIds,...d.relationIds])].sort();drafts.splice(i,1);for(const r of d.relationIds)for(let g=gaps.length-1;g>=0;g--)if(gaps[g].relationId===r)gaps.splice(g,1);}}}
  for(const cid of absorbed.splice(0)){const host=drafts.find(d=>physIntents.has(d.visualIntent));if(host&&!host.relationIds.includes(cid))host.relationIds=[...host.relationIds,cid].sort();}
  for(const d of drafts)for(const [claim,rel] of mergedInto)if(d.relationIds.includes(rel)&&!d.relationIds.includes(claim)&&u.claims.find(c=>c.id===claim)?.segmentId===s.id)d.relationIds=[...d.relationIds,claim].sort();
  if(!drafts.length)drafts.push({sentenceId:s.id,storyNodeIds:[],relationIds:[],evidenceIds:[],grounding:'EDITORIAL_CONTEXT',visualIntent:'HOLD_SYSTEM',presenterIntent:'OBSERVE_SYSTEM',presenterVisible:true,cameraZone:'SYSTEM',cameraMotivation:'Hold the system',focusEntityId:mainW.entityId,label:null,operations:[],proof:null,weight:1});
  // A long sentence with one visual beat gets a second, closer look at the same participant (new framing, not new facts).
  // Stated time of day (night): staging that follows the words, carried by the sentence's first draft.
  const tod=energy?.timeOfDay(s.id);if(tod&&tod.ops.length){const d0=drafts[0]??null;const host:Draft=d0??{sentenceId:s.id,storyNodeIds:[],relationIds:[],evidenceIds:[],grounding:'EDITORIAL_TRANSITION',visualIntent:'TIME_OF_DAY',presenterIntent:'NONE',presenterVisible:false,cameraZone:'WORLD',cameraMotivation:'The stated time of day',focusEntityId:mainW.entityId,label:null,operations:[],proof:null,weight:0.6};
   host.operations=[...tod.ops,...host.operations];const prev=host.apply;host.apply=b=>[...tod.changes.map(c=>change(b,c.entityId,c.operation as VisualStateTransition['operation'],c.parameter,c.to,null,c.reason??'Stated time of day')),...(prev?prev(b):[])];if(!d0)drafts.push(host);}
  const secs=(t.endFrame-t.startFrame)/input.fps;
  if(drafts.length===1&&secs>6&&drafts[0].focusEntityId){const d=drafts[0];drafts.push({sentenceId:s.id,storyNodeIds:[],relationIds:[],evidenceIds:[],grounding:'EDITORIAL_TRANSITION',visualIntent:'CLOSE_LOOK',presenterIntent:'NONE',presenterVisible:false,cameraZone:d.cameraZone==='COMPONENT'?'ACTION':'COMPONENT',cameraMotivation:'Closer look at the same participant while the sentence continues',focusEntityId:d.focusEntityId,label:null,operations:[],proof:null,weight:0.7});}
  const lastFact=s===facts[facts.length-1]&&secs>=3;
  if(lastFact)drafts.push({sentenceId:s.id,storyNodeIds:[],relationIds:[],evidenceIds:[],grounding:'EDITORIAL_CONTEXT',visualIntent:'RETURN_TO_WORLD',presenterIntent:'FINAL_PAYOFF',presenterVisible:true,cameraZone:'WORLD',cameraMotivation:'Return to context: the whole system in its world',focusEntityId:null,label:null,operations:[],proof:null,weight:0.75});
  schedule(drafts,t.startFrame,t.endFrame,s.id,true);
 }
 flushRewinds(Infinity);
 for(const s of input.sentences.slice(firstFact<0?input.sentences.length:firstFact).filter(s=>s.kind==='EDITORIAL'&&!rewound.has(s.id))){const t=timing(s.id),plain:Draft={sentenceId:s.id,storyNodeIds:[],relationIds:[],evidenceIds:[],grounding:'EDITORIAL_CONTEXT',visualIntent:'RETURN_TO_WORLD',presenterIntent:'OBSERVE_SYSTEM',presenterVisible:true,cameraZone:'SYSTEM',cameraMotivation:'Return to the presenter and the system',focusEntityId:mainW.entityId,label:null,operations:[],proof:null,weight:1};
  const q=isQuestion(s),ant=editorialPaths.anticipation?.sentenceId===s.id?editorialPaths.anticipation:null,recap=editorialPaths.recap?.sentenceId===s.id?editorialPaths.recap:null;
  // QUESTION → small hold → reveal: the question holds on where the answer will happen (the answer itself comes with the next sentence).
  // With an anticipation, the quantity the question asks about becomes visible, then starts along the stated circuit.
  if(q){const id=ant?.entity.entityId;schedule([{...plain,visualIntent:'QUESTION_HOLD',presenterIntent:'NONE',cameraMotivation:ant?'Question: the quantity is seen, then starts along the closed circuit toward the answer':'Question: hold on where the answer will appear',
    operations:id?[{operation:'REVEAL',target:id,parameters:{},startOffset:0,endOffset:0.04},{operation:'FLOW',target:id,parameters:{path:ant!.entity.path,from:0,to:1,direction:'FORWARD',speed:1,amount:1},startOffset:0.3,endOffset:0.95},{operation:'HIDE',target:id,parameters:{},startOffset:0.97,endOffset:1}]:[],
    apply:id?b=>[change(b,id,'REVEAL',null,true,null,'Anticipation of the answer appears where the quantity is'),change(b,id,'FLOW','flowProgress',1,null,'Anticipation: the quantity starts along the stated closed circuit'),change(b,id,'HIDE',null,false,null,'Anticipation over: the next sentence answers')]:undefined}],t.startFrame,t.endFrame,s.id,true);continue;}
  // PAYOFF: the chain the script stated is replayed in one continuous path (inside → circuit → back → out), then the object closes.
  if(recap){const id=recap.entity.entityId;schedule([{...plain,visualIntent:'PAYOFF_RECAP',presenterIntent:'NONE',presenterVisible:false,cameraZone:'CUTAWAY',cameraMotivation:'Payoff: the stated chain in one path — from the inside, through the circuit, out at the back',
    operations:[{operation:'REVEAL',target:id,parameters:{},startOffset:0,endOffset:0.04},{operation:'FLOW',target:id,parameters:{path:recap.entity.path,from:0,to:1,direction:'FORWARD',speed:1,amount:1},startOffset:0.06,endOffset:0.82}],weight:0.62,
    apply:b=>[change(b,id,'REVEAL',null,true,null,'Recap of the stated chain appears inside'),change(b,id,'FLOW','flowProgress',1,null,'Recap: the quantity follows the chain the script stated')]},{...plain,weight:0.38}],t.startFrame,t.endFrame,s.id,true);continue;}
  schedule([plain],t.startFrame,t.endFrame,s.id,true);}
 if(firstFact<0&&!lead.length)throw Error('SCRIPT_WORLD script has no representable sentence');
 void presenterOn;
 function draftsFor(a:ClaimAction,cid:string,base:Pick<CausalVisualBeat,'sentenceId'|'storyNodeIds'|'relationIds'|'evidenceIds'>):Draft[]{
  const targets=a.entityIds.map(visualOf).filter((e):e is WorldEntity=>Boolean(e));
  const tgt=targets[0]??null,claim=u.claims.find(c=>c.id===cid)!,base0=()=>base;
  const editorialFocus=(e:WorldEntity,intent:string,zone:CameraZone,why:string):Draft=>({sentenceId:base.sentenceId,storyNodeIds:[],relationIds:[],evidenceIds:[],grounding:'EDITORIAL_TRANSITION',visualIntent:intent,presenterIntent:'NONE',presenterVisible:false,cameraZone:zone,cameraMotivation:why,focusEntityId:e.entityId,label:null,operations:ops({operation:'HIGHLIGHT',target:e.entityId,parameters:{amount:0.15}}),proof:null,weight:0.6});
  switch(a.action){
   case 'DEPART':{const out=tgt?entities.find(e=>e.kind==='PATH'&&e.path&&Math.hypot(e.path[0][0]-tgt.position[0],e.path[0][2]-tgt.position[2])<1.2):null;
    // Leaving a source is shown as movement out along the path that starts at it (that path is not named by the clause: partial).
    if(out&&!flowing.has(out.entityId))return[{...flowDraft(cid,base,out,'SYMBOLIC','The material leaves the stated source along the path that starts there (the clause does not name that path: system-inferred link)',1),focusEntityId:tgt!.entityId,cameraMotivation:'The material leaves the stated source'}];}
    return tgt?[editorialFocus(tgt,'SOURCE_FOCUS',tgt.assembly==='VANE_RING'?'COMPONENT':'RESULT','Show where the movement starts')]:[];
   case 'FLOW':{const p=tgt?.kind==='PATH'?tgt:entities.find(e=>e.kind==='PATH'&&e.initiallyVisible&&(a.cue==='FLOW_CUE'?u.entities.find(x=>e.scriptEntityIds?.includes(x.id))?.stage!=='DOWNSTREAM':true))??null;
    if(!p){gaps.push({relationId:cid,predicate:claim.predicate,reason:'No path entity to carry the stated flow'});return[];}
    const own=p.relationIds.includes(cid),d=flowDraft(cid,base,p,'DIRECT','The fluid moves inside the stated path, in the stated direction',1.3);
    // A flow only named by a cue word ("fluxo") is illustrated on an existing path: system-inferred link, symbolic proof.
    return[own?d:{...d,proof:{level:'SYMBOLIC',rationale:'Flow named in the clause is illustrated on a path the clause does not name (system-inferred link)'}}];}
   case 'ARRIVE':{if(!tgt)return[];
    if(tgt.assembly==='VANE_RING'){const p=feeding(tgt);return[{...base,grounding:'FACTUAL_DEMONSTRATION',visualIntent:'ARRIVAL_AT_COMPONENT',presenterIntent:'NONE',presenterVisible:false,cameraZone:'COMPONENT',cameraMotivation:'The flow reaches the stated component',focusEntityId:tgt.entityId,label:tgt.label,operations:[...(p&&flowing.has(p.entityId)?[{operation:'FLOW' as const,target:p.entityId,parameters:{path:p.path,from:1,to:1,direction:'FORWARD',speed:1,amount:0.85},startOffset:0,endOffset:1,observed:'SUSTAINED_STEP' as const}]:[]),{operation:'HIGHLIGHT',target:tgt.entityId,parameters:{amount:0.2},startOffset:0,endOffset:1}],proof:{level:p&&p.relationIds.includes(cid)?'DIRECT':'SYMBOLIC',rationale:'Flow arrives at the component; the component is an abstract housing with vanes'},weight:1}];}
    const from=fill[tgt.entityId],to=Math.min(0.9,+(from+0.3).toFixed(2)),p=feeding(tgt),out:Draft[]=[];fill[tgt.entityId]=to;
    // A feeding path is animated here only when this clause names it; otherwise the arrival alone is shown.
    if(p&&!flowing.has(p.entityId)&&p.relationIds.includes(cid))out.push(flowDraft(cid,base,p,'DIRECT','The fluid travels toward the stated destination',1.1));
    out.push({...base,grounding:'FACTUAL_DEMONSTRATION',visualIntent:'ARRIVAL',presenterIntent:'NONE',presenterVisible:false,cameraZone:'RESULT',cameraMotivation:'New state at the stated destination',focusEntityId:tgt.entityId,label:null,operations:to>from?[{operation:'INCREASE',target:tgt.entityId,parameters:{parameter:'fillLevel',from,to},startOffset:0.1,endOffset:0.9}]:[],proof:to>from?{level:'DIRECT',rationale:'The destination receives the fluid (its level rises)'}:{level:'SYMBOLIC',rationale:'Destination already full; shown, not changed'},weight:1,apply:b=>[change(b,tgt.entityId,'INCREASE','fillLevel',to,cid,null)]});
    return out;}
   case 'SPIN':{const r=tgt&&tgt.assembly==='ROTOR'?tgt:rotorW;if(!r){gaps.push({relationId:cid,predicate:claim.predicate,reason:'No rotating entity to show rotation'});return[];}
    const on=spinning.has(r.entityId)&&r.initiallyVisible,partial=claim.predicate!=='ROTATE',inferred=!r.relationIds.includes(cid);spinning.add(r.entityId);
    const op:BeatOperation=on?{operation:'ROTATE',target:r.entityId,parameters:{},startOffset:0,endOffset:1,observed:'SUSTAINED_STEP'}:r.initiallyVisible?{operation:'ROTATE',target:r.entityId,parameters:{from:[0,0,0],to:[0,0,+(spinRate*(input.totalFrames-t0(base.sentenceId!))).toFixed(4)]},startOffset:0.05,endOffset:1,sustain:true}
     // A beat-local part only spins while it is on screen (no sustained step after it leaves).
     :{operation:'ROTATE',target:r.entityId,parameters:{from:[0,0,0],to:[0,0,+(spinRate*input.fps*2.5).toFixed(4)]},startOffset:0.05,endOffset:0.95};
    const out:Draft[]=[];
    const driver=a.entityIds[1]?visualOf(a.entityIds[1]):null;
    if(driver&&driver!==r&&driver.entityId!==r.entityId)out.push(editorialFocus(driver,'DRIVER_FOCUS','COMPONENT','Show what drives the rotation'));
    out.push({...base,grounding:'FACTUAL_DEMONSTRATION',visualIntent:'ROTATION',presenterIntent:'NONE',presenterVisible:false,cameraZone:'COMPONENT',cameraMotivation:'The rotating part turns',focusEntityId:r.entityId,label:null,operations:[op],proof:inferred?{level:'SYMBOLIC',rationale:'Rotation named by a cue word is illustrated on the rotating part the script names elsewhere (system-inferred link)'}:{level:partial?'PARTIAL':'DIRECT',rationale:partial?'Rotation of the stated part is shown; the energy transfer itself is not drawn':'The stated part rotates'},weight:1.2,apply:b=>[change(b,r.entityId,'ROTATE','spin',1,cid,null)]});
    return out;}
   case 'OPEN':case 'CLOSE':{const gt=lidOf(tgt);if(!gt){gaps.push({relationId:cid,predicate:claim.predicate,reason:'No gate entity'});return[];}
    const to=a.action==='OPEN'?1:0,from=Number(state[gt.entityId].openness);if(from===to)return[];
    const ang=(v:number):Vec3=>gateAngle(gt,v);
    // Two straight segments that clear the rim: closing = rise beside the vessel, then over and down; opening = the reverse.
    if(gt.assembly==='LID'){const moving=[gt],ops2:BeatOperation[]=moving.flatMap(e=>{const p0=at[e.entityId],rest:Vec3=r3([restX(e),restY[e.entityId],p0[2]]),side=sidePose(gt,e),high:Vec3=r3([side[0],restY[e.entityId]+0.7,p0[2]]),p1=to?side:rest;at[e.entityId]=p1;
     return[{operation:'MOVE' as const,target:e.entityId,parameters:{from:[...p0],to:high},startOffset:0.05,endOffset:0.42},{operation:'MOVE' as const,target:e.entityId,parameters:{from:high,to:p1},startOffset:0.46,endOffset:0.88}];});
     return[{...base,grounding:'FACTUAL_DEMONSTRATION',visualIntent:a.action==='OPEN'?'OPENING':'CLOSING',presenterIntent:'NONE',presenterVisible:false,cameraZone:'COMPONENT',cameraMotivation:'The lid '+(to?'lifts':'closes'),focusEntityId:gt.entityId,label:null,operations:ops2,proof:{level:gt.relationIds.includes(cid)?'DIRECT':'SYMBOLIC',rationale:'The lid visibly '+(to?'lifts off':'comes down onto')+' the vessel'},weight:1,apply:b=>[change(b,gt.entityId,'MOVE','openness',to,cid,null)]}];}
    return[{...base,grounding:'FACTUAL_DEMONSTRATION',visualIntent:a.action==='OPEN'?'OPENING':'CLOSING',presenterIntent:'NONE',presenterVisible:false,cameraZone:'COMPONENT',cameraMotivation:'The stated part changes state',focusEntityId:gt.entityId,label:null,operations:[{operation:'ROTATE',target:gt.entityId,parameters:{from:ang(from),to:ang(to)},startOffset:0.1,endOffset:0.8}],proof:{level:gt.relationIds.includes(cid)?'DIRECT':'SYMBOLIC',rationale:'The part visibly opens/closes'},weight:1,apply:b=>[change(b,gt.entityId,'ROTATE','openness',to,cid,null)]}];}
   case 'SET_STATE':{if(!tgt)return[];const v=a.state==='OPEN'?1:a.state==='CLOSED'?0:null;
    if(v!==null&&!transitions.some(x=>x.entityId===tgt.entityId)&&!tgt.initialStateFrom){tgt.initialStateFrom=cid;tgt.rotation=[0,v*1.25,0];state[tgt.entityId].openness=v;
     return[{...base,grounding:'FACTUAL_DEMONSTRATION',visualIntent:'STATE_SHOWN',presenterIntent:'POINT_TO_COMPONENT',presenterVisible:true,cameraZone:'COMPONENT',cameraMotivation:'Show the stated initial state',focusEntityId:tgt.entityId,label:null,operations:[{operation:'ROTATE',target:tgt.entityId,parameters:{},startOffset:0,endOffset:1,observed:'INITIAL_STATE'}],proof:{level:'DIRECT',rationale:'The part is shown in the stated state'},weight:1}];}
    return[{...base,grounding:'FACTUAL_DEMONSTRATION',visualIntent:'STATE_NAMED',presenterIntent:'OBSERVE_SYSTEM',presenterVisible:true,cameraZone:'COMPONENT',cameraMotivation:'Hold the part whose state is named',focusEntityId:tgt.entityId,label:null,operations:ops({operation:'HIGHLIGHT',target:tgt.entityId,parameters:{amount:0.15}}),proof:{level:'SYMBOLIC',rationale:'State named; no visual state model for it'},weight:1}];}
   case 'MOVE_VERTICAL':{if(!tgt||tgt.kind==='PATH')return[];
    // Up/down as the script states; bounded around the part's resting height (staging amplitude, not a measure).
    const p0=at[tgt.entityId],base=restY[tgt.entityId]??tgt.position[1],from=p0[1],travel=tgt.parentId?Math.min(.12,tgt.size[1]*.35):.35,to=+Math.max(base-travel,Math.min(base+travel,from+(a.state==='UP'?travel:-travel))).toFixed(3);if(to===from)return[];const p1:Vec3=[p0[0],to,p0[2]];at[tgt.entityId]=p1;
    return[{...base0(),grounding:'FACTUAL_DEMONSTRATION',visualIntent:a.state==='UP'?'RISING':'FALLING',presenterIntent:'NONE',presenterVisible:false,cameraZone:'COMPONENT',cameraMotivation:'The stated part moves '+(a.state==='UP'?'up':'down'),focusEntityId:tgt.entityId,label:null,operations:[{operation:'MOVE',target:tgt.entityId,parameters:{from:[...p0],to:p1},startOffset:0.1,endOffset:0.85}],proof:{level:'DIRECT',rationale:'The stated part visibly moves '+(a.state==='UP'?'up':'down')},weight:1,apply:b=>[change(b,tgt.entityId,'MOVE','y',to,cid,null)]}];}
   case 'LEVEL':{if(!tgt||(tgt.assembly!=='OPEN_BASIN'&&tgt.assembly!=='VESSEL'))return[];const from=fill[tgt.entityId],to=+Math.max(0,Math.min(0.9,from+(a.state==='UP'?0.3:-0.3))).toFixed(2);if(to===from)return[];fill[tgt.entityId]=to;
    return[{...base0(),grounding:'FACTUAL_DEMONSTRATION',visualIntent:a.state==='UP'?'LEVEL_RISES':'LEVEL_FALLS',presenterIntent:'NONE',presenterVisible:false,cameraZone:'RESULT',cameraMotivation:'The stated level changes',focusEntityId:tgt.entityId,label:null,operations:[{operation:a.state==='UP'?'INCREASE':'DECREASE',target:tgt.entityId,parameters:{parameter:'fillLevel',from,to},startOffset:0.1,endOffset:0.9}],proof:{level:'DIRECT',rationale:'The level inside the stated container visibly changes'},weight:1,apply:b=>[change(b,tgt.entityId,a.state==='UP'?'INCREASE':'DECREASE','fillLevel',to,cid,null)]}];}
   case 'MOVE':{if(!tgt||tgt.kind==='PATH')return[];const p0=at[tgt.entityId],to=+(p0[0]+1.2).toFixed(3),p1:Vec3=[to,p0[1],p0[2]];at[tgt.entityId]=p1;
    return[{...base,grounding:'FACTUAL_DEMONSTRATION',visualIntent:'MOVEMENT',presenterIntent:'NONE',presenterVisible:false,cameraZone:'ACTION',cameraMotivation:'Follow the stated movement',focusEntityId:tgt.entityId,label:null,operations:[{operation:'MOVE',target:tgt.entityId,parameters:{from:[...p0],to:p1},startOffset:0.1,endOffset:0.9}],proof:{level:'DIRECT',rationale:'The stated body moves'},weight:1,apply:b=>[change(b,tgt.entityId,'MOVE','x',to,cid,null)]}];}
   case 'ACTIVATE':case 'DEACTIVATE':{if(tgt?.assembly==='MACHINE_UNIT'){const m=tgt,from=activity[m.entityId],to=a.action==='ACTIVATE'?1:0;if(from===to)return[];activity[m.entityId]=to;
     // Cause → effect: a stated controller switches first (its indicator), then the controlled part changes.
     const ctlId=forms.find(f=>f.controls===m.entityId)?.entityId,ctl=ctlId?entities.find(e=>e.entityId===ctlId):undefined,cf=ctl?activity[ctl.entityId]:to,ctlOps:BeatOperation[]=ctl&&cf!==to?[{operation:to?'INCREASE':'DECREASE',target:ctl.entityId,parameters:{parameter:'activity',from:cf,to},startOffset:0.1,endOffset:0.24}]:[];if(ctlOps.length)activity[ctl!.entityId]=to;
     return[{...base,grounding:'FACTUAL_DEMONSTRATION',visualIntent:to?'TURNS_ON':'TURNS_OFF',presenterIntent:'NONE',presenterVisible:false,cameraZone:'COMPONENT',cameraMotivation:'Before and after: '+(ctlOps.length?'the controller switches, then ':'')+'the stated part '+(to?'starts':'stops')+' running',focusEntityId:m.entityId,label:null,operations:[...ctlOps,{operation:to?'INCREASE':'DECREASE',target:m.entityId,parameters:{parameter:'activity',from,to},startOffset:0.3,endOffset:0.6}],proof:{level:m.relationIds.includes(cid)?'DIRECT':'SYMBOLIC',rationale:'The stated part visibly '+(to?'starts':'stops')+' running and stays so'+(ctlOps.length?' (after its stated controller switches)':'')},weight:1,apply:b=>[...(ctlOps.length?[change(b,ctl!.entityId,to?'INCREASE':'DECREASE','activity',to,cid,null)]:[]),change(b,m.entityId,to?'INCREASE':'DECREASE','activity',to,cid,null)]}];}
    const cool=a.cue==='COOL',e=cool?(tgt&&tgt.assembly==='VESSEL'?tgt:entities.find(x=>x.assembly==='VESSEL')??null):tgt?.assembly==='FLAME'?tgt:entities.find(x=>x.assembly==='FLAME')??null;if(!e)return[];
    const from=activity[e.entityId],to=a.action==='ACTIVATE'?1:0;if(from===to)return[];activity[e.entityId]=to;
    return[{...base,grounding:'FACTUAL_DEMONSTRATION',visualIntent:to?'TURNS_ON':'TURNS_OFF',presenterIntent:'NONE',presenterVisible:false,cameraZone:'COMPONENT',cameraMotivation:'The stated part changes activity',focusEntityId:e.entityId,label:null,operations:[{operation:to?'INCREASE':'DECREASE',target:e.entityId,parameters:{parameter:'activity',from,to},startOffset:0.1,endOffset:0.6}],proof:{level:e.relationIds.includes(cid)?'DIRECT':'SYMBOLIC',rationale:'The stated change is visible on the part (flame/boiling on or off)'},weight:1,apply:b=>[change(b,e.entityId,to?'INCREASE':'DECREASE','activity',to,cid,null)]}];}
   case 'BOIL':{const tint=!entities.some(x=>x.assembly==='VESSEL')?entities.find(x=>x.assembly==='STATE_TINT'&&x.relationIds.includes(cid)):null;
    if(tint){const enc=layout.enclosure!,openNow=activity[enc.entityId]<1,param=claim.predicate==='BECOME'?'fillLevel':'activity',from=param==='fillLevel'?Number(state[tint.entityId].fillLevel):activity[tint.entityId];if(param==='activity')activity[tint.entityId]=1;if(openNow)activity[enc.entityId]=1;
     const shown=revealed.has(tint.entityId);revealed.add(tint.entityId);
     const o:BeatOperation[]=[...(openNow?[{operation:'INCREASE' as const,target:enc.entityId,parameters:{parameter:'activity',from:0,to:1},startOffset:0,endOffset:0.25}]:[]),...(shown?[]:[{operation:'REVEAL' as const,target:tint.entityId,parameters:{},startOffset:0.2,endOffset:0.26}]),{operation:'INCREASE',target:tint.entityId,parameters:{parameter:param,from,to:1},startOffset:0.3,endOffset:0.9}];
     return[{...base,grounding:'FACTUAL_DEMONSTRATION',visualIntent:param==='fillLevel'?'STATE_CHANGE_INSIDE':'CUTAWAY_TRANSITION',presenterIntent:'NONE',presenterVisible:false,cameraZone:'CUTAWAY',cameraMotivation:'Look inside: the material in the enclosed path changes state',focusEntityId:tint.entityId,label:null,operations:o,proof:{level:'PARTIAL',rationale:'The state of the material is shown inside the open section (representation of the stated change)'},weight:1.1,
      apply:b=>[...(openNow?[change(b,enc.entityId,'INCREASE','activity',1,null,'Section view opens to show the inside')]:[]),...(shown?[]:[change(b,tint.entityId,'REVEAL',null,true,null,'State representation appears where the change happens')]),change(b,tint.entityId,'INCREASE',param,1,cid,null)]}];}
    const e=entities.find(x=>x.assembly==='VESSEL');if(!e){gaps.push({relationId:cid,predicate:claim.predicate,reason:'No vessel to show boiling'});return[];}
    const from=activity[e.entityId];if(from>=1)return[{...base,grounding:'FACTUAL_DEMONSTRATION',visualIntent:'STILL_BOILING',presenterIntent:'NONE',presenterVisible:false,cameraZone:'COMPONENT',cameraMotivation:'The liquid keeps boiling',focusEntityId:e.entityId,label:null,operations:ops({operation:'HIGHLIGHT',target:e.entityId,parameters:{amount:0.1}}),proof:{level:'SYMBOLIC',rationale:'Boiling already shown; this clause adds a non-visual qualifier'},weight:0.8}];activity[e.entityId]=1;
    return[{...base,grounding:'FACTUAL_DEMONSTRATION',visualIntent:'BOILING',presenterIntent:'NONE',presenterVisible:false,cameraZone:'COMPONENT',cameraMotivation:'The liquid starts to boil',focusEntityId:e.entityId,label:null,operations:[{operation:'INCREASE',target:e.entityId,parameters:{parameter:'activity',from,to:1},startOffset:0.1,endOffset:0.5}],proof:{level:'PARTIAL',rationale:'Bubbles rise in the liquid (section view of the vessel); the vessel is the only liquid holder shown'},weight:1,apply:b=>[change(b,e.entityId,'INCREASE','activity',1,cid,null)]}];}
   case 'PUFF':{const e=tgt?.assembly==='STEAM_PLUME'?tgt:entities.find(x=>x.assembly==='STEAM_PLUME')??null;if(!e){gaps.push({relationId:cid,predicate:claim.predicate,reason:'No steam to show'});return[];}
    const from=activity[e.entityId];activity[e.entityId]=0;
    return[{...base,grounding:'FACTUAL_DEMONSTRATION',visualIntent:'STEAM_ESCAPES',presenterIntent:'NONE',presenterVisible:false,cameraZone:'COMPONENT',cameraMotivation:'Steam escapes at the vent',focusEntityId:e.entityId,label:null,operations:[...(from<1?[{operation:'INCREASE' as const,target:e.entityId,parameters:{parameter:'activity',from,to:1},startOffset:0.05,endOffset:0.3}]:[]),{operation:'DECREASE',target:e.entityId,parameters:{parameter:'activity',from:1,to:0},startOffset:0.7,endOffset:0.95}],proof:{level:e.relationIds.includes(cid)?'DIRECT':'SYMBOLIC',rationale:'A puff of steam leaves through the vent and fades'},weight:1.1,apply:b=>[change(b,e.entityId,'INCREASE','activity',1,cid,null),change(b,e.entityId,'DECREASE','activity',0,cid,null)]}];}
   case 'IDENTIFY':{const target=tgt?layout.assemblyTargets[tgt.entityId]:undefined;
    if(tgt&&target&&!revealed.has(tgt.entityId)){revealed.add(tgt.entityId);const p0=at[tgt.entityId];at[tgt.entityId]=target;
     return[{...base,grounding:'FACTUAL_DEMONSTRATION',visualIntent:'PART_JOINS_SYSTEM',presenterIntent:'NONE',presenterVisible:false,cameraZone:'ACTION',cameraMotivation:'A new part joins the system where it acts',focusEntityId:tgt.entityId,label:tgt.label,operations:[{operation:'REVEAL',target:tgt.entityId,parameters:{},startOffset:0,endOffset:0.05},{operation:'MOVE',target:tgt.entityId,parameters:{from:[...p0],to:target},startOffset:0.08,endOffset:0.6}],proof:{level:'SYMBOLIC',rationale:'The named part is assembled into the system; its stated role is not drawn'},weight:0.9,
      apply:b=>[change(b,tgt.entityId,'REVEAL',null,true,null,'Part joins the persistent system'),change(b,tgt.entityId,'MOVE','y',target[1],cid,null)]}];}
    const e=tgt?.assembly==='STEAM_PLUME'?(entities.find(x=>x.assembly==='VESSEL')??tgt):tgt??mainW;return[{...base,grounding:'FACTUAL_DEMONSTRATION',visualIntent:'SYSTEM_IDENTITY',presenterIntent:'OBSERVE_SYSTEM',presenterVisible:true,cameraZone:'SYSTEM',cameraMotivation:'Name the system that stays in view',focusEntityId:e.entityId,label:e.label,operations:ops({operation:'HIGHLIGHT',target:e.entityId,parameters:{amount:0.2}}),proof:{level:'SYMBOLIC',rationale:'Abstract representation named with the script term'},weight:0.9}];}
   case 'TRANSFER':case 'HIGHLIGHT_CAUSE':case 'NAME_ONLY':default:{const e=tgt??mainW;if(a.action==='NAME_ONLY')gaps.push({relationId:cid,predicate:claim.predicate,reason:a.cue==='CONDITIONAL'?'Conditional statement: named, not shown as a real state change':'No generic visual operation for '+claim.predicate});
    return[{...base,grounding:'FACTUAL_DEMONSTRATION',visualIntent:'RELATION_NAMED',presenterIntent:'OBSERVE_SYSTEM',presenterVisible:true,cameraZone:'SYSTEM',cameraMotivation:'Hold the participant while the relation is narrated',focusEntityId:e.entityId,label:null,operations:ops({operation:'HIGHLIGHT',target:e.entityId,parameters:{amount:0.18}}),proof:{level:a.action==='NAME_ONLY'?'NONE':'SYMBOLIC',rationale:'Participant highlighted; the relation itself is not drawn'},weight:1}];}
  }
 }
 function t0(sentenceId:string){return timing(sentenceId).startFrame;}
 /** For every admitted mechanism relation: its physical/material participants, and which of them the video draws. */
 function participantsDrawn(){const f=(x:string)=>x.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(),sg=(x:string)=>f(x).replace(/(?:oes|aes)$/,'ao').replace(/s$/,'');
  const heads=(e:WorldEntity)=>(e.scriptEntityIds??[]).flatMap(id=>u.entities.find(x=>x.id===id)?.heads??[]).concat(e.label?[e.label.split(/\s+/)[0]]:[]).concat(e.entityId.startsWith('part_')?[e.entityId.slice(5)]:[]).map(sg);
  return(u.mechanism??[]).filter(m=>known.has(m.id)&&!m.negated&&m.modality!=='POSSIBLE').map(m=>{const ps=[m.subject,m.object,m.source,m.destination,m.path,m.quantity,m.propertyOwner].filter((x):x is NonNullable<typeof x>=>Boolean(x?.head&&['PHYSICAL_ENTITY','COMPONENT','MATERIAL','QUANTITY'].includes(x.category??'')));
   const uniq=[...new Map(ps.map(p=>[sg(p.head!),p])).values()];const moved=beats.some(b=>b.relationIds.includes(m.id)&&b.operations.some(o=>!o.observed&&['FLOW','INCREASE','DECREASE'].includes(o.operation)));
   // An opening or a surface is drawn by its boundary (a perforated wall, the wall the content presses on).
   const byBoundary=(h:string)=>Boolean(phys&&(phys.model.roles[h]??[]).some(r=>r==='OPENING'||r==='SURFACE')&&entities.some(e=>e.relationIds.includes(m.id)&&(e.variant==='PERFORATED'||e.assembly==='ROTATING_CONTAINER')));
   const drawn=uniq.filter(p=>p.category==='MATERIAL'||p.category==='QUANTITY'?moved:entities.some(e=>e.role!=='CONTEXT_PROP'&&heads(e).includes(sg(p.head!)))||byBoundary(sg(p.head!))).map(p=>sg(p.head!));
   return{relationId:m.id,participants:uniq.map(p=>sg(p.head!)),drawn};});}
 function isQuestion(s:{text:string}){return /\?\s*$/.test(s.text);}
 /** Editorial paths that only replay relations the script already stated (EDITORIAL grounding, no relation cited):
  *  - anticipation: a question asked right after a quantity was absorbed by the circulating material, and answered by a
  *    part on the closed circuit, shows that quantity starting along the circuit toward the part (destination revealed next);
  *  - recap: the final editorial sentence replays the stated chain — absorbed inside → circuit → exchange place → out. */
 function planEditorialPaths():{anticipation?:{sentenceId:string;entity:WorldEntity};recap?:{sentenceId:string;entity:WorldEntity}}{
  const out:{anticipation?:{sentenceId:string;entity:WorldEntity};recap?:{sentenceId:string;entity:WorldEntity}}={},enc=layout.enclosure,pipe=entities.find(e=>e.entityId===layout.circuit);
  if(!enc||!pipe?.path)return out;
  const dist=(a:Vec3,b:Vec3)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),lemma=(c:typeof mech.carriers[number])=>(u.mechanism??[]).find(m=>m.id===c.relationId)?.lemma;
  const pathOf=(c:typeof mech.carriers[number])=>entities.find(e=>e.entityId===c.entityId)?.path;
  const absorb=mech.carriers.find(c=>lemma(c)==='ABSORB'),release=mech.carriers.find(c=>lemma(c)==='RELEASE')??mech.carriers.find(c=>lemma(c)==='SEND'),circ=pipe.path;
  // At most DEMONSTRATION_LIMITS.pathPoints points: drop the interior point closest to its predecessor until it fits.
  const thin=(pts:Vec3[])=>{const p=pts.filter((q,i)=>i===0||dist(q,pts[i-1])>0.05);while(p.length>DEMONSTRATION_LIMITS.pathPoints){let k=1;for(let i=2;i<p.length-1;i++)if(dist(p[i],p[i-1])<dist(p[k],p[k-1]))k=i;p.splice(k,1);}return p;};
  const mk=(id:string,pts:Vec3[]):WorldEntity=>({entityId:id,worldId,role:'SYSTEM_COMPONENT',grounding:'EDITORIAL',abstraction:'EDITORIAL_CONTEXT_FROM_SENTENCE',relationIds:[],participant:null,label:null,scriptEntityIds:[],kind:'PATH',assembly:'TRANSFER_PATH',variant:'THERMAL',size:[0.08,0.08,0.08],position:[0,0,0],path:thin(pts).map(r3),rotation:[0,0,0],color:'#ff8a2a',initiallyVisible:false,initial:{connection:1,flowProgress:0}});
  const sents=input.sentences;
  sents.forEach((s,i)=>{if(out.anticipation||s.kind!=='EDITORIAL'||!isQuestion(s)||!absorb||sents[i-1]?.id!==absorb.sentenceId||!sents[i+1])return;const next=sents[i+1];
   const part=Object.entries(layout.assemblyTargets).find(([id])=>{const e=entities.find(x=>x.entityId===id);return e&&e.kind!=='PATH'&&e.relationIds.some(r=>next.relationIds.includes(r));});if(!part)return;
   const k=circ.reduce((b,q,j)=>dist(q,part[1])<dist(circ[b],part[1])?j:b,0);if(k<1)return;out.anticipation={sentenceId:s.id,entity:mk('anticipation_'+s.id.toLowerCase(),circ.slice(0,k+1))};});
  const last=sents.at(-1)!,place=release?entities.find(e=>e.entityId===release.cameraTarget&&e!==enc):undefined;
  if(last.kind==='EDITORIAL'&&!isQuestion(last)&&absorb&&release){const a=pathOf(absorb),r=pathOf(release);
   // The circuit point where the material reaches the exchange place (on its surface), else the one nearest the release.
   const at=place?circ.findIndex((q,j)=>j>0&&[0,1].every(i=>Math.abs(q[i]-place.position[i])<=place.size[i]/2+0.3)&&Math.abs(q[2]-place.position[2])<0.2):-1,k=at>0?at:r?circ.reduce((b,q,j)=>dist(q,r[0])<dist(circ[b],r[0])?j:b,0):-1;
   if(a&&r&&k>=1)out.recap={sentenceId:last.id,entity:mk('recap_'+last.id.toLowerCase(),[a[0],...circ.slice(0,k+1),...r])};}
  return out;
 }
 // Spatial mechanism map: parts in the object's frame (anchor = offset from its centre), with the routes that enter/leave them.
 function spatialMap(enc:WorldEntity){const near=(p:Vec3,e:WorldEntity)=>{const c=layout.assemblyTargets[e.entityId]??e.position;return[0,1,2].every(i=>Math.abs(p[i]-c[i])<=e.size[i]/2+0.35);};
  const routes=entities.filter(e=>e.kind==='PATH');
  // Paths that are parts of the object's interior (e.g. a coil inside) are parts too; other paths are routes.
  const parts=entities.filter(e=>e!==enc&&(e.kind!=='PATH'||layout.inside.includes(e.entityId))&&!['INTERIOR_ROOM','STATE_TINT'].includes(e.assembly??'')&&e.role!=='CONTEXT_PROP').map(e=>{const c=e.kind==='PATH'?e.path![Math.floor(e.path!.length/2)]:layout.assemblyTargets[e.entityId]??e.position,rel=c.map((v,i)=>v-enc.position[i]) as Vec3,inside=rel.every((v,i)=>Math.abs(v)<=enc.size[i]/2),back=rel[2]<-enc.size[2]/2;
   const rin=routes.filter(r=>near(r.path!.at(-1)!,e)).map(r=>r.entityId),rout=routes.filter(r=>near(r.path![0],e)).map(r=>r.entityId);
   return{entityId:e.entityId,label:e.label??null,region:(inside?'INSIDE':back?(rel[1]<-enc.size[1]*0.25?'REAR_LOW':'BEHIND'):'OUTSIDE') as 'INSIDE'|'BEHIND'|'REAR_LOW'|'OUTSIDE',anchor:r3(rel),connected:[...new Set([...rin,...rout])],routeIn:rin,routeOut:rout,initiallyVisible:e.initiallyVisible};});
  return{object:enc.entityId,features:enc.variant==='DOOR_FRONT'?['BODY_SHELL','DOOR','HANDLE','HINGE','BASE','VENT','SUPPORT']:['BODY_SHELL'],parts};}
 // Physical draft (containment class): the housing opens first when the parts are inside it; then the stated change.
 function physicalDraft(p:PhysicalCarrier,base:Pick<CausalVisualBeat,'sentenceId'|'storyNodeIds'|'relationIds'|'evidenceIds'>):Draft{
  const enc=layout.enclosure,opens=Boolean(enc&&activity[enc.entityId]<1&&p.focus!==enc.entityId);if(opens)activity[enc!.entityId]=1;
  const shift=(o:BeatOperation):BeatOperation=>opens&&!o.observed&&o.operation!=='HIGHLIGHT'?{...o,startOffset:+(0.22+o.startOffset*0.78).toFixed(3),endOffset:+(0.22+o.endOffset*0.78).toFixed(3)}:o;
  for(const o of p.ops)if(o.operation==='MOVE'&&!o.observed&&Array.isArray(o.parameters.to))at[o.target]=[...(o.parameters.to as Vec3)] as Vec3;
  return{...base,grounding:'FACTUAL_DEMONSTRATION',visualIntent:p.intent,presenterIntent:'NONE',presenterVisible:false,cameraZone:p.zone,cameraMotivation:'Show '+p.rationale,focusEntityId:p.focus,label:null,
   operations:[...(opens?[{operation:'INCREASE' as const,target:enc!.entityId,parameters:{parameter:'activity',from:0,to:1},startOffset:0,endOffset:0.2}]:[]),...p.ops.map(shift)],proof:{level:p.level,rationale:p.rationale},weight:opens?1.3:1,
   apply:b=>[...(opens?[change(b,enc!.entityId,'INCREASE','activity',1,null,'Section opens to show the parts inside')]:[]),...p.changes.map(c=>change(b,c.entityId,c.operation as VisualStateTransition['operation'],c.parameter,c.to,c.reason?null:p.relationId,c.reason))]};}
 // Carrier draft: the carrier appears where the relation happens, then shows its change (flow along the route, or state/property).
 function carrierDraft(c:typeof mech.carriers[number],base:Pick<CausalVisualBeat,'sentenceId'|'storyNodeIds'|'relationIds'|'evidenceIds'>):Draft{
  const e=entities.find(x=>x.entityId===c.entityId)!,shown=revealed.has(e.entityId);revealed.add(e.entityId);
  // A relation that starts inside a closed housing is seen through its section: the section opens before the action.
  const enc=layout.enclosure,inBox=(p:Vec3)=>enc?[0,1,2].every(i=>Math.abs(p[i]-enc.position[i])<=enc.size[i]/2):false,opens=Boolean(enc&&activity[enc.entityId]<1&&(e.path??[e.position]).some(inBox));if(opens)activity[enc!.entityId]=1;
  const from=c.parameter==='flowProgress'?0:c.parameter==='activity'?activity[e.entityId]:Number(state[e.entityId].fillLevel);if(c.parameter==='activity')activity[e.entityId]=c.to;
  // Before → action → after: the carrier is seen still, then acts, and its new state stays on screen for the last quarter of the beat.
  const op:BeatOperation=c.operation==='FLOW'?{operation:'FLOW',target:e.entityId,parameters:{path:e.path,from:0,to:1,direction:'FORWARD',speed:1,amount:e.initial?.amount??1},startOffset:0.15,endOffset:0.72}:{operation:c.operation,target:e.entityId,parameters:{parameter:c.parameter,from,to:c.to},startOffset:0.15,endOffset:0.7};
  return{...base,grounding:'FACTUAL_DEMONSTRATION',visualIntent:'MECHANISM_'+c.action.split(' ')[0].toUpperCase(),presenterIntent:'NONE',presenterVisible:false,cameraZone:c.zone,cameraMotivation:'Show '+c.observableChange,focusEntityId:c.cameraTarget,label:null,
   operations:[...(opens?[{operation:'INCREASE' as const,target:enc!.entityId,parameters:{parameter:'activity',from:0,to:1},startOffset:0,endOffset:0.2}]:[]),...(shown?[]:[{operation:'REVEAL' as const,target:e.entityId,parameters:{},startOffset:opens?0.22:0.05,endOffset:opens?0.26:0.1}]),opens?{...op,startOffset:0.3,endOffset:0.75}:op],proof:{level:c.supportLevel,rationale:c.observableChange},weight:opens?1.3:1,
   apply:b=>[...(opens?[change(b,enc!.entityId,'INCREASE','activity',1,null,'Section opens before the action inside')]:[]),...(shown?[]:[change(b,e.entityId,'REVEAL',null,true,null,'Carrier appears where the relation happens')]),change(b,e.entityId,c.operation==='FLOW'?'FLOW':c.operation,c.parameter,c.to,c.relationId,null)]};}
 beats.sort((a,b)=>a.startFrame-b.startFrame);beats.forEach((b,i)=>b.order=i);
 for(const b of beats){const i=b.sentenceId?sIndex(b.sentenceId):-1;if(episodes.some(ep=>ep.start<=i&&i<ep.rewind))b.hypothetical=true;}
 // Beat-local lifecycle: revealed at the first beat of its window, hidden after the last one (editorial transitions).
 for(const w of entities.filter(e=>!e.initiallyVisible&&!carrierIds.has(e.entityId)&&!layout.tints.includes(e.entityId)&&!(e.entityId in layout.assemblyTargets))){const [a0,a1]=windowOf(w),inWin=beats.filter(b=>b.sentenceId&&segOrder.get(b.sentenceId)!>=a0&&segOrder.get(b.sentenceId)!<=a1);if(!inWin.length)continue;
  const first=inWin[0],lastB=inWin.at(-1)!;
  first.operations.unshift({operation:'REVEAL',target:w.entityId,parameters:{},startOffset:0,endOffset:0.04});const t1=change(first.id,w.entityId,'REVEAL',null,true,null,'Beat-local object enters for the segments that mention it');if(t1)first.transitionIds.push(t1);
  if(a1<u.segments.length-1&&!layout.persistAfterReveal.includes(w.entityId)){lastB.operations.push({operation:'HIDE',target:w.entityId,parameters:{},startOffset:0.96,endOffset:1});const t2=change(lastB.id,w.entityId,'HIDE',null,false,null,'Beat-local object leaves after its last segment');if(t2)lastB.transitionIds.push(t2);}}
 // Carrier lifecycle: a transfer is an event (gone when it ends); a state shown at a component stays until the material leaves it.
 for(const c of mech.carriers){const own=beats.find(b=>b.operations.some(o=>o.target===c.entityId&&o.operation!=='REVEAL'));if(!own)continue;
  if(c.operation==='FLOW'||c.atEntityId===layout.enclosure?.entityId){own.operations.push({operation:'HIDE',target:c.entityId,parameters:{},startOffset:0.95,endOffset:1});const tr=change(own.id,c.entityId,'HIDE',null,false,null,c.operation==='FLOW'?'The transfer event is over':'The interior state has been shown');if(tr)own.transitionIds.push(tr);continue;}
  const leave=mech.carriers.find(x=>x.fromEntityId&&x.fromEntityId===c.atEntityId),lb=leave?beats.find(b=>b.startFrame>=own.startFrame&&b!==own&&b.operations.some(o=>o.target===leave.entityId&&o.operation==='FLOW')):null;
  if(lb&&!lb.operations.some(o=>o.target===c.entityId&&o.operation==='HIDE')){lb.operations.push({operation:'HIDE',target:c.entityId,parameters:{},startOffset:0,endOffset:0.03});const tr=change(lb.id,c.entityId,'HIDE',null,false,null,'The material has left this component');if(tr)lb.transitionIds.push(tr);}}
 for(const d of dropped)for(const r of d.relationIds)gaps.push({relationId:r,predicate:u.claims.find(c=>c.id===r)?.predicate??'',reason:'Not drawn: simultaneous visual budget ('+budget+') reached in its segment'});
 // Repeated editorial holds on the same system shot alternate with the wide world view (variety, no new facts).
 for(let i=1;i<beats.length;i++){const p=beats[i-1],b=beats[i];if(b.grounding!=='FACTUAL_DEMONSTRATION'&&p.cameraZone==='SYSTEM'&&b.cameraZone==='SYSTEM'&&b.focusEntityId===p.focusEntityId&&!b.operations.length){b.cameraZone='WORLD';b.cameraMotivation='Wider view while the narration continues';}}
 // Consecutive beats on the same focus and zone: the second uses the alternate angle (variety without new facts).
 for(let i=1;i<beats.length;i++){const p=beats[i-1],b=beats[i];if(b.cameraZone===p.cameraZone&&b.focusEntityId===p.focusEntityId&&b.cameraZone==='COMPONENT'){if(b.focusEntityId===mainW.entityId||b.focusEntityId==='rotor'){b.cameraZone='CUTAWAY';b.cameraMotivation='Alternate angle on the same part: '+b.cameraMotivation;}else b.cameraVariant=1;}}
 // A focus filmed again in the same zone (not consecutively) gets an alternating azimuth.
 const seen=new Map<string,number>();for(const b of beats){if(!b.focusEntityId||b.cameraZone==='SYSTEM'||b.cameraZone==='WORLD'||b.cameraZone==='CUTAWAY'||b.cameraVariant)continue;const k=b.cameraZone+'|'+b.focusEntityId,c=seen.get(k)??0;if(c)b.cameraVariant=c%2?1:-1;seen.set(k,c+1);}
 // ---- Causal camera framing: source + route + destination + a piece of the parent housing, from a side that sees them ----
 // An attached part is placed in its parent's frame: its world position is the parent's plus its own.
 const finalPos=(e:WorldEntity):Vec3=>{const own=layout.assemblyTargets[e.entityId]??e.position,p=e.parentId?entities.find(x=>x.entityId===e.parentId):undefined;return p&&e.assembly==='CONTENT_ITEMS'?add3(own,layout.assemblyTargets[p.entityId]??p.position):own;};
 const boxPts=(e:WorldEntity):Vec3[]=>{const c=finalPos(e),h=e.size.map(v=>v/2);return[[c[0]-h[0],c[1]-h[1],c[2]-h[2]],[c[0]+h[0],c[1]+h[1],c[2]+h[2]]];};
 const enc0=layout.enclosure,located=new Set<string>(enc0?[enc0.entityId]:[]);
 for(const b of beats.filter(b=>b.grounding==='FACTUAL_DEMONSTRATION')){const ts=[...new Set(b.operations.filter(o=>!['HIGHLIGHT','HIDE'].includes(o.operation)).map(o=>o.target))].map(id=>entities.find(e=>e.entityId===id)).filter((e):e is WorldEntity=>Boolean(e&&e.assembly!=='INTERIOR_ROOM'));
  if(!ts.length||!enc0)continue;const onlyEnc=ts.every(t=>t===enc0||layout.inside.includes(t.entityId)||t.assembly==='STATE_TINT'&&[0,1,2].every(i=>Math.abs(t.position[i]-enc0.position[i])<=enc0.size[i]/2));
  if(onlyEnc&&b.cameraZone==='CUTAWAY')continue;
  const pts:Vec3[]=ts.flatMap(t=>t.kind==='PATH'?[t.path![0],t.path![Math.floor(t.path!.length/2)],t.path!.at(-1)!]:boxPts(t));
  // A containment demonstration is read against its container: the whole boundary (wall + openings) stays in frame.
  const holder=physIntents.has(b.visualIntent)?entities.find(e=>e.entityId===b.focusEntityId&&e!==enc0&&e.kind!=='PATH'):undefined;if(holder&&!ts.includes(holder))pts.push(...boxPts(holder));
  const behind=pts.some(p=>p[2]<enc0.position[2]-enc0.size[2]/2),cx=pts.reduce((a,p)=>a+p[0],0)/pts.length,side=cx>=enc0.position[0]?1:-1;
  // Location before action: the first time a part is shown, the whole parent object is in frame (where, then what);
  // afterwards the housing edge facing the action keeps the context. Views stay level-ish (no top-down, no roll).
  const first=ts.some(t=>t.kind!=='PATH'&&!located.has(t.entityId));ts.forEach(t=>located.add(t.entityId));
  const ex=enc0.position[0]+side*enc0.size[0]/2,ctx:Vec3[]=first?boxPts(enc0).concat([[enc0.position[0]-enc0.size[0]/2,enc0.position[1]+enc0.size[1]/2,enc0.position[2]+enc0.size[2]/2],[enc0.position[0]+enc0.size[0]/2,enc0.position[1]-enc0.size[1]/2,enc0.position[2]-enc0.size[2]/2]]):[[ex,enc0.position[1]+enc0.size[1]*0.45,enc0.position[2]],[ex,enc0.position[1]-enc0.size[1]*0.45,enc0.position[2]]];
  const main=ts.find(t=>t!==enc0&&t.kind!=='PATH')??ts[0];
  b.framing={points:[...pts,...ctx].map(r3),dir:behind?[side*1,0.45,-0.45]:[side*0.35,0.3,1],keyCount:pts.length,need:first?OCCUPANCY_THRESHOLDS.DETAIL:OCCUPANCY_THRESHOLDS[scaleOf(main)],
   // Line-of-sight keys: what the viewer must see — each part's centre and each route's start, middle and end.
   keys:ts.flatMap(t=>t.kind==='PATH'?[t.path![0],...(layout.inside.includes(t.entityId)?[]:[t.path![Math.floor(t.path!.length/2)]]),t.path!.at(-1)!]:[finalPos(t)]).map(r3)};
  // OBJECT → REGION → COMPONENT: a part's first appearance opens on the whole object, then pushes to the part and the housing edge next to it.
  const edge:Vec3[]=[[ex,enc0.position[1]+enc0.size[1]*0.45,enc0.position[2]],[ex,enc0.position[1]-enc0.size[1]*0.45,enc0.position[2]]];
  // (a beat that carries material along a route keeps the whole route in frame instead of pushing in on one part)
  const carriesRoute=ts.some(t=>t.kind==='PATH'&&b.operations.some(o=>o.target===t.entityId&&o.operation==='FLOW'&&!o.observed)&&physIntents.has(b.visualIntent));
  const fresh=carriesRoute?[]:ts.filter(t=>t.kind!=='PATH'&&t!==enc0&&t.assembly!=='STATE_TINT'&&first);if(fresh.length)b.framing.reveal=[...fresh.flatMap(t=>{const c=finalPos(t),h=t.size.map(v=>v/2+0.35);return[[c[0]-h[0],c[1]-h[1],c[2]-h[2]],[c[0]+h[0],c[1]+h[1],c[2]+h[2]]] as Vec3[];}),...edge].map(r3);
  // SOURCE → PATH → DESTINATION: a long route that leaves the housing is followed (same viewing side, so orientation is kept);
  // a short one is already continuous in a single framing that holds source, path and destination together.
  const route=ts.find(t=>t.kind==='PATH'&&!layout.inside.includes(t.entityId)&&b.operations.some(o=>o.target===t.entityId&&o.operation==='FLOW'&&!o.observed));
  const len=(p:Vec3[])=>p.slice(1).reduce((a,q,i)=>a+Math.hypot(q[0]-p[i][0],q[1]-p[i][1],q[2]-p[i][2]),0);
  if(route&&len(route.path!)>2.5){const p=route.path!,m=Math.floor(p.length/2);b.framing.track={from:[...p.slice(0,m+1),...near(p[0]),...edge].map(r3),to:[...p.slice(m),...near(p.at(-1)!),...edge].map(r3)};}}
 // Energy-flow beats (no housing to frame against): each part is framed where it is at that beat (moves applied in order).
 // Location before action: a part's first appearance opens on where it is, with the main object it belongs to, then pushes
 // in to the action. Around the action, a thing of the action's size stays whole and a larger one (a wall, a roof) only
 // where it meets the action, so a small part is never lost on a whole facade. A route from a far light source is framed
 // where it arrives (the source stays in the sky).
 if(energy){const where=new Map<string,Vec3>(),seenE=new Set<string>(),posE=(e:WorldEntity)=>where.get(e.entityId)??finalPos(e);
  const boxE=(e:WorldEntity,c:Vec3=posE(e)):Vec3[]=>{const h=e.size.map(v=>v/2);return[[c[0]-h[0],c[1]-h[1],c[2]-h[2]],[c[0]+h[0],c[1]+h[1],c[2]+h[2]]];};
  const anchor=Object.values(energy.entityIds).map(id=>entities.find(e=>e.entityId===id)).find(e=>e?.role==='MAIN_SYSTEM');
  const skies=entities.filter(e=>e.assembly==='RADIANT_SOURCE'),gap=(p:Vec3,q:Vec3)=>Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);
  const along=(p:Vec3[],f:number):Vec3=>{const ls=p.slice(1).map((q,i)=>gap(q,p[i])),T=ls.reduce((x,y)=>x+y,0);let d=f*T;for(let i=0;i<ls.length;i++){if(d<=ls[i]||i===ls.length-1){const k=ls[i]?Math.min(1,d/ls[i]):0;return p[i].map((v,j)=>v+(p[i+1][j]-v)*k) as Vec3;}d-=ls[i];}return p.at(-1)!;};
  const routePts=(t:WorldEntity):Vec3[]=>{const p=t.path!;return skies.some(e=>gap(p[0],posE(e))<Math.max(...e.size))?[along(p,0.6),along(p,0.8),p.at(-1)!]:[p[0],p[Math.floor(p.length/2)],p.at(-1)!];};
  for(const b of [...beats].sort((x,y)=>x.startFrame-y.startFrame)){
   if(b.grounding==='FACTUAL_DEMONSTRATION'&&!b.framing&&physIntents.has(b.visualIntent)){
    const ts=[...new Set(b.operations.filter(o=>!['HIGHLIGHT','HIDE','REVEAL'].includes(o.operation)).map(o=>o.target))].map(id=>entities.find(e=>e.entityId===id)).filter((e):e is WorldEntity=>Boolean(e&&e.assembly!=='RADIANT_SOURCE'));
    const focus=entities.find(e=>e.entityId===b.focusEntityId&&e.kind!=='PATH'&&e.assembly!=='RADIANT_SOURCE');
    const tight:Vec3[]=ts.flatMap(t=>t.kind==='PATH'?routePts(t):boxE(t));
    for(const o of b.operations)if(o.operation==='MOVE'&&!o.observed&&Array.isArray(o.parameters.to)){const e=entities.find(x=>x.entityId===o.target);if(e)tight.push(...boxE(e,o.parameters.to as Vec3));}
    if(focus&&!ts.includes(focus))tight.push(...boxE(focus));
    if(tight.length){
     const c0=tight.reduce((a,p)=>a.map((v,i)=>v+p[i]/tight.length) as Vec3,[0,0,0] as Vec3),R=Math.max(1.1,1.1*Math.max(...tight.flatMap(p=>p.map((v,i)=>Math.abs(v-c0[i])))));
     const ctx:Vec3[]=[];for(const e of entities){if(e.kind==='PATH'||['RADIANT_SOURCE','NEIGHBORHOOD','INTERIOR_ROOM','STATE_TINT'].includes(e.assembly??'')||ts.includes(e)||e===focus)continue;
      const [lo,hi]=boxE(e);if(![0,1,2].every(i=>lo[i]<=c0[i]+R&&hi[i]>=c0[i]-R))continue;
      // (the main object the action sits on is cropped around it; a neighbour is kept whole when it is not much larger)
      const on=e===anchor;
      if(Math.max(...e.size)<=(on?2:3)*R)ctx.push(lo,hi);else ctx.push(lo.map((v,i)=>Math.max(v,c0[i]-R)) as Vec3,hi.map((v,i)=>Math.min(v,c0[i]+R)) as Vec3);}
     const parts=[...ts,...(focus?[focus]:[])].filter(t=>t.kind!=='PATH'),fresh=parts.some(t=>!seenE.has(t.entityId));parts.forEach(t=>seenE.add(t.entityId));
     // The action stays at the centre of its own shot: the context box is made even on both sides of it (across the screen).
     const all=[...tight,...ctx],ex=[0,2].map(i=>Math.max(...all.map(p=>Math.abs(p[i]-c0[i])))),ys=all.map(p=>p[1]);
     const local=[...all,[c0[0]-ex[0],Math.min(...ys),c0[2]-ex[1]] as Vec3,[c0[0]+ex[0],Math.max(...ys),c0[2]+ex[1]] as Vec3].map(r3),wide=fresh&&anchor&&!parts.includes(anchor)?[...local,...boxE(anchor).map(r3)]:null;
     const keys=ts.flatMap(t=>t.kind==='PATH'?[routePts(t)[0],t.path!.at(-1)!]:[posE(t)]);
     // Light from a source in the sky: the camera looks across the rays (side-on, from the side of the usual view, which sees
     // the receiving face), so source, rays and arrival share one frame; portrait height holds the source above.
     const sky=ts.find(t=>t.kind==='PATH'&&skies.some(e=>gap(t.path![0],posE(e))<Math.max(...e.size))),sp=sky?.path![0],ep=sky?.path!.at(-1);
     const hz=sp&&ep?Math.hypot(sp[0]-ep[0],sp[2]-ep[2]):0,px=sp&&ep&&hz>0.5?(sp[2]-ep[2])/hz:0,pz=sp&&ep&&hz>0.5?(ep[0]-sp[0])/hz:0,sg=px*0.55+pz>=0?1:-1;
     const dirE:Vec3=hz>0.5?[sg*px,0.2,sg*pz]:[0.55,0.32,1];
     if(sp)keys.unshift(sp);const pts0=sp?[...(wide??local),...[[-0.7,-0.7,-0.7],[0.7,0.7,0.7]].map(d=>r3(sp.map((v,i)=>v+d[i]) as Vec3))]:wide??local;
     b.framing={points:pts0,dir:dirE,keyCount:tight.length,need:OCCUPANCY_THRESHOLDS.DETAIL,keys:keys.map(r3),...(wide&&!sp?{reveal:local}:{})};}}
   for(const o of b.operations)if(o.operation==='MOVE'&&!o.observed&&Array.isArray(o.parameters.to))where.set(o.target,[...(o.parameters.to as Vec3)] as Vec3);}}
 // Questions and the payoff: the editorial path is followed from where the quantity is to where it goes; a plain question
 // holds on the framing of the beat that answers it.
 for(const b of beats.filter(b=>b.visualIntent==='QUESTION_HOLD'||b.visualIntent==='PAYOFF_RECAP')){if(!enc0)break;
  const own=b.operations.find(o=>o.operation==='FLOW'),pe=own?entities.find(e=>e.entityId===own.target):undefined,encB=boxPts(enc0),zb=enc0.position[2]-enc0.size[2]/2;
  if(pe?.path){const p=pe.path,side=p.reduce((a,q)=>a+q[0],0)/p.length>=enc0.position[0]?1:-1,back:Vec3[]=[[encB[0][0],encB[0][1],zb],[encB[1][0],encB[1][1],zb]];
   // A question holds where the quantity is and lets its trajectory begin (the answer's place is revealed by the next sentence):
   // an orbit in under two seconds would spend most of it looking at the housing's side wall.
   if(b.visualIntent==='QUESTION_HOLD'){b.framing={points:[...p.slice(0,2),...encB].map(r3),dir:[side*0.55,0.3,1],keyCount:2,need:OCCUPANCY_THRESHOLDS.REGION,keys:[p[0]].map(r3)};continue;}
   b.framing={points:[...p,...encB].map(r3),dir:[side*0.6,0.32,1],keyCount:p.length,need:OCCUPANCY_THRESHOLDS.REGION,keys:[p[0],p.at(-1)!].map(r3),
    // The payoff opens where the source is seen (through the open front) and goes around to the back, on the whole object.
    track:{from:[...p.slice(0,2),...encB].map(r3),fromDir:[side*0.55,0.3,1],to:[...p.slice(-3),...near(p.at(-1)!),...back,...encB].map(r3),toDir:[side*1,0.42,-0.5]}};continue;}
  const next=beats.find(x=>x.startFrame>=b.endFrame&&x.framing);if(next?.framing){const {reveal:_r,track:_t,...rest}=next.framing;b.framing={...rest,keys:[]};}
 }
 function near(p:Vec3):Vec3[]{const e=entities.find(t=>t.kind!=='PATH'&&t!==enc0&&!['STATE_TINT','INTERIOR_ROOM','TRANSFER_PATH'].includes(t.assembly??'')&&t.role!=='CONTEXT_PROP'&&[0,1,2].every(i=>Math.abs(finalPos(t)[i]-p[i])<=t.size[i]/2+0.6));return e?boxPts(e):[];}
 // ---- Visual callback: the section closes and the complete object returns, as in the opening ----
 if(enc0&&activity[enc0.entityId]>=1){const lastB=beats.at(-1)!;lastB.operations.push({operation:'DECREASE',target:enc0.entityId,parameters:{parameter:'activity',from:1,to:0},startOffset:0.08,endOffset:0.94});/* the close spans the closing line: the object becomes whole again as the story ends */const tr=change(lastB.id,enc0.entityId,'DECREASE','activity',0,null,'Callback: the housing closes and the complete object is seen again');if(tr)lastB.transitionIds.push(tr);lastB.cameraZone='WORLD';lastB.cameraMotivation='Callback: back to the complete object in its place';}
 const finalSegment=u.segments.at(-1)!.id;
 for(const b of beats){
  // (a containment demonstration in the final sentence keeps its own framing: the presenter's wide payoff would hide it)
  b.presenterVisible=lead.some(s=>s.id===b.sentenceId)||b.sentenceId===finalSegment&&b.visualIntent!=='PAYOFF_RECAP'&&!physIntents.has(b.visualIntent);
  if(!b.presenterVisible)b.presenterIntent='NONE';
  const e=entities.find(e=>e.entityId===b.focusEntityId),move=b.operations.some(o=>o.operation==='MOVE'&&!o.observed);
  b.shotType=b.presenterVisible?(b.sentenceId===finalSegment?'PAYOFF':'ESTABLISHING'):move?'FOLLOW_ACTION':b.visualIntent==='BOILING'||b.visualIntent==='STILL_BOILING'?'CUTAWAY':e&&Math.max(...e.size)<.65?'COMPONENT_CLOSEUP':e?.assembly==='STEAM_PLUME'||e?.assembly==='FLAME'?'ACTION_CLOSEUP':b.cameraZone==='RESULT'?'RESULT':'SYSTEM';
  if(!b.presenterVisible&&b.focusEntityId===null)b.focusEntityId=mainW.entityId;
  if(b.shotType==='CUTAWAY')b.cameraZone='CUTAWAY';
 }
 // Demonstration-first direction metadata: the strategy each factual beat realises (selected generically).
 for(const b of beats){const d=demonstrations.find(x=>b.relationIds.some(r=>x.claimIds.includes(r)));if(d){b.demonstrationId=d.id;b.stage=d.stage;}}
 const raw={version:VISUAL_CAUSAL_VERSION,topic:input.topic,worldId,scriptFingerprint:input.scriptFingerprint,storyFingerprint:input.storyFingerprint,relationsFingerprint:jsonHash(input.relations),world,beats,transitions,gaps:gaps.sort((a,b)=>a.relationId.localeCompare(b.relationId,'en')),fps:input.fps,totalFrames:input.totalFrames,demonstrations,
  context:sceneContext,
  cameraSpace:cameraSpaceOf(world,e=>layout.assemblyTargets[e.entityId]??e.position),
  ...(layout.enclosure?{spatialMap:spatialMap(layout.enclosure)}:{}),
  functionalForms:forms,
  // Semantic identity (roles from relations) and visual identity (what the drawing composes from those roles), kept apart.
  ...(episodes.length?{episodes:episodes.map(ep=>({from:input.sentences[ep.start].id,rewindAt:input.sentences[ep.rewind].id}))}:{}),
  ...(phys?{physical:{system:phys.model.system,roles:phys.model.roles,reason:phys.model.reason,features:phys.features,
   pairs:phys.model.containment.filter(c=>phys.entityIds[c.container]&&phys.entityIds[c.content]).map(c=>({container:phys.entityIds[c.container],content:phys.entityIds[c.content],relationId:c.relationId,kind:c.kind})),
   rotating:phys.model.rotating.filter(r=>phys.entityIds[r.subject]).map(r=>{const content=entities.find(e=>e.assembly==='CONTENT_ITEMS');return{entityId:phys.entityIds[r.subject],relationId:r.relationId,content:content?.entityId??null,behaviorStated:phys.model.follows.some(f=>f.container===r.subject)||phys.model.contacts.some(c=>c.owner===r.subject)};})}}:{}),
  mechanismParticipants:participantsDrawn(),
  layout:{enclosure:layout.enclosure?.entityId??null,placed:layout.placed,inside:layout.inside,behind:layout.behind,circuit:layout.circuit,machines:layout.machines,tints:layout.tints,relations:layout.relations,derivedInitialStates:layout.derivedInitialStates},
  mechanismExecution:{carriers:mech.carriers,gaps:mech.gaps,coveredByClaims:mech.covered}};
 return{...raw,fingerprint:jsonHash(raw)};
}
export const SCRIPT_ASSEMBLIES:Assembly[]=['OPEN_BASIN','VANE_RING','ROTOR','PANEL','DISPLAY_BLOCK','PIPE','RAISED_GROUND'];
