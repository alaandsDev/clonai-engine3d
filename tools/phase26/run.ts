import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import {buildTopicPlan,buildRoutedResearchRequest} from '../../src/topic';
import {buildEvidencePack} from '../../src/research';
import {runWebResearch,replayWebResearch} from '../../src/research/web';
import {validateSnapshot} from '../../src/research/web/cache';
import {verticalWebConfig} from '../../src/vertical/config';
import {buildCuriosityStoryPlan} from '../../src/curiosity/story';
import {writeCausalCuriosity} from '../../src/writer/curiosity';
import {processResearchGaps} from '../../src/research/process-planning';
import {jsonHash} from '../../src/editorial/fingerprint';
import {benchmarks} from './benchmarks';
import type {ResearchSession} from '../../src/research/web/contracts';
import {verifyProcessAcquisition} from '../../src/curiosity/replay';
const [mode='recorded',...ids]=process.argv.slice(2),root='out/engine3d/phase26';
const save=(file:string,x:unknown)=>{const f=root+'/'+file;mkdirSync(path.dirname(f),{recursive:true});writeFileSync(f,typeof x==='string'?x:JSON.stringify(x,null,2));};
for(const b of benchmarks.filter(b=>!ids.length||ids.includes(b.id))){
 if(mode==='recorded'&&!['A','B'].includes(b.id))continue;
 const at=performance.now(),plan=buildTopicPlan({topicPlanningVersion:1,topic:b.topic});
 const request=buildRoutedResearchRequest(plan,{id:'phase26-'+b.id,evaluationDate:'2026-10-29',maxSources:24,maxEvidenceItems:256,capacity:{maxSourceBytes:2097152,maxNormalizedCharacters:524288,maxTotalSourceBytes:16777216,allowEnglishExtraction:true}})!;
 request.sourcePolicy={...request.sourcePolicy,mechanismVersion:2};
 save('benchmarks/'+mode+'-'+b.id+'-input.json',{topic:b.topic,plan,request});
 try{
  let session:ResearchSession;
  if(mode==='live'||mode==='live-final'){
   if(existsSync(root+'/research/'+mode+'-'+b.id+'.json'))throw Error('LIVE_ALREADY_RECORDED: use analyze to avoid unneeded collection');
   session=await runWebResearch(request,{...verticalWebConfig(plan.analysis.language==='en'?'en':'pt'),maxQueries:10,maxFetchedSources:24,maxDurationMs:180000,maxTotalBytes:16777216});
   save('research/'+mode+'-'+b.id+'.json',session);
  }else if(mode==='analyze'||mode==='final')session=JSON.parse(readFileSync(root+'/research/'+(mode==='final'&&existsSync(root+'/research/live-final-'+b.id+'.json')?'live-final-':'live-')+b.id+'.json','utf8'));
  else session=JSON.parse(readFileSync(b.id==='A'?'out/engine3d/phase25/final/research/logs/final.json':'out/engine3d/phase25/probe-turbine/research/logs/probe-turbine.json','utf8'));
  verifyProcessAcquisition(session);
  const pack=mode.startsWith('live')?session.EvidencePack:buildEvidencePack(request,{version:1,id:'process-reprocessing',fixture:false,labels:['REAL_WEB_SNAPSHOTS','SESSION_CANDIDATES_ONLY'],sources:session.acceptedSources});
  const artifacts=buildCuriosityStoryPlan(pack),writer=writeCausalCuriosity(pack),m=artifacts.knowledge.metrics;
  save('evidence/'+mode+'-'+b.id+'.json',pack);save('knowledge/'+mode+'-'+b.id+'.json',artifacts.knowledge);save('graphs/'+mode+'-'+b.id+'.json',artifacts.graph);save('stories/'+mode+'-'+b.id+'.json',artifacts.story);save('writer/'+mode+'-'+b.id+'.json',writer);save('writer/'+mode+'-'+b.id+'.txt',writer.script);
  const result={id:b.id,topic:b.topic,mode,sessionFingerprint:session.fingerprint,packFingerprint:pack.fingerprint,knowledgeFingerprint:artifacts.knowledge.fingerprint,graphFingerprint:artifacts.graph.fingerprint,storyFingerprint:artifacts.story.fingerprint,writerFingerprint:writer.fingerprint,intent:plan.analysis.primaryIntent,route:plan.researchRoute,researchStatus:pack.quality.productionEligibility,sources:pack.sources.length,acceptedSources:pack.sourceAssessments.filter(s=>s.accepted).length,...m,potential:artifacts.story.potential.rating,writerStatus:writer.status,writerEligible:writer.eligible,writerMetrics:writer.metrics,review:writer.review,failureReason:writer.eligible?null:writer.reason,
   acquisition:{queries:session.queryPlan.length,results:session.searchResults.length,fetches:session.fetchAttempts.length,bytes:session.quality.budgetUsage.bytes,acquisitionMode:mode==='recorded'?'PHASE25_RECORDED_SNAPSHOTS':'PHASE26_LIVE_SESSION',timeMs:performance.now()-at},gaps:processResearchGaps(pack)};
  save('benchmarks/'+mode+'-'+b.id+'.json',result);console.log(JSON.stringify(result));
 }catch(e){const error={id:b.id,topic:b.topic,mode,error:String(e),elapsedMs:performance.now()-at};save('benchmarks/'+mode+'-'+b.id+'-error.json',error);console.log(JSON.stringify(error));}
}
