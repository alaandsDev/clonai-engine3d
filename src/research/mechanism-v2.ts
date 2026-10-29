import {jsonHash} from '../editorial/fingerprint';
import {normalize,normalizedView} from '../semantics/normalize';
import {sourceSpan} from './source';
import {mechanismFacts,sourceAboutSubject,type MechanismMatch} from './mechanism';
import {mechanismRules,mechanismModality,negativeMechanism,unsafeMechanism,mechanismPronoun,processSection} from './mechanism-language';
import {parseHtmlStructures} from './structured';
import {topicSubject} from '../topic/subject';
import type {CanonicalFact,Evidence,FactCandidate,ResearchPlan,SourceDocument} from './contracts';

export const MECHANISM_V2_VERSION='mechanism/2.0.0';
const key=(p:string,x:unknown)=>p+'_'+jsonHash(x).slice(0,20);
const clean=(s:string)=>s.trim().replace(/[.;:]+$/,'').trim();
const content=(s:string)=>normalize(s).replace(/^(?:o|a|os|as|um|uma|the|a|an)\s+/,'');
const modal=/\b(?:can|may|might|could|would|usually|sometimes|typically|pode|podem|poderia|geralmente|normalmente)\s*$/;
const malformed=(s:string)=>!s||s.length>400||s.split(/\s+/).length>65||/[{}<>\t]/.test(s);
/** Explicit alias in a lead is scope evidence; synonyms are never supplied by
 * a dictionary or benchmark. Both names must surround the literal connector. */
export function mechanismScope(s:SourceDocument,plan:ResearchPlan){
 if(processTitleMatches(s.title,plan))return{about:true,contextSpans:[] as ReturnType<typeof sourceSpan>[]};
 const subject=normalize(topicSubject(plan.request.topic)),title=normalize(s.title.split(/\s[–—-]\s/)[0]);
 if(!subject||!title)return{about:false,contextSpans:[]};
 const view=normalizedView(s.normalized.text);
 for(const m of view.text.matchAll(/\b(?:tambem conhecid[oa] como|also known as)\b/g)){
  const start=Math.max(0,m.index!-150),end=Math.min(view.text.length,m.index!+m[0].length+150),left=view.text.slice(start,m.index).replace(/\([^)]*\)/g,''),right=view.text.slice(m.index!+m[0].length,end).replace(/\([^)]*\)/g,'');
  const alias=right.split(/[,.;]|\s+ou\s+|\s+is\s+|\s+e\s+/)[0].trim();
  if(left.includes(title)&&content(alias)===content(subject)){
   const span=view.span(start,end);return{about:true,contextSpans:[sourceSpan(s,span.start,span.end)]};
  }
 }
 return{about:false,contextSpans:[]};
}
const processTitleMatches=(title:string,plan:ResearchPlan)=>content(title.split(/\s[–—-]\s/)[0])===content(topicSubject(plan.request.topic));

/** Literal relations in one source sentence. No inference, implicit antecedents,
 * negation reversal or reconstruction of ellipsis. Modality belongs to the
 * whole original sentence and its complete surface is retained for the Writer. */
export function mechanismFactsV2(sentence:string):MechanismMatch[] {
 const v=normalizedView(sentence),t=v.text;
 if(negativeMechanism.test(t.replace(/['’]/g,''))||unsafeMechanism.test(t)||/[=<>%\d]/.test(t)||sentence.length>1000)return [];
 const modality=mechanismModality(sentence),out:MechanismMatch[]=[];
 const add=(subject:string,predicate:string,object:string,type:CanonicalFact['factType'],start:number,end:number,extra:string[]=[])=>{
  subject=clean(subject);object=clean(object);
  if(malformed(subject)||malformed(object)||mechanismPronoun.test(normalize(subject))||mechanismPronoun.test(normalize(object)))return;
  if(/^(?:que|which|whose|who|that|onde|where|devido|por causa|porque|because|em toda|em todo|consequentemente)\b/.test(normalize(subject))||content(subject).length<2)return;
  if(predicate!=='PRECEDES'&&predicate!=='CAUSED_BY'&&/\b(?:que|which|whose|qual|funciona|funcionam)\b/.test(normalize(subject)))return;
  if(predicate!=='PRECEDES'&&/^(?:apos|depois de|antes de|after|before|nota|note|se procura|de passar|para |em frente)\b/.test(normalize(subject)))return;
  const fact:CanonicalFact={factType:type,subject,predicate,object,quantity:null,metric:null,temporalContext:null,residency:null,
   qualifiers:['MECHANISM_PROSE','MECHANISM_V2','MODALITY:'+modality,...[...t.matchAll(/\b(?:can|may|might|could|would|usually|sometimes|typically|under certain conditions|pode|podem|poderia|geralmente|normalmente|as vezes|sob certas condicoes|without|sem)\b/g)].map(m=>'MODALITY_MARKER:'+m[0]),...extra]};
  if(!out.some(x=>content(x.fact.subject)===content(subject)&&x.fact.predicate===predicate&&content(x.fact.object??'')===content(object)))out.push({fact,start,end});
 };
 // Preserve the old narrow grammar's useful relative clauses, without using
 // their truncated surface for narration. A causal fact retains the full cause.
 for(const m of mechanismFacts(sentence)){
  if(m.fact.predicate==='CAUSED_BY')continue; // V1 can stop before a qualifying coordination.
  if(m.fact.predicate==='IS_A'&&!/\s(?:é|são)\s/.test(sentence.slice(m.start,m.end)))continue;
  add(m.fact.subject,m.fact.predicate,m.fact.object!,m.fact.factType,m.start,m.end);
 }
 // Explicit reverse causal connector: effect because of cause. The two full
 // phrases are kept; no missing subject is filled from the page title.
 const because=t.match(/^(.+?)\s+(?:because of|due to|por causa de|devido a|devido ao|devido a |porque)\s+(.+?)[.!]?$/);
 if(because&&!/\b(?:occurs?|happens?|ocorre|acontece|fails?|falha)\b/.test(because[1])){
  const split=t.indexOf(because[2]),action=[...out].reverse().find(m=>m.fact.factType==='PROCESS'),left=action?sentence.slice(action.start,action.end):sentence.slice(0,v.span(0,because[1].length).end),right=v.span(split,t.length).text;
  add(left,'CAUSED_BY',right,'RELATION',0,sentence.length);
 }
 // Before/after only create order when both events are stated in this same
 // sentence. "Then" alone records a stage cue, never an edge to another source.
 const seq=t.match(/^(before|after|antes de|depois de|apos) (.+?), (.+?)[.!]?$/);
 if(seq){
  const event=(text:string)=>mechanismRules.some(r=>new RegExp('(?<![a-z])'+r.pattern+'(?![a-z])').test(text));
  if(!event(seq[2])||!event(seq[3]))return out;
  const a=t.indexOf(seq[2]),b=t.lastIndexOf(seq[3]);const x=v.span(a,a+seq[2].length).text,y=v.span(b,b+seq[3].length).text;
  add(/before|antes/.test(seq[1])?y:x,'PRECEDES',/before|antes/.test(seq[1])?x:y,'RELATION',0,sentence.length);return out;
 }
 const conditional=t.match(/^(without|sem) (.+?), (.+?)[.!]?$/);
 if(conditional){const a=t.indexOf(conditional[2]),b=t.lastIndexOf(conditional[3]);add(v.span(b,b+conditional[3].length).text,'WITHOUT_CONDITION',v.span(a,a+conditional[2].length).text,'RELATION',0,sentence.length,['CONDITIONAL']);return out;}
 // Read clauses with explicit subjects only. Commas are not assumed to be
 // causal or sequential connectors. Coordinations are never silently cut.
 for(const part of sentence.matchAll(/[^,;]+/g)){
  const raw=part[0],offset=part.index!,cv=normalizedView(raw),ct=cv.text;
  const matches=mechanismRules.flatMap((r,i)=>[...ct.matchAll(new RegExp('(?<![a-z])'+r.pattern+'(?![a-z])','g'))].map(m=>({r,i,m})))
   .sort((a,b)=>a.m.index!-b.m.index!||b.m[0].length-a.m[0].length||a.i-b.i);
  const picked=matches[0];if(!picked)continue;
  const {r,m}=picked,at=m.index!,left=ct.slice(0,at).trim().replace(/^(?:first|then|next|finally|primeiro|depois|entao|em seguida|finalmente)\s+/,''),subjectFold=left.replace(modal,'').trim();
  if(r.predicate==='IS_A'&&m[0]==='e'&&cv.span(at,at+1).text!=='é')continue;
  if(!subjectFold||/\b(?:e|and|or|ou|because|porque|cujo|cuja|cujas|cujos)\b/.test(subjectFold))continue;
  const si=ct.indexOf(subjectFold),oi=at+m[0].length;
  const subject=cv.span(si,si+subjectFold.length).text,object=cv.span(oi,ct.length).text;
  // Reject a second finite verb in an argument; accepting it as a noun phrase
  // would fabricate a subject or change scope. Explicit causal arguments may
  // be entire events and are intentionally exempt.
  if(!['CAUSES','CAUSED_BY','FAILS_BECAUSE','ENABLES','USED_FOR','HAS_GOAL','REQUIRES'].includes(r.predicate)&&/\b(?:e|is|are|was|were|foi|sao)\b/.test(normalize(object)))continue;
  if(r.predicate==='IS_A'&&!/^(?:a|an|the|um|uma|o|a)\s/.test(normalize(object).trim()))continue;
  const start=offset+cv.span(si,si+subjectFold.length).start,end=offset+raw.length;
  const category=m[0].match(/^sao ((?:[a-z]+ ){1,3})projetad/);
  if(category&&!/mente\b|^(?:em|de|do|da|por|para|in|on)\b/.test(category[1]))add(subject,'IS_A',cv.span(at+4,ct.length).text,'DEFINITION',start,end);
  const predicate=r.predicate==='USED_FOR'&&/projetad/.test(m[0])&&!/^[a-z]+(?:ar|er|ir)\b/.test(normalize(object).trim())?'DESIGNED_FOR':r.predicate;
  add(r.reverse?object:subject,predicate,r.reverse?subject:object,r.type??'RELATION',start,end,
   [...(/^(?:first|then|next|finally|primeiro|depois|entao|em seguida|finalmente)\b/.test(ct.trim())?['EXPLICIT_STAGE']:[]),...(r.reverse?['PASSIVE']:[])]);
 }
 return out;
}

/** Title/heading gives scope, never a factual subject. Each fact keeps its own
 * literal subject. Foreign sections, captions, tables, navigation and historical
 * examples do not inherit the main system's identity. */
export function extractMechanismV2(s:SourceDocument,plan:ResearchPlan):{evidence:Evidence[];candidates:FactCandidate[]} {
 const evidence:Evidence[]=[],candidates:FactCandidate[]=[];
 if(plan.request.researchGoal!=='PROCESS'||plan.policy.mechanismVersion!==2||!['pt-BR','en'].includes(s.language))return{evidence,candidates};
 const scope=mechanismScope(s,plan),about=scope.about,parsed=s.contentType==='text/html'?parseHtmlStructures(s.content,new URL(s.canonicalLocator,'https://invalid.example').hostname):null;
 const headings=parsed?.headings??[];
 for(const line of s.normalized.text.matchAll(/[^\n]+/g)){
  if(line[0].includes('\t'))continue;
  const rawAt=sourceSpan(s,line.index!,line.index!+line[0].length),heading=headings.filter(h=>h.span.end<=rawAt.start).at(-1);
  const scoped=heading?processTitleMatches(heading.text,plan):false;
  if(!about&&!scoped)continue;
  if(heading&&heading.level>1&&!scoped&&!processSection.test(normalize(heading.text)))continue;
  // Exclude actual caption containers even on a matching page.
  const prefix=s.content.slice(Math.max(0,rawAt.start-1000),rawAt.start);
  if(prefix.lastIndexOf('<figcaption')>prefix.lastIndexOf('</figcaption')||prefix.lastIndexOf('<caption')>prefix.lastIndexOf('</caption'))continue;
  for(const part of line[0].matchAll(/[^.!?]+(?:[.!?](?=\s|$)|$)/g)){
   const sentence=part[0].trim();if(sentence.length<12)continue;
   const at=line.index!+part.index!+part[0].indexOf(sentence);
   for(const m of mechanismFactsV2(sentence)){
    // The complete sentence is the evidence window; causal/modality scope is
    // never removed from an argument's support span.
    const span=sourceSpan(s,at,at+sentence.length),raw={version:1 as const,id:key('EV',{source:s.id,hash:s.contentHash,span,fact:m.fact,version:MECHANISM_V2_VERSION}),sourceId:s.id,sourceSpan:span,exactText:span.text,normalizedText:sentence,evidenceType:m.fact.factType,supports:m.fact,extractionConfidence:'MEDIUM' as const,truthStatus:'EXTRACTED' as const,extractionMethod:'MECHANISM_V2' as const,contentHash:s.contentHash,table:null,
     ...(s.language==='en'?{evidenceLanguage:'en' as const}:{}),contextSpans:[...(heading?[heading.span]:[]),...scope.contextSpans]};
    if(evidence.some(e=>e.id===raw.id))continue;
    const e={...raw,fingerprint:jsonHash(raw)},c={id:key('FC',{fact:m.fact,evidence:e.id}),canonicalFact:m.fact,evidenceIds:[e.id],extractionConfidence:'MEDIUM' as const,status:'EXTRACTED' as const};
    evidence.push(e);candidates.push({...c,fingerprint:jsonHash(c)});
   }
  }
 }
 return{evidence,candidates};
}
