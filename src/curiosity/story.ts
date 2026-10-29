import {jsonHash} from '../editorial/fingerprint';
import type {EvidencePack} from '../research/contracts';
import {buildMechanismKnowledge,entityKey,CAUSAL,PHYSICAL,SPATIAL,type MechanismKnowledge,type KnowledgeRelation} from './knowledge';
import {mechanismConnectivity,phase27Readiness} from './connectivity';

export type StoryRole='GOAL'|'SETUP'|'ATTEMPT'|'PROBLEM'|'EXPLANATION'|'SOLUTION'|'STATE_CHANGE'|'NEW_PROBLEM'|'NEXT_SOLUTION'|'PAYOFF';
export interface StoryNode {id:string;role:StoryRole;relationId:string;factIds:string[];visualHints:string[];presenterIntent:string;worldRequirements:string[]}
const roleOf=(r:KnowledgeRelation):StoryRole=>r.predicate==='HAS_GOAL'?'GOAL':r.predicate==='ATTEMPTS'?'ATTEMPT':r.predicate==='FAILS_BECAUSE'?'PROBLEM':r.predicate==='SOLVES'?'SOLUTION':CAUSAL.has(r.predicate)?'EXPLANATION':['TRANSFORM','OUTPUTS'].includes(r.predicate)?'PAYOFF':PHYSICAL.has(r.predicate)?'STATE_CHANGE':'SETUP';
export function buildCausalConstructionGraph(k:MechanismKnowledge){
 const nodes=[...new Set(k.relations.flatMap(r=>[entityKey(r.subject),entityKey(r.object)]))].sort().map(name=>({id:'KN_'+jsonHash(name).slice(0,16),name}));
 const edges=k.relations.map(r=>({id:r.id,from:nodes.find(n=>n.name===entityKey(r.subject))!.id,to:nodes.find(n=>n.name===entityKey(r.object))!.id,relation:r.predicate,modality:r.modality,factIds:r.factIds,evidenceIds:r.proof.map(p=>p.evidenceId),causality:r.causality}));
 const raw={version:'causal-construction/1.0.0',knowledgeFingerprint:k.fingerprint,nodes,edges};return{...raw,fingerprint:jsonHash(raw)};
}
export function curiosityStoryPotential(k:MechanismKnowledge,contextual=false){
 const p=new Set(k.relations.map(r=>r.predicate));
 const dimensions={hasGoal:p.has('HAS_GOAL')||p.has('USED_FOR'),hasInitialState:p.has('IS_A')||p.has('LOCATED_IN'),hasMechanism:k.metrics.physicalClaims>0,hasProblem:p.has('FAILS_BECAUSE'),hasCause:p.has('CAUSES')||p.has('CAUSED_BY')||p.has('FAILS_BECAUSE'),hasSolution:p.has('SOLVES'),hasConsequence:p.has('CAUSES')||p.has('OUTPUTS')||p.has('TRANSFORM'),hasProgression:p.has('PRECEDES'),hasFinalState:p.has('OUTPUTS')||p.has('TRANSFORM')};
 const n=Object.values(dimensions).filter(Boolean).length;
 const c=contextual?mechanismConnectivity(k):null,connectedRich=!c||c.longestMechanismChain.searchComplete&&c.longestMechanismChain.edges>=2&&c.largestConnectedMechanismRelations>=3&&c.mechanismChainCoverage>=0.5;
 const rating=!k.relations.length?'INSUFFICIENT':dimensions.hasMechanism&&k.relations.length>=6&&n>=5&&connectedRich?'RICH':dimensions.hasMechanism&&k.relations.length>=3&&(n>=3||dimensions.hasGoal&&k.metrics.causalRelations>0)?'ADEQUATE':'THIN';
 return{rating:rating as 'RICH'|'ADEQUATE'|'THIN'|'INSUFFICIENT',dimensions,missing:Object.entries(dimensions).filter(([,v])=>!v).map(([key])=>key),reason:'Qualitative support; missing categories are gaps, never invented story events'};
}
/** Links require shared literal participants. These are navigation links to
 * existing relation edges, not newly inferred factual predicates. No transitive
 * causality, historical cause, or invented naive attempt is generated. */
export function buildCuriosityStoryPlan(pack:EvidencePack){
 const knowledge=buildMechanismKnowledge(pack),graph=buildCausalConstructionGraph(knowledge),contextual=pack.researchPlan.policy.contextualMechanisms===true,potential=curiosityStoryPotential(knowledge,contextual);
 const nodes:StoryNode[]=knowledge.relations.map(r=>{
  const newProblem=(cause:KnowledgeRelation)=>cause.predicate==='CAUSES'&&knowledge.relations.some(s=>s.predicate==='SOLVES'&&entityKey(s.subject)===entityKey(cause.subject)&&entityKey(s.object)!==entityKey(cause.object))&&knowledge.relations.some(s=>s.predicate==='SOLVES'&&entityKey(s.object)===entityKey(cause.object));
  const role:StoryRole=newProblem(r)?'NEW_PROBLEM':r.predicate==='SOLVES'&&knowledge.relations.some(c=>newProblem(c)&&entityKey(c.object)===entityKey(r.object))?'NEXT_SOLUTION':roleOf(r),spatial=SPATIAL.has(r.predicate);
  const problem=['PROBLEM','NEW_PROBLEM'].includes(role),solution=['SOLUTION','NEXT_SOLUTION'].includes(role);
  const visualHints=problem?['SHOW_FAILURE_STATE']:solution?['INTRODUCE_COMPONENT']:r.predicate==='TRANSFORM'?['SHOW_BEFORE_AFTER']:['FLOW','PASSES_THROUGH'].includes(r.predicate)?['SHOW_DIRECTIONAL_MOVEMENT']:spatial?['CUTAWAY_REVEAL']:r.predicate==='PRECEDES'?['PRESERVE_SYSTEM_STATE']:role==='PAYOFF'?['SHOW_WORKING_SYSTEM']:['SHOW_RELATION'];
  return{id:'SN_'+r.id,role,relationId:r.id,factIds:r.factIds,visualHints,presenterIntent:problem?'PRESENTER_REACTS':solution?'PRESENTER_REVEALS':role==='PAYOFF'?'PRESENTER_PAYOFF':spatial?'PRESENTER_POINTS':'PRESENTER_OBSERVES',worldRequirements:spatial?['SHOW_INTERNAL_STRUCTURE','CUTAWAY_REQUIRED']:role==='PAYOFF'?['RETURN_TO_WORLD','SHOW_FINAL_SYSTEM']:['SHOW_SYSTEM_IN_CONTEXT']};
 });
 const links:{from:string;to:string;kind:'SHARED_PARTICIPANT'|'EXPLICIT_SEQUENCE';evidenceIds:string[]}[]=[];
 for(const a of knowledge.relations)for(const b of knowledge.relations){
  if(a.id===b.id)continue;
  const sameProblem=entityKey(a.object)===entityKey(b.object)&&b.predicate==='SOLVES';
  const sameComponent=entityKey(a.subject)===entityKey(b.subject)&&a.predicate==='SOLVES'&&CAUSAL.has(b.predicate);
  if(entityKey(a.object)===entityKey(b.subject)||sameProblem||sameComponent)links.push({from:'SN_'+a.id,to:'SN_'+b.id,kind:'SHARED_PARTICIPANT',evidenceIds:[...new Set([...a.proof,...b.proof].map(p=>p.evidenceId))].sort()});
 }
 // Source order is a discourse fallback only. Explicit source event order is
 // represented by PRECEDES relations, not by proximity of unrelated sentences.
 const position=(n:StoryNode)=>{const r=knowledge.relations.find(r=>r.id===n.relationId)!;return [...r.proof].sort((a,b)=>a.sourceId.localeCompare(b.sourceId,'en')||a.span.start-b.span.start)[0];};
 nodes.sort((a,b)=>{const x=position(a),y=position(b);return x.sourceId.localeCompare(y.sourceId,'en')||x.span.start-y.span.start||a.id.localeCompare(b.id,'en');});
 const gaps=potential.missing.map(d=>({dimension:d,status:'GAP' as const,reason:'No admitted explicit relation; not universally required'}));
 const raw={version:'curiosity-story/1.0.0',packFingerprint:pack.fingerprint,knowledgeFingerprint:knowledge.fingerprint,graphFingerprint:graph.fingerprint,potential,nodes,links,gaps,orderMeaning:'EDITORIAL_DISCOURSE_ONLY',historicalClaims:[] as string[],naiveAttempt:null,persistentSystemIntent:{systemContext:pack.topic,required:nodes.length>1,relationship:'CONTEXT_NOT_IDENTITY',worldRequirements:['ESTABLISH_WORLD'],presenterIntent:'PRESENTER_CONTEXT'},...(contextual?{connectivity:mechanismConnectivity(knowledge),phase27Readiness:phase27Readiness(knowledge)}:{})};
 return{knowledge,graph,story:{...raw,fingerprint:jsonHash(raw)}};
}
export type CuriosityArtifacts=ReturnType<typeof buildCuriosityStoryPlan>;
export function verifyCuriosityArtifacts(pack:EvidencePack,a:CuriosityArtifacts){return jsonHash(buildCuriosityStoryPlan(pack))===jsonHash(a);}
