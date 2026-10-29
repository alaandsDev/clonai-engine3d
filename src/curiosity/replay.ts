import {jsonHash} from '../editorial/fingerprint';
import {validateSnapshot} from '../research/web/cache';
import type {ResearchSession} from '../research/web/contracts';
/** Acquisition boundary for offline reprocessing. A re-signed source still
 * needs its exact acquired snapshot. Derived knowledge must be replayed too. */
export function verifyProcessAcquisition(session:ResearchSession){
 const{fingerprint,...raw}=session;
 if(jsonHash(raw)!==fingerprint)throw Error('SESSION_INTEGRITY');
 for(const attempt of session.fetchAttempts)if(attempt.snapshot)validateSnapshot(attempt.snapshot);
 for(const source of session.acceptedSources){
  if(!session.fetchAttempts.some(a=>a.snapshot?.contentHash===source.contentHash&&a.snapshot.content===source.content&&a.finalUrl===source.canonicalLocator))throw Error('SNAPSHOT_SOURCE_MISMATCH');
 }
 return{sessionFingerprint:fingerprint,sources:session.acceptedSources.map(s=>({id:s.id,snapshotHash:s.contentHash,locator:s.canonicalLocator})),verified:true};
}
