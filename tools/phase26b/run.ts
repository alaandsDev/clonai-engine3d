import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {buildEvidencePack} from '../../src/research';
import {verifyProcessAcquisition} from '../../src/curiosity/replay';
import {buildCuriosityStoryPlan} from '../../src/curiosity/story';
import {writeCausalCuriosity} from '../../src/writer/curiosity';
import {buildKnowledgeLossTrace} from '../../src/curiosity/knowledge-loss';
import {benchmarks} from '../phase26/benchmarks';
const [attempt,...ids]=process.argv.slice(2),root='out/engine3d/phase26',out=root+'/phase26b/attempts/'+attempt;
if(!attempt||!/^[a-z0-9-]+$/.test(attempt))throw Error('Attempt label required');
const load=(p:string)=>JSON.parse(readFileSync(p,'utf8')),save=(p:string,x:unknown)=>{mkdirSync(path.dirname(out+'/'+p),{recursive:true});writeFileSync(out+'/'+p,typeof x==='string'?x:JSON.stringify(x,null,2));};
for(const b of benchmarks.filter(b=>!ids.length||ids.includes(b.id))){
 const before=load(root+'/benchmarks/final-'+b.id+'.json'),sessionFile=root+'/research/'+(['A','B'].includes(b.id)?'live-final-':'live-')+b.id+'.json',session=load(sessionFile),at=performance.now();
 verifyProcessAcquisition(session);
 const request=load(root+'/benchmarks/final-'+b.id+'-input.json').request;request.sourcePolicy={...request.sourcePolicy,contextualMechanisms:true};
 const pack=buildEvidencePack(request,{version:1,id:'contextual-reprocessing',fixture:false,labels:['REAL_WEB_SNAPSHOTS','SESSION_CANDIDATES_ONLY'],sources:session.acceptedSources});
 const a=buildCuriosityStoryPlan(pack),w=writeCausalCuriosity(pack);
 save('evidence/'+b.id+'.json',pack);save('artifacts/'+b.id+'.json',a);save('writer/'+b.id+'.json',w);
 if(attempt==='final'){save('loss/'+b.id+'.json',buildKnowledgeLossTrace(pack,a,w,session));save('writer/'+b.id+'.txt',w.script);}
 const result={id:b.id,topic:b.topic,sessionFile,mode:'OFFLINE_REPROCESSING',newQueries:0,newFetches:0,sourceCount:pack.sources.length,extracted:pack.evidence.filter(e=>e.extractionMethod==='MECHANISM_V2').length,...a.knowledge.metrics,potential:a.story.potential.rating,writer:w.status,eligible:w.eligible,words:w.metrics.words,writerMetrics:w.metrics,packFingerprint:pack.fingerprint,artifactsFingerprint:a.story.fingerprint,writerFingerprint:w.fingerprint,before:{facts:before.admittedFacts,relations:before.uniqueRelations,story:before.potential,writer:before.writerStatus},ms:performance.now()-at};save('results/'+b.id+'.json',result);console.log(JSON.stringify(result));
}
