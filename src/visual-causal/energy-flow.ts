import type {Vec3} from '../engine3d/contracts';
import type {ScriptUnderstanding} from '../script-mode/contracts';
import type {MechRef} from '../script-mode/mechanism';
import {singular} from '../script-mode/lexicon';
import type {BeatOperation,WorldEntity} from './contracts';
import type {MechanismLayout} from './demonstration-execution';
import type {PhysicalCarrier} from './containment';
/** Phase29 energy-flow class: radiant energy reaching a collector, charge carriers pushed into a conductor, a current that a
 * converter turns into another kind, distribution to consumers, surplus to a grid read by a meter. Built ONLY from admitted
 * relations (roles from what the script says happens — never from object names). Staging (where a part sits on the
 * building, the sky position of the source) is editorial; every movement/state shown is a stated relation. */
const fold=(x:string)=>x.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const H=(r?:MechRef|null)=>r?.head?singular(fold(r.head)):null;
const RADIANT=/^(?:luz|radiacao)$/;
export interface EnergyModel {source:string|null;receiver:string|null;collector:string|null;
 /** Words that name parts of the collector in the script ("X de Y da Z"): drawn by the collector, not as separate objects. */
 collectorParts:string[];carriers:string|null;conductor:string|null;converter:string|null;distributor:string|null;outlets:string|null;lamp:string|null;building:string|null;grid:string|null;meter:string|null;roof:string|null;yard:string|null;shade:string|null;active:boolean;roles:Record<string,string[]>}
export function energyModel(u:ScriptUnderstanding,known:Set<string>):EnergyModel{
 const rels=(u.mechanism??[]).filter(m=>known.has(m.id)&&!m.negated&&m.modality!=='POSSIBLE'),text=fold(u.source.normalized);
 const M:EnergyModel={source:null,receiver:null,collector:null,collectorParts:[],carriers:null,conductor:null,converter:null,distributor:null,outlets:null,lamp:null,building:null,grid:null,meter:null,roof:null,yard:null,shade:null,active:false,roles:{}};
 const role=(h:string|null,r:string)=>{if(!h)return;(M.roles[h]??=[]).includes(r)||M.roles[h].push(r);};
 // "luz do X": the radiant quantity's owner is its source; "<parte> de … da Y": the receiving part belongs to Y (the collector).
 const ownerChain=(head:string,within=text)=>[...within.matchAll(new RegExp('\\b'+head.slice(0,6)+'\\w*((?:\\s+(?:de|do|da|dos|das)\\s+\\w+)+)','g'))].flatMap(m=>[...m[1].matchAll(/d(?:e|o|a|os|as)\s+(\w+)/g)].map(x=>singular(x[1])).filter(x=>!/^(?:sua|seu|suas|seus|minha|meu|nossa|nosso)$/.test(x)));
 const subjects=new Set(rels.flatMap(m=>[H(m.subject)]).filter(Boolean) as string[]);
 for(const m of rels){const s=H(m.subject),q=H(m.quantity),d=H(m.destination),o=H(m.object),p=H(m.path),r=H(m.result);
  if(m.type==='TRANSFER'&&q&&RADIANT.test(q)&&d){const here=fold(u.segments.find(x=>x.id===m.sentenceId)?.span.text??'');M.receiver=d;M.source??=ownerChain(q,here)[0]??ownerChain(q)[0]??null;M.collector=ownerChain(d,here).reverse().find(x=>subjects.has(x))??ownerChain(d).reverse().find(x=>subjects.has(x))??ownerChain(d,here).at(-1)??d;M.collectorParts=[...new Set([d,...ownerChain(d,here)])].filter(x=>x!==M.collector);role(M.source,'RADIANT_SOURCE');role(M.collector,'COLLECTOR');}
  if(m.type==='ACTION'&&m.lemma==='PUSH'&&s&&RADIANT.test(s)&&o&&m.object?.category==='MATERIAL'){M.carriers=o;role(o,'CHARGE_CARRIER');}
  if(m.type==='MOVE'&&m.lemma==='PASS'&&s&&s===M.carriers&&p){M.conductor=p;role(p,'CONDUCTOR');}
  if(m.type==='CONVERT'&&m.lemma==='CONVERT'&&s){M.converter=s;role(s,'CONVERTER');}
  if(m.type==='TRANSFER'&&m.lemma==='ABSORB'&&s&&m.source?.category==='QUANTITY'){M.converter??=s;}
  if((m.type==='MOVE'||m.type==='TRANSFER')&&m.lemma==='GO'&&(q??s)&&d&&m.subject?.category==='QUANTITY'&&!/^(?:energia)$/.test(q??s??'')&&!M.distributor){M.distributor=d;role(d,'DISTRIBUTOR');}
  if((m.type==='MOVE'||m.type==='TRANSFER')&&m.lemma==='ARRIVE'&&d&&(q??s)&&!RADIANT.test(q??s??'')&&m.subject?.category==='QUANTITY'){M.outlets=d;role(d,'CONSUMER');}
  if(m.type==='STATE_CHANGE'&&(m.lemma==='LIGHT_UP'||m.after==='ON'||m.after==='OFF')&&s&&m.subject?.category!=='QUANTITY'){M.lamp??=s;role(s,'CONSUMER_LIGHT');}
  if(m.type==='ACTION'&&m.lemma==='USE'&&s&&m.subject?.category!=='QUANTITY'){M.building??=s;role(s,'CONSUMER_BUILDING');}
  if((m.type==='MOVE'||m.type==='TRANSFER')&&m.lemma==='GO'&&(q??s)==='energia'&&d){M.grid=d;role(d,'GRID');}
  if(m.type==='ACTION'&&m.lemma==='MEASURE'&&s){M.meter=s;role(s,'METER');}
  if(m.type==='MOVE'&&(m.lemma==='GO'||m.lemma==='PLACE')&&d&&(s===M.collector||o===M.collector||m.lemma==='PLACE')){if(m.lemma==='PLACE'){M.yard=d;M.shade=m.qualifiers.find(x=>x.startsWith('BELOW:'))?.slice(6)??null;}else M.roof=d;}
  if(m.type==='TRANSFER'&&m.lemma==='PRODUCE'&&s)role(s,'PRODUCER');
  void r;}
 // A roof/yard named for the collector belongs to the consuming building (staging: the building carries them).
 M.building??=M.roof||M.yard?(text.match(/\bcasa\b/)?'casa':null):null;
 M.active=Boolean(M.collector&&M.source&&(M.carriers||M.converter||M.conductor));
 return M;
}
export interface EnergyPlan {model:EnergyModel;entityIds:Record<string,string>;carrierIds:string[];handled:string[];gaps:{relationId:string;sentenceId:string;reason:string}[];draftFor:(relationId:string)=>PhysicalCarrier|null;forget:()=>void;features:string[];timeOfDay:(sentenceId:string)=>{ops:BeatOperation[];changes:PhysicalCarrier['changes']}}
const r3=(v:Vec3):Vec3=>v.map(x=>+x.toFixed(3)) as Vec3;
export function planEnergyFlow(u:ScriptUnderstanding,entities:WorldEntity[],L:MechanismLayout,worldId:string,known:Set<string>,clock:{read?:(id:string,p:string)=>number|undefined}):EnergyPlan|null{
 const M=energyModel(u,known);if(!M.active)return null;
 const rels=(u.mechanism??[]).filter(m=>known.has(m.id)),adm=rels.filter(m=>!m.negated&&m.modality!=='POSSIBLE');
 const headsOf=(e:WorldEntity)=>(e.scriptEntityIds??[]).flatMap(id=>u.entities.find(x=>x.id===id)?.heads??[]).map(x=>singular(fold(x))).concat(e.label?[singular(fold(e.label.split(/\s+/)[0]))]:[]);
 const cites=(h:string)=>adm.filter(m=>[m.subject,m.object,m.destination,m.source,m.quantity,m.path,m.result].some(x=>H(x)===h)).map(m=>m.id).sort();
 const word=(h:string)=>{const w=u.source.normalized.split(/[^\p{L}\p{N}-]+/u).find(x=>singular(fold(x))===h);return w??h;};
 const ids:Record<string,string>={},carrierIds:string[]=[],features:string[]=[],gaps:EnergyPlan['gaps']=[];
 // Parts the drawing now carries: any station drawn for the same head (or for a quantity/material of this class) leaves the stage.
 const mine=new Set([M.collector,M.receiver,M.carriers,M.conductor,M.converter,M.distributor,M.outlets,M.lamp,M.building,M.grid,M.meter,M.source,...M.collectorParts].filter(Boolean) as string[]);
 // Quantities and materials of this class (light, current, energy, carriers) are drawn as flows, never as objects.
 for(const e of u.entities)if(['QUANTITY','MATERIAL'].includes(e.category??'')||e.heads.some(h=>/^correntes?$/.test(fold(h))))for(const h of e.heads)mine.add(singular(fold(h)));
 for(let i=entities.length-1;i>=0;i--){const e=entities[i];if(e.role==='CONTEXT_PROP'||e.kind==='PATH'&&e.assembly!=='PIPE')continue;if(headsOf(e).some(h=>mine.has(h))&&!['TRANSFER_PATH','STATE_TINT'].includes(e.assembly??''))entities.splice(i,1);}
 const make=(h:string|null,id:string,patch:Partial<WorldEntity>&Pick<WorldEntity,'kind'|'assembly'|'size'|'position'>,editorial=false,also:string[]=[]):WorldEntity|null=>{if(!h)return null;
  // One thing, one drawing: a head already drawn in another role keeps its first drawing.
  if(ids[h])return entities.find(e=>e.entityId===ids[h])??null;
  const rel=editorial?[]:[...new Set([h,...also].flatMap(cites))].sort();
  const e:WorldEntity={entityId:id,worldId,role:'SYSTEM_COMPONENT',grounding:rel.length?'FACTUAL':'EDITORIAL',abstraction:rel.length?'ABSTRACT_SYSTEM_REPRESENTATION':'EDITORIAL_CONTEXT_FROM_SENTENCE',relationIds:rel,participant:word(h),label:word(h),scriptEntityIds:u.entities.filter(x=>x.heads.some(y=>[h,...also].includes(singular(fold(y))))).map(x=>x.id),rotation:[0,0,0],color:'#b9c7cf',initiallyVisible:true,...patch};entities.push(e);ids[h]=id;return e;};
 // ---- staging: building at the centre, the source high in the sky, parts on the building's side wall ----
 const W=3.2,HH=2.8,D=3.0,bx=0,bz=0,wallX=bx+W/2+0.14;
 const house=make(M.building,'energy_building',{kind:'BOX',assembly:'GABLED_BUILDING',size:[W,HH,D],position:[bx,HH/2,bz],color:'#e9d8b8'});if(house){house.role='MAIN_SYSTEM';features.push('BUILDING');}
 // The collector lies on the roof slope that faces the source (gabled roof: ridge along z, slopes face ±x).
 const slope=Math.atan2(0.4*HH,0.58*W),roofTop:Vec3=r3([bx+W*0.29,HH*0.62+HH*0.2+0.08,bz]),yardPos:Vec3=r3([bx-W/2-2.4,0.65,bz+2.2]);
 const sun=make(M.source,'energy_source',{kind:'CYLINDER',assembly:'RADIANT_SOURCE',size:[1.3,1.3,1.3],position:[bx+5.5,7.5,bz-3.5],initial:{activity:1}});if(sun)features.push('RADIANT_SOURCE');
 const start=M.yard?yardPos:roofTop;
 const panel=make(M.collector,'energy_collector',{kind:'CYLINDER',assembly:'COLLECTOR_PANEL',size:[1.3,0.08,1.9],position:start,rotation:M.yard?[0,0,-0.5]:[0,0,-slope],initial:{activity:0,fillLevel:0}},false,M.collectorParts);if(panel){features.push('COLLECTOR');if(!house)panel.role='MAIN_SYSTEM';}
 if(M.yard&&M.shade){const t=make(M.shade,'energy_shade',{kind:'CYLINDER',assembly:'SHADE_TREE',size:[2.2,3.2,2.2],position:r3([yardPos[0]-0.3,1.6,yardPos[2]-0.6]),color:'#4f8a4a'},true);if(t)t.role='CONTEXT_PROP';}
 const conv=make(M.converter,'energy_converter',{kind:'CYLINDER',assembly:'MACHINE_UNIT',variant:'CONVERTER_LIKE',size:[0.55,0.7,0.24],position:[wallX,1.25,bz+0.7],color:'#dfe5ea',initial:{activity:0,fillLevel:0}});if(conv){features.push('CONVERTER');conv.rotation=[0,Math.PI/2,0];}
 const dist=make(M.distributor,'energy_distributor',{kind:'CYLINDER',assembly:'MACHINE_UNIT',variant:'DISTRIBUTOR_LIKE',size:[0.5,0.62,0.18],position:[wallX,1.25,bz-0.35],color:'#cfd6dc',initial:{activity:0}});if(dist){features.push('DISTRIBUTOR');dist.rotation=[0,Math.PI/2,0];}
 const outlet=make(M.outlets,'energy_outlets',{kind:'CYLINDER',assembly:'MACHINE_UNIT',variant:'OUTLET_LIKE',size:[0.3,0.3,0.08],position:[wallX,0.55,bz-0.95],color:'#f4f6f8',initial:{activity:0}});if(outlet){features.push('CONSUMER');outlet.rotation=[0,Math.PI/2,0];}
 const lamp=make(M.lamp,'energy_lamp',{kind:'CYLINDER',assembly:'CONSUMER_LAMP',size:[0.6,0.75,0.6],position:[wallX+0.26,1.95,bz-0.95],initial:{activity:0}});if(lamp)features.push('CONSUMER_LIGHT');
 const meter=make(M.meter,'energy_meter',{kind:'CYLINDER',assembly:'MACHINE_UNIT',variant:'METER_LIKE',size:[0.4,0.5,0.18],position:[wallX,1.25,bz+1.3],color:'#e8edf1',initial:{activity:0,fillLevel:0}});if(meter){features.push('METER');meter.rotation=[0,Math.PI/2,0];}
 const grid=make(M.grid,'energy_grid',{kind:'CYLINDER',assembly:'UTILITY_POLE',size:[0.3,5.2,0.3],position:[wallX+2.4,2.6,bz+1.6],initial:{activity:0}});if(grid)features.push('GRID');
 // Conductor: from the collector's final place down the wall to the converter.
 const wireRoute:Vec3[]=[r3([roofTop[0]+0.5,roofTop[1]-0.3,roofTop[2]+0.95]),r3([wallX,HH*0.62,bz+0.95]),r3([wallX,1.75,bz+0.95]),r3([wallX,1.62,bz+0.75])];
 const wire=make(M.conductor,'energy_conductor',{kind:'PATH',assembly:'PIPE',size:[0.04,0.04,0.04],position:[0,0,0],path:wireRoute,color:'#2d3439',initial:{connection:1}});if(wire)features.push('CONDUCTOR');
 // ---- carriers (event paths) ----
 const carrier=(id:string,pts:Vec3[],variant:'LIGHT'|'CHARGE'|'ALTERNATING',rel:string)=>{entities.push({entityId:id,worldId,role:'SYSTEM_COMPONENT',grounding:'FACTUAL',abstraction:'ABSTRACT_SYSTEM_REPRESENTATION',relationIds:[rel],participant:null,label:null,scriptEntityIds:[],kind:'PATH',assembly:'TRANSFER_PATH',variant,size:[0.08,0.08,0.08],position:[0,0,0],path:pts.map(r3),rotation:[0,0,0],color:variant==='LIGHT'?'#ffe066':variant==='CHARGE'?'#4fd1ff':'#ffb347',initiallyVisible:false,initial:{connection:1,flowProgress:0,amount:1}});carrierIds.push(id);return id;};
 const st:Record<string,number>={},get=(id:string,p:string)=>st[id+'|'+p]??clock.read?.(id,p)??entities.find(e=>e.entityId===id)?.initial?.[p]??0,set=(id:string,p:string,v:number)=>{st[id+'|'+p]=v;};
 const flow=(id:string,a=0.15,b=0.75):BeatOperation[]=>{const e=entities.find(x=>x.entityId===id)!;return[{operation:'REVEAL',target:id,parameters:{},startOffset:0.04,endOffset:0.1},{operation:'FLOW',target:id,parameters:{path:e.path,from:0,to:1,direction:'FORWARD',speed:1,amount:1},startOffset:a,endOffset:b},{operation:'HIDE',target:id,parameters:{},startOffset:0.96,endOffset:1}];};
 const flowCh=(id:string)=>[{entityId:id,operation:'REVEAL',parameter:null,to:true as number|boolean,reason:'The stated flow appears where it starts'},{entityId:id,operation:'FLOW',parameter:'flowProgress',to:1 as number|boolean,reason:null},{entityId:id,operation:'HIDE',parameter:null,to:false as number|boolean,reason:'The flow event is over'}];
 const ramp=(id:string,p:'activity'|'fillLevel',to:number,a=0.2,b=0.7)=>{const from=get(id,p);set(id,p,to);return from===to?null:{op:{operation:(to>from?'INCREASE':'DECREASE') as 'INCREASE'|'DECREASE',target:id,parameters:{parameter:p,from,to},startOffset:a,endOffset:b} as BeatOperation,ch:{entityId:id,operation:to>from?'INCREASE':'DECREASE',parameter:p,to,reason:null}};};
 const specs=new Map<string,()=>PhysicalCarrier|null>(),handled:string[]=[],sid=(rel:string)=>rels.find(r=>r.id===rel)!.sentenceId;
 const card=(rel:string,focus:string,intent:string,level:PhysicalCarrier['level'],why:string,ops:BeatOperation[],changes:PhysicalCarrier['changes'],zone:PhysicalCarrier['zone']='COMPONENT'):PhysicalCarrier=>{for(const o of ops){const e=entities.find(x=>x.entityId===o.target);if(e&&e.grounding==='FACTUAL'&&!e.relationIds.includes(rel))e.relationIds=[...e.relationIds,rel].sort();}return{relationId:rel,sentenceId:sid(rel),focus,zone,ops,level,rationale:why,intent,changes};};
 const pid=panel?.entityId,cid=conv?.entityId,did=dist?.entityId;
 const lightRoute=sun&&panel?[sun.position,r3([(sun.position[0]+roofTop[0])/2,(sun.position[1]+roofTop[1])/2+0.6,(sun.position[2]+roofTop[2])/2]),roofTop]:null;
 const onWall=(a:Vec3,b:Vec3):Vec3[]=>[a,r3([(a[0]+b[0])/2+0.06,(a[1]+b[1])/2,(a[2]+b[2])/2]),b];
 for(const m of adm){const s=H(m.subject),q=H(m.quantity),d=H(m.destination),o=H(m.object);let spec:(()=>PhysicalCarrier|null)|null=null;
  if(m.type==='MOVE'&&m.lemma==='PLACE'&&pid&&(o===M.collector||!o)){spec=()=>card(m.id,pid,'PART_PLACED',  'SYMBOLIC','The part is where the script places it',[{operation:'HIGHLIGHT',target:pid,parameters:{amount:0.15},startOffset:0,endOffset:1}],[],'ACTION');}
  else if(m.type==='ACTION'&&m.lemma==='COVER'&&o===M.collector&&pid){spec=()=>{const r=ramp(pid,'fillLevel',1);return card(m.id,pid,'COLLECTOR_SHADED','PARTIAL','The stated shade falls over the collector',r?[r.op]:[],r?[r.ch]:[]);};}
  else if(m.type==='MOVE'&&m.lemma==='GO'&&(s===M.collector)&&d===M.roof&&pid){spec=()=>{const from=entities.find(e=>e.entityId===pid)!.position,to=roofTop;return card(m.id,pid,'PART_MOVES_TO_PLACE','DIRECT','The collector goes to the stated place',[{operation:'MOVE',target:pid,parameters:{from:[...from],to:[...to]},startOffset:0.1,endOffset:0.75},{operation:'ROTATE',target:pid,parameters:{from:[0,0,-0.5],to:[0,0,+(-slope).toFixed(4)]},startOffset:0.1,endOffset:0.75}],[{entityId:pid,operation:'MOVE',parameter:'y',to:to[1],reason:null}],'ACTION');};}
  else if(m.type==='TRANSFER'&&q&&RADIANT.test(q)&&lightRoute&&pid){const id=carrier('light_'+m.id.toLowerCase(),lightRoute,'LIGHT',m.id);spec=()=>{const r=ramp(pid,'activity',1,0.55,0.85);return card(m.id,pid,'RADIANT_ENERGY_ARRIVES','PARTIAL','Light travels from its source and reaches the collector',[...flow(id,0.12,0.6),...(r?[r.op]:[])],[...flowCh(id),...(r?[r.ch]:[])],'ACTION');};}
  else if(m.type==='ACTION'&&m.lemma==='PUSH'&&s&&RADIANT.test(s)&&pid){const c=roofTop,id=carrier('charge_'+m.id.toLowerCase(),[r3([c[0]-0.55,c[1]+0.06,c[2]]),r3([c[0],c[1]+0.06,c[2]]),r3([c[0]+0.55,c[1]+0.06,c[2]])],'CHARGE',m.id);spec=()=>card(m.id,pid,'CARRIERS_PUSHED','SYMBOLIC','Charge carriers moving inside the collector (qualitative)',flow(id),flowCh(id));}
  else if(m.type==='MOVE'&&m.lemma==='PASS'&&s===M.carriers&&wire){const id=carrier('dc_'+m.id.toLowerCase(),wireRoute,'CHARGE',m.id);spec=()=>card(m.id,wire.entityId,'CARRIERS_FLOW_IN_CONDUCTOR','PARTIAL','The carriers travel along the stated conductor',flow(id),flowCh(id),'ACTION');}
  else if(m.type==='CONVERT'&&m.lemma==='FORM'&&wire){const id=carrier('form_'+m.id.toLowerCase(),wireRoute,'CHARGE',m.id);spec=()=>card(m.id,wire.entityId,'CURRENT_FORMED','PARTIAL','The carriers moving together along the conductor are the current',flow(id),flowCh(id),'ACTION');}
  else if(m.type==='MOVE'&&m.lemma==='GO'&&m.subject?.category==='QUANTITY'&&m.qualifiers.includes('DIRECTION')&&wire){const id=carrier('dir_'+m.id.toLowerCase(),wireRoute,'CHARGE',m.id);spec=()=>card(m.id,wire.entityId,'ONE_DIRECTION_CURRENT','PARTIAL','The current moves one way along the conductor',flow(id),flowCh(id),'ACTION');}
  else if(m.type==='TRANSFER'&&m.lemma==='ABSORB'&&s===M.converter&&cid&&wire){const id=carrier('in_'+m.id.toLowerCase(),wireRoute.slice(-3),'CHARGE',m.id);spec=()=>{const r=ramp(cid,'activity',1,0.5,0.8);return card(m.id,cid,'CONVERTER_RECEIVES','PARTIAL','The stated current reaches the converter, which starts working',[...flow(id,0.1,0.55),...(r?[r.op]:[])],[...flowCh(id),...(r?[r.ch]:[])]);};}
  else if(m.type==='CONVERT'&&m.lemma==='CONVERT'&&s===M.converter&&cid){const to=did?entities.find(e=>e.entityId===did)!.position:r3([wallX,1.25,bz-0.35]),id=carrier('ac_'+m.id.toLowerCase(),onWall(entities.find(e=>e.entityId===cid)!.position,to),'ALTERNATING',m.id);spec=()=>{const r=ramp(cid,'fillLevel',1,0.15,0.45);return card(m.id,cid,'CONVERTER_CHANGES_KIND','PARTIAL','What enters one way leaves alternating (qualitative)',[...(r?[r.op]:[]),...flow(id,0.45,0.85)],[...(r?[r.ch]:[]),...flowCh(id)]);};}
  else if((m.type==='MOVE'||m.type==='TRANSFER')&&m.lemma==='GO'&&d===M.distributor&&did&&cid){const id=carrier('dist_'+m.id.toLowerCase(),onWall(entities.find(e=>e.entityId===cid)!.position,entities.find(e=>e.entityId===did)!.position),'ALTERNATING',m.id);spec=()=>{const r=ramp(did,'activity',1,0.6,0.85);return card(m.id,did,'CURRENT_TO_DISTRIBUTION','PARTIAL','The current goes to the stated distribution point',[...flow(id),...(r?[r.op]:[])],[...flowCh(id),...(r?[r.ch]:[])]);};}
  else if((m.type==='MOVE'||m.type==='TRANSFER')&&m.lemma==='ARRIVE'&&d===M.outlets&&did&&outlet){const id=carrier('out_'+m.id.toLowerCase(),onWall(entities.find(e=>e.entityId===did)!.position,outlet.position),'ALTERNATING',m.id);spec=()=>{const r=ramp(outlet.entityId,'activity',1,0.6,0.85);return card(m.id,outlet.entityId,'CURRENT_REACHES_CONSUMERS','PARTIAL','The current reaches the stated consumers',[...flow(id),...(r?[r.op]:[])],[...flowCh(id),...(r?[r.ch]:[])]);};}
  else if(m.type==='STATE_CHANGE'&&s===M.lamp&&lamp&&(m.after==='ON'||m.after==='OFF')){spec=()=>{const r=ramp(lamp.entityId,'activity',m.after==='ON'?1:0,0.2,0.5);return card(m.id,lamp.entityId,m.after==='ON'?'CONSUMER_ON':'CONSUMER_OFF',r?'DIRECT':'SYMBOLIC','The stated consumer is '+(m.after==='ON'?'on':'off'),r?[r.op]:[{operation:'HIGHLIGHT',target:lamp.entityId,parameters:{amount:0.15},startOffset:0,endOffset:1}],r?[r.ch]:[]);};}
  else if(m.type==='TRANSFER'&&m.lemma==='PRODUCE'&&s===M.collector&&lightRoute&&pid){const id=carrier('prod_'+m.id.toLowerCase(),lightRoute,'LIGHT',m.id);spec=()=>{const r=ramp(pid,'activity',1);return card(m.id,pid,'COLLECTOR_PRODUCES','PARTIAL','Light keeps arriving and the collector keeps producing',[...flow(id),...(r?[r.op]:[])],[...flowCh(id),...(r?[r.ch]:[])],'ACTION');};}
  else if((m.type==='MOVE'||m.type==='TRANSFER')&&m.lemma==='GO'&&d===M.grid&&grid&&did){const via=meter?[entities.find(e=>e.entityId===did)!.position,meter.position,r3([grid.position[0],4.6,grid.position[2]])]:[entities.find(e=>e.entityId===did)!.position,r3([grid.position[0],4.6,grid.position[2]])],id=carrier('grid_'+m.id.toLowerCase(),via,'ALTERNATING',m.id);
   spec=()=>{const r=meter?ramp(meter.entityId,'activity',1,0.4,0.7):null;return card(m.id,grid.entityId,'SURPLUS_TO_GRID','PARTIAL','What is left goes out to the stated grid',[...flow(id),...(r?[r.op]:[])],[...flowCh(id),...(r?[r.ch]:[])],'ACTION');};}
  else if(m.type==='ACTION'&&m.lemma==='MEASURE'&&s===M.meter&&meter){spec=()=>{const r=ramp(meter.entityId,'fillLevel',1,0.15,0.85);return card(m.id,meter.entityId,'METER_COUNTS','PARTIAL','The stated meter counts (its reading advances)',r?[r.op]:[],r?[r.ch]:[]);};}
  else if(m.type==='ACTION'&&m.lemma==='USE'&&s===M.building&&house){const back=grid&&did?(meter?[r3([grid.position[0],4.6,grid.position[2]]),meter.position,entities.find(e=>e.entityId===did)!.position]:[r3([grid.position[0],4.6,grid.position[2]]),entities.find(e=>e.entityId===did)!.position]):null,id=back&&m.qualifiers.some(x=>x.startsWith('DURING:'))?carrier('use_'+m.id.toLowerCase(),back,'ALTERNATING',m.id):null;
   spec=()=>id?card(m.id,house.entityId,'BUILDING_USES_GRID','PARTIAL','At that time the building takes from the grid',flow(id),flowCh(id),'ACTION'):card(m.id,house.entityId,'BUILDING_USES','SYMBOLIC','The building uses it (stated)',[{operation:'HIGHLIGHT',target:house.entityId,parameters:{amount:0.1},startOffset:0,endOffset:1}],[]);}
  if(spec){specs.set(m.id,spec);handled.push(m.id);}}
 // Stated time of day (staging that follows the words): at night the source is gone and the collector goes dark.
 let night=false;
 const timeOfDay=(sentenceId:string):{ops:BeatOperation[];changes:PhysicalCarrier['changes']}=>{const seg=u.segments.find(s=>s.id===sentenceId);if(night||!seg||!sun||!pid)return{ops:[],changes:[]};const f=fold(seg.span.text).replace(/[^a-z ]/g,' ');
  if(!/\b(?:a noite|de noite)\b/.test(f))return{ops:[],changes:[]};night=true;const r=ramp(pid,'activity',0,0.2,0.6),dim=ramp(sun.entityId,'activity',0,0.02,0.3);
  // The source fades (the sky follows its brightness), then leaves the stage.
  return{ops:[...(dim?[dim.op]:[]),{operation:'HIDE',target:sun.entityId,parameters:{},startOffset:0.3,endOffset:0.34},...(r?[r.op]:[])],changes:[...(dim?[{...dim.ch,reason:'Night (stated time): the light source fades'}]:[]),{entityId:sun.entityId,operation:'HIDE',parameter:null,to:false,reason:'Night (stated time): the light source is gone'},...(r?[{...r.ch,reason:'Night (stated time): no light reaches the collector'}]:[])]};};
 return{model:M,entityIds:ids,carrierIds,handled,gaps,draftFor:rel=>specs.get(rel)?.()??null,forget:()=>{for(const k of Object.keys(st))delete st[k];},features:[...new Set(features)],timeOfDay};
}
