import {readFileSync} from 'node:fs';
import {buildEvidencePack,type ResearchRequest,type SourceInput} from '../../src/research';
/** Dev aid: rebuild an EvidencePack from an already-acquired session's sources with the current code (no network). */
const [file]=process.argv.slice(2),j=JSON.parse(readFileSync(file,'utf8')),request:ResearchRequest=j.request;
const sources:SourceInput[]=j.EvidencePack.sources.map(({normalized:_n,fingerprint:_f,...s}:Record<string,unknown>)=>s);
const pack=buildEvidencePack(request,{version:1,id:'offline',fixture:false,labels:[],sources});
console.log(pack.quality.productionEligibility,'evidence',pack.evidence.length,'grounded',pack.groundedFacts.length,JSON.stringify(pack.unresolvedQuestions));
for(const g of pack.groundedFacts)console.log(g.status,g.usableForPrimaryClaim,g.factType,g.canonicalFact.subject,'|',g.canonicalFact.predicate,'|',g.canonicalFact.object,'|',pack.sources.find(s=>s.id===g.sourceIds[0])?.title.split(' –')[0]);
import {writeGroundedTopic} from '../../src/writer';
const w=writeGroundedTopic({version:1,id:'offline-writer',topic:request.topic,language:'pt-BR',factPolicy:'GROUNDED_ONLY'},pack);
console.log('WRITER',w.status,w.reason);for(const p of w.preflights)console.log(p.candidateId,p.masterState,p.hardRejections.join(','),p.quality.wordCount,JSON.stringify(p.reconciliation.issues).slice(0,600));
if(w.finalCandidate)console.log(w.finalCandidate.script);
const p0=w.preflights[0],c0=w.candidates[0];console.log(c0.script);
for(const c of p0.graph.claims)console.log(c.id,c.requiresVisualProof,c.predicate,c.status,c.narrativeRole,JSON.stringify(c.text));
const fp=w.finalPreflight!;console.log('PLAN',JSON.stringify({renderability:fp.plan.renderability,productionReady:fp.plan.productionReady,coverage:fp.plan.coverage,gaps:fp.plan.localizedGaps.map(g=>[g.claimIds,g.reason]),islands:fp.plan.islands?.length}).slice(0,1500));
console.log('COMPILED',JSON.stringify({ready:fp.compiled.productionReady,items:fp.compiled.items.map(i=>({claims:i.claimIds,proof:i.proof,seq:Boolean(i.sequence),frames:i.sequence?.totalFrames,demo:i.sequence?.demonstration?.steps?.map((s:any)=>s.operation)}))}).slice(0,2500));
console.log('MATRIX',JSON.stringify(fp.matrix.map(m=>[m.claimId,m.visualProof,m.gap])));
