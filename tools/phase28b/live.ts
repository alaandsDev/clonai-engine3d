import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import {runWebResearch} from '../../src/research/web';
import {verticalWebConfig} from '../../src/vertical/config';
import {verifyProgressiveQuestions} from '../../src/curiosity/replay';
const root='out/engine3d/phase28b',old='out/engine3d/phase28',load=(p:string)=>JSON.parse(readFileSync(p,'utf8')),save=(p:string,x:unknown)=>{mkdirSync(path.dirname(root+'/'+p),{recursive:true});writeFileSync(root+'/'+p,JSON.stringify(x,null,2));};
if(!existsSync(root+'/baseline/retrieval-audit.json'))throw Error('OFFLINE_AUDIT_REQUIRED_BEFORE_LIVE');
for(const id of ['well','elevator','turbine']){
 if(existsSync(root+'/research/'+id+'.json')||existsSync(root+'/research/'+id+'-intent.json'))throw Error('ONE_ACQUISITION_PASS_ONLY '+id);
 const seed=load(old+'/research/'+id+'.json'),request=structuredClone(load(old+'/'+id+'/pack.json').researchPlan.request);request.id='phase28b-'+id;request.sourcePolicy={...request.sourcePolicy,contextualParser:1};
 const config={...verticalWebConfig('pt'),maxResearchRounds:1,maxQueries:seed.queryPlan.length+2,maxFetchedSources:24,maxSearchResults:160,maxCandidateSources:64,maxSourcesPerDomain:16,maxDurationMs:150000};
 save('research/'+id+'-intent.json',{request,config,reason:'Offline audit found most gap results lacked qualified identity; reuse snapshots and try at most two new participant-bound queries; one pass only',initialAcquisition:seed.fingerprint});
 const s=await runWebResearch(request,config,{initialAcquisition:seed});save('research/'+id+'.json',s);const p=verifyProgressiveQuestions(s);console.log(JSON.stringify({id,queries:s.progressive!.newQueryIds.length,fetches:s.fetchAttempts.length-seed.fetchAttempts.length,stop:s.progressive!.stopReason,provenance:p}));
}
