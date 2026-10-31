import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {runAntiHardcode} from '../phase26/anti-hardcode';
import {benchmarks} from './benchmarks';
const root='out/engine3d/phase28',load=(p:string)=>JSON.parse(readFileSync(root+'/'+p,'utf8')),save=(p:string,x:unknown)=>{mkdirSync(path.dirname(root+'/'+p),{recursive:true});writeFileSync(root+'/'+p,typeof x==='string'?x:JSON.stringify(x,null,2));};
// Finite human-style review of the nine selected tuples and exact source
// spans, performed by Codex. This map is an audit output, never runtime input.
const decisions:Record<string,string>={
 KR_454e59d3584454a94419:'Explicit due-to connector supports the full pressure comparison. The source surface keeps its complete qualifier; no pressure gradient is simulated.',
 KR_6b13bb4c0adc6bbe2fe8:'Explicit flow to the surface. It is not joined to another water subject by a guessed pronoun or promoted into a multi-event chain.',
 KR_8b596a612d78c8e3efa1:'Explicit category of tubular well; no generalization to all wells.',
 KR_587a458ea3376e343aed:'Explicit passive collection through pipes. The normal residential-use condition remains in the sentence, not an unconditional standalone assertion.',
 KR_3ce86e7c5fb60d1c8e65:'List label and relative locative explicitly bind the cabin motion to the named enclosure. Up/down alternatives remain in the source sentence.',
 KR_64fc55514c599cdfe120:'Exact list definition of the enclosure as part of the building. No unsupported physical dimensions or assembly position become facts.',
 KR_e3651b156f033b7c3f5d:'Bounded definition preserves the entire admitted object. The term denotes the bottom of the lift enclosure in this elevator context; not an artesian-well alias.',
 KR_34094f3349a8193b725a:'Designed-to purpose is preserved verbatim, with pressure/kinetic and torque/rotation qualifiers. It is not counted as an actual transformation, cause or state change.',
 KR_f6942ba7c1a53b287deb:'The complete qualified type definition is kept. Same sentence also states purpose; it supplies no extra physical event.'
};
const precision:unknown[]=[],contexts:unknown[]=[],extras:string[]=[];
for(const b of benchmarks){
 const pending=load(b.id+'/precision-review-pending.json'),pack=load(b.id+'/pack.json'),w=load(b.id+'/writer.json'),a=load(b.id+'/artifacts.json'),session=load('research/'+b.id+'.json'),loss=load(b.id+'/loss-trace.json');
 const rows=pending.map((r:{relationId:string})=>{if(!decisions[r.relationId])throw Error('UNREVIEWED_WRITER_RELATION '+r.relationId);return{...r,verdict:'CORRECT',reason:decisions[r.relationId]};});
 save('review/'+b.id+'-precision.json',{benchmark:b.id,reviewer:'Codex; finite exact-source/span review',scope:'Every selected Writer relation, including the ineligible third candidate; not a corpus-wide precision estimate',writerEligible:w.eligible,correct:rows.length,questionable:0,wrong:0,newRelations:rows.filter((r:{newRelation:boolean})=>r.newRelation).length,rows});precision.push({id:b.id,correct:rows.length,questionable:0,wrong:0,writerEligible:w.eligible});
 const initial=new Set(session.progressive.historicalInitial.sourceIds),newIds=pack.sources.filter((s:{id:string})=>!initial.has(s.id)).map((s:{id:string})=>s.id);
 for(const id of newIds){const s=pack.sources.find((s:{id:string})=>s.id===id),ts=loss.traces.filter((t:{sourceId:string})=>t.sourceId===id),reasonCounts=Object.fromEntries([...new Set(ts.map((t:{reason:string})=>t.reason))].map(reason=>[String(reason),ts.filter((t:{reason:string})=>t.reason===reason).length]));contexts.push({benchmark:b.id,sourceId:id,title:s.title,url:s.canonicalLocator,hash:s.contentHash,characters:s.normalized.text.length,emittedMechanismEvidence:pack.evidence.filter((e:{sourceId:string;extractionMethod:string})=>e.sourceId===id&&e.extractionMethod==='MECHANISM_V2').length,admittedRelations:a.knowledge.relations.filter((r:{proof:{sourceId:string}[]})=>r.proof.some(p=>p.sourceId===id)).length,diagnosticPassages:ts.length,reasonCounts,samples:ts.slice(0,4).map((t:{text:string;reason:string;stages:unknown})=>({text:t.text.slice(0,320),reason:t.reason,stages:t.stages}))});}
 extras.push(...session.acceptedSources.map((s:{canonicalLocator:string})=>s.canonicalLocator),...w.sentences.filter((s:{kind:string})=>s.kind==='FACT').map((s:{text:string})=>s.text));
 const needSummary=loss.needTraces.map((n:{role:string;status:string;firstLoss:string|null;queryIds:string[];sourceCandidates:string[];candidateEvidenceIds:string[];admittedRelationIds:string[];writerRelationIds:string[];visualBeatIds:string[]})=>({role:n.role,status:n.status,firstLoss:n.firstLoss,queries:n.queryIds.length,results:n.sourceCandidates.length,candidates:n.candidateEvidenceIds.length,admitted:n.admittedRelationIds.length,writer:n.writerRelationIds.length,visual:n.visualBeatIds.length}));save('analysis/'+b.id+'-need-summary.json',needSummary);
}
save('review/precision-summary.json',{reviewed:precision.reduce((n:number,r:any)=>n+r.correct,0),questionable:0,writerUsedWrong:0,byBenchmark:precision,manualReview:true,manualEvidence:false});
save('analysis/new-source-diagnostics.json',contexts);
const anti=runAntiHardcode(root+'/analysis/anti-hardcode.json',extras);if(!anti.passed)throw Error('ANTI_HARDCODE');console.log(JSON.stringify({precision,anti:{passed:anti.passed,files:anti.scannedFiles,blockers:anti.blockers.length},newSources:contexts}));
