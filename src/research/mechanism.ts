import {jsonHash} from '../editorial/fingerprint';
import {normalize,normalizedView} from '../semantics/normalize';
import {sourceSpan} from './source';
import {topicSubject} from '../topic/subject';
import type {CanonicalFact,Evidence,FactCandidate,ResearchPlan,SourceDocument} from './contracts';
/** Phase 25: closed pt-BR grammar for mechanism prose, used only by PROCESS
 * routes. It extracts literal clauses (motion/flow with a destination, an
 * explicit cause, a category definition) as EXTRACTED evidence with exact
 * spans. It is not a general parser: anything outside the grammar yields
 * nothing, negated/hedged/question clauses are skipped, and only documents
 * whose title names the requested subject are read. */
export const MECHANISM_EXTRACTOR_VERSION='mechanism-pt/1.0.0';
const MOTION:[string,string][]=[['fluem|flui|escoam|escoa|circulam|circula|passam|passa|percorrem|percorre','FLOW'],['sobem|sobe|jorram|jorra|ascendem|ascende','RISE'],['descem|desce','DESCEND'],['entram|entra','ENTER'],['saem|sai','EXIT'],['giram|gira|rotacionam|rotaciona','ROTATE'],['movem-se|move-se|se movem|se move|movem|move','MOVE'],['empurram|empurra|impulsionam|impulsiona','PUSH'],['transformam|transforma|convertem|converte','TRANSFORM']];
const PREP='para (?:a |o |as |os )?|ate (?:a |o |as |os )?|atraves d(?:e|a|o|as|os) |por (?:meio d(?:e|a|o) )?|pel(?:a|o|as|os) |em direcao a(?:o|os|s)? |em (?:a |o |um |uma )?|n(?:a|o|as|os) |d(?:e|a|o|as|os) ';
const STOP=new Set(['devido','gracas','causa','que','cujo','cuja','cujos','cujas','onde','quando','e','ou','mas','se','nao','tambem','como','ja','entao','assim','isto','isso','ele','ela','eles','elas','sua','seu','suas','seus','esta','este','sao','foi','ser','sendo','ha','tem','com']);
const ARTICLE=/^(?:o|a|os|as|um|uma|uns|umas)$/;
const SKIP=/(?<![a-z])(?:nao|nunca|jamais|talvez|poderia|pode|podem|possivelmente|provavelmente|ignore|instrucoes|system prompt)(?![a-z])|\?/;
const BOUNDARY=/[,;:()]|(?<![a-z])(?:e|que|onde|quando|devido|porque|enquanto|mas|sendo|cujo|cuja|cujos|cujas|conforme|entre)(?![a-z])/;
const TRAILING=/^(?:de|do|da|dos|das|em|no|na|nos|nas|a|o|as|os|ao|aos|para|por|pelo|pela|com)$/;
const words=(s:string)=>s.split(' ').filter(Boolean);
/** Noun phrase ending right before `end` in folded text: up to 4 words, stopping at boundaries. */
function npBefore(text:string,end:number){
 const left=text.slice(0,end).replace(/\s+$/,''),cut=Math.max(left.lastIndexOf(','),left.lastIndexOf(';'),left.lastIndexOf('('),left.lastIndexOf(':'));
 const ws=words(left.slice(cut+1)),out:string[]=[];
 let i=ws.length-1;for(;i>=0&&out.length<5;i--){const w=ws[i];if(STOP.has(w)||/mente$/.test(w))break;out.unshift(w);}
 // Never cut a noun phrase at the length cap: it must start at a boundary or it is rejected.
 if(i>=0&&!STOP.has(ws[i])&&!/mente$/.test(ws[i]))return null;
 // The determiner is kept as surface metadata for realization: a stripped article, or the
 // article implied by a relative "cujo/cuja/cujos/cujas" that introduces the phrase.
 let det:string|null=null;while(out.length&&ARTICLE.test(out[0]))det=out.shift()!;
 const rel:Record<string,string>={cujo:'o',cuja:'a',cujos:'os',cujas:'as'};if(!det&&i>=0&&rel[ws[i]])det=rel[ws[i]];
 if(!out.length||out.every(w=>w.length<3))return null;
 const phrase=out.join(' '),start=left.lastIndexOf(phrase);return start<0?null:{text:phrase,start,end:start+phrase.length,det};
}
/** Phrase starting at `start` and ending at a boundary; longer than `max` words → rejected, never truncated. */
function npAfter(text:string,start:number,max=6){
 const rest=text.slice(start),b=rest.search(BOUNDARY),stop=rest.search(/[.!]/),limit=Math.min(b<0?rest.length:b,stop<0?rest.length:stop),ws=words(rest.slice(0,limit));
 if(ws.length>max)return null;
 // A coordination may share a modifier across both conjuncts ("X e Y reduzidas"); an inner -mente adverb
 // may qualify the phrase. Either way cutting here could change the meaning, so the phrase is rejected.
 if(/^\s*(?:e|ou)\s/.test(rest.slice(limit))||ws.some(w=>/mente$/.test(w)))return null;
 while(ws.length&&(STOP.has(ws[ws.length-1])||ARTICLE.test(ws[ws.length-1])||TRAILING.test(ws[ws.length-1])))ws.pop();
 if(!ws.length)return null;const phrase=ws.join(' '),at=start+rest.indexOf(phrase);return{text:phrase,start:at,end:at+phrase.length};
}
const base=(subject:string,type:CanonicalFact['factType'],predicate:string,object:string|null):CanonicalFact=>({factType:type,subject,predicate,object,quantity:null,metric:null,temporalContext:null,qualifiers:['MECHANISM_PROSE'],residency:null});
export interface MechanismMatch {fact:CanonicalFact;start:number;end:number}
/** Mechanism facts inside one sentence; offsets are relative to `sentence`. */
export function mechanismFacts(sentence:string):MechanismMatch[]{
 const v=normalizedView(sentence),t=v.text,out:MechanismMatch[]=[];if(SKIP.test(t))return out;
 const orig=(a:number,b:number)=>{const s=v.span(a,b);return{start:s.start,end:s.end,text:s.text};};
 // Objects keep their source surface (preposition/article/accents) so a realization adds no words of its own.
 const def=t.match(/^(um|uma|o|a|os|as) ([a-z][a-z -]{2,60}?) (?:e|sao) ((?:um|uma|o|a) [a-z][a-z -]{2,60}?)(?=[,.;(]|$| que | cuj| onde )/);
 if(def){const at=def[1].length+1,s=orig(at,at+def[2].length),o=orig(def[0].length-def[3].length,def[0].length);if(words(def[2]).length<=4&&words(def[3]).length<=7)out.push({fact:{...base(s.text,'DEFINITION','IS_A',o.text),qualifiers:['MECHANISM_PROSE','DET:'+def[1]]},start:0,end:o.end});}
 for(const [forms,predicate] of MOTION){
  const re=new RegExp('(?<![a-z])(?:'+forms+')(?![a-z-])((?: [a-z]+mente)?) ('+PREP+')','g');
  for(const m of t.matchAll(re)){
   const subj=npBefore(t,m.index!);if(!subj)continue;
   const target=npAfter(t,m.index!+m[0].length);if(!target)continue;
   const clauseEnd=target.end;if(SKIP.test(t.slice(subj.start,clauseEnd)))continue;
   const s=orig(subj.start,subj.end),o=orig(m.index!+m[0].length-m[2].length,target.end);
   const fact={...base(s.text,'PROCESS',predicate,o.text),qualifiers:['MECHANISM_PROSE',...(subj.det?['DET:'+subj.det]:[]),...(predicate==='TRANSFORM'?['TRANSFORMATION']:[])]};
   out.push({fact,start:s.start,end:target.end===o.end?o.end:o.end});
   const after=t.slice(clauseEnd),cause=after.match(/^[^.;]*?(?<![a-z])(devido|gracas|por causa) ((?:a|ao|aos|as|d(?:e|a|o|as|os)) )/);
   if(cause){const c=npAfter(t,clauseEnd+cause[0].length,8);if(c){const co=orig(clauseEnd+cause[0].length-cause[2].length,c.end);out.push({fact:{...base(s.text,'RELATION','CAUSED_BY',co.text),qualifiers:['MECHANISM_PROSE','CAUSE_OF_'+predicate,'CONNECTOR:'+cause[1]]},start:s.start,end:co.end});}}
  }
 }
 return out;
}
const titleTokens=(s:SourceDocument)=>new Set(words(normalize(s.title.split(/\s[–—-]\s/)[0]).replace(/[^a-z0-9 ]+/g,' ')));
/** Topicality: every content word of the requested subject appears in the document title. */
export function sourceAboutSubject(s:SourceDocument,plan:ResearchPlan){
 const subject=words(normalize(topicSubject(plan.request.topic)).replace(/[^a-z0-9 ]+/g,' ')).filter(w=>w.length>2&&!STOP.has(w));
 if(!subject.length)return false;const title=titleTokens(s);return subject.every(w=>title.has(w));
}
const key=(prefix:string,x:unknown)=>prefix+'_'+jsonHash(x).slice(0,20);
export function extractMechanismEvidence(s:SourceDocument,plan:ResearchPlan):{evidence:Evidence[];candidates:FactCandidate[]}{
 const evidence:Evidence[]=[],candidates:FactCandidate[]=[];
 if(plan.request.researchGoal!=='PROCESS'||s.language!=='pt-BR'||!sourceAboutSubject(s,plan))return{evidence,candidates};
 const text=s.normalized.text;
 for(const line of text.matchAll(/[^\n]+/g)){const raw=line[0];if(raw.includes('\t'))continue;
  for(const part of raw.matchAll(/[\s\S]+?(?:[.!?](?=\s|$)|$)/g)){const sentence=part[0].trim();if(sentence.length<20||sentence.length>600)continue;const at=line.index!+part.index!+part[0].indexOf(sentence);
   for(const m of mechanismFacts(sentence)){
    const span=sourceSpan(s,at+m.start,at+m.end),r={version:1 as const,id:key('EV',{source:s.id,hash:s.contentHash,span,type:m.fact.factType,mechanism:MECHANISM_EXTRACTOR_VERSION,fact:m.fact}),sourceId:s.id,sourceSpan:span,exactText:span.text,normalizedText:text.slice(at+m.start,at+m.end),evidenceType:m.fact.factType,supports:m.fact,extractionConfidence:'MEDIUM' as const,truthStatus:'EXTRACTED' as const,extractionMethod:'MECHANISM_PT_V1' as const,contentHash:s.contentHash,table:null};
    if(evidence.some(e=>e.id===r.id))continue;const e={...r,fingerprint:jsonHash(r)};evidence.push(e);
    const c={id:key('FC',{fact:m.fact,evidence:e.id}),canonicalFact:structuredClone(m.fact),evidenceIds:[e.id],extractionConfidence:'MEDIUM' as const,status:'EXTRACTED' as const};candidates.push({...c,fingerprint:jsonHash(c)});
   }
  }
 }
 return{evidence,candidates};
}
