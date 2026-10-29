import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import {jsonHash} from '../../src/editorial/fingerprint';
import {runVerticalSlice,type SessionLike} from '../../src/vertical/run';
import {validateSnapshot} from '../../src/research/web/cache';
import {buildEvidencePack} from '../../src/research';
import {finalizeGroundedWriter} from '../../src/writer';
import {buildProvenance,verifyProvenance} from '../../src/vertical/provenance';
/** Offline replay of a recorded live vertical slice: network primitives throw; snapshots are
 * re-processed with the current code; every pure stage output and the post-voice finalization
 * are recomputed and compared; the MP4 bytes are hashed against the manifest. */
const [label='final',root='out/engine3d/phase25']=process.argv.slice(2),dir=root+'/'+label;
let network=0;const deny=()=>{network++;throw Error('NETWORK_FORBIDDEN_IN_REPLAY');};
globalThis.fetch=deny as typeof fetch;(http as {request:unknown;get:unknown}).request=deny;(http as {get:unknown}).get=deny;(https as {request:unknown}).request=deny;(https as {get:unknown}).get=deny;(dns as {lookup:unknown}).lookup=deny;
const live=JSON.parse(readFileSync(dir+'/trace.json','utf8')),sessionFile=dir+'/research/logs/'+label+'.json',prior=JSON.parse(readFileSync(sessionFile,'utf8'));
const files:Record<string,unknown>={};
const r=await runVerticalSlice(live.topic,label,{evaluationDate:'2026-10-29',save:async(n,x)=>{files[n]=x;return n;},research:async request=>{
 const{fingerprint,...raw}=prior;if(jsonHash(raw)!==fingerprint)throw Error('SESSION_INTEGRITY');
 for(const a of prior.fetchAttempts)if(a.snapshot)validateSnapshot(a.snapshot);
 const pack=buildEvidencePack(prior.request,{version:1,id:'offline-reprocessed-web',fixture:false,labels:['REAL_WEB_SNAPSHOTS','SESSION_CANDIDATES_ONLY'],sources:prior.acceptedSources});
 if(jsonHash(request)!==jsonHash(prior.request))throw Error('REQUEST_MISMATCH');
 const s:SessionLike={mode:'REPROCESSED_RECORDED_SESSION',sessionFile,sessionFingerprint:fingerprint,queries:prior.queryPlan.map((q:{text:string})=>q.text),quality:prior.quality,pack,networkRequests:0};return s;}});
const pure=['TOPIC_ANALYSIS','RESEARCH_ROUTING','RESEARCH','EVIDENCE','WRITER','SCRIPT','SEMANTICS','NARRATIVE','AUTO_DIRECTION','VISUAL_DEMONSTRATION','DIRECTED_SEQUENCE','ENGINE3D'];
const stages=pure.map(n=>{const a=live.stages.find((s:{stage:string})=>s.stage===n),b=r.trace.stages.find(s=>s.stage===n)!;return{stage:n,live:a.outputFingerprint,replay:b.outputFingerprint,equal:a.outputFingerprint===b.outputFingerprint&&a.status===b.status};});
// Post-voice: recompute finalization from the recorded measured durations (TTS output is recorded media, not re-synthesized).
const tracks=JSON.parse(readFileSync(dir+'/voice/tracks.json','utf8')),liveFinal=JSON.parse(readFileSync(dir+'/writer/finalization.json','utf8')),writer=files['writer/writer.json'] as Parameters<typeof finalizeGroundedWriter>[0],pack=(files['evidence/pack.json']) as Parameters<typeof finalizeGroundedWriter>[1];
const final=finalizeGroundedWriter(writer,pack,tracks.map((t:{sceneId:string;durationFrames:number})=>({unitId:t.sceneId,durationSeconds:t.durationFrames/30})));
const manifest=JSON.parse(readFileSync(dir+'/render/mp4-manifest.json','utf8')),mp4=createHash('sha256').update(readFileSync(manifest.path)).digest('hex'),seq=final.finalPreflight.compiled.items[0].sequence!;
const checks={finalization:final.fingerprint===liveFinal.fingerprint,sequence:jsonHash(seq)===manifest.sequenceFingerprint,plan:final.finalPreflight.plan.fingerprint===manifest.planFingerprint,compiled:final.finalPreflight.compiled.fingerprint===manifest.compiledFingerprint,mp4Sha256:mp4===manifest.sha256};
const topicPlan=files['topic-plan.json'] as {fingerprint:string},links={topic:jsonHash({topicPlanningVersion:1,topic:live.topic}),topicPlan:topicPlan.fingerprint,researchSession:prior.fingerprint,evidencePack:pack.fingerprint,writer:writer.fingerprint,script:writer.finalCandidate!.fingerprint,semanticGraph:jsonHash(final.finalPreflight.graph),narrativePlan:final.finalPreflight.plan.fingerprint,compiled:final.finalPreflight.compiled.fingerprint,sequence:jsonHash(seq),renderInput:final.fingerprint,mp4Sha256:manifest.sha256};
const provenance=buildProvenance(links,'LIVE'),verified=verifyProvenance(provenance,{...links,mp4Sha256:mp4});
const out={label,networkCallsAttempted:network,stages,allPureStagesEqual:stages.every(s=>s.equal),postVoice:checks,provenance,provenanceVerified:verified};
mkdirSync(root+'/replay',{recursive:true});writeFileSync(root+'/replay/'+label+'-replay.json',JSON.stringify(out,null,2));mkdirSync(root+'/provenance',{recursive:true});writeFileSync(root+'/provenance/'+label+'-provenance.json',JSON.stringify(provenance,null,2));
console.log(JSON.stringify({network,allPureStagesEqual:out.allPureStagesEqual,diff:stages.filter(s=>!s.equal).map(s=>s.stage),postVoice:checks,provenance:verified},null,1));
