import {jsonHash} from '../editorial/fingerprint';
import type {VerticalSliceAttempt} from './trace';
/** Phase 25 provenance: the chain of fingerprints from the typed topic to the MP4 bytes.
 * Each link names the artifact that produced the next one; the chain fingerprint
 * changes if any link is altered, so a re-signed chain is checked against artifacts. */
export const PROVENANCE_LINKS=['topic','topicPlan','researchSession','evidencePack','writer','script','semanticGraph','narrativePlan','compiled','sequence','renderInput','mp4Sha256'] as const;
export type ProvenanceLink=typeof PROVENANCE_LINKS[number];
export interface VerticalSliceProvenance {version:'vertical-slice-provenance/1.0.0';links:Record<ProvenanceLink,string>;researchMode:'LIVE'|'REPROCESSED_RECORDED_SESSION'|'FIXTURE';manualInputs:[];fingerprint:string}
export function buildProvenance(links:Record<ProvenanceLink,string>,researchMode:VerticalSliceProvenance['researchMode']):VerticalSliceProvenance{
 for(const k of PROVENANCE_LINKS)if(typeof links[k]!=='string'||!links[k])throw Error('PROVENANCE_LINK_MISSING '+k);
 const raw={version:'vertical-slice-provenance/1.0.0' as const,links:Object.fromEntries(PROVENANCE_LINKS.map(k=>[k,links[k]])) as Record<ProvenanceLink,string>,researchMode,manualInputs:[] as []};
 return{...raw,fingerprint:jsonHash(raw)};
}
/** Valid only if the chain is intact AND every link equals the recomputed artifact value. */
export function verifyProvenance(p:VerticalSliceProvenance,recomputed:Partial<Record<ProvenanceLink,string>>){
 const{fingerprint,...raw}=p,issues:string[]=[];if(jsonHash(raw)!==fingerprint)issues.push('CHAIN_FINGERPRINT');
 if(p.manualInputs.length)issues.push('MANUAL_INPUTS');
 for(const [k,v] of Object.entries(recomputed))if(v!==p.links[k as ProvenanceLink])issues.push('LINK_MISMATCH:'+k);
 return{valid:!issues.length,issues};
}
/** Attempt log validation: consecutive numbering; every attempt but the last names the change made after it. */
export function validateAttempts(attempts:VerticalSliceAttempt[]){
 const issues:string[]=[];attempts.forEach((a,i)=>{if(a.attemptNumber!==i+1)issues.push('NUMBERING:'+i);if(i<attempts.length-1&&(!a.changeIntroduced||!a.whyGeneralizable))issues.push('CHANGE_UNDOCUMENTED:'+a.attemptNumber);if(a.blockingStage&&!a.blockingReason)issues.push('REASON_MISSING:'+a.attemptNumber);});
 return{valid:!issues.length,issues};
}
