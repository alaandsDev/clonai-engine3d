import {jsonHash} from '../editorial/fingerprint';
import {normalize,normalizedView} from '../semantics/normalize';
import type {SourceSpan} from '../semantics/contracts';
import {sourceSpan} from './source';
import {extractMechanismV2,mechanismFactsV2,mechanismScope} from './mechanism-v2';
import {processSection} from './mechanism-language';
import {parseHtmlStructures} from './structured';
import {topicSubject} from '../topic/subject';
import type {CanonicalFact,Evidence,FactCandidate,ResearchPlan,SourceDocument} from './contracts';
import {cleanMechanismActor,localMechanismClauses,contextualSafetyRefusal,unsupportedSentenceRank} from './mechanism-clauses';

export const CONTEXTUAL_MECHANISM_VERSION='contextual-mechanism/1.0.0';
/** Annotation masking preserves UTF-16 offsets. Only explicit citation and
 * orthography metadata are removed, never numeric factual values. */
export function mechanismTextView(text:string){
 const rules:string[]=[];
 const masked=text.replace(/\[(?:\d{1,3}(?:\s*[,–-]\s*\d{1,3})*|nota\s+\d+)\]/gi,m=>{rules.push('CITATION_ANNOTATION');return' '.repeat(m.length);})
  .replace(/\(AO\s+\d{4}:\s*[^)]*\)/gi,m=>{rules.push('ORTHOGRAPHY_ANNOTATION');return' '.repeat(m.length);});
 return{masked,rules:[...new Set(rules)].sort()};
}
export interface MechanismWindow {paragraphIndex:number;sentenceIndex:number;text:string;span:SourceSpan;paragraphSpan:SourceSpan;cleaningRules:string[];heading:{text:string;span:SourceSpan;level:number}|null;headingPath:{text:string;span:SourceSpan;level:number}[];excluded:boolean}
export function mechanismWindows(s:SourceDocument):MechanismWindow[]{
 const headings=s.contentType==='text/html'?parseHtmlStructures(s.content,new URL(s.canonicalLocator,'https://invalid.example').hostname).headings:[],out:MechanismWindow[]=[];let paragraphIndex=0;
 const excluded=[...s.content.matchAll(/<(figcaption|caption|nav|aside|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi)].map(m=>({start:m.index!,end:m.index!+m[0].length}));
 for(const line of s.normalized.text.matchAll(/[^\n]+/g)){
  paragraphIndex++;if(line[0].includes('\t'))continue;
  const view=mechanismTextView(line[0]),paragraphSpan=sourceSpan(s,line.index!,line.index!+line[0].length);let sentenceIndex=0;
  for(const part of view.masked.matchAll(/[^.!?]+(?:[.!?](?=\s|$)|$)/g)){
   sentenceIndex++;const trimmed=part[0].trim();if(trimmed.length<12)continue;
   const offset=line.index!+part.index!+part[0].indexOf(trimmed),span=sourceSpan(s,offset,offset+trimmed.length),heading=headings.filter(h=>h.span.end<=span.start).at(-1)??null;
   const headingPath:typeof headings=[];for(const item of headings.filter(h=>h.span.end<=span.start)){while(headingPath.length&&headingPath.at(-1)!.level>=item.level)headingPath.pop();headingPath.push(item);}
   out.push({paragraphIndex,sentenceIndex,text:trimmed.replace(/\s+/g,' '),span,paragraphSpan,cleaningRules:view.rules,heading,headingPath,excluded:excluded.some(r=>span.start<r.end&&span.end>r.start)});
  }
 }
 return out;
}
const noun=(s:string)=>normalize(s).trim().replace(/^(?:o|a|os|as|um|uma|the|an)\s+/,'');
export function contextualDocumentScope(s:SourceDocument,plan:ResearchPlan){
 const baseline=mechanismScope(s,plan);if(baseline.about)return{...baseline,kind:'DOCUMENT_IDENTITY'};
 const title=normalize(s.title.split(/\s[–—-]\s/)[0]),subject=noun(topicSubject(plan.request.topic));
 const wrapper=title.match(/^(?:estacao|unidade|sistema|instalacao|processo|station|unit|facility|plant|system|process) (?:de|do|da|for|of) (.+)$/);
 if(!wrapper||noun(wrapper[1])!==subject)return{...baseline,kind:'UNRESOLVED'};
 const v=normalizedView(s.normalized.text),at=v.text.indexOf(title);
 if(at<0)return{...baseline,kind:'UNRESOLVED'};
 const p=v.span(at,at+title.length);
 return{about:true,contextSpans:[sourceSpan(s,p.start,p.end)],kind:'FACILITY_PROCESS_CONTEXT_NOT_IDENTITY'};
}
export function contextualWindowScope(s:SourceDocument,plan:ResearchPlan,w:MechanismWindow,doc=contextualDocumentScope(s,plan)){
 if(w.excluded)return{allowed:false,reason:'CAPTION_OR_NAVIGATION',context:doc.contextSpans};
 if(!doc.about)return{allowed:false,reason:'SUBJECT_IDENTITY_FAILURE',context:doc.contextSpans};
 if(w.headingPath.some(h=>/\b(?:historia|history|precursores|desenvolvimento|era|referencias|references|bibliografia|bibliography|simulac|calculos|economia|sociedade|ambiente)\w*/.test(normalize(h.text))))return{allowed:false,reason:'UNRELATED_OR_HISTORICAL_SECTION',context:doc.contextSpans};
 const target=noun(topicSubject(plan.request.topic));
 const permitted=(h:NonNullable<MechanismWindow['heading']>)=>h.level===1||processSection.test(normalize(h.text))||noun(h.text)===target||/^(?:processo (?:de|do|da)|principio de|working principle|operation of)\b/.test(normalize(h.text))||noun(normalize(h.text).replace(/^(?:elementos|componentes|partes|estrutura|components|parts|structure) (?:de um|de uma|de|do|da|of the|of) /,''))===target;
 const allowed=!w.heading||permitted(w.heading)||w.headingPath.some(h=>/^(?:elementos|componentes|partes|components|parts)\b/.test(normalize(h.text))&&permitted(h));
 return{allowed,reason:allowed?doc.kind:'SECTION_CONTEXT_LOST',context:[...doc.contextSpans,...w.headingPath.map(h=>h.span)]};
}
export function extractContextualMechanisms(s:SourceDocument,plan:ResearchPlan){
 const base=extractMechanismV2(s,plan),safe=(f:CanonicalFact)=>!/\b(?:em|de|do|da|in|of|with|to)$/i.test(f.object??''),evidence:Evidence[]=base.evidence.filter(e=>cleanMechanismActor(e.supports.subject)===e.supports.subject&&safe(e.supports)&&!unsupportedSentenceRank(e.normalizedText)),candidates:FactCandidate[]=base.candidates.filter(c=>evidence.some(e=>c.evidenceIds.includes(e.id)));
 if(plan.policy.contextualMechanisms!==true||plan.request.researchGoal!=='PROCESS'||!['en','pt-BR'].includes(s.language))return base;
 const documentScope=contextualDocumentScope(s,plan);
 if(!documentScope.about)return base;
 const windows=mechanismWindows(s).filter(w=>contextualWindowScope(s,plan,w,documentScope).allowed&&!contextualSafetyRefusal(w.text));
 for(let i=evidence.length-1;i>=0;i--)if(!windows.some(w=>evidence[i].sourceSpan.start>=w.span.start&&evidence[i].sourceSpan.end<=w.span.end)){const [removed]=evidence.splice(i,1);for(let j=candidates.length-1;j>=0;j--)if(candidates[j].evidenceIds.includes(removed.id))candidates.splice(j,1);}
 for(const window of windows){
  const scope=contextualWindowScope(s,plan,window,documentScope);if(!scope.allowed)continue;
  if(!unsupportedSentenceRank(window.text))for(const match of mechanismFactsV2(window.text))if(safe(match.fact))addContextFact({...match.fact,subject:cleanMechanismActor(match.fact.subject)},window,scope.context,'EXPLICIT_RELATION');
  for(const relation of localMechanismClauses(window.text))addContextFact(relation.fact,{...window,text:relation.text},scope.context,relation.resolution);
 }
 function addContextFact(fact:CanonicalFact,w:MechanismWindow,context:SourceSpan[],kind:'EXPLICIT_RELATION'|'CONTEXT_RESOLVED_RELATION'){
  const norm=(s:string)=>normalize(s).replace(/^(?:o|a|os|as|um|uma|the|an)\s+/,'').trim();
  const flowArg=(s:string)=>norm(s.replace(/^(?:por|pelo|pela|através de|through)\s+/i,''));
  if(evidence.some(e=>{const flow=['FLOW','PASSES_THROUGH'].includes(e.supports.predicate)&&['FLOW','PASSES_THROUGH'].includes(fact.predicate);return e.sourceSpan.start===w.span.start&&(e.supports.predicate===fact.predicate||flow)&&norm(e.supports.subject)===norm(fact.subject)&&(flow?flowArg(e.supports.object??'')===flowArg(fact.object??''):norm(e.supports.object??'')===norm(fact.object??''));}))return;
  const supportingSpans=[w.span,...context,...(w.heading?[w.heading.span]:[])].filter((x,i,a)=>a.findIndex(y=>x.start===y.start&&x.end===y.end)===i);
  const raw={version:1 as const,id:'EV_'+jsonHash({source:s.id,hash:s.contentHash,span:w.span,fact,context:supportingSpans,version:CONTEXTUAL_MECHANISM_VERSION}).slice(0,20),sourceId:s.id,sourceSpan:w.span,exactText:w.span.text,normalizedText:w.text,evidenceType:fact.factType,supports:fact,extractionConfidence:'MEDIUM' as const,truthStatus:'EXTRACTED' as const,extractionMethod:'MECHANISM_V2' as const,contentHash:s.contentHash,table:null,contextSpans:supportingSpans.slice(1),mechanismContext:{kind,documentId:s.id,paragraphIndex:w.paragraphIndex,sentenceIndex:w.sentenceIndex,supportingSpans,cleaningRules:w.cleaningRules}};
  if(evidence.some(e=>e.id===raw.id))return;
  const e={...raw,fingerprint:jsonHash(raw)},c={id:'FC_'+jsonHash({fact,evidence:e.id}).slice(0,20),canonicalFact:fact,evidenceIds:[e.id],extractionConfidence:'MEDIUM' as const,status:'EXTRACTED' as const};evidence.push(e);candidates.push({...c,fingerprint:jsonHash(c)});
 }
 return{evidence,candidates};
}
