import assert from 'node:assert/strict';
import {jsonHash} from '../../editorial/fingerprint';
import {buildEvidencePack} from '../pack';
import {candidateEntityPool,corroborationTasks} from '../web/v3';
import {gapIsClosed,providerCapabilities,researchV4Model} from './planning';
import {normalized} from './semantics';
import type {EvidencePack,ResearchRequest,SourceInput} from '../contracts';
import type {FetchAttempt,SearchQuery,SearchResult,WebResearchConfig} from '../web/contracts';
import type {AcquisitionAttempt,AcquisitionIntent,CitationPursuitTask,CorroborationYield,FactGap,ResearchSessionV4} from './contracts';

const key=(xs:string[])=>[...xs].sort().join('|');
const sourcePack=(sources:SourceInput[])=>({version:1 as const,id:'v4-acquisition-snapshots',fixture:false,labels:['REAL_WEB_SNAPSHOTS','SESSION_CANDIDATES_ONLY'],sources});
export function acquisitionEvidence(g:FactGap,pack:EvidencePack){return pack.groundedFacts.filter(f=>g.factKey?f.id===g.factKey:normalized(f.canonicalFact.subject)===normalized(g.entity)&&(g.kind==='MISSING_PERMANENT_POPULATION'||g.kind==='MISSING_CURRENT_RESIDENCY'?f.factType==='RESIDENCY'&&f.canonicalFact.residency==='PERMANENT_POPULATION':f.qualifiers.includes(g.qualifier??'MINIMUM_RECORDED')));}
export function acquisitionAttempt(intent:AcquisitionIntent,gap:FactGap,before:EvidencePack,after:EvidencePack):AcquisitionAttempt{
 const old=acquisitionEvidence(gap,before),next=acquisitionEvidence(gap,after),oldEvidence=new Set(old.flatMap(f=>f.evidenceIds)),newEvidenceIds=next.flatMap(f=>f.evidenceIds).filter(id=>!oldEvidence.has(id));
 const newOrigins=next.reduce((n,f)=>n+Math.max(0,f.independentOriginCount-(old.find(o=>o.id===f.id)?.independentOriginCount??0)),0),acceptedSources=intent.afterSourceIds.filter(id=>!intent.beforeSourceIds.includes(id));
 const gapClosed=gapIsClosed(gap,after),failureReason=gapClosed?null:newOrigins>0?null:intent.diagnostic??(acceptedSources.length?newEvidenceIds.length?'NO_NEW_INDEPENDENT_ORIGIN':'NO_TARGET_EVIDENCE':intent.rejectedSameOrigin.length?'KNOWN_ORIGIN_ONLY':intent.resultUrls.length?'NO_ACQUIRABLE_SOURCE':'NO_RESULTS');
 return {...intent,resultCount:intent.resultUrls.length,acceptedSources,newOrigins,newEvidence:newEvidenceIds.length,newEvidenceIds:[...new Set(newEvidenceIds)].sort(),gapClosed,failureReason};
}
export function citationPursuits(pack:EvidencePack,results:SearchResult[]):CitationPursuitTask[]{
 const raw:{sourceId:string|null;fromUrl:string;targetUrl:string;relation:CitationPursuitTask['relation'];evidenceIds:string[];originIndependence:'UNPROVEN';reason:string}[]=[];
 for(const e of pack.evidence)for(const url of e.citations??[])raw.push({sourceId:e.sourceId,fromUrl:pack.sources.find(s=>s.id===e.sourceId)!.canonicalLocator,targetUrl:url,relation:'CITES',evidenceIds:[e.id],originIndependence:'UNPROVEN',reason:'Pursue the source cited by this exact evidence; reporter and cited data are not automatically two origins'});
 for(const r of results)for(const related of r.datasetIdentity?.related??[])raw.push({sourceId:null,fromUrl:r.url,targetUrl:related.url,relation:/IsCitedBy|IsReferencedBy/i.test(related.relation)?'REVERSE_CITATION':'DATASET_LINEAGE',evidenceIds:[],originIndependence:'UNPROVEN',reason:'Provider metadata relation '+related.relation+'; diagnostic discovery only, not evidence'});
 return raw.map(x=>({id:'CIT_'+jsonHash(x).slice(0,20),...x})).filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i).sort((a,b)=>a.id.localeCompare(b.id,'en'));
}
export function corroborationYield(initial:EvidencePack,final:EvidencePack,attempts:AcquisitionAttempt[],gaps:FactGap[],queries:number,fetches:number):CorroborationYield {
 const acquired=new Set(attempts.flatMap(a=>a.acceptedSources)),nearCopySources=new Set((final.v2?.sourceGraph.edges.filter(e=>e.relation==='NEAR_COPY')??[]).flatMap(e=>[e.from,e.to]).filter(id=>acquired.has(id)));
 const old=new Map(initial.groundedFacts.map(f=>[f.id,f])),newOrigins=attempts.reduce((n,a)=>n+a.newOrigins,0),nearCopies=nearCopySources.size;
 const closed=gaps.filter(g=>g.status==='CLOSED').length,ecosystems:Record<string,number>={};for(const a of attempts)ecosystems[a.ecosystem]=(ecosystems[a.ecosystem]??0)+a.newOrigins;
 return {queriesPerNewIndependentOrigin:newOrigins?queries/newOrigins:null,fetchesPerNewIndependentOrigin:newOrigins?fetches/newOrigins:null,newIndependentOrigins:newOrigins,newOriginsPerEcosystem:ecosystems,factsZeroToOne:final.groundedFacts.filter(f=>f.independentOriginCount>=1&&!(old.get(f.id)?.independentOriginCount)).length,factsOneToTwo:final.groundedFacts.filter(f=>f.independentOriginCount>=2&&old.get(f.id)?.independentOriginCount===1).length,insufficientToSupported:final.groundedFacts.filter(f=>f.status==='SUPPORTED'&&old.get(f.id)?.status==='INSUFFICIENT').length,supportedToCorroborated:final.groundedFacts.filter(f=>f.status==='CORROBORATED'&&old.get(f.id)?.status==='SUPPORTED').length,eligibleItemsGained:Math.max(0,(final.ranking?.eligibleItemCount??0)-(initial.ranking?.eligibleItemCount??0)),wastedSameOriginDiscoveries:attempts.reduce((n,a)=>n+a.rejectedSameOrigin.length,0),nearCopiesRejected:nearCopies,nearCopyRejectionRate:fetches?nearCopies/fetches:0,independentOriginYield:queries?newOrigins/queries:0,gapClosureRate:gaps.length?closed/gaps.length:0,usefulEvidenceRate:fetches?attempts.filter(a=>a.newOrigins>0||a.gapClosed).length/fetches:0};
}
/** Rebuild every attempted requirement from the applicable immutable source subset, not stored conclusions. */
export function buildSessionV4(request:ResearchRequest,sources:SourceInput[],finalPack:EvidencePack,bootstrapSourceIds:string[],intents:AcquisitionIntent[],queries:SearchQuery[],results:SearchResult[],fetches:FetchAttempt[],config:WebResearchConfig,cache=new Map<string,EvidencePack>()):ResearchSessionV4 {
 assert(config.v4,'V4_CONFIG_REQUIRED');const v=config.v4,byId=new Map(sources.map(s=>[s.id,s]));
 const derive=(ids:string[])=>{assert.equal(new Set(ids).size,ids.length,'V4 duplicate source ID');const k=key(ids);let p=cache.get(k);if(!p){const subset=ids.map(id=>{const s=byId.get(id);assert(s,'V4 source subset missing '+id);return s;});p=buildEvidencePack(request,sourcePack(subset));cache.set(k,p);}return p;};
 const bootstrapQueries=new Set(queries.filter(q=>!q.v4).map(q=>q.id));
 const observedBootstrap=sources.filter(s=>s.provenance.discovery?.queryIds.some(id=>bootstrapQueries.has(id))).map(s=>s.id);
 assert.deepEqual([...bootstrapSourceIds].sort(),observedBootstrap.sort(),'V4 bootstrap source provenance differs');
 const initial=derive(bootstrapSourceIds),attempts:AcquisitionAttempt[]=[],capabilities=providerCapabilities();let prior:FactGap[]=[],previousIds=[...bootstrapSourceIds];
 for(const intent of intents){
  assert.deepEqual([...intent.beforeSourceIds].sort(),previousIds.sort(),'V4 acquisition source chain');
  if(intent.queryId){const q=queries.find(q=>q.id===intent.queryId);assert(q&&q.v4?.gapId===intent.gapId&&q.v4.strategyId===intent.strategyId&&q.text===intent.query,'V4 query trace mismatch');assert.deepEqual(results.filter(r=>r.queryId===q.id).map(r=>r.url),intent.resultUrls,'V4 result trace mismatch');}
  const before=derive(intent.beforeSourceIds),model=researchV4Model(before,attempts,prior,v,capabilities),gap=model.gaps.find(g=>g.id===intent.gapId);assert(gap,'V4 requirement missing at acquisition');
  const strategy=model.strategies.find(s=>s.id===intent.strategyId);assert(strategy?.executable,'V4 strategy was not executable');
  assert.equal(strategy.provider,intent.provider);assert.equal(strategy.familyId,intent.familyId);assert.equal(strategy.ecosystem,intent.ecosystem);
  const resultingIds=new Set(intent.beforeSourceIds);
  for(const fid of intent.fetchAttemptIds){const a=fetches.find(a=>a.id===fid);assert(a,'V4 fetch attempt missing');if(a.status==='SUCCESS')for(const s of sources)if(s.contentHash===a.snapshot?.contentHash&&s.canonicalLocator===a.finalUrl)resultingIds.add(s.id);}
  assert.deepEqual([...resultingIds].sort(),[...intent.afterSourceIds].sort(),'V4 acquired source subset differs');
  assert(intent.fetchAttemptIds.length<=strategy.attemptBudget,'V4 strategy fetch budget');
  const after=derive(intent.afterSourceIds);attempts.push(acquisitionAttempt(intent,gap,before,after));prior=model.gaps;previousIds=[...intent.afterSourceIds];
 }
 assert.deepEqual([...previousIds].sort(),sources.map(s=>s.id).sort(),'V4 final sources outside acquisition trace');
 const model=researchV4Model(finalPack,attempts,prior,v,capabilities),fitness=new Map(model.entityFitness.map(f=>[normalized(f.entity),f.fitness]));
 const pool=candidateEntityPool(finalPack,finalPack.researchPlan,results,queries).filter(e=>fitness.get(normalized(e.canonicalName))!=='UNFIT'),tasks=corroborationTasks(finalPack,finalPack.researchPlan,pool,[]);
 const citations=citationPursuits(finalPack,results),datasets=results.flatMap(r=>r.datasetIdentity?[r.datasetIdentity]:[]).filter((d,i,a)=>a.findIndex(x=>x.id===d.id&&x.resourceUrl===d.resourceUrl)===i),yieldMetrics=corroborationYield(initial,finalPack,attempts,model.gaps,queries.filter(q=>q.v4).length,intents.reduce((n,a)=>n+a.fetchAttemptIds.length,0));
 const actionable=model.strategies.some(s=>s.executable),budgetExhausted=queries.length>=config.maxQueries||fetches.length>=config.maxFetchedSources||attempts.length>=config.maxResearchRounds*v.maxFamiliesPerRound;
 const stopReason=finalPack.quality.productionEligibility==='RESEARCH_READY'?'READINESS_STOP':budgetExhausted?'BUDGET_EXHAUSTED':!actionable?'CAPABILITIES_EXHAUSTED':'ACQUISITION_ENDED_WITH_OPEN_GAPS';
 if(budgetExhausted)for(const g of model.gaps)if(['OPEN','PARTIAL'].includes(g.status))g.status='BUDGET_EXHAUSTED';
 const {fingerprint,...modelRaw}=model;model.fingerprint=jsonHash(modelRaw);
 return {version:'research-session-v4/1.0.0',bootstrapSourceIds:[...bootstrapSourceIds].sort(),intents,attempts,model,providers:capabilities,candidateEntityPool:pool,corroborationTasks:tasks,citations,datasets,yield:yieldMetrics,stopReason,fingerprints:{model:model.fingerprint,attempts:jsonHash(attempts),pool:jsonHash(pool),tasks:jsonHash(tasks),citations:jsonHash(citations),datasets:jsonHash(datasets),yield:jsonHash(yieldMetrics)}};
}
