import {jsonHash} from '../editorial/fingerprint';
import {topicSubject} from '../topic/subject';
import {entityKey,PHYSICAL,type KnowledgeRelation,type MechanismKnowledge} from './knowledge';

/** Indices over the existing knowledge graph. These links order discussion;
 * they do not add facts, identity aliases or transitive causal assertions. */
export type ProgressiveRole='GOAL'|'INITIAL_STATE'|'ATTEMPT'|'PROBLEM'|'EXPLANATION'|'CAUSE'|'SOLUTION'|'STATE_CHANGE'|'NEW_PROBLEM'|'NEXT_SOLUTION'|'FINAL_STATE'|'PAYOFF';
export type NeedStatus='SUPPORTED'|'UNSUPPORTED'|'EDITORIAL_ONLY'|'SKIPPED';
export interface StoryNeed {
 id:string;role:ProgressiveRole;question:string;query:string;subject:string;
 desiredPredicates:string[];dependsOn:string[];priority:number;status:NeedStatus;
 supportingRelationIds:string[];evidenceIds:string[];contextRelationIds:string[];
 requirement:string;epistemicClass:'RESEARCH_QUESTION'|'EDITORIAL_INTENT';
}
const actualCause=new Set(['CAUSES','CAUSED_BY','FAILS_BECAUSE']);
const statePredicates=()=>[...PHYSICAL].filter(p=>p!=='OPERATE_BY');
const changes={has:(p:string)=>PHYSICAL.has(p)&&p!=='OPERATE_BY'};
const usable=(r:KnowledgeRelation)=>r.modality==='ASSERTED'&&r.proof.length>0&&['SUPPORTED','CORROBORATED'].includes(r.status);
const ordered=(rs:KnowledgeRelation[])=>[...rs].sort((a,b)=>{const x=a.proof[0],y=b.proof[0];return (x?.sourceId??'').localeCompare(y?.sourceId??'','en')||(x?.span.start??0)-(y?.span.start??0)||a.id.localeCompare(b.id,'en');});
const participants=(r:KnowledgeRelation)=>{
 // A route preposition belongs to this explicit argument, not to an alias.
 // No head-noun matching: "industrial pumps" never becomes "pumps".
 const object=entityKey(r.object).replace(/^(?:para|por|pelo|pela|pelos|pelas|atraves de|through|into|to)\s+(?:o |a |os |as |the )?/,'');
 return ['CAUSED_BY','FAILS_BECAUSE'].includes(r.predicate)?[entityKey(r.object),entityKey(r.subject)]:[entityKey(r.subject),PHYSICAL.has(r.predicate)?object:entityKey(r.object)];
};
export function progressiveRole(r:KnowledgeRelation):ProgressiveRole {
 return r.predicate==='HAS_GOAL'?'GOAL':r.predicate==='USED_FOR'?'EXPLANATION':r.predicate==='ATTEMPTS'?'ATTEMPT':r.predicate==='FAILS_BECAUSE'?'PROBLEM':r.predicate==='SOLVES'?'SOLUTION':actualCause.has(r.predicate)?'CAUSE':['OUTPUTS','TRANSFORM'].includes(r.predicate)?'FINAL_STATE':changes.has(r.predicate)?'STATE_CHANGE':'INITIAL_STATE';
}
export function groundedProgression(k:MechanismKnowledge,selectedRelationIds?:readonly string[]){
 const rs=ordered(k.relations.filter(r=>usable(r)&&(!selectedRelationIds||selectedRelationIds.includes(r.id)))),events=rs.filter(r=>changes.has(r.predicate)||actualCause.has(r.predicate)||r.predicate==='PRECEDES');
 const links:{from:string;to:string;participant:string;basis:'EXPLICIT_SHARED_ARGUMENT'|'EXPLICIT_LOCAL_ROUTE';meaning:'PLANNING_CONTINUITY_ONLY';evidenceIds:string[]}[]=[];
 for(const a of events)for(const b of events){
  if(a.id===b.id||a.temporalContext!==b.temporalContext)continue;
  const out=participants(a)[1],input=participants(b)[0];
  // A bare shared subject, nearby text, common category or purpose cannot
  // establish state continuity. Nonasserted/conditional events stay outside.
  const route=a.proof.some(x=>{const p=x.resolution?.parse?.route;return p&&b.proof.some(y=>{const q=y.resolution?.parse?.route;return q&&x.sourceId===y.sourceId&&x.snapshotHash===y.snapshotHash&&x.span.start===y.span.start&&p.group===q.group&&q.step===p.step+1&&entityKey(p.actor)===entityKey(q.actor)&&entityKey(a.subject)===entityKey(b.subject);});});
  if(out&&out===input||route)links.push({from:a.id,to:b.id,participant:route?a.subject:out,basis:route?'EXPLICIT_LOCAL_ROUTE':'EXPLICIT_SHARED_ARGUMENT',meaning:'PLANNING_CONTINUITY_ONLY',evidenceIds:[...new Set([...a.proof,...b.proof].map(p=>p.evidenceId))].sort()});
 }
 let explored=0,complete=true,best:string[]=[];const limit=20000;
 const visit=(id:string,path:string[])=>{if(++explored>limit){complete=false;return;}const next=[...path,id];if(next.length>best.length)best=next;for(const l of links.filter(l=>l.from===id))if(!next.includes(l.to))visit(l.to,next);};
 for(const r of events){if(!complete)break;visit(r.id,[]);}
 const pairs:{problemRelationId:string;solutionRelationId:string;kind:'REPAIR'|'PREVENTION';target:string;evidenceIds:string[]}[]=[];
 for(const p of rs.filter(r=>r.predicate==='FAILS_BECAUSE'))for(const s of rs.filter(r=>['SOLVES','PREVENTS'].includes(r.predicate))){
  // FAILS_BECAUSE(problem,cause). A solution must name that exact target;
  // a solution somewhere in the same system is insufficient.
  if(p.temporalContext!==s.temporalContext||entityKey(p.subject)!==entityKey(s.object))continue;
  pairs.push({problemRelationId:p.id,solutionRelationId:s.id,kind:s.predicate==='PREVENTS'?'PREVENTION':'REPAIR',target:s.object,evidenceIds:[...new Set([...p.proof,...s.proof].map(x=>x.evidenceId))].sort()});
 }
 const states=rs.filter(r=>changes.has(r.predicate)).map(r=>({id:'GS_'+r.id,relationId:r.id,subject:r.subject,before:{status:'UNKNOWN' as const,description:null},after:{status:'GROUNDED_PROPOSITION' as const,description:[r.subject,r.predicate,r.object].join(' ')},modality:r.modality,temporalContext:r.temporalContext,evidenceIds:r.proof.map(p=>p.evidenceId),meaning:'SEMANTIC_DESCRIPTION_NOT_SIMULATION' as const}));
 // Reuse the existing SOLVES/CAUSES/SOLVES construction. An unwanted new
 // effect is identified by another explicit SOLVES target, not a negative
 // adjective or a requested story slot. This is a functional role index;
 // it adds neither chronological assertions nor inferred final success.
 const roleBranches:{solutionRelationId:string;newProblemRelationId:string;nextSolutionRelationId:string;evidenceIds:string[]}[]=[];
 for(const cause of rs.filter(r=>r.predicate==='CAUSES'))for(const solution of rs.filter(r=>r.predicate==='SOLVES'&&entityKey(r.subject)===entityKey(cause.subject)&&entityKey(r.object)!==entityKey(cause.object)))for(const next of rs.filter(r=>r.predicate==='SOLVES'&&r.id!==solution.id&&entityKey(r.object)===entityKey(cause.object))){
  if(solution.temporalContext!==cause.temporalContext||next.temporalContext!==cause.temporalContext)continue;
  roleBranches.push({solutionRelationId:solution.id,newProblemRelationId:cause.id,nextSolutionRelationId:next.id,evidenceIds:[...new Set([...solution.proof,...cause.proof,...next.proof].map(p=>p.evidenceId))].sort()});
 }
 const chainSet=new Set(best),causal=events.filter(r=>actualCause.has(r.predicate)),physical=events.filter(r=>changes.has(r.predicate)),connected=new Set(links.flatMap(l=>[l.from,l.to]));
 const metrics={longestGroundedChain:best.length,connectedRelationCount:connected.size,stateChangeCount:states.length,groundedProblemCount:rs.filter(r=>r.predicate==='FAILS_BECAUSE').length,groundedSolutionCount:rs.filter(r=>r.predicate==='SOLVES').length,groundedProblemSolutionPairs:pairs.filter(p=>p.kind==='REPAIR').length,groundedPreventionPairs:pairs.filter(p=>p.kind==='PREVENTION').length,causalEdges:causal.length,physicalEdges:physical.length,visualizableEdges:physical.filter(r=>['FLOW','PASSES_THROUGH','MOVE_WITHIN','COLLECT'].includes(r.predicate)).length,mechanismChainCoverage:physical.length&&best.length>1?physical.filter(r=>chainSet.has(r.id)).length/physical.length:0,causalChainCoverage:causal.length&&best.length>1?causal.filter(r=>chainSet.has(r.id)).length/causal.length:0};
 const classification=complete&&best.length>=3&&states.filter(s=>chainSet.has(s.relationId)).length>=2?(causal.some(r=>chainSet.has(r.id))?'PROGRESSIVE_CAUSAL' as const:'PROGRESSIVE' as const):events.length?'EXPLANATORY' as const:'LIST_LIKE' as const;
 const raw={version:'grounded-progression/1.0.0',knowledgeFingerprint:k.fingerprint,...(selectedRelationIds?{selectedRelationIds:[...selectedRelationIds].sort()}:{}),orderedRelationIds:[...best,...rs.filter(r=>!chainSet.has(r.id)).map(r=>r.id)],longestChainRelationIds:best,searchComplete:complete,explored,links,states,problemSolutionPairs:pairs,...(roleBranches.length?{roleBranches}:{}),metrics,classification,factualEdgesAdded:0,meaning:'INDICES_OVER_EXISTING_RELATIONS' as const};
 return{...raw,fingerprint:jsonHash(raw)};
}

export function buildStoryNeeds(k:MechanismKnowledge):StoryNeed[]{
 const p=groundedProgression(k),rs=k.relations.filter(usable),subject=topicSubject(k.topic),en=/\b(?:how|works?|explain)\b/i.test(k.topic);
 const rows:{role:ProgressiveRole;predicates:string[];cue:string;english:string;priority:number;minimum?:number;skip?:boolean;editorial?:boolean}[]=[
  {role:'GOAL',predicates:['HAS_GOAL','USED_FOR'],cue:'finalidade',english:'purpose',priority:40},
  {role:'INITIAL_STATE',predicates:['IS_A','LOCATED_IN','CONTAINS'],cue:'estrutura funcionamento',english:'structure working principle',priority:30},
  {role:'EXPLANATION',predicates:[...statePredicates(),...actualCause,'PRECEDES'],cue:'funcionamento etapas',english:'working principle stages',priority:100,minimum:3},
  {role:'CAUSE',predicates:[...actualCause],cue:'funcionamento causas',english:'working principle causes',priority:95},
  {role:'PROBLEM',predicates:['FAILS_BECAUSE'],cue:'falhas causas',english:'failure causes',priority:85},
  {role:'SOLUTION',predicates:['SOLVES'],cue:'falha solução mecanismo',english:'failure solution mechanism',priority:90,skip:!rs.some(r=>r.predicate==='FAILS_BECAUSE')},
  {role:'STATE_CHANGE',predicates:statePredicates(),cue:'etapas transformação movimento',english:'stages transformation movement',priority:70},
  {role:'ATTEMPT',predicates:['ATTEMPTS'],cue:'tentativa documentada',english:'documented attempt',priority:10,skip:true},
  {role:'NEW_PROBLEM',predicates:[],cue:'nova falha documentada',english:'documented subsequent failure',priority:10,skip:true},
  {role:'NEXT_SOLUTION',predicates:[],cue:'intervenção posterior documentada',english:'documented subsequent intervention',priority:10,skip:true},
  {role:'FINAL_STATE',predicates:['OUTPUTS','TRANSFORM'],cue:'resultado funcionamento',english:'working output',priority:60},
  {role:'PAYOFF',predicates:[],cue:'como funciona',english:'how it works',priority:0,editorial:true}
 ];
 const ids=Object.fromEntries(rows.map(r=>[r.role,'NEED_'+jsonHash([k.topic,r.role]).slice(0,16)]));
 return rows.map(row=>{
  const branchIds=row.role==='NEW_PROBLEM'?p.roleBranches?.map(b=>b.newProblemRelationId):row.role==='NEXT_SOLUTION'?p.roleBranches?.map(b=>b.nextSolutionRelationId):undefined;
  const matches=rs.filter(r=>(branchIds?.includes(r.id)||row.predicates.includes(r.predicate))&&(row.role!=='GOAL'||entityKey(r.subject)===entityKey(subject))),supported=row.role==='EXPLANATION'?p.searchComplete&&p.metrics.longestGroundedChain>=3:row.role==='SOLUTION'?p.metrics.groundedProblemSolutionPairs>0||Boolean(p.roleBranches?.length):matches.length>0;
  const support=supported?matches:[],status:NeedStatus=row.editorial?'EDITORIAL_ONLY':supported?'SUPPORTED':row.skip?'SKIPPED':'UNSUPPORTED';
  const question=en?`What does a source explicitly document about ${row.english} of ${subject}?`:`O que uma fonte documenta explicitamente sobre ${row.cue} de ${subject}?`;
  return{id:ids[row.role],role:row.role,question,query:[subject,en?row.english:row.cue].join(' '),subject,desiredPredicates:row.predicates,dependsOn:row.role==='SOLUTION'?[ids.PROBLEM]:row.role==='FINAL_STATE'?[ids.EXPLANATION]:[],priority:row.priority,status,supportingRelationIds:support.map(r=>r.id),evidenceIds:[...new Set(support.flatMap(r=>r.proof.map(p=>p.evidenceId)))].sort(),contextRelationIds:matches.map(r=>r.id),requirement:row.role==='EXPLANATION'?'Three explicitly connected source-grounded events; shared arguments are planning continuity, not inferred causality':row.role==='SOLUTION'?'Explicit SOLVES target matching an admitted problem; PREVENTS is separate':'Exact admitted relation with preserved identity, negation, modality and conditions; role is optional',epistemicClass:row.editorial?'EDITORIAL_INTENT':'RESEARCH_QUESTION'};
 });
}
