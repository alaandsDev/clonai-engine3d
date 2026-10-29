import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {jsonHash} from '../../src/editorial/fingerprint';
import {contentHash,sourceSpan} from '../../src/research/source';
import {planResearch} from '../../src/research/planner';
import {mechanismFactsV2,mechanismScope} from '../../src/research/mechanism-v2';
import {mechanismRules,negativeMechanism,processSection} from '../../src/research/mechanism-language';
import {parseHtmlStructures} from '../../src/research/structured';
import {normalize} from '../../src/semantics/normalize';
import {topicSubject} from '../../src/topic/subject';
import type {EvidencePack,SourceDocument} from '../../src/research/contracts';
import {benchmarks} from '../phase26/benchmarks';

const root='out/engine3d/phase26',base=root+'/phase26b-baseline',out=root+'/phase26b';
const load=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const save=(p:string,x:unknown)=>{mkdirSync(path.dirname(p),{recursive:true});writeFileSync(p,typeof x==='string'?x:JSON.stringify(x,null,2));};
// Diagnostic cues are deliberately broader than the extractor. These windows
// are UNREVIEWED recall candidates, never supplied to Research as Evidence.
const cues=/\b(?:flui|fluem|pressao|energia|comprim|compre|converte|transform|refriger|rotor|movimento|resfri|calor|filtra|decanta|sediment|evapora|condensa|aciona|impuls|bombe|pistao|sobe|desce|contrapeso|tracao|eleva|valvula|fluid|flows?|pressure|compress|heat|cool|drives?)\w*/;
function freeze(){
 if(existsSync(base+'/manifest.json'))return;
 const files=['PHASE26_REPORT.md','src/research/mechanism-v2.ts','src/research/mechanism-language.ts','src/research/contracts.ts','src/research/request.ts','src/research/v2.ts','src/curiosity/knowledge.ts','src/curiosity/story.ts','src/writer/curiosity.ts'];
 const hashes:Record<string,string>={};for(const f of files){const target=base+'/files/'+f;mkdirSync(path.dirname(target),{recursive:true});copyFileSync(f,target);hashes[f]=contentHash(readFileSync(f,'utf8'));}
 for(const b of benchmarks)for(const dir of ['benchmarks','knowledge','graphs','stories','writer']){const f=root+'/'+dir+'/final-'+b.id+'.json';mkdirSync(base+'/'+dir,{recursive:true});copyFileSync(f,base+'/'+dir+'/'+b.id+'.json');}
 const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8'}).trim();
 save(base+'/manifest.json',{head:git('rev-parse','HEAD'),branch:git('branch','--show-current'),status:git('status','--short'),hashes,initialResult:{useful:2,story:2,writer:2},note:'Frozen before Phase26B extraction behaviour changes. Original research and EvidencePack files remain immutable at their Phase26 paths.'});
}
freeze();
const summaries:any[]=[];
for(const b of benchmarks){
 const pack=load(root+'/evidence/final-'+b.id+'.json') as EvidencePack,plan=planResearch(pack.researchPlan.request),knowledge=load(root+'/knowledge/final-'+b.id+'.json'),story=load(root+'/stories/final-'+b.id+'.json'),writer=load(root+'/writer/final-'+b.id+'.json');
 const sessionFile=root+'/research/'+(existsSync(root+'/research/live-final-'+b.id+'.json')?'live-final-':'live-')+b.id+'.json',session=load(sessionFile);
 const traces:any[]=[];
 for(const s of pack.sources){
  const scope=mechanismScope(s,plan),headings=s.contentType==='text/html'?parseHtmlStructures(s.content,new URL(s.canonicalLocator).hostname).headings:[];
  let paragraph=0;
  for(const line of s.normalized.text.matchAll(/[^\n]+/g)){
   paragraph++;const paragraphSpan=sourceSpan(s,line.index!,line.index!+line[0].length);let sentenceIndex=0;
   for(const part of line[0].matchAll(/[^.!?]+(?:[.!?](?=\s|$)|$)/g)){
   sentenceIndex++;const text=part[0].trim(),t=normalize(text),hasRule=mechanismRules.some(r=>r.type==='PROCESS'&&new RegExp('(?<![a-z])'+r.pattern+'(?![a-z])').test(t));
   if(text.length<25||text.length>2600||!cues.test(t)&&!hasRule)continue;
   const at=line.index!+part.index!+part[0].indexOf(text),span=sourceSpan(s,at,at+text.length),heading=headings.filter(h=>h.span.end<=span.start).at(-1),about=scope.about;
   const contextualized=about&&(!heading||heading.level===1||processSection.test(normalize(heading.text))||normalize(heading.text)===normalize(topicSubject(plan.request.topic)));
   const evidence=pack.evidence.filter(e=>e.extractionMethod==='MECHANISM_V2'&&e.sourceId===s.id&&e.sourceSpan.start<span.end&&e.sourceSpan.end>span.start);
   const facts=pack.groundedFacts.filter(f=>f.usableForPrimaryClaim&&f.evidenceIds.some(id=>evidence.some(e=>e.id===id))),relations=knowledge.relations.filter((r:any)=>r.factIds.some((id:string)=>facts.some(f=>f.id===id)));
   const structuralGrammar=mechanismRules.some(r=>new RegExp('(?<![a-z])'+r.pattern+'(?![a-z])').test(t));
   const reason=!about?'SUBJECT_IDENTITY_FAILURE':!contextualized?'SECTION_CONTEXT_LOST':evidence.length&&!facts.length?'EVIDENCE_ADMISSION_FAILURE':!evidence.length&&negativeMechanism.test(t)?'NEGATION_SAFETY_REFUSAL':!evidence.length&&/[\d=<>%]/.test(t)?'SENTENCE_FRAGMENTATION_OR_QUANTITATIVE_REFUSAL':!evidence.length&&/\b(?:que|qual|ele|ela|suas?|seus?)\b/.test(t)?'COREFERENCE_OR_RELATIVE_CLAUSE_FAILURE':!evidence.length&&!structuralGrammar?'MECHANICAL_ACTION_MISS':!evidence.length?'RELATION_PARSER_REFUSAL':'NONE';
   const stages={DISCOVERED:true,FETCHED:true,PARSED:true,CONTEXTUALIZED:contextualized,CANDIDATE_EXTRACTED:evidence.length>0,SUBJECT_RESOLVED:evidence.length>0,RELATION_PARSED:evidence.length>0,EVIDENCE_ADMITTED:facts.length>0,KNOWLEDGE_ADMITTED:relations.length>0,STORY_USED:story.nodes.some((n:any)=>relations.some((r:any)=>r.id===n.relationId)),WRITER_USED:writer.sentences.some((w:any)=>w.relationIds.some((id:string)=>relations.some((r:any)=>r.id===id)))};
   traces.push({id:'LOSS_'+jsonHash({b:b.id,s:s.id,span}).slice(0,16),benchmark:b.id,sourceId:s.id,sourceTitle:s.title,snapshotHash:s.contentHash,locator:s.canonicalLocator,paragraph,paragraphSpan,sentenceIndex,heading:heading?{text:heading.text,span:heading.span}:null,span,text,stages,firstLoss:Object.entries(stages).find(([,v])=>!v)?.[0]??null,reason,extractedEvidence:evidence.map(e=>e.id),admittedFacts:facts.map(f=>f.id),knowledgeRelations:relations.map((r:any)=>r.id),writerEligible:writer.eligible,review:'UNREVIEWED_POTENTIAL_PASSAGE',parserObservability:'Candidate/subject/relation are one combined parser in Phase26; no finer stage is claimed without a specific guard.'});
   }
  }
 }
 const discoveryFailures=session.searchTrace.filter((t:any)=>t.diagnostic).map((t:any)=>({query:t.query.text,diagnostic:t.diagnostic,resultCount:t.resultCount}));
 save(out+'/loss-baseline/'+b.id+'.json',{benchmark:b,sessionFile,sessionFingerprint:session.fingerprint,sourceCount:pack.sources.length,discoveryFailures,traces});
 const tokens=normalize(topicSubject(b.topic)).split(' ').filter(w=>w.length>3),rank=(x:any)=>tokens.filter(t=>normalize(x.sourceTitle).includes(t)).length*10+Number(x.stages.CONTEXTUALIZED)*3;
 const examples=[...traces].sort((a,b)=>rank(b)-rank(a)||a.paragraph-b.paragraph).filter(x=>x.reason!=='NONE').slice(0,6);
 summaries.push({id:b.id,topic:b.topic,fetches:session.fetchAttempts.length,sources:pack.sources.length,contributing:knowledge.metrics.contributingSources,potentialPassages:traces.length,extractedRelations:pack.evidence.filter(e=>e.extractionMethod==='MECHANISM_V2').length,admitted:knowledge.relations.length,discoveryFailures,examples});
 console.log(b.id+' sources='+pack.sources.length+' potential='+traces.length+' admitted='+knowledge.relations.length);
}
save(out+'/analysis/baseline-summary.json',summaries);
const esc=(s:string)=>s.replace(/\|/g,'/').replace(/\n/g,' ');
let md='# Phase26B — Failure analysis BEFORE behaviour corrections\n\nBaseline frozen over Phase26 dirty working tree. Passage counts are broad diagnostic candidates, not manual Evidence nor validated recall truth. Detailed per-source spans/stages: `phase26b/loss-baseline/*.json`.\n\n';
md+='|Benchmark|Sources fetched|Contributing sources|Potential passages|Extracted|Admitted|First loss / category|Example span|Why lost / potential general fix|\n|---|---|---|---|---|---|---|---|---|\n';
for(const s of summaries){const e=s.examples[0];md+='|'+[s.id+' '+s.topic,s.fetches,s.contributing,s.potentialPassages,s.extractedRelations,s.admitted,e?e.firstLoss+' / '+e.reason:'DISCOVERED / '+(s.discoveryFailures[0]?.diagnostic??'No candidates'),e?e.sourceId+':'+e.span.start+'–'+e.span.end+' '+e.text.slice(0,300):'No acquired passage',e?'See exact guard/context and review examples below; fix only an observed class.':'Provider availability; no extraction can recover absent bytes'].map(x=>esc(String(x))).join('|')+'|\n';}
for(const s of summaries){md+='\n## '+s.id+' — '+s.topic+'\n\n';for(const e of s.examples)md+='- `'+e.id+'` '+e.sourceTitle+'; heading='+e.heading?.text+'; '+e.firstLoss+' / '+e.reason+'; raw span '+e.span.start+'–'+e.span.end+'.\n\n> '+e.text.replace(/\n/g,' ')+'\n\n';}
save(root+'/review/phase26b-failure-analysis.md',md);
