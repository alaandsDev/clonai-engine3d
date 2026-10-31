import type {Vec3} from '../engine3d/contracts';
import type {ScriptUnderstanding} from '../script-mode/contracts';
import type {WorldEntity} from './contracts';
import type {MechanismLayout} from './demonstration-execution';
/** Phase29 functional silhouettes. A part's shape is selected from the ROLE the admitted mechanism relations give it,
 * never from its name: the same rules draw any machine. Nothing internal is invented — each silhouette only shows the
 * function the script states (a powered part acting on the circulating material, a restriction that changes a property
 * of the flow, a surface where a quantity is exchanged with the surroundings, a controller that switches another part). */
/** Forms that are powered parts (a machine runs inside a housing that carries them). */
export const POWERED_FORMS=new Set<string>(['COMPRESSOR_LIKE','CONTROL_UNIT']);
export type FunctionalForm='HEAT_EXCHANGER'|'COMPRESSOR_LIKE'|'VALVE_LIKE'|'CONDUIT'|'RESERVOIR'|'COIL'|'CONTROL_UNIT';
export type FormVariant='COMPRESSOR_LIKE'|'VALVE_LIKE'|'HEAT_EXCHANGER'|'CONTROL_UNIT'|'COMPRESSION'|'PRESSURE';
export interface FormChoice {entityId:string;form:FunctionalForm;relationIds:string[];reason:string;
 /** A controller acts on this part (cause → effect is drawn between the two). */
 controls?:string;
 /** Staging position when the script does not state where the part is. */
 staged?:string}
const fold=(x:string)=>x.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const r3=(v:Vec3):Vec3=>v.map(x=>+x.toFixed(3)) as Vec3;
/** Volume-reducing actions (semantic lemmas from the parser): the material is squeezed, not just agitated. */
const SQUEEZE=new Set(['COMPRESS','SQUEEZE','PRESS']);
export function assignFunctionalForms(u:ScriptUnderstanding,entities:WorldEntity[],L:MechanismLayout,known:Set<string>):FormChoice[]{
 const rels=(u.mechanism??[]).filter(m=>known.has(m.id)),out:FormChoice[]=[];
 const byHead=(head?:string|null)=>head?entities.find(e=>e.kind!=='PATH'&&e!==L.enclosure&&((e.scriptEntityIds??[]).some(id=>u.entities.find(x=>x.id===id)?.heads.some(h=>fold(h)===head))||fold(e.label??'').split(/\s+/)[0]===head||e.entityId==='part_'+head)):undefined;
 const set=(e:WorldEntity,form:FunctionalForm,relationIds:string[],reason:string,extra:Partial<FormChoice>={})=>{if(e.form)return;e.form=form;out.push({entityId:e.entityId,form,relationIds,reason,...extra});};
 const place=(at:string|undefined)=>at?entities.find(e=>e.kind!=='PATH'&&fold(e.label??'').split(/\s+/)[0]===at):undefined;
 const onCircuit=(e:WorldEntity)=>e.entityId in L.assemblyTargets&&Boolean(L.circuit);
 for(const m of rels){
  if(m.type==='CONTROL'){const ctl=byHead(m.subject?.head),target=byHead(m.object?.head);
   if(ctl&&target&&ctl!==target){
    // A controller drawn as a small unit with an indicator: its own state change precedes the controlled part's.
    // Its location is not stated: it is staged beside the part it controls, on the housing side and a little higher, so it
    // never stands between a side camera and the controlled part.
    const t=L.assemblyTargets[target.entityId]??target.position,enc=L.enclosure,side=enc&&t[0]<enc.position[0]?1:-1;
    Object.assign(ctl,{kind:'CYLINDER',assembly:'MACHINE_UNIT',variant:'CONTROL_UNIT',size:[0.3,0.36,0.16],color:'#dfe5ea',initial:{activity:1}});
    ctl.position=r3([t[0]+side*(target.size[0]/2+0.2),t[1]+0.45,t[2]]);
    set(ctl,'CONTROL_UNIT',[m.id],'Subject of a control relation on another part ('+m.lemma+')',{controls:target.entityId,staged:'Location not stated: staged beside the controlled part'});}continue;}
  if(m.type==='ACTION'){const a=byHead(m.subject?.head);if(a&&a.assembly==='MACHINE_UNIT'&&onCircuit(a)){a.variant='COMPRESSOR_LIKE';set(a,'COMPRESSOR_LIKE',[m.id],'Powered part on the closed circuit acting on the circulating material ('+m.lemma+')');}
   // The material state at that part shows the action itself: squeezed (particles packed) rather than agitated.
   const tint=a?entities.find(e=>e.entityId==='tint_'+a.entityId):undefined;if(tint&&SQUEEZE.has(m.lemma))tint.variant='COMPRESSION';continue;}
  if(m.type==='PROPERTY_CHANGE'&&(m.direction==='DOWN'||m.direction==='UP')){const v=byHead(m.subject?.head);
   if(v&&v.assembly==='DISPLAY_BLOCK'){v.variant='VALVE_LIKE';v.size=[0.7,0.3,0.3];set(v,'VALVE_LIKE',[m.id],'Part that changes a property of the flowing material ('+(m.property??'property')+' '+m.direction.toLowerCase()+'): a restriction on the route');}
   const tint=v?entities.find(e=>e.entityId==='pressure_'+v.entityId):undefined;if(tint){tint.variant='PRESSURE';tint.size=[0.95,0.5,0.45];}continue;}
  if(m.type==='TRANSFER'&&(m.lemma==='RELEASE'||m.lemma==='ABSORB')&&m.quantity){const at=place(m.qualifiers.find(x=>x.startsWith('AT:'))?.slice(3));
   if(at&&at.assembly==='PANEL'){at.variant='HEAT_EXCHANGER';set(at,'HEAT_EXCHANGER',[m.id],'Surface where the quantity is exchanged with the surroundings ('+m.lemma+' '+m.quantity.text+')');}}
 }
 // Paths and containers keep their drawing; the form records what they are for (readability metric).
 for(const e of entities){if(e.form||e.role==='CONTEXT_PROP')continue;
  if(e.kind==='PATH'&&e.assembly==='PIPE')set(e,L.inside.includes(e.entityId)?'COIL':'CONDUIT',e.relationIds,L.inside.includes(e.entityId)?'Path folded inside the housing where the material changes state':'Closed path the material circulates through');
  else if(e.assembly==='OPEN_BASIN'||e.assembly==='VESSEL')set(e,'RESERVOIR',e.relationIds,'Container that holds the material');}
 return out;
}
