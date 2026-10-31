import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import {buildEvidencePack} from '../../src/research';
import {buildCuriosityStoryPlan} from '../../src/curiosity/story';
import {groundedProgression} from '../../src/curiosity/progression';
import {parseMechanismSentence} from '../../src/research/mechanism-parser';
import {mechanismWindows,contextualWindowScope} from '../../src/research/contextual-mechanism';
import {verifyProcessAcquisition} from '../../src/curiosity/replay';
import {entityKey,PHYSICAL} from '../../src/curiosity/knowledge';
const [attempt='02',...ids]=process.argv.slice(2),root='out/engine3d/phase28b',old='out/engine3d/phase28',load=(p:string)=>JSON.parse(readFileSync(p,'utf8')),save=(p:string,x:unknown)=>{mkdirSync(path.dirname(root+'/'+p),{recursive:true});writeFileSync(root+'/'+p,JSON.stringify(x,null,2));};
const corpus=load(old+'/review/knowledge-loss-finite.json');
for(const id of ['well','elevator','turbine'].filter(id=>!ids.length||ids.includes(id))){
 const session=load(existsSync(root+'/research/'+id+'.json')?root+'/research/'+id+'.json':old+'/research/'+id+'.json');verifyProcessAcquisition(session);
 const baseline=load(old+'/'+id+'/artifacts.json'),oldPack=load(old+'/'+id+'/pack.json'),request=structuredClone(oldPack.researchPlan.request);request.id='phase28b-'+id;request.sourcePolicy={...request.sourcePolicy,contextualParser:1};
 const at=performance.now(),pack=buildEvidencePack(request,{version:1,id:'verified-acquisition',fixture:false,labels:['REAL_WEB_SNAPSHOTS','SESSION_CANDIDATES_ONLY'],sources:session.acceptedSources}),built=performance.now(),a=buildCuriosityStoryPlan(pack),p=a.story.progression!;
 const recovered=a.knowledge.relations.filter(r=>!baseline.knowledge.relations.some((b:any)=>b.id===r.id));
 const diag=corpus.rows.filter((r:any)=>r.benchmark===id).map((r:any)=>{const s=pack.sources.find(s=>s.id===r.sourceId)!,w=mechanismWindows(s).find(w=>w.span.start===r.span.start&&w.span.end===r.span.end)!,parse=parseMechanismSentence(w.text),scope=contextualWindowScope(s,pack.researchPlan,w),es=pack.evidence.filter(e=>e.sourceId===s.id&&e.sourceSpan.start===w.span.start),rs=a.knowledge.relations.filter(x=>x.proof.some(q=>es.some(e=>e.id===q.evidenceId)));return{traceId:r.traceId,text:w.text,span:w.span,sourceId:s.id,scope,parse,evidenceIds:es.map(e=>e.id),admittedRelationIds:rs.map(x=>x.id),recovered:rs.length>0,origin:'RECOVERED_FROM_EXISTING_SOURCE'};});
 // Weak literal mechanism components diagnose branching. They do not promote
 // a shared-subject star to a directed or temporally progressive chain.
 const physical=a.knowledge.relations.filter(r=>PHYSICAL.has(r.predicate)&&r.modality==='ASSERTED'),components:{nodes:string[];edges:string[]}[]=[];
 for(const r of physical){const ns=[entityKey(r.subject),entityKey(r.object)],hits=components.filter(c=>c.nodes.some(n=>ns.includes(n))),merged={nodes:[...new Set([...ns,...hits.flatMap(c=>c.nodes)])],edges:[...new Set([r.id,...hits.flatMap(c=>c.edges)])]};for(const h of hits)components.splice(components.indexOf(h),1);components.push(merged);}
 components.sort((a,b)=>b.edges.length-a.edges.length);const largest=components[0]??{nodes:[],edges:[]},level=p.metrics.groundedProblemSolutionPairs&&p.classification==='PROGRESSIVE_CAUSAL'?'L5':p.classification==='PROGRESSIVE_CAUSAL'||p.classification==='PROGRESSIVE'?'L4':p.metrics.longestGroundedChain>=3?'L3':p.metrics.longestGroundedChain>=2||largest.edges.length>=2?'L2':physical.length?'L1':'L0';
 const summary={id,request,baselineRelations:baseline.knowledge.relations.length,relations:a.knowledge.relations.length,newAdmitted:recovered.length,newCandidates:pack.factCandidates.filter(c=>c.canonicalFact.qualifiers.includes('CONTEXTUAL_PARSER_V1')).length,metrics:p.metrics,classification:p.classification,level,largestComponent:{nodes:largest.nodes.length,edges:largest.edges.length},diags:diag.map(d=>({id:d.traceId,candidates:d.parse.candidates.length,admitted:d.admittedRelationIds.length,codes:d.parse.diagnostics.map(x=>x.code)})),performance:{packMs:built-at,storyMs:performance.now()-built}};
 save('attempts/'+attempt+'/'+id+'/pack.json',pack);save('attempts/'+attempt+'/'+id+'/artifacts.json',a);save('attempts/'+attempt+'/'+id+'/diagnostics.json',diag);save('attempts/'+attempt+'/'+id+'/new-relations.json',recovered);save('attempts/'+attempt+'/'+id+'/summary.json',summary);
 console.log(JSON.stringify(summary));
}
