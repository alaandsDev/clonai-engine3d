import type {Vec3} from '../engine3d/contracts';
import {evaluateDirected,type DirectedSequence} from '../engine3d/directed';
import {evaluateDemonstration} from '../engine3d/demonstration-runtime';
import type {VisualCausalPlan,WorldEntity} from './contracts';
import {bounds,screenBox,pointStatus,worldPosition} from './qa';
import {causalReadability} from './readability';
/** Phase29 DEMONSTRATION QA — kept apart from technical QA. It asks whether the RIGHT mechanism is on screen, not whether
 * the camera is good: a perfect camera filming generic blocks, the wrong environment or a missing participant fails.
 * Each gate is PASS / FAIL / NOT_APPLICABLE with its measured value and threshold. */
export type Gate={status:'PASS'|'FAIL'|'NOT_APPLICABLE';value:number|null;threshold:string;detail?:unknown};
const FORM_FEATURES=new Set(['COMPRESSOR_LIKE','VALVE_LIKE','HEAT_EXCHANGER','CONTROL_UNIT','COIL','RESERVOIR','PUMP_LIKE']);
export function demonstrationQa(plan:VisualCausalPlan,seq:DirectedSequence){
 const ent=new Map(plan.world.entities.map(e=>[e.entityId,e])),T=plan.totalFrames,cl=(f:number)=>Math.max(0,Math.min(T-1,Math.round(f)));
 const ds=(f:number)=>seq.demonstration?evaluateDemonstration(seq.demonstration,cl(f)):null,cam=(f:number)=>evaluateDirected(seq,cl(f)).state.camera;
 const own=(e:WorldEntity,f:number):Vec3=>(ds(f)?.subjects[e.entityId]?.position as Vec3|undefined)??e.position;
 const pos=(e:WorldEntity,f:number):Vec3=>worldPosition(plan,ds(f),e);void own;
 const onScreen=(e:WorldEntity,f:number,min=0.04)=>{if(ds(f)?.subjects[e.entityId]?.visible===false)return false;const pts=e.kind==='PATH'?e.path!:bounds({...e,position:pos(e,f)}),b=screenBox(pts,cam(f),seq.width,seq.height);return(b?.extent??0)>=min&&(b?.visibleFraction??0)>=0.3;};
 const mid=(b:typeof plan.beats[number])=>{const o=b.operations.find(o=>!['HIGHLIGHT','REVEAL','HIDE'].includes(o.operation)&&!o.observed)??b.operations[0];const l=b.endFrame-b.startFrame;return o?b.startFrame+l*(o.startOffset+o.endOffset)/2:(b.startFrame+b.endFrame)/2;};
 const beatOf=(rel:string)=>plan.beats.find(b=>b.relationIds.includes(rel)&&b.grounding==='FACTUAL_DEMONSTRATION');
 const gate=(ok:boolean|null,value:number|null,threshold:string,detail?:unknown):Gate=>({status:ok===null?'NOT_APPLICABLE':ok?'PASS':'FAIL',value,threshold,...(detail!==undefined?{detail}:{})});
 const housing=plan.layout?.enclosure?ent.get(plan.layout.enclosure):plan.world.entities.find(e=>e.role==='MAIN_SYSTEM');
 // MAIN_SYSTEM_RECOGNIZABILITY: identity features beyond a plain shell, each seen together with the system.
 const featureEnts:Record<string,WorldEntity[]>={};const addF=(k:string,e?:WorldEntity)=>{if(e)(featureEnts[k]??=[]).push(e);};
 for(const e of plan.world.entities){if(e.form&&FORM_FEATURES.has(e.form))addF(e.form,e);if(e.assembly==='OUTER_CONTAINER')addF('OUTER_CONTAINER',e);if(e.assembly==='ROTATING_CONTAINER')addF(e.variant==='PERFORATED'?'PERFORATED_ROTATING_CONTAINER':'ROTATING_CONTAINER',e);if(e.assembly==='CONTENT_ITEMS')addF('CONTENT',e);if(e.variant==='PUMP_LIKE')addF('PUMP_LIKE',e);if(e.form==='CONDUIT'||e.assembly==='PIPE'&&plan.physical)addF('CONDUIT',e);}
 if(housing?.variant==='DOOR_FRONT')addF('DOOR',housing);
 const feats=Object.keys(featureEnts),sample=plan.beats.map(mid);
 const seenF=feats.filter(k=>sample.some(f=>featureEnts[k].some(e=>onScreen(e,f,0.03))&&(!housing||onScreen(housing,f,0.12))));
 const MSR=gate(housing?feats.length>=2&&seenF.length/Math.max(1,feats.length)>=0.75:false,feats.length?+(seenF.length/feats.length).toFixed(3):0,'≥2 identity features beyond the shell, ≥75% seen with the system',{features:feats,seen:seenF});
 // MECHANISM_PARTICIPANT_COVERAGE: participants of admitted relations that the video draws.
 const mp=plan.mechanismParticipants??[],all=mp.reduce((a,r)=>a+r.participants.length,0),drawn=mp.reduce((a,r)=>a+r.drawn.length,0);
 const MPC=gate(all?drawn/all>=0.8:null,all?+(drawn/all).toFixed(3):null,'≥0.8 of relation participants drawn',{missing:mp.flatMap(r=>r.participants.filter(p=>!r.drawn.includes(p)).map(p=>r.relationId+':'+p))});
 // CONTAINMENT_READABILITY: container and content on screen together where the containment is stated.
 const pairs=plan.physical?.pairs??[];
 const shownState=new Set<string>();
 const cr=pairs.map(p=>{const b=beatOf(p.relationId),c=ent.get(p.container),k=ent.get(p.content);if(!b||!c||!k)return null;const f=mid(b),ok=onScreen(c,f,0.08)&&(onScreen(k,f,0.03)||k.kind==='PATH');if(ok)shownState.add(b.id);return ok;}).filter((x):x is boolean=>x!==null);
 const CR=gate(cr.length?cr.filter(Boolean).length/cr.length>=0.75:null,cr.length?+(cr.filter(Boolean).length/cr.length).toFixed(3):null,'≥0.75 of stated containments show container + content together');
 // NESTED_CONTAINER_CONTINUITY: an inner container lies inside its outer one and both are present whenever the outer is shown.
 const nested=pairs.filter(p=>ent.get(p.content)?.assembly==='ROTATING_CONTAINER'||ent.get(p.content)?.assembly==='OUTER_CONTAINER');
 const nc=nested.map(p=>{const o=ent.get(p.container)!,i=ent.get(p.content)!,inside=[0,1,2].every(k=>Math.abs(i.position[k]-o.position[k])+i.size[k]/2<=o.size[k]/2+0.05);
  const together=sample.every(f=>!onScreen(o,f,0.05)||ds(f)?.subjects[i.entityId]?.visible!==false);return inside&&together;});
 const NC=gate(nc.length?nc.every(Boolean):null,nc.length?+(nc.filter(Boolean).length/nc.length).toFixed(3):null,'inner inside outer, never replaced or dropped');
 // ROTATION_CONTENT_COHERENCE: content moves with the rotating container only when the script says so (and then both are on screen).
 const rc=(plan.physical?.rotating??[]).filter(r=>r.content).map(r=>{const c=ent.get(r.content!)!,attached=c.parentId===r.entityId,contentOps=plan.beats.some(b=>b.operations.some(o=>o.target===c.entityId&&!['HIGHLIGHT','REVEAL','HIDE'].includes(o.operation)&&o.parameters.parameter==='activity'));
  if(!r.behaviorStated)return!attached&&!contentOps;const b=beatOf(r.relationId);return attached&&(!b||onScreen(ent.get(r.entityId)!,mid(b),0.1)&&onScreen(c,mid(b),0.03));});
 const RCC=gate(rc.length?rc.every(Boolean):null,rc.length?+(rc.filter(Boolean).length/rc.length).toFixed(3):null,'content attached iff its behaviour is stated; both on screen while turning');
 // PASS_THROUGH_READABILITY / BOUNDARY_OPENING_VISIBILITY.
 const cross=plan.beats.filter(b=>b.visualIntent==='MATERIAL_PASSES_THROUGH_BOUNDARY');
 const pt=cross.map(b=>{const fl=b.operations.find(o=>o.operation==='FLOW')!,p=ent.get(fl.target)!,k=ent.get(b.focusEntityId!)!,l=b.endFrame-b.startFrame,f=b.startFrame+l*(fl.startOffset+fl.endOffset)/2,r=k.size[0]/2;
  const rad=(q:Vec3)=>Math.hypot(q[0]-k.position[0],q[2]-k.position[2]),sides=p.path!.some(q=>rad(q)<r*0.9)&&p.path!.some(q=>rad(q)>r*1.05);
  const wallPt=p.path!.reduce((a,q)=>Math.abs(rad(q)-r)<Math.abs(rad(a)-r)?q:a),vis=[p.path![0],wallPt,p.path!.at(-1)!].every(q=>pointStatus(plan,seq,cl(f),q,[p,k])==='VISIBLE');
  const openings=k.variant==='PERFORATED',boundaryBig=onScreen(k,f,0.2);
  return{pass:sides&&vis&&openings,opening:openings&&boundaryBig&&pointStatus(plan,seq,cl(f),wallPt,[p,k])==='VISIBLE',sides,vis,openings};});
 const PTR=gate(pt.length?pt.every(x=>x.pass):null,pt.length?+(pt.filter(x=>x.pass).length/pt.length).toFixed(3):null,'material starts on one side, crosses a drawn opening, ends on the other; all three visible',pt);
 const BOV=gate(pt.length?pt.every(x=>x.opening):null,pt.length?+(pt.filter(x=>x.opening).length/pt.length).toFixed(3):null,'boundary with drawn openings large on screen, crossing point visible');
 // MATERIAL_ROUTE_CONTINUITY: consecutive material movements connect (one ends where the next starts).
 const flows=plan.beats.flatMap(b=>b.operations.filter(o=>o.operation==='FLOW'&&!o.observed&&ent.get(o.target)?.assembly==='TRANSFER_PATH').map(o=>ent.get(o.target)!)),pairsF=flows.slice(1).map((e,i)=>Math.hypot(...e.path![0].map((v,k)=>v-flows[i].path!.at(-1)![k]) as [number,number,number])<=0.6);
 const MRC=gate(pairsF.length?pairsF.filter(Boolean).length/pairsF.length>=0.5:null,pairsF.length?+(pairsF.filter(Boolean).length/pairsF.length).toFixed(3):null,'≥0.5 of consecutive material movements connect');
 // SOURCE_ACTUATOR_DESTINATION_VISIBILITY.
 // Source when the movement starts, actuator mid-way, destination when it ends (a followed route keeps orientation).
 const act=plan.beats.filter(b=>/^ACTUATOR_/.test(b.visualIntent)).map(b=>{const fl=b.operations.find(o=>o.operation==='FLOW');if(!fl)return false;const p=ent.get(fl.target)!,pump=plan.world.entities.find(e=>e.variant==='PUMP_LIKE'),l=b.endFrame-b.startFrame,f0=b.startFrame+l*(fl.startOffset+0.05),f1=b.startFrame+l*(fl.endOffset-0.02),f=(f0+f1)/2;
  return Boolean(pump&&(onScreen(pump,f,0.04)||onScreen(pump,f0,0.04)))&&pointStatus(plan,seq,cl(f0),p.path![0],[p])!=='OUT_OF_FRAME'&&pointStatus(plan,seq,cl(f1),p.path!.at(-1)!,[p])!=='OUT_OF_FRAME';});
 const SAD=gate(act.length?act.every(Boolean):null,act.length?+(act.filter(Boolean).length/act.length).toFixed(3):null,'source, actuator and destination in frame during the transfer');
 // CONTEXT_COHERENCE: a closed housing with powered parts is not staged outdoors; vehicles keep their medium.
 const powered=plan.world.entities.some(e=>['MACHINE_UNIT','ROTATING_CONTAINER','ROTOR','VANE_RING'].includes(e.assembly??'')||e.variant==='PUMP_LIKE');
 const indoorNeeded=Boolean(plan.layout?.enclosure&&powered),ctx=plan.context?.context??(plan.world.template==='MOTION_STAGE'?'MEDIUM':'OUTDOOR_GROUND');
 // Outdoors is incoherent only when it is the fallback (no stated place or category chose it).
 const CC=gate(plan.world.template==='MOTION_STAGE'?true:indoorNeeded?!(ctx==='OUTDOOR_GROUND'&&!plan.context?.category):true,null,'housed machine with moving parts → not the outdoor fallback',{context:ctx,category:plan.context?.category??null,indoorNeeded});
 const readability=causalReadability(plan,seq);
 const CRD=gate(readability.checked?readability.causalReadabilityRate!>=0.7:null,readability.causalReadabilityRate,'≥0.7');
 // NARRATION_DEPENDENCY_ESTIMATE: share of stated relations the picture does not carry (gaps, highlight-only or symbolic beats).
 const factual=plan.beats.filter(b=>b.grounding==='FACTUAL_DEMONSTRATION'),rels=[...new Set([...factual.flatMap(b=>b.relationIds),...plan.gaps.map(g=>g.relationId)])];
 // A stated containment (a state, no change) is carried by the drawing when container and content are on screen together.
 const carried=(r:string)=>factual.some(b=>b.relationIds.includes(r)&&(shownState.has(b.id)||b.proof&&b.proof.level!=='SYMBOLIC'&&b.proof.level!=='NONE'&&b.operations.some(o=>!['HIGHLIGHT','REVEAL','HIDE'].includes(o.operation)&&!o.observed)));
 const dep=rels.length?rels.filter(r=>!carried(r)).length/rels.length:null;
 const NDE=gate(dep===null?null:dep<=0.35,dep===null?null:+dep.toFixed(3),'≤0.35 of stated relations left to the narration',{notCarried:rels.filter(r=>!carried(r))});
 const gates={MAIN_SYSTEM_RECOGNIZABILITY:MSR,MECHANISM_PARTICIPANT_COVERAGE:MPC,CONTAINMENT_READABILITY:CR,NESTED_CONTAINER_CONTINUITY:NC,ROTATION_CONTENT_COHERENCE:RCC,PASS_THROUGH_READABILITY:PTR,BOUNDARY_OPENING_VISIBILITY:BOV,MATERIAL_ROUTE_CONTINUITY:MRC,SOURCE_ACTUATOR_DESTINATION_VISIBILITY:SAD,CONTEXT_COHERENCE:CC,CAUSAL_READABILITY:CRD,NARRATION_DEPENDENCY_ESTIMATE:NDE};
 const failed=Object.entries(gates).filter(([,g])=>g.status==='FAIL').map(([k])=>k);
 return{verdict:failed.length?'FAIL':'PASS' as 'PASS'|'FAIL',failed,gates};
}
