import {jsonHash} from '../editorial/fingerprint';
import {ingestScript,sentenceSpans} from '../script-mode/ingest';
import {understandScript} from '../script-mode/understand';
import {selectDemonstrations} from '../visual-causal/demonstrations';
/** Curiosity-Driven Progressive Scripting (pt-BR, deterministic, no LLM).
 * Input: an explanatory text whose sentences are true statements. Output: the SAME statements reorganised as
 * curiosity loops. Allowed operations only:
 *  - move an observation/consequence to the opening when it contrasts with the opening question (paradox hook),
 *    keeping it in place as the closing callback;
 *  - drop sentence-initial school connectors (depois, em seguida, para isso…);
 *  - insert editorial questions/bridges built from words already in the text plus a closed function vocabulary,
 *    each question answered by a later statement (otherwise it is not inserted);
 *  - replace a leading subject with a pronoun right after a bridge that names it.
 * Facts are never added, changed or dropped; an audit enforces it. */
export const PROGRESSIVE_WRITER_VERSION='progressive-writer/1.0.0';
export type LoopRole='HOOK_OBSERVATION'|'QUESTION'|'CONTRADICTION'|'PARTIAL_ANSWER'|'NEXT_QUESTION'|'REVEAL'|'MECHANISM'|'CONSEQUENCE'|'PAYOFF';
export type HookType='PARADOX'|'WHY'|'HOW'|'COMMON_MISCONCEPTION'|'HIDDEN_MECHANISM'|'STATEMENT';
export interface ProgressiveUnit {id:string;kind:'FACT'|'EDITORIAL';role:LoopRole;text:string;sourceIndex:number|null;answeredBy?:string;operation?:string;
 /** Set by the retention pass when one unit carries several source statements. */
 sourceIndices?:number[]}
export interface CuriosityLoop {id:string;opening:string;openedBy:string;closedBy:string|null;unitIds:string[];roles:LoopRole[]}

export const fold=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const words=(s:string):string[]=>fold(s).match(/[a-z0-9]+/g)??[];
const cap=(s:string)=>s.charAt(0).toUpperCase()+s.slice(1);
const low=(s:string)=>s.charAt(0).toLowerCase()+s.slice(1);
export const wc=(s:string)=>s.split(/\s+/).filter(Boolean).length;
/** Sentence-initial connectors of manual-like sequencing. PURPOSE carries a goal that a HOW question can replace. */
const SCHOOL:[RegExp,'TEMPORAL'|'PURPOSE'|'CONSEQUENCE'][]=[
 [/^(?:depois|em seguida|na sequencia|logo apos|primeiro|por fim|alem disso|ai)\s*,?\s+/,'TEMPORAL'],
 [/^para (?:isso|isso acontecer|fazer isso|conseguir isso)\s*,?\s+/,'PURPOSE'],
 [/^(?:entao|assim)\s*,\s+/,'CONSEQUENCE'],
];
/** Generic contrast axes; a pole only counts when the text states it. */
const AXES:{axis:string;a:RegExp;b:RegExp}[]=[
 {axis:'TEMPERATURE',a:/\b(?:quente|quentes|esquent\w*|aquec\w*|ferve\w*)\b/,b:/\b(?:frio|fria|frios|frias|gelad\w*|esfri\w*|gelo)\b/},
 {axis:'INSIDE_OUTSIDE',a:/\b(?:dentro|interior|interno|interna)\b/,b:/\b(?:fora|exterior|externo|externa|tras|traseira)\b/},
 {axis:'SIZE',a:/\b(?:pequen\w*|minuscul\w*)\b/,b:/\b(?:grande|grandes|enorme\w*|maior)\b/},
 {axis:'WEIGHT',a:/\b(?:leve|leves)\b/,b:/\b(?:pesad\w*)\b/},
 {axis:'HEIGHT',a:/\b(?:sobe|sobem|subiu|alto|alta|cima)\b/,b:/\b(?:desce|descem|cai|caem|baixo|baixa)\b/},
 {axis:'SPEED',a:/\b(?:rapid\w*)\b/,b:/\b(?:lent\w*|devagar)\b/},
 {axis:'OPEN_CLOSED',a:/\b(?:abert\w*|abre)\b/,b:/\b(?:fechad\w*|fecha)\b/},
 {axis:'FULL_EMPTY',a:/\b(?:chei\w*|enche)\b/,b:/\b(?:vazi\w*|esvazia)\b/},
 {axis:'VISIBILITY',a:/\b(?:visivel|aparece\w*)\b/,b:/\b(?:escondid\w*|invisivel|oculto)\b/},
];
const poles=(t:string)=>{const f=fold(t);return AXES.flatMap(x=>[...(x.a.test(f)?[x.axis+':A']:[]),...(x.b.test(f)?[x.axis+':B']:[])]);};
const flip=(x:string)=>x.endsWith(':A')?x.slice(0,-2)+':B':x.slice(0,-2)+':A';
const opposite=(p:string[],q:string[])=>[...new Set(p.filter(x=>q.includes(flip(x))).map(x=>x.split(':')[0]))];
const ARTICLE=/^(o|a|os|as|um|uma)$/i;
const FUNCTION=new Set(['a','o','as','os','um','uma','esse','essa','este','esta','isso','de','do','da','dos','das','em','no','na','nos','nas','para','pelo','pela','pelos','pelas','por','com','ao','aos']);
/** Leading noun phrase: article + noun (+ one modifier when the next word is the verb followed by a function word). */
function leadingNP(sentence:string){
 const t=sentence.split(/\s+/);if(t.length<3||!ARTICLE.test(t[0]))return null;
 const noun=t[1].replace(/[,:;.]$/,'');if(noun!==t[1]||noun.length<3)return null;
 // Modifier only if word2 and word3 both look like content words and word4 is a function word (… estreita baixa a …).
 const modifier=t.length>4&&!FUNCTION.has(fold(t[2]))&&!FUNCTION.has(fold(t[3]))&&FUNCTION.has(fold(t[4]))&&!/[,:;.]$/.test(t[2])&&!/[,:;.]$/.test(t[3]);
 const np=t.slice(0,modifier?3:2).join(' '),fem=/^(a|as|uma)$/i.test(t[0]);
 return{np,head:fold(noun),fem,plural:/^(os|as)$/i.test(t[0]),rest:t.slice(modifier?3:2).join(' ')};
}
const CONTROL_OFF:Record<string,[string,string]>={desliga:['ligado','ligada'],fecha:['aberto','aberta'],apaga:['aceso','acesa']};
const TAKE=/\b(?:absorve|recebe|retira|tira|carrega|captura|puxa)\s+((?:o|a|os|as|esse|essa)\s+[a-z\u00c0-\u00ff]+)/i;
const RELEASE=/\b(?:perde|solta|libera|joga|devolve|entrega)\b/;
/** Closed vocabulary editorial units may use besides words already present in the source. */
const EDITORIAL_WORDS=new Set(['mas','e','como','isso','faz','acontece','aqui','ai','que','entra','agora','em','cena','para','onde','vai','esse','essa','fica','o','a','tempo','todo','ele','ela','eles','elas','ligado','ligada','aberto','aberta','aceso','acesa','e','so']);

export interface ProgressiveScript {version:string;source:string;script:string;units:ProgressiveUnit[];loops:CuriosityLoop[];hookType:HookType;paradoxes:{axes:string[];observationIndex:number;questionIndex:number}[];
 questions:{id:string;text:string;answeredBy:string|null;distance:number|null}[];audit:{passed:boolean;factsPreserved:boolean;missingFacts:number[];newEditorialWords:string[];unansweredQuestions:string[]};fingerprint:string}

export function writeProgressive(source:string):ProgressiveScript{
 const sents=sentenceSpans(source).map(s=>s.text.trim()).filter(Boolean);
 const info=sents.map((text,i)=>{const f=fold(text);let connector:null|'TEMPORAL'|'PURPOSE'|'CONSEQUENCE'=null,body=text;
  for(const [re,kind] of SCHOOL){const m=f.match(re);if(m){connector=kind;body=cap(text.slice(m[0].length));break;}}
  return{i,text,body,connector,question:/\?\s*$/.test(text),negation:/\bnao\b/.test(f)&&!/\?\s*$/.test(text),consequence:/^(?:e )?(?:por isso|e por isso)\b/.test(f),condition:/^quando\b/.test(fold(body)),poles:poles(text)};});
 // ---- Hook: an opening question/observation contradicted by a later stated observation (paradox) ----
 const openIdx=info.findIndex(x=>x.question);
 let paradox:{axes:string[];observationIndex:number;questionIndex:number}|null=null;
 if(openIdx>=0&&openIdx<=1)for(let j=info.length-1;j>openIdx+2&&!paradox;j--){const axes=opposite(info[openIdx].poles,info[j].poles);
  const shared=words(info[openIdx].text).filter(w=>w.length>=5&&words(info[j].text).includes(w));
  if(!info[j].question&&(axes.length>=2||(axes.length===1&&shared.length>0)))paradox={axes,observationIndex:j,questionIndex:openIdx};}
 const units:ProgressiveUnit[]=[];let n=0;const uid=()=>'U'+(++n);
 const add=(u:Omit<ProgressiveUnit,'id'>)=>{const x:ProgressiveUnit={id:uid(),kind:u.kind,role:u.role,text:u.text,sourceIndex:u.sourceIndex,...(u.operation?{operation:u.operation}:{})};units.push(x);return x;};
 const seen=new Set<string>();const see=(t:string)=>words(t).forEach(w=>seen.add(w));
 const pendingQ:{unit:ProgressiveUnit;answerIndex:number}[]=[];
 let hookType:HookType='STATEMENT',hookQuestion:ProgressiveUnit|null=null;
 if(paradox){
  const obs=info[paradox.observationIndex],observed=cap(obs.body.replace(/^(?:e )?(?:é )?por isso,?\s*/i,'').replace(/^É por isso que\s*/i,''));
  add({kind:'FACT',role:'HOOK_OBSERVATION',text:observed,sourceIndex:obs.i,operation:'OBSERVATION_MOVED_TO_HOOK'});see(observed);
  hookQuestion=add({kind:'FACT',role:'QUESTION',text:'Mas '+low(info[paradox.questionIndex].text),sourceIndex:paradox.questionIndex,operation:'CONTRAST_MARKER'});see(info[paradox.questionIndex].text);
  hookType='PARADOX';
 }else if(openIdx>=0){const q=fold(info[openIdx].text);hookType=/\bpor que\b/.test(q)?'WHY':/\bcomo\b/.test(q)?'HOW':'HIDDEN_MECHANISM';}
 if(!paradox&&openIdx>=0&&info[openIdx+1]?.negation)hookType='COMMON_MISCONCEPTION';
 const finalCallback=paradox?paradox.observationIndex:-1;
 let bridges=0,prevFact:typeof info[number]|null=null;
 for(const x of info){
  if(paradox&&x.i===paradox.questionIndex)continue;
  if(x.question&&x.i===openIdx&&!paradox){hookQuestion=add({kind:'FACT',role:'QUESTION',text:x.text,sourceIndex:x.i});see(x.text);prevFact=x;continue;}
  let body=x.body,role:LoopRole='MECHANISM',op:string|undefined=x.connector?'SCHOOL_CONNECTOR_REMOVED':undefined;
  // PURPOSE connector → a HOW question about the goal just stated, answered by this statement.
  if(x.connector==='PURPOSE'&&prevFact){const np=leadingNP(prevFact.body),pron=np?(np.fem?'ela':'ele'):null;
   const q=add({kind:'EDITORIAL',role:'NEXT_QUESTION',text:pron?`E como ${pron} faz isso?`:'E como isso acontece?',sourceIndex:null,operation:'PURPOSE_TO_HOW_QUESTION'});pendingQ.push({unit:q,answerIndex:x.i});role='REVEAL';}
  // A control statement ("quando …, X desliga Y") answers whether Y runs all the time.
  else if(x.condition){// The controlled part is the last one switched off in the sentence.
   const m=[...fold(body).matchAll(/\b(desliga|fecha|apaga)\s+(o|a)\s+([a-z]+)/g)].at(-1)??null;
   if(m&&seen.has(m[3])){const st=CONTROL_OFF[m[1]][m[2]==='a'?1:0],orig=body.match(new RegExp('\\b'+m[1]+'\\s+((?:o|a)\\s+\\S+?)[.,;]?(?:\\s|$)','i'));
    const q=add({kind:'EDITORIAL',role:'NEXT_QUESTION',text:`Mas ${(orig?.[1]??m[2]+' '+m[3]).replace(/[.,;]$/,'')} fica ${st} o tempo todo?`,sourceIndex:null,operation:'CONTROL_QUESTION'});pendingQ.push({unit:q,answerIndex:x.i});role='REVEAL';}}
  // A new part acting on something already present enters with a bridge (no question needed).
  else if(prevFact&&!x.consequence&&!x.question){const np=leadingNP(body);
   // The new part acts on something already introduced: verb + determiner + a known noun (or "do/da" + known noun).
   const acts=np?/^\S+\s+(?:o|a|os|as|esse|essa|este|esta)\s+(\S+)(?:\s+(?:do|da|dos|das)\s+(\S+))?/.exec(fold(np.rest)):null;
   if(np&&acts&&!seen.has(np.head)&&[acts[1],acts[2]].some(w=>w&&seen.has(w.replace(/[^a-z0-9]/g,'')))){
    const form=bridges%2===0?`É aí que entra ${low(np.np)}.`:`Agora entra em cena ${low(np.np)}.`;bridges++;
    add({kind:'EDITORIAL',role:'REVEAL',text:form,sourceIndex:null,operation:'COMPONENT_BRIDGE'});see(form);
    body=(np.plural?(np.fem?'Elas ':'Eles '):(np.fem?'Ela ':'Ele '))+np.rest;op=(op?op+'+':'')+'SUBJECT_PRONOMINALISED';role='REVEAL';}}
  // A negation right after the opening question contradicts the expected intuition.
  if(x.negation&&hookQuestion&&units.at(-1)===hookQuestion)role='CONTRADICTION';
  if(x.consequence||x.i===finalCallback)role='CONSEQUENCE';
  if(x.i>finalCallback&&finalCallback>=0)role='PAYOFF';
  const u=add({kind:'FACT',role,text:body,sourceIndex:x.i,operation:op});see(body);prevFact=x;
  for(const p of pendingQ.filter(p=>p.answerIndex===x.i))p.unit.answeredBy=u.id;
  // Something taken in now and released by a later statement opens "where does it go?".
  const take=fold(body).match(TAKE);
  if(take){const head=take[1].split(/\s+/)[1],later=info.slice(x.i+1,x.i+5).find(y=>words(y.text).includes(head)&&RELEASE.test(fold(y.text))&&/\bpara\b/.test(fold(y.text)));
   if(later){const fem=/^(a|as|essa)$/.test(take[1].split(/\s+/)[0]);const orig=body.match(new RegExp('\\b(?:'+head+')\\b','i'))?.[0]??head;
    const q=add({kind:'EDITORIAL',role:'NEXT_QUESTION',text:`E para onde vai ${fem?'essa':'esse'} ${orig}?`,sourceIndex:null,operation:'DESTINATION_QUESTION'});pendingQ.push({unit:q,answerIndex:later.i});}}
 }
 // The hook question is answered by the closing consequence (or the last statement).
 if(hookQuestion){const close=units.filter(u=>u.kind==='FACT'&&(u.role==='CONSEQUENCE'||u.role==='PAYOFF')).at(0)??units.filter(u=>u.kind==='FACT').at(-1)!;hookQuestion.answeredBy=close.id;}
 return assembleProgressive(source,units,hookType,paradox?[paradox]:[]);
}

/** Source statements (school connector removed) — the canonical text of each fact. */
export function sourceStatements(source:string){
 return sentenceSpans(source).map(s=>s.text.trim()).filter(Boolean).map(text=>{const f=fold(text);for(const [re] of SCHOOL){const m=f.match(re);if(m)return cap(text.slice(m[0].length));}return text;});
}
/** Audit + questions + loops for a unit list (shared by the writer and the retention pass).
 * A FACT unit may stand for several source statements (sourceIndices) after a lossless fusion;
 * `allowed` lists the function words a fusion may add (que, onde…). */
export function assembleProgressive(source:string,units:ProgressiveUnit[],hookType:HookType,paradoxes:ProgressiveScript['paradoxes'],allowed:Set<string>=new Set()):ProgressiveScript{
 const info=sentenceSpans(source).map(s=>s.text.trim()).filter(Boolean);
 const sourceWords=new Set(words(source)),factUnits=units.filter(u=>u.kind==='FACT'),idx=(u:ProgressiveUnit)=>u.sourceIndices??[u.sourceIndex!];
 const missingFacts=info.map((_,i)=>i).filter(i=>!factUnits.some(u=>idx(u).includes(i)));
 const ok=(w:string)=>EDITORIAL_WORDS.has(w)||allowed.has(w);
 const newEditorialWords=[...new Set(units.filter(u=>u.kind==='EDITORIAL').flatMap(u=>words(u.text)).filter(w=>!sourceWords.has(w)&&!ok(w)))];
 const factsPreserved=factUnits.every(u=>{const src=new Set(idx(u).flatMap(i=>words(info[i])));return words(u.text).every(w=>src.has(w)||ok(w));});
 // Unanswered editorial questions are removed (never left open).
 const unanswered=units.filter(u=>u.kind==='EDITORIAL'&&/\?$/.test(u.text)&&!u.answeredBy).map(u=>u.id);
 const kept=units.filter(u=>!unanswered.includes(u.id));
 const order=new Map(kept.map((u,i)=>[u.id,i]));
 const questions=kept.filter(u=>/\?$/.test(u.text)).map(u=>({id:u.id,text:u.text,answeredBy:u.answeredBy??null,distance:u.answeredBy?order.get(u.answeredBy)!-order.get(u.id)!:null}));
 // ---- Loops: each question opens a loop that runs until the next question; the hook loop closes at the payoff ----
 const loops:CuriosityLoop[]=[];let cur:CuriosityLoop|null=null;
 for(const u of kept){if(/\?$/.test(u.text)||u.role==='HOOK_OBSERVATION'&&!cur){if(cur&&!(u.role==='QUESTION'&&cur.unitIds.length===1&&cur.roles[0]==='HOOK_OBSERVATION'))loops.push(cur),cur=null;
   if(!cur)cur={id:'L'+(loops.length+1),opening:u.text,openedBy:u.id,closedBy:u.answeredBy??null,unitIds:[],roles:[]};else if(u.answeredBy)cur.closedBy=u.answeredBy;}
  if(!cur)cur={id:'L'+(loops.length+1),opening:u.text,openedBy:u.id,closedBy:null,unitIds:[],roles:[]};
  cur.unitIds.push(u.id);cur.roles.push(u.role);}
 if(cur)loops.push(cur);
 const script=kept.map(u=>u.text).join(' ');
 const raw={version:PROGRESSIVE_WRITER_VERSION,source,script,units:kept,loops,hookType,paradoxes,questions,
  audit:{passed:!missingFacts.length&&!newEditorialWords.length&&factsPreserved&&questions.every(q=>q.answeredBy),factsPreserved,missingFacts,newEditorialWords,unansweredQuestions:unanswered}};
 return{...raw,fingerprint:jsonHash(raw)};
}

const SCHOOL_START=/^(?:depois|em seguida|na sequencia|logo apos|primeiro|por fim|alem disso|para isso|entao,|assim,)\b/;
const CAUSAL_START=/^(?:mas|so que|por isso|e por isso|e ai que|agora entra|e para onde|e como|quando isso|para conseguir isso)\b/;
/** Narration pace of the project voice, measured on the zero-shot V1 render (155 words → 53.7 s). */
export const WORDS_PER_SECOND=2.85;
/** Comparable editorial metrics for any script (V1 or V2). */
export function scriptCuriosityMetrics(text:string,progressive?:ProgressiveScript){
 const s=sentenceSpans(text).map(x=>x.text.trim()).filter(Boolean),f=s.map(fold);
 const u=understandScript(ingestScript(text)),demos=selectDemonstrations(u,new Set(u.claims.filter(c=>c.status==='SCRIPT_ASSERTED').map(c=>c.id)));
 const lengths=s.map(wc),q=s.filter(x=>/\?$/.test(x));
 const facts=progressive?new Set(progressive.units.filter(x=>x.kind==='FACT').map(x=>x.text.trim())):null,factSegment=(id:string)=>!facts||facts.has(u.segments.find(g=>g.id===id)?.span.text.trim()??'');
 const firstQ=f.findIndex(x=>/\?$/.test(x)),hook:HookType=progressive?.hookType??(firstQ<0||firstQ>1?'STATEMENT':/\bpor que\b/.test(f[firstQ])?'WHY':/\bcomo\b/.test(f[firstQ])?'HOW':'HIDDEN_MECHANISM');
 return{hookType:hook,curiosityLoops:progressive?progressive.loops.length:(q.length?1:0),questionsOpened:q.length,
  questionsClosed:progressive?progressive.questions.filter(x=>x.answeredBy).length:q.length?1:0,
  paradoxesUsed:progressive?progressive.paradoxes.length:0,
  causalBridges:f.filter(x=>CAUSAL_START.test(x)).length,technicalTransitions:f.filter(x=>SCHOOL_START.test(x)).length,
  words:wc(text),estimatedSeconds:+(wc(text)/WORDS_PER_SECOND).toFixed(1),sentences:s.length,shortSentences:lengths.filter(l=>l<=6).length,longestSentenceWords:Math.max(...lengths),
  // Only statements count: editorial questions/bridges are never factual visuals.
  visualizableBeats:demos.filter(d=>(d.support==='DIRECT'||d.support==='PARTIAL')&&factSegment(d.segmentId)).length,demonstrations:demos.length};
}
