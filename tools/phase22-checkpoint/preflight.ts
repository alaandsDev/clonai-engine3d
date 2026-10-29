import assert from 'node:assert/strict';
import http from 'node:http';import https from 'node:https';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {validateEvidencePack} from '../../src/research/qa';
import {buildEvidencePack} from '../../src/research/pack';
import {planResearch} from '../../src/research/planner';
import {webConfig,replayWebResearch,nodeEnvironment} from '../../src/research/web';
import {antiHardcodeV3} from './anti-hardcode';
import type {ResearchSession} from '../../src/research/web';
const root='out/engine3d/phase22',read=async(file:string)=>JSON.parse(await readFile(file,'utf8'));
let networkCalls=0;const deny=()=>{networkCalls++;throw Error('ZERO_NETWORK_PREFLIGHT');};Object.assign(http,{request:deny,get:deny});Object.assign(https,{request:deny,get:deny});globalThis.fetch=deny as typeof fetch;Object.assign(nodeEnvironment,{resolve:deny,transport:deny});
const packs:string[]=[],replays:string[]=[];for(const phase of ['phase19','phase20'])for(const name of(await readdir('out/engine3d/'+phase+'/packs')).filter(n=>n.endsWith('.json'))){const p=await read('out/engine3d/'+phase+'/packs/'+name);if(!p.fingerprint)continue;validateEvidencePack(p);packs.push(phase+'/'+name);}
const historical:ResearchSession[]=[];for(const[phase,labels]of [['phase20',['real-cold-places','real-temperature-records']],['phase21',['real-cold-places-v2','real-population-census-v2']]] as const)for(const label of labels){const s:ResearchSession=await read('out/engine3d/'+phase+'/logs/'+label+'.json'),r=replayWebResearch(s);assert.equal(r.EvidencePack.fingerprint,s.EvidencePack.fingerprint);assert.equal(r.processingFingerprint,s.processingFingerprint);historical.push(s);replays.push(phase+'/'+label);}
const old=historical.find(s=>s.request.id==='real-cold-places-v2')!,request=structuredClone(old.request);request.sourcePolicy={...request.sourcePolicy,researchVersion:3,observationSitePolicy:'SOURCED_OBSERVATION_SITE'};const current=buildEvidencePack(request,{version:1,id:'PRIOR_PHASE_SNAPSHOTS_OFFLINE_ONLY',fixture:false,labels:['OFFLINE_DEVELOPMENT_OBSERVATION_NOT_PHASE22_BENCHMARK'],sources:old.acceptedSources});validateEvidencePack(current);
const projected={...old,request,EvidencePack:current} as ResearchSession;
const inputs=['examples/research/web-v3-cold-request.json','examples/research/web-v3-population-request.json'];for(const file of inputs){const data=await read(file);planResearch(data.request);webConfig(data.web);assert.equal(data.request.sourcePolicy.researchVersion,3);assert.equal(data.request.sourcePolicy.minIndependentSources,2);}
const anti=await antiHardcodeV3([projected,...historical],inputs);await writeFile(root+'/analysis/anti-hardcode-prebench.json',JSON.stringify(anti,null,2));assert(anti.passed,JSON.stringify(anti.findings.filter(f=>f.classification==='BLOCKER')));assert.equal(networkCalls,0);
const output={passed:true,networkCalls,packsRederived:packs,sessionsReplayed:replays,v3TestsLog:'logs/prebench-check-research-v3.txt',antiHardcode:anti.passed,developmentObservation:{mode:'OFFLINE_PRIOR_PHASE_SNAPSHOTS_NOT_PHASE22_BENCHMARK',sources:current.sources.length,contextEvidence:current.evidence.filter(e=>e.structured?.subjectSource).length,supported:current.groundedFacts.filter(f=>f.status==='SUPPORTED').map(f=>({id:f.id,subject:f.canonicalFact.subject,kind:f.canonicalFact.subjectKind??'PLACE',sourceIds:f.sourceIds,value:f.canonicalFact.quantity?.originalValue})),coldEligible:current.ranking?.eligibleItemCount,packFingerprint:current.fingerprint}};
await writeFile(root+'/analysis/prebenchmark-verification.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
