import {jsonHash} from '../editorial/fingerprint';
import {topicSubject} from '../topic/subject';
import {processCoverage,CAUSAL,PHYSICAL} from '../curiosity/knowledge';
import type {EvidencePack,ResearchPlan} from './contracts';
import type {SearchQuery} from './web/contracts';
export type ProcessQueryFamily='OVERVIEW'|'MECHANISM'|'COMPONENTS'|'SEQUENCE'|'CAUSE_EFFECT'|'CONSTRAINT'|'FAILURE'|'SOLUTION'|'WORKING_PRINCIPLE'|'CONSTRUCTION'|'SPATIAL_STRUCTURE';
const cues:Record<ProcessQueryFamily,[string,string]>={OVERVIEW:['',''],MECHANISM:['mecanismo','mechanism'],COMPONENTS:['componentes','components'],SEQUENCE:['etapas','stages'],CAUSE_EFFECT:['funcionamento causas','working principle causes'],CONSTRAINT:['limitações','constraints'],FAILURE:['falhas','failure'],SOLUTION:['função','function'],WORKING_PRINCIPLE:['princípio de funcionamento','working principle'],CONSTRUCTION:['construção','construction'],SPATIAL_STRUCTURE:['estrutura interna','internal structure']};
export function processResearchGaps(pack:EvidencePack){
 const facts=pack.groundedFacts.filter(f=>f.usableForPrimaryClaim),p=new Set(facts.filter(f=>f.canonicalFact.qualifiers.includes('MECHANISM_V2')).map(f=>f.canonicalFact.predicate));
 const rows:{family:ProcessQueryFamily;missingRelation:string;priority:number}[]=[];
 if(![...p].some(x=>PHYSICAL.has(x)))rows.push({family:'MECHANISM',missingRelation:'OPERATION(subject,participant)',priority:100});
 if(![...p].some(x=>CAUSAL.has(x)))rows.push({family:'CAUSE_EFFECT',missingRelation:'CAUSE(event,effect)',priority:90});
 if(!p.has('CONTAINS'))rows.push({family:'COMPONENTS',missingRelation:'CONTAINS(system,component)',priority:70});
 if(!p.has('PRECEDES'))rows.push({family:'SEQUENCE',missingRelation:'PRECEDES(event,event)',priority:60});
 if(!p.has('REQUIRES')&&!p.has('PREVENTS'))rows.push({family:'CONSTRAINT',missingRelation:'REQUIRES(process,condition)',priority:50});
 if(!p.has('SOLVES'))rows.push({family:'SOLUTION',missingRelation:'SOLVES(component,problem)',priority:40});
 return rows.map(r=>({id:'PG_'+jsonHash([pack.topic,r.missingRelation]).slice(0,16),...r,status:'GAP',evidenceRequirement:'Exact source sentence with same subject identity, modality and policy admission; not mandatory for every process'}));
}
export function processQueries(plan:ResearchPlan,pack?:EvidencePack,round=0):SearchQuery[]{
 const language=/\b(?:how|works?|explain)\b/i.test(plan.request.topic)?1:0,subject=topicSubject(plan.request.topic);
 const families=round===0?(['OVERVIEW','WORKING_PRINCIPLE'] as ProcessQueryFamily[]):processResearchGaps(pack!).sort((a,b)=>b.priority-a.priority).map(g=>g.family);
 return families.map(family=>{const gap=pack?processResearchGaps(pack).find(g=>g.family===family):null,raw={round,stage:round===0?'BROAD_DISCOVERY' as const:'FACT_VERIFICATION' as const,researchQuestionIds:plan.essentialResearchQuestionIds,text:[subject,cues[family][language]].filter(Boolean).join(' '),entityName:subject,entitySourceIds:pack?.sources.map(s=>s.id)??[],followupReason:gap?.evidenceRequirement??'Discover process subject; metadata is not evidence',derivedFrom:gap?.id??'PLAN',targetGap:gap?.missingRelation??family};return{...raw,id:'Q_'+jsonHash(raw).slice(0,16)};});
}
export function processAcquisitionSatisfied(pack:EvidencePack){const c=processCoverage(pack.groundedFacts);return c.status==='READY'&&c.uniqueRelations>=6&&c.dimensions.causal;}
