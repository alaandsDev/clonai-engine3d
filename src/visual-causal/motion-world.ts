import {jsonHash} from '../editorial/fingerprint';
import type {Vec3} from '../engine3d/contracts';
import type {CameraState} from '../engine3d/directed';
import type {ScriptEntity,ScriptUnderstanding} from '../script-mode/contracts';
import {VISUAL_CAUSAL_VERSION} from './contracts';
import type {BeatOperation,CameraZone,CausalVisualBeat,PersistentWorld,PlannerInput,VisualCausalPlan,VisualGap,VisualScopeEntry,VisualStateTransition,WorldEntity} from './contracts';
import {frameCamera} from './script-world';
import {selectDemonstrations,type MicroStage,type VisualDemonstrationIntent} from './demonstrations';
/** Phase29 MOTION_STAGE, demonstration-first. A body that moves through a medium (air, space, water, ground) is the
 * persistent subject; its named parts are attached children that enter when the script introduces them (v1 → v2 → …).
 * Each script idea becomes a demonstration (selected generically in demonstrations.ts) that ends in something
 * observable: the body falls/rises/accelerates, a stream bends, a component starts acting. Experiment and component
 * demonstrations happen on a clean studio micro-stage; world/system ones in the medium. Arrows and labels only support. */
const id=(p:string,x:unknown)=>p+'_'+jsonHash(x).slice(0,12);
type Dir='UP'|'DOWN'|'FORWARD'|'BACKWARD';
const BODY:Record<string,{assembly:'FUSELAGE'|'HULL'|'CAR_BODY';size:Vec3;at:Vec3;color:string;field:'CLOUD_FIELD'|'WATER_SURFACE'|'ROAD_STRIP';fieldSize:Vec3;lift:{size:Vec3;at:Vec3;rotation:Vec3;entry:Vec3};prop:{size:Vec3;at:Vec3;entry:Vec3}}>={
 AIR:{assembly:'FUSELAGE',size:[4.4,0.62,0.62],at:[0,0,0],color:'#2f5fb3',field:'CLOUD_FIELD',fieldSize:[7.5,1.75,7.5],lift:{size:[0.95,0.08,6.4],at:[0.2,-0.1,0],rotation:[0,0,0],entry:[0,1.8,0]},prop:{size:[0.38,0.95,2.7],at:[0.45,-0.45,0],entry:[0,-1.6,0]}},
 SPACE:{assembly:'FUSELAGE',size:[4.4,0.7,0.7],at:[0,0,0],color:'#d2463c',field:'CLOUD_FIELD',fieldSize:[7.5,1.75,7.5],lift:{size:[0.8,0.06,1.8],at:[-1.6,0,0],rotation:[0,0,0],entry:[0,1.5,0]},prop:{size:[0.5,0.8,0.01],at:[-2.6,0,0],entry:[-1.5,0,0]}},
 WATER:{assembly:'HULL',size:[3.6,1.0,1.4],at:[0,0.45,0],color:'#d2463c',field:'WATER_SURFACE',fieldSize:[5,0.1,5],lift:{size:[1.0,0.06,1.8],at:[0,1.35,0],rotation:[Math.PI/2,0,0],entry:[0,1.8,0]},prop:{size:[0.3,0.6,0.01],at:[-2.0,-0.3,0],entry:[-1.4,0,0]}},
 GROUND:{assembly:'CAR_BODY',size:[3.2,1.1,1.5],at:[0,0.62,0],color:'#d2463c',field:'ROAD_STRIP',fieldSize:[5,0.1,4],lift:{size:[0.45,0.05,1.5],at:[-1.4,0.63,0],rotation:[0,0,0],entry:[0,1.4,0]},prop:{size:[0.3,0.5,0.01],at:[-1.75,-0.17,0],entry:[-1.2,0,0]}},
};
const ARROW:Record<Dir,{color:string;rotation:Vec3;offset:Vec3}>={
 UP:{color:'#f2c230',rotation:[0,0,0],offset:[0,1.15,0]},DOWN:{color:'#e8423c',rotation:[Math.PI,0,0],offset:[0,-1.15,0]},
 FORWARD:{color:'#36c46a',rotation:[0,0,-Math.PI/2],offset:[3.3,0,0]},BACKWARD:{color:'#f08a24',rotation:[0,0,Math.PI/2],offset:[-3.4,0,0]},
};
const CONCEPT_FIELDS=[/\b(?:pressao|pressoes|pressure)\b/];
const fold=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
// Experiments isolate the subject on a clean studio stage; component and system demonstrations stay in the medium.
const STUDIO_STAGES=new Set<MicroStage>(['EXPERIMENT_STAGE','COMPARISON_STAGE']);
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const r3=(v:Vec3):Vec3=>v.map(x=>+x.toFixed(3)) as Vec3;
/** A moving-body scene: a vehicle that is the main subject, or about which the script states motion, forces or flow. */
export function hasMotionSubject(u:ScriptUnderstanding,known:Set<string>){const v=u.entities.find(e=>e.role==='VEHICLE'&&e.claimIds.some(c=>known.has(c)));if(!v)return false;
 // The vehicle itself must be what the forces/motion act on (a word like "jet" in a mechanism is not a moving body).
 return v.id===u.mainSubjectId||u.actions.some(a=>known.has(a.claimId)&&['THRUST','SHOW_FORCE','TRAVEL','STREAM','DEFLECT','BALANCE'].includes(a.action)&&a.entityIds.includes(v.id));}
export function planMotionWorld(input:PlannerInput):VisualCausalPlan{
 const u=input.scriptUnderstanding as ScriptUnderstanding,known=new Set(input.relations.map(r=>r.id)),asserted=(e:ScriptEntity)=>e.claimIds.filter(c=>known.has(c));
 const worldId=id('WORLD',{script:input.scriptFingerprint,story:input.storyFingerprint,stage:'MOTION'});
 const vehicle=u.entities.find(e=>e.role==='VEHICLE'&&asserted(e).length)!,spec=BODY[vehicle.medium??'AIR'];
 const lift=u.entities.find(e=>e.role==='LIFT_SURFACE'&&asserted(e).length)??null,prop=u.entities.find(e=>e.role==='PROPULSOR'&&asserted(e).length)??null;
 const fluids=u.entities.filter(e=>e.role==='FLUID'&&asserted(e).length>0);
 const demos=selectDemonstrations(u,known),ent=(sid:string|undefined)=>u.entities.find(e=>e.id===sid);
 const fact=(es:(ScriptEntity|null)[],extra:string[]=[]):Pick<WorldEntity,'grounding'|'abstraction'|'relationIds'|'participant'|'label'|'scriptEntityIds'>=>{const list=es.filter((e):e is ScriptEntity=>Boolean(e)),rel=[...new Set([...list.flatMap(asserted),...extra])].sort();
  return rel.length?{grounding:'FACTUAL',abstraction:'ABSTRACT_SYSTEM_REPRESENTATION',relationIds:rel,participant:list[0]?.label??null,label:list[0]?.label??null,scriptEntityIds:list.map(e=>e.id)}:{grounding:'EDITORIAL',abstraction:'EDITORIAL_DECORATION',relationIds:[],participant:null,label:null,scriptEntityIds:list.map(e=>e.id)};};
 const entities:WorldEntity[]=[];const push=(e:Omit<WorldEntity,'worldId'|'rotation'>&{rotation?:Vec3})=>{const w={rotation:[0,0,0] as Vec3,...e,worldId};entities.push(w);return w;};
 // ---- Persistent composite subject: the body carries its parts (children) and therefore their claims ----
 const field=push({entityId:'medium',role:'CONTEXT_PROP',...fact([]),kind:'CYLINDER',assembly:spec.field,size:spec.fieldSize,position:[0,0,0],color:'#ffffff',initiallyVisible:true,initial:{activity:0.45}});
 const studio=push({entityId:'studio',role:'CONTEXT_PROP',...fact([]),kind:'CYLINDER',assembly:'STUDIO_BACKDROP',size:[6,3,6],position:[0,0,0],color:'#eef3f7',initiallyVisible:false});
 const experimentClaims=demos.filter(d=>d.strategy==='EXPERIMENT_AB').flatMap(d=>d.claimIds);
 // The stream is the visible manifestation of flow and cause→effect demonstrations, so it carries those claims too.
 const causeClaims=demos.filter(d=>d.strategy==='CAUSE_EFFECT'||d.strategy==='FLOW_DEMONSTRATION').flatMap(d=>d.claimIds);
 const body=push({entityId:'body',role:'MAIN_SYSTEM',...fact([vehicle,lift,prop],experimentClaims),kind:'BOX',assembly:spec.assembly,size:spec.size,position:spec.at,color:spec.color,initiallyVisible:true});
 body.label=vehicle.label;
 const attach=new Map<string,Vec3>();
 const child=(e:Omit<WorldEntity,'worldId'|'rotation'>&{rotation?:Vec3},local:Vec3,entry:Vec3|null)=>{const w=push({...e,parentId:'body',position:r3(entry?[local[0]+entry[0],local[1]+entry[1],local[2]+entry[2]]:local)});attach.set(w.entityId,local);return w;};
 const liftW=lift?child({entityId:'lift_surface',role:'SYSTEM_COMPONENT',...fact([lift]),kind:'BOX',assembly:'LIFT_SURFACE',size:spec.lift.size,position:[0,0,0],rotation:spec.lift.rotation,color:'#d9dee3',initiallyVisible:false},sub(spec.lift.at,spec.at),spec.lift.entry):null;
 const propW=prop?child({entityId:'propulsor',role:'SYSTEM_COMPONENT',...fact([prop]),kind:'CYLINDER',assembly:'PROPULSOR',size:spec.prop.size,position:[0,0,0],color:'#8c969f',initiallyVisible:false,initial:{activity:0.2}},sub(spec.prop.at,spec.at),spec.prop.entry):null;
 const surfaceLocal=liftW?attach.get('lift_surface')!:[0,0,0] as Vec3;
 const streamW=fluids.length?child({entityId:'streamlines',role:'SYSTEM_COMPONENT',...fact(fluids,causeClaims),kind:'CYLINDER',assembly:'STREAMLINES',size:[3.4,1.8,Math.min(5,(liftW?.size[2]??spec.size[2])*0.8)],position:[0,0,0],color:'#ffffff',initiallyVisible:true,initial:{activity:0,fillLevel:0}},[surfaceLocal[0],surfaceLocal[1]+0.05,surfaceLocal[2]],null):null;
 // Arrows (support only): one per force direction the demonstrations use.
 const arrowClaims=new Map<Dir,{claims:Set<string>;forces:ScriptEntity[]}>(),note=(d:string|null|undefined,cid:string,f?:ScriptEntity)=>{if(!d||!(d in ARROW))return;const x=arrowClaims.get(d as Dir)??{claims:new Set<string>(),forces:[]};x.claims.add(cid);if(f&&!x.forces.includes(f))x.forces.push(f);arrowClaims.set(d as Dir,x);};
 for(const a of u.actions.filter(a=>known.has(a.claimId))){if(a.action==='SHOW_FORCE')note(a.state??ent(a.entityIds[0])?.direction,a.claimId,ent(a.entityIds[0]));if(a.action==='BALANCE')for(const f of a.entityIds)note(ent(f)?.direction,a.claimId,ent(f));}
 const arrows=new Map<Dir,WorldEntity>();
 for(const [d,x] of [...arrowClaims.entries()].slice(0,3)){const a=ARROW[d],base=d==='UP'?surfaceLocal:[0,0,0] as Vec3,named=x.forces.find(f=>f.direction===d)??x.forces[0];
  const w=child({entityId:'force_'+d.toLowerCase(),role:'SYSTEM_COMPONENT',...fact(x.forces,[...x.claims]),kind:'CYLINDER',assembly:'FORCE_ARROW',size:[0.3,1.9,0.3],position:[0,0,0],rotation:a.rotation,color:a.color,initiallyVisible:true,initial:{activity:0}},[base[0]+a.offset[0],base[1]+a.offset[1],base[2]+a.offset[2]],null);
  w.label=named?.label??null;arrows.set(d,w);}
 const conceptW=u.segments.some(s=>CONCEPT_FIELDS.some(c=>c.test(fold(s.span.text))))?child({entityId:'concept_field',role:'CONTEXT_PROP',grounding:'EDITORIAL',abstraction:'EDITORIAL_CONTEXT_FROM_SENTENCE',relationIds:[],participant:null,label:null,scriptEntityIds:[],kind:'CYLINDER',assembly:'PRESSURE_FIELD',size:[(liftW?.size[0]??spec.size[0])*2.6,0.9,Math.min(4.5,(liftW?.size[2]??spec.size[2])*0.7)],position:[0,0,0],color:'#8ad0ff',initiallyVisible:true,initial:{activity:0}},surfaceLocal,null):null;
 // ---- Camera zones (subject at rest; motion is shown relative to these frames) ----
 const box=(w:WorldEntity,local:Vec3):Vec3[]=>{const c=[spec.at[0]+local[0],spec.at[1]+local[1],spec.at[2]+local[2]];return[[c[0]-w.size[0]/2,c[1]-w.size[1]/2,c[2]-w.size[2]/2],[c[0]+w.size[0]/2,c[1]+w.size[1]/2,c[2]+w.size[2]/2]];};
 const craft=[...box(body,[0,0,0]),...(liftW?box(liftW,attach.get('lift_surface')!):[]),...(propW?box(propW,attach.get('propulsor')!):[])];
 const surfacePts=liftW?box(liftW,surfaceLocal).map(p=>[p[0],p[1],Math.max(spec.at[2]+surfaceLocal[2],p[2])] as Vec3):box(body,[0,0,0]);
 const cameraZones:Record<CameraZone,CameraState>={
  WORLD:frameCamera(craft,[-0.75,0.32,0.6],1.7,6),SYSTEM:frameCamera([...craft,[0,-1.6,0],[0,1.4,0]],[0.05,0.1,1],1.3,5.5),ACTION:frameCamera(craft,[0.85,-0.06,0.55],1.15,4.5),
  COMPONENT:frameCamera([...surfacePts,...box(body,[0,0,0]).map(p=>[p[0]*0.4,p[1],p[2]] as Vec3)],[0.22,0.42,1],1.3,4.2),RESULT:frameCamera(craft,[0.2,-0.55,1],1.3,5),CUTAWAY:frameCamera(craft,[-0.85,0.05,0.55],1.2,4.5),
 };
 const world:PersistentWorld={worldId,template:'MOTION_STAGE',environmentId:input.environmentId??'ENV_FOREST_001',presenter:{entityId:'presenter',resourceId:'CHAR_CAIO_001',home:[0,0,0],facing:0,scale:0.82,offstage:true},cutaway:{kind:'NONE',openAmount:0,revealsEntityIds:[]},cameraZones,entities,
  visualScope:u.entities.map(e=>{const w=entities.find(x=>x.scriptEntityIds?.includes(e.id));return{scriptEntityId:e.id,label:e.label,role:e.role,scope:(w?'PERSISTENT_WORLD':'NON_VISUAL') as VisualScopeEntry['scope'],worldEntityId:w?.entityId??null,segments:[...new Set(asserted(e).map(c=>u.claims.find(x=>x.id===c)!.segmentId))],reason:w?'Part of the moving subject or its manifestations':'No object in a moving-body scene (concept, attribute, agent or unused)'};}),maxSimultaneousVisible:entities.filter(e=>e.entityId!=='studio').length};
 // ---- Demonstration → steps (each step ends in an observable change) ----
 const beats:CausalVisualBeat[]=[],transitions:VisualStateTransition[]=[],gaps:VisualGap[]=[];
 const lvl:Record<string,{activity:number;fillLevel:number}>={},pos:Record<string,Vec3>={},vis:Record<string,boolean>={};
 for(const e of entities){lvl[e.entityId]={activity:e.initial?.activity??0,fillLevel:e.initial?.fillLevel??0};pos[e.entityId]=[...e.position] as Vec3;vis[e.entityId]=e.initiallyVisible;}
 const version:Record<string,number>={};let stage:MicroStage='WORLD_STAGE',stageSwitches=0,subjectVersion=1;
 type Change={e:WorldEntity;kind:'activity'|'fillLevel'|'move'|'show'|'hide';to?:number;at?:Vec3;window:[number,number];grounded:string|null};
 type Step=Omit<CausalVisualBeat,'id'|'order'|'startFrame'|'endFrame'|'timing'|'transitionIds'|'operations'>&{weight:number;changes:Change[];extra?:BeatOperation[]};
 const T=(beatId:string,e:WorldEntity,op:VisualStateTransition['operation'],param:string|null,from:number|boolean,to:number|boolean,grounded:string|null)=>{version[e.entityId]=(version[e.entityId]??0)+1;const t:VisualStateTransition={id:id('VT',{beatId,e:e.entityId,param,to}),beatId,entityId:e.entityId,operation:op,parameter:param,from,to,grounding:grounded?'GROUNDED':'EDITORIAL',evidenceRelationId:grounded,editorialReason:grounded?null:'Editorial staging (stage, assembly or medium)',stateVersion:version[e.entityId]};transitions.push(t);return t.id;};
 const realise=(beatId:string,changes:Change[]):{ops:BeatOperation[];tids:string[]}=>{const ops:BeatOperation[]=[],tids:string[]=[];
  for(const c of changes){const k=c.e.entityId,[a,b]=c.window;
   if(c.kind==='show'){if(vis[k])continue;vis[k]=true;ops.push({operation:'REVEAL',target:k,parameters:{},startOffset:a,endOffset:b});tids.push(T(beatId,c.e,'REVEAL',null,false,true,c.grounded));}
   else if(c.kind==='hide'){if(!vis[k])continue;vis[k]=false;ops.push({operation:'HIDE',target:k,parameters:{},startOffset:a,endOffset:b});tids.push(T(beatId,c.e,'HIDE',null,true,false,c.grounded));}
   else if(c.kind==='move'){const from=pos[k],to=r3(c.at!);if(from.every((v,i)=>Math.abs(v-to[i])<1e-6))continue;pos[k]=to;ops.push({operation:'MOVE',target:k,parameters:{from:[...from],to},startOffset:a,endOffset:b});tids.push(T(beatId,c.e,'MOVE','y',from[1],to[1],c.grounded));}
   else{const from=lvl[k][c.kind],to=c.to!;if(Math.abs(from-to)<1e-6)continue;lvl[k][c.kind]=to;const op=to>from?'INCREASE':'DECREASE';ops.push({operation:op,target:k,parameters:{parameter:c.kind,from,to},startOffset:a,endOffset:b});tids.push(T(beatId,c.e,op,c.kind,from,to,c.grounded));}}
  return{ops,tids};};
 // Stage switch: the studio replaces the medium for experiment/component stages (and back). Counts as a visual change.
 const toStage=(s:MicroStage):Change[]=>{const studioNow=STUDIO_STAGES.has(stage),studioNext=STUDIO_STAGES.has(s);stage=s;if(studioNow===studioNext)return[];stageSwitches++;
  // Hide first, reveal right after: the two backdrops are never visible together.
  return studioNext?[{e:field,kind:'hide',window:[0,0.02],grounded:null},{e:studio,kind:'show',window:[0.06,0.09],grounded:null}]:[{e:studio,kind:'hide',window:[0,0.02],grounded:null},{e:field,kind:'show',window:[0.06,0.09],grounded:null}];};
 const zoneOf=(s:MicroStage,focusPart:boolean):CameraZone=>s==='WORLD_STAGE'?'WORLD':s==='EXPERIMENT_STAGE'||s==='COMPARISON_STAGE'?'SYSTEM':s==='COMPONENT_STAGE'||s==='CUTAWAY_STAGE'||focusPart?'COMPONENT':'ACTION';
 const shown=new Map<string,(Change&{from:number})[]>();
 const step=(sid:string,d:VisualDemonstrationIntent|null,intent:string,focus:WorldEntity|null,changes:Change[],opts:{factual?:boolean;label?:string|null;zone?:CameraZone;weight?:number;extra?:BeatOperation[]}={}):Step=>{
  const st=d?.stage??stage,fact=Boolean(opts.factual&&d);
  // Remember what each factual step visibly did to each part (with the prior level), for later recaps.
  if(fact)for(const c of changes)if(c.grounded&&(c.kind==='activity'||c.kind==='fillLevel')){const from=lvl[c.e.entityId]?.[c.kind]??0;if(Math.abs(from-(c.to??from))>1e-6)shown.set(c.e.entityId,[{...c,from}]);}
  return{sentenceId:sid,storyNodeIds:[],relationIds:fact?d!.claimIds:[],evidenceIds:[],grounding:fact?'FACTUAL_DEMONSTRATION':'EDITORIAL_TRANSITION',visualIntent:intent,presenterIntent:'NONE',presenterVisible:false,cameraZone:opts.zone??zoneOf(st,Boolean(focus&&focus!==body)),cameraMotivation:(d?d.strategy+': ':'')+(d?.question??'Keep the moving subject in view'),focusEntityId:focus?.entityId??null,label:opts.label??null,proof:fact?{level:d!.support==='UNSUPPORTED'?'NONE':d!.support,rationale:d!.reason}:null,weight:opts.weight??1,changes,extra:opts.extra,...(d?{demonstrationId:d.id,stage:d.stage}:{stage})};};
 const assemble=(sid:string,d:VisualDemonstrationIntent):Step[]=>{const out:Step[]=[];
  for(const sidE of d.assembles){const w=entities.find(e=>e.scriptEntityIds?.includes(sidE)&&e.parentId==='body'&&attach.has(e.entityId)&&!e.entityId.startsWith('force_'));if(!w||vis[w.entityId])continue;
   subjectVersion++;out.push(step(sid,d,'ASSEMBLE_v'+subjectVersion,w,[{e:w,kind:'show',window:[0.02,0.08],grounded:null},{e:w,kind:'move',at:attach.get(w.entityId)!,window:[0.1,0.75],grounded:null}],{label:w.label,zone:'ACTION',weight:0.8}));}
  return out;};
 const arrowFor=(d:string|null|undefined)=>d?arrows.get(d as Dir)??null:null;
 const bodyAt=(dy:number):Vec3=>[spec.at[0],spec.at[1]+dy,spec.at[2]];
 const build=(sid:string,d:VisualDemonstrationIntent):Step[]=>{
  const out=assemble(sid,d),a=(i:number)=>ent(d.actorEntityIds[i]);
  switch(d.strategy){
   case 'MOTION_RESPONSE':{const dir=d.observable==='FALL'?'DOWN':d.observable==='RISE'?'UP':d.observable==='ACCELERATE'?'FORWARD':'BACKWARD',arrow=arrowFor(dir),dy=dir==='DOWN'?-1.1:dir==='UP'?0.45:0;
    // Rising from below the rest height means climbing back to rest (a visible rise), not a jump above it.
    const target=dir==='UP'&&pos.body[1]<spec.at[1]-1e-6?bodyAt(0):bodyAt(dy);
    out.push(step(sid,d,'FORCE_ACTS',body,[...toStage(d.stage),...(arrow?[{e:arrow,kind:'activity' as const,to:1,window:[0.1,0.5] as [number,number],grounded:d.claimIds[0]}]:[])],{label:arrow?.label??null,weight:0.8}));
    out.push(step(sid,d,'BODY_'+d.observable,body,dy!==0?[{e:body,kind:'move',at:target,window:[0.05,0.85],grounded:d.claimIds[0]}]:[{e:field,kind:'activity',to:dir==='FORWARD'?1:0.25,window:[0.1,0.8],grounded:null}],{factual:true,weight:1.2}));break;}
   case 'EXPERIMENT_AB':{const x=d.experiment!,fa=ent(d.actorEntityIds.find(id=>ent(id)?.direction&&x.conditions[0].description.includes(ent(id)!.label))??d.actorEntityIds[0]),dirA=fa?.direction??'DOWN',other=d.actorEntityIds.map(ent).find(e=>e&&e!==fa)?.direction??null,arrA=arrowFor(dirA),arrB=arrowFor(other);
    out.push(step(sid,d,'EXPERIMENT_RESET',body,[...toStage('EXPERIMENT_STAGE'),{e:body,kind:'move',at:bodyAt(0),window:[0.05,0.5],grounded:null},...(arrB?[{e:arrB,kind:'activity' as const,to:0,window:[0.05,0.4] as [number,number],grounded:null}]:[])],{label:'A',weight:0.6}));
    out.push(step(sid,d,'CONDITION_A_'+x.conditions[0].observable,body,[...(arrA?[{e:arrA,kind:'activity' as const,to:1,window:[0.02,0.3] as [number,number],grounded:x.conditions[0].claimId}]:[]),{e:body,kind:'move',at:bodyAt(dirA==='DOWN'?-1.1:0.6),window:[0.25,0.9],grounded:x.conditions[0].claimId}],{factual:true,label:'A ✗',weight:1}));
    out.push(step(sid,d,'CONDITION_B_STOP',body,[...(arrB?[{e:arrB,kind:'activity' as const,to:1,window:[0.02,0.35] as [number,number],grounded:x.verdictClaimId}]:[]),{e:body,kind:'move',at:bodyAt(0),window:[0.25,0.9],grounded:x.verdictClaimId}],{factual:true,label:'B ✓',weight:1.1}));break;}
   case 'CAUSE_EFFECT':{const dir=d.observable==='RISE'?'UP':d.observable==='FALL'?'DOWN':null,arrow=arrowFor(dir);
    // If the stream was already turned, the cause is shown again (straighten, then bend) so the effect follows a visible cause.
    if(streamW){const replay=lvl[streamW.entityId].fillLevel>0.5;out.push(step(sid,d,'CAUSE_FLOW_BENDS',liftW??body,[...toStage('SYSTEM_STAGE'),{e:streamW,kind:'activity',to:1,window:[0.02,0.2],grounded:d.claimIds[0]},...(replay?[{e:streamW,kind:'fillLevel' as const,to:0.1,window:[0.02,0.25] as [number,number],grounded:null}]:[])],{factual:true,weight:0.5}));
     out.push(step(sid,d,'CAUSE_FLOW_BENDS',liftW??body,[{e:streamW,kind:'fillLevel',to:1,window:[0.05,0.8],grounded:d.claimIds[0]}],{factual:true,weight:0.9}));}
    const dy=dir==='UP'?(pos.body[1]<spec.at[1]?0:0.45):dir==='DOWN'?-0.8:0;
    out.push(step(sid,d,'EFFECT_BODY_'+d.observable,body,[...(dy!==0||pos.body[1]!==spec.at[1]+dy?[{e:body,kind:'move' as const,at:bodyAt(dy),window:[0.05,0.7] as [number,number],grounded:d.claimIds[1]??d.claimIds[0]}]:[]),...(arrow?[{e:arrow,kind:'activity' as const,to:1,window:[0.5,0.9] as [number,number],grounded:d.claimIds[1]??d.claimIds[0]}]:[])],{factual:true,zone:'SYSTEM',label:arrow?.label??null,weight:1.1}));break;}
   case 'COMPONENT_ACTION_RESULT':{const comp=propW&&a(0)?.role==='PROPULSOR'?propW:null;
    if(comp)out.push(step(sid,d,'COMPONENT_ACTS',comp,[...toStage('COMPONENT_STAGE'),{e:comp,kind:'activity',to:1,window:[0.1,0.6],grounded:d.claimIds[0]}],{factual:true,weight:1}));
    else if(streamW)out.push(step(sid,d,'FLUID_PUSHES',body,[...toStage('SYSTEM_STAGE'),{e:streamW,kind:'activity',to:1,window:[0.05,0.4],grounded:d.claimIds[0]}],{factual:true,weight:1}));
    out.push(step(sid,d,'RESULT_'+d.observable,body,[...toStage('WORLD_STAGE'),{e:field,kind:'activity',to:1,window:[0.1,0.8],grounded:null}],{zone:'WORLD',weight:1}));break;}
   case 'FLOW_DEMONSTRATION':{if(!streamW){gaps.push({relationId:d.claimIds[0],predicate:'FLOW',reason:'No fluid entity to show'});break;}
    const bend=d.observable==='BEND';out.push(step(sid,d,bend?'FLOW_BENDS':'FLOW_PAST_SURFACE',liftW??body,[...toStage('SYSTEM_STAGE'),{e:streamW,kind:'activity',to:1,window:[0.05,0.4],grounded:d.claimIds[0]},...(bend?[{e:streamW,kind:'fillLevel' as const,to:1,window:[0.3,0.85] as [number,number],grounded:d.claimIds[0]}]:[])],{factual:true,label:ent(d.actorEntityIds[0])?.label??null,weight:1.2}));break;}
   case 'FOLLOW_ACTION':{const ws=d.actorEntityIds.map(id=>arrowFor(ent(id)?.direction)).filter((x):x is WorldEntity=>Boolean(x));
    out.push(step(sid,d,d.observable==='STOP'?'STEADY_MOTION':'FOLLOW',body,[...toStage('WORLD_STAGE'),{e:body,kind:'move',at:bodyAt(0),window:[0.05,0.5],grounded:null},...ws.map(w=>({e:w,kind:'activity' as const,to:1,window:[0.1,0.4] as [number,number],grounded:d.claimIds[0]}))],{factual:true,zone:'WORLD',label:ws.map(w=>w.label).filter(Boolean).join(' = ')||null,weight:1}));break;}
   default:{if(d.support==='UNSUPPORTED')gaps.push({relationId:d.claimIds[0],predicate:d.strategy,reason:d.reason});
    // A part that is only named, but was already shown acting, replays that shown action (editorial recap, no new fact).
    const named=[d.subjectEntityId,...d.actorEntityIds].flatMap(sidE=>entities.filter(e=>sidE&&e.scriptEntityIds?.includes(sidE)&&e!==body)),recap=named.flatMap(w=>shown.get(w.entityId)??[]);
    if(recap.length){out.push(step(sid,null,'RECAP_RESET',named[0],[...toStage('SYSTEM_STAGE'),...recap.map(c=>({e:c.e,kind:c.kind,to:c.from,window:[0.1,0.5] as [number,number],grounded:null}))],{weight:0.5}));
     out.push(step(sid,null,'RECAP_SHOWN_ACTION',named[0],recap.map(c=>({e:c.e,kind:c.kind,to:c.to,window:[0.05,0.6] as [number,number],grounded:null})),{weight:0.9}));}
    out.push(step(sid,d,d.strategy==='PROGRESSIVE_ASSEMBLY'?'SUBJECT_SHOWN':'NAMED',body,toStage('SYSTEM_STAGE'),{factual:d.support!=='UNSUPPORTED',weight:0.8}));}
  }
  return out;};
 const timing=(sid:string)=>input.timing.find(t=>t.sentenceId===sid)!;
 const schedule=(steps:Step[],start:number,end:number,sid:string)=>{const total=steps.reduce((a,s)=>a+s.weight,0),len=end-start;let cursor=start;
  steps.forEach((s,i)=>{const l=i===steps.length-1?end-cursor:Math.max(15,Math.round(len*s.weight/total)),a=cursor,b=Math.min(end,a+l);cursor=b;
   const beatId=id('BEAT',{sid,i,intent:s.visualIntent,rel:s.relationIds,demo:s.demonstrationId??null});const {ops,tids}=realise(beatId,s.changes);const all=[...ops,...(s.extra??[])];
   // A factual step that ended with no visible change is honest only as a symbolic illustration.
   if(s.proof&&['DIRECT','PARTIAL'].includes(s.proof.level)&&!all.some(o=>o.operation!=='HIGHLIGHT'&&o.target!=='studio'&&o.target!=='medium'))s.proof={level:'SYMBOLIC',rationale:'State already shown; illustrated, not changed'};
   const {weight:_w,changes:_c,extra:_e,...rest}=s;beats.push({...rest,operations:all,id:beatId,order:beats.length,startFrame:a,endFrame:b,timing:steps.length===1?'SENTENCE_BOUNDARY':'ESTIMATED_WITHIN_SENTENCE',transitionIds:tids});});};
 for(const s of input.sentences){
  const t=timing(s.id),steps:Step[]=[];
  for(const d of demos.filter(d=>d.segmentId===s.id))steps.push(...build(s.id,d));
  if(!steps.length){
   const concept=conceptW&&CONCEPT_FIELDS.some(c=>c.test(fold(s.text)));
   if(concept)steps.push(step(s.id,null,'CONCEPT_FIELD',liftW??body,[...toStage('SYSTEM_STAGE'),{e:conceptW!,kind:'activity',to:1,window:[0.05,0.3],grounded:null},{e:conceptW!,kind:'activity',to:0,window:[0.75,0.97],grounded:null}],{zone:'COMPONENT'}));
   else if(s===input.sentences[0])steps.push(step(s.id,null,'SUBJECT_IN_MEDIUM',body,[...toStage('WORLD_STAGE'),{e:field,kind:'activity',to:0.6,window:[0.1,0.7],grounded:null}],{zone:'WORLD'}));
   else steps.push(step(s.id,null,'FOLLOW_SUBJECT',body,toStage('WORLD_STAGE'),{zone:beats.length%2?'WORLD':'ACTION'}));
  }
  if(s===input.sentences.at(-1))steps.push(step(s.id,null,'PAYOFF_WIDE',body,[...toStage('WORLD_STAGE'),{e:body,kind:'move',at:bodyAt(0),window:[0.05,0.5],grounded:null}],{zone:'WORLD',weight:0.8}));
  schedule(steps,t.startFrame,t.endFrame,s.id);
 }
 beats.forEach((b,i)=>b.order=i);
 const raw={version:VISUAL_CAUSAL_VERSION,topic:input.topic,worldId,scriptFingerprint:input.scriptFingerprint,storyFingerprint:input.storyFingerprint,relationsFingerprint:jsonHash(input.relations),world,beats,transitions,gaps:gaps.sort((a,b)=>a.relationId.localeCompare(b.relationId,'en')),fps:input.fps,totalFrames:input.totalFrames,
  demonstrations:demos,direction:{subjectVersions:subjectVersion,stageSwitches}};
 return{...raw,fingerprint:jsonHash(raw)};
}
