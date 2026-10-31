import type {Vec3} from '../engine3d/contracts';
import type {ScriptUnderstanding} from '../script-mode/contracts';
import type {MechRelation} from '../script-mode/mechanism';
import type {CameraZone,WorldEntity} from './contracts';
import type {MechanismLayout} from './demonstration-execution';
/** Phase29 bridge: admitted mechanism relations → visual carriers in the persistent world. Each relation gets the
 * honest carrier its participants allow (a transfer path for heat or material, a state tint at the component where the
 * change is stated, a pressure indicator for a property change) or a recorded gap. Positions are staging derived from
 * the layout (enclosure, parts behind, circuit parts); nothing is added that the relation does not state. */
const r3=(v:Vec3):Vec3=>v.map(x=>+x.toFixed(3)) as Vec3;
export interface MechanismCarrier {relationId:string;sentenceId:string;entityId:string;
 /** Route carriers: the component the material leaves; state carriers: the component where the state is shown. */
 fromEntityId?:string;atEntityId?:string;operation:'FLOW'|'INCREASE'|'DECREASE';parameter:'flowProgress'|'activity'|'fillLevel';to:number;
 visualSubject:string;action:string;observableChange:string;result:string;cameraTarget:string;zone:CameraZone;supportLevel:'DIRECT'|'PARTIAL'|'SYMBOLIC'}
export interface MechanismGap {relationId:string;sentenceId:string;reason:string}
/** Relations the clause claims already execute in the same sentence (no double demonstration). */
const COVERED:Record<string,string[]>={PASS:['FLOW'],FLOW:['FLOW'],BOIL:['BOIL'],BECOME:['BOIL'],SWITCH_OFF:['DEACTIVATE'],SWITCH_ON:['ACTIVATE'],OPEN:['OPEN'],CLOSE:['CLOSE'],ENTER:['ARRIVE','FLOW'],RETURN:[]};
export function planMechanismCarriers(u:ScriptUnderstanding,entities:WorldEntity[],L:MechanismLayout,worldId:string,known:Set<string>){
 const carriers:MechanismCarrier[]=[],gaps:MechanismGap[]=[],covered:string[]=[];
 const rels=(u.mechanism??[]).filter(m=>known.has(m.id));
 const enc=L.enclosure;
 const byHead=(head:string|null|undefined)=>head?entities.find(e=>e.kind!=='PATH'&&(e.scriptEntityIds??[]).some(id=>u.entities.find(x=>x.id===id)?.heads.some(h=>h.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()===head))):undefined;
 const add=(e:WorldEntity)=>{entities.push(e);return e;};
 const path=(id:string,rel:MechRelation,pts:Vec3[],thermal:boolean)=>add({entityId:id,worldId,role:'SYSTEM_COMPONENT',grounding:'FACTUAL',abstraction:'ABSTRACT_SYSTEM_REPRESENTATION',relationIds:[rel.id],participant:null,label:null,scriptEntityIds:[],kind:'PATH',assembly:'TRANSFER_PATH',variant:thermal?'THERMAL':'PHASE',size:[0.08,0.08,0.08],position:[0,0,0],path:pts.map(r3),rotation:[0,0,0],color:thermal?'#ff8a2a':'#2f86e0',initiallyVisible:true,initial:{connection:1,flowProgress:0}});
 const tint=(id:string,at:Vec3,size:Vec3,variant:'THERMAL'|'PHASE',fill:number,rel:MechRelation)=>{const t=entities.find(e=>e.entityId===id);if(t){t.relationIds=[...new Set([...t.relationIds,rel.id])].sort();return t;}
  return add({entityId:id,worldId,role:'SYSTEM_COMPONENT',grounding:'FACTUAL',abstraction:'ABSTRACT_SYSTEM_REPRESENTATION',relationIds:[rel.id],participant:null,label:null,scriptEntityIds:[],kind:'CYLINDER',assembly:'STATE_TINT',variant,size:r3(size),position:r3(at),rotation:[0,0,0],color:'#ffffff',initiallyVisible:true,initial:{fillLevel:fill,activity:0}});};
 if(!enc){for(const m of rels)gaps.push({relationId:m.id,sentenceId:m.sentenceId,reason:'No enclosing system in the layout to place the relation'});return{carriers,gaps,covered};}
 const [ex,ey,ez]=enc.position,[w,h,d]=enc.size,front=ez+d/2,back=ez-d/2;
 const behind=L.behind.map(id=>entities.find(e=>e.entityId===id)!).filter(Boolean)[0];
 const inner=entities.find(e=>e.kind==='PATH'&&L.inside.includes(e.entityId)),innerMid:Vec3=inner?.path?inner.path[Math.floor(inner.path.length/2)]:[ex,ey+h*0.25,ez];
 const machine=(head?:string|null)=>byHead(head)??null;
 // Where a part really sits once assembled (a part that enters later starts above its place).
 const pos=(e:WorldEntity):Vec3=>L.assemblyTargets[e.entityId]??e.position;
 for(const m of rels){
  const claimActs=u.actions.filter(a=>u.claims.find(c=>c.id===a.claimId)?.segmentId===m.sentenceId).map(a=>a.action);
  if((COVERED[m.lemma]??[]).some(a=>claimActs.includes(a as never))){covered.push(m.id);continue;}
  const q=m.quantity,qHeat=q?.category==='QUANTITY',subj=m.subject?.head??null,c=(x:Omit<MechanismCarrier,'relationId'|'sentenceId'>)=>carriers.push({relationId:m.id,sentenceId:m.sentenceId,...x});
  const at=(h0:string|undefined)=>h0?entities.find(e=>e.kind!=='PATH'&&(e.label??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().split(/\s+/)[0]===h0):undefined;
  switch(m.type){
   case 'TRANSFER':{
    if(!qHeat&&!q){gaps.push({relationId:m.id,sentenceId:m.sentenceId,reason:'Transfer without a stated quantity'});break;}
    const id='transfer_'+m.id.toLowerCase();
    if(m.lemma==='ENTER'){path(id,m,[[ex+0.3,ey-0.4,front+1.3],[ex+0.1,ey-0.3,front+0.4],[ex,ey-0.3,ez+0.1]],true);c({entityId:id,operation:'FLOW',parameter:'flowProgress',to:1,visualSubject:q!.text,action:'enters',observableChange:'warm particles travel from outside into the enclosure',result:'the quantity is inside',cameraTarget:enc.entityId,zone:'SYSTEM',supportLevel:'PARTIAL'});break;}
    // Taken from the inside: it ends against the inner back wall (still seen through the open front); sending it out crosses that wall.
    if(m.lemma==='REMOVE'){path(id,m,[[ex,ey-0.3,ez+0.1],[ex,ey+0.2,ez-0.2],[ex,ey+0.3,back+0.12]],true);c({entityId:id,operation:'FLOW',parameter:'flowProgress',to:1,visualSubject:q!.text,action:'is taken from the inside',observableChange:'warm particles leave the interior toward the back',result:'the inside loses the quantity',cameraTarget:enc.entityId,zone:'CUTAWAY',supportLevel:'PARTIAL'});break;}
    if(m.lemma==='SEND'&&m.destination?.region==='OUTSIDE'){path(id,m,[[ex,ey+0.3,back+0.12],[ex+0.3,ey+h*0.45,back-0.6],[ex+0.5,ey+h*0.7,back-1.2]],true);c({entityId:id,operation:'FLOW',parameter:'flowProgress',to:1,visualSubject:q!.text,action:'is sent outside',observableChange:'warm particles exit behind the enclosure',result:'the quantity is outside',cameraTarget:enc.entityId,zone:'SYSTEM',supportLevel:'PARTIAL'});break;}
    if(m.lemma==='ABSORB'&&inner){path(id,m,[[ex,ey-h*0.3,ez+0.1],[ex,ey,ez+0.1],innerMid],true);c({entityId:id,operation:'FLOW',parameter:'flowProgress',to:1,visualSubject:q!.text,action:'is absorbed by '+(m.subject?.text??'the material'),observableChange:'warm particles move from the interior into the enclosed path',result:'the material carries the quantity',cameraTarget:enc.entityId,zone:'CUTAWAY',supportLevel:'PARTIAL'});break;}
    const place=at(m.qualifiers.find(x=>x.startsWith('AT:'))?.slice(3));
    if(m.lemma==='RELEASE'&&place){const p=pos(place);// Into the surroundings: up and away from the housing (toward open space, not into the wall behind).
    const away=Math.sign(p[0]-ex)||1;path(id,m,[[p[0],p[1],p[2]-0.15],[p[0]+away*0.5,p[1]+0.6,p[2]-0.25],[p[0]+away*1.0,p[1]+1.1,p[2]-0.3]],true);c({entityId:id,operation:'FLOW',parameter:'flowProgress',to:1,visualSubject:q!.text,action:'is released'+(m.destination?' to '+m.destination.text:''),observableChange:'warm particles leave the component into the surroundings',result:'the material has lost the quantity',cameraTarget:place.entityId,zone:'COMPONENT',supportLevel:'PARTIAL'});break;}
    gaps.push({relationId:m.id,sentenceId:m.sentenceId,reason:'Transfer whose source/destination has no place in the layout'});break;}
   case 'MOVE':{const dest=m.destination?.region==='INSIDE'?enc:machine(m.destination?.head);const src=m.lemma==='RETURN'?behind:machine(u.mechanism?.find(x=>x.sentenceId===m.sentenceId&&x.type==='ACTION')?.subject?.head);
    if(!dest||!src||dest===src){gaps.push({relationId:m.id,sentenceId:m.sentenceId,reason:'Route endpoints not in the layout'});break;}
    const id='route_'+m.id.toLowerCase(),a=pos(src),b=dest===enc?(inner?.path?.at(-1)??[ex,ey,ez]):pos(dest);
    path(id,m,[[a[0],a[1]+0.3,a[2]],[(a[0]+b[0])/2,Math.max(a[1],b[1])+0.4,(a[2]+b[2])/2],[b[0],b[1],b[2]]],false);
    const gas=m.qualifiers.includes('ARRIVES_COLD')?false:true;entities.at(-1)!.initial={connection:1,flowProgress:0,amount:gas?1:0.3};
    c({fromEntityId:src.entityId,entityId:id,operation:'FLOW',parameter:'flowProgress',to:1,visualSubject:m.subject?.text??'material',action:m.lemma==='RETURN'?'returns':'goes',observableChange:'material particles travel along the route'+(m.after?' (arriving '+m.after.toLowerCase()+')':''),result:'the material is at '+(m.destination?.text??'its destination'),cameraTarget:dest.entityId,zone:'ACTION',supportLevel:m.after?'SYMBOLIC':'PARTIAL'});break;}
   case 'ACTION':{const actor=machine(subj);if(!actor){gaps.push({relationId:m.id,sentenceId:m.sentenceId,reason:'Actor not in the layout'});break;}
    const t=tint('tint_'+actor.entityId,pos(actor),[actor.size[0]+0.25,actor.size[1]+0.25,actor.size[2]+0.25],'THERMAL',0,m);
    c({atEntityId:actor.entityId,entityId:t.entityId,operation:'INCREASE',parameter:'activity',to:1,visualSubject:m.object?.text??'material',action:(m.subject?.text??'')+' '+m.predicate.text,observableChange:'the material at the component is agitated while the component acts',result:'the material has been acted on',cameraTarget:actor.entityId,zone:'COMPONENT',supportLevel:'PARTIAL'});break;}
   case 'STATE_CHANGE':{
    // where the change is stated: the actor of the sentence's action, or the stated place
    const actor=machine(u.mechanism?.find(x=>x.sentenceId===m.sentenceId&&x.type==='ACTION')?.subject?.head),place=at(m.qualifiers.find(x=>x.startsWith('AT:'))?.slice(3))??actor;
    if(!place||!m.after||!['HOT','COLD','LIQUID','GAS'].includes(m.after)){gaps.push({relationId:m.id,sentenceId:m.sentenceId,reason:m.after?'No component where this state change is stated':'No stated after-state'});break;}
    const thermal=m.after==='HOT'||m.after==='COLD',id='tint_'+place.entityId+(thermal?'':'_phase');
    const t=tint(id,pos(place),[place.size[0]+0.25,place.size[1]+0.25,Math.max(place.size[2],0.3)+0.25],thermal?'THERMAL':'PHASE',thermal?0:1,m);
    c({atEntityId:place.entityId,entityId:t.entityId,operation:m.after==='LIQUID'||m.after==='COLD'?'DECREASE':'INCREASE',parameter:'fillLevel',to:m.after==='LIQUID'||m.after==='COLD'?0:1,visualSubject:m.subject?.text??'material',action:m.predicate.text,observableChange:'state tint '+(thermal?'cold → hot':'gas → liquid')+' at '+(place.label??place.entityId),result:'state '+m.after.toLowerCase()+' persists',cameraTarget:place.entityId,zone:'COMPONENT',supportLevel:'PARTIAL'});break;}
   case 'PROPERTY_CHANGE':{let actor=machine(subj);
    // A part named only as the subject of this relation is placed on the return side of the circuit.
    if(!actor&&m.subject?.category==='PHYSICAL_ENTITY'&&m.direction!=='REACH'&&behind){const b=behind.position;actor=add({entityId:'part_'+m.subject.head,worldId,role:'SYSTEM_COMPONENT',grounding:'FACTUAL',abstraction:'ABSTRACT_SYSTEM_REPRESENTATION',relationIds:[m.id],participant:m.subject.text,label:m.subject.text,scriptEntityIds:[],kind:'BOX',assembly:'DISPLAY_BLOCK',size:[0.4,0.35,0.3],position:r3([ex-w*0.32,ey-h*0.2,ez-d/2-0.2]),rotation:[0,0,0],color:'#9aa7b1',initiallyVisible:true});void b;}
    // The enclosure's interior reaching a property value after the material came back cold into it: the interior cools
    // (qualitative — the value itself has no scale, so the support stays symbolic).
    const coldIn=rels.find(x=>x.type==='MOVE'&&x.destination?.region==='INSIDE'&&x.qualifiers.includes('ARRIVES_COLD')&&x.sentenceId<=m.sentenceId);
    if(m.direction==='REACH'&&m.subject?.category==='REGION'&&coldIn){const t=tint('interior_'+m.id.toLowerCase(),[ex,ey-h*0.2,ez+0.05],[w*0.8,h*0.4,d*0.7],'THERMAL',0.6,m);
     c({atEntityId:enc.entityId,entityId:t.entityId,operation:'DECREASE',parameter:'fillLevel',to:0.05,visualSubject:m.subject.text,action:m.predicate.text,observableChange:'the interior tint cools after the cold material came back inside (qualitative; the value is not shown)',result:'the interior is cold',cameraTarget:enc.entityId,zone:'CUTAWAY',supportLevel:'SYMBOLIC'});break;}
    if(!actor||m.direction==='REACH'){gaps.push({relationId:m.id,sentenceId:m.sentenceId,reason:m.direction==='REACH'?'A property reaching a value has no honest visual without a scale':'The component changing the property is not in the layout'});break;}
    const t=tint('pressure_'+actor.entityId,pos(actor),[actor.size[0]+0.3,actor.size[1]+0.3,actor.size[2]+0.3],'PHASE',1,m);
    c({entityId:t.entityId,operation:m.direction==='DOWN'?'DECREASE':'INCREASE',parameter:'fillLevel',to:m.direction==='DOWN'?0.25:1,visualSubject:(m.property??'property')+' of '+(m.propertyOwner?.text??'the material'),action:(m.subject?.text??'')+' '+m.predicate.text,observableChange:'the material density shown at the component '+(m.direction==='DOWN'?'drops':'rises')+' (qualitative)',result:(m.property??'property')+' '+(m.direction==='DOWN'?'lower':'higher'),cameraTarget:actor.entityId,zone:'COMPONENT',supportLevel:'SYMBOLIC'});break;}
   default:gaps.push({relationId:m.id,sentenceId:m.sentenceId,reason:'No carrier for '+m.type+':'+m.lemma});}
 }
 // A camera target that is a participant of the relation (e.g. the place heat is taken from) carries that relation too.
 const fold=(x:string)=>x.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
 for(const c of carriers){const t=entities.find(e=>e.entityId===c.cameraTarget),m=rels.find(r=>r.id===c.relationId)!;if(!t)continue;
  const heads=[m.subject,m.object,m.quantity,m.source,m.destination,m.path,m.propertyOwner].map(x=>x?.head).filter(Boolean) as string[];
  if(heads.some(h=>fold(t.label??'').split(/\s+/).includes(h))&&!t.relationIds.includes(m.id)){t.relationIds=[...t.relationIds,m.id].sort();if(t.grounding==='EDITORIAL'){t.grounding='FACTUAL';t.abstraction='ABSTRACT_SYSTEM_REPRESENTATION';}}}
 return{carriers,gaps,covered};
}
