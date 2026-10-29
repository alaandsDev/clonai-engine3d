import {jsonHash} from '../editorial/fingerprint';
import {normalize} from '../semantics/normalize';
import type {Modality,SourceSpan} from '../semantics/contracts';
import type {EvidencePack,GroundedFact} from '../research/contracts';
import {validateEvidencePack} from '../research/qa';

export const CAUSAL = new Set(['CAUSES','CAUSED_BY','FAILS_BECAUSE','PREVENTS','ENABLES','SOLVES','USED_FOR']);
export const PHYSICAL = new Set(['FLOW','PASSES_THROUGH','ENTER','EXIT','RISE','DESCEND','MOVE','DRIVES','ROTATE','COMPRESS','PUSH','TRANSFORM','OUTPUTS','COLLECT','OPEN','CLOSE','EXPEL','MOVE_WITHIN','OPERATE_BY']);
export const CONSTRAINT = new Set(['REQUIRES','WITHOUT_CONDITION','FAILS_BECAUSE','PREVENTS','DESIGNED_FOR']);
export const SPATIAL = new Set(['LOCATED_IN','LOCATED_BELOW','LOCATED_ABOVE','SURROUNDS','PASSES_THROUGH','MOVE_WITHIN']);
export const COMPONENT = new Set(['CONTAINS']);
export const entityKey=(s:string)=>normalize(s).trim().replace(/^(?:o|a|os|as|um|uma|uns|umas|the|an)\s+/,'').replace(/[.!]+$/,'');
export interface KnowledgeProof {evidenceId:string;sourceId:string;snapshotHash:string;span:SourceSpan;contextSpans:SourceSpan[];originGroupId:string|null;sourceLocator:string;resolution?:import('../research/contracts').Evidence['mechanismContext']}
export interface KnowledgeRelation {
 id:string;subject:string;predicate:string;object:string;modality:Modality;status:GroundedFact['status'];factIds:string[];proof:KnowledgeProof[];
 temporalContext:string|null;qualifiers:string[];causality:'FUNCTIONAL';
}
export function processCoverage(facts:GroundedFact[]){
 const admitted=facts.filter(f=>f.usableForPrimaryClaim&&f.canonicalFact.qualifiers.includes('MECHANISM_V2'));
 const pred=new Set(admitted.map(f=>f.canonicalFact.predicate)),unique=new Set(admitted.map(f=>jsonHash([entityKey(f.canonicalFact.subject),f.canonicalFact.predicate,entityKey(f.canonicalFact.object??'')])));
 const dimensions={subjectIdentity:admitted.length>0,mechanism:[...pred].some(p=>PHYSICAL.has(p)),components:[...pred].some(p=>COMPONENT.has(p)),causal:[...pred].some(p=>CAUSAL.has(p)),sequence:pred.has('PRECEDES'),constraint:[...pred].some(p=>CONSTRAINT.has(p)),output:pred.has('OUTPUTS')||pred.has('TRANSFORM'),spatial:[...pred].some(p=>SPATIAL.has(p))};
 const diversity=Object.entries(dimensions).filter(([k,v])=>k!=='subjectIdentity'&&v).length;
 return{dimensions,uniqueRelations:unique.size,status:dimensions.mechanism&&unique.size>=2&&diversity>=2?'READY' as const:admitted.length?'THIN' as const:'INSUFFICIENT' as const,
  reason:'Needs explicit on-subject mechanism plus a complementary dimension; categories are not all mandatory'};
}
/** Derived only from admitted facts; each literal subject remains distinct.
 * System context is not a HAS_COMPONENT edge and editorial order is not time. */
export function buildMechanismKnowledge(pack:EvidencePack){
 validateEvidencePack(pack);
 const relations:KnowledgeRelation[]=[],facts=pack.groundedFacts.filter(f=>f.usableForPrimaryClaim&&f.canonicalFact.qualifiers.includes('MECHANISM_V2'));
 for(const f of facts.sort((a,b)=>a.id.localeCompare(b.id,'en'))){
  const c=f.canonicalFact;if(!c.object)continue;
  const modality=(c.qualifiers.find(q=>q.startsWith('MODALITY:'))?.slice(9)??'ASSERTED') as Modality;
  const id='KR_'+jsonHash([entityKey(c.subject),c.predicate,entityKey(c.object),modality,c.temporalContext]).slice(0,20);
  const proof=pack.evidence.filter(e=>f.evidenceIds.includes(e.id)&&e.extractionMethod==='MECHANISM_V2').map(e=>{
   const s=pack.sources.find(s=>s.id===e.sourceId)!;
   return{evidenceId:e.id,sourceId:s.id,snapshotHash:s.contentHash,span:e.sourceSpan,contextSpans:e.contextSpans??[],originGroupId:e.originGroupId??null,sourceLocator:s.canonicalLocator,...(e.mechanismContext?{resolution:e.mechanismContext}:{})};
  });
  if(!proof.length)continue;
  const old=relations.find(r=>r.id===id);
  if(old){old.factIds.push(f.id);old.proof.push(...proof);continue;}
  relations.push({id,subject:c.subject,predicate:c.predicate,object:c.object,modality,status:f.status,factIds:[f.id],proof,temporalContext:c.temporalContext,qualifiers:c.qualifiers,causality:'FUNCTIONAL'});
 }
 relations.sort((a,b)=>a.id.localeCompare(b.id,'en'));
 const count=(set:Set<string>)=>relations.filter(r=>set.has(r.predicate)).length;
 const sourceIds=[...new Set(relations.flatMap(r=>r.proof.map(p=>p.sourceId)))].sort(),chars=pack.sources.reduce((n,s)=>n+s.normalized.text.length,0);
 const metrics={admittedFacts:facts.length,uniqueRelations:relations.length,physicalClaims:count(PHYSICAL),causalRelations:count(CAUSAL),sequenceRelations:relations.filter(r=>r.predicate==='PRECEDES').length,componentRelations:count(COMPONENT),constraintRelations:count(CONSTRAINT),solutionRelations:relations.filter(r=>r.predicate==='SOLVES').length,transformations:relations.filter(r=>r.predicate==='TRANSFORM').length,flows:relations.filter(r=>['FLOW','PASSES_THROUGH','ENTER','EXIT'].includes(r.predicate)).length,spatialRelations:count(SPATIAL),contributingSources:sourceIds.length,factsPerSource:pack.sources.length?facts.length/pack.sources.length:0,usableFactsPer1000Chars:chars?facts.length*1000/chars:0,uniqueMechanismStages:count(PHYSICAL)};
 const raw={version:'mechanism-knowledge/1.0.0',packFingerprint:pack.fingerprint,topic:pack.topic,sourceIds,relations,readiness:processCoverage(facts),metrics};
 return{...raw,fingerprint:jsonHash(raw)};
}
export type MechanismKnowledge=ReturnType<typeof buildMechanismKnowledge>;
export function verifyMechanismKnowledge(pack:EvidencePack,k:MechanismKnowledge){return jsonHash(buildMechanismKnowledge(pack))===jsonHash(k);}
