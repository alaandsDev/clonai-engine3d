import {jsonHash} from '../editorial/fingerprint';
import type {PlannerInput} from './contracts';
/** Adapter from the Phase26 CAUSAL_CURIOSITY_PROCESS Writer result (script, sentence ledger,
 * typed semantic handoff) to planner input. It checks the writer's own fingerprint and that
 * the writer is narrative-eligible; it adds nothing to the relations. */
export interface CuriosityWriterLike {
 status:string;eligible:boolean;script:string;storyFingerprint:string;fingerprint:string;
 sentences:{id:string;kind:'FACT'|'EDITORIAL';text:string;relationIds:string[];roles:string[]}[];
 handoff:{scriptFingerprint:string;relations:{id:string;subject:string;predicate:string;object:string;visualHints:string[];proof:{evidenceId:string}[];storyNodeIds:string[];sentenceIds:string[]}[];progression?:PlannerInput['groundedStory']};
}
export function plannerInputFromCuriosity(topic:string,w:CuriosityWriterLike,timing:{sentenceId:string;startFrame:number;endFrame:number}[],fps:number,environmentId?:string,options?:{allowGroundedPreview?:boolean}):PlannerInput{
 const {fingerprint,...raw}=w;if(jsonHash(raw)!==fingerprint)throw Error('VISUAL_INPUT writer fingerprint mismatch');
 const limited=!w.eligible||w.status!=='SCRIPT_GROUNDED';
 if(limited&&(!options?.allowGroundedPreview||!w.handoff.progression||!w.handoff.relations.length||!w.sentences.some(s=>s.kind==='FACT')||w.handoff.relations.some(r=>!r.proof.length)))throw Error('VISUAL_INPUT writer is not narrative-eligible: '+w.status);
 if(w.sentences.map(s=>s.text).join('\n')!==w.script)throw Error('VISUAL_INPUT sentence ledger does not rebuild the script');
 const relations=w.handoff.relations.map(r=>({id:r.id,subject:r.subject,predicate:r.predicate,object:r.object,visualHints:[...r.visualHints],evidenceIds:[...new Set(r.proof.map(p=>p.evidenceId))].sort(),storyNodeIds:[...r.storyNodeIds],sentenceIds:[...r.sentenceIds]}));
 if(w.handoff.progression){const{fingerprint,...body}=w.handoff.progression;if(jsonHash(body)!==fingerprint||body.factualEdgesAdded!==0)throw Error('VISUAL_INPUT progression fingerprint');for(const state of body.states){const r=relations.find(r=>r.id===state.relationId);if(!r||state.before.status!=='UNKNOWN'||state.after.description!==[r.subject,r.predicate,r.object].join(' ')||state.evidenceIds.some(id=>!r.evidenceIds.includes(id)))throw Error('VISUAL_INPUT ungrounded semantic state');}}
 return{topic,script:w.script,scriptFingerprint:w.handoff.scriptFingerprint,storyFingerprint:w.storyFingerprint,sentences:w.sentences.map(s=>({id:s.id,kind:s.kind,text:s.text,relationIds:[...s.relationIds],roles:[...s.roles]})),relations,timing,fps,totalFrames:timing.at(-1)!.endFrame,...(environmentId?{environmentId}:{}),...(w.handoff.progression?{groundedStory:structuredClone(w.handoff.progression)}:{}),...(limited?{previewOnly:true as const}:{})};
}
