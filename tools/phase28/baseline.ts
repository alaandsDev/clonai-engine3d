import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {buildEvidencePack} from '../../src/research';
import {buildCuriosityStoryPlan} from '../../src/curiosity/story';
import {writeCausalCuriosity} from '../../src/writer/curiosity';
import {verifyProcessAcquisition} from '../../src/curiosity/replay';
import {plannerInputFromCuriosity,planVisualCausal,compileVisualPlan,visualQa,validateVisualPlan} from '../../src/visual-causal';
import {benchmarks} from './benchmarks';
const root='out/engine3d/phase28',load=(p:string)=>JSON.parse(readFileSync(p,'utf8')),save=(p:string,v:unknown)=>{const f=root+'/'+p;mkdirSync(path.dirname(f),{recursive:true});writeFileSync(f,typeof v==='string'?v:JSON.stringify(v,null,2));};
const git=(...a:string[])=>execFileSync('git',a,{encoding:'utf8'}).trim(),sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
if(git('rev-parse','HEAD')!=='3290fb2756013d0dfc9d69f6dbff701634bba31d'||git('branch','--show-current')!=='main')throw Error('BASE_CHECKPOINT');
const histories=['CLONAI_HANDOFF.md','PHASE25_REPORT.md','PHASE26_REPORT.md','PHASE27_REPORT.md','PHASE27B_REPORT.md','package-lock.json','out/engine3d/phase27b/final/phase27b-well-final.mp4','out/engine3d/phase27/final/phase27-well-final.mp4'];
save('baseline/integrity.json',{head:git('rev-parse','HEAD'),branch:'main',initialWorkingTree:'CLEAN (verified before adding baseline operator)',hashes:Object.fromEntries(histories.map(p=>[p,sha(p)])),registry:{engine3d:load('out/engine3d/catalog.json').length,sfx:load('examples/sound/media-registry.json').assets.length,visual:load('examples/visual/media-registry.json').assets.length}});
save('baseline/architecture-audit.md',`# Phase28 — architecture audit before behaviour changes

REUSE: Research v4, SecureHttpClient, WebSourceProvider, source normalization, EvidencePack/FactCandidate/SourceSpan, quorum/origin/security, MechanismKnowledge/CausalConstructionGraph, SemanticNarrativeGraph/NarrativeClaim, Topic Intelligence, existing VisualCausalPlanner/compile/media/QA and 50/8/5 registry.
EXTEND: processResearchGaps/processQueries with pre-query StoryNeed provenance and bounded stop conditions; buildCuriosityStoryPlan with grounded progression indices; writeCausalCuriosity with ordered support and safe low-density compression; existing visual input/planner with typed story-role handoff.
CREATE: small pure StoryNeed/progression helpers only where the current gap model lacks roles/state continuity. They index admitted relation IDs and never constitute another factual graph, Writer, Research engine, scraper or Visual Planner.
Source text remains data. No Research v5, models, paid dependencies, assets, camera/terrain/presenter/material polish. Preserve old opt-in absent behaviour and historical hashes.
Third input: hydraulic turbine, selected from the historical admitted process corpus and its physical workflow, with a recorded acquisition baseline. Same generic runtime as the primary and secondary; no domain fixtures in runtime.
Baseline is rebuilt offline from verified historical acquisition; those sources are labelled historical, not newly discovered in Phase28. New gap research will be recorded separately, with queries linked before execution.
`);
for(const b of benchmarks){
 const old='out/engine3d/phase26',sessionPath=old+'/research/'+(['A','B'].includes(b.legacy)?'live-final-':'live-')+b.legacy+'.json',session=load(sessionPath);verifyProcessAcquisition(session);
 const expected=load(old+'/phase26b/attempts/final/evidence/'+b.legacy+'.json'),pack=buildEvidencePack(expected.researchPlan.request,{version:1,id:'phase28-baseline',fixture:false,labels:['REAL_WEB_SNAPSHOTS','SESSION_CANDIDATES_ONLY'],sources:session.acceptedSources});
 if(pack.fingerprint!==expected.fingerprint)throw Error('BASELINE_PROCESSING_MISMATCH '+b.id);
 const a=buildCuriosityStoryPlan(pack),w=writeCausalCuriosity(pack);let at=0;const timing=w.sentences.map(s=>{const n=Math.max(12,Math.ceil(s.text.split(/\s+/).length/2.6*30));const t={sentenceId:s.id,startFrame:at,endFrame:at+n};at+=n;return t;});
 const input=plannerInputFromCuriosity(b.topic,w,timing,30),plan=planVisualCausal(input),validation=validateVisualPlan(plan,input.relations.map(r=>r.id));const seq=validation.valid?compileVisualPlan(plan,{sentences:timing.map(t=>({...t,id:t.sentenceId,text:w.sentences.find(s=>s.id===t.sentenceId)!.text}))}):null,qa=seq?visualQa(plan,seq):null;
 save('baseline/'+b.id+'/pack.json',pack);save('baseline/'+b.id+'/artifacts.json',a);save('baseline/'+b.id+'/writer.json',w);save('baseline/'+b.id+'/visual-plan.json',plan);
 const r={id:b.id,topic:b.topic,sessionPath,sessionFingerprint:session.fingerprint,mode:'HISTORICAL_SNAPSHOT_REPLAY',...a.knowledge.metrics,connectivity:a.story.connectivity,potential:a.story.potential.rating,writerEligible:w.eligible,words:w.metrics.words,visualValidation:validation,visualizableBeats:plan.beats.filter(b=>b.proof&&['DIRECT','PARTIAL'].includes(b.proof.level)).length,estimatedStasis:qa?.longestMeaningfulStasisSeconds??null,estimatedTiming:true};save('baseline/'+b.id+'/metrics.json',r);console.log(JSON.stringify({id:b.id,relations:r.uniqueRelations,physical:r.physicalClaims,words:r.words,stasis:r.estimatedStasis,visualValid:validation.valid}));
}
