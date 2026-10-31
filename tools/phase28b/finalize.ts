import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {writeCausalCuriosity,verifyCuriosityWriter} from '../../src/writer/curiosity';
import {buildKnowledgeLossTrace} from '../../src/curiosity/knowledge-loss';
import {groundedProgression} from '../../src/curiosity/progression';
import {plannerInputFromCuriosity,planVisualCausal,verifyVisualPlan,validateVisualPlan,compileVisualPlan,visualQa} from '../../src/visual-causal';
const root='out/engine3d/phase28b',old='out/engine3d/phase28',load=(p:string)=>JSON.parse(readFileSync(p,'utf8')),save=(p:string,x:unknown)=>{mkdirSync(path.dirname(root+'/'+p),{recursive:true});writeFileSync(root+'/'+p,typeof x==='string'?x:JSON.stringify(x,null,2));};
if(!load(root+'/review/new-relations.json').every((r:any)=>r.verdict==='CORRECT'))throw Error('PRECISION_REVIEW_REQUIRED_BEFORE_WRITER');
for(const id of ['well','elevator','turbine']){
 const dir=root+'/attempts/04/'+id+'/',pack=load(dir+'pack.json'),a=load(dir+'artifacts.json'),summary=load(dir+'summary.json'),s=load(root+'/research/'+id+'.json'),w=writeCausalCuriosity(pack);if(!verifyCuriosityWriter(pack,w,a))throw Error('WRITER_PROVENANCE');
 for(const[name,x]of Object.entries({pack,artifacts:a,writer:w,diagnostics:load(dir+'diagnostics.json'),summary}))save(id+'/'+name+'.json',x);save(id+'/script.txt',w.script);
 let at=0;const timing=w.sentences.map(t=>{const n=Math.max(12,Math.ceil(t.text.split(/\s+/).length/2.6*30)),r={sentenceId:t.id,startFrame:at,endFrame:at+n};at+=n;return r;});
 const input=plannerInputFromCuriosity(pack.topic,w,timing,30,undefined,{allowGroundedPreview:true}),plan=planVisualCausal(input),validation=validateVisualPlan(plan,input.relations.map(r=>r.id));if(!verifyVisualPlan(plan,input).valid||!validation.valid)throw Error('VISUAL_HANDOFF');save(id+'/visual-input.json',input);save(id+'/visual-plan.json',plan);
 let qa=null;if(!plan.previewOnly){const seq=compileVisualPlan(plan,{sentences:timing.map(t=>({...t,id:t.sentenceId,text:w.sentences.find(s=>s.id===t.sentenceId)!.text}))});qa=visualQa(plan,seq);save(id+'/estimated-sequence.json',seq);save(id+'/estimated-qa.json',qa);}else{try{compileVisualPlan(plan,{sentences:[]});throw Error('PREVIEW_COMPILED');}catch(e){if(!String(e).includes('VISUAL_PREVIEW_NOT_RENDERABLE'))throw e;}}
 save(id+'/loss-trace.json',buildKnowledgeLossTrace(pack,a,w,s,plan));
 const before=load(old+'/'+id+'/artifacts.json'),bw=load(old+'/'+id+'/writer.json'),selected=w.handoff.relations.filter(r=>!bw.handoff.relations.some((b:any)=>b.id===r.id));
 const gain=id==='well'&&(summary.metrics.longestGroundedChain>before.story.progression.metrics.longestGroundedChain||summary.metrics.stateChangeCount>before.story.progression.metrics.stateChangeCount||w.handoff.progression?.classification!==bw.handoff.progression?.classification||groundedProgression(a.knowledge,selected.map(r=>r.id)).metrics.visualizableEdges>0);
 const metrics={...summary,writerWords:w.metrics.words,writerClassification:w.handoff.progression?.classification,writerProgression:w.handoff.progression?.metrics,writerEligible:w.eligible,writerRelations:w.handoff.relations.map(r=>r.id),newWriterRelationIds:selected.map(r=>r.id),visualizableRelations:w.handoff.progression?.metrics.visualizableEdges??0,visualBeats:plan.beats.length,visualValidation:validation.valid,previewOnly:plan.previewOnly,estimatedStasis:qa?.longestMeaningfulStasisSeconds??null,renderEligible:!plan.previewOnly,renderDecision:gain?'RENDER':'NO_NEW_RENDER',renderReason:id!=='well'?'PRIMARY_RENDER_GATE_APPLIES_TO_WELL_ONLY':gain?'GROUNDED_VISUAL_GAIN':'NO_GROUNDED_VISUAL_GAIN'};save(id+'/metrics.json',metrics);console.log(JSON.stringify(metrics));
}
