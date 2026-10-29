import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {plannerInputFromCuriosity} from '../../src/visual-causal/input';
import {planVisualCausal} from '../../src/visual-causal/planner';
import {validateVisualPlan} from '../../src/visual-causal/verify';
import {compileVisualPlan} from '../../src/visual-causal/compile';
import {synthesize,sentenceTiming,renderStills,contactSheet} from '../../src/visual-causal/media';
/** Operator harness (topic/input chosen here, never in runtime): plan → sequence → stills/contact sheet. */
const [writerFile,topic,label,mode='stills']=process.argv.slice(2);
if(!writerFile||!topic||!label)throw Error('Usage: pilot <phase26 writer.json> "<topic>" <label> [stills|plan]');
const root='out/engine3d/phase27b/attempts/'+label;mkdirSync(root,{recursive:true});
const w=JSON.parse(readFileSync(writerFile,'utf8')),fps=30;
const tracks=await synthesize(w.sentences.map((s:{id:string;text:string})=>({id:s.id,text:s.text})),fps),timing=sentenceTiming(tracks,8);
const input=plannerInputFromCuriosity(topic,w,timing,fps),plan=planVisualCausal(input),v=validateVisualPlan(plan,input.relations.map(r=>r.id));
const seq=compileVisualPlan(plan,{sentences:timing.map(t=>({id:t.sentenceId,text:w.sentences.find((s:{id:string})=>s.id===t.sentenceId).text,startFrame:t.startFrame,endFrame:t.endFrame}))});
for(const [n,x] of Object.entries({'input.json':input,'tracks.json':tracks,'plan.json':plan,'validation.json':v,'sequence.json':seq}))writeFileSync(path.join(root,n),JSON.stringify(x,null,2));
console.log(JSON.stringify({template:plan.world.template,env:plan.world.environmentId,frames:plan.totalFrames,beats:plan.beats.map(b=>[b.order,b.visualIntent,b.grounding,b.cameraZone,b.startFrame,b.endFrame,b.proof?.level??'-',b.label??'']),gaps:plan.gaps,valid:v},null,0));
if(mode==='stills'){const q=(x:number)=>Math.min(plan.totalFrames-1,Math.round(x));
 const frames=[...new Set([...Array.from({length:11},(_,i)=>q(i*(plan.totalFrames-1)/10)),...plan.beats.map(b=>q((b.startFrame+b.endFrame)/2))])].sort((a,b)=>a-b);
 const files=await renderStills(seq,frames,path.join(root,'stills'));await contactSheet(files,path.join(root,'contact-sheet.png'));console.log('stills',frames.join(','));}
