import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {buildTopicPlan} from '../src/topic';
import {jsonHash} from '../src/editorial/fingerprint';
import {runVerticalSlice,type SessionLike} from '../src/vertical/run';
import {runWebResearch} from '../src/research/web';
import {saveResearchSession} from '../src/research/web/output';
import {validateSnapshot} from '../src/research/web/cache';
import {buildEvidencePack} from '../src/research';
import {verticalWebConfig} from '../src/vertical/config';
/** Vertical slice CLI: topic only → existing pipeline → trace (+ media when every gate passes).
 * VS_FROM_SESSION=<session.json> re-processes an already-acquired live session's snapshots
 * with the current code (integrity-checked, zero network) instead of a new live collection. */
const [topic,label='run',root='out/engine3d/phase25',evaluationDate='2026-10-29']=process.argv.slice(2);
if(!topic||!/^[a-z0-9-]+$/.test(label))throw Error('Usage: vertical-slice "<topic>" <label> [outputRoot] [evaluationDate]');
const out=path.resolve(root,label),save=async(n:string,x:unknown)=>{const f=path.join(out,n);await mkdir(path.dirname(f),{recursive:true});await writeFile(f,typeof x==='string'?x:JSON.stringify(x,null,2));return path.relative(process.cwd(),f).replace(/\\/g,'/');};
const from=process.env.VS_FROM_SESSION;
const media=process.env.VS_MEDIA?(await import('../src/vertical/media')).produceMedia:null;
const result=await runVerticalSlice(topic,label,{evaluationDate,save,now:()=>new Date().toISOString(),
 research:async request=>{
  if(from){const prior=JSON.parse(await readFile(from,'utf8')),{fingerprint,...raw}=prior;if(jsonHash(raw)!==fingerprint)throw Error('SESSION_INTEGRITY');
   const{id:_a,...want}=request,{id:_b,...have}=prior.request;if(jsonHash(want)!==jsonHash(have))throw Error('VS_FROM_SESSION request mismatch');
   for(const a of prior.fetchAttempts)if(a.snapshot)validateSnapshot(a.snapshot);
   for(const s of prior.acceptedSources)if(!prior.fetchAttempts.some((a:{snapshot?:{content:string};finalUrl:string})=>a.snapshot?.content===s.content&&a.finalUrl===s.canonicalLocator))throw Error('REPLAY_SOURCE_SNAPSHOT_MISMATCH');
   const pack=buildEvidencePack(prior.request,{version:1,id:'offline-reprocessed-web',fixture:false,labels:['REAL_WEB_SNAPSHOTS','SESSION_CANDIDATES_ONLY'],sources:prior.acceptedSources});
   const s:SessionLike={mode:'REPROCESSED_RECORDED_SESSION',sessionFile:from.replace(/\\/g,'/'),sessionFingerprint:fingerprint,queries:prior.queryPlan.map((q:{text:string})=>q.text),quality:prior.quality,pack,networkRequests:0};
   return s;}
  const s=await runWebResearch(request,verticalWebConfig(buildTopicPlan({topicPlanningVersion:1,topic}).analysis.language==='en'?'en':'pt'));
  const saved=await saveResearchSession(s,path.join(out,'research'),label);
  return{mode:'LIVE',sessionFile:path.relative(process.cwd(),saved).replace(/\\/g,'/'),sessionFingerprint:s.fingerprint,queries:s.queryPlan.map(q=>q.text),quality:s.quality,pack:s.EvidencePack,networkRequests:s.quality.queries+s.quality.fetchAttempts};
 },
 media:media?(input=>media(input,out,label)):undefined});
console.log(JSON.stringify({firstBlocker:result.trace.firstBlocker,furthestStage:result.trace.furthestStage,stages:result.trace.stages.map(s=>s.stage+':'+s.status+(s.blockingReason?' ('+s.blockingReason.slice(0,240)+')':''))},null,1));
