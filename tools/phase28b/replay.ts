import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {jsonHash} from '../../src/editorial/fingerprint';
import {replayWebResearch} from '../../src/research/web';
import {nodeEnvironment} from '../../src/research/web/http';
import {buildCuriosityStoryPlan} from '../../src/curiosity/story';
import {buildKnowledgeLossTrace} from '../../src/curiosity/knowledge-loss';
import {writeCausalCuriosity,verifyCuriosityWriter} from '../../src/writer/curiosity';
import {plannerInputFromCuriosity,planVisualCausal,compileVisualPlan,verifyVisualPlan,validateVisualPlan} from '../../src/visual-causal';
const root='out/engine3d/phase28b',old='out/engine3d/phase28',load=(p:string)=>JSON.parse(readFileSync(p,'utf8')),save=(p:string,x:unknown)=>{mkdirSync(path.dirname(root+'/'+p),{recursive:true});writeFileSync(root+'/'+p,JSON.stringify(x,null,2));},sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
let calls=0;const resolve=nodeEnvironment.resolve,transport=nodeEnvironment.transport,fetch=globalThis.fetch,blocked=async()=>{calls++;throw Error('NETWORK_FORBIDDEN_DURING_REPLAY');};
nodeEnvironment.resolve=blocked;nodeEnvironment.transport=blocked;globalThis.fetch=blocked;
const results:unknown[]=[];
try{for(const base of [old,root])for(const id of ['well','elevator','turbine']){
 const at=performance.now(),session=load(base+'/research/'+id+'.json'),replayed=replayWebResearch(session),pack=replayed.EvidencePack,a=buildCuriosityStoryPlan(pack),w=writeCausalCuriosity(pack);if(!verifyCuriosityWriter(pack,w,a))throw Error('WRITER_PROVENANCE');
 for(const[name,actual]of Object.entries({pack,artifacts:a,writer:w}))if(jsonHash(actual)!==jsonHash(load(base+'/'+id+'/'+name+'.json')))throw Error('ARTIFACT_DRIFT '+base+'/'+id+'/'+name);
 const input=load(base+'/'+id+'/visual-input.json'),rebuilt=plannerInputFromCuriosity(pack.topic,w,input.timing,input.fps,undefined,{allowGroundedPreview:true}),plan=planVisualCausal(rebuilt);
 if(jsonHash(input)!==jsonHash(rebuilt)||jsonHash(plan)!==jsonHash(load(base+'/'+id+'/visual-plan.json'))||!verifyVisualPlan(plan,rebuilt).valid||!validateVisualPlan(plan,input.relations.map((r:any)=>r.id)).valid)throw Error('VISUAL_DRIFT '+base+'/'+id);
 let compile='PREVIEW_ONLY';if(!plan.previewOnly){const seq=compileVisualPlan(plan,{sentences:input.timing.map((t:any)=>({...t,id:t.sentenceId,text:w.sentences.find(s=>s.id===t.sentenceId)!.text}))});if(jsonHash(seq)!==jsonHash(load(base+'/'+id+'/estimated-sequence.json')))throw Error('SEQUENCE_DRIFT');compile='PASS';}
 const loss=buildKnowledgeLossTrace(pack,a,w,session,plan);if(jsonHash(loss)!==jsonHash(load(base+'/'+id+'/loss-trace.json')))throw Error('LOSS_TRACE_DRIFT '+base+'/'+id);
 const row={phase:base===old?'Phase28':'Phase28B',id,passed:true,networkRequests:calls,pack:pack.fingerprint,knowledge:a.knowledge.fingerprint,writer:w.fingerprint,visual:plan.fingerprint,loss:loss.fingerprint,compile,totalMs:performance.now()-at};results.push(row);save('replay/progress.json',results);console.log(JSON.stringify(row));
}}finally{nodeEnvironment.resolve=resolve;nodeEnvironment.transport=transport;globalThis.fetch=fetch;}
const manifest=load(root+'/preservation/manifest.json'),historical=Object.entries(manifest.hashes as Record<string,string>).map(([file,expected])=>({file,expected,actual:sha(file),passed:sha(file)===expected}));if(calls||historical.some(x=>!x.passed))throw Error('NETWORK_OR_HISTORICAL_DRIFT');
save('replay/final.json',{passed:true,networkRequests:calls,results,historical,phase28Preserved:true});
