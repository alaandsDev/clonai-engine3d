/** Serializable editorial tracks, independent of topics and of factual proof. */
export const HYBRID_EDITORIAL_PROFILE={id:'HYBRID_3D_V1',version:1,physicalDefault:true,
 maxDiagramSeconds:1.2,maxWordSeconds:1.0,maxResetSeconds:0.35,worldEstablishSeconds:0.6,
 capabilities:['MICRO_DIAGRAM','KEY_CAUSAL_WORD','QUESTION_RESET_REVEAL','SCALE_SWITCHING','ANNOTATED_3D','PROGRESSIVE_CHAPTERS']
} as const;
export type Representation='PHYSICAL_3D_DEMONSTRATION'|'MICRO_DIAGRAM'|'ANNOTATED_3D'|'WORLD_CONTEXT'|'CHARACTER_ACTION'|'RESULT_SHOT';
export type EditorialScale='WORLD'|'SYSTEM'|'COMPONENT'|'ABSTRACT';
export type DiagramShape='ROUTE'|'HIGH_LOW'|'INPUT_PROCESS_OUTPUT'|'BEFORE_AFTER'|'CAUSE_EFFECT'|'INSIDE_BOUNDARY_OUTSIDE'|'RELATION';
export interface EditorialWindow {id:string;beatId:string;startFrame:number;endFrame:number;relationIds:string[]}
export interface DiagramNode {id:string;label:string;relationId:string;slot:string;entityId:string|null;position:[number,number]}
export interface DiagramEdge {from:string;to:string;relationId:string;label:string;kind:'MOVEMENT'|'CAUSE'|'POSITION'|'ORDER'|'RELATION'}
export interface MicroDiagram extends EditorialWindow {shape:DiagramShape;nodes:DiagramNode[];edges:DiagramEdge[];
 worldId:string;returnWorldId:string;returnFrame:number;reason:string;physicalAvailable:boolean;proof:'EDITORIAL_ONLY'}
export type AnnotationKind='ARROW'|'CIRCLE'|'PATH'|'FLOW'|'HIGHLIGHT'|'SHORT_LABEL'|'SOURCE_MARKER'|'DESTINATION_MARKER';
export interface WorldAnnotation extends EditorialWindow {kind:AnnotationKind;entityId:string;label:string|null;
 binding:{relationId:string;participant:string};anchor:'CENTER'|'START'|'END';proof:'EDITORIAL_ONLY'}
export interface CausalWord extends EditorialWindow {sentenceId:string;text:string;proof:'EDITORIAL_ONLY'}
export interface QuestionReset extends EditorialWindow {questionSentenceId:string;answerSentenceId:string;answerBeatId:string;
 revealFrame:number;basis:'SEMANTIC_BINDING'|'UNIQUE_PARTICIPANT_AND_PREDICATE';proof:'EDITORIAL_ONLY'}
export interface EditorialDecision {beatId:string;representation:Representation;scale:EditorialScale;reason:string;
 physicalAvailable:boolean;physicalExecuted:boolean;physicalNotUsedReason:string|null;focusEntityIds:string[]}
export interface ProgressiveChapter {id:string;problemRelationId:string;solutionRelationId:string;beatIds:string[];
 stateVersionBefore:number;stateVersionAfter:number;problemChange:boolean;solutionChange:boolean;physicalChange:boolean;status:'SUPPORTED'|'PARTIAL'}
export interface HybridEditorialTrack {version:1;profile:'HYBRID_3D_V1';worldId:string;presenterId:string;presenterResourceId:string;
 decisions:EditorialDecision[];diagrams:MicroDiagram[];annotations:WorldAnnotation[];words:CausalWord[];questions:QuestionReset[];
 chapters:ProgressiveChapter[];diagnostics:{code:string;reason:string;relationIds:string[]}[]}
export interface HybridEditorialOptions {enabled:true;
 /** Editorial requests refer to existing relations, never supply graph nodes/edges. */
 diagrams?:{relationIds:string[];reason:string}[];
 /** A semantic producer may supply an answer binding; admitted answer relations remain required. */
 questionAnswers?:{questionSentenceId:string;answerSentenceId:string;relationIds:string[]}[]}

/** Low-level structure check; specialized QA/preflight checks semantic support. */
export function validateHybridTrack(track:HybridEditorialTrack,totalFrames:number){
 const bad=(m:string):never=>{throw Error('HYBRID_EDITORIAL_SCHEMA '+m);};
 if(track.version!==1||track.profile!==HYBRID_EDITORIAL_PROFILE.id||!track.worldId||!track.presenterId||!track.presenterResourceId)bad('identity');
 for(const name of ['decisions','diagrams','annotations','words','questions','chapters','diagnostics'] as const)
  if(!Array.isArray(track[name])||track[name].length>256)bad(name);
 const representations=['PHYSICAL_3D_DEMONSTRATION','MICRO_DIAGRAM','ANNOTATED_3D','WORLD_CONTEXT','CHARACTER_ACTION','RESULT_SHOT'];
 for(const d of track.decisions)if(!d.beatId||!representations.includes(d.representation)||!['WORLD','SYSTEM','COMPONENT','ABSTRACT'].includes(d.scale)||!d.reason||typeof d.physicalAvailable!=='boolean'||typeof d.physicalExecuted!=='boolean')bad('decision');
 const windows=[...track.diagrams,...track.annotations,...track.words,...track.questions],ids=new Set<string>();
 for(const x of windows){if(!x.id||ids.has(x.id)||!x.beatId||!Array.isArray(x.relationIds)||x.proof!=='EDITORIAL_ONLY')bad('event identity/proof');ids.add(x.id);
  if(!Number.isInteger(x.startFrame)||!Number.isInteger(x.endFrame)||x.startFrame<0||x.endFrame<=x.startFrame||x.endFrame>totalFrames)bad('event timing');}
 for(const d of track.diagrams){if(!['ROUTE','HIGH_LOW','INPUT_PROCESS_OUTPUT','BEFORE_AFTER','CAUSE_EFFECT','INSIDE_BOUNDARY_OUTSIDE','RELATION'].includes(d.shape)||!Array.isArray(d.nodes)||d.nodes.length<2||d.nodes.length>6||!Array.isArray(d.edges)||d.edges.length>8)bad('diagram size/shape');
  for(const n of d.nodes)if(!n.id||!n.label||n.label.length>240||!n.relationId||!n.slot||!Array.isArray(n.position)||n.position.length!==2||!n.position.every(Number.isFinite))bad('diagram node');
  if(new Set(d.nodes.map(n=>n.id)).size!==d.nodes.length)bad('duplicate nodes');
  for(const e of d.edges)if(!d.nodes.some(n=>n.id===e.from)||!d.nodes.some(n=>n.id===e.to)||!e.relationId||typeof e.label!=='string'||!['MOVEMENT','CAUSE','POSITION','ORDER','RELATION'].includes(e.kind))bad('diagram edge');
  if(!Number.isInteger(d.returnFrame)||d.returnFrame!==d.endFrame||d.returnFrame>=totalFrames)bad('return timing');}
 for(const a of track.annotations)if(!['ARROW','CIRCLE','PATH','FLOW','HIGHLIGHT','SHORT_LABEL','SOURCE_MARKER','DESTINATION_MARKER'].includes(a.kind)||!a.entityId||!a.binding?.relationId||!a.binding.participant||!['CENTER','START','END'].includes(a.anchor))bad('annotation');
 for(const w of track.words)if(!w.sentenceId||!w.text||w.text.length>80)bad('word');
 return track;
}
