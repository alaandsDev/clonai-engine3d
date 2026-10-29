import {normalize} from '../semantics/normalize';
import {mechanismModality,negativeMechanism,unsafeMechanism} from './mechanism-language';
import type {CanonicalFact} from './contracts';

/** Observed local constructions, not a topic dictionary. The parent sentence
 * remains the support window. There is no transitive or commonsense inference. */
export const localActionRules=[
 {predicate:'EXPEL',pattern:'expele|expelem|expulsa|expulsam|expels?|ejects?'},
 {predicate:'PUSH',pattern:'empurra|empurram|pushes?|push'},
 {predicate:'ROTATE',pattern:'gira|giram|rotates?|turns?'},
 {predicate:'COMPRESS',pattern:'comprime|comprimem|compresses?|compress'},
];
export const cleanMechanismActor=(s:string)=>s.trim().replace(/^[-–—•]\s*/,'').replace(/^(?:Em seguida|Primeiro|Depois|Então|Finalmente|Then|First|Next|Finally)\s+/i,'').trim();
export interface LocalMechanismRelation {fact:CanonicalFact;text:string;resolution:'EXPLICIT_RELATION'|'CONTEXT_RESOLVED_RELATION'}
export const contextualModality=(text:string)=>mechanismModality(text.replace(/([\p{L}])\s+se\s+(?=(?:move|movem|transforma|transformam)\b)/giu,'$1 '));
export const contextualSafetyRefusal=(text:string)=>/\b(?:metafora|metaphor|figurativamente|figuratively|comparado|compared|como se|as if)\b|\b(?:foi|foram|was|were) (?:criad|construid|inventad|created|built|invented)/.test(normalize(text));
export const unsupportedSentenceRank=(text:string)=>/\b(?:mais (?:utilizad|segur|conhecid|eficient)|most (?:used|popular|common|efficient|safe))\w*/.test(normalize(text));
export function localMechanismClauses(text:string):LocalMechanismRelation[]{
 const t=normalize(text),out:LocalMechanismRelation[]=[];
 if(negativeMechanism.test(t.replace(/['’]/g,''))||unsafeMechanism.test(t)||/[\d=<>%{}]/.test(t)||text.length>1200||contextualSafetyRefusal(text))return out;
 const add=(subject:string,predicate:string,object:string,type:CanonicalFact['factType'],resolution:LocalMechanismRelation['resolution']='EXPLICIT_RELATION',surface=text)=>{
  subject=cleanMechanismActor(subject);object=object.trim().replace(/[.;]+$/,'').trim();
  if(!subject||!object||subject.length>180||object.length>400||unsupportedSentenceRank(surface)||/\b(?:em|de|do|da|in|of|with|to)$/i.test(object)||/^(?:ele|ela|eles|elas|isso|isto|o qual|a qual|it|this|that|they|which|se|quando|caso|if|when|unless)\b/i.test(subject))return;
  const fact:CanonicalFact={factType:type,subject,predicate,object,quantity:null,metric:null,temporalContext:null,residency:null,qualifiers:['MECHANISM_PROSE','MECHANISM_V2','CONTEXTUAL_MECHANISM','MODALITY:'+contextualModality(text)]};
  if(!out.some(r=>r.fact.subject===subject&&r.fact.predicate===predicate&&r.fact.object===object))out.push({fact,text:surface,resolution});
 };
 // Semicolon/comma clauses with an explicit repeated subject. Purpose is not
 // labelled CAUSES, and no historical reason is fabricated.
 for(const p of text.split(/[;,]/)){
  const m=p.trim().match(/^(.{2,100}?)\s+(?:tem a função de|tem por finalidade|tem a finalidade de|serves to|has the function of|is responsible for)\s+(.+)$/i);
  if(m&&!/\b(?:que|qual|porque|because|permite|permitir|atraves)\b/.test(normalize(m[1])))add(m[1],'USED_FOR',m[2],'RELATION');
 }
 // Definition-style list labels are explicit structural definitions; labels
 // are not automatically facts about the requested system as a whole.
 const label=text.match(/^(.{2,90}?)\s+[—–]\s+((?:Componente|Parte|Local|Component|Part|Place)\b[^,;.]*)/i);
 if(label){
  const desc=label[2].split(/\s+(?:na qual|no qual|onde|where|in which)\b/i)[0];add(label[1],'IS_A',desc,'DEFINITION');
  const located=text.match(/(?:na qual|no qual|onde|in which|where)\s+(.{2,70}?)\s+(?:se move|se movem|moves?)\b/i);
  if(located)add(located[1],'MOVE_WITHIN',label[1],'PROCESS','CONTEXT_RESOLVED_RELATION');
 }
 // An equative relative has a single explicit antecedent: X is a Y which V.
 // An alias appositive is removed only when it says "also known as".
 let frame=text;
 if(/também conhecid[oa] como|also known as/i.test(frame))frame=frame.replace(/,\s*(?:também conhecid[oa] como|also known as)[\s\S]*?,\s*(?=(?:é|são|is|are)(?:\s|$))/i,' ');
 frame=frame.replace(/\((?:português brasileiro|português europeu|Brazilian Portuguese|European Portuguese)\)/gi,' ').replace(/\s+/g,' ').trim();
 const relative=frame.match(/^(.{2,150}?)\s+(?:é|são|is|are)\s+((?:um|uma|a|an)\s+.{2,75}?)\s+(?:que|which|that)\s+(.+)$/i);
 if(relative){
  const actor=relative[1],category=relative[2],tail=relative[3];
  if(!/\b(?:ele|ela|it|they)\b/.test(normalize(actor))&&category.split(/\s+/).length<=4&&!/\b(?:de|do|da|com|em|in|perto|with|near|and|e)\b/.test(normalize(category))){
   add(actor,'IS_A',category,'DEFINITION','CONTEXT_RESOLVED_RELATION');
   for(const rule of localActionRules){const m=normalize(tail).match(new RegExp('^(?:'+rule.pattern+')\\s+'));if(m){const object=tail.slice(m[0].length);add(actor,rule.predicate,object,'PROCESS','CONTEXT_RESOLVED_RELATION');
    const purpose=object.match(/\s+(?:para|to)\s+(.+)$/i);if(purpose)add(actor,'USED_FOR',purpose[1],'RELATION','CONTEXT_RESOLVED_RELATION');}}
   const purpose=tail.match(/^(?:tem por finalidade|tem a finalidade de|has the purpose of)\s+(.+)$/i);if(purpose)add(actor,'USED_FOR',purpose[1],'RELATION','CONTEXT_RESOLVED_RELATION');
  }
 }
 // Operational main clause. The dependent relative is not assigned an actor
 // when its attachment is ambiguous (e.g. pressure of a fluid which rotates).
 const operation=frame.match(/^(.{2,100}?)\s+(?:funciona|funcionam|operates?|works?)\s+(através d[aoe]|por meio d[aoe]|through|using)\s+(.+?)(?=\s+que\s+|,|[.;]|$)/i);
 if(operation){
  const embedded=/\s(?:que|which|that)\s/i.test(frame);
  // A following gerund can refer to the main or embedded participant. Do not
  // resolve it to the main subject. Narrate only the explicit main clause,
  // and only if it is asserted; never truncate a conditional qualification.
  if(!embedded||contextualModality(text)==='ASSERTED')add(operation[1],'OPERATE_BY',operation[3],'PROCESS','EXPLICIT_RELATION',embedded?operation[0].trim().replace(/[.;]+$/,'')+'.':text);
  const change=frame.match(/,\s*(?:transformando|converting|transforming)\s+(.+)$/i);
  if(change&&!embedded)add(operation[1],'TRANSFORM',change[1],'PROCESS','CONTEXT_RESOLVED_RELATION');
 }
 // Nominal process groups followed by another group. Only the group order is
 // stated; enumeration order inside either group is deliberately not inferred.
 const order=text.match(/(?:operações|etapas|stages|steps)\s+(?:unitárias\s+)?(?:de|of)\s+(.+?),?\s+(?:seguidas?|followed)\s+(?:pela|pelo|por|by)\s+(.+)$/i);
 if(order){const before=order[1].replace(/\s+(?:são|sao|are|is)$/i,''),after=order[2].trim().replace(/[.;]+$/,'');const controlled=/\b(?:steps|stages)\b/i.test(order[0])?'The stages of '+before+' are followed by '+after+'.':'As etapas de '+before+' são seguidas por '+after+'.';add(before,'PRECEDES',after,'RELATION','CONTEXT_RESOLVED_RELATION',contextualModality(text)==='ASSERTED'?controlled:text);}
 return out;
}
