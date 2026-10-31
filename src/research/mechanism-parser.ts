import {normalize} from '../semantics/normalize';
import {jsonHash} from '../editorial/fingerprint';
import type {CanonicalFact} from './contracts';
import {mechanismRules,negativeMechanism,unsafeMechanism} from './mechanism-language';
import {contextualModality,contextualSafetyRefusal} from './mechanism-clauses';

export interface ClauseSpan {start:number;end:number;text:string}
export interface MechanismParseProof {
 subject:ClauseSpan;trigger:ClauseSpan;argument:ClauseSpan;
 qualifiers:{kind:string;span:ClauseSpan}[];binding:string;
 route?:{group:string;step:number;role:'SOURCE'|'PATH'|'DESTINATION';actor:string};
}
export interface ClauseCandidate {fact:CanonicalFact;parse:MechanismParseProof}
export interface ClauseDiagnostic {code:string;subject:ClauseSpan|null;trigger:ClauseSpan|null;argument:ClauseSpan|null;detail:string}
interface Token extends ClauseSpan {fold:string}
const articles=new Set(['a','o','as','os','um','uma','the','an']);
const pathHeads=new Set(['duct','conduit','pipe','tube','channel','passage','track','rail','path','route','canal','conduto','duto','tubo','trilho','caminho','corredor']);
/** Lexemes and syntax are shared across domains. No document/benchmark nouns,
 * global aliases or inferred source/destination participants live here. */
const lexicon=[
 {predicate:'MOVE',pattern:'(?:e|sao|is|are) (?:conduzid[oa]s?|transportad[oa]s?|led|carried|transported)',passiveRoute:true},
 {predicate:'EXIT',pattern:'escapa|escapam'},
 {predicate:'CONNECTED_TO',pattern:'conecta|conectam|connects?'},
 ...mechanismRules.filter(r=>r.predicate!=='IS_A')
];
export function parseMechanismSentence(text:string){
 const tokens:Token[]=[...text.matchAll(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’–-][\p{L}\p{M}\p{N}]+)*|[^\s]/gu)].map(m=>({start:m.index!,end:m.index!+m[0].length,text:m[0],fold:normalize(m[0])}));
 const candidates:ClauseCandidate[]=[],diagnostics:ClauseDiagnostic[]=[];
 const span=(a:number,b:number):ClauseSpan=>{const start=tokens[a]?.start??text.length,end=tokens[b-1]?.end??start;return{start,end,text:text.slice(start,end)};};
 const diag=(code:string,subject:ClauseSpan|null,trigger:ClauseSpan|null,argument:ClauseSpan|null,detail:string)=>diagnostics.push({code,subject,trigger,argument,detail});
 const normalized=normalize(text),modality=contextualModality(text);
 if(negativeMechanism.test(normalized)){diag('NEGATION_REFUSAL',null,null,null,'Negative proposition retained as source data; no faithful affirmative replacement');return{tokens,candidates,diagnostics};}
 if(unsafeMechanism.test(normalized)||contextualSafetyRefusal(text)||text.length>1200){diag('CLAUSE_BOUNDARY_REFUSAL',null,null,null,'Question/instruction/history/size guard');return{tokens,candidates,diagnostics};}
 if(/[\d=<>%{}]/.test(normalized)){diag('QUALIFIER_UNBOUND',null,null,null,'Numeric dimensioning is outside this bounded grammar');return{tokens,candidates,diagnostics};}
 let folded='',map:number[]=[];for(let i=0;i<tokens.length;i++){if(i){folded+=' ';map.push(i);}folded+=tokens[i].fold;map.push(...Array(tokens[i].fold.length).fill(i));}
 type Trigger={a:number;b:number;predicate:string;reverse:boolean;passiveRoute:boolean};
 const triggers:Trigger[]=[];
 for(const rule of lexicon)for(const m of folded.matchAll(new RegExp('\\b(?:'+rule.pattern+')\\b','g'))){const a=map[m.index!],b=map[m.index!+m[0].length-1]+1;if(triggers.some(t=>a>=t.a&&a<t.b))continue;triggers.push({a,b,predicate:rule.predicate,reverse:'reverse'in rule&&Boolean(rule.reverse),passiveRoute:'passiveRoute'in rule&&Boolean(rule.passiveRoute)});}
 triggers.sort((a,b)=>a.a-b.a||b.b-a.b);
 const verbs=triggers.filter((t,i)=>!triggers.slice(0,i).some(p=>t.a>=p.a&&t.a<p.b));
 if(!verbs.length){
  const cmp=tokens.findIndex(t=>['higher','lower','maior','menor'].includes(t.fold));
  const passive=tokens.findIndex((t,i)=>['sao','e','is','are'].includes(t.fold)&&/^[a-z]/.test(tokens[i+1]?.fold??''));
  if(cmp>=0){const c=cmp>0&&['is','are','e','sao'].includes(tokens[cmp-1].fold)?cmp-1:cmp;diag('QUALIFIER_UNBOUND',span(0,c),span(c,cmp+1),span(cmp+1,tokens.length),'Comparison has no faithful existing state predicate; never implies cause');}
  else if(passive>=0){const subject=span(0,passive),adverb=/^(?:geralmente|normalmente|usually|generally|sometimes)$/i.test(subject.text);diag(adverb?'SUBJECT_NOT_FOUND':'RELATION_NOT_FOUND',adverb?null:subject,span(passive,passive+2),null,'Passive morphology observed; no implicit actor or unsupported passive relation emitted');}
  else diag('RELATION_NOT_FOUND',null,null,null,'No supported finite trigger');return{tokens,candidates,diagnostics};
 }
 const qualifiers:{kind:string;span:ClauseSpan}[]=[];
 for(const m of text.matchAll(/\b(?:may|can|might|usually|sometimes|typically|generally|geralmente|normalmente|podem?|pode|if|when|quando|se|sob|under)\b/gi))qualifiers.push({kind:/^(?:if|when|quando|se|sob|under)$/i.test(m[0])?'CONDITION':'MODALITY',span:{start:m.index!,end:m.index!+m[0].length,text:m[0]}});
 let actorStart=0,actorEnd=verbs[0].a,qualifiedActor:ClauseSpan|null=null;
 const commas=tokens.slice(0,actorEnd).map((t,i)=>t.text===','?i:-1).filter(i=>i>=0);
 // Prefix locative: it is context, not the actor or an invented physical edge.
 if(/^(?:em|no|na|inside|at|through)$/i.test(tokens[0]?.text??'')){
  const comma=commas[0];let cut=comma===undefined?-1:comma+1;
  if(cut<0)for(let i=2;i<actorEnd;i++)if(articles.has(tokens[i].fold)){cut=i;break;}
  if(cut<0){diag('SUBJECT_NOT_FOUND',null,span(verbs[0].a,verbs[0].b),null,'Locative frame lacks a separate explicit actor');return{tokens,candidates,diagnostics};}
  qualifiers.push({kind:'LOCATIVE',span:span(0,comma??cut)});actorStart=cut;
 }
 const actorCommas=commas.filter(i=>i>=actorStart);
 if(actorCommas.length>=2){
  const [a,b]=actorCommas,desc=span(a+1,b),relative=/^(?:que|which|that)\b/i.test(desc.text);
  if(!relative&&!/^(?:um|uma|a|an)\s|^[\p{L}]+(?:ado|ada|ados|adas|ido|ida|ed)\s+(?:a|ao|à|com|to|with)\b/iu.test(desc.text)){diag('AMBIGUITY_REFUSAL',span(actorStart,a),span(verbs[0].a,verbs[0].b),desc,'Apposition is not an unambiguous local modifier');return{tokens,candidates,diagnostics};}
  qualifiers.push({kind:relative?'BOUNDED_RELATIVE':'APPOSITION',span:desc});actorEnd=a;
 }
 // Restrictive relative followed by a main finite clause: keep the qualified
 // actor as a whole. Never alias it globally to the unqualified noun.
 const rel=tokens.findIndex((t,i)=>i>=actorStart&&i<verbs[0].a&&['que','which','that'].includes(t.fold));
 if(rel>=0){
  if(verbs.length<2||/\b(?:perto|near|with|beside|junto)\b/.test(normalize(span(actorStart,rel).text))){diag('AMBIGUITY_REFUSAL',span(actorStart,rel),span(verbs[0].a,verbs[0].b),null,'Relative antecedent/main clause not uniquely bounded');return{tokens,candidates,diagnostics};}
  qualifiedActor=span(actorStart,verbs[1].a);actorEnd=rel;
 }
 while(actorEnd>actorStart&&['can','may','might','pode','podem','deve','devera'].includes(tokens[actorEnd-1].fold))actorEnd--;
 const actor=qualifiedActor??span(actorStart,actorEnd);
 if(!actor.text||/^(?:ele|ela|eles|elas|it|they|this|that|se|quando|if|when)\b/i.test(actor.text)||/\b(?:e|and|ou|or|perto|near)\b/.test(normalize(span(actorStart,actorEnd).text))){diag('SUBJECT_NOT_FOUND',actor,span(verbs[0].a,verbs[0].b),null,'No single explicit local subject');return{tokens,candidates,diagnostics};}
 const group='ROUTE_'+jsonHash([text,actor.text]).slice(0,16);
 const pending:{candidate:ClauseCandidate;role:'SOURCE'|'PATH'|'DESTINATION'}[]=[];
 const emit=(predicate:string,subject:ClauseSpan,argument:ClauseSpan,trigger:ClauseSpan,binding:string,role?:'SOURCE'|'PATH'|'DESTINATION')=>{
  if(!argument.text.trim()||/^(?:[.,;]|e|and|ou|or)$/.test(argument.text.trim())){diag('ARGUMENT_NOT_FOUND',subject,trigger,argument,'Finite trigger has no complete argument');return;}
  const fact:CanonicalFact={factType:predicate==='CONNECTED_TO'?'RELATION':'PROCESS',subject:subject.text,predicate,object:argument.text,quantity:null,metric:null,temporalContext:null,residency:null,qualifiers:['MECHANISM_PROSE','MECHANISM_V2','CONTEXTUAL_MECHANISM','CONTEXTUAL_PARSER_V1','MODALITY:'+modality,...qualifiers.map(q=>q.kind+':'+q.span.text)]};
  const candidate:ClauseCandidate={fact,parse:{subject,trigger,argument,qualifiers:[...qualifiers],binding}};
  candidates.push(candidate);if(role)pending.push({candidate,role});diag('CANDIDATE_EMITTED',subject,trigger,argument,binding);
 };
 let structural=actorCommas.length>=2||rel>=0||actorStart>0||verbs.length>1;
 for(let vi=0;vi<verbs.length;vi++){
  const v=verbs[vi],trigger=span(v.a,v.b);let a=v.b,b=vi+1<verbs.length?verbs[vi+1].a:tokens.length;
  while(b>a&&/[.;,]/.test(tokens[b-1].text))b--;
  // At the next verb only explicit coordination or the bounded relative's
  // main-clause boundary may carry the subject.
  if(vi+1<verbs.length){if(qualifiedActor&&vi===0)b=verbs[1].a;else{let conjunction=-1;for(let j=a;j<b;j++)if(['e','and'].includes(tokens[j].fold))conjunction=j;if(conjunction<0){diag('CLAUSE_BOUNDARY_REFUSAL',actor,trigger,span(a,b),'No explicit subject-sharing coordinator');return{tokens,candidates,diagnostics};}if(conjunction!==b-1){diag('AMBIGUITY_REFUSAL',actor,trigger,span(conjunction+1,b),'Second predicate has an intervening actor/attachment');return{tokens,candidates,diagnostics};}b=conjunction;}}
  if(vi>0&&!qualifiedActor){const previous=verbs[vi-1];const between=tokens.slice(previous.b,v.a);if(!between.some(t=>['e','and'].includes(t.fold))){diag('CLAUSE_BOUNDARY_REFUSAL',actor,trigger,null,'No bounded subject carry');continue;}}
  while(b>a&&['.',',',';'].includes(tokens[b-1].text))b--;
  if(b<=a){diag('ARGUMENT_NOT_FOUND',actor,trigger,null,'Finite trigger lacks its argument');continue;}
  if(tokens[a]&&/(?:mente|ly)$/.test(tokens[a].fold)){qualifiers.push({kind:'MANNER',span:span(a,a+1)});a++;}
  if(qualifiedActor&&vi===0){emit(v.predicate,actor,span(a,b),trigger,'RESTRICTIVE_RELATIVE_QUALIFIED_ACTOR','SOURCE');continue;}
  const rolePoints:{a:number;b:number;role:'SOURCE'|'PATH'|'DESTINATION'}[]=[];
  const relativeBoundary=tokens.findIndex((t,i)=>i>=a&&i<b&&['que','which','that'].includes(t.fold));
  const scanEnd=relativeBoundary<0?b:relativeBoundary;
  // Existing passive patterns sometimes consume the route preposition.
  let scanStart=a;while(scanStart>v.a+1&&['de','do','da','por','pelo','pela','through','from','to','via','atraves'].includes(tokens[scanStart-1]?.fold))scanStart--;
  for(let j=scanStart;j<scanEnd;j++){
   const f=tokens[j].fold,next=tokens[j+1]?.fold;
   if(['para','ate','to','into'].includes(f)){rolePoints.push({a:j,b:j+1,role:'DESTINATION'});}
   else if(['from','desde'].includes(f)||f==='vindo'&&next==='de'){rolePoints.push({a:j,b:j+(f==='vindo'?2:1),role:'SOURCE'});if(f==='vindo')j++;}
   else if(['through','via'].includes(f)||f==='atraves'&&next==='de'){rolePoints.push({a:j,b:j+(f==='atraves'?2:1),role:'PATH'});if(f==='atraves')j++;}
   else if(['por','pelo','pela'].includes(f)&&j===scanStart){let head=j+1;while(head<scanEnd&&articles.has(tokens[head].fold))head++;if(pathHeads.has(tokens[head]?.fold))rolePoints.push({a:j,b:j+1,role:'PATH'});else if(v.passiveRoute){diag('AMBIGUITY_REFUSAL',actor,trigger,span(j,b),'Passive agent versus physical path is unresolved');}}
  }
  // A from/to route has one explicit source. "of" inside noun phrases is
  // never interpreted as an origin. Repeated destination roles stay refused.
  if(rolePoints.some((p,i)=>rolePoints.slice(0,i).some(x=>x.role===p.role))){diag('ARGUMENT_NOT_FOUND',actor,trigger,span(a,b),'Multiple route arguments with unresolved direction');continue;}
  if(rolePoints.length&&['FLOW','MOVE','ENTER','EXIT','PASSES_THROUGH','RISE','DESCEND'].includes(v.predicate)){
   structural=true;for(let j=0;j<rolePoints.length;j++){const p=rolePoints[j],end=j+1<rolePoints.length?rolePoints[j+1].a:b;const arg=span(p.a,end);emit(p.role==='PATH'?'PASSES_THROUGH':v.predicate==='FLOW'?'FLOW':'MOVE',actor,arg,trigger,'EXPLICIT_ROUTE_ROLE',p.role);}continue;
  }
  if(v.passiveRoute){diag('ARGUMENT_NOT_FOUND',actor,trigger,span(a,b),'No safely identified route for passive transport');continue;}
  if(v.reverse){if(verbs.length>1){diag('CLAUSE_BOUNDARY_REFUSAL',actor,trigger,span(a,b),'Passive coordination does not carry its agent');continue;}emit(v.predicate,span(a,b),actor,trigger,'EXPLICIT_PASSIVE_AGENT');continue;}
  if(v.predicate==='CONNECTED_TO'){
   const conj=tokens.findIndex((t,i)=>i>=a&&i<b&&['e','and'].includes(t.fold));
   if(conj>=0&&!tokens.slice(a,b).some(t=>['ou','or'].includes(t.fold))){structural=true;emit(v.predicate,actor,span(a,conj),trigger,'COORDINATED_ARGUMENT');emit(v.predicate,actor,span(conj+1,b),trigger,'COORDINATED_ARGUMENT');continue;}
  }
  if(structural)emit(v.predicate,actor,span(a,b),trigger,'BOUNDED_SHARED_SUBJECT');
  else diag('LEGACY_SIMPLE_CLAUSE',actor,trigger,span(a,b),'Delegated to the existing literal grammar');
 }
 // A route is ordered only by explicit local source/path/destination roles,
 // not by source sentence order or a shared subject in separate paragraphs.
 if(pending.length>=2){const roles=pending.map(p=>p.role);if(roles.filter(r=>r==='DESTINATION').length<=1&&roles.at(-1)==='DESTINATION')pending.forEach((p,step)=>p.candidate.parse.route={group,step,role:p.role as 'SOURCE'|'PATH'|'DESTINATION',actor:actor.text});}
 return{tokens,candidates,diagnostics};
}
