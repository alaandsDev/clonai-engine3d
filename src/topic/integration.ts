import type {ResearchRequest} from '../research/contracts';
import {validateResearchRequest,researchPolicy} from '../research/request';
import type {TopicScriptRequest} from '../writer/contracts';
import type {SemanticNarrativeGraph} from '../semantics/narrative-contracts';
import type {ClaimFamily,EpistemicMode,TopicPlan} from './contracts';
import {assertTopicPlan} from './plan';
/** Opt-in adapters. Research/Writer behaviour is unchanged unless a caller
 * explicitly passes a verified TopicPlan through these functions. */
/** Capacity knobs (source sizes) are operational bounds validated by Research; they never change evidence admission or quorum. */
export interface RoutedCapacity {maxSourceBytes?:number;maxTotalSourceBytes?:number;maxNormalizedCharacters?:number;allowEnglishExtraction?:boolean}
export function buildRoutedResearchRequest(plan:TopicPlan,o:{id:string;evaluationDate?:string;maxSources?:number;maxEvidenceItems?:number;capacity?:RoutedCapacity}):ResearchRequest|null{
 assertTopicPlan(plan);const r=plan.researchRoute;
 if(r.execute==='NONE')return null;
 if(r.blockingRules.includes('RANKING_METRIC_UNSUPPORTED_BY_RESEARCH'))throw Error('TOPIC_ROUTE_UNSUPPORTED ranking metric has no Research model');
 if(r.blockingRules.includes('RESIDENCY_CRITERION_REQUIRED'))throw Error('TOPIC_ROUTE_UNSUPPORTED explicit residency criterion required');
 if(!r.researchGoal||!r.desiredFactTypes.length)throw Error('TOPIC_ROUTE_UNSUPPORTED no researchable fact family');
 const quorum=Object.entries(r.quorum.factTypeQuorum);
 const request:ResearchRequest={version:1,id:o.id,topic:plan.request.topic,language:'pt-BR',researchGoal:r.researchGoal,desiredFactTypes:r.desiredFactTypes,
  ...(r.constraints&&Object.keys(r.constraints).length?{constraints:r.constraints}:{}),
  sourcePolicy:{minIndependentSources:r.quorum.minIndependentSources,minPrimaryQuality:r.quorum.minPrimaryQuality,researchVersion:4,
   ...(quorum.length?{factTypeQuorum:Object.fromEntries(quorum.map(([t,n])=>[t,{minIndependentOrigins:n}]))}:{}),
   ...(o.evaluationDate?{evaluationDate:o.evaluationDate}:{}),...(o.capacity??{})},
  ...(o.maxSources?{maxSources:o.maxSources}:{}),...(o.maxEvidenceItems?{maxEvidenceItems:o.maxEvidenceItems}:{})};
 validateResearchRequest(request);
 return request;
}
/** Compares the safety-relevant policy of a routed request against a reference
 * request. Routing may add requirements; it must never relax one. */
export function policyNotRelaxed(routed:ResearchRequest,reference:ResearchRequest){
 const a=researchPolicy(routed),b=researchPolicy(reference),diffs:string[]=[];
 if(a.minIndependentSources<b.minIndependentSources)diffs.push('minIndependentSources');
 if(b.minPrimaryQuality==='HIGH'&&a.minPrimaryQuality!=='HIGH')diffs.push('minPrimaryQuality');
 for(const [t,q] of Object.entries(b.factTypeQuorum??{})){const mine=(a.factTypeQuorum as Record<string,{minIndependentOrigins:number;singleOriginAuthority?:unknown}>|undefined)?.[t];if(!mine||mine.minIndependentOrigins<q.minIndependentOrigins)diffs.push('factTypeQuorum.'+t);if(mine?.singleOriginAuthority&&!q.singleOriginAuthority)diffs.push('singleOriginAuthority.'+t);}
 for(const t of reference.desiredFactTypes)if(!routed.desiredFactTypes.includes(t))diffs.push('desiredFactTypes.'+t);
 for(const k of ['metric','qualifier','residencyCriterion','rankingCount'] as const)if(reference.constraints?.[k]!==undefined&&routed.constraints?.[k]!==reference.constraints[k])diffs.push('constraints.'+k);
 if(routed.researchGoal!==reference.researchGoal)diffs.push('researchGoal');
 return{notRelaxed:!diffs.length,diffs};
}
export interface ResearchStateForWriter {resultState:string|null;writerStatus:string|null;rankingStatus:string|null;productionEligibility:string|null}
export interface TopicWriterGate {decision:'PROCEED_GROUNDED'|'PROCEED_STRUCTURAL'|'BLOCKED'|'CLARIFY'|'CREATIVE_UNAVAILABLE';factPolicy:TopicScriptRequest['factPolicy']|null;reasons:string[];evidenceRequiredFamilies:ClaimFamily[];evidenceNotRequiredFamilies:ClaimFamily[]}
/** Writer gate. STRICT never proceeds on incomplete research; fictional
 * families never require Evidence; unresolved intent asks for clarification. */
export function topicWriterGate(plan:TopicPlan,research:ResearchStateForWriter|null):TopicWriterGate{
 assertTopicPlan(plan);const w=plan.writerRoute,reasons:string[]=[];
 const evidenceRequiredFamilies=plan.claimRequirements.filter(r=>!['NONE','OPTIONAL_SOURCE'].includes(r.evidenceRequirement)).map(r=>r.claimFamily);
 const evidenceNotRequiredFamilies=plan.claimRequirements.filter(r=>['NONE','OPTIONAL_SOURCE'].includes(r.evidenceRequirement)).map(r=>r.claimFamily);
 const base={evidenceRequiredFamilies,evidenceNotRequiredFamilies};
 if(w.kind==='CLARIFICATION_REQUIRED')return{decision:'CLARIFY',factPolicy:null,reasons:['INTENT_UNRESOLVED'],...base};
 if(w.kind==='CREATIVE_ISOLATED'||w.kind==='HYBRID_SEPARATED')return{decision:'CREATIVE_UNAVAILABLE',factPolicy:null,reasons:['CREATIVE_WRITER_NOT_AVAILABLE',...(w.kind==='HYBRID_SEPARATED'?['FACT_LAYER_STILL_REQUIRES_GROUNDING']:['FICTIONAL_EVENTS_NEED_NO_EVIDENCE'])],...base};
 if(w.kind==='STRUCTURAL_ONLY')return{decision:'PROCEED_STRUCTURAL',factPolicy:'STRUCTURAL_ONLY',reasons:['NO_FACTUAL_FAMILY_REQUIRES_EVIDENCE'],...base};
 if(!research){reasons.push('RESEARCH_REQUIRED_NOT_RUN');return{decision:'BLOCKED',factPolicy:w.factPolicy,reasons,...base};}
 if(plan.researchRoute.level==='STRICT'){
  if(research.rankingStatus!==null&&research.rankingStatus!=='VALID')reasons.push('RANKING_NOT_VALID:'+research.rankingStatus);
  if(research.productionEligibility!=='RESEARCH_READY')reasons.push('RESEARCH_INCOMPLETE');
  if(research.resultState!==null&&research.resultState!=='REAL_RESEARCH_READY')reasons.push('RESULT_STATE:'+research.resultState);
  if(research.writerStatus!==null&&research.writerStatus!=='READY')reasons.push('WRITER_STATUS:'+research.writerStatus);
 }else if(research.productionEligibility!=='RESEARCH_READY')reasons.push(plan.researchRoute.level==='HEAVY'?'HIGH_RISK_FACTS_NOT_READY':'RESEARCH_INCOMPLETE');
 if(reasons.length)return{decision:'BLOCKED',factPolicy:w.factPolicy,reasons,...base};
 return{decision:'PROCEED_GROUNDED',factPolicy:w.factPolicy,reasons:['RESEARCH_READY','ONLY_GROUNDED_FAMILIES_MAY_BE_ASSERTED'],...base};
}
/** Derives the Writer request from a verified plan; the plan's topic and fact
 * policy are authoritative and a caller cannot weaken them. */
export function deriveWriterRequest(plan:TopicPlan,base:Omit<TopicScriptRequest,'topic'|'factPolicy'>):TopicScriptRequest{
 assertTopicPlan(plan);const p=plan.writerRoute.factPolicy;
 if(!p)throw Error('TOPIC_WRITER_ROUTE '+plan.writerRoute.kind+' has no Writer fact policy');
 if('topic' in base||'factPolicy' in base)throw Error('TOPIC_WRITER_ROUTE topic/factPolicy come from the plan');
 return{...structuredClone(base),topic:plan.request.topic,factPolicy:p};
}
export interface ClaimEpistemicAnnotation {claimId:string;text:string;modality:string;negated:boolean;role:string;epistemicMode:EpistemicMode;requiresEvidence:boolean;reason:string}
/** Semantic Claim stage metadata: reuses Phase16 modality/negation/question
 * analysis; topic plan decides only whether the layer is fictional/hypothetical. */
export function annotateSemanticClaims(graph:SemanticNarrativeGraph,plan:TopicPlan):ClaimEpistemicAnnotation[]{
 assertTopicPlan(plan);const mode=plan.analysis.contentMode;
 return graph.claims.map(c=>{
  const base={claimId:c.id,text:c.text,modality:c.modality,negated:c.negated,role:c.narrativeRole};
  if(mode==='CREATIVE')return{...base,epistemicMode:'CREATIVE' as const,requiresEvidence:false,reason:'Fictional layer; never Evidence nor FactGap'};
  if(c.narrativeRole==='QUESTION')return{...base,epistemicMode:'STRUCTURAL' as const,requiresEvidence:false,reason:'Question asserts nothing'};
  if(c.modality==='HYPOTHETICAL')return{...base,epistemicMode:'HYPOTHETICAL' as const,requiresEvidence:false,reason:'Hypothetical premise preserved, not asserted'};
  if(c.modality==='POSSIBLE'||c.modality==='UNCERTAIN')return{...base,epistemicMode:'SUPPORTED_INFERENCE' as const,requiresEvidence:true,reason:'Hedged claim still needs grounded premises'};
  if(!c.requiresVisualProof&&c.narrativeRole!=='FACT')return{...base,epistemicMode:'STRUCTURAL' as const,requiresEvidence:false,reason:'Context/purpose without factual content'};
  return{...base,epistemicMode:mode==='UNKNOWN'?'UNKNOWN' as const:'FACTUAL' as const,requiresEvidence:true,reason:c.negated?'Negated factual claim still needs grounding':'Asserted factual claim'};
 });
}
export function semanticStageMetadata(plan:TopicPlan){
 return{topicPlanFingerprint:plan.fingerprint,contentMode:plan.analysis.contentMode,epistemicModes:plan.analysis.factualityProfile.epistemicModes,hypotheticalPremise:plan.analysis.factualityProfile.hypotheticalPremise,fictionalPremise:plan.analysis.factualityProfile.fictionalPremise,evidenceFamilies:plan.researchRoute.evidenceRequirements.map(e=>e.claimFamily)};
}
