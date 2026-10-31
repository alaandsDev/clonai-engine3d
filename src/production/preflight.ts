import {jsonHash} from '../editorial/fingerprint';
import type {PlannerInput,VisualCausalPlan} from '../visual-causal/contracts';
import type {DirectedSequence} from '../engine3d/directed';
import type {visualQa} from '../visual-causal/qa';
import {validateDirected} from '../engine3d/directed';
import {spatialViolations} from '../visual-causal/demonstration-execution';
import {validateVisualPlan} from '../visual-causal/verify';
import {PRODUCTION_PROFILE,profileFingerprint} from './profile';
import {hybridEditorialQa} from '../visual-causal/editorial-qa';
export {PRODUCTION_PROFILE} from './profile';
export type Finding={severity:'BLOCKER'|'WARNING'|'INFO';category:string;code:string;message:string;evidence:unknown};
export interface PreflightInput {input:PlannerInput;plan:VisualCausalPlan;sequence:DirectedSequence;qa:ReturnType<typeof visualQa>;dependencyIssues?:string[]}
/** Pure decision layer. It consumes existing checks, never changes a plan or supplies facts. */
export function productionPreflight({input,plan,sequence,qa,dependencyIssues=[]}:PreflightInput){
 const findings:Finding[]=[];
 const hybridEditorial=hybridEditorialQa(input,plan,sequence);
 findings.push(...hybridEditorial.findings);
 const add=(severity:Finding['severity'],category:string,code:string,message:string,evidence:unknown)=>findings.push({severity,category,code,message,evidence});
 try{validateDirected(sequence);}catch(e){add('BLOCKER','TECHNICAL','INVALID_OUTPUT_PLAN','Sequence cannot execute',String(e));}
 const spatial=spatialViolations(plan);if(spatial.length)add('BLOCKER','SPATIAL_MODEL','SPATIAL_CONTRADICTION','Declared spatial relations conflict with layout',spatial);
 const val=validateVisualPlan(plan,input.relations.map(r=>r.id));
 if(!val.valid)add('BLOCKER','TRUTH','INVALID_VISUAL_PLAN','Invalid provenance or plan structure',val.issues);
 if(input.previewOnly||plan.previewOnly)add('BLOCKER','TRUTH','PREVIEW_ONLY','Preview-only input cannot authorize production',true);
 const invented=plan.beats.flatMap(b=>b.relationIds.filter(id=>!input.relations.some(r=>r.id===id)));
 if(invented.length)add('BLOCKER','TRUTH','UNSUPPORTED_RELATION','Visual relation lacks script or evidence binding',invented);
 for(const r of input.relations){
  if(r.source==='USER_SCRIPT'?!r.scriptSpans?.length:!r.evidenceIds.length)add('BLOCKER','TRUTH','RELATION_SUPPORT_MISSING','Relation lacks script spans or evidence references',r.id);
 }
 const admitted=(input.scriptUnderstanding?.mechanism??[]).filter(m=>!m.negated&&m.modality!=='POSSIBLE');
 for(const m of admitted){const ex=plan.mechanismExecution;const carried=ex?.carriers.some(c=>c.relationId===m.id&&plan.world.entities.some(e=>e.entityId===c.entityId));const executed=plan.beats.some(b=>b.relationIds.includes(m.id)&&b.grounding==='FACTUAL_DEMONSTRATION'&&b.operations.some(o=>!['HIGHLIGHT','REVEAL','HIDE'].includes(o.operation)&&sequence.demonstration?.subjects.some(s=>s.id===o.target)&&(o.observed==='INITIAL_STATE'||sequence.demonstration?.steps.some(s=>s.target===o.target&&s.operation===o.operation))));if(!carried&&!ex?.coveredByClaims.includes(m.id)&&!executed)add('BLOCKER','DEMONSTRATION','CENTRAL_MECHANISM_UNCARRIED','Admitted mechanism has no carrier or executed-claim binding',m.id);}
 const required=plan.mechanismParticipants??[];
 for(const p of required){const missing=p.participants.filter(x=>!p.drawn.includes(x));if(missing.length)add('BLOCKER','DEMONSTRATION','CAUSAL_PARTICIPANT_MISSING','Required mechanism participants absent',{relationId:p.relationId,missing});}
 for(const g of plan.mechanismExecution?.gaps??[])add('BLOCKER','DEMONSTRATION','MECHANISM_GAP','Required mechanism has no executable carrier',g);
 for(const [name,gate] of Object.entries(qa.demonstrationQa?.gates??{}))if(gate.status==='FAIL')add(PRODUCTION_PROFILE.gates[name as keyof typeof PRODUCTION_PROFILE.gates]??'WARNING','DEMONSTRATION',name,'Demonstration QA reported a failed gate',gate);
 if(qa.causalCamera?.fails.length)add('BLOCKER','CAMERA','CAUSAL_CAMERA_FAILURE','Required causal action is not visible',qa.causalCamera.fails);
 if((qa.causalCamera?.cameraCollisionCount??0)>0)add('BLOCKER','CAMERA','CAMERA_COLLISION','Camera enters a structural obstacle',qa.causalCamera?.cameraCollisionCount);
 if(qa.continuityIssues.length)add('BLOCKER','SPATIAL_MODEL','CONTINUITY_FAILURE','Persistent world continuity failed',qa.continuityIssues);
 if(!plan.world.entities.some(e=>e.role==='MAIN_SYSTEM')&&!plan.world.entities.some(e=>e.entityId===plan.spatialMap?.object))add('BLOCKER','SYSTEM_IDENTITY','MAIN_SYSTEM_UNRESOLVED','No bound main system',null);
 for(const g of plan.gaps)add('WARNING','TRUTH','VISUAL_GAP','Relation has an unrepresented visual gap',g);
 for(const [name,status] of Object.entries(qa.dims))if(status==='FAIL'||status==='PARTIAL')add('WARNING','VISUAL_QA',name,'Visual QA requires review',status);
 if(!plan.context?.category)add('WARNING','WORLD','CONTEXT_FALLBACK','Context choice is generic or not classified',plan.context??null);
 if(sequence.width!==PRODUCTION_PROFILE.output.width||sequence.height!==PRODUCTION_PROFILE.output.height||sequence.fps!==PRODUCTION_PROFILE.output.fps)add('BLOCKER','OUTPUT','NON_SHORTS_RESOLUTION','Current plan differs from 1080×1920 Shorts target',{width:sequence.width,height:sequence.height});
 for(const issue of dependencyIssues)add('BLOCKER','TECHNICAL','DEPENDENCY_UNAVAILABLE',issue,issue);
 add('INFO','AUDIO','POST_RENDER_CHECKS_PENDING','Codec, actual mix, clipping and decoded output require post-render validation',null);
 add('WARNING','QA','HUMAN_REVIEW_REQUIRED','Recognizability and silent comprehension are estimates, not perceptual certification',null);
 const factual=plan.beats.filter(b=>b.grounding==='FACTUAL_DEMONSTRATION');
 if(!qa.demonstrationQa||!qa.causalCamera)add('BLOCKER','QA','REQUIRED_QA_MISSING','Specialized QA absent',null);
 if(input.relations.length&&!factual.length)add('BLOCKER','DEMONSTRATION','NO_FACTUAL_DEMONSTRATION','Input relations have no factual beats',input.relations.map(r=>r.id));
 for(const d of plan.demonstrations??[])if(d.support==='UNSUPPORTED'&&d.observable!=='NONE')add('BLOCKER','TRUTH','UNSUPPORTED_VISUAL_MECHANISM','Unsupported required observable',d);
 for(const g of plan.gaps)if(input.scriptUnderstanding?.actions.some(a=>a.claimId===g.relationId&&!['IDENTIFY','NAME_ONLY','HIGHLIGHT_CAUSE'].includes(a.action)))add('BLOCKER','DEMONSTRATION','REQUIRED_RELATION_GAP','An asserted physical action lacks a visual carrier',g);
 for(const t of plan.transitions)if(t.grounding==='GROUNDED'&&t.evidenceRelationId&&!input.relations.some(r=>r.id===t.evidenceRelationId))add('BLOCKER','TRUTH','UNSUPPORTED_TRANSITION','State change lacks admitted relation',t);
 if(qa.semanticSync?.p90Ms!==null&&qa.semanticSync?.p90Ms>PRODUCTION_PROFILE.thresholds.syncWarningMs)add('WARNING','SYNC','PREDICATE_ONSET_OFFSET','Estimated action-onset offset exceeds editorial tolerance',qa.semanticSync);
 if((qa.meaningfulStasis?.longestMeaningfulStasis??0)>PRODUCTION_PROFILE.thresholds.stasisWarningSeconds)add('WARNING','PACING','MEANINGFUL_STASIS','No measured physical change for an extended interval; review intentional holds',qa.meaningfulStasis);
 if((qa.spatial?.endingStaticSeconds??0)>PRODUCTION_PROFILE.thresholds.endingStaticWarningSeconds)add('WARNING','ENDING','STATIC_ENDING','Ending has no measured intentional action or camera move',qa.spatial?.endingStaticSeconds);
 if(sequence.captions.some(c=>c.text.split(/\s+/).length>PRODUCTION_PROFILE.thresholds.captionWordsWarning))add('WARNING','CAPTIONS','DENSE_CAPTION','Caption exceeds short phrase target',null);
 if(sequence.captions.some(c=>c.startFrame<0||c.endFrame>sequence.totalFrames||c.endFrame<=c.startFrame))add('BLOCKER','CAPTIONS','INVALID_CAPTION_TIMING','Caption timeline invalid',null);
 add('INFO','STORY','STORY_REVIEW','Question/reveal, callback and hook quality remain semantic/editorial review; no facts added',input.sentences.filter(s=>s.roles.some(r=>r==='QUESTION'||r==='PAYOFF')).map(s=>s.id));
 const categories=Object.fromEntries(PRODUCTION_PROFILE.sections.map(category=>[category,findings.some(f=>f.category===category&&f.severity==='BLOCKER')?'BLOCKED':findings.some(f=>f.category===category&&f.severity==='WARNING')?'WARNING':'NO_BLOCKER_DETECTED']));
 const blockers=findings.filter(f=>f.severity==='BLOCKER'),warnings=findings.filter(f=>f.severity==='WARNING');
 return{version:1,stage:'PRODUCTION_PREFLIGHT',hybridEditorial,categories,profile:PRODUCTION_PROFILE.id,profileFingerprint:profileFingerprint(),policy:PRODUCTION_PROFILE.policy,planFingerprint:plan.fingerprint,sequenceFingerprint:jsonHash(sequence),scriptFingerprint:input.scriptFingerprint,productionReady:blockers.length===0,decision:blockers.length?'RENDER BLOCKED':'RENDER ALLOWED',findings,blockers,warnings};
}
export function preflightText(r:ReturnType<typeof productionPreflight>){return ['CLONAI PRODUCTION PREFLIGHT','PROFILE: '+r.profile,'PRODUCTION_READY: '+(r.productionReady?'YES':'NO'),r.decision,...r.findings.map(f=>`${f.severity} ${f.category} ${f.code}: ${f.message}`)].join('\n')+'\n';}
