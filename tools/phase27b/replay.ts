import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import {jsonHash} from '../../src/editorial/fingerprint';
import {plannerInputFromCuriosity,planVisualCausal,verifyVisualPlan,validateVisualPlan,compileVisualPlan,visualProvenance,verifyVisualProvenance} from '../../src/visual-causal';
import {sentenceTiming,type VoiceTrack} from '../../src/visual-causal/media';
/** Offline replay of Phase27 visual planning: zero network; recorded voice durations; plans and
 * sequences rebuilt and compared; final MP4 bytes hashed against the recorded summary. */
let network=0;const deny=()=>{network++;throw Error('NETWORK_FORBIDDEN_IN_REPLAY');};
globalThis.fetch=deny as typeof fetch;(http as {request:unknown}).request=deny;(http as {get:unknown}).get=deny;(https as {request:unknown}).request=deny;(https as {get:unknown}).get=deny;(dns as {lookup:unknown}).lookup=deny;
const cases=[{label:'attempt-5',writer:'out/engine3d/phase26/phase26b/attempts/final/writer/A.json',topic:'Como funciona um poço artesiano?',mp4:true},{label:'probe-elevator',writer:'out/engine3d/phase26/phase26b/attempts/final/writer/F.json',topic:'Como funciona um elevador?',mp4:false}];
const results=cases.map(c=>{const dir='out/engine3d/phase27b/attempts/'+c.label+'/',w=JSON.parse(readFileSync(c.writer,'utf8')),tracks:VoiceTrack[]=JSON.parse(readFileSync(dir+'tracks.json','utf8'));
 const timing=sentenceTiming(tracks,8),input=plannerInputFromCuriosity(c.topic,w,timing,30),plan=planVisualCausal(input),seq=compileVisualPlan(plan,{sentences:timing.map(t=>({id:t.sentenceId,text:w.sentences.find((s:{id:string})=>s.id===t.sentenceId).text,startFrame:t.startFrame,endFrame:t.endFrame}))});
 const recPlan=JSON.parse(readFileSync(dir+'plan.json','utf8')),recSeq=JSON.parse(readFileSync(dir+'sequence.json','utf8'));
 const summary=c.mp4?JSON.parse(readFileSync(dir+'summary.json','utf8')):null,mp4Sha=summary?createHash('sha256').update(readFileSync(summary.mp4.path)).digest('hex'):null;
 const prov=visualProvenance(input,plan,seq,mp4Sha);
 return{label:c.label,inputEqual:jsonHash(input)===jsonHash(JSON.parse(readFileSync(dir+'input.json','utf8'))),planEqual:plan.fingerprint===recPlan.fingerprint,sequenceEqual:jsonHash(seq)===jsonHash(recSeq),planReplay:verifyVisualPlan(recPlan,input),validation:validateVisualPlan(plan,input.relations.map(r=>r.id)),
  mp4:summary?{recorded:summary.mp4.sha256,recomputed:mp4Sha,equal:summary.mp4.sha256===mp4Sha}:null,provenance:{fingerprint:prov.fingerprint,factualBeatProvenanceRate:prov.factualBeatProvenanceRate,editorialClassified:prov.editorialClassified,verified:verifyVisualProvenance(prov,input,plan,seq,mp4Sha),chain:prov.chain}};});
const out={networkCallsAttempted:network,results,passed:network===0&&results.every(r=>r.inputEqual&&r.planEqual&&r.sequenceEqual&&r.planReplay.valid&&r.validation.valid&&(!r.mp4||r.mp4.equal)&&r.provenance.verified&&r.provenance.factualBeatProvenanceRate===1)};
mkdirSync('out/engine3d/phase27b/replay',{recursive:true});writeFileSync('out/engine3d/phase27b/replay/replay.json',JSON.stringify(out,null,2));
mkdirSync('out/engine3d/phase27b/provenance',{recursive:true});writeFileSync('out/engine3d/phase27b/provenance/final-provenance.json',JSON.stringify(visualProvenance(...(()=>{const c=cases[0],dir='out/engine3d/phase27b/attempts/attempt-5/',w=JSON.parse(readFileSync(c.writer,'utf8')),t=sentenceTiming(JSON.parse(readFileSync(dir+'tracks.json','utf8')),8),i=plannerInputFromCuriosity(c.topic,w,t,30),p=planVisualCausal(i);return[i,p,JSON.parse(readFileSync(dir+'sequence.json','utf8')),results[0].mp4!.recomputed] as const;})()),null,2));
console.log(JSON.stringify({network,passed:out.passed,results:results.map(r=>({label:r.label,input:r.inputEqual,plan:r.planEqual,seq:r.sequenceEqual,replay:r.planReplay.valid,mp4:r.mp4?.equal??null,prov:r.provenance.verified,rate:r.provenance.factualBeatProvenanceRate}))},null,1));
