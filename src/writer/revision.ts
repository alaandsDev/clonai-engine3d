import {assembleCandidate} from './realizer';
import type {TopicScriptRequest,ScriptCandidate,CandidatePreflight,Revision} from './contracts';
import {writerPolicy} from './request';
export function reviseCandidate(request:TopicScriptRequest,c:ScriptCandidate,p:CandidatePreflight,iteration:number):{candidate:ScriptCandidate;revision:Revision|null} {
 if(iteration>writerPolicy(request).maxRevisions||p.acceptance==='ACCEPTABLE_CANDIDATE')return{candidate:c,revision:null};
 const affected=c.utterances.filter(u=>p.plan.localizedGaps.some(g=>g.sourceSpan.start<u.sourceSpan.end&&u.sourceSpan.start<g.sourceSpan.end));
 const surface=affected.find(u=>u.text!==u.canonicalText),context=affected.find(u=>u.permission.kind==='EDITORIAL');
 if(!surface&&!context)return{candidate:c,revision:null};
 const chosen=surface??context!,operation=surface?'MAKE_SUBJECT_EXPLICIT':'REMOVE_UNSUPPORTED_CLAUSE';
 const us=c.utterances.filter(u=>surface||u!==chosen).map(u=>{const{sourceSpan,...rest}=u;return{...rest,text:u===surface?u.canonicalText:u.text};});
 const {script,utterances,fingerprint,...base}=c;const candidate=assembleCandidate(base,us);
 return{candidate,revision:{candidateId:c.id,iteration,operation,before:c.script,after:candidate.script,reason:surface?'Real localized semantic gap in a generated surface; restore the licensed canonical realization':'Actual semantic preflight classified neutral context as unsupported; remove only editorial context',affectedGapIds:p.plan.localizedGaps.filter(g=>g.sourceSpan.start<chosen.sourceSpan.end&&chosen.sourceSpan.start<g.sourceSpan.end).map(g=>g.id),semanticImpact:surface?'Retains authorized operation and participant; no source fact or topic is replaced':'No licensed physical/source fact omitted; neutral context only',provenance:[chosen.permission],beforeFingerprint:c.fingerprint,afterFingerprint:candidate.fingerprint}};
}
