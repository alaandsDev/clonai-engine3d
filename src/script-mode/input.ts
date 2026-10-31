import type {PlannerInput} from '../visual-causal/contracts';
import type {ScriptUnderstanding} from './contracts';
/** Convergence point: an understood user script becomes the same PlannerInput an Evidence-backed
 * story produces. Relations are SCRIPT_ASSERTED claims with source USER_SCRIPT and script spans;
 * evidenceIds stay empty (no fabricated Evidence). Questions and editorial lines carry no relation. */
export function plannerInputFromScript(u:ScriptUnderstanding,timing:{sentenceId:string;startFrame:number;endFrame:number}[],fps:number,environmentId?:string):PlannerInput{
 const asserted=u.claims.filter(c=>c.status==='SCRIPT_ASSERTED');
 const relations=asserted.map(c=>({id:c.id,subject:c.subject.text,predicate:c.predicate,object:c.args.map(a=>a.span.text).join(' | '),visualHints:[],evidenceIds:[],storyNodeIds:[],sentenceIds:[c.segmentId],source:'USER_SCRIPT' as const,scriptSpans:[c.subject,c.trigger,...c.args.filter(a=>a.role!=='STATE').map(a=>a.span)].map(s=>({start:s.start,end:s.end}))}));
 // Admitted mechanism relations (not negated, not merely possible) are script relations with their own spans.
 const mech=(u.mechanism??[]).filter(m=>!m.negated&&m.modality!=='POSSIBLE');
 relations.push(...mech.map(m=>({id:m.id,subject:m.subject?.text??'',predicate:m.type+':'+m.lemma,object:[m.object,m.quantity,m.source,m.path,m.destination].filter(Boolean).map(x=>x!.text).join(' | '),visualHints:[],evidenceIds:[],storyNodeIds:[],sentenceIds:[m.sentenceId],source:'USER_SCRIPT' as const,scriptSpans:[m.span]})) as typeof relations);
 const sentences=u.segments.map(s=>{const rel=[...s.claimIds.filter(id=>asserted.some(c=>c.id===id)),...mech.filter(m=>m.sentenceId===s.id).map(m=>m.id)];return{id:s.id,kind:(rel.length?'FACT':'EDITORIAL') as 'FACT'|'EDITORIAL',text:s.span.text,relationIds:rel,roles:[s.role,...s.discourse]};});
 if(timing.length!==sentences.length||timing.some((t,i)=>t.sentenceId!==sentences[i].id))throw Error('SCRIPT_INPUT timing must cover every segment in order');
 const main=u.entities.find(e=>e.id===u.mainSubjectId);
 return{topic:'USER_SCRIPT:'+(main?.label??u.segments[0].span.text.slice(0,60)),script:u.source.normalized,scriptFingerprint:u.source.fingerprint,storyFingerprint:u.fingerprint,sentences,relations,timing,fps,totalFrames:timing.at(-1)!.endFrame,...(environmentId?{environmentId}:{}),scriptUnderstanding:u};
}
