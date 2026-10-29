import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import {buildEvidencePack,contentHash} from '../../src/research';
import {jsonHash} from '../../src/editorial/fingerprint';
import {replayWebResearch} from '../../src/research/web';
import {verifyProcessAcquisition} from '../../src/curiosity/replay';
import {verifyCuriosityWriter} from '../../src/writer/curiosity';
import {runVerticalSlice} from '../../src/vertical/run';
import {buildKnowledgeLossTrace} from '../../src/curiosity/knowledge-loss';
const root='out/engine3d/phase26',out=root+'/phase26b',load=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
let network=0;const deny=()=>{network++;throw Error('REPLAY_NETWORK_FORBIDDEN');};
globalThis.fetch=deny as typeof fetch;(http as any).request=deny;(http as any).get=deny;(https as any).request=deny;(https as any).get=deny;(dns as any).lookup=deny;(dns.promises as any).lookup=deny;
const rows:any[]=[];
for(const contextual of [false,true])for(const id of 'ABCDEFGH'){
 const s=load(root+'/research/'+(['A','B'].includes(id)?'live-final-':'live-')+id+'.json');verifyProcessAcquisition(s);
 const base=out+'/attempts/final',expected=load(contextual?base+'/evidence/'+id+'.json':root+'/evidence/final-'+id+'.json');
 const pack=buildEvidencePack(expected.researchPlan.request,{version:1,id:'offline-replay',fixture:false,labels:['REAL_WEB_SNAPSHOTS','SESSION_CANDIDATES_ONLY'],sources:s.acceptedSources});
 const a=contextual?load(base+'/artifacts/'+id+'.json'):{knowledge:load(root+'/knowledge/final-'+id+'.json'),graph:load(root+'/graphs/final-'+id+'.json'),story:load(root+'/stories/final-'+id+'.json')};
 const w=load(contextual?base+'/writer/'+id+'.json':root+'/writer/final-'+id+'.json');
 const loss=contextual?buildKnowledgeLossTrace(pack,a,w,s):null;
 const checks={pack:pack.fingerprint===expected.fingerprint,artifactsAndWriter:contextual?true:verifyCuriosityWriter(pack,w,a),knowledgeLoss:!contextual||loss!.fingerprint===load(base+'/loss/'+id+'.json').fingerprint};
 rows.push({contextual,id,checks,passed:Object.values(checks).every(Boolean)});console.log(JSON.stringify(rows.at(-1)));
}
const historical:any[]=[];
for(const file of ['out/engine3d/phase23/logs/real-cold-places-v4.json','out/engine3d/phase23/logs/real-population-census-v4.json','out/engine3d/phase25/final/research/logs/final.json']){
 const s=load(file);historical.push({file,passed:replayWebResearch(s).processingFingerprint===s.processingFingerprint});
}
const secondary=load('out/engine3d/phase25/probe-turbine/research/logs/probe-turbine.json');verifyProcessAcquisition(secondary);
const pack=buildEvidencePack(secondary.request,{version:1,id:'secondary',fixture:false,labels:['REAL_WEB_SNAPSHOTS','SESSION_CANDIDATES_ONLY'],sources:secondary.acceptedSources});
const trace=load('out/engine3d/phase25/probe-turbine-final/trace.json');historical.push({file:'out/engine3d/phase25/probe-turbine-final/trace.json',passed:trace.stages.find((s:any)=>s.stage==='EVIDENCE').outputFingerprint===jsonHash(pack.fingerprint),admitted:pack.groundedFacts.filter(f=>f.usableForPrimaryClaim).length,physical:pack.groundedFacts.filter(f=>f.usableForPrimaryClaim&&f.factType==='PROCESS').length});
const old=load('out/engine3d/phase25/final/trace.json'),session=load('out/engine3d/phase25/final/research/logs/final.json');
const vertical=await runVerticalSlice(old.topic,'final',{evaluationDate:'2026-10-29',save:async n=>n,research:async()=>({mode:'REPROCESSED_RECORDED_SESSION',sessionFile:'recorded',sessionFingerprint:session.fingerprint,queries:session.queryPlan.map((q:any)=>q.text),quality:session.quality,pack:session.EvidencePack,networkRequests:0})});
const verticalChecks=['TOPIC_ANALYSIS','RESEARCH_ROUTING','RESEARCH','EVIDENCE','WRITER','SCRIPT','SEMANTICS','NARRATIVE','AUTO_DIRECTION','VISUAL_DEMONSTRATION','DIRECTED_SEQUENCE','ENGINE3D'].map(stage=>{const a=old.stages.find((s:any)=>s.stage===stage),b=vertical.trace.stages.find(s=>s.stage===stage)!;return{stage,passed:a.status===b.status&&a.outputFingerprint===b.outputFingerprint};});
const hashes=Object.entries(load(root+'/baseline/baseline.json').historicalHashes).map(([file,hash])=>({file,passed:contentHash(readFileSync(file,'utf8'))===hash}));
const videos=load('out/engine3d/phase25/analysis/integrity.json').historicalVideos.map((v:any)=>({file:v.file,passed:contentHash(readFileSync(v.file))===v.now}));
const phase25Mp4={file:'out/engine3d/phase25/final/render/final.mp4',passed:contentHash(readFileSync('out/engine3d/phase25/final/render/final.mp4'))==='c901c5a8c6b742fffe4f2d0d203920caa3454fb11a97d0393f853355f999e926'};
const passed=network===0&&[...rows,...historical,...verticalChecks,...hashes,...videos,phase25Mp4].every(r=>r.passed);
const result={passed,networkCallsAttempted:network,rows,historical,verticalChecks,historicalHashes:hashes,historicalVideos:videos,phase25Mp4};mkdirSync(out+'/replay',{recursive:true});writeFileSync(out+'/replay/final.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed,network,processReplays:rows.length,historical:historical.length,verticalStages:verticalChecks.filter(r=>r.passed).length}));if(!passed)process.exitCode=1;
