import {jsonHash} from '../editorial/fingerprint';
import {RESEARCH_LEVELS,TOPIC_PLAN_VERSION} from './contracts';
import type {ContentMode,OverrideRecord,TopicAnalysis,TopicPlan,TopicPlanningRequest,WriterRouteKind,ResearchRequirementLevel} from './contracts';
import {analyzeTopicSignals} from './analyze';
import {claimRequirements,expectedFamilies,researchLevel} from './claims';
import {routeResearch,routeWriter,visualHints} from './routing';
const MODES:ContentMode[]=['FACTUAL','FACTUAL_EXPLANATORY','FACTUAL_COMPARATIVE','FACTUAL_RANKING','FACTUAL_HYPOTHETICAL','CREATIVE','HYBRID','UNKNOWN'];
const ROUTES:WriterRouteKind[]=['GROUNDED_ONLY','SOURCE_ONLY','STRUCTURAL_ONLY','CREATIVE_ISOLATED','HYBRID_SEPARATED','CLARIFICATION_REQUIRED'];
export function validateTopicPlanningRequest(x:TopicPlanningRequest):void{
 if(!x||typeof x!=='object'||Array.isArray(x))throw Error('TOPIC_INPUT object required');
 for(const k of Object.keys(x))if(!['topicPlanningVersion','topic','language','overrides'].includes(k))throw Error('TOPIC_INPUT unknown field '+k);
 if(x.topicPlanningVersion!==1)throw Error('TOPIC_PLANNING_VERSION unsupported; opt in with topicPlanningVersion: 1');
 if(typeof x.topic!=='string'||!x.topic.trim()||x.topic.length>4000)throw Error('TOPIC_INPUT topic');
 if(x.language!==undefined&&!['pt-BR','en'].includes(x.language))throw Error('TOPIC_INPUT language');
 const o=x.overrides;if(o===undefined)return;
 if(!o||typeof o!=='object'||Array.isArray(o))throw Error('TOPIC_OVERRIDE object');
 for(const k of Object.keys(o))if(!['researchRequirement','contentMode','writerRoute','reason'].includes(k))throw Error('TOPIC_OVERRIDE unknown field '+k);
 if(o.researchRequirement!==undefined&&!RESEARCH_LEVELS.includes(o.researchRequirement))throw Error('TOPIC_OVERRIDE research level');
 if(o.contentMode!==undefined&&!MODES.includes(o.contentMode))throw Error('TOPIC_OVERRIDE content mode');
 if(o.writerRoute!==undefined&&!ROUTES.includes(o.writerRoute))throw Error('TOPIC_OVERRIDE writer route');
 if((o.researchRequirement??o.contentMode??o.writerRoute)!==undefined&&(typeof o.reason!=='string'||!o.reason.trim()))throw Error('TOPIC_OVERRIDE reason required');
}
const rank=(l:ResearchRequirementLevel)=>RESEARCH_LEVELS.indexOf(l);
/** Safe mode changes either resolve an ambiguous intent toward a factual mode,
 * or add a factual layer to a story. Nothing may switch a factual request to
 * creative (that would bypass research) unless the topic is itself a fiction premise. */
function safeModeChange(a:TopicAnalysis,to:ContentMode){
 if(to===a.contentMode)return true;
 if(a.contentMode==='UNKNOWN')return to!=='CREATIVE'&&to!=='HYBRID';
 if(a.contentMode==='CREATIVE')return to==='HYBRID';
 return false;
}
/** Writer overrides may only tighten: blocking is always safe, grounding may replace structural. */
const SAFE_WRITER:Record<WriterRouteKind,WriterRouteKind[]>={STRUCTURAL_ONLY:['GROUNDED_ONLY','SOURCE_ONLY','CLARIFICATION_REQUIRED'],GROUNDED_ONLY:['SOURCE_ONLY','CLARIFICATION_REQUIRED'],SOURCE_ONLY:['CLARIFICATION_REQUIRED'],CREATIVE_ISOLATED:['HYBRID_SEPARATED','CLARIFICATION_REQUIRED'],HYBRID_SEPARATED:['CLARIFICATION_REQUIRED'],CLARIFICATION_REQUIRED:[]};
function applyMode(a:TopicAnalysis,mode:ContentMode):TopicAnalysis{
 const intents=[a.primaryIntent,...a.secondaryIntents].filter(i=>i!=='UNKNOWN');
 if(!intents.some(i=>['EXPLANATION','RANKING','COMPARISON','HISTORICAL','BIOGRAPHICAL','LIST','MYTH_CHECK','HYPOTHETICAL'].includes(i)))intents.push('EXPLANATION');
 const families=expectedFamilies({mode,intents,rankingMetric:null,residence:false,anchors:a.factualityProfile.realWorldAnchors,questionFamilies:[],definitional:false});
 const level=researchLevel(claimRequirements(families,a.temporalProfile),mode);
 return{...a,contentMode:mode,expectedClaimFamilies:families,researchRequirement:rank(level)>=rank(a.researchRequirement)?level:a.researchRequirement,
  writerRequirement:mode==='HYBRID'?'HYBRID_SEPARATED':mode==='CREATIVE'?'CREATIVE_ISOLATED':'GROUNDED_ONLY',reasonCodes:[...a.reasonCodes,'MODE_OVERRIDE_'+mode]};
}
export function buildTopicPlan(input:TopicPlanningRequest):TopicPlan{
 validateTopicPlanningRequest(input);
 const request:TopicPlanningRequest=JSON.parse(JSON.stringify(input));
 let analysis=analyzeTopicSignals(request.topic);const overrides:OverrideRecord[]=[],o=request.overrides,reason=o?.reason?.trim()??'';
 if(o?.contentMode!==undefined){
  if(!safeModeChange(analysis,o.contentMode))throw Error('TOPIC_OVERRIDE_UNSAFE contentMode '+analysis.contentMode+' -> '+o.contentMode);
  overrides.push({field:'contentMode',requested:o.contentMode,computed:analysis.contentMode,applied:o.contentMode!==analysis.contentMode,reason});
  if(o.contentMode!==analysis.contentMode)analysis=applyMode(analysis,o.contentMode);
 }
 if(o?.researchRequirement!==undefined){
  if(rank(o.researchRequirement)<rank(analysis.researchRequirement))throw Error('TOPIC_OVERRIDE_UNSAFE researchRequirement cannot be lowered '+analysis.researchRequirement+' -> '+o.researchRequirement);
  overrides.push({field:'researchRequirement',requested:o.researchRequirement,computed:analysis.researchRequirement,applied:o.researchRequirement!==analysis.researchRequirement,reason});
  analysis={...analysis,researchRequirement:o.researchRequirement};
 }
 if(o?.writerRoute!==undefined){
  if(o.writerRoute!==analysis.writerRequirement&&!SAFE_WRITER[analysis.writerRequirement].includes(o.writerRoute))throw Error('TOPIC_OVERRIDE_UNSAFE writerRoute '+analysis.writerRequirement+' -> '+o.writerRoute);
  overrides.push({field:'writerRoute',requested:o.writerRoute,computed:analysis.writerRequirement,applied:o.writerRoute!==analysis.writerRequirement,reason});
  analysis={...analysis,writerRequirement:o.writerRoute};
 }
 const claimReqs=claimRequirements(analysis.expectedClaimFamilies,analysis.temporalProfile),researchRoute=routeResearch(analysis,claimReqs),writerRoute=routeWriter(analysis,claimReqs);
 if(writerRoute.kind==='SOURCE_ONLY')writerRoute.factPolicy='SOURCE_ONLY';
 const structuralSignature=jsonHash({primary:analysis.primaryIntent,secondary:analysis.secondaryIntents,mode:analysis.contentMode,epistemic:analysis.factualityProfile.epistemicModes,families:analysis.expectedClaimFamilies,level:analysis.researchRequirement,writer:writerRoute.kind,goal:researchRoute.researchGoal,factTypes:researchRoute.desiredFactTypes,temporal:analysis.temporalProfile.kind}).slice(0,16);
 const raw={version:TOPIC_PLAN_VERSION,topicPlanningVersion:1 as const,request,analysis,claimRequirements:claimReqs,researchRoute,writerRoute,visualHints:visualHints(analysis,claimReqs),overrides,structuralSignature};
 return{...raw,fingerprint:jsonHash(raw)};
}
/** Offline replay: a plan is valid only if rebuilding it from its own request
 * reproduces every field. A re-signed tampered plan therefore still fails. */
export function verifyTopicPlan(plan:TopicPlan):{valid:boolean;reasons:string[]}{
 const reasons:string[]=[];
 try{
  if(plan.version!==TOPIC_PLAN_VERSION)reasons.push('PLAN_VERSION');
  const {fingerprint,...raw}=plan;if(jsonHash(raw)!==fingerprint)reasons.push('FINGERPRINT_MISMATCH');
  const replay=buildTopicPlan(plan.request);
  for(const k of Object.keys(replay) as (keyof TopicPlan)[])if(jsonHash(replay[k] as object)!==jsonHash((plan[k]??null) as object))reasons.push('REPLAY_MISMATCH:'+k);
  for(const k of Object.keys(plan))if(!(k in replay))reasons.push('UNEXPECTED_FIELD:'+k);
 }catch(e){reasons.push('REPLAY_ERROR:'+(e as Error).message);}
 return{valid:!reasons.length,reasons};
}
export function assertTopicPlan(plan:TopicPlan){const v=verifyTopicPlan(plan);if(!v.valid)throw Error('TOPIC_PLAN_INVALID '+v.reasons.join(','));return plan;}
