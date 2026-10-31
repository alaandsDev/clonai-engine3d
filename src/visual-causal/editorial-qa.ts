import {jsonHash} from '../editorial/fingerprint';
import {HYBRID_EDITORIAL_PROFILE as PROFILE,validateHybridTrack} from '../editorial/hybrid-contracts';
import {buildHybridEditorial,diagramCandidates,semanticParticipants,narratedTerm,physicalAction,physicalAvailable} from './editorial-grammar';
import {evaluateDirected,type DirectedSequence} from '../engine3d/directed';
import {annotationWorldPoints} from '../engine3d/hybrid-runtime';
import {pointStatus} from './qa';
import type {PlannerInput,VisualCausalPlan} from './contracts';
export interface HybridFinding {severity:'BLOCKER'|'WARNING'|'INFO';category:'HYBRID_EDITORIAL';code:string;message:string;evidence:unknown}
/** Measures semantic binding, projected anchors and continuity, not human comprehension. */
export function hybridEditorialQa(input:PlannerInput,plan:VisualCausalPlan,sequence:DirectedSequence){
 const findings:HybridFinding[]=[],track=plan.hybridEditorial;
 const add=(severity:HybridFinding['severity'],code:string,message:string,evidence:unknown)=>findings.push({severity,category:'HYBRID_EDITORIAL',code,message,evidence});
 const finish=()=>({version:1,applicable:Boolean(input.hybridEditorial?.enabled||track||sequence.hybridEditorial),
  status:findings.some(f=>f.severity==='BLOCKER')?'BLOCKED':findings.some(f=>f.severity==='WARNING')?'WARNING':'PASS',findings,
  metrics:{diagramCount:track?.diagrams?.length??0,annotationCount:track?.annotations?.length??0,wordCount:track?.words?.length??0,questionCount:track?.questions?.length??0,chapterCount:track?.chapters?.length??0},
  meaning:'SEMANTIC_BINDINGS_AND_SAMPLED_GEOMETRY_NOT_VIEWER_UNDERSTANDING'});
 if(!track){if(input.hybridEditorial?.enabled||sequence.hybridEditorial)add('BLOCKER','EDITORIAL_TRACK_MISSING','Requested grammar must reach the existing plan and renderer',null);return finish();}
 try{validateHybridTrack(track,plan.totalFrames);}catch(e){add('BLOCKER','EDITORIAL_SCHEMA','Invalid serialized editorial track',String(e));return finish();}
 if(jsonHash(track)!==jsonHash(sequence.hybridEditorial??null))add('BLOCKER','EDITORIAL_COMPILE_MISMATCH','Compiled editorial content differs from the planned content',null);
 if(track.worldId!==plan.worldId||track.presenterId!==plan.world.presenter.entityId||track.presenterResourceId!==plan.world.presenter.resourceId)add('BLOCKER','EDITORIAL_IDENTITY_RESET','Editorial modes must retain the same world and protagonist',null);
 const candidates=diagramCandidates(input,plan),participants=semanticParticipants(input,plan),expected=buildHybridEditorial(input,plan);
 const known=new Set(input.relations.map(r=>r.id)),beat=(id:string)=>plan.beats.find(b=>b.id===id);
 for(const event of [...track.diagrams,...track.annotations,...track.words,...track.questions]){
  const b=beat(event.beatId);
  if(!b||event.startFrame<b.startFrame||event.endFrame>b.endFrame)add('BLOCKER','EDITORIAL_WINDOW','Editorial event leaves its narrative beat',event.id);
  for(const r of event.relationIds)if(!known.has(r))add(b?.grounding==='FACTUAL_DEMONSTRATION'?'BLOCKER':'WARNING','EDITORIAL_UNSUPPORTED_PARTICIPANT','Event cites an absent semantic relation',{eventId:event.id,relationId:r});
 }
 for(const d of track.diagrams){
  const b=beat(d.beatId),canonical=candidates.find(c=>c.shape===d.shape&&jsonHash(c.relationIds)===jsonHash(d.relationIds));
  if(!canonical){add('BLOCKER','DIAGRAM_CONTRADICTS_MECHANISM','No admitted graph projection supports this diagram',{id:d.id,shape:d.shape});continue;}
  const core=(n:typeof d.nodes[number])=>({id:n.id,label:n.label,relationId:n.relationId,slot:n.slot,entityId:n.entityId});
  if(jsonHash(d.nodes.map(core))!==jsonHash(canonical.nodes.map(core)))add(b?.grounding==='FACTUAL_DEMONSTRATION'?'BLOCKER':'WARNING','DIAGRAM_UNSUPPORTED_PARTICIPANT','Diagram nodes/labels/bindings must come from the semantic projection',d.id);
  if(jsonHash(d.edges)!==jsonHash(canonical.edges))add('BLOCKER','DIAGRAM_CONTRADICTS_MECHANISM','Diagram direction, topology or edge semantics contradict the graph',d.id);
  if(d.worldId!==plan.worldId||d.returnWorldId!==plan.worldId||d.returnFrame!==d.endFrame)add('BLOCKER','DIAGRAM_RETURN_WORLD','Abstraction must return to the same persistent world',d.id);
  if(d.endFrame-d.startFrame>PROFILE.maxDiagramSeconds*input.fps)add('WARNING','DIAGRAM_DURATION','Micro diagram exceeds the short editorial budget',d.id);
  if(d.nodes.some(n=>n.position.some(v=>v<0||v>1)))add('BLOCKER','DIAGRAM_OFFSCREEN','A diagram participant cannot be drawn inside the panel',d.id);
  else if(d.nodes.some((n,i)=>d.nodes.slice(i+1).some(x=>Math.hypot(n.position[0]-x.position[0],n.position[1]-x.position[1])<.22)))add('WARNING','DIAGRAM_COMPOSITION','Supported diagram participants have cramped composition',d.id);
  if(b)for(const o of b.operations.filter(o=>!['HIGHLIGHT','REVEAL','HIDE'].includes(o.operation)&&o.target!=='ENVIRONMENT')){
   const a=b.startFrame+(b.endFrame-b.startFrame)*o.startOffset,z=o.sustain?plan.totalFrames:b.startFrame+(b.endFrame-b.startFrame)*o.endOffset;
   if(d.startFrame<z&&d.endFrame>a)add('BLOCKER','DIAGRAM_COVERS_PHYSICAL_ACTION','Diagram would obscure an existing causal action/result window',d.id);}
 }
 for(const a of track.annotations){
  const target=plan.world.entities.find(e=>e.entityId===a.entityId),binding=participants.find(p=>p.relationId===a.binding.relationId&&p.label===a.binding.participant&&p.entityId===a.entityId);
  if(!target||!binding||!a.relationIds.includes(a.binding.relationId)){add('BLOCKER','ANNOTATION_WRONG_PARTICIPANT','Annotation points at geometry different from its semantic participant',a.id);continue;}
  if(a.label&&a.label!==target.label&&!narratedTerm(a.binding.participant,a.label))add('BLOCKER','ANNOTATION_UNSUPPORTED_LABEL','Annotation text is not bound to its participant',a.id);
  if(['PATH','FLOW'].includes(a.kind)&&target.kind!=='PATH')add('BLOCKER','ANNOTATION_PATH_MISSING','Path/flow requires a real scene path',a.id);
  const samples=[a.startFrame,Math.floor((a.startFrame+a.endFrame-1)/2),a.endFrame-1];
  for(const f of samples){const state=evaluateDirected(sequence,f).state,points=annotationWorldPoints(sequence,state,a);
   const statuses=points.map(p=>pointStatus(plan,sequence,f,p,[target]));
   if(!points.length||!statuses.some(s=>s==='VISIBLE'))add(beat(a.beatId)?.grounding==='FACTUAL_DEMONSTRATION'?'BLOCKER':'WARNING','ANNOTATION_ANCHOR_NOT_VISIBLE','No sampled geometry anchor is visible',{id:a.id,frame:f,statuses});
   else if(statuses.some(s=>s!=='VISIBLE'))add('WARNING','ANNOTATION_PARTIAL_PATH','Only part of the physical path is visible at this sample; camera QA evaluates the essential action',{id:a.id,frame:f,statuses});}
 }
 for(const w of track.words){const s=input.sentences.find(s=>s.id===w.sentenceId),canonical=expected.words.find(x=>x.id===w.id);
  if(!s||!narratedTerm(s.text,w.text)||!canonical||canonical.text!==w.text||jsonHash(canonical.relationIds)!==jsonHash(w.relationIds))add('BLOCKER','CAUSAL_WORD_UNSUPPORTED','Editorial causal word lacks a semantic and narrated binding',w.id);}
 for(const q of track.questions)if(!expected.questions.some(x=>x.questionSentenceId===q.questionSentenceId&&x.answerSentenceId===q.answerSentenceId&&x.answerBeatId===q.answerBeatId&&x.revealFrame===q.revealFrame&&jsonHash(x.relationIds)===jsonHash(q.relationIds)))add('BLOCKER','QUESTION_ANSWER_UNSUPPORTED','No supported later physical answer for this actual question',q.id);
 for(const c of track.chapters){const canonical=expected.chapters.find(x=>x.id===c.id);if(!canonical||jsonHash(c)!==jsonHash(canonical))add('BLOCKER','CHAPTER_UNSUPPORTED','Problem/solution chapter is not grounded in an explicit pair and world transitions',c.id);
  else if(c.status==='PARTIAL')add('WARNING','CHAPTER_NO_PHYSICAL_CHANGE','Supported narrative pair lacks a physical change in its problem or solution stage',{id:c.id,problemChange:c.problemChange,solutionChange:c.solutionChange});}
 for(const d of track.decisions){const b=beat(d.beatId);if(!b){add('BLOCKER','EDITORIAL_UNKNOWN_BEAT','Director decision has no beat',d.beatId);continue;}
  if(d.physicalAvailable!==physicalAvailable(plan,b)||d.physicalExecuted!==physicalAction(b))add('BLOCKER','PHYSICAL_EXECUTION_LEDGER','Capability availability must be distinct from actual execution',d);
  if(physicalAvailable(plan,b)&&d.representation==='MICRO_DIAGRAM')add(d.physicalNotUsedReason?'INFO':'WARNING','PHYSICAL_AVAILABLE_NOT_PRIMARY','Record the representation decision without auto-blocking',d);
 }
 const abstractFrames=new Set(track.diagrams.flatMap(d=>Array.from({length:d.endFrame-d.startFrame},(_,i)=>d.startFrame+i)));
 if(abstractFrames.size>plan.totalFrames*.5)add('BLOCKER','THREE_D_NOT_PRIMARY','Temporary abstraction dominates the timeline',abstractFrames.size/plan.totalFrames);
 for(const d of track.diagnostics)add('INFO',d.code,d.reason,d.relationIds);
 return finish();
}
