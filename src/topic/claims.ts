import type {ClaimFamily,ClaimRequirementProfile,ClaimRisk,ContentIntent,ContentMode,ResearchRequirementLevel,TemporalProfile} from './contracts';
/** Canonical order keeps families/requirements independent of signal order. */
export const CLAIM_FAMILIES:ClaimFamily[]=['RANKING_ORDER','MEASUREMENT','RESIDENCY','QUANTITY','COMPARISON_VALUE','MYTH_VERDICT','PERSON_FACT','HISTORICAL_EVENT','EVENT_DATE','LOCATION','DEFINITION','MECHANISM','CAUSAL','PHYSICAL_PRINCIPLE','BIOLOGICAL_MECHANISM','TECHNICAL_COMPONENT','STRUCTURAL_STEP','HYPOTHETICAL_PREMISE','COUNTERFACTUAL_CONSEQUENCE','SETTING_FACT','FICTIONAL_EVENT'];
const INTENT_FAMILIES:Partial<Record<ContentIntent,ClaimFamily[]>>={
 PROCESS:['MECHANISM','STRUCTURAL_STEP'],CAUSE_EFFECT:['CAUSAL'],SCIENTIFIC:['PHYSICAL_PRINCIPLE'],BIOLOGICAL:['BIOLOGICAL_MECHANISM'],
 TECHNICAL:['TECHNICAL_COMPONENT'],HISTORICAL:['HISTORICAL_EVENT','EVENT_DATE'],BIOGRAPHICAL:['PERSON_FACT','EVENT_DATE'],GEOGRAPHIC:['LOCATION'],
 RANKING:['RANKING_ORDER'],COMPARISON:['COMPARISON_VALUE'],LIST:['DEFINITION'],MYTH_CHECK:['MYTH_VERDICT'],HYPOTHETICAL:['HYPOTHETICAL_PREMISE','COUNTERFACTUAL_CONSEQUENCE'],
};
const FICTION_INTENTS=new Set<ContentIntent>(['NARRATIVE','FICTION']);
const DOMAIN_INTENTS=new Set<ContentIntent>(['SCIENTIFIC','TECHNICAL','BIOLOGICAL','GEOGRAPHIC']);
export interface FamilyContext {mode:ContentMode;intents:ContentIntent[];rankingMetric:'TEMPERATURE'|'POPULATION'|null;residence:boolean;anchors:string[];questionFamilies:ClaimFamily[];definitional:boolean}
export function expectedFamilies(c:FamilyContext):ClaimFamily[]{
 const out=new Set<ClaimFamily>();
 if(c.mode==='CREATIVE'){out.add('FICTIONAL_EVENT');if(c.anchors.length)out.add('SETTING_FACT');}
 else if(c.mode==='UNKNOWN'){out.add('DEFINITION');}
 else{
  // HYBRID keeps the fictional layer separate and still plans the explicitly requested factual layer.
  if(c.mode==='HYBRID')out.add('FICTIONAL_EVENT');
  // In a historical/biographical request a domain noun is the subject's context, not a mechanism to explain.
  const contextualDomain=c.intents.some(i=>i==='HISTORICAL'||i==='BIOGRAPHICAL')&&!c.intents.some(i=>['PROCESS','CAUSE_EFFECT','EXPLANATION'].includes(i));
  // Ranked items carry their own identity; geography there is scope, not a separate location claim.
  const ranked=c.intents.includes('RANKING');
  for(const i of c.intents){if(FICTION_INTENTS.has(i)||contextualDomain&&DOMAIN_INTENTS.has(i)&&i!=='GEOGRAPHIC'||ranked&&i==='GEOGRAPHIC')continue;for(const f of INTENT_FAMILIES[i]??[])out.add(f);}
  if(c.intents.includes('RANKING')){out.add(c.rankingMetric==='TEMPERATURE'?'MEASUREMENT':'QUANTITY');if(c.residence)out.add('RESIDENCY');}
  for(const f of c.questionFamilies)out.add(f);
  // An explanation asks for a definition only when phrased as one, or when nothing more specific was requested.
  if(c.intents.includes('EXPLANATION')&&(c.definitional||![...out].some(f=>f!=='STRUCTURAL_STEP'&&f!=='FICTIONAL_EVENT')))out.add('DEFINITION');
  // A bare domain cue in a hybrid story is setting, not an explanatory request.
  if(c.mode==='HYBRID'&&c.intents.every(i=>FICTION_INTENTS.has(i)||DOMAIN_INTENTS.has(i)))for(const i of c.intents)for(const f of INTENT_FAMILIES[i]??[])out.delete(f);
 }
 return CLAIM_FAMILIES.filter(f=>out.has(f));
}
type Row=Omit<ClaimRequirementProfile,'claimFamily'|'reasonCodes'>;
const g=(risk:ClaimRisk,factTypes:Row['researchFactTypes'],corroboration=1,temporal:Row['temporalRequirement']='NONE'):Row=>({factualRisk:risk,epistemicMode:'FACTUAL',evidenceRequirement:corroboration>1?'CORROBORATED_FACT':'GROUNDED_FACT',corroborationRequirement:corroboration,temporalRequirement:temporal,rankingRequirement:'NONE',allowedWriterPolicy:['GROUNDED_ONLY','SOURCE_ONLY'],visualProofExpectation:'SOURCE_BACKED',researchFactTypes:factTypes,createsFactGap:true});
/** Risk table. Rows only ever add requirements; nothing here lowers a Research quorum. */
export const REQUIREMENT_TABLE:Record<ClaimFamily,Row>={
 RANKING_ORDER:{...g('CRITICAL',['RANKING'],2),rankingRequirement:'COMPLETE_SESSION_RANKING',allowedWriterPolicy:['GROUNDED_ONLY']},
 MEASUREMENT:g('HIGH',['MEASUREMENT'],2,'OBSERVATION_PERIOD'),
 RESIDENCY:g('HIGH',['RESIDENCY'],2,'CURRENT'),
 QUANTITY:g('HIGH',['QUANTITY'],2),
 COMPARISON_VALUE:g('HIGH',['COMPARISON'],2),
 MYTH_VERDICT:g('HIGH',['RELATION'],2),
 PERSON_FACT:g('HIGH',['ENTITY_EXISTENCE','TEMPORAL'],2,'EVENT_DATE'),
 HISTORICAL_EVENT:g('MEDIUM',['TEMPORAL','RELATION'],1,'EVENT_DATE'),
 EVENT_DATE:g('MEDIUM',['TEMPORAL'],1,'EVENT_DATE'),
 LOCATION:g('MEDIUM',['LOCATION']),
 DEFINITION:g('MEDIUM',['DEFINITION']),
 MECHANISM:g('MEDIUM',['PROCESS']),
 CAUSAL:g('MEDIUM',['RELATION','PROCESS']),
 PHYSICAL_PRINCIPLE:g('MEDIUM',['PROCESS','DEFINITION']),
 BIOLOGICAL_MECHANISM:g('MEDIUM',['PROCESS']),
 TECHNICAL_COMPONENT:g('MEDIUM',['DEFINITION','RELATION']),
 STRUCTURAL_STEP:{factualRisk:'LOW',epistemicMode:'STRUCTURAL',evidenceRequirement:'NONE',corroborationRequirement:0,temporalRequirement:'NONE',rankingRequirement:'NONE',allowedWriterPolicy:['STRUCTURAL_ONLY','GROUNDED_ONLY','SOURCE_ONLY'],visualProofExpectation:'STRUCTURAL_ILLUSTRATION',researchFactTypes:[],createsFactGap:false},
 HYPOTHETICAL_PREMISE:{factualRisk:'LOW',epistemicMode:'HYPOTHETICAL',evidenceRequirement:'NONE',corroborationRequirement:0,temporalRequirement:'NONE',rankingRequirement:'NONE',allowedWriterPolicy:['GROUNDED_ONLY','STRUCTURAL_ONLY'],visualProofExpectation:'SYMBOLIC',researchFactTypes:[],createsFactGap:false},
 COUNTERFACTUAL_CONSEQUENCE:{factualRisk:'MEDIUM',epistemicMode:'SUPPORTED_INFERENCE',evidenceRequirement:'GROUNDED_PREMISES',corroborationRequirement:1,temporalRequirement:'NONE',rankingRequirement:'NONE',allowedWriterPolicy:['GROUNDED_ONLY'],visualProofExpectation:'SYMBOLIC',researchFactTypes:['PROCESS','RELATION'],createsFactGap:true},
 SETTING_FACT:{factualRisk:'LOW',epistemicMode:'FACTUAL',evidenceRequirement:'OPTIONAL_SOURCE',corroborationRequirement:0,temporalRequirement:'NONE',rankingRequirement:'NONE',allowedWriterPolicy:['CREATIVE_ISOLATED','GROUNDED_ONLY'],visualProofExpectation:'SYMBOLIC',researchFactTypes:['DEFINITION'],createsFactGap:false},
 FICTIONAL_EVENT:{factualRisk:'LOW',epistemicMode:'CREATIVE',evidenceRequirement:'NONE',corroborationRequirement:0,temporalRequirement:'NONE',rankingRequirement:'NONE',allowedWriterPolicy:['CREATIVE_ISOLATED'],visualProofExpectation:'SYMBOLIC',researchFactTypes:[],createsFactGap:false},
};
const REASON:Partial<Record<ClaimFamily,string>>={RANKING_ORDER:'ORDER_CLAIM_REQUIRES_COMPLETE_COMPARABLE_EVIDENCE',MEASUREMENT:'SPECIFIC_MEASUREMENT_REQUIRES_CORROBORATION',RESIDENCY:'HUMAN_PRESENCE_CRITERION_REQUIRES_CURRENT_EVIDENCE',QUANTITY:'SPECIFIC_QUANTITY_REQUIRES_CORROBORATION',PERSON_FACT:'REAL_PERSON_CLAIMS_REQUIRE_CORROBORATION',HYPOTHETICAL_PREMISE:'PREMISE_PRESERVED_NEVER_ASSERTED',COUNTERFACTUAL_CONSEQUENCE:'CONSEQUENCE_IS_INFERENCE_FROM_GROUNDED_PREMISES',FICTIONAL_EVENT:'FICTIONAL_EVENT_NEVER_EVIDENCE_OR_FACT_GAP',SETTING_FACT:'REAL_SETTING_DETAIL_OPTIONAL_CHECK',STRUCTURAL_STEP:'SCHEMATIC_STEP_WITHOUT_SPECIFIC_FACTS'};
export function claimRequirements(families:ClaimFamily[],t:TemporalProfile):ClaimRequirementProfile[]{
 return families.map(f=>{const row=REQUIREMENT_TABLE[f],temporal=(f==='RANKING_ORDER'&&t.currentnessRequired)?'CURRENT' as const:row.temporalRequirement;
  return{claimFamily:f,...structuredClone(row),temporalRequirement:temporal,reasonCodes:['RISK_'+row.factualRisk,REASON[f]??'FACTUAL_CLAIM_REQUIRES_GROUNDING']};});
}
const RISK_ORDER:ClaimRisk[]=['LOW','MEDIUM','HIGH','CRITICAL'];
export function researchLevel(reqs:ClaimRequirementProfile[],mode:ContentMode):ResearchRequirementLevel{
 const max=Math.max(-1,...reqs.filter(r=>r.evidenceRequirement!=='NONE'&&r.evidenceRequirement!=='OPTIONAL_SOURCE').map(r=>RISK_ORDER.indexOf(r.factualRisk)));
 const level:ResearchRequirementLevel=max===3?'STRICT':max===2?'HEAVY':max>=0?'STANDARD':reqs.some(r=>r.evidenceRequirement==='OPTIONAL_SOURCE')?'LIGHT':'NONE';
 // Unknown factual intent is never treated as research-free.
 return mode==='UNKNOWN'&&(level==='NONE'||level==='LIGHT')?'STANDARD':level;
}
