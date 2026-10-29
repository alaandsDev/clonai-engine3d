import type {FactType} from '../research/contracts';
import type {Arc} from '../writer/contracts';
import type {ClaimRequirementProfile,ResearchRoute,TopicAnalysis,VisualPlanningHint,WriterRoute,ResearchRequirementLevel} from './contracts';
import {SUPERLATIVE_DIMENSIONS} from './signals';
/** Deterministic router: pure function of the analysis and requirement table.
 * No network, filesystem, clock or randomness. Levels only ever add quorum. */
const QUORUM:Record<ResearchRequirementLevel,{minIndependentSources:number;minPrimaryQuality:'MEDIUM'|'HIGH'}>={NONE:{minIndependentSources:1,minPrimaryQuality:'MEDIUM'},LIGHT:{minIndependentSources:1,minPrimaryQuality:'MEDIUM'},STANDARD:{minIndependentSources:1,minPrimaryQuality:'MEDIUM'},HEAVY:{minIndependentSources:2,minPrimaryQuality:'MEDIUM'},STRICT:{minIndependentSources:2,minPrimaryQuality:'MEDIUM'}};
export function routeResearch(a:TopicAnalysis,reqs:ClaimRequirementProfile[]):ResearchRoute{
 const level=a.researchRequirement,reasonCodes:string[]=['LEVEL_'+level],blockingRules:string[]=[];
 const evidence=reqs.filter(r=>r.createsFactGap&&r.researchFactTypes.length);
 // Fictional events, preserved premises and schematic steps never become FactGaps or EvidenceRequirements.
 const excludedFamilies=reqs.filter(r=>!r.createsFactGap).map(r=>({claimFamily:r.claimFamily,reason:r.reasonCodes[1]}));
 const desiredFactTypes=[...new Set(evidence.flatMap(r=>r.researchFactTypes))].sort() as FactType[];
 const ranking=reqs.some(r=>r.claimFamily==='RANKING_ORDER');
 const researchGoal=level==='NONE'?null:ranking?'RANKING':reqs.some(r=>['MECHANISM','BIOLOGICAL_MECHANISM','PHYSICAL_PRINCIPLE','COUNTERFACTUAL_CONSEQUENCE'].includes(r.claimFamily))?'PROCESS':'FACTS';
 let constraints:ResearchRoute['constraints']=null;
 if(ranking){
  const dim=SUPERLATIVE_DIMENSIONS.find(d=>d.id===a.comparisonProfile.dimension);
  constraints={...(a.comparisonProfile.rankingCount?{rankingCount:a.comparisonProfile.rankingCount}:{}),...(dim?.metric?{metric:dim.metric}:{}),...(dim?.qualifier?{qualifier:dim.qualifier}:{}),...(reqs.some(r=>r.claimFamily==='RESIDENCY')&&!a.riskFlags.includes('RESIDENCY_CRITERION_AMBIGUOUS')?{residencyCriterion:'PERMANENT_POPULATION' as const}:{})};
  blockingRules.push('WRITER_BLOCKED_UNLESS_RANKING_VALID','SESSION_SCOPE_ONLY_NO_GLOBAL_SUPERLATIVE','RESEARCH_V4_REQUIRED');
  if(!dim?.metric)blockingRules.push('RANKING_METRIC_UNSUPPORTED_BY_RESEARCH');
  if(a.riskFlags.includes('RESIDENCY_CRITERION_AMBIGUOUS'))blockingRules.push('RESIDENCY_CRITERION_REQUIRED');
 }
 else if(reqs.some(r=>r.claimFamily==='QUANTITY')&&a.signals.some(s=>s.feature==='population'))constraints={metric:'POPULATION'};
 if(level==='STRICT'||level==='HEAVY')blockingRules.push('CORROBORATION_REQUIRED_FOR_HIGH_RISK_FAMILIES');
 if(reqs.some(r=>r.claimFamily==='COUNTERFACTUAL_CONSEQUENCE'))blockingRules.push('PREMISE_NOT_RESEARCHED_AS_FACT');
 const factTypeQuorum:Record<string,number>={};
 for(const r of evidence)for(const t of r.researchFactTypes)if(['MEASUREMENT','RESIDENCY','QUANTITY'].includes(t)&&r.corroborationRequirement>1)factTypeQuorum[t]=Math.max(factTypeQuorum[t]??0,r.corroborationRequirement);
 if(excludedFamilies.some(f=>f.claimFamily==='FICTIONAL_EVENT'))reasonCodes.push('FICTIONAL_EVENTS_EXCLUDED_FROM_RESEARCH');
 return{level,execute:level==='NONE'?'NONE':level==='LIGHT'?'OPTIONAL':'REQUIRED',researchGoal,researchVersion:level==='NONE'?null:4,desiredFactTypes,constraints,
  quorum:{...QUORUM[level],factTypeQuorum},evidenceRequirements:evidence.map(r=>({claimFamily:r.claimFamily,factTypes:r.researchFactTypes,requirement:r.evidenceRequirement,corroboration:r.corroborationRequirement,temporal:r.temporalRequirement})),
  excludedFamilies,blockingRules,reasonCodes};
}
const ARC_BY_INTENT:[string,Arc][]=[['RANKING','RANKING'],['COMPARISON','COMPARISON'],['HYPOTHETICAL','BEFORE_AFTER'],['PROCESS','PROCESS_EXPLAINER'],['CAUSE_EFFECT','QUESTION_REVEAL'],['EXPLANATION','QUESTION_REVEAL'],['HISTORICAL','PATH_JOURNEY'],['TECHNICAL','OBJECT_EXPLAINER']];
export function routeWriter(a:TopicAnalysis,reqs:ClaimRequirementProfile[]):WriterRoute{
 const kind=a.writerRequirement,intents=[a.primaryIntent,...a.secondaryIntents];
 const groundingFamilies=reqs.filter(r=>['GROUNDED_FACT','CORROBORATED_FACT','GROUNDED_PREMISES'].includes(r.evidenceRequirement)).map(r=>r.claimFamily);
 const structuralFamilies=reqs.filter(r=>r.epistemicMode==='STRUCTURAL'||r.epistemicMode==='HYPOTHETICAL').map(r=>r.claimFamily);
 const creativeFamilies=reqs.filter(r=>r.epistemicMode==='CREATIVE').map(r=>r.claimFamily);
 const blockedWhen:string[]=[],reasonCodes:string[]=['ROUTE_'+kind];
 if(a.researchRequirement==='STRICT')blockedWhen.push('RESEARCH_INCOMPLETE','RANKING_NOT_VALID');
 if(a.researchRequirement==='HEAVY')blockedWhen.push('HIGH_RISK_FACT_NOT_CORROBORATED');
 if(kind==='CLARIFICATION_REQUIRED')blockedWhen.push('INTENT_UNRESOLVED');
 if(kind==='CREATIVE_ISOLATED'||kind==='HYBRID_SEPARATED')blockedWhen.push('CREATIVE_WRITER_NOT_AVAILABLE');
 if(kind==='CREATIVE_ISOLATED')reasonCodes.push('FICTIONAL_EVENTS_NEED_NO_EVIDENCE');
 if(kind==='HYBRID_SEPARATED')reasonCodes.push('FICTION_AND_FACT_LAYERS_SEPARATED');
 if(a.factualityProfile.hypotheticalPremise)reasonCodes.push('HYPOTHETICAL_PREMISE_LABELLED');
 const factPolicy=kind==='GROUNDED_ONLY'||kind==='HYBRID_SEPARATED'?'GROUNDED_ONLY' as const:kind==='STRUCTURAL_ONLY'?'STRUCTURAL_ONLY' as const:null;
 return{kind,factPolicy,requiresCompleteResearch:a.researchRequirement==='STRICT',groundingFamilies,structuralFamilies,creativeFamilies,
  epistemicSeparation:a.factualityProfile.epistemicModes.length>1,strategyHint:kind==='CREATIVE_ISOLATED'||kind==='CLARIFICATION_REQUIRED'?null:ARC_BY_INTENT.find(([i])=>intents.includes(i as never))?.[1]??null,blockedWhen,reasonCodes};
}
/** Planning hints only: they name existing Writer arcs and proof expectations;
 * they create no assets and request no new Engine3D capability. */
export function visualHints(a:TopicAnalysis,reqs:ClaimRequirementProfile[]):VisualPlanningHint[]{
 const i=new Set([a.primaryIntent,...a.secondaryIntents]),out:VisualPlanningHint[]=[],proof=(f:string)=>reqs.find(r=>r.claimFamily===f)?.visualProofExpectation??'SYMBOLIC';
 const add=(kind:VisualPlanningHint['kind'],arc:Arc|null,family:string,note:string)=>out.push({kind,arc,proof:proof(family),note});
 if(a.contentMode==='CREATIVE'||a.contentMode==='HYBRID')add('SCENE',null,'FICTIONAL_EVENT','Illustrative scene; never presented as documentary proof');
 if(i.has('RANKING'))add('RANKED_ORDER','RANKING','RANKING_ORDER','Order shown only from a VALID session-scoped ranking');
 if(i.has('COMPARISON'))add('COMPARISON_SPLIT','COMPARISON','COMPARISON_VALUE','Values only from grounded comparable facts');
 if(i.has('PROCESS'))add('PROCESS_DIAGRAM','PROCESS_EXPLAINER','STRUCTURAL_STEP','Schematic steps; specific mechanism labels need grounding');
 if(i.has('CAUSE_EFFECT')&&a.contentMode!=='CREATIVE')add('CAUSE_CHAIN','QUESTION_REVEAL','CAUSAL','Cause links only from grounded causal facts');
 if(i.has('HYPOTHETICAL'))add('COUNTERFACTUAL_BEFORE_AFTER','BEFORE_AFTER','COUNTERFACTUAL_CONSEQUENCE','Premise labelled hypothetical; consequences labelled inference');
 if(i.has('HISTORICAL'))add('TIMELINE','PATH_JOURNEY','EVENT_DATE','Dates only from grounded temporal facts');
 if(i.has('BIOGRAPHICAL'))add('PORTRAIT_CONTEXT',null,'PERSON_FACT','No likeness assets are created');
 if(i.has('GEOGRAPHIC')&&a.contentMode!=='CREATIVE')add('MAP_CONTEXT',null,'LOCATION','Locations only from grounded facts');
 if(i.has('TECHNICAL')&&a.contentMode!=='CREATIVE')add('OBJECT_CUTAWAY','OBJECT_EXPLAINER','TECHNICAL_COMPONENT','Generic cutaway; component names need grounding');
 return out;
}
