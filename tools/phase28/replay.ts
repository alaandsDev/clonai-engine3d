import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {jsonHash} from '../../src/editorial/fingerprint';
import {replayWebResearch} from '../../src/research/web';
import {nodeEnvironment} from '../../src/research/web/http';
import {buildCuriosityStoryPlan} from '../../src/curiosity/story';
import {buildKnowledgeLossTrace} from '../../src/curiosity/knowledge-loss';
import {writeCausalCuriosity,verifyCuriosityWriter} from '../../src/writer/curiosity';
import {plannerInputFromCuriosity,planVisualCausal,verifyVisualPlan,validateVisualPlan,compileVisualPlan} from '../../src/visual-causal';
import {benchmarks} from './benchmarks';
const root='out/engine3d/phase28',load=(p:string)=>JSON.parse(readFileSync(root+'/'+p,'utf8')),save=(p:string,x:unknown)=>{mkdirSync(path.dirname(root+'/'+p),{recursive:true});writeFileSync(root+'/'+p,JSON.stringify(x,null,2));},sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
let calls=0;const resolve=nodeEnvironment.resolve,transport=nodeEnvironment.transport,fetch=globalThis.fetch;
const blocked=async()=>{calls++;throw Error('NETWORK_FORBIDDEN_DURING_REPLAY');};
nodeEnvironment.resolve=blocked;nodeEnvironment.transport=blocked;globalThis.fetch=blocked;
const results:unknown[]=[];
try{for(const b of benchmarks){
 const t0=performance.now(),session=load('research/'+b.id+'.json'),r=replayWebResearch(session),t1=performance.now(),pack=r.EvidencePack,a=buildCuriosityStoryPlan(pack),t2=performance.now(),w=writeCausalCuriosity(pack),t3=performance.now();
 if(!verifyCuriosityWriter(pack,w,a))throw Error('WRITER_PROVENANCE '+b.id);
 for(const [name,actual] of [['pack',pack],['artifacts',a],['writer',w]] as const)if(jsonHash(actual)!==jsonHash(load(b.id+'/'+name+'.json')))throw Error('REPLAY_ARTIFACT '+b.id+'/'+name);
 let visual=null,visualProbe='PASS';const input=load(b.id+'/visual-input.json'),rebuilt=plannerInputFromCuriosity(b.topic,w,input.timing,input.fps,undefined,{allowGroundedPreview:true});if(jsonHash(input)!==jsonHash(rebuilt))throw Error('VISUAL_INPUT_REPLAY');visual=planVisualCausal(rebuilt);if(!verifyVisualPlan(visual,rebuilt).valid||!validateVisualPlan(visual,input.relations.map((r:{id:string})=>r.id)).valid||jsonHash(visual)!==jsonHash(load(b.id+'/visual-plan.json')))throw Error('VISUAL_REPLAY');
 if(!w.eligible){if(!visual.previewOnly)throw Error('INELIGIBLE_PREVIEW_GATE');try{compileVisualPlan(visual,{sentences:[]});throw Error('UNEXPECTED_PREVIEW_COMPILATION');}catch(e){if(!String(e).includes('VISUAL_PREVIEW_NOT_RENDERABLE'))throw e;visualProbe='GROUNDED_PREVIEW_ONLY_COMPILATION_BLOCKED';}}
 const loss=buildKnowledgeLossTrace(pack,a,w,session,visual??undefined);if(jsonHash(loss)!==jsonHash(load(b.id+'/loss-trace.json')))throw Error('KNOWLEDGE_LOSS_REPLAY '+b.id);
 const row={id:b.id,passed:true,networkRequests:calls,pack:pack.fingerprint,knowledge:a.knowledge.fingerprint,story:a.story.fingerprint,writer:w.fingerprint,visual:visual?.fingerprint??null,visualProbe,loss:loss.fingerprint,performance:{researchReplayMs:t1-t0,storyPlanningMs:t2-t1,writerMs:t3-t2,totalMs:performance.now()-t0},timingMeaning:'Measured offline replay; extraction is coupled with validation/model replay, not separately observable'};
 results.push(row);console.log(JSON.stringify(row));save('replay/progress.json',results);
}}
finally{nodeEnvironment.resolve=resolve;nodeEnvironment.transport=transport;globalThis.fetch=fetch;}
const integrity=load('baseline/integrity.json'),historical=Object.entries(integrity.hashes as Record<string,string>).map(([file,expected])=>({file,expected,actual:sha(file),passed:expected===sha(file)}));
if(calls||historical.some(h=>!h.passed))throw Error('NETWORK_OR_HISTORICAL_DRIFT');
const media=load('final/summary.json'),primary=load('well/writer.json');if(media.writerFingerprint!==primary.fingerprint||sha(media.path)!==media.sha256)throw Error('PRIMARY_RENDER_PROVENANCE');
save('replay/final.json',{passed:true,networkRequests:calls,results,historical,primaryRenderMatchesWriter:true});
