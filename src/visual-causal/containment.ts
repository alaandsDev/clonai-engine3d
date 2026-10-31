import type {Vec3} from '../engine3d/contracts';
import type {ScriptUnderstanding} from '../script-mode/contracts';
import type {MechRef,MechRelation} from '../script-mode/mechanism';
import {singular} from '../script-mode/lexicon';
import type {BeatOperation,CameraZone,WorldEntity} from './contracts';
import type {MechanismLayout} from './demonstration-execution';
/** Phase29 containment class: generic physical relations between containers, what they hold, what rotates, what
 * crosses a boundary through openings, and what an actuator pulls/sends along a route. Built ONLY from admitted
 * mechanism relations (roles come from what the script says happens, never from object names). Nothing is inferred
 * from physics: a content moves with its container only when the script says so; openings are drawn only when the
 * script names them; a route exists only when a path/source is stated. */
export type FunctionalRole='SYSTEM'|'CONTAINER'|'INNER_CONTAINER'|'ROTATING_COMPONENT'|'MATERIAL'|'CONTENT'|'OPENING'|'REGION'|'SURFACE'|'ACTUATOR'|'PUMP_LIKE'|'CONDUIT'|'OUTLET'|'PROPERTY'|'TIME'|'QUANTITY'|'DISCOURSE';
export interface PhysicalModel {
 system:string|null;roles:Record<string,FunctionalRole[]>;
 containment:{container:string;content:string;relationId:string;kind:'CONTAIN'|'SURROUND'|'ACCUMULATE'|'INSIDE_PHRASE'}[];
 rotating:{subject:string;relationId:string;qualifiers:string[]}[];
 crossings:{material:string;boundary:string;openings:string|null;to:'OUTSIDE'|'INSIDE'|'UNSTATED';relationId:string}[];
 contacts:{content:string;surface:string;owner:string|null;ownerResolution:'STATED'|'SAME_SENTENCE'|'UNRESOLVED';relationId:string}[];
 follows:{content:string;container:string;relationId:string}[];
 transfers:{actor:string;material:string;source:string|null;path:string|null;destination:string|null;kind:string;relationId:string}[];
 drains:{material:string;relationId:string}[];
 losses:{content:string;material:string;partial:boolean;relationId:string}[];
 active:boolean;reason:string;
}
const fold=(x:string)=>x.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const H=(r?:MechRef|null)=>r?.head?singular(fold(r.head)):null;
const physical=(r?:MechRef|null)=>Boolean(r?.head&&(r.category==='PHYSICAL_ENTITY'||r.category==='COMPONENT'));
export function physicalModel(u:ScriptUnderstanding,known:Set<string>):PhysicalModel{
 const rels=(u.mechanism??[]).filter(m=>known.has(m.id)&&!m.negated&&m.modality!=='POSSIBLE');
 const M:PhysicalModel={system:null,roles:{},containment:[],rotating:[],crossings:[],contacts:[],follows:[],transfers:[],drains:[],losses:[],active:false,reason:''};
 const role=(h:string|null,r:FunctionalRole)=>{if(!h)return;const a=M.roles[h]??=[];if(!a.includes(r))a.push(r);};
 for(const m of rels){const s=H(m.subject),o=H(m.object),d=H(m.destination),src=H(m.source),q=H(m.quantity),p=H(m.path),own=H(m.propertyOwner);
  const inside=m.qualifiers.find(x=>x.startsWith('INSIDE:'))?.slice(7);if(inside&&s&&physical(m.subject))M.containment.push({container:singular(inside),content:s,relationId:m.id,kind:'INSIDE_PHRASE'});
  if(m.type==='ACTION'&&m.lemma==='ROTATE'&&s&&physical(m.subject)){M.rotating.push({subject:s,relationId:m.id,qualifiers:m.qualifiers});role(s,'ROTATING_COMPONENT');}
  else if(m.type==='CONTAIN'&&m.lemma==='CONTAIN'&&s&&d){M.containment.push({container:d,content:s,relationId:m.id,kind:'CONTAIN'});role(d,'CONTAINER');role(s,m.subject?.category==='MATERIAL'?'MATERIAL':'CONTENT');}
  else if(m.type==='CONTAIN'&&m.lemma==='SURROUND'&&s&&o){M.containment.push({container:s,content:o,relationId:m.id,kind:'SURROUND'});role(s,'CONTAINER');role(o,'INNER_CONTAINER');}
  else if(m.type==='MOVE'&&m.lemma==='ACCUMULATE'&&s&&d&&m.destination?.category!=='REGION'){M.containment.push({container:d,content:s,relationId:m.id,kind:'ACCUMULATE'});role(d,'CONTAINER');role(s,'MATERIAL');}
  else if(m.type==='MOVE'&&m.lemma==='PASS'&&s&&(own||m.destination?.category==='REGION'&&Boolean(m.destination.region))){
   // Crossing a boundary: "atravessa os X do Y" (X = openings of Y) or "passa para a parte externa/interna do Y".
   const side=m.destination?.category==='REGION'&&Boolean(m.destination.region),boundary=side?d!:own!,to=side?(m.destination!.region==='INSIDE'?'INSIDE':'OUTSIDE'):'UNSTATED';
   M.crossings.push({material:s,boundary,openings:side?null:o,to,relationId:m.id});role(s,'MATERIAL');if(o&&!side)role(o,'OPENING');}
  else if(m.type==='CONTACT'&&s&&d){M.contacts.push({content:s,surface:d,owner:own,ownerResolution:own?'STATED':'UNRESOLVED',relationId:m.id});role(s,'CONTENT');role(d,'SURFACE');}
  else if(m.type==='ACTION'&&m.lemma==='FOLLOW'&&s&&o){M.follows.push({content:s,container:o,relationId:m.id});role(s,'CONTENT');}
  else if(m.type==='ACTION'&&/^(?:PULL|PUSH)$/.test(m.lemma)&&s&&o&&m.object?.category==='MATERIAL'){M.transfers.push({actor:s,material:o,source:src,path:p,destination:d,kind:m.lemma,relationId:m.id});role(o,'MATERIAL');if(src)role(src,'CONTAINER');}
  else if(m.type==='TRANSFER'&&/^(?:SEND|REMOVE)$/.test(m.lemma)&&s&&q&&m.quantity?.category==='MATERIAL'&&physical(m.subject)){M.transfers.push({actor:s,material:q,source:src,path:p,destination:d,kind:m.lemma,relationId:m.id});if(p)role(p,'CONDUIT');}
  else if(m.type==='MOVE'&&/^(?:DRAIN|LEAVE|EXIT)$/.test(m.lemma)&&s&&m.subject?.category==='MATERIAL'&&!src&&(m.destination?.region==='OUTSIDE'||d==='fora')){M.drains.push({material:s,relationId:m.id});}
  else if(m.type==='MOVE'&&m.lemma==='LEAVE'&&s&&m.subject?.category==='MATERIAL'&&src&&physical(m.source)){M.losses.push({content:src,material:s,partial:false,relationId:m.id});role(src,'CONTENT');}
  else if(m.type==='TRANSFER'&&m.lemma==='RELEASE'&&s&&q&&m.quantity?.category==='MATERIAL'&&physical(m.subject)){M.losses.push({content:s,material:q,partial:m.qualifiers.includes('PARTIAL'),relationId:m.id});role(s,'CONTENT');}
 }
 // An actor that moves a material along a stated source/route is pump-like; its route ends at an outlet when the material is
 // stated to leave the system.
 for(const t of M.transfers){role(t.actor,t.source||t.path?'PUMP_LIKE':'ACTUATOR');if(t.path&&M.drains.length)role(t.path,'OUTLET');}
 // A surface without a stated owner belongs to the single container whose boundary is named in the same sentence.
 for(const c of M.contacts.filter(c=>!c.owner)){const sid=rels.find(r=>r.id===c.relationId)!.sentenceId,cands=[...new Set(rels.filter(r=>r.sentenceId===sid&&r.id!==c.relationId).flatMap(r=>[...M.crossings.filter(x=>x.relationId===r.id).map(x=>x.boundary),...M.containment.filter(x=>x.relationId===r.id).map(x=>x.container)]))];
  if(cands.length===1){c.owner=cands[0];c.ownerResolution='SAME_SENTENCE';}}
 // Openings named once belong to their boundary for every crossing of it.
 for(const c of M.crossings.filter(c=>!c.openings)){const o=M.crossings.find(x=>x.boundary===c.boundary&&x.openings);if(o)c.openings=o.openings;}
 // A crossing whose direction is unstated takes the direction another crossing of the same boundary states.
 for(const c of M.crossings.filter(c=>c.to==='UNSTATED')){const o=M.crossings.find(x=>x.boundary===c.boundary&&x.to!=='UNSTATED');if(o)c.to=o.to;}
 for(const r of M.rotating){const holds=M.follows.some(f=>f.container===r.subject)||M.contacts.some(c=>c.owner===r.subject)||M.crossings.some(c=>c.boundary===r.subject)||M.containment.some(c=>c.kind==='SURROUND'&&c.content===r.subject||c.container===r.subject&&c.kind!=='INSIDE_PHRASE');if(holds)role(r.subject,'INNER_CONTAINER');}
 const main=u.entities.find(e=>e.id===u.mainSubjectId);M.system=main?singular(fold(main.heads[0]??'')):null;if(M.system)role(M.system,'SYSTEM');
 const rotatingContainer=M.rotating.some(r=>M.roles[r.subject]?.includes('INNER_CONTAINER')),nested=M.containment.some(c=>M.containment.some(x=>x.content===c.container&&x.kind!=='INSIDE_PHRASE')||c.kind==='SURROUND'),pumped=M.transfers.some(t=>t.source||t.path);
 M.active=rotatingContainer||M.crossings.length>0||nested||pumped;
 M.reason=[rotatingContainer&&'rotating container holding something',M.crossings.length&&'material crossing a boundary',nested&&'nested containers',pumped&&'actuator moving a material along a stated source/route'].filter(Boolean).join('; ')||'no containment structure';
 return M;
}
export interface PhysicalCarrier {relationId:string;sentenceId:string;focus:string;zone:CameraZone;ops:BeatOperation[];level:'DIRECT'|'PARTIAL'|'SYMBOLIC';rationale:string;intent:string;
 /** state each op leaves behind (for the planner's transitions). */
 changes:{entityId:string;operation:string;parameter:string|null;to:number|boolean;reason:string|null}[]}
export interface ContainmentPlan {model:PhysicalModel;entityIds:Record<string,string>;carrierIds:string[];handled:string[];gaps:{relationId:string;sentenceId:string;reason:string}[];
 draftFor:(relationId:string)=>PhysicalCarrier|null;features:string[]}
const r3=(v:Vec3):Vec3=>v.map(x=>+x.toFixed(3)) as Vec3;
/** Layout + carriers. `entities` is mutated: parts get their functional assembly and a place inside the system housing. */
export function planContainment(u:ScriptUnderstanding,entities:WorldEntity[],L:MechanismLayout,worldId:string,known:Set<string>,clock:{fps:number;total:number;startOf:(sentenceId:string)=>number}):ContainmentPlan|null{
 const M=physicalModel(u,known);if(!M.active)return null;
 const rels=(u.mechanism??[]).filter(m=>known.has(m.id));
 const cites=(h:string)=>rels.filter(m=>[m.subject,m.object,m.destination,m.source,m.quantity,m.path,m.propertyOwner].some(x=>H(x)===h)).map(m=>m.id).sort();
 const text=(h:string)=>{for(const m of rels)for(const x of [m.subject,m.object,m.destination,m.source,m.quantity,m.path,m.propertyOwner])if(H(x)===h&&x)return x.text.replace(/^(?:o|a|os|as|um|uma|esse|essa|uns|umas)\s+/i,'');return h;};
 const headsOf=(e:WorldEntity)=>(e.scriptEntityIds??[]).flatMap(id=>u.entities.find(x=>x.id===id)?.heads??[]).map(x=>singular(fold(x))).concat(e.label?[singular(fold(e.label.split(/\s+/)[0]))]:[]);
 const find=(h:string)=>entities.find(e=>e.role!=='CONTEXT_PROP'&&headsOf(e).includes(h));
 const ids:Record<string,string>={},gaps:ContainmentPlan['gaps']=[],carrierIds:string[]=[],features:string[]=[];
 const make=(h:string,patch:Partial<WorldEntity>&Pick<WorldEntity,'kind'|'assembly'|'size'|'position'>):WorldEntity=>{let e=find(h);const rel=cites(h);
  if(!e){e={entityId:'part_'+h.replace(/[^a-z0-9]/g,''),worldId,role:'SYSTEM_COMPONENT',grounding:rel.length?'FACTUAL':'EDITORIAL',abstraction:rel.length?'ABSTRACT_SYSTEM_REPRESENTATION':'EDITORIAL_CONTEXT_FROM_SENTENCE',relationIds:rel,participant:text(h),label:text(h),scriptEntityIds:[],kind:patch.kind,size:patch.size,position:patch.position,rotation:[0,0,0],color:'#b9c7cf',initiallyVisible:true};entities.push(e);}
  else if(rel.length){e.relationIds=[...new Set([...e.relationIds,...rel])].sort();if(e.grounding==='EDITORIAL'){e.grounding='FACTUAL';e.abstraction='ABSTRACT_SYSTEM_REPRESENTATION';}}
  delete e.path;delete e.parentId;delete e.variant;Object.assign(e,{rotation:[0,0,0],initiallyVisible:true},patch);delete L.assemblyTargets[e.entityId];ids[h]=e.entityId;return e;};
 // ---- Housing: the system the script explains, when it holds the parts (stated containment or "dentro do X") ----
 const inner=M.rotating.map(r=>r.subject).find(h=>M.roles[h]?.includes('INNER_CONTAINER'))??M.containment.find(c=>c.kind==='SURROUND')?.content??null;
 const outer=M.containment.find(c=>c.kind==='SURROUND'&&c.content===inner)?.container??M.containment.find(c=>c.kind==='ACCUMULATE'&&c.container!==inner&&c.container!==M.system)?.container??M.transfers.find(t=>t.source&&t.source!==inner)?.source??null;
 const housingHead=L.enclosure?headsOf(L.enclosure)[0]:M.system&&M.containment.some(c=>c.container===M.system)?M.system:null;
 const W=2.4,HH=2.5,D=2.2;let hx=0,hz=0;
 // A housing that is itself the outer/inner vessel is drawn once, as that vessel (never two shapes for one thing).
 if(housingHead&&(housingHead===outer||housingHead===inner)){if(L.enclosure){hx=L.enclosure.position[0];hz=L.enclosure.position[2];}L.enclosure=null;}
 else if(housingHead){const hEnt=L.enclosure??make(housingHead,{kind:'CYLINDER',assembly:'ENCLOSURE',size:[W,HH,D],position:[0,HH/2,0]});hx=L.enclosure?L.enclosure.position[0]:0;hz=L.enclosure?L.enclosure.position[2]:0;
  Object.assign(hEnt,{kind:'CYLINDER',assembly:'ENCLOSURE',size:[W,HH,D],position:r3([hx,HH/2,hz]),initial:{activity:0}});ids[housingHead]=hEnt.entityId;L.enclosure=hEnt;features.push('HOUSING');if(hEnt.variant==='DOOR_FRONT')features.push('DOOR');}
 const base=housingHead?0.18:0,ro=0.85,ri=0.68,ch=1.3,cy=base+ch/2+0.08,cz=hz+0.1;
 if(outer){make(outer,{kind:'CYLINDER',assembly:'OUTER_CONTAINER',size:[ro*2,ch,ro*2],position:r3([hx,cy,cz]),initial:{fillLevel:0}});features.push('OUTER_CONTAINER');}
 const perforated=inner?M.crossings.some(c=>c.boundary===inner&&c.openings):false;
 if(inner){const rot=M.rotating.some(r=>r.subject===inner);make(inner,{kind:'CYLINDER',assembly:'ROTATING_CONTAINER',size:[ri*2,ch*0.85,ri*2],position:r3([hx,cy+0.04,cz]),initial:{activity:0},...(perforated?{variant:'PERFORATED' as const}:{})});
  features.push(rot?'INNER_ROTATING_CONTAINER':'INNER_CONTAINER');if(perforated)features.push('PERFORATED_WALL');}
 // Content inside the inner container: attached to it (moves with it) only when the script says how it behaves there.
 const contentHead=[...M.follows.map(f=>f.content),...M.contacts.map(c=>c.content),...M.losses.map(l=>l.content),...M.containment.filter(c=>c.container===inner&&c.kind!=='ACCUMULATE'&&M.roles[c.content]?.includes('CONTENT')).map(c=>c.content)].find(h=>h!==inner&&h!==outer)??null;
 const attached=Boolean(contentHead&&inner&&(M.follows.some(f=>f.content===contentHead&&f.container===inner)||M.contacts.some(c=>c.content===contentHead&&c.owner===inner)));
 const wet=M.losses.some(l=>l.content===contentHead)?1:0;
 if(contentHead){const c=make(contentHead,{kind:'CYLINDER',assembly:'CONTENT_ITEMS',size:[ri*1.7,ch*0.7,ri*1.7],position:inner&&attached?[0,0,0]:r3([hx,cy,cz]),initial:{activity:0,fillLevel:wet}});if(attached)c.parentId=ids[inner!];features.push('CONTENT');}
 // ---- Actuator and its route (source → actuator → path → outside) ----
 const t0=M.transfers.find(t=>t.source||t.path),pump=t0?.actor??null,pathHead=M.transfers.find(t=>t.path)?.path??null;
 const px=hx+W/2-0.45,py=0.3,pz=hz+D/2-0.42;
 if(pump){make(pump,{kind:'CYLINDER',assembly:'MACHINE_UNIT',variant:'PUMP_LIKE',size:[0.55,0.45,0.42],position:r3([px,py,pz]),color:'#7f97a6',initial:{activity:0}});features.push('PUMP_LIKE');}
 const outlet:Vec3=outer?r3([hx+ro*0.55,base+0.1,cz+ro*0.55]):r3([hx,base+0.1,cz]);
 const pumpIn:Vec3=r3([px-0.32,py,pz]),pumpOut:Vec3=r3([px+0.05,py+0.28,pz]),wall:Vec3=r3([hx+W/2+0.06,py+0.35,pz]),out1:Vec3=r3([hx+W/2+0.4,py+0.35,pz]),out2:Vec3=r3([hx+W/2+0.65,0.08,pz]);
 if(pathHead||pump){const route:Vec3[]=pump?[outlet,pumpIn,pumpOut,wall,out1,out2]:[outlet,wall,out1,out2];
  if(pathHead){make(pathHead,{kind:'PATH',assembly:'PIPE',size:[0.09,0.09,0.09],position:[0,0,0],path:route,color:'#5c6f7c',initial:{connection:1}});features.push(M.roles[pathHead]?.includes('OUTLET')?'OUTLET_CONDUIT':'CONDUIT');}}
 // ---- Carriers: material crossing, collecting, being pulled and sent out (each an event path) ----
 const dirXZ=[0.55,0.83],at=(r:number,y:number):Vec3=>r3([hx+dirXZ[0]*r,y,cz+dirXZ[1]*r]),midY=cy+0.12;
 const carrier=(id:string,pts:Vec3[],rel:string):string=>{const e:WorldEntity={entityId:id,worldId,role:'SYSTEM_COMPONENT',grounding:'FACTUAL',abstraction:'ABSTRACT_SYSTEM_REPRESENTATION',relationIds:[rel],participant:null,label:null,scriptEntityIds:[],kind:'PATH',assembly:'TRANSFER_PATH',variant:'PHASE',size:[0.08,0.08,0.08],position:[0,0,0],path:pts.map(r3),rotation:[0,0,0],color:'#2f86e0',initiallyVisible:false,initial:{connection:1,flowProgress:0,amount:0.2}};entities.push(e);carrierIds.push(id);return id;};
 const handled:string[]=[];
 // Planner-time state (one value per entity/parameter, in story order).
 const st:Record<string,number>={};const get=(id:string,p:string,d=0)=>st[id+'|'+p]??d;const set=(id:string,p:string,v:number)=>{st[id+'|'+p]=v;};
 if(contentHead)set(ids[contentHead],'fillLevel',wet);
 const spinning=new Set<string>();
 const flowOps=(id:string,a=0.18,b=0.72):BeatOperation[]=>{const e=entities.find(x=>x.entityId===id)!;return[{operation:'REVEAL',target:id,parameters:{},startOffset:0.04,endOffset:0.1},{operation:'FLOW',target:id,parameters:{path:e.path,from:0,to:1,direction:'FORWARD',speed:1,amount:0.2},startOffset:a,endOffset:b},{operation:'HIDE',target:id,parameters:{},startOffset:0.96,endOffset:1}];};
 const flowChanges=(id:string)=>[{entityId:id,operation:'REVEAL',parameter:null,to:true,reason:'Material appears where the stated movement starts'},{entityId:id,operation:'FLOW',parameter:'flowProgress',to:1,reason:null},{entityId:id,operation:'HIDE',parameter:null,to:false,reason:'The movement event is over'}];
 const cite=(id:string,rel:string)=>{const e=entities.find(x=>x.entityId===id);if(e&&!e.relationIds.includes(rel)){e.relationIds=[...e.relationIds,rel].sort();if(e.grounding==='EDITORIAL'){e.grounding='FACTUAL';e.abstraction='ABSTRACT_SYSTEM_REPRESENTATION';}}};
 const specs=new Map<string,()=>PhysicalCarrier|null>();const sid=(rel:string)=>rels.find(r=>r.id===rel)!.sentenceId;
 for(const r of M.rotating){if(!ids[r.subject])continue;handled.push(r.relationId);specs.set(r.relationId,()=>{const id=ids[r.subject];cite(id,r.relationId);
  if(!spinning.has(id)){spinning.add(id);const to=+(-Math.PI*2*0.8/clock.fps*(clock.total-clock.startOf(sid(r.relationId)))).toFixed(4),act=get(id,'activity');set(id,'activity',1);
   return{relationId:r.relationId,sentenceId:sid(r.relationId),focus:id,zone:'ACTION',intent:'CONTAINER_ROTATES',level:'DIRECT',rationale:'The stated container turns (and keeps turning)',
    ops:[{operation:'ROTATE',target:id,parameters:{from:[0,0,0],to:[0,to,0]},startOffset:0.1,endOffset:1,sustain:true},...(act<1?[{operation:'INCREASE' as const,target:id,parameters:{parameter:'activity',from:act,to:1},startOffset:0.1,endOffset:0.7}]:[])],
    changes:[{entityId:id,operation:'ROTATE',parameter:'spin',to:1,reason:null},...(act<1?[{entityId:id,operation:'INCREASE',parameter:'activity',to:1,reason:null}]:[])]};}
  return{relationId:r.relationId,sentenceId:sid(r.relationId),focus:id,zone:'ACTION',intent:'CONTAINER_KEEPS_ROTATING',level:'SYMBOLIC',rationale:'The container is still turning (sustained)',ops:[{operation:'ROTATE',target:id,parameters:{},startOffset:0,endOffset:1,observed:'SUSTAINED_STEP'}],changes:[]};});}
 for(const c of M.contacts){const cid=contentHead===c.content?ids[c.content]:undefined;if(!cid||!attached||c.owner!==inner){gaps.push({relationId:c.relationId,sentenceId:sid(c.relationId),reason:c.owner?'Contact surface belongs to a container not drawn as holding the content':'Surface owner not stated (no single container named in the sentence)'});handled.push(c.relationId);continue;}
  handled.push(c.relationId);specs.set(c.relationId,()=>{cite(cid,c.relationId);const from=get(cid,'activity');set(cid,'activity',1);if(from>=1)return null;
   return{relationId:c.relationId,sentenceId:sid(c.relationId),focus:cid,zone:'COMPONENT',intent:'CONTENT_PRESSED_AGAINST_WALL',level:'PARTIAL',rationale:'The content moves out against the container wall (stated contact)',ops:[{operation:'INCREASE',target:cid,parameters:{parameter:'activity',from,to:1},startOffset:0.15,endOffset:0.7}],changes:[{entityId:cid,operation:'INCREASE',parameter:'activity',to:1,reason:null}]};});}
 for(const f of M.follows){const cid=ids[f.content],kid=ids[f.container];handled.push(f.relationId);if(!cid||!kid||!attached){gaps.push({relationId:f.relationId,sentenceId:sid(f.relationId),reason:'Content/container not both drawn'});continue;}
  specs.set(f.relationId,()=>{cite(cid,f.relationId);cite(kid,f.relationId);const basis=spinning.has(kid);
   return{relationId:f.relationId,sentenceId:sid(f.relationId),focus:kid,zone:'ACTION',intent:'CONTENT_MOVES_WITH_CONTAINER',level:'SYMBOLIC',rationale:'The content turns with its container (attached because the script says it follows it)',ops:[...(basis?[{operation:'ROTATE' as const,target:kid,parameters:{},startOffset:0,endOffset:1,observed:'SUSTAINED_STEP' as const}]:[]),{operation:'HIGHLIGHT',target:cid,parameters:{amount:0.15},startOffset:0,endOffset:1}],changes:[]};});}
 // Crossings: inside → wall (through an opening) → outside, on the camera-facing side.
 for(const c of M.crossings){const kid=ids[c.boundary];handled.push(c.relationId);if(!kid||c.boundary!==inner){gaps.push({relationId:c.relationId,sentenceId:sid(c.relationId),reason:'Boundary not drawn as a container wall'});continue;}
  if(c.to==='UNSTATED'){gaps.push({relationId:c.relationId,sentenceId:sid(c.relationId),reason:'Direction of the crossing not stated'});continue;}
  const pts=[at(ri*0.55,midY),at(ri*0.98,midY-0.03),at(ri+(ro-ri)*0.55,midY-0.12),at(ri+(ro-ri)*0.6,midY-0.3)],id=carrier('cross_'+c.relationId.toLowerCase(),c.to==='OUTSIDE'?pts:[...pts].reverse(),c.relationId);
  specs.set(c.relationId,()=>{cite(id,c.relationId);cite(kid,c.relationId);return{relationId:c.relationId,sentenceId:sid(c.relationId),focus:kid,zone:'COMPONENT',intent:'MATERIAL_PASSES_THROUGH_BOUNDARY',level:c.openings?'PARTIAL':'SYMBOLIC',
   rationale:c.openings?'The material crosses the container wall through its stated openings':'The material crosses the container wall; openings are not stated (VISUAL_GAP: none drawn)',ops:flowOps(id),changes:flowChanges(id)};});
  if(!c.openings)gaps.push({relationId:c.relationId,sentenceId:sid(c.relationId),reason:'VISUAL_GAP: crossing shown, openings not stated'});}
 for(const a of M.containment.filter(x=>x.kind==='ACCUMULATE')){const oid=ids[a.container];handled.push(a.relationId);if(!oid||a.container!==outer){gaps.push({relationId:a.relationId,sentenceId:sid(a.relationId),reason:'Collecting container not drawn'});continue;}
  const id=carrier('collect_'+a.relationId.toLowerCase(),[at(ri+(ro-ri)*0.6,midY-0.3),at(ri+(ro-ri)*0.6,base+0.35),at(ri+(ro-ri)*0.4,base+0.16)],a.relationId);
  specs.set(a.relationId,()=>{cite(id,a.relationId);cite(oid,a.relationId);const from=get(oid,'fillLevel'),to=Math.max(from,0.35);set(oid,'fillLevel',to);
   return{relationId:a.relationId,sentenceId:sid(a.relationId),focus:oid,zone:'COMPONENT',intent:'MATERIAL_COLLECTS',level:'PARTIAL',rationale:'The material collects in the stated container (its level rises)',ops:[...flowOps(id,0.12,0.55),...(to>from?[{operation:'INCREASE' as const,target:oid,parameters:{parameter:'fillLevel',from,to},startOffset:0.4,endOffset:0.85}]:[])],changes:[...flowChanges(id),...(to>from?[{entityId:oid,operation:'INCREASE',parameter:'fillLevel',to,reason:null}]:[])]};});}
 for(const s of M.containment.filter(x=>x.kind==='SURROUND'||x.kind==='CONTAIN')){handled.push(s.relationId);const target=ids[s.container]??(L.enclosure?.entityId);
  specs.set(s.relationId,()=>{if(!target)return null;cite(target,s.relationId);return{relationId:s.relationId,sentenceId:sid(s.relationId),focus:target,zone:'SYSTEM',intent:s.kind==='SURROUND'?'OUTER_AROUND_INNER':'CONTENT_INSIDE_CONTAINER',level:'SYMBOLIC',rationale:'Containment shown by the nested drawing (a state, no change)',ops:[{operation:'HIGHLIGHT',target,parameters:{amount:0.15},startOffset:0,endOffset:1}],changes:[]};});}
 const pid=pump?ids[pump]:undefined;
 for(const t of M.transfers){handled.push(t.relationId);if(!pid||t.actor!==pump){gaps.push({relationId:t.relationId,sentenceId:sid(t.relationId),reason:'Actuator not drawn'});continue;}
  if((t.kind==='PULL'||t.kind==='PUSH')&&t.source&&ids[t.source]){const oid=ids[t.source],id=carrier('pull_'+t.relationId.toLowerCase(),[outlet,r3([(outlet[0]+pumpIn[0])/2,outlet[1]+0.05,(outlet[2]+pumpIn[2])/2]),pumpIn],t.relationId);
   specs.set(t.relationId,()=>{cite(id,t.relationId);cite(pid,t.relationId);cite(oid,t.relationId);const a=get(pid,'activity'),f=get(oid,'fillLevel'),to=Math.min(f,0.12);set(pid,'activity',1);set(oid,'fillLevel',to);
    return{relationId:t.relationId,sentenceId:sid(t.relationId),focus:pid,zone:'COMPONENT',intent:'ACTUATOR_PULLS_FROM_SOURCE',level:'PARTIAL',rationale:'The actuator runs and draws the material out of the stated source',
     ops:[...(a<1?[{operation:'INCREASE' as const,target:pid,parameters:{parameter:'activity',from:a,to:1},startOffset:0.08,endOffset:0.25}]:[]),...flowOps(id,0.25,0.7),...(to<f?[{operation:'DECREASE' as const,target:oid,parameters:{parameter:'fillLevel',from:f,to},startOffset:0.3,endOffset:0.8}]:[])],
     changes:[...(a<1?[{entityId:pid,operation:'INCREASE',parameter:'activity',to:1,reason:null}]:[]),...flowChanges(id),...(to<f?[{entityId:oid,operation:'DECREASE',parameter:'fillLevel',to,reason:null}]:[])]};});continue;}
  if(t.path&&ids[t.path]){const route=entities.find(e=>e.entityId===ids[t.path!])!.path!,id=carrier('send_'+t.relationId.toLowerCase(),route.slice(pump?2:1),t.relationId);
   specs.set(t.relationId,()=>{cite(id,t.relationId);cite(pid,t.relationId);const a=get(pid,'activity');set(pid,'activity',1);
    return{relationId:t.relationId,sentenceId:sid(t.relationId),focus:ids[t.path!],zone:'ACTION',intent:'ACTUATOR_SENDS_ALONG_ROUTE',level:'PARTIAL',rationale:'The material leaves the actuator along the stated conduit',ops:[...(a<1?[{operation:'INCREASE' as const,target:pid,parameters:{parameter:'activity',from:a,to:1},startOffset:0.05,endOffset:0.15}]:[]),...flowOps(id,0.15,0.75)],changes:[...(a<1?[{entityId:pid,operation:'INCREASE',parameter:'activity',to:1,reason:null}]:[]),...flowChanges(id)]};});continue;}
  gaps.push({relationId:t.relationId,sentenceId:sid(t.relationId),reason:'Neither a stated source nor a stated route to show'});}
 for(const d of M.drains){handled.push(d.relationId);const route=pathHead&&ids[pathHead]?entities.find(e=>e.entityId===ids[pathHead])!.path!:null;if(!route){gaps.push({relationId:d.relationId,sentenceId:sid(d.relationId),reason:'No stated route out of the system'});continue;}
  const id=carrier('drain_'+d.relationId.toLowerCase(),route,d.relationId);specs.set(d.relationId,()=>{cite(id,d.relationId);return{relationId:d.relationId,sentenceId:sid(d.relationId),focus:ids[pathHead!],zone:'ACTION',intent:'MATERIAL_LEAVES_SYSTEM',level:'PARTIAL',rationale:'The material leaves along the route the script stated earlier',ops:flowOps(id,0.1,0.8),changes:flowChanges(id)};});}
 for(const l of M.losses){handled.push(l.relationId);const cid=ids[l.content];if(!cid){gaps.push({relationId:l.relationId,sentenceId:sid(l.relationId),reason:'Content not drawn'});continue;}
  specs.set(l.relationId,()=>{cite(cid,l.relationId);const from=get(cid,'fillLevel',wet),to=+(l.partial?Math.max(0.25,from-0.5):Math.max(0,from-0.35)).toFixed(2);if(to>=from)return null;set(cid,'fillLevel',to);
   return{relationId:l.relationId,sentenceId:sid(l.relationId),focus:cid,zone:'COMPONENT',intent:'CONTENT_LOSES_MATERIAL',level:'PARTIAL',rationale:'The content holds less of the material (qualitative; '+(l.partial?'part of it, as stated':'as stated')+')',ops:[{operation:'DECREASE',target:cid,parameters:{parameter:'fillLevel',from,to},startOffset:0.15,endOffset:0.75}],changes:[{entityId:cid,operation:'DECREASE',parameter:'fillLevel',to,reason:null}]};});}
 return{model:M,entityIds:ids,carrierIds,handled:[...new Set(handled)],gaps,features:[...new Set(features)],draftFor:(rel)=>specs.get(rel)?.()??null};
}
