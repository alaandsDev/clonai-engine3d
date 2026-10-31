import type {DirectedSequence} from '../engine3d/directed';
import type {VisualCausalPlan} from '../visual-causal/contracts';
import type {visualQa} from '../visual-causal/qa';
import type {ScriptUnderstanding} from './contracts';
/** Script coverage, script-span provenance and product metrics (pure functions of the artifacts). */
export type CoverageType='DIRECT'|'PARTIAL'|'SYMBOLIC'|'EDITORIAL'|'UNREPRESENTED';
const RANK:Record<string,number>={DIRECT:3,PARTIAL:2,SYMBOLIC:1,NONE:0};
const ACTIONABLE=new Set(['FLOW','ARRIVE','DEPART','SPIN','OPEN','CLOSE','SET_STATE','MOVE','TRANSFER']);
export function scriptCoverage(u:ScriptUnderstanding,plan:VisualCausalPlan){
 const segments=u.segments.map(s=>{
  const beats=plan.beats.filter(b=>b.sentenceId===s.id),factual=beats.filter(b=>b.grounding==='FACTUAL_DEMONSTRATION'&&b.proof);
  const claims=s.claimIds.filter(id=>u.claims.find(c=>c.id===id)?.status==='SCRIPT_ASSERTED');
  const best=factual.reduce<string|null>((m,b)=>m===null||RANK[b.proof!.level]>RANK[m]?b.proof!.level:m,null);
  const type:CoverageType=!claims.length?(beats.length?'EDITORIAL':'UNREPRESENTED'):best&&best!=='NONE'?best as CoverageType:'UNREPRESENTED';
  const actionable=claims.some(c=>u.actions.some(a=>a.claimId===c&&ACTIONABLE.has(a.action)));
  const gap=plan.gaps.filter(g=>claims.includes(g.relationId)).map(g=>g.reason);
  return{segmentId:s.id,role:s.role,text:s.span.text,type,beats:beats.length,claims:claims.length,important:actionable,justification:type==='UNREPRESENTED'?(gap.join('; ')||'no visual beat'):null};
 });
 const count=(t:CoverageType)=>segments.filter(s=>s.type===t).length;
 return{segments,summary:{segments:segments.length,DIRECT:count('DIRECT'),PARTIAL:count('PARTIAL'),SYMBOLIC:count('SYMBOLIC'),EDITORIAL:count('EDITORIAL'),UNREPRESENTED:count('UNREPRESENTED'),importantUnrepresented:segments.filter(s=>s.type==='UNREPRESENTED'&&s.important).length,coveragePercent:+(100*(segments.length-count('UNREPRESENTED'))/segments.length).toFixed(1)}};
}
/** script span → claim → narrative node (segment) → visual beat → demonstration steps → shots → frames. */
export function scriptProvenance(u:ScriptUnderstanding,plan:VisualCausalPlan,seq:DirectedSequence){
 const s=u.source.normalized,steps=seq.demonstration?.steps??[];
 const chains=u.claims.filter(c=>c.status==='SCRIPT_ASSERTED').map(c=>{
  const spans=[c.subject,c.trigger,...c.args.filter(a=>a.role!=='STATE').map(a=>a.span)];
  const beats=plan.beats.filter(b=>b.relationIds.includes(c.id)).map(b=>({beatId:b.id,grounding:b.grounding,proof:b.proof?.level??null,frames:[b.startFrame,b.endFrame],
   steps:steps.filter(x=>x.purpose.includes(c.id)).map(x=>({operation:x.operation,target:x.target,frames:[x.startFrame,x.endFrame]})),
   shots:seq.shots.filter(x=>x.startFrame<b.endFrame&&b.startFrame<x.endFrame).map(x=>x.id)}));
  return{claimId:c.id,sourceType:u.source.sourceType,segmentId:c.segmentId,spans:spans.map(x=>({start:x.start,end:x.end,text:x.text,verified:s.slice(x.start,x.end)===x.text})),predicate:c.predicate,extractor:c.extractor,beats};
 });
 const editorial=plan.beats.filter(b=>b.grounding!=='FACTUAL_DEMONSTRATION').map(b=>({beatId:b.id,visualIntent:b.visualIntent,grounding:b.grounding,classification:'VISUAL_EDITORIAL_INFERENCE'}));
 const verified=chains.every(c=>c.spans.every(x=>x.verified));
 return{sourceType:u.source.sourceType,scriptFingerprint:u.source.fingerprint,webProvenance:null,evidence:[],chains,editorialBeats:editorial,verified,factualBeatsWithScriptSpan:plan.beats.filter(b=>b.grounding==='FACTUAL_DEMONSTRATION').every(b=>b.relationIds.every(r=>chains.some(c=>c.claimId===r)))};
}
export function scriptMetrics(u:ScriptUnderstanding,plan:VisualCausalPlan,qa:ReturnType<typeof visualQa>,coverage:ReturnType<typeof scriptCoverage>){
 const drawn=u.entities.filter(e=>!['ABSTRACT','ACTOR'].includes(e.role));
 return{scriptWords:u.source.words,scriptSegments:u.segments.length,semanticClaims:u.claims.length,questions:u.segments.filter(s=>s.role==='QUESTION'||s.role==='HYPOTHESIS').length,
  scriptAssertedClaims:u.claims.filter(c=>c.status==='SCRIPT_ASSERTED').length,editorialBridges:u.segments.filter(s=>s.role!=='ASSERTION').length,
  entities:u.entities.length,visualEntities:plan.world.entities.length,persistentEntities:drawn.filter(e=>new Set(e.mentions.map(m=>u.claims.find(c=>c.id===m.claimId)?.segmentId)).size>=2).length,
  actions:u.actions.length,stateChanges:plan.transitions.filter(t=>t.grounding==='GROUNDED').length,visualBeats:plan.beats.length,shots:qa.shots,cuts:qa.cuts,proof:qa.proof,
  longestMeaningfulStasisSeconds:+qa.longestMeaningfulStasisSeconds.toFixed(2),emptyShots:plan.beats.filter(b=>!b.focusEntityId&&!b.operations.length&&b.cameraZone!=='WORLD').length,continuityIssues:qa.continuityIssues.length,coveragePercent:coverage.summary.coveragePercent};
}
