import assert from 'node:assert/strict';
import http from 'node:http';import https from 'node:https';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {validateEvidencePack} from '../../src/research/qa';
import {replayWebResearch,nodeEnvironment} from '../../src/research/web';
const read=async(file:string)=>JSON.parse(await readFile(file,'utf8'));
let networkCalls=0;const deny=()=>{networkCalls++;throw Error('PREFLIGHT_NETWORK_BLOCKED');};Object.assign(http,{request:deny,get:deny});Object.assign(https,{request:deny,get:deny});globalThis.fetch=deny as typeof fetch;Object.assign(nodeEnvironment,{resolve:deny,transport:deny});
const packs:string[]=[],sessions:string[]=[];
for(const phase of ['phase19','phase20'])for(const name of(await readdir('out/engine3d/'+phase+'/packs')).filter(n=>n.endsWith('.json'))){const p=await read('out/engine3d/'+phase+'/packs/'+name);if(!p.fingerprint)continue;validateEvidencePack(p);packs.push(phase+'/'+name);}
for(const[phase,labels]of [['phase20',['real-cold-places','real-temperature-records']],['phase21',['real-cold-places-v2','real-population-census-v2']],['phase22',['real-cold-places-v3','real-population-census-v3']]] as const)for(const label of labels){const s=await read('out/engine3d/'+phase+'/logs/'+label+'.json'),r=replayWebResearch(s);assert.equal(r.processingFingerprint,s.processingFingerprint);assert.equal(r.EvidencePack.fingerprint,s.EvidencePack.fingerprint);sessions.push(phase+'/'+label);}
assert.equal(networkCalls,0);const result={passed:true,networkCalls,packs,sessions};await writeFile('out/engine3d/phase23/analysis/preflight.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
