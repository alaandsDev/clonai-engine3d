import {jsonHash} from '../editorial/fingerprint';
import type {ClaimAction,ScriptEntity,ScriptUnderstanding} from '../script-mode/contracts';
import {INVISIBLE_FLUID} from '../script-mode/lexicon';
/** Phase29 Demonstration-First direction. For every script idea the director asks "what must happen on screen for the
 * viewer to SEE this?" and picks a demonstration strategy that ends in something observable. An A/B experiment is one
 * strategy among others and only exists when the script itself states both conditions. Nothing here adds facts:
 * strategies reorganise what the script asserts; missing conditions or results are UNSUPPORTED, never invented. */
export type DemonstrationStrategy='EXPERIMENT_AB'|'COMPONENT_ACTION_RESULT'|'FLOW_DEMONSTRATION'|'STATE_CHANGE'|'PROGRESSIVE_ASSEMBLY'|'CUTAWAY_REVEAL'|'CAUSE_EFFECT'|'MOTION_RESPONSE'|'ACCUMULATION'|'DEPLETION'|'FOLLOW_ACTION'|'NAMED_ONLY';
export type MicroStage='WORLD_STAGE'|'SYSTEM_STAGE'|'COMPONENT_STAGE'|'EXPERIMENT_STAGE'|'CUTAWAY_STAGE'|'COMPARISON_STAGE';
export type Observable='MOVE'|'ROTATE'|'RISE'|'FALL'|'OPEN'|'CLOSE'|'FLOW'|'FILL'|'EMPTY'|'BEND'|'STOP'|'ACCELERATE'|'DECELERATE'|'REVEAL'|'CHANGE_STATE'|'NONE';
export type DemonstrationSupport='DIRECT'|'PARTIAL'|'SYMBOLIC'|'UNSUPPORTED';
export type PresenterRole='PRESENTER'|'SCALE_REFERENCE'|'EXPERIMENT_SUBJECT'|'OBSERVER'|'REACTION'|'PAYOFF';
/** A/B experiment: both conditions come from asserted claims (claimId per condition). */
export interface VisualExperiment {variable:string;conditions:{label:'A'|'B';claimId:string;observable:Observable;description:string}[];verdictClaimId:string}
export interface VisualDemonstrationIntent {
 id:string;segmentId:string;claimIds:string[];strategy:DemonstrationStrategy;
 /** What must happen on screen for the claim to be seen (generated from roles/actions, not from topic words). */
 question:string;subjectEntityId:string|null;actorEntityIds:string[];observable:Observable;support:DemonstrationSupport;stage:MicroStage;
 /** Persistent subject: components that enter the subject in this demonstration, and the resulting subject version. */
 assembles:string[];subjectVersion:number;experiment?:VisualExperiment;presenterRole:PresenterRole|null;reason:string;
}
const STAGE:Record<DemonstrationStrategy,MicroStage>={EXPERIMENT_AB:'EXPERIMENT_STAGE',MOTION_RESPONSE:'EXPERIMENT_STAGE',COMPONENT_ACTION_RESULT:'COMPONENT_STAGE',CUTAWAY_REVEAL:'CUTAWAY_STAGE',FLOW_DEMONSTRATION:'SYSTEM_STAGE',CAUSE_EFFECT:'SYSTEM_STAGE',PROGRESSIVE_ASSEMBLY:'SYSTEM_STAGE',STATE_CHANGE:'SYSTEM_STAGE',ACCUMULATION:'SYSTEM_STAGE',DEPLETION:'SYSTEM_STAGE',FOLLOW_ACTION:'WORLD_STAGE',NAMED_ONLY:'SYSTEM_STAGE'};
const PART_ROLES=new Set(['LIFT_SURFACE','PROPULSOR','VANES','ROTATING','GATE']);
const dirObservable=(d:string|null|undefined):Observable=>d==='DOWN'?'FALL':d==='UP'?'RISE':d==='FORWARD'?'ACCELERATE':d==='BACKWARD'?'DECELERATE':'NONE';
const invisible=(e:ScriptEntity|undefined)=>Boolean(e&&(e.role==='FORCE'||e.role==='ABSTRACT'||(e.role==='FLUID'&&INVISIBLE_FLUID.test(e.heads[0]??''))));
export function selectDemonstrations(u:ScriptUnderstanding,known:Set<string>):VisualDemonstrationIntent[]{
 const ent=(id:string|undefined)=>u.entities.find(e=>e.id===id),acts=u.actions.filter(a=>known.has(a.claimId));
 const main=u.entities.find(e=>e.role==='VEHICLE'&&e.claimIds.some(c=>known.has(c)))??ent(u.mainSubjectId??undefined)??null;
 const out:VisualDemonstrationIntent[]=[],assembled=new Set<string>();let version=1;
 const motionByForce=new Map<string,{claimId:string;observable:Observable}>();
 const push=(seg:string,claims:string[],strategy:DemonstrationStrategy,question:string,actors:(string|undefined)[],observable:Observable,support:DemonstrationSupport,reason:string,extra:Partial<VisualDemonstrationIntent>={})=>{
  // Parts named for the first time in this demonstration enter the persistent subject here (v1 → v2 → …).
  const parts=[...new Set(claims.flatMap(c=>u.entities.filter(e=>PART_ROLES.has(e.role)&&e.claimIds.includes(c)&&e.id!==main?.id).map(e=>e.id)))].filter(id=>!assembled.has(id));
  parts.forEach(p=>assembled.add(p));if(parts.length)version++;
  const s=extra.strategy??strategy;
  out.push({id:'DEMO_'+jsonHash({seg,claims,s}).slice(0,10),segmentId:seg,claimIds:claims,strategy:s,question,subjectEntityId:main?.id??null,actorEntityIds:actors.filter((x):x is string=>Boolean(x)),observable,support,stage:STAGE[s],assembles:parts,subjectVersion:version,presenterRole:null,reason,...extra});
 };
 for(const seg of u.segments){
  const segActs=acts.filter(a=>seg.claimIds.includes(a.claimId));
  const used=new Set<ClaimAction>();
  for(const a of segActs){
   if(used.has(a))continue;used.add(a);
   const c=u.claims.find(x=>x.id===a.claimId)!,first=ent(a.entityIds[0]),second=ent(a.entityIds[1]);
   switch(a.action){
    case 'DEFLECT':{
     // A fluid turned by a surface, followed in the same sentence by a force on that surface: cause → physical effect.
     const effect=segActs.find(x=>!used.has(x)&&x.action==='SHOW_FORCE');
     if(effect){used.add(effect);const d=effect.state??ent(effect.entityIds[0])?.direction;
      push(seg.id,[a.claimId,effect.claimId],'CAUSE_EFFECT','The flow must visibly bend at the surface, then the body must respond the opposite way',[a.entityIds[0],effect.entityIds[1]],dirObservable(d),'PARTIAL','Cause (flow turning) is shown as streamlines; the effect is a physical response of the body');}
     else push(seg.id,[a.claimId],'FLOW_DEMONSTRATION','The stream must visibly change direction',[a.entityIds[0]],'BEND',first?.role==='FLUID'&&!invisible(first)?'DIRECT':'PARTIAL','The turning of the stream is shown on its path (an invisible fluid is drawn as streamlines)');break;}
    case 'SHOW_FORCE':{const d=a.state??first?.direction;
     if(!d){push(seg.id,[a.claimId],'NAMED_ONLY','A force without a stated direction cannot be shown acting',[a.entityIds[0]],'NONE','UNSUPPORTED','The script does not say which way this force acts');break;}
     const obs=dirObservable(d),stated=['PULL','PUSH','MOVE','DESCEND','RISE'].includes(c.predicate);
     if(first)motionByForce.set(first.id,{claimId:a.claimId,observable:obs});
     push(seg.id,[a.claimId],'MOTION_RESPONSE','The body must visibly '+obs.toLowerCase()+' because of the force',[a.entityIds[0],a.entityIds[1]],obs,stated?'DIRECT':'PARTIAL',stated?'The script states the force moves the body this way; the body moves':'The script states the body receives the force; its motion shows it',
      // Vertical motion is isolated on the experiment stage; along-path speed changes need the medium in view.
      {stage:obs==='RISE'||obs==='FALL'?'EXPERIMENT_STAGE':'WORLD_STAGE'});break;}
    case 'BALANCE':{
     const prior=a.entityIds.map(id=>motionByForce.get(id)).find(Boolean);
     if(prior&&!out.some(o=>o.strategy==='EXPERIMENT_AB')){
      const fa=a.entityIds.find(id=>motionByForce.get(id)===prior)!;
      push(seg.id,[prior.claimId,a.claimId],'EXPERIMENT_AB','Condition A (only the first force) must end in its motion; condition B (both forces) must end level',a.entityIds,'STOP','PARTIAL','Both conditions are script assertions: A from the earlier claim, B from this balance claim',
       {experiment:{variable:'balancing force',conditions:[{label:'A',claimId:prior.claimId,observable:prior.observable,description:'only '+(ent(fa)?.label??'force')},{label:'B',claimId:a.claimId,observable:'STOP',description:'balanced'}],verdictClaimId:a.claimId}});}
     else push(seg.id,[a.claimId],'FOLLOW_ACTION','The body must keep moving steadily (forces balanced)',a.entityIds,'STOP','SYMBOLIC','Balance is shown as steady motion with both forces displayed');break;}
    case 'THRUST':push(seg.id,[a.claimId],'COMPONENT_ACTION_RESULT','The component must act, then the body must speed up',[a.entityIds[0],a.entityIds[1]],'ACCELERATE',first?.role==='PROPULSOR'?'DIRECT':'PARTIAL','Component activates; the medium streams past faster (forward motion)');break;
    case 'STREAM':case 'FLOW':case 'ARRIVE':case 'DEPART':case 'PUFF':push(seg.id,[a.claimId],'FLOW_DEMONSTRATION','The material must be seen travelling from its source along its path',a.entityIds,'FLOW',a.action==='STREAM'&&invisible(first)?'PARTIAL':'DIRECT',a.action==='STREAM'?'An invisible fluid is drawn as streamlines along the surface':'The material visibly travels');break;
    case 'TRAVEL':push(seg.id,[a.claimId],'FOLLOW_ACTION','The camera must follow the body moving through its medium',a.entityIds,'MOVE','DIRECT','The body moves through its medium');break;
    case 'LEVEL':push(seg.id,[a.claimId],a.state==='DOWN'?'DEPLETION':'ACCUMULATION','The level must visibly '+(a.state==='DOWN'?'drop':'rise'),a.entityIds,a.state==='DOWN'?'EMPTY':'FILL','DIRECT','The amount visibly changes');break;
    case 'BOIL':push(seg.id,[a.claimId],'CUTAWAY_REVEAL','The inside must be opened to see the change',a.entityIds,'CHANGE_STATE','PARTIAL','A section view reveals the change inside the container');break;
    case 'OPEN':case 'CLOSE':push(seg.id,[a.claimId],'STATE_CHANGE','The part must visibly '+a.action.toLowerCase(),a.entityIds,a.action as Observable,'DIRECT','The stated part changes state');break;
    case 'SET_STATE':case 'ACTIVATE':case 'DEACTIVATE':push(seg.id,[a.claimId],'STATE_CHANGE','The part must be seen in / change to the stated state',a.entityIds,'CHANGE_STATE','DIRECT','The stated state is shown');break;
    case 'SPIN':push(seg.id,[a.claimId],'COMPONENT_ACTION_RESULT','The component must visibly turn',a.entityIds,'ROTATE','DIRECT','The stated part rotates');break;
    case 'MOVE_VERTICAL':case 'MOVE':push(seg.id,[a.claimId],'MOTION_RESPONSE','The object must visibly move as stated',a.entityIds,a.action==='MOVE'?'MOVE':a.state==='UP'?'RISE':'FALL','DIRECT','The stated object moves',{stage:'SYSTEM_STAGE'});break; // moves inside its own system: no isolation stage
    case 'IDENTIFY':push(seg.id,[a.claimId],'PROGRESSIVE_ASSEMBLY','The named thing must be introduced into the persistent subject',a.entityIds,'REVEAL','SYMBOLIC','Introduction/naming; the object is shown, nothing changes');break;
    case 'HIGHLIGHT_CAUSE':push(seg.id,[a.claimId],'CAUSE_EFFECT','The cause and its effect must both be visible',a.entityIds,'NONE','SYMBOLIC','No generic physical effect for this cause');break;
    default:push(seg.id,[a.claimId],'NAMED_ONLY','No generic visual operation shows this claim',a.entityIds,'NONE','UNSUPPORTED',c.predicate+' has no physical demonstration');
   }
  }
 }
 // A demonstration whose own content is the entry of new parts is a progressive assembly step.
 for(const d of out)if(d.assembles.length&&(d.strategy==='NAMED_ONLY'||d.strategy==='PROGRESSIVE_ASSEMBLY'))d.strategy='PROGRESSIVE_ASSEMBLY';
 return out;
}
export function demonstrationSummary(ds:VisualDemonstrationIntent[]){
 const by=(k:keyof VisualDemonstrationIntent)=>ds.reduce<Record<string,number>>((m,d)=>{const v=String(d[k]);m[v]=(m[v]??0)+1;return m;},{});
 return{count:ds.length,strategies:by('strategy'),support:by('support'),stages:by('stage'),subjectVersions:Math.max(1,...ds.map(d=>d.subjectVersion)),experiments:ds.filter(d=>d.experiment).length};
}
