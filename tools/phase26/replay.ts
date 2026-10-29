import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import {jsonHash} from '../../src/editorial/fingerprint';
import {buildEvidencePack,contentHash} from '../../src/research';
import {replayWebResearch} from '../../src/research/web';
import {verifyProcessAcquisition} from '../../src/curiosity/replay';
import {buildCuriosityStoryPlan,verifyCuriosityArtifacts} from '../../src/curiosity/story';
import {writeCausalCuriosity,verifyCuriosityWriter} from '../../src/writer/curiosity';
import {runVerticalSlice} from '../../src/vertical/run';
import type {ResearchSession} from '../../src/research/web/contracts';
import {benchmarks} from './benchmarks';

const root='out/engine3d/phase26',load=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
let network=0;
const deny=()=>{network++;throw Error('REPLAY_NETWORK_FORBIDDEN');};
globalThis.fetch=deny as typeof fetch;
(http as any).request=deny;(http as any).get=deny;(https as any).request=deny;(https as any).get=deny;(dns as any).lookup=deny;(dns.promises as any).lookup=deny;
const rows:any[]=[];
for(const b of benchmarks){
 const file=root+'/research/'+(existsSync(root+'/research/live-final-'+b.id+'.json')?'live-final-':'live-')+b.id+'.json',session=load(file) as ResearchSession;
 verifyProcessAcquisition(session);
 const expected=load(root+'/evidence/final-'+b.id+'.json');
 const pack=buildEvidencePack(expected.researchPlan.request,{version:1,id:'offline-process-replay',fixture:false,labels:['REAL_WEB_SNAPSHOTS','SESSION_CANDIDATES_ONLY'],sources:session.acceptedSources});
 const artifacts=buildCuriosityStoryPlan(pack),writer=writeCausalCuriosity(pack);
 const knowledge=load(root+'/knowledge/final-'+b.id+'.json'),graph=load(root+'/graphs/final-'+b.id+'.json'),story=load(root+'/stories/final-'+b.id+'.json'),w=load(root+'/writer/final-'+b.id+'.json');
 const checks={pack:pack.fingerprint===expected.fingerprint,knowledge:artifacts.knowledge.fingerprint===knowledge.fingerprint,graph:artifacts.graph.fingerprint===graph.fingerprint,story:artifacts.story.fingerprint===story.fingerprint,writer:writer.fingerprint===w.fingerprint,script:writer.script===readFileSync(root+'/writer/final-'+b.id+'.txt','utf8'),trace:verifyCuriosityWriter(pack,w,{knowledge,graph,story})};
 let acquisitionProcessingReplay:string;
 if(file.includes('live-final-')){const replay=replayWebResearch(session);acquisitionProcessingReplay=replay.processingFingerprint===session.processingFingerprint?'PASS':'FAIL';}
 else acquisitionProcessingReplay='NOT_APPLICABLE: pre-hardening grammar; immutable acquisition validated, final processing replayed above';
 rows.push({id:b.id,file,checks,passed:Object.values(checks).every(Boolean),acquisitionProcessingReplay,sourceHashes:session.acceptedSources.map(s=>s.contentHash)});
 console.log(b.id+' '+JSON.stringify(checks));
}
const historical:any[]=[];
for(const file of ['out/engine3d/phase23/logs/real-cold-places-v4.json','out/engine3d/phase23/logs/real-population-census-v4.json','out/engine3d/phase25/final/research/logs/final.json']){
 const s=load(file),r=replayWebResearch(s);historical.push({file,passed:r.processingFingerprint===s.processingFingerprint,fingerprint:s.processingFingerprint});
}
// The acquired secondary session predates Phase25's truncation fix. Its final
// reprocessing trace, not its development EvidencePack, is the official check.
const secondary=load('out/engine3d/phase25/probe-turbine/research/logs/probe-turbine.json');verifyProcessAcquisition(secondary);
const secondaryPack=buildEvidencePack(secondary.request,{version:1,id:'legacy-secondary',fixture:false,labels:['REAL_WEB_SNAPSHOTS','SESSION_CANDIDATES_ONLY'],sources:secondary.acceptedSources});
const secondaryTrace=load('out/engine3d/phase25/probe-turbine-final/trace.json'),oldEvidence=secondaryTrace.stages.find((s:any)=>s.stage==='EVIDENCE');
const secondaryCheck={file:'out/engine3d/phase25/probe-turbine-final/trace.json',passed:oldEvidence.outputFingerprint===jsonHash(secondaryPack.fingerprint),rebuiltPackFingerprint:secondaryPack.fingerprint,admittedFacts:secondaryPack.groundedFacts.filter(f=>f.usableForPrimaryClaim).length,physicalFacts:secondaryPack.groundedFacts.filter(f=>f.usableForPrimaryClaim&&f.factType==='PROCESS').length,reason:'Raw acquisition predates the Phase25 truncation fix; final recorded reprocessing is authoritative'};
historical.push(secondaryCheck);
const old=load('out/engine3d/phase25/final/trace.json'),session=load('out/engine3d/phase25/final/research/logs/final.json');
const vertical=await runVerticalSlice(old.topic,'final',{evaluationDate:'2026-10-29',save:async(n)=>n,research:async()=>({mode:'REPROCESSED_RECORDED_SESSION',sessionFile:'recorded',sessionFingerprint:session.fingerprint,queries:session.queryPlan.map((q:any)=>q.text),quality:session.quality,pack:session.EvidencePack,networkRequests:0})});
const pure=['TOPIC_ANALYSIS','RESEARCH_ROUTING','RESEARCH','EVIDENCE','WRITER','SCRIPT','SEMANTICS','NARRATIVE','AUTO_DIRECTION','VISUAL_DEMONSTRATION','DIRECTED_SEQUENCE','ENGINE3D'];
const verticalChecks=pure.map(stage=>{const a=old.stages.find((s:any)=>s.stage===stage),b=vertical.trace.stages.find(s=>s.stage===stage)!;return{stage,passed:a.outputFingerprint===b.outputFingerprint&&a.status===b.status};});
const baseline=load(root+'/baseline/baseline.json'),hashes=Object.entries(baseline.historicalHashes).map(([file,hash])=>({file,passed:contentHash(readFileSync(file,'utf8'))===hash}));
const oldIntegrity=load('out/engine3d/phase25/analysis/integrity.json'),videos=oldIntegrity.historicalVideos.map((v:any)=>({file:v.file,passed:contentHash(readFileSync(v.file))===v.now}));
const finalVideo='out/engine3d/phase25/final/render/final.mp4',mp4={file:finalVideo,passed:contentHash(readFileSync(finalVideo))==='c901c5a8c6b742fffe4f2d0d203920caa3454fb11a97d0393f853355f999e926'};
const result={networkCallsAttempted:network,rows,historical,verticalChecks,historicalHashes:hashes,historicalVideos:videos,phase25Mp4:mp4,passed:network===0&&rows.every(r=>r.passed&&r.acquisitionProcessingReplay!=='FAIL')&&historical.every(r=>r.passed)&&verticalChecks.every(r=>r.passed)&&hashes.every(r=>r.passed)&&videos.every((r:any)=>r.passed)&&mp4.passed};
mkdirSync(root+'/replay',{recursive:true});writeFileSync(root+'/replay/final.json',JSON.stringify(result,null,2));writeFileSync(root+'/baseline/secondary-checkpoint-rebuild.json',JSON.stringify(secondaryCheck,null,2));console.log(JSON.stringify({passed:result.passed,network,historical:historical.length,verticalStages:verticalChecks.filter(r=>r.passed).length}));
if(!result.passed)process.exitCode=1;
