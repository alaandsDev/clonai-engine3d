import {jsonHash} from '../editorial/fingerprint';
import {validateSnapshot} from '../research/web/cache';
import type {ResearchSession} from '../research/web/contracts';
import {buildEvidencePack} from '../research/pack';
import {processQueries} from '../research/process-planning';
import {buildMechanismKnowledge} from './knowledge';
import {groundedProgression} from './progression';
import {searchResultRelevance,postFetchScope} from '../research/web/relevance';
import {normalizedSource} from '../research/source';
/** Acquisition boundary for offline reprocessing. A re-signed source still
 * needs its exact acquired snapshot. Derived knowledge must be replayed too. */
export function verifyProcessAcquisition(session:ResearchSession){
 const{fingerprint,...raw}=session;
 if(jsonHash(raw)!==fingerprint)throw Error('SESSION_INTEGRITY');
 for(const attempt of session.fetchAttempts)if(attempt.snapshot)validateSnapshot(attempt.snapshot);
 for(const source of session.acceptedSources){
  if(!session.fetchAttempts.some(a=>a.snapshot?.contentHash===source.contentHash&&a.snapshot.content===source.content&&a.finalUrl===source.canonicalLocator))throw Error('SNAPSHOT_SOURCE_MISMATCH');
 }
 if(session.request.sourcePolicy?.contextualParser===1){
  if(jsonHash(session.relevance)!==jsonHash(session.searchResults.map(r=>searchResultRelevance(session.request.topic,r))))throw Error('RELEVANCE_REPLAY_MISMATCH');
  const start=session.progressive?.historicalInitial?.fetchCount??0;
  for(const attempt of session.fetchAttempts.slice(start))if(attempt.snapshot){
   const snapshot=attempt.snapshot,title=snapshot.content.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]*>/g,'').trim()||new URL(attempt.finalUrl).pathname;
   const doc=normalizedSource({id:snapshot.id,provider:'WEB_SEARCH',sourceType:'OTHER',title,publisher:new URL(attempt.finalUrl).hostname,canonicalLocator:attempt.finalUrl,language:'und',contentType:snapshot.mime as import('../research/contracts').SourceInput['contentType'],content:snapshot.content,contentHash:snapshot.contentHash,retrievedAt:snapshot.fetchedAt,fixture:false,metadata:{},provenance:{originKey:new URL(attempt.finalUrl).hostname,description:'Scope replay from immutable snapshot'}},session.plan.policy);
   if(jsonHash(attempt.scope)!==jsonHash(postFetchScope(session.request.topic,doc)))throw Error('POST_FETCH_SCOPE_REPLAY_MISMATCH');
   if(!attempt.scope?.onTopic&&session.acceptedSources.some(s=>s.contentHash===snapshot.contentHash&&s.canonicalLocator===attempt.finalUrl))throw Error('SCOPE_REJECTED_SOURCE_ADMITTED');
  }
 }
 return{sessionFingerprint:fingerprint,sources:session.acceptedSources.map(s=>({id:s.id,snapshotHash:s.contentHash,locator:s.canonicalLocator})),verified:true};
}
/** Re-derive the need and its entire pre-query context. Re-signing a query
 * cannot turn a later discovery or an invented answer into its provenance. */
export function verifyProgressiveQuestions(session:ResearchSession){
 verifyProcessAcquisition(session);
 if(!session.request.sourcePolicy?.progressiveStory||!session.progressive)throw Error('PROGRESSIVE_ACQUISITION_REQUIRED');
 const emitted=session.queryPlan.filter(q=>session.progressive!.newQueryIds.includes(q.id));
 const contexts=new Map<string,ReturnType<typeof buildEvidencePack>>();
 const contextPack=(ids:string[])=>{const key=ids.join('|');let p=contexts.get(key);if(!p){p=buildEvidencePack(session.request,{version:1,id:'pre-query-replay',fixture:false,labels:['REAL_WEB_SNAPSHOTS','SESSION_CANDIDATES_ONLY'],sources:session.acceptedSources.filter(s=>ids.includes(s.id))});contexts.set(key,p);}return p;};
 if(new Set(session.progressive.newQueryIds).size!==session.progressive.newQueryIds.length||emitted.length!==session.progressive.newQueryIds.length)throw Error('PROGRESSIVE_QUERY_LEDGER');
 for(const q of emitted){
  const traces=session.searchTrace.filter(t=>t.query.id===q.id);
  if(traces.length!==1||jsonHash(traces[0].query)!==jsonHash(q)||traces[0].resultCount!==session.searchResults.filter(r=>r.queryId===q.id).length)throw Error('PROGRESSIVE_SEARCH_TRACE');
  if(!q.storyNeed)continue;
  const context=q.storyNeed!,ids=context.priorSourceIds;
  if(new Set(ids).size!==ids.length||ids.some(id=>!session.acceptedSources.some(s=>s.id===id)))throw Error('PROGRESSIVE_PRIOR_SOURCE');
  const pack=contextPack(ids);
  const expected=processQueries(pack.researchPlan,pack,q.round).find(x=>x.id===q.id),{provider,...withoutProvider}=q;
  if(pack.fingerprint!==context.priorPackFingerprint||!expected||jsonHash(expected)!==jsonHash(withoutProvider))throw Error('PROGRESSIVE_PRE_QUERY_PROVENANCE');
 }
 for(const [index,it] of session.progressive.iterations.entries()){
  const first=session.queryPlan.find(q=>it.queryIds.includes(q.id)&&q.storyNeed),next=session.progressive.iterations[index+1],nextQuery=next?session.queryPlan.find(q=>next.queryIds.includes(q.id)&&q.storyNeed):undefined;
  const beforeIds=first?.storyNeed?.priorSourceIds??session.acceptedSources.map(s=>s.id),afterIds=nextQuery?.storyNeed?.priorSourceIds??session.acceptedSources.map(s=>s.id),before=contextPack(beforeIds),after=contextPack(afterIds),bk=buildMechanismKnowledge(before),ak=buildMechanismKnowledge(after);
  if(it.beforePackFingerprint!==before.fingerprint||it.afterPackFingerprint!==after.fingerprint||it.newSources!==afterIds.length-beforeIds.length||it.newRelations!==ak.relations.filter(r=>!bk.relations.some(b=>b.id===r.id)).length||it.connectedBefore!==groundedProgression(bk).metrics.connectedRelationCount||it.connectedAfter!==groundedProgression(ak).metrics.connectedRelationCount||it.queryIds.some(id=>!session.progressive!.newQueryIds.includes(id)))throw Error('PROGRESSIVE_ITERATION_PROVENANCE');
 }
 return{verified:true,queries:emitted.length,gapQueries:emitted.filter(q=>q.storyNeed).length,networkRequests:0};
}
