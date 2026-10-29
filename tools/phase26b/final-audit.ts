import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {buildKnowledgeLossTrace} from '../../src/curiosity/knowledge-loss';
import {runAntiHardcode} from '../phase26/anti-hardcode';
const root='out/engine3d/phase26',out=root+'/phase26b',final=out+'/attempts/final',load=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const save=(p:string,x:unknown)=>{mkdirSync(path.dirname(out+'/'+p),{recursive:true});writeFileSync(out+'/'+p,JSON.stringify(x,null,2));};
const reviewed=load(root+'/phase26b-baseline/reviewed-loss-trace.json'),comparison:any[]=[],targets:string[]=[];
for(const id of 'ABCDEFGH'){
 const pack=load(final+'/evidence/'+id+'.json'),a=load(final+'/artifacts/'+id+'.json'),w=load(final+'/writer/'+id+'.json'),s=load(root+'/research/'+(['A','B'].includes(id)?'live-final-':'live-')+id+'.json');
 const loss=buildKnowledgeLossTrace(pack,a,w,s);save('attempts/final/loss/'+id+'.json',loss);
 writeFileSync(final+'/writer/'+id+'.txt',w.script);targets.push(...w.sentences.filter((s:any)=>s.kind==='FACT').map((s:any)=>s.text));
 for(const before of reviewed.filter((r:any)=>r.benchmark===id)){
  const matches=loss.traces.filter(t=>t.sourceId===before.sourceId&&t.span.start<before.span.end&&t.span.end>before.span.start);
  comparison.push({benchmark:id,baselineTraceId:before.traceId??null,sourceId:before.sourceId??null,snapshotHash:before.snapshotHash??null,baselineSpan:before.span??null,beforeCategory:before.category,beforeLoss:before.firstObservedLoss,diagnosis:before.why,afterTraceIds:matches.map(t=>t.id),afterRelationIds:[...new Set(matches.flatMap(t=>t.relationIds))],afterWriterUsed:matches.some(t=>t.stages.WRITER_USED===true),afterLoss:matches.some(t=>t.stages.WRITER_USED===true)?null:matches[0]?.firstLoss??before.firstObservedLoss,manualEvidence:false});
 }
 console.log(id+' loss windows='+loss.traces.length+' writerUsed='+loss.stageTotals.WRITER_USED.pass);
}
save('analysis/reviewed-loss-comparison.json',comparison);
const anti=runAntiHardcode(out+'/analysis/anti-hardcode.json',targets);console.log(JSON.stringify({anti:anti.passed,files:anti.scannedFiles,blockers:anti.blockers.length,reviewed:comparison.length,recoveredReviewed:comparison.filter(r=>r.afterWriterUsed).length}));if(!anti.passed)process.exitCode=1;
