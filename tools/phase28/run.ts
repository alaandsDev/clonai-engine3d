import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import {buildEvidencePack} from '../../src/research';
import {runWebResearch,replayWebResearch} from '../../src/research/web';
import {verticalWebConfig} from '../../src/vertical/config';
import {buildCuriosityStoryPlan} from '../../src/curiosity/story';
import {groundedProgression} from '../../src/curiosity/progression';
import {buildKnowledgeLossTrace} from '../../src/curiosity/knowledge-loss';
import {verifyProcessAcquisition,verifyProgressiveQuestions} from '../../src/curiosity/replay';
import {writeCausalCuriosity,verifyCuriosityWriter} from '../../src/writer/curiosity';
import {plannerInputFromCuriosity,planVisualCausal,compileVisualPlan,visualQa,validateVisualPlan,verifyVisualPlan} from '../../src/visual-causal';
import {jsonHash} from '../../src/editorial/fingerprint';
import {benchmarks} from './benchmarks';
import type {ResearchSession} from '../../src/research/web/contracts';
const [mode='analyze',...ids]=process.argv.slice(2),root='out/engine3d/phase28';
const load=(p:string)=>JSON.parse(readFileSync(p,'utf8')),save=(p:string,v:unknown)=>{const f=root+'/'+p;mkdirSync(path.dirname(f),{recursive:true});writeFileSync(f,typeof v==='string'?v:JSON.stringify(v,null,2));};
if(!['live','analyze','replay'].includes(mode))throw Error('MODE live|analyze|replay');
for(const b of benchmarks.filter(b=>!ids.length||ids.includes(b.id))){
 const initial=load(root+'/baseline/'+b.id+'/metrics.json'),baseline=load(root+'/baseline/'+b.id+'/artifacts.json'),old:ResearchSession=load(initial.sessionPath);verifyProcessAcquisition(old);
 const request=structuredClone(load(root+'/baseline/'+b.id+'/pack.json').researchPlan.request);request.id='phase28-'+b.id;request.sourcePolicy={...request.sourcePolicy,progressiveStory:true};
 const sessionPath='research/'+b.id+'.json';let session:ResearchSession;
 if(mode==='live'){
  if(existsSync(root+'/'+sessionPath))throw Error('LIVE_ALREADY_RECORDED '+b.id+'; use analyze/replay');
  save(b.id+'/research-intent.json',{request,initialAcquisition:old.fingerprint,initialMode:'HISTORICAL_VERIFIED_ACQUISITION',noFactualSeeds:true});
  session=await runWebResearch(request,{...verticalWebConfig('pt'),maxResearchRounds:2,maxQueries:16,maxSearchResults:120,maxCandidateSources:64,maxFetchedSources:24,maxSourcesPerDomain:16,maxDurationMs:180000},{initialAcquisition:old});
  save(sessionPath,session);
 }else session=load(root+'/'+sessionPath);
 const provenance=verifyProgressiveQuestions(session);
 if(mode==='replay'){const replay=replayWebResearch(session);if(replay.processingFingerprint!==session.processingFingerprint)throw Error('PROCESS_REPLAY');}
 const pack=buildEvidencePack(request,{version:1,id:'phase28-acquisition',fixture:false,labels:['REAL_WEB_SNAPSHOTS','SESSION_CANDIDATES_ONLY'],sources:session.acceptedSources});
 if(pack.fingerprint!==session.EvidencePack.fingerprint)throw Error('PACK_ACQUISITION_REPLAY');
 const a=buildCuriosityStoryPlan(pack),w=writeCausalCuriosity(pack);if(!verifyCuriosityWriter(pack,w,a))throw Error('WRITER_PROVENANCE');
 save(b.id+'/pack.json',pack);save(b.id+'/artifacts.json',a);save(b.id+'/writer.json',w);save(b.id+'/script.txt',w.script);save(b.id+'/needs.json',a.story.needs);
 let at=0;const timing=w.sentences.map(s=>{const n=Math.max(12,Math.ceil(s.text.split(/\s+/).length/2.6*30)),t={sentenceId:s.id,startFrame:at,endFrame:at+n};at+=n;return t;});
 let visual=null,qa=null,validation=null;
 if(w.handoff.relations.length){const input=plannerInputFromCuriosity(b.topic,w,timing,30,undefined,{allowGroundedPreview:true}),p=planVisualCausal(input);validation=validateVisualPlan(p,input.relations.map(r=>r.id));if(!verifyVisualPlan(p,input).valid)throw Error('VISUAL_REPLAY');visual=p;save(b.id+'/visual-input.json',input);save(b.id+'/visual-plan.json',p);if(validation.valid&&!p.previewOnly){const seq=compileVisualPlan(p,{sentences:timing.map(t=>({...t,id:t.sentenceId,text:w.sentences.find(s=>s.id===t.sentenceId)!.text}))});qa=visualQa(p,seq);save(b.id+'/estimated-sequence.json',seq);save(b.id+'/estimated-qa.json',qa);}}
 save(b.id+'/loss-trace.json',buildKnowledgeLossTrace(pack,a,w,session,visual??undefined));
 const newQueries=session.queryPlan.filter(q=>session.progressive!.newQueryIds.includes(q.id)),newFetches=session.fetchAttempts.slice(session.progressive?.historicalInitial?.fetchCount??0),oldIds=new Set(old.acceptedSources.map(s=>s.id)),newSources=session.acceptedSources.filter(s=>!oldIds.has(s.id));
 const review=w.handoff.relations.map(r=>({relationId:r.id,subject:r.subject,predicate:r.predicate,object:r.object,modality:r.modality,newRelation:!baseline.knowledge.relations.some((x:{id:string})=>x.id===r.id),proof:r.proof.map(p=>({sourceId:p.sourceId,url:p.sourceLocator,snapshotHash:p.snapshotHash,span:p.span,context:p.contextSpans})),verdict:'PENDING_MANUAL_REVIEW',reason:''}));save(b.id+'/precision-review-pending.json',review);
 const metrics={id:b.id,topic:b.topic,initialQueries:old.queryPlan.length,initialFetches:old.fetchAttempts.length,initialSources:old.acceptedSources.length,newQueries:newQueries.length,newGapQueries:newQueries.filter(q=>q.storyNeed).length,newResults:session.searchResults.filter(r=>newQueries.some(q=>q.id===r.queryId)).length,newFetches:newFetches.length,newSources:newSources.length,stopReason:session.progressive!.stopReason,before:{...baseline.knowledge.metrics,progression:groundedProgression(baseline.knowledge).metrics},after:{...a.knowledge.metrics,progression:a.story.progression!.metrics},newRelationIds:a.knowledge.relations.filter(r=>!baseline.knowledge.relations.some((x:{id:string})=>x.id===r.id)).map(r=>r.id),writerEligible:w.eligible,writerWords:w.metrics.words,writerClassification:w.handoff.progression?.classification,writerProgression:w.handoff.progression?.metrics,unsupportedStorySlots:a.story.needs!.filter(n=>n.status==='UNSUPPORTED').length,visualPlan:validation,visualBeats:visual?.beats.length??0,visualizableBeats:visual?.beats.filter(b=>b.proof&&['DIRECT','PARTIAL'].includes(b.proof.level)).length??0,estimatedStasis:qa?.longestMeaningfulStasisSeconds??null,provenance,processingFingerprint:session.processingFingerprint,artifactFingerprint:jsonHash({pack:pack.fingerprint,knowledge:a.knowledge.fingerprint,story:a.story.fingerprint,writer:w.fingerprint,visual:visual?.fingerprint??null})};
 save(b.id+'/metrics.json',metrics);console.log(JSON.stringify(metrics));
}
