import {jsonHash} from '../editorial/fingerprint';
import type {PlannerInput,VisualCausalPlan} from './contracts';
import {planVisualCausal} from './planner';
const INVERSE:Record<string,string[]>={visible:['HIDE','DISAPPEAR'],flowProgress:[],connection:['SEPARATE'],fillLevel:['DECREASE'],groundCutaway:['DECREASE'],y:['MOVE'],x:['MOVE'],openness:['ROTATE','MOVE'],activity:['DECREASE']};
/** Adversarial plan checks: grounded vs editorial, proof legitimacy, world/presenter identity,
 * state regressions. Returns every issue; an empty list means the plan is admissible. */
export function validateVisualPlan(plan:VisualCausalPlan,relationIds:string[]){
 const issues:string[]=[],known=new Set(relationIds),entities=new Map(plan.world.entities.map(e=>[e.entityId,e]));
 for(const e of plan.world.entities){
  if(e.worldId!==plan.worldId)issues.push('WORLD_IDENTITY:'+e.entityId);
  if(e.grounding==='FACTUAL'&&!e.relationIds.length)issues.push('FACTUAL_ENTITY_WITHOUT_RELATION:'+e.entityId);
  if(e.grounding==='EDITORIAL'&&e.relationIds.length)issues.push('EDITORIAL_ENTITY_CLAIMS_RELATION:'+e.entityId);
  for(const r of e.relationIds)if(!known.has(r))issues.push('INVENTED_RELATION_ENTITY:'+e.entityId+':'+r);
 }
 if(plan.world.presenter.resourceId!=='CHAR_CAIO_001'&&!/^CHAR_/.test(plan.world.presenter.resourceId))issues.push('PRESENTER_IDENTITY');
 const presenterIds=new Set([plan.world.presenter.entityId]);if(presenterIds.size!==1)issues.push('PRESENTER_IDENTITY');
 for(const b of plan.beats){
  const factual=b.grounding==='FACTUAL_DEMONSTRATION';
  if(factual&&!b.relationIds.length)issues.push('FACTUAL_BEAT_WITHOUT_RELATION:'+b.id);
  for(const r of b.relationIds)if(!known.has(r))issues.push('INVENTED_FACTUAL_RELATION:'+b.id+':'+r);
  if(!factual&&b.proof)issues.push('EDITORIAL_BEAT_CLAIMS_PROOF:'+b.id);
  if(!factual&&(b.relationIds.length||b.evidenceIds.length))issues.push('EDITORIAL_BEAT_CITES_RELATION:'+b.id);
  if(factual&&!b.proof)issues.push('FACTUAL_BEAT_WITHOUT_PROOF_ASSESSMENT:'+b.id);
  if(b.proof&&['DIRECT','PARTIAL'].includes(b.proof.level)){
   const acting=b.operations.filter(o=>o.operation!=='HIGHLIGHT'&&o.target!=='ENVIRONMENT').map(o=>entities.get(o.target));
   // An observed operation is acting only if its basis exists: an earlier sustained step on the same target, or an initial state set by this beat's relation.
   for(const o of b.operations.filter(o=>o.observed)){const earlier=plan.beats.some(x=>x.startFrame<b.startFrame&&x.operations.some(y=>!y.observed&&y.operation===o.operation&&y.target===o.target&&(y.sustain||(y.operation==='FLOW'&&y.parameters.to===1)))),initial=entities.get(o.target)?.initialStateFrom;
    if(o.observed==='SUSTAINED_STEP'?!earlier:!(initial&&b.relationIds.includes(initial)))issues.push('OBSERVED_WITHOUT_BASIS:'+b.id+':'+o.target);}
   if(!acting.some(e=>e&&e.grounding==='FACTUAL'&&e.relationIds.some(r=>b.relationIds.includes(r))))issues.push('PROOF_WITHOUT_FACTUAL_ACTION:'+b.id);
  }
  for(const o of b.operations)if(o.target!=='ENVIRONMENT'&&!entities.has(o.target))issues.push('UNKNOWN_TARGET:'+b.id+':'+o.target);
  if(factual&&b.focusEntityId&&entities.get(b.focusEntityId)?.grounding==='EDITORIAL'&&b.proof&&b.proof.level!=='NONE')issues.push('EDITORIAL_PROP_AS_PROOF:'+b.id);
  if(b.endFrame<=b.startFrame)issues.push('EMPTY_BEAT:'+b.id);
 }
 for(let i=1;i<plan.beats.length;i++)if(plan.beats[i].startFrame!==plan.beats[i-1].endFrame)issues.push('BEAT_COVERAGE:'+plan.beats[i].id);
 if(plan.beats.length&&(plan.beats[0].startFrame!==0||plan.beats.at(-1)!.endFrame!==plan.totalFrames))issues.push('BEAT_COVERAGE:edges');
 // State regression: a value may only go back through its explicit inverse operation.
 const last=new Map<string,{to:number|boolean;version:number}>();
 for(const t of plan.transitions){
  const key=t.entityId+'|'+(t.parameter??'visible'),prev=last.get(key);
  if(t.entityId!=='ENVIRONMENT'&&!entities.has(t.entityId))issues.push('TRANSITION_UNKNOWN_ENTITY:'+t.id);
  if(prev&&t.stateVersion<=prev.version&&t.entityId===key.split('|')[0])issues.push('STATE_VERSION_ORDER:'+t.id);
  const regress=typeof t.to==='number'&&typeof t.from==='number'?t.to<t.from:t.from===true&&t.to===false;
  if(regress&&!(INVERSE[t.parameter??'visible']??[]).includes(t.operation))issues.push('STATE_REGRESSION:'+t.id);
  if(t.grounding==='GROUNDED'&&(!t.evidenceRelationId||!known.has(t.evidenceRelationId)))issues.push('GROUNDED_TRANSITION_WITHOUT_RELATION:'+t.id);
  if(t.grounding==='EDITORIAL'&&!t.editorialReason)issues.push('EDITORIAL_TRANSITION_WITHOUT_REASON:'+t.id);
  last.set(key,{to:t.to,version:t.stateVersion});
 }
 return{valid:!issues.length,issues};
}
export const inventedFactualRelations=(plan:VisualCausalPlan,relationIds:string[])=>plan.beats.filter(b=>b.grounding==='FACTUAL_DEMONSTRATION').flatMap(b=>b.relationIds).filter(r=>!relationIds.includes(r)).length;
/** Replay: a plan is valid only if rebuilding it from its input reproduces it (re-signed tampering fails). */
export function verifyVisualPlan(plan:VisualCausalPlan,input:PlannerInput){
 const {fingerprint,...raw}=plan,issues:string[]=[];
 if(jsonHash(raw)!==fingerprint)issues.push('FINGERPRINT_MISMATCH');
 if(jsonHash(planVisualCausal(input))!==jsonHash(plan))issues.push('REPLAY_MISMATCH');
 return{valid:!issues.length,issues};
}
