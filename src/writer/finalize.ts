import {preflightCandidate} from './preflight';
import {validateWriterResult} from './qa';
import {jsonHash} from '../editorial/fingerprint';
import type {WriterResult,ScriptCandidate,Revision} from './contracts';
export function finalizeWriter(result:WriterResult,candidate:ScriptCandidate,measuredDurations:{unitId:string;durationSeconds:number}[],revisions:Revision[]=[]){
 validateWriterResult(result);if(!result.finalCandidate||candidate.id!==result.selection.selectedCandidateId)throw Error('WRITER_FINAL selected candidate required');
 if(result.revisionHistory.filter(r=>r.candidateId===candidate.id).length+revisions.length>result.policy.maxRevisions)throw Error('WRITER_FINAL revision budget');
 const p=preflightCandidate(result.request,candidate,result.capabilityProfile,measuredDurations),ids=p.graph.analysis.narrativeUnits.map(u=>u.id);if(measuredDurations.length!==ids.length||new Set(measuredDurations.map(t=>t.unitId)).size!==ids.length||measuredDurations.some(t=>!ids.includes(t.unitId)||!Number.isFinite(t.durationSeconds)||t.durationSeconds<=0))throw Error('WRITER_FINAL complete measured unit timing required');
 const duration=p.plan.totalFrames/p.plan.fps,target=result.request.targetDurationSeconds??{min:40,max:60},durationPassed=duration>=target.min&&duration<=target.max;
 const raw={version:'writer-finalization/1.0.0',writerResultFingerprint:result.fingerprint,capabilityFingerprint:result.capabilityProfile.fingerprint,selectedCandidateId:candidate.id,finalCandidate:candidate,finalPreflight:p,measuredDurations,durationSeconds:duration,durationPassed,revisionHistory:[...result.revisionHistory,...revisions],productionReady:p.plan.productionReady&&p.acceptance==='ACCEPTABLE_CANDIDATE'&&durationPassed};return{...raw,fingerprint:jsonHash(raw)};
}
