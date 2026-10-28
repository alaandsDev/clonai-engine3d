import {jsonHash} from '../editorial/fingerprint';
import {capabilityGraph} from '../autodirector/capabilities';
import type {CapabilityNode} from '../autodirector/contracts';
import type {TopicScriptRequest,ScriptCandidate,ScriptWriterProvider,WriterResult,CandidatePreflight,Revision} from './contracts';
import {validateRequest,writerPolicy} from './request';
import {buildCapabilityProfile} from './capability-profile';
import {analyzeTopic,matchTopic} from './topic';
import {generateStrategies} from './strategies';
import {planOutline} from './outline';
import {realizeScript} from './realizer';
import {preflightCandidate} from './preflight';
import {reviseCandidate} from './revision';
export * from './contracts';export * from './request';export * from './capability-profile';export * from './topic';export * from './strategies';export * from './outline';export * from './realizer';export * from './preflight';export * from './revision';export * from './fact-policy';export * from './visual-vocabulary';export * from './duration';
export * from './qa';export * from './finalize';
export * from './grounded';
export const deterministicLocalProvider:ScriptWriterProvider={kind:'DETERMINISTIC_LOCAL',generate(request,p){const a=analyzeTopic(request),m=matchTopic(a,p);if(request.factPolicy==='SOURCE_ONLY'&&!(request.sourceMaterial??[]).some(s=>s.allowedForClaims)||!['SUPPORTED'].includes(m.status))return[];return generateStrategies(a,p).filter(s=>s.eligible).slice(0,3).map((s,i)=>realizeScript(request,planOutline(request,a,p,s),s,p,i));}};
export function structuralSimilarity(a:ScriptCandidate,b:ScriptCandidate){const features=(c:ScriptCandidate)=>[c.strategy.id,c.outline.hookType,c.outline.conclusionType,c.utterances.map(u=>u.purpose).join('>'),c.utterances.filter(u=>u.operation).map(u=>u.operation).join('>')];const aa=features(a),bb=features(b);return aa.filter((v,i)=>v===bb[i]).length/aa.length;}
export function selectCandidate(ps:CandidatePreflight[]){return [...ps].filter(p=>p.acceptance==='ACCEPTABLE_CANDIDATE').sort((a,b)=>b.score-a.score||a.candidateId.localeCompare(b.candidateId,'en'))[0]??null;}
export function writeTopic(request:TopicScriptRequest,snapshot:CapabilityNode[]=capabilityGraph()):WriterResult {
 if(request.factPolicy==='GROUNDED_ONLY')throw Error('WRITER_GROUNDED_PACK_REQUIRED use writeGroundedTopic(request, EvidencePack)');
 validateRequest(request);const req:TopicScriptRequest=JSON.parse(JSON.stringify({...request,factPolicy:request.factPolicy??'STRUCTURAL_ONLY'})),profile=buildCapabilityProfile(snapshot),topicAnalysis=analyzeTopic(req),capabilityMatch=matchTopic(topicAnalysis,profile),strategies=generateStrategies(topicAnalysis,profile),generated=deterministicLocalProvider.generate(req,profile),candidates:ScriptCandidate[]=[],candidatePreflights:CandidatePreflight[]=[],revisions:Revision[]=[];
 for(const initial of generated){let c=initial,p=preflightCandidate(req,c,profile);candidatePreflights.push(p);for(let i=1;i<=writerPolicy(req).maxRevisions&&p.acceptance==='REJECTED_CANDIDATE';i++){const next=reviseCandidate(req,c,p,i);if(!next.revision)break;revisions.push(next.revision);c=next.candidate;p=preflightCandidate(req,c,profile);candidatePreflights.push(p);}candidates.push(c);}
 const last=candidates.map(c=>candidatePreflights.filter(p=>p.candidateId===c.id).at(-1)!),winner=selectCandidate(last),finalCandidate=candidates.find(c=>c.id===winner?.candidateId)??null,finalPreflight=finalCandidate?preflightCandidate(req,finalCandidate,profile):null;
 const selection={selectedCandidateId:finalCandidate?.id??null,score:winner?.score??null,reason:winner?'Highest admissible deterministic score after hard factual/semantic/execution rejection; candidate ID breaks an exact score tie':'No candidate satisfies the factual and executable policy',alternatives:last.map(p=>({candidateId:p.candidateId,score:p.score,acceptance:p.acceptance,reasons:p.hardRejections})),rejectedCandidates:last.filter(p=>p.acceptance==='REJECTED_CANDIDATE').map(p=>p.candidateId),revisionHistory:revisions};
 const similarity=candidates.flatMap((a,i)=>candidates.slice(i+1).map(b=>{const similarity=structuralSimilarity(a,b);return{candidateA:a.id,candidateB:b.id,similarity,warning:similarity>=.8};}));
 const requiresSource=req.factPolicy==='SOURCE_ONLY'&&!(req.sourceMaterial??[]).some(s=>s.allowedForClaims)||topicAnalysis.unknownRequirements.some(s=>/source|mechanism|Factual/i.test(s));
 const raw={version:'topic-writer/1.0.0',request:req,policy:writerPolicy(req),topicAnalysis,capabilityProfile:profile,capabilityMatch,strategies,candidates,candidatePreflights,revisionHistory:revisions,selection,similarity,finalCandidate,finalPreflight,status:finalPreflight?'READY' as const:requiresSource?'SOURCE_REQUIRED' as const:generated.length?'NO_ACCEPTABLE_CANDIDATE' as const:'UNSUPPORTED_TOPIC' as const,reason:finalPreflight?'Capability-constrained topic-to-script with fresh final semantic/narrative/visual preflight':capabilityMatch.reason};
 return{...raw,fingerprint:jsonHash(raw)};
}
