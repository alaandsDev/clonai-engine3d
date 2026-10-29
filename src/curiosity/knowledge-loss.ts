import {jsonHash} from '../editorial/fingerprint';
import {normalize} from '../semantics/normalize';
import {mechanismWindows,contextualDocumentScope,contextualWindowScope} from '../research/contextual-mechanism';
import {contextualSafetyRefusal} from '../research/mechanism-clauses';
import {negativeMechanism,unsafeMechanism} from '../research/mechanism-language';
import type {EvidencePack} from '../research/contracts';
import type {ResearchSession} from '../research/web/contracts';
import type {CuriosityArtifacts} from './story';
import {verifyCuriosityWriter,type CuriosityWriter} from '../writer/curiosity';

export const KNOWLEDGE_LOSS_STAGES=['DISCOVERED','FETCHED','PARSED','CONTEXTUALIZED','CANDIDATE_EXTRACTED','SUBJECT_RESOLVED','RELATION_PARSED','EVIDENCE_ADMITTED','KNOWLEDGE_ADMITTED','STORY_USED','WRITER_USED'] as const;
/** Inspection only. Broad passage cues are NOT recall ground truth, extraction
 * rules, manual Evidence, or inputs to admission. Null means not observed,
 * rather than an invented diagnosis of a coupled parser's internal stage. */
export function buildKnowledgeLossTrace(pack:EvidencePack,a:CuriosityArtifacts,w:CuriosityWriter,session?:Pick<ResearchSession,'searchTrace'|'fetchAttempts'|'fingerprint'>){
 if(pack.researchPlan.policy.contextualMechanisms!==true)throw Error('CONTEXTUAL_TRACE_REQUIRED');
 if(!verifyCuriosityWriter(pack,w,a))throw Error('KNOWLEDGE_LOSS_PROVENANCE_MISMATCH');
 const traces=pack.sources.flatMap(s=>{const doc=contextualDocumentScope(s,pack.researchPlan);return mechanismWindows(s).flatMap(window=>{
  const e=pack.evidence.filter(e=>e.extractionMethod==='MECHANISM_V2'&&e.sourceId===s.id&&e.sourceSpan.start<window.span.end&&e.sourceSpan.end>window.span.start);
  if(!e.length&&!/\b(?:fluid|pressure|heat|cool|flow|rotat|transform|pressao|energia|calor|agua|fluido|comprim|movi|gira|contrapeso|filtra|etapas|funcion)\w*/.test(normalize(window.text)))return[];
  const scope=contextualWindowScope(s,pack.researchPlan,window,doc),safe=!contextualSafetyRefusal(window.text),context=scope.allowed;
  const f=pack.groundedFacts.filter(f=>f.usableForPrimaryClaim&&f.evidenceIds.some(id=>e.some(e=>e.id===id))),r=a.knowledge.relations.filter(r=>r.factIds.some(id=>f.some(f=>f.id===id)));
  const stages:Record<typeof KNOWLEDGE_LOSS_STAGES[number],boolean|null>={DISCOVERED:true,FETCHED:true,PARSED:true,CONTEXTUALIZED:context,CANDIDATE_EXTRACTED:context?e.length>0:null,SUBJECT_RESOLVED:e.length?true:null,RELATION_PARSED:e.length?true:null,EVIDENCE_ADMITTED:e.length?f.length>0:null,KNOWLEDGE_ADMITTED:f.length?r.length>0:null,STORY_USED:r.length?a.story.nodes.some(n=>r.some(r=>r.id===n.relationId)):null,WRITER_USED:r.length?w.sentences.some(n=>n.relationIds.some(id=>r.some(r=>r.id===id))):null};
  const t=normalize(window.text),reason=!context?scope.reason:!safe?'METAPHOR_OR_HISTORY_REFUSAL':!e.length&&negativeMechanism.test(t)?'NEGATION_SAFETY_REFUSAL':!e.length&&unsafeMechanism.test(t)?'UNSAFE_MODALITY_REFUSAL':!e.length&&/[\d=<>%{}]/.test(t)?'QUANTITATIVE_OR_MALFORMED_REFUSAL':!e.length?'COMBINED_SUBJECT_OR_RELATION_PARSER_REFUSAL':!f.length?'EVIDENCE_ADMISSION_FAILURE':!r.length?'KNOWLEDGE_ADMISSION_FAILURE':stages.WRITER_USED===false?'WRITER_SELECTION_OR_LENGTH_LIMIT':'NONE';
  return[{id:'KLT_'+jsonHash({source:s.id,hash:s.contentHash,span:window.span}).slice(0,20),sourceId:s.id,snapshotHash:s.contentHash,locator:s.canonicalLocator,sourceTitle:s.title,...window,stages,firstLoss:KNOWLEDGE_LOSS_STAGES.find(stage=>stages[stage]===false)??null,reason,evidenceIds:e.map(e=>e.id),factIds:f.map(f=>f.id),relationIds:r.map(r=>r.id),review:'UNREVIEWED_POTENTIAL_PASSAGE',observability:'Candidate emission and subject/relation resolution are coupled. For no emitted Evidence, subject/relation stages are UNKNOWN; a specific earlier loss requires reviewed guard/span diagnostics.'}];
 });});
 const stageTotals=Object.fromEntries(KNOWLEDGE_LOSS_STAGES.map(stage=>[stage,{pass:traces.filter(t=>t.stages[stage]===true).length,fail:traces.filter(t=>t.stages[stage]===false).length,unknown:traces.filter(t=>t.stages[stage]===null).length}]));
 const raw={version:'knowledge-loss/1.0.0',packFingerprint:pack.fingerprint,storyFingerprint:a.story.fingerprint,writerFingerprint:w.fingerprint,sessionFingerprint:session?.fingerprint??null,discovery:session?.searchTrace??[],fetches:session?.fetchAttempts??[],emptyAcquisition:pack.sources.length===0?{firstLoss:'DISCOVERED',reason:'NO_ACQUIRED_SOURCES; inspect discovery/fetch diagnostics; no passage can be parsed'}:null,stageTotals,traces,manualEvidence:false,coverageUnit:'PASSAGE_WITH_AT_LEAST_ONE_RELATION; not every clause or all contained knowledge',measurement:'Diagnostic passage coverage; broad cues and reviewed audit windows are not population-level recall truth'};
 return{...raw,fingerprint:jsonHash(raw)};
}
