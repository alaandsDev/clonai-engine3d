import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {contentHash} from '../../src/research/source';
import {jsonHash} from '../../src/editorial/fingerprint';
const root='out/engine3d/phase26/baseline';
mkdirSync(root,{recursive:true});
const histories=['PHASE23_REPORT.md','PHASE24_REPORT.md','PHASE25_REPORT.md','CLONAI_HANDOFF.md','package-lock.json'];
const sessions=['out/engine3d/phase25/final/research/logs/final.json','out/engine3d/phase25/probe-turbine/research/logs/probe-turbine.json'];
const rows=sessions.map(file=>{
 const s=JSON.parse(readFileSync(file,'utf8')),p=s.EvidencePack;
 const facts=p.groundedFacts.filter((f:any)=>f.usableForPrimaryClaim);
 return{file,sha256:contentHash(readFileSync(file,'utf8')),sessionFingerprint:s.fingerprint,topic:s.request.topic,
  acceptedSources:s.acceptedSources.length,contributingSources:new Set(facts.flatMap((f:any)=>f.sourceIds)).size,
  admittedFacts:facts.length,relations:facts.map((f:any)=>f.canonicalFact),quality:p.quality,
  sourceHashes:Object.fromEntries(s.acceptedSources.map((s:any)=>[s.id,s.contentHash]))};
});
const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8'}).trim();
const result={checkpoint:git('rev-parse','HEAD'),branch:git('branch','--show-current'),startingStatus:git('status','--short'),
 historicalHashes:Object.fromEntries(histories.map(f=>[f,contentHash(readFileSync(f,'utf8'))])),sessions:rows,
 primaryWriter:{groundedKnowledgeUnits:3,editorialUnits:5,groundedRatio:3/8,physicalClaims:1,words:111,status:'PRODUCTION_ELIGIBLE'},
 registry:{engine3d:JSON.parse(readFileSync('out/engine3d/catalog.json','utf8')).length,sfx:8,visual:5},
 note:'No historical result edited. Benchmarks C–H have no Phase25 evidence baseline; comparison is unavailable.'};
writeFileSync(root+'/baseline.json',JSON.stringify({...result,fingerprint:jsonHash(result)},null,2));
console.log(JSON.stringify({checkpoint:result.checkpoint,sessions:rows.map(s=>({topic:s.topic,facts:s.admittedFacts,sources:s.acceptedSources})),registry:result.registry}));
