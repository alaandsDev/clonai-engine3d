import {jsonHash} from '../editorial/fingerprint';
import type {DirectedSequence} from '../engine3d/directed';
import type {PlannerInput,VisualCausalPlan} from './contracts';
/** Visual provenance: every factual beat lists its relation and evidence IDs (which must exist in the
 * input relations), every editorial beat lists its classification, and the chain links the Phase26
 * script/story to the plan, the compiled sequence and (when rendered) the MP4 bytes. */
export function visualProvenance(input:PlannerInput,plan:VisualCausalPlan,seq:DirectedSequence,mp4Sha256:string|null){
 const rel=new Map(input.relations.map(r=>[r.id,r]));
 const beats=plan.beats.map(b=>b.grounding==='FACTUAL_DEMONSTRATION'
  ?{beatId:b.id,grounding:b.grounding,sentenceId:b.sentenceId,relationIds:b.relationIds,evidenceIds:b.evidenceIds,proof:b.proof?.level??null,complete:b.relationIds.length>0&&b.relationIds.every(r=>rel.has(r))&&b.evidenceIds.length>0&&b.evidenceIds.every(e=>b.relationIds.some(r=>rel.get(r)!.evidenceIds.includes(e)))}
  :{beatId:b.id,grounding:b.grounding,sentenceId:b.sentenceId,relationIds:[],evidenceIds:[],proof:null,complete:b.relationIds.length===0&&!b.proof});
 const chain={topic:jsonHash(input.topic),script:input.scriptFingerprint,story:input.storyFingerprint,relations:plan.relationsFingerprint,plan:plan.fingerprint,sequence:jsonHash(seq),mp4Sha256};
 const raw={version:'visual-provenance/1.0.0',chain,beats,factualBeatProvenanceRate:beats.filter(b=>b.grounding==='FACTUAL_DEMONSTRATION').length?beats.filter(b=>b.grounding==='FACTUAL_DEMONSTRATION'&&b.complete).length/beats.filter(b=>b.grounding==='FACTUAL_DEMONSTRATION').length:1,editorialClassified:beats.filter(b=>b.grounding!=='FACTUAL_DEMONSTRATION').every(b=>b.complete),manualInputs:[] as string[]};
 return{...raw,fingerprint:jsonHash(raw)};
}
export function verifyVisualProvenance(p:ReturnType<typeof visualProvenance>,input:PlannerInput,plan:VisualCausalPlan,seq:DirectedSequence,mp4Sha256:string|null){
 return jsonHash(visualProvenance(input,plan,seq,mp4Sha256))===jsonHash(p);
}
