import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import dns from 'node:dns';
import {jsonHash} from '../../src/editorial/fingerprint';
import {ingestScript} from '../../src/script-mode/ingest';
import {understandScript} from '../../src/script-mode/understand';
import {plannerInputFromScript} from '../../src/script-mode/input';
import {scriptProvenance} from '../../src/script-mode/report';
import {planVisualCausal} from '../../src/visual-causal/planner';
import {verifyVisualPlan,validateVisualPlan} from '../../src/visual-causal/verify';
import {compileVisualPlan} from '../../src/visual-causal/compile';
import {plannerInputFromCuriosity} from '../../src/visual-causal/input';
import {sentenceTiming,type VoiceTrack} from '../../src/visual-causal/media';
/** Phase29 offline replay (read-only): every network primitive is denied, including loopback.
 * Script Mode artifacts are rebuilt from the exact script + recorded voice durations; legacy
 * Phase27B/Phase28B plans are rebuilt to prove the shared planner/compiler changes are inert for them. */
let network=0;const deny=()=>{network++;throw Error('NETWORK_FORBIDDEN_IN_REPLAY');};
globalThis.fetch=deny as typeof fetch;for(const m of [http,https])for(const k of ['request','get'])(m as unknown as Record<string,unknown>)[k]=deny;(net as unknown as Record<string,unknown>).connect=deny;(net as unknown as Record<string,unknown>).createConnection=deny;(dns as unknown as Record<string,unknown>).lookup=deny;
const read=(f:string)=>JSON.parse(readFileSync(f,'utf8')),sha=(f:string)=>createHash('sha256').update(readFileSync(f)).digest('hex');
const script=(dir:string,mp4:string)=>{
 const raw=readFileSync(dir+'/script.txt','utf8'),tracks:VoiceTrack[]=read(dir+'/tracks.json'),u=understandScript(ingestScript(raw)),timing=sentenceTiming(tracks,8);
 const input=plannerInputFromScript(u,timing,30),plan=planVisualCausal(input),seq=compileVisualPlan(plan,{sentences:timing.map(t=>({id:t.sentenceId,text:u.segments.find(s=>s.id===t.sentenceId)!.span.text,startFrame:t.startFrame,endFrame:t.endFrame}))});
 const summary=read(dir+'/summary.json'),prov=scriptProvenance(u,plan,seq);
 return{dir,understandingEqual:u.fingerprint===read(dir+'/semantic-claims.json').fingerprint,planEqual:plan.fingerprint===read(dir+'/visual-plan.json').fingerprint,sequenceEqual:jsonHash(seq)===jsonHash(read(dir+'/directed-sequence.json')),
  planReplay:verifyVisualPlan(plan,input),validation:validateVisualPlan(plan,input.relations.map(r=>r.id)),provenanceVerified:prov.verified&&prov.factualBeatsWithScriptSpan,webProvenance:prov.webProvenance,
  mp4:{recorded:summary.mp4.sha256,recomputed:sha(mp4),equal:summary.mp4.sha256===sha(mp4)}};};
const results=[script('out/engine3d/phase29/final','out/engine3d/phase29/final/phase29-script-mode-final.mp4'),script('out/engine3d/phase29/probe','out/engine3d/phase29/probe/probe.mp4')];
// Legacy plans (read-only): Phase27B final attempt and Phase28B benchmark plans must rebuild identically.
const legacy:{case:string;planEqual:boolean;sequenceEqual?:boolean}[]=[];
{const dir='out/engine3d/phase27b/attempts/attempt-5/',w=read('out/engine3d/phase26/phase26b/attempts/final/writer/A.json'),timing=sentenceTiming(read(dir+'tracks.json'),8),input=plannerInputFromCuriosity('Como funciona um poço artesiano?',w,timing,30),plan=planVisualCausal(input);
 const seq=compileVisualPlan(plan,{sentences:timing.map(t=>({id:t.sentenceId,text:w.sentences.find((s:{id:string})=>s.id===t.sentenceId).text,startFrame:t.startFrame,endFrame:t.endFrame}))});
 legacy.push({case:'phase27b-final',planEqual:plan.fingerprint===read(dir+'plan.json').fingerprint,sequenceEqual:jsonHash(seq)===jsonHash(read(dir+'sequence.json'))});}
for(const b of ['well','elevator','turbine']){const input=read('out/engine3d/phase28b/'+b+'/visual-input.json'),plan=planVisualCausal(input);legacy.push({case:'phase28b-'+b,planEqual:plan.fingerprint===read('out/engine3d/phase28b/'+b+'/visual-plan.json').fingerprint});}
const passed=network===0&&results.every(r=>r.understandingEqual&&r.planEqual&&r.sequenceEqual&&r.planReplay.valid&&r.validation.valid&&r.provenanceVerified&&r.mp4.equal)&&legacy.every(l=>l.planEqual&&l.sequenceEqual!==false);
const out={passed,networkCallsAttempted:network,results,legacy};
mkdirSync('out/engine3d/phase29/replay',{recursive:true});writeFileSync('out/engine3d/phase29/replay/replay.json',JSON.stringify(out,null,2));
console.log(JSON.stringify({passed,network,results:results.map(r=>({dir:r.dir,u:r.understandingEqual,plan:r.planEqual,seq:r.sequenceEqual,prov:r.provenanceVerified,mp4:r.mp4.equal})),legacy}));
