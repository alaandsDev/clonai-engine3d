import {jsonHash} from '../editorial/fingerprint';
import {buildTopicPlan,buildRoutedResearchRequest,topicWriterGate,deriveWriterRequest,type TopicPlan} from '../topic';
import type {EvidencePack,ResearchRequest} from '../research/contracts';
import {writeGroundedTopic,wordCount} from '../writer';
import {evaluateDirected} from '../engine3d/directed';
import {newTrace,startStage,finishStage,type VerticalSliceTrace,type VerticalStage} from './trace';
/** Phase 25 vertical-slice orchestrator. It only calls existing pipeline stages and
 * records their outcome; it supplies no script, shots, scenes, facts or sources.
 * Research and media production are injected (network/filesystem live outside). */
export interface SessionLike {mode:'LIVE'|'REPROCESSED_RECORDED_SESSION'|'FIXTURE';sessionFile:string|null;sessionFingerprint:string;queries:string[];quality:{acceptedSources:number;resultState:string}&Record<string,unknown>;pack:EvidencePack;networkRequests:number}
export type StageOutcome={status:'PASS'|'PARTIAL'|'BLOCKED'|'FAILED';output?:unknown;reason?:string;diagnostics?:Record<string,unknown>;artifacts?:string[]};
export type StageFn=(stage:VerticalStage,input:unknown,fn:()=>Promise<StageOutcome>)=>Promise<boolean>;
export interface MediaInput {topic:string;plan:TopicPlan;pack:EvidencePack;writer:ReturnType<typeof writeGroundedTopic>;stage:StageFn}
export interface VerticalOptions {evaluationDate:string;save:(name:string,value:unknown)=>Promise<string>;now?:()=>string|null;research:(request:ResearchRequest)=>Promise<SessionLike>;media?:(input:MediaInput)=>Promise<Record<string,unknown>|null>;capacity?:{maxSourceBytes:number;maxTotalSourceBytes:number;maxNormalizedCharacters:number}}
export const DEFAULT_CAPACITY={maxSourceBytes:2097152,maxTotalSourceBytes:16777216,maxNormalizedCharacters:524288};
export async function runVerticalSlice(topic:string,label:string,o:VerticalOptions){
 let t:VerticalSliceTrace=newTrace(topic,label);const perf:Record<string,number>={},now=o.now??(()=>null),artifacts:Record<string,unknown>={};
 const stage:StageFn=async(s,input,fn)=>{
  t=startStage(t,s,input,now());const t0=performance.now();
  try{const r=await fn();perf[s]=performance.now()-t0;t=finishStage(t,s,{status:r.status,output:r.output,blockingReason:r.status==='PASS'?null:r.reason??r.status,diagnostics:r.diagnostics,artifacts:r.artifacts},now());return r.status==='PASS'||r.status==='PARTIAL';}
  catch(e){perf[s]=performance.now()-t0;t=finishStage(t,s,{status:'FAILED',blockingReason:(e as Error).message.slice(0,500)},now());return false;}
 };
 const finish=async()=>{await o.save('trace.json',t);await o.save('performance.json',perf);return{trace:t,performance:perf,artifacts};};
 let plan!:TopicPlan,request!:ResearchRequest,session!:SessionLike;
 if(!await stage('TOPIC_ANALYSIS',{topicPlanningVersion:1,topic},async()=>{plan=buildTopicPlan({topicPlanningVersion:1,topic});const a=plan.analysis;
  return{status:a.contentMode==='UNKNOWN'||a.contentMode==='CREATIVE'?'BLOCKED':'PASS',reason:'NO_FACTUAL_ROUTE '+a.contentMode,output:plan.fingerprint,diagnostics:{primary:a.primaryIntent,secondary:a.secondaryIntents,mode:a.contentMode,level:a.researchRequirement,families:a.expectedClaimFamilies},artifacts:[await o.save('topic-plan.json',plan)]};}))return finish();
 if(!await stage('RESEARCH_ROUTING',plan.fingerprint,async()=>{const r=buildRoutedResearchRequest(plan,{id:'phase25-'+label,evaluationDate:o.evaluationDate,maxSources:24,capacity:o.capacity??DEFAULT_CAPACITY});if(!r)return{status:'BLOCKED',reason:'NO_RESEARCH_ROUTE'};request=r;
  return{status:'PASS',output:r,diagnostics:{goal:r.researchGoal,factTypes:r.desiredFactTypes,level:plan.researchRoute.level,quorum:r.sourcePolicy?.minIndependentSources},artifacts:[await o.save('research-request.json',r)]};}))return finish();
 if(!await stage('RESEARCH',request,async()=>{session=await o.research(request);artifacts.session=session.sessionFile;
  return{status:session.quality.acceptedSources?'PASS':'BLOCKED',reason:'NO_ACCEPTED_SOURCES',output:session.sessionFingerprint,diagnostics:{mode:session.mode,queries:session.queries,quality:session.quality,networkRequests:session.networkRequests},artifacts:session.sessionFile?[session.sessionFile]:[]};}))return finish();
 const pack=session.pack;
 if(!await stage('EVIDENCE',session.sessionFingerprint,async()=>{const q=pack.quality,byType:Record<string,number>={};for(const g of pack.groundedFacts)byType[g.factType]=(byType[g.factType]??0)+1;
  return{status:q.productionEligibility==='RESEARCH_READY'?'PASS':'BLOCKED',reason:'RESEARCH_INCOMPLETE grounded='+pack.groundedFacts.length+' evidence='+pack.evidence.length+' unresolved='+pack.unresolvedQuestions.map(u=>u.reason).join('|'),output:pack.fingerprint,diagnostics:{productionEligibility:q.productionEligibility,sources:pack.sources.length,evidence:pack.evidence.length,grounded:pack.groundedFacts.length,byType,facts:pack.groundedFacts.map(g=>({id:g.id,type:g.factType,status:g.status,subject:g.canonicalFact.subject,predicate:g.canonicalFact.predicate,object:g.canonicalFact.object,evidence:pack.evidence.filter(e=>g.evidenceIds.includes(e.id)).map(e=>e.exactText)}))},artifacts:[await o.save('evidence/pack.json',pack)]};}))return finish();
 let writer!:ReturnType<typeof writeGroundedTopic>;
 if(!await stage('WRITER',pack.fingerprint,async()=>{const gate=topicWriterGate(plan,{resultState:String(session.quality.resultState),writerStatus:null,rankingStatus:pack.ranking?.status??null,productionEligibility:pack.quality.productionEligibility});
  if(gate.decision!=='PROCEED_GROUNDED')return{status:'BLOCKED',reason:'GATE_'+gate.decision+':'+gate.reasons.join(','),diagnostics:{gate}};
  writer=writeGroundedTopic(deriveWriterRequest(plan,{version:1,id:'phase25-'+label+'-writer',language:'pt-BR'}),pack);
  return{status:writer.status==='RESEARCH_INCOMPLETE'?'BLOCKED':'PASS',reason:'WRITER_'+writer.status+': '+writer.reason+' '+writer.preflights.map(p=>p.candidateId+'='+p.hardRejections.join('+')).join(';'),output:writer.fingerprint,diagnostics:{status:writer.status,candidates:writer.candidates.length,selected:writer.selectedCandidateId,gate},artifacts:[await o.save('writer/writer.json',writer)]};}))return finish();
 const fp=writer.finalPreflight!,cand=writer.finalCandidate!;
 if(!await stage('SCRIPT',writer.fingerprint,async()=>{const words=wordCount(cand.script);
  return{status:fp.factualReady&&words>=110&&words<=160?'PASS':'BLOCKED',reason:'SCRIPT_NOT_READY words='+words+' factualReady='+fp.factualReady,output:cand.fingerprint,diagnostics:{words,sentences:cand.sentences.length,factSentences:cand.sentences.filter(x=>x.kind==='FACT').length,ungrounded:fp.reconciliation.metrics.ungroundedClaimCount,drift:fp.reconciliation.metrics.semanticDriftCount},artifacts:[await o.save('script/script.txt',cand.script),await o.save('script/sentence-ledger.json',cand.sentences)]};}))return finish();
 if(!await stage('SEMANTICS',cand.fingerprint,async()=>{const facts=fp.graph.claims.filter(c=>c.requiresVisualProof),open=facts.filter(c=>c.status!=='RESOLVED');
  return{status:open.length?'PARTIAL':'PASS',reason:'UNRESOLVED_FACT_CLAIMS '+open.map(c=>c.id+':'+c.predicate+':'+c.status).join(','),output:jsonHash(fp.graph),diagnostics:{claims:fp.graph.claims.length,factual:facts.length,claimList:fp.graph.claims.map(c=>({id:c.id,predicate:c.predicate,status:c.status,role:c.narrativeRole,proof:c.requiresVisualProof,text:c.text}))},artifacts:[await o.save('semantics/graph.json',fp.graph)]};}))return finish();
 if(!await stage('NARRATIVE',jsonHash(fp.graph),async()=>({status:fp.plan.productionReady?'PASS':'BLOCKED',reason:'PLAN_NOT_PRODUCTION_READY renderability='+fp.plan.renderability+' gaps='+fp.plan.localizedGaps.map(g=>g.claimIds.join('+')+':'+g.reason).join(','),output:fp.plan.fingerprint,diagnostics:{renderability:fp.plan.renderability,coverage:fp.plan.coverage,gaps:fp.plan.localizedGaps},artifacts:[await o.save('narrative/plan.json',fp.plan)]}))){await o.save('direction/compiled-review.json',fp.compiled);await o.save('demonstration/matrix.json',fp.matrix);return finish();}
 if(!await stage('AUTO_DIRECTION',fp.plan.fingerprint,async()=>({status:fp.compiled.productionReady?'PASS':'BLOCKED',reason:'COMPILED_NOT_PRODUCTION_READY',output:fp.compiled.fingerprint,diagnostics:{items:fp.compiled.items.map(i=>({claims:i.claimIds,sequence:Boolean(i.sequence),frames:i.sequence?.totalFrames??null}))},artifacts:[await o.save('direction/compiled.json',fp.compiled)]})))return finish();
 if(!await stage('VISUAL_DEMONSTRATION',fp.compiled.fingerprint,async()=>{const dist:Record<string,number>={};for(const m of fp.matrix)dist[m.visualProof]=(dist[m.visualProof]??0)+1;
  return{status:fp.visualReady?'PASS':'BLOCKED',reason:'VISUAL_NOT_READY '+fp.matrix.filter(m=>!m.productionEligible).map(m=>m.claimId+':'+m.visualProof+':'+(m.gap??'')).join(','),output:jsonHash(fp.matrix),diagnostics:{proofDistribution:dist,matrix:fp.matrix,operations:fp.compiled.items.flatMap(i=>i.sequence?.demonstration?.steps.map(s=>s.operation)??[])},artifacts:[await o.save('demonstration/matrix.json',fp.matrix)]};}))return finish();
 const sequences=fp.compiled.items.filter(i=>i.sequence).map(i=>i.sequence!);
 if(!await stage('DIRECTED_SEQUENCE',fp.compiled.fingerprint,async()=>({status:sequences.length===fp.compiled.items.length&&sequences.length>0?'PASS':'BLOCKED',reason:'ITEM_WITHOUT_SEQUENCE',output:sequences.map(s=>jsonHash(s)),diagnostics:{sequences:sequences.length,frames:sequences.map(s=>s.totalFrames),shots:sequences.map(s=>s.shots.length)},artifacts:[await o.save('sequence/sequences.json',sequences)]})))return finish();
 if(!await stage('ENGINE3D',sequences.map(s=>jsonHash(s)),async()=>{const samples=sequences.map(s=>{const frames=[0,Math.floor(s.totalFrames/2),s.totalFrames-1];return frames.map(f=>{const st=evaluateDirected(s,f).state;return{frame:f,visibleProps:Object.values(st.props).filter(p=>p.visible).length};});});
  return{status:'PASS',output:samples,diagnostics:{samples}};}))return finish();
 if(!o.media)return finish();
 const media=await o.media({topic,plan,pack,writer,stage});if(media)artifacts.media=media;
 return finish();
}
