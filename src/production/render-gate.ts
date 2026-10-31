import type {productionPreflight} from './preflight';
import {jsonHash} from '../editorial/fingerprint';
import type {DirectedSequence} from '../engine3d/directed';
/** Single production authorization boundary; persist decision before any renderer call. No replanning. */
export async function productionRenderGate<T>(report:ReturnType<typeof productionPreflight>,sequence:DirectedSequence,persist:(report:ReturnType<typeof productionPreflight>)=>void|Promise<void>,renderer:()=>Promise<T>){
 const changed=report.sequenceFingerprint!==jsonHash(sequence);
 const finding={severity:'BLOCKER' as const,category:'TECHNICAL',code:'SEQUENCE_CHANGED',message:'Sequence changed after preflight; re-evaluation required',evidence:null};
 const decision=changed?{...report,productionReady:false,decision:'RENDER BLOCKED',findings:[...report.findings,finding],blockers:[...report.blockers,finding]}:report;
 await persist(decision);
 if(!decision.productionReady||decision.blockers.length)return{status:'BLOCKED' as const,result:null};
 return{status:'RENDERED' as const,result:await renderer()};
}
