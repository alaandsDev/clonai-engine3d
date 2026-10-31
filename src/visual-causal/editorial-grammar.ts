import {jsonHash} from '../editorial/fingerprint';
import {HYBRID_EDITORIAL_PROFILE as PROFILE,type HybridEditorialTrack,type MicroDiagram,type DiagramNode,type DiagramEdge,type EditorialScale,type EditorialDecision} from '../editorial/hybrid-contracts';
import {normalize} from '../semantics/normalize';
import type {PlannerInput,VisualCausalPlan,CausalVisualBeat,WorldEntity} from './contracts';

const key=(s:string)=>normalize(s).replace(/^(?:the|a|an|o|a|os|as|um|uma)\s+/,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const uid=(kind:string,data:unknown)=>'HE_'+kind+'_'+jsonHash(data).slice(0,12);
export const physicalAction=(b:CausalVisualBeat)=>b.operations.some(o=>!['HIGHLIGHT','REVEAL','HIDE'].includes(o.operation)&&o.target!=='ENVIRONMENT');
/** Capability selection is not execution evidence. Reuse the existing demonstration selector. */
export const physicalAvailable=(plan:VisualCausalPlan,b:CausalVisualBeat)=>physicalAction(b)||Boolean(plan.demonstrations?.some(d=>
 (d.id===b.demonstrationId||d.claimIds.some(id=>b.relationIds.includes(id)))&&['DIRECT','PARTIAL'].includes(d.support)&&d.observable!=='NONE'&&d.strategy!=='NAMED_ONLY'));
type Candidate=Pick<MicroDiagram,'shape'|'nodes'|'edges'|'relationIds'>;

/** Bind semantic identity to existing geometry, including aliases already resolved upstream. */
export function boundEntity(input:PlannerInput,plan:VisualCausalPlan,label:string,relationId:string,slot:string):WorldEntity|undefined{
 const aliases=input.scriptUnderstanding?.entities.filter(e=>key(e.label)===key(label)||e.mentions.some(m=>key(m.span.text)===key(label))).map(e=>e.id)??[];
 const matches=plan.world.entities.filter(e=>e.grounding==='FACTUAL'&&(key(e.participant??'')===key(label)||key(e.label??'')===key(label)||e.scriptEntityIds?.some(id=>aliases.includes(id))));
 if(matches.length===1)return matches[0];
 if(slot==='path'){const paths=plan.world.entities.filter(e=>e.kind==='PATH'&&e.grounding==='FACTUAL'&&e.relationIds.includes(relationId));if(paths.length===1)return paths[0];}
 return undefined;
}

/** Read the existing graph. This is a projection, not a new knowledge graph or an extractor. */
export function diagramCandidates(input:PlannerInput,plan:VisualCausalPlan):Candidate[]{
 const out:Candidate[]=[],known=new Set(input.relations.map(r=>r.id));
 const make=(shape:Candidate['shape'],refs:{label:string;relationId:string;slot:string}[],edgeRefs:{relationId:string;label:string;kind:DiagramEdge['kind'];from?:number;to?:number}[])=>{
  const nodes:DiagramNode[]=refs.map((r,i)=>({...r,id:uid('node',r),entityId:boundEntity(input,plan,r.label,r.relationId,r.slot)?.entityId??null,
   position:shape==='HIGH_LOW'?[i===0?.3:.7,i===0?.3:.7]:[.16+i*.68/Math.max(1,refs.length-1),.5]}));
  const edges=edgeRefs.map((r,i)=>({from:nodes[r.from??i].id,to:nodes[r.to??i+1].id,relationId:r.relationId,label:r.label,kind:r.kind}));
  out.push({shape,nodes,edges,relationIds:[...new Set(refs.map(r=>r.relationId).concat(edges.map(r=>r.relationId)))]});
 };
 for(const m of input.scriptUnderstanding?.mechanism??[]){if(!known.has(m.id)||m.negated||m.modality!=='ASSERTED')continue;
  if(m.source&&m.path&&m.destination){
   const boundary=m.source.region==='INSIDE'&&m.destination.region==='OUTSIDE';
   make(boundary?'INSIDE_BOUNDARY_OUTSIDE':'ROUTE',['source','path','destination'].map(slot=>({label:m[slot as 'source'|'path'|'destination']!.text,relationId:m.id,slot})),
    [0,1].map(()=>({relationId:m.id,label:m.predicate.text,kind:'MOVEMENT' as const})));
  }else if(m.before&&m.after){make('BEFORE_AFTER',[{label:m.before,relationId:m.id,slot:'before'},{label:m.after,relationId:m.id,slot:'after'}],[{relationId:m.id,label:m.predicate.text,kind:'ORDER'}]);}
 }
 for(const r of input.relations){
  const claim=input.scriptUnderstanding?.claims.find(c=>c.id===r.id);
  if(claim&&(claim.status!=='SCRIPT_ASSERTED'||claim.modality!=='ASSERTED'))continue;
  if(!r.subject||!r.object||r.object.includes(' | ')||r.predicate.includes(':'))continue;
  const causal=['CAUSES','CAUSED_BY'].includes(r.predicate),spatial=['ABOVE','BELOW'].includes(r.predicate);
  const supported=causal||spatial||['LOCATED_IN','CONTAINS','EXITS','PRECEDES','TRANSFORM','INPUTS','OUTPUTS','SOLVES','FAILS_BECAUSE'].includes(r.predicate);
  if(!supported)continue;
  const reversed=r.predicate==='CAUSED_BY'||r.predicate==='BELOW',refs=[{label:r.subject,relationId:r.id,slot:'subject'},{label:r.object,relationId:r.id,slot:'object'}];
  if(reversed)refs.reverse();
  make(causal?'CAUSE_EFFECT':spatial?'HIGH_LOW':'RELATION',refs,[{relationId:r.id,label:r.predicate,kind:causal?'CAUSE':spatial?'POSITION':'RELATION',...(r.predicate==='BELOW'?{from:1,to:0}:{})}]);
  if(r.predicate==='INPUTS')for(const next of input.relations.filter(x=>x.predicate==='OUTPUTS'&&key(x.subject)===key(r.object))){
   make('INPUT_PROCESS_OUTPUT',[{label:r.subject,relationId:r.id,slot:'subject'},{label:r.object,relationId:r.id,slot:'object'},{label:next.object,relationId:next.id,slot:'object'}],
    [{relationId:r.id,label:r.predicate,kind:'RELATION'},{relationId:next.id,label:next.predicate,kind:'RELATION'}]);}
 }
 return out;
}
const scale=(b:CausalVisualBeat):EditorialScale=>b.cameraZone==='WORLD'?'WORLD':['COMPONENT','ACTION','CUTAWAY'].includes(b.cameraZone)?'COMPONENT':'SYSTEM';
const sentence=(input:PlannerInput,id:string|null)=>input.sentences.find(s=>s.id===id);
export const narratedTerm=(text:string,term:string)=>Boolean(term.trim()&&new RegExp('(^|[^a-z0-9])'+normalize(term).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'($|[^a-z0-9])').test(normalize(text)));
export function semanticParticipants(input:PlannerInput,plan:VisualCausalPlan){
 const refs=input.relations.flatMap(r=>[{label:r.subject,relationId:r.id,slot:'subject'},...r.object.split(' | ').map(label=>({label,relationId:r.id,slot:'object'}))]);
 for(const m of input.scriptUnderstanding?.mechanism??[])if(!m.negated&&m.modality==='ASSERTED'&&input.relations.some(r=>r.id===m.id))
  for(const slot of ['subject','object','quantity','source','path','destination','propertyOwner'] as const){const x=m[slot];if(x)refs.push({label:x.text,relationId:m.id,slot});}
 return refs.filter(r=>r.label).map(r=>({...r,entityId:boundEntity(input,plan,r.label,r.relationId,r.slot)?.entityId??null}));
}

/** Extension of the existing Director: selects temporary communication modes without changing facts,
 * world geometry, timeline, physical operations, state transitions, presenter identity, or proof. */
export function buildHybridEditorial(input:PlannerInput,plan:VisualCausalPlan):HybridEditorialTrack{
 const track:HybridEditorialTrack={version:1,profile:PROFILE.id,worldId:plan.worldId,presenterId:plan.world.presenter.entityId,presenterResourceId:plan.world.presenter.resourceId,
  decisions:[],diagrams:[],annotations:[],words:[],questions:[],chapters:[],diagnostics:[]};
 const candidates=diagramCandidates(input,plan),participants=semanticParticipants(input,plan),seenDiagrams=new Set<string>(),seenWords=new Set<string>();
 const diag=(code:string,reason:string,relationIds:string[])=>track.diagnostics.push({code,reason,relationIds});
 for(const request of input.hybridEditorial?.diagrams??[])if(!candidates.some(c=>request.relationIds.every(id=>c.relationIds.includes(id))))
  diag('DIAGRAM_REQUEST_UNSUPPORTED','No admitted semantic projection for the requested relations; no diagram or new participant created',request.relationIds);
 for(const b of plan.beats){
  const physical=physicalAction(b),available=physicalAvailable(plan,b),focus=b.focusEntityId?plan.world.entities.find(e=>e.entityId===b.focusEntityId):undefined;
  const decision:EditorialDecision={beatId:b.id,representation:physical?'PHYSICAL_3D_DEMONSTRATION':b.cameraZone==='RESULT'?'RESULT_SHOT':b.presenterVisible&&b.presenterIntent!=='NONE'?'CHARACTER_ACTION':'WORLD_CONTEXT',
   scale:scale(b),physicalAvailable:available,physicalExecuted:physical,physicalNotUsedReason:null as string|null,focusEntityIds:focus?[focus.entityId]:[],reason:physical?'Execute the existing supported physical action':b.cameraMotivation};
  track.decisions.push(decision);
  const request=input.hybridEditorial?.diagrams?.find(q=>q.relationIds.some(id=>b.relationIds.includes(id)));
  const introduced=(id:string)=>input.relations.find(r=>r.id===id)?.sentenceIds.some(sid=>(input.timing.find(t=>t.sentenceId===sid)?.startFrame??Infinity)<=b.startFrame);
  const candidate=candidates.filter(c=>c.relationIds.some(id=>b.relationIds.includes(id))&&c.relationIds.every(introduced)).sort((a,z)=>z.nodes.length-a.nodes.length)[0];
  // Physical windows are protected. A requested supplement can only use the lead BEFORE the action.
  const firstAction=b.operations.filter(o=>!['HIGHLIGHT','REVEAL','HIDE'].includes(o.operation)&&o.target!=='ENVIRONMENT').reduce((n,o)=>Math.min(n,o.startOffset),1);
  const availableEnd=physical?b.startFrame+Math.floor((b.endFrame-b.startFrame)*firstAction):b.endFrame;
  const diagramStart=Math.max(b.startFrame,Math.ceil(PROFILE.worldEstablishSeconds*input.fps));
  const end=Math.min(availableEnd-1,diagramStart+Math.floor(PROFILE.maxDiagramSeconds*input.fps),input.totalFrames-1);
  const signature=candidate?jsonHash(candidate.relationIds):'';
  if(candidate&&(request||!physical)&&!seenDiagrams.has(signature)){
   if(end-diagramStart>=Math.round(input.fps*.4)){
    seenDiagrams.add(signature);track.diagrams.push({...structuredClone(candidate),id:uid('diagram',[b.id,signature]),beatId:b.id,startFrame:diagramStart,endFrame:end,
     worldId:plan.worldId,returnWorldId:plan.worldId,returnFrame:end,reason:request?.reason??'Temporary simplification of a supported relation; physical world is retained',physicalAvailable:available,proof:'EDITORIAL_ONLY'});
    if(!physical){decision.representation='MICRO_DIAGRAM';decision.scale='ABSTRACT';if(available)decision.physicalNotUsedReason=request?.reason??'Supported physical intent exists but has no executed operation in this beat; abstraction is editorial and leaves the physical gap unresolved';}
   }else diag('NO_NONPHYSICAL_WINDOW','Diagram declined: it would cover the supported action or its result',candidate.relationIds);
  }
  if(focus&&b.relationIds.length){
   const node=participants.find(n=>n.entityId===focus.entityId&&b.relationIds.includes(n.relationId));
   if(node){const flow=b.operations.find(o=>o.target===focus.entityId&&o.operation==='FLOW');
    const onset=flow&&!flow.observed?b.startFrame+Math.round((b.endFrame-b.startFrame)*flow.startOffset):b.startFrame;
    const a0=Math.max(onset,b.startFrame+Math.min(3,Math.floor((b.endFrame-b.startFrame)/4))),a1=Math.min(b.endFrame,a0+Math.round(1.5*input.fps),flow&&!flow.sustain?b.startFrame+Math.round((b.endFrame-b.startFrame)*flow.endOffset):b.endFrame);
    if(a1>a0){track.annotations.push({id:uid('annotation',b.id),beatId:b.id,startFrame:a0,endFrame:a1,relationIds:[node.relationId],
     entityId:focus.entityId,kind:focus.kind==='PATH'?(b.operations.some(o=>o.operation==='FLOW')?'FLOW':'PATH'):'ARROW',label:focus.label,
     binding:{relationId:node.relationId,participant:node.label},anchor:'CENTER',proof:'EDITORIAL_ONLY'});
     if(physical)decision.representation='ANNOTATED_3D';}}
  }
  const s=sentence(input,b.sentenceId);if(s){
   const causal=input.relations.find(r=>b.relationIds.includes(r.id)&&['CAUSES','CAUSED_BY'].includes(r.predicate));
   const mechanism=input.scriptUnderstanding?.mechanism?.find(m=>b.relationIds.includes(m.id)&&!m.negated&&m.modality==='ASSERTED');
   const word=causal?(causal.predicate==='CAUSED_BY'?causal.object:causal.subject):mechanism?.predicate.text;
   if(word&&word.split(/\s+/).length<=3&&word.length<=80&&narratedTerm(s.text,word)&&!seenWords.has(s.id+'|'+word)){
    const start=Math.min(b.endFrame-1,Math.max(b.startFrame,b.anchorFrame??b.startFrame)),stop=Math.min(b.endFrame,start+Math.round(PROFILE.maxWordSeconds*input.fps));
    if(stop>start){seenWords.add(s.id+'|'+word);track.words.push({id:uid('word',[b.id,word]),beatId:b.id,startFrame:start,endFrame:stop,relationIds:[causal?.id??mechanism!.id],sentenceId:s.id,text:word,proof:'EDITORIAL_ONLY'});}}
  }
 }
 // A question does not become a factual premise. Explicit bindings or a unique SAME predicate + participant are needed.
 for(const q of input.sentences.filter(s=>s.roles.includes('QUESTION')&&/\?\s*$/.test(s.text))){
  const qb=plan.beats.filter(b=>b.sentenceId===q.id).at(-1);if(!qb)continue;
  const explicit=input.hybridEditorial?.questionAnswers?.find(x=>x.questionSentenceId===q.id);
  const qclaims=input.scriptUnderstanding?.claims.filter(c=>c.segmentId===q.id&&c.status==='QUESTION')??[];
  const matches=input.relations.filter(r=>r.sentenceIds.some(id=>(input.timing.find(t=>t.sentenceId===id)?.startFrame??0)>=qb.endFrame)&&qclaims.some(c=>c.predicate===r.predicate&&key(c.subject.text)===key(r.subject)));
  const ids=explicit?.relationIds??(matches.length===1?[matches[0].id]:[]);
  const answerRelations=input.relations.filter(r=>ids.includes(r.id));
  const sharedParticipant=answerRelations.some(r=>narratedTerm(q.text,r.subject)||r.object.split(' | ').some(p=>narratedTerm(q.text,p)))||qclaims.some(c=>answerRelations.some(r=>key(c.subject.text)===key(r.subject)));
  if(explicit&&!sharedParticipant){diag('QUESTION_UNRESOLVED','Explicit answer binding has no shared supported participant in the question',ids);continue;}
  const answer=plan.beats.find(b=>b.startFrame>=qb.endFrame&&b.grounding==='FACTUAL_DEMONSTRATION'&&b.relationIds.some(id=>ids.includes(id))&&physicalAction(b));
  if(!ids.length||!answer||explicit&&answer.sentenceId!==explicit.answerSentenceId){diag('QUESTION_UNRESOLVED','No unambiguous supported physical answer binding; no chapter reset invented',[]);continue;}
  const start=Math.max(qb.startFrame,qb.endFrame-Math.floor(PROFILE.maxResetSeconds*input.fps));
  if(qb.endFrame>start)track.questions.push({id:uid('question',q.id),beatId:qb.id,startFrame:start,endFrame:qb.endFrame,relationIds:ids,questionSentenceId:q.id,answerSentenceId:answer.sentenceId!,answerBeatId:answer.id,revealFrame:answer.startFrame,
   basis:explicit?'SEMANTIC_BINDING':'UNIQUE_PARTICIPANT_AND_PREDICATE',proof:'EDITORIAL_ONLY'});
 }
 // Consume the existing progression's explicit SOLVES pairs; never infer a solution from adjacency.
 const pairs=[...(input.groundedStory?.problemSolutionPairs.filter(p=>p.kind==='REPAIR')??[])];
 // A supplied progression is authoritative (including its refusals and temporal scopes).
 if(!input.groundedStory)for(const s of input.relations.filter(r=>r.predicate==='SOLVES')){
  const targets=input.relations.filter(r=>r.predicate==='FAILS_BECAUSE'&&key(r.subject)===key(s.object));
  if(targets.length===1)pairs.push({problemRelationId:targets[0].id,solutionRelationId:s.id} as typeof pairs[number]);
  else if(targets.length>1)diag('CHAPTER_TARGET_AMBIGUOUS','Multiple problem occurrences share this target; no pair inferred',[s.id]);
 }
 for(const pair of pairs){
  if(!input.relations.some(r=>r.id===pair.problemRelationId)||!input.relations.some(r=>r.id===pair.solutionRelationId))continue;
  const pb=plan.beats.find(b=>b.relationIds.includes(pair.problemRelationId)),sb=plan.beats.find(b=>b.relationIds.includes(pair.solutionRelationId));
  if(!pb||!sb||sb.startFrame<pb.startFrame)continue;
  const changes=plan.transitions.filter(t=>t.grounding==='GROUNDED'&&t.evidenceRelationId&&[pair.problemRelationId,pair.solutionRelationId].includes(t.evidenceRelationId)&&t.from!==t.to&&!['HIGHLIGHT','REVEAL','HIDE'].includes(t.operation));
  const problemChange=changes.some(t=>t.evidenceRelationId===pair.problemRelationId),solutionChange=changes.some(t=>t.evidenceRelationId===pair.solutionRelationId);
  const versions=plan.transitions.filter(t=>t.grounding==='GROUNDED'&&t.from!==t.to&&!['HIGHLIGHT','REVEAL','HIDE'].includes(t.operation));
  track.chapters.push({id:uid('chapter',pair),problemRelationId:pair.problemRelationId,solutionRelationId:pair.solutionRelationId,beatIds:[pb.id,sb.id],
   stateVersionBefore:versions.filter(t=>(plan.beats.find(b=>b.id===t.beatId)?.startFrame??Infinity)<pb.startFrame).length,
   stateVersionAfter:versions.filter(t=>(plan.beats.find(b=>b.id===t.beatId)?.startFrame??Infinity)<=sb.startFrame).length,
   problemChange,solutionChange,physicalChange:problemChange&&solutionChange,status:problemChange&&solutionChange?'SUPPORTED':'PARTIAL'});
 }
 return track;
}

export function withHybridEditorial(input:PlannerInput,plan:VisualCausalPlan):VisualCausalPlan{
 if(!input.hybridEditorial?.enabled)return plan;
 const {fingerprint:_old,...body}=plan,raw={...body,hybridEditorial:buildHybridEditorial(input,plan)};
 return{...raw,fingerprint:jsonHash(raw)};
}
