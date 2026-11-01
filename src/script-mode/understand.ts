import {categoryOf,mechanismRelations,isMechVerb} from './mechanism';
import {jsonHash} from '../editorial/fingerprint';
import {normalize} from '../semantics/normalize';
import {parseMechanismSentence} from '../research/mechanism-parser';
import {SCRIPT_MODE_VERSION,type ClaimAction,type ClaimArgument,type DiscourseRole,type EntityRole,type ScriptClaim,type ScriptEntity,type ScriptSegment,type ScriptSource,type ScriptSpan,type ScriptUnderstanding,type SegmentRole,type VisualAction} from './contracts';
import {sentenceSpans} from './ingest';
import * as L from './lexicon';
/** Script understanding: segments → discourse roles → clause claims (shared mechanism parser first,
 * script clause grammar second) → entity inventory with persistence → visual actions.
 * Deterministic; questions never become facts; nothing outside the script text is added. */
interface Token {start:number;end:number;text:string;fold:string;raw:string}
const tokenize=(text:string,offset:number):Token[]=>[...text.matchAll(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’-][\p{L}\p{M}\p{N}]+)*|[^\s]/gu)].map(m=>({start:offset+m.index!,end:offset+m.index!+m[0].length,text:m[0],raw:m[0].toLowerCase(),fold:normalize(m[0])}));
const fold=(s:string)=>normalize(s).replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
const isManner=(text:string)=>{const f=fold(text);return /^(?:cada vez|sem parar|sem pausa|sem interrupcao|devagar|rapidamente|lentamente)(?: |$)/.test(f)||/^(?:em|com|a) /.test(f)&&f.split(' ').some(w=>categoryOf(w)==='PROPERTY');};
const PUNCT=new Set([',',';',':','(',')','—','–','"','“','”','.','!','?','…']);
function discourseOf(text:string,role:SegmentRole):DiscourseRole[]{
 const f=fold(text),out:DiscourseRole[]=[];
 for(const d of L.DISCOURSE)if(d.pattern.test(f))out.push(d.role);
 if(role==='QUESTION'||role==='HYPOTHESIS')out.push('HOOK');
 if(role==='ASSERTION'&&L.CONDITIONAL.test(f))out.push('CONSEQUENCE');
 if(role==='ASSERTION'&&!out.length)out.push('EXPLANATION');
 return[...new Set(out)];
}
interface Trigger {a:number;b:number;predicate:string}
function triggers(tokens:Token[]):Trigger[]{
 let folded='';const map:number[]=[];
 tokens.forEach((t,i)=>{if(i){folded+=' ';map.push(i);}folded+=t.fold;map.push(...Array(t.fold.length).fill(i));});
 const found:Trigger[]=[];
 for(const rule of L.CLAUSE_RULES)for(const m of folded.matchAll(new RegExp('\\b(?:'+rule.pattern+')\\b','g'))){
  const a=map[m.index!],b=map[m.index!+m[0].length-1]+1;
  // An unaccented "e" is the conjunction, never the verb "é".
  if(tokens[a].raw==='e'&&tokens[a].fold==='e'&&/^(?:IS_A|STATE|MOVE|FLOW|USED_FOR|COLLECT|TRANSFORM)$/.test(rule.predicate)&&tokens[a].text==='e')continue;
  found.push({a,b,predicate:rule.predicate});
 }
 found.sort((x,y)=>x.a-y.a||(y.b-y.a)-(x.b-x.a));
 const out:Trigger[]=[];for(const t of found)if(!out.some(o=>t.a<o.b&&o.a<t.b))out.push(t);
 // A definition verb is only a trigger when no other verb exists in the clause.
 return out.filter(t=>t.predicate!=='IS_A'||out.length===1);
}
const spanOf=(tokens:Token[],a:number,b:number,script:string):ScriptSpan|null=>{while(a<b&&(PUNCT.has(tokens[a].text)||L.CONNECTIVES.has(tokens[a].raw)))a++;while(b>a&&(PUNCT.has(tokens[b-1].text)||L.CONNECTIVES.has(tokens[b-1].raw)))b--;if(b<=a)return null;const start=tokens[a].start,end=tokens[b-1].end;return{start,end,text:script.slice(start,end)};};
/** Trailing noun phrase of a left context (drops a leading prepositional/adverbial phrase). */
function subjectRange(tokens:Token[],a:number,b:number){
 let s=a;const words=()=>tokens.slice(s,b).map(t=>t.fold).join(' ');
 while(s<b){const m=words().match(L.LEADING_FILLERS);if(!m)break;s+=m[0].trim().split(' ').length;}
 if(s<b&&/^(?:em|no|na|nos|nas|in|on|at|durante|during|com|with|quando|when|apos|after)$/.test(tokens[s].fold)){
  for(let i=b-1;i>s;i--)if(/^(?:o|a|os|as|um|uma|the|an)$/.test(tokens[i].raw)&&i>s+1){s=i;break;}
 }
 return[s,b] as const;
}
function clauseClaims(seg:ScriptSegment,script:string,status:ScriptClaim['status'],modality:ScriptClaim['modality'],taken:{a:number;b:number}[]):ScriptClaim[]{
 const tokens=tokenize(seg.span.text,seg.span.start),ts=triggers(tokens),out:ScriptClaim[]=[];
 let lastSubject:ScriptSpan|null=null;
 ts.forEach((t,k)=>{
  const tstart=tokens[t.a].start,tend=tokens[t.b-1].end;
  // Left: walk back to a clause boundary.
  let l=t.a,boundary:Token|null=null;
  while(l>0){const p=tokens[l-1];if(PUNCT.has(p.text)||L.CONNECTIVES.has(p.raw)||(k>0&&l-1<ts[k-1].b)){boundary=p;break;}l--;}
  const [sa,sb]=subjectRange(tokens,l,t.a);let subject=spanOf(tokens,sa,sb,script),resolution:ScriptClaim['subjectResolution']='EXPLICIT';
  if(subject&&/^(?:por|pelo|pela|pelos|pelas|atraves|para|ate|through|via|to|into)\b/.test(fold(subject.text)))subject=null;
  // "No topo da tampa fica um pino": a locative phrase before a location verb is where, not who.
  if(subject&&L.INVERTIBLE.has(t.predicate)&&/^(?:no|na|nos|nas|em|atras|sobre|embaixo|dentro|in|on|behind|under|inside|atop)\b/.test(fold(subject.text)))subject=null;
  // Inverted order ("entra ar no cano"): an intransitive motion verb followed by its subject.
  let objStart=t.b;
  const coordinated=Boolean(boundary&&/^(?:e|and)$/.test(boundary.raw)&&lastSubject);
  if(!subject&&!coordinated&&L.INVERTIBLE.has(t.predicate)&&!(boundary&&/^(?:que|which|who|that)$/.test(boundary.raw))){let j=t.b;const stop=ts[k+1]?.a??tokens.length;while(j<stop&&!PUNCT.has(tokens[j].text)&&!/^(?:no|na|nos|nas|em|para|pelo|pela|por|de|do|da|ate|in|into|to|through|from|e|and)$/.test(tokens[j].fold))j++;
   const sp=j>t.b?spanOf(tokens,t.b,j,script):null;if(sp){subject=sp;resolution='INVERTED';objStart=j;}}
  if(!subject&&boundary&&/^(?:que|which|who|that)$/.test(boundary.raw)){
   // Relative pronoun: antecedent noun phrase immediately before it.
   let i=tokens.indexOf(boundary)-1;const end=i+1;
   while(i>=0&&!ts.some(x=>i>=x.a&&i<x.b)&&!/^(?:ate|para|por|pelo|pela|atraves|into|to|through|until|via|;|:)$/.test(tokens[i].fold))i--;
   subject=spanOf(tokens,i+1,end,script);resolution='RELATIVE_ANTECEDENT';
  }
  if(!subject&&lastSubject){subject=lastSubject;resolution='ELLIPSIS';}
  if(!subject)return;
  // Right: object until the next trigger / relative clause / hard boundary.
  let r=objStart;const next=ts[k+1]?.a??tokens.length;
  const subordinate=Boolean(boundary&&/^(?:quando|when|se|if|enquanto|while|as|assim que|once)$/.test(boundary.raw))||/^(?:quando|when|se|if|enquanto|while|once)$/.test(tokens[l]?.raw??'');
  while(r<next){const x=tokens[r];if(x.text===';'||x.text===':'||/^(?:que|which|who|quando|when|porque|because|enquanto|while|mas|but)$/.test(x.raw))break;if(x.text===','&&(subordinate||/^(?:que|which|who|e|and|then|entao)$/.test(tokens[r+1]?.raw??'')))break;r++;}
  if(r<next&&tokens[r].raw==='e'&&ts[k+1]&&ts[k+1].a===r+1){/* coordinated verb */}
  const args:ClaimArgument[]=[];
  if(t.predicate==='STATE'){const w=tokens[t.b-1].fold;args.push({role:'STATE',span:{start:tokens[t.b-1].start,end:tokens[t.b-1].end,text:L.STATE_WORDS[w]??w}});}
  else if(r>objStart){
   const keepWhole=L.PURPOSE.has(t.predicate)||t.predicate==='TRANSFORM'||t.predicate==='IS_A';
   let role:ClaimArgument['role']=/^(?:EXIT|ESCAPE|COME)$/.test(t.predicate)&&/^(?:de|do|da|dos|das|from)$/.test(tokens[objStart].fold)?'SOURCE':/^(?:ARRIVE|FILL)$/.test(t.predicate)?'DESTINATION':t.predicate==='PASSES_THROUGH'?'PATH':'OBJECT',from=objStart,depth=0;
   // Entering something: a locative ("no cano", "in the tank") is where it goes.
   const into=(i:number)=>t.predicate==='ENTER'&&/^(?:no|na|nos|nas|em|in)$/.test(tokens[i].fold);
   if(into(objStart))role='DESTINATION';
   for(let i=objStart;i<=r;i++){
    if(i<r){if(tokens[i].text==='(')depth++;if(tokens[i].text===')')depth--;}
    let marker:{role:ClaimArgument['role'];len:number}|null=null;
    if(i<r&&!keepWhole&&depth===0&&i>from&&into(i))marker={role:'DESTINATION',len:1};
    if(i<r&&!keepWhole&&depth===0&&i>from&&!marker)for(const m of L.ROUTE_MARKERS)for(const len of [3,2,1]){const words=tokens.slice(i,i+len).map(x=>x.fold).join(' ');if(m.pattern.test(words)){marker={role:m.role,len};break;}}
    if(i===objStart&&!keepWhole)for(const m of L.ROUTE_MARKERS)for(const len of [3,2,1]){const words=tokens.slice(i,i+len).map(x=>x.fold).join(' ');if(m.pattern.test(words)&&!marker){role=m.role;}}
    if(i===r||marker){const sp=spanOf(tokens,from,i,script);if(sp)args.push({role,span:sp});if(marker){role=marker.role;from=i;}}
   }
  }
  const clause=fold(script.slice(subject.start<tstart?subject.start:tstart,args.at(-1)?.span.end??tend));
  const st:ScriptClaim['status']=status==='SCRIPT_ASSERTED'&&L.NEGATION.test(clause)?'NEGATED':status;
  const mod:ScriptClaim['modality']=st==='NEGATED'?'NEGATED':L.CONDITIONAL.test(fold(script.slice(tstart,tend)))||modality==='CONDITIONAL'?'CONDITIONAL':'ASSERTED';
  if(taken.some(x=>tstart<x.b&&x.a<tend))return;
  out.push({id:'',segmentId:seg.id,status:st,modality:mod,predicate:t.predicate,subject,trigger:{start:tstart,end:tend,text:script.slice(tstart,tend)},args,subjectResolution:resolution,extractor:'SCRIPT_CLAUSE',discourse:seg.discourse});
  lastSubject=subject;
 });
 return out;
}
function parserClaims(seg:ScriptSegment,script:string){
 const r=parseMechanismSentence(seg.span.text),groups=new Map<string,ScriptClaim>(),triggers:{a:number;b:number}[]=[];
 const at=(s:{start:number;end:number}):ScriptSpan=>({start:seg.span.start+s.start,end:seg.span.start+s.end,text:script.slice(seg.span.start+s.start,seg.span.start+s.end)});
 for(const c of r.candidates){
  const key=c.parse.route?c.parse.route.group+'|'+c.parse.subject.start:c.parse.trigger.start+'|'+c.parse.trigger.end;
  const lead=fold(c.parse.argument.text),role:ClaimArgument['role']=c.parse.route?c.parse.route.role as ClaimArgument['role']:/^(?:de|do|da|from|vindo|vinda)\b/.test(lead)&&/^(?:EXIT|ESCAPE)$/.test(c.fact.predicate)?'SOURCE':/^(?:por|pelo|pela|atraves|through|via)\b/.test(lead)?'PATH':/^(?:ate|para|into|to)\b/.test(lead)?'DESTINATION':'OBJECT';
  const subj=at(c.parse.subject),lead0=fold(subj.text).match(L.LEADING_FILLERS);if(lead0){const cut=subj.text.toLowerCase().indexOf(' ',0);let k=0,n=lead0[0].trim().split(' ').length,i=0;while(k<n&&i<subj.text.length){i=subj.text.indexOf(' ',i)+1;k++;}subj.start+=i;subj.text=subj.text.slice(i);void cut;}
  const g=groups.get(key)??{id:'',segmentId:seg.id,status:'SCRIPT_ASSERTED',modality:'ASSERTED',predicate:c.fact.predicate,subject:subj,trigger:at(c.parse.trigger),args:[],subjectResolution:'EXPLICIT',extractor:'MECHANISM_PARSER',discourse:seg.discourse} as ScriptClaim;
  if(c.parse.route&&g.args.length)g.predicate='MOVE';
  if(c.parse.trigger.start<g.trigger.start-seg.span.start)g.trigger=at(c.parse.trigger);
  g.args.push({role,span:at(c.parse.argument)});groups.set(key,g);triggers.push({a:seg.span.start+c.parse.trigger.start,b:seg.span.start+c.parse.trigger.end});
 }
 return{claims:[...groups.values()],triggers};
}
/** Noun-phrase heads (alternatives, appositions and parenthesized aliases kept), plus qualifiers. */
export function headsOf(text:string){
 const main=text.split(/\s(?:que|which|who|cujo|cuja)\s/i)[0];
 const parts=main.split(/,|\(|\)|\s(?:ou|or|e|and)\s/i).map(p=>fold(p)).filter(Boolean);
 const heads:string[]=[];
 for(const p of parts){
  // "parte externa/interna do X": a region of X — the participant is X.
  const pm=p.match(/(?:^| )parte (?:externa|interna|exterior|interior|de fora|de dentro|de cima|de baixo)\s+d[oae]s?\s+(\w+)/);if(pm){heads.push(L.singular(pm[1]));continue;}
  const words=p.split(' ');let i=0;
  // Size/intensity adjectives before a noun are modifiers ("pequenos X", "alta Y"), never the head.
  while(i<words.length&&(L.DETERMINERS.has(words[i])||L.QUANTIFIER_HEADS.test(words[i])||/^(?:portanto|logo|assim|mais|menos|maior|menor)$/.test(words[i])||/^(?:pequen[oa]s?|grandes?|alt[oa]s?|fin[oa]s?|enormes?|minuscul[oa]s?|divers[oa]s?|vari[oa]s?)$/.test(words[i])&&i+1<words.length&&!/^(?:de|do|da|dos|das)$/.test(words[i+1])))i++;
  // A leading time phrase ("ao meio-dia a X", "à noite o Y") is skipped up to the next noun phrase.
  if(/^(?:ao|a|de|pela|pelo|durante)$/.test(words[i]??'')&&categoryOf(words[i+1]??'')==='TIME'){let k=i+2;while(k<words.length&&!L.DETERMINERS.has(words[k]))k++;i=k;while(i<words.length&&L.DETERMINERS.has(words[i]))i++;}
  const w=words[i];if(!w||/^\d/.test(w)||w.length<2)continue;
  // Deictic/interrogative adverbs and verbs are not noun heads ("como ela", "dali", "… e envia").
  if(/^(?:como|onde|dali|dai|ali|aqui|daqui|la|ai)$/.test(w)||/mente$/.test(w)||isMechVerb(w)&&!words.slice(0,i).some(x=>L.DETERMINERS.has(x)))continue;
  if(/^(?:nivel|level|forma|form|maneira|way|frente|forward|tras|back|cima|baixo|dentro|fora|inside|outside|fundo|bottom|topo|top|meio|middle|lado|side)$/.test(w)){const k=words.slice(i+1).findIndex(x=>!L.DETERMINERS.has(x));const nx=k>=0?words[i+1+k]:undefined;if(nx&&words.slice(i+1,i+1+k).some(x=>/^(?:de|do|da|dos|das|of)$/.test(x)))heads.push(L.singular(nx));continue;}
  heads.push(L.singular(w));
 }
 const nominal=heads.filter(h=>!L.NON_NOMINAL.test(h));
 return[...new Set(nominal.length?nominal:heads)];
}
function roleOf(heads:string[],slot:string,fluidMove:boolean):EntityRole{
 const any=(re:RegExp)=>heads.some(h=>re.test(h));
 if(slot==='LEVEL')return'CONTAINER';
 if(any(L.HEAT))return'HEAT_SOURCE';
 if(any(L.PERSON))return'ACTOR';
 if(heads.length&&heads.every(h=>L.FLUID.test(h)))return'FLUID';
 if(heads.length&&heads.every(h=>L.ABSTRACT.test(h)))return'ABSTRACT';
 if(any(L.ROTATING))return'ROTATING';
 if(any(L.VANES))return'VANES';
 if(any(L.GATE))return'GATE';
 if(slot==='PATH'||(any(L.CONDUIT)&&!(fluidMove&&(slot==='SOURCE'||slot==='DESTINATION')&&any(L.CONTAINER))))return'CONDUIT';
 if(any(L.CONTAINER)||any(L.VESSEL)||(fluidMove&&(slot==='SOURCE'||slot==='DESTINATION')))return'CONTAINER';
 return'BODY';
}
export function understandScript(source:ScriptSource):ScriptUnderstanding{
 const script=source.normalized,segments:ScriptSegment[]=[],claims:ScriptClaim[]=[];
 let afterHypothesis=false;
 sentenceSpans(script).forEach((span,i)=>{
  const f=fold(span.text),question=/\?\s*$/.test(span.text);
  const role:SegmentRole=question?(L.HYPOTHESIS.test(f)||L.CONDITIONAL.test(f)?'HYPOTHESIS':'QUESTION'):'ASSERTION';
  const seg:ScriptSegment={id:'SEG_'+String(i+1).padStart(2,'0'),order:i,span,role,discourse:[],claimIds:[]};seg.discourse=discourseOf(span.text,role);
  const status:ScriptClaim['status']=question?'QUESTION':'SCRIPT_ASSERTED',modality=!question&&afterHypothesis&&L.CONDITIONAL.test(f)?'CONDITIONAL':'ASSERTED';
  const pr=question?{claims:[],triggers:[]}:parserClaims(seg,script),parsed=pr.claims.filter(c=>!(L.CONDITIONAL.test(fold(c.trigger.text))));
  const taken=[...pr.triggers,...parsed.map(c=>({a:c.subject.start,b:c.subject.end}))];
  // The clause grammar completes parser claims on the same trigger (missing source/path/destination), never duplicates them.
  const extra=clauseClaims(seg,script,status,modality,[]).filter(c=>{const host=parsed.find(p=>taken.some(t=>c.trigger.start<t.b&&t.a<c.trigger.end)&&(p.subject.start===c.subject.start||(c.trigger.start>=p.subject.start&&c.trigger.end<=(p.args.at(-1)?.span.end??p.trigger.end))||pr.triggers.some(t=>c.trigger.start<t.b&&t.a<c.trigger.end&&p.trigger.start<=t.a)));
   if(!host)return!taken.some(t=>c.trigger.start<t.b&&t.a<c.trigger.end);
   for(const a of c.args)if(!host.args.some(x=>x.role===a.role||(a.span.start<x.span.end&&x.span.start<a.span.end)))host.args.push(a);
   host.args.sort((x,y)=>x.span.start-y.span.start);return false;});
  const local=[...parsed,...extra].sort((a,b)=>a.trigger.start-b.trigger.start||a.predicate.localeCompare(b.predicate,'en'));
  // A pronoun subject stands for the subject of the latest asserted clause (only that; no wider anaphora).
  const pronounLike=(t:string)=>L.PRONOUN.test(fold(t))||(!/\b(?:nivel|level)\b/.test(fold(t))&&headsOf(t).every(h=>L.NON_NOMINAL.test(h)));
  for(const c of local)if(pronounLike(c.subject.text)){const prev=[...claims,...local.slice(0,local.indexOf(c))].reverse().find(p=>p.status==='SCRIPT_ASSERTED'&&!pronounLike((p.antecedent??p.subject).text)&&headsOf((p.antecedent??p.subject).text).some(h=>!L.NON_NOMINAL.test(h)));
   if(prev){c.antecedent=prev.antecedent??prev.subject;c.subjectResolution='PRONOUN_ANTECEDENT';}}
  for(const c of local){c.id='SC_'+jsonHash({seg:seg.id,trigger:c.trigger,predicate:c.predicate,args:c.args}).slice(0,12);seg.claimIds.push(c.id);claims.push(c);}
  if(!local.length&&role==='ASSERTION'&&(L.ADDRESS.test(f)||!f.split(' ').some(w=>w.length>3)))seg.role='EDITORIAL';
  if(!local.length&&role==='ASSERTION')seg.role='EDITORIAL';
  afterHypothesis=role==='HYPOTHESIS';segments.push(seg);
 });
 // Entity inventory with persistence: mentions merge when they share a head, a role class and do not
 // conflict on level (high/low) or route stage (upstream/downstream).
 const mentions:{claim:ScriptClaim;slot:string;span:ScriptSpan;heads:string[];role:EntityRole;level:ScriptEntity['level'];stage:ScriptEntity['stage']}[]=[];
 for(const c of claims){
  const subjSpan=c.antecedent??c.subject,subjHeads=headsOf(subjSpan.text),fluidMove=L.FLOWING.has(c.predicate)&&subjHeads.some(h=>L.FLUID.test(h));
  const subjFold=fold(subjSpan.text),stage:ScriptEntity['stage']=L.EXIT_CUE.test(subjFold)?'DOWNSTREAM':L.ENTRY_CUE.test(subjFold)?'UPSTREAM':null;
  const add=(slot:string,span:ScriptSpan)=>{const heads=headsOf(span.text);if(!heads.length)return;
   // A manner phrase ("em alta velocidade", "cada vez mais rápido") says how, not with what: never a participant.
   if(slot==='OBJECT'&&isManner(span.text))return;
   // "fica preso": a bare predicate adjective after a location/state verb is not a participant.
   if(slot==='OBJECT'&&(c.predicate==='LOCATED'||c.predicate==='BOIL')&&!/^(?:o|a|os|as|um|uma|uns|umas|the|an)\s/i.test(span.text))return;const f=fold(span.text);
   mentions.push({claim:c,slot,span,heads,role:roleOf(heads,slot,fluidMove),level:L.HIGH.test(f)?'HIGH':L.LOW.test(f)?'LOW':null,stage:slot==='PATH'?stage:null});};
  add('SUBJECT',subjSpan);
  // "a água da caixa": a fluid qualified by a container comes from that container.
  const qual=subjHeads.some(h=>L.FLUID.test(h))?subjSpan.text.split(/\s(?:que|which)\s/i)[0].match(/\s(?:d[aoe]s?|from(?: the)?)\s+(.+)$/i):null;
  if(qual&&headsOf(qual[1]).some(h=>L.CONTAINER.test(h))){const at=subjSpan.start+subjSpan.text.lastIndexOf(qual[1]);add('SOURCE',{start:at,end:at+qual[1].length,text:qual[1]});}
  // "o nível no vaso": the level belongs to a container.
  const lvl=subjSpan.text.match(/\b(?:n[ií]vel|level)\s+(?:no|na|do|da|of|in)(?: the)?\s+(.+)$/i);
  if(lvl){const at=subjSpan.start+subjSpan.text.lastIndexOf(lvl[1]);add('LEVEL',{start:at,end:at+lvl[1].length,text:lvl[1]});}
  // The thing a fluid leaves ("a água que sai do tanque") is a participant of the same clause.
  const rel=c.subject.text.match(/\s(?:que|which)\s+(?:sai|saem|leaves|exits)\s+(d[aoe]s?|from)\s+(.+)$/i);
  if(rel){const at=c.subject.start+c.subject.text.lastIndexOf(rel[2]);add('SOURCE',{start:at,end:at+rel[2].length,text:rel[2]});}
  for(const a of c.args)if(a.role!=='STATE'&&!(L.PURPOSE.has(c.predicate)||c.predicate==='TRANSFORM'))add(a.role,a.span);
 }
 // Vehicle context: vehicles by medium; their parts; named forces. Only active when the script names a vehicle,
 // so the same words (motor, peso) keep their other meanings elsewhere.
 const vehicleScript=mentions.some(m=>L.vehicleMedium(m.heads));
 if(vehicleScript)for(const m of mentions){
  if(L.vehicleMedium(m.heads))m.role='VEHICLE';
  else if(m.heads.some(h=>L.LIFT_SURFACE.test(h)))m.role='LIFT_SURFACE';
  else if(m.heads.some(h=>L.PROPULSOR.test(h)))m.role='PROPULSOR';
  else if(L.forceDirection(m.heads))m.role='FORCE';
 }
 // Role from what the script says happens: whatever an asserted clause says rotates is a rotating part.
 for(const m of mentions)if(m.claim.status==='SCRIPT_ASSERTED'&&m.claim.predicate==='ROTATE'&&['BODY','COMPONENT'].includes(m.role)&&(m.slot==='OBJECT'||(m.slot==='SUBJECT'&&!m.claim.args.some(a=>a.role==='OBJECT'&&!isManner(a.span.text)))))m.role='ROTATING';
 for(const m of mentions)if(m.role==='BODY'&&mentions.some(x=>x.role==='ROTATING'&&x.heads.some(h=>m.heads.includes(h))))m.role='ROTATING';
 // Main subject: most frequent concrete head, definitions weighted (no topic input needed).
 const score=new Map<string,number>();
 // A time, region, discourse word or quantity is never the system the script explains.
 for(const m of mentions)if(!['FLUID','ABSTRACT','ACTOR'].includes(m.role))for(const h of m.heads.filter(h=>!['TIME','REGION','DISCOURSE','QUANTITY'].includes(categoryOf(h)??'')))score.set(h,(score.get(h)??0)+1+(m.slot==='SUBJECT'&&(L.PURPOSE.has(m.claim.predicate)||m.claim.predicate==='IS_A'||m.claim.predicate==='TRANSFORM')?2:0));
 const freq=[...score.entries()].sort((a,b)=>b[1]-a[1]||mentions.findIndex(m=>m.heads.includes(a[0]))-mentions.findIndex(m=>m.heads.includes(b[0])))[0]?.[0]??null;
 // Narrative evidence first: the thing the opening question asks about ("como um X consegue / faz / funciona…") is the
 // system the script explains — not the most repeated noun (often its content or material).
 const hookHead=segments.slice(0,3).map(s=>/(?:^| )como (?:um|uma|o|a) ([a-z]+)/.exec(fold(s.span.text))?.[1]).find(Boolean),hookMain=hookHead?L.singular(hookHead):null;
 const main=hookMain&&score.has(hookMain)&&mentions.some(m=>m.heads.includes(hookMain)&&!['FLUID','ABSTRACT','ACTOR'].includes(m.role))?hookMain:freq;
 const entities:ScriptEntity[]=[];
 const cls=(r:EntityRole)=>r==='SYSTEM'||r==='BODY'||r==='COMPONENT'?'OBJ':r;
 for(const m of mentions){
  const slotOnly=m.role==='CONTAINER'&&!m.heads.some(h=>L.CONTAINER.test(h));
  const role:EntityRole=main&&m.heads[0]===main&&(slotOnly||m.role==='BODY')?'SYSTEM':m.role;
  const hit=entities.find(e=>cls(e.role)===cls(role)&&e.heads.some(h=>m.heads.includes(h))&&!(e.level&&m.level&&e.level!==m.level)&&!(e.stage&&m.stage&&e.stage!==m.stage));
  const mention={claimId:m.claim.id,slot:m.slot,span:m.span};
  if(hit){hit.mentions.push(mention);if(!hit.claimIds.includes(m.claim.id))hit.claimIds.push(m.claim.id);for(const h of m.heads)if(!hit.heads.includes(h))hit.heads.push(h);hit.level??=m.level;hit.stage??=m.stage;if(role==='SYSTEM')hit.role='SYSTEM';continue;}
  const label=m.span.text.split(/\s(?:que|which|who|para|até|ate|to|into|toward|towards|e|and|pode|podem|deve|devem|can|could|must)\s|\s(?:pode|podem|can)$|[,(]/i)[0].replace(/^\s*(?:o|a|os|as|um|uma|the|an|da|do|de|das|dos|no|na|nos|nas|em|por|pelo|pela|até|ate|para|através de|atraves de|through|to|into|from|vindo de|vinda de)\s+/i,'').replace(/^\s*(?:o|a|os|as|um|uma|the|an)\s+/i,'').trim();
  entities.push({id:'',role,heads:[...m.heads],label,level:m.level,stage:m.stage,mentions:[mention],claimIds:[m.claim.id],...(role==='VEHICLE'?{medium:L.vehicleMedium(m.heads)!}:{}),...(role==='FORCE'?{direction:L.forceDirection(m.heads)!.dir}:{})});
 }
 entities.forEach((e,i)=>{e.id='SE_'+String(i+1).padStart(2,'0')+'_'+jsonHash({heads:e.heads,role:e.role,level:e.level,stage:e.stage}).slice(0,6);});
 const of=(c:ScriptClaim,slot:string)=>entities.find(e=>e.mentions.some(m=>m.claimId===c.id&&m.slot===slot))??null;
 const actions:ClaimAction[]=[],act=(c:ScriptClaim,action:VisualAction,ents:(ScriptEntity|null)[],state:string|null=null,cue:string|null=null)=>actions.push({claimId:c.id,action,entityIds:ents.filter((e):e is ScriptEntity=>Boolean(e)).map(e=>e.id),state,cue});
 const rotating=entities.find(e=>e.role==='ROTATING')??null,system=entities.find(e=>e.role==='SYSTEM')??null;
 for(const c of claims.filter(c=>c.status==='SCRIPT_ASSERTED')){
  const subj=of(c,'SUBJECT'),obj=of(c,'OBJECT'),src=of(c,'SOURCE'),path=of(c,'PATH'),dst=of(c,'DESTINATION'),lvl=of(c,'LEVEL'),text=fold(c.subject.text+' '+c.args.map(a=>a.span.text).join(' '));
  if(c.modality==='CONDITIONAL'){act(c,'NAME_ONLY',[subj,obj,dst],null,'CONDITIONAL');continue;}
  const fluid=subj?.role==='FLUID',dir=/\b(?:para cima|up|upward|sobe|rises?)\b/.test(text+' '+fold(c.trigger.text))||c.predicate==='RISE'?'UP':/\b(?:para baixo|down|downward)\b/.test(text)||c.predicate==='DESCEND'?'DOWN':null;
  // Vehicle scripts: forces are shown on bodies, propulsion moves the body through its medium, a fluid streams past surfaces.
  const vehicle=entities.find(e=>e.role==='VEHICLE')??null;
  if(vehicle){
   const force=[subj,obj,dst].find(e=>e?.role==='FORCE')??null,body=[obj,subj,dst].find(e=>e&&['VEHICLE','LIFT_SURFACE','PROPULSOR'].includes(e.role))??vehicle;
   const stated=/\b(?:para cima|up|upward)\b/.test(text)?'UP':/\b(?:para baixo|down|downward)\b/.test(text)?'DOWN':/\b(?:para (?:a )?frente|forward|ahead)\b/.test(text)?'FORWARD':/\b(?:para tras|backward|back)\b/.test(text)?'BACKWARD':null;
   if(c.predicate==='BALANCE'){const fs=[subj,obj].filter(e=>e?.role==='FORCE');act(c,'BALANCE',fs);continue;}
   if(force&&force===subj&&(c.predicate==='PULL'||c.predicate==='PUSH'||c.predicate==='MOVE'||c.predicate==='DESCEND'||c.predicate==='RISE')){act(c,'SHOW_FORCE',[force,body],stated??force.direction??null);continue;}
   if(c.predicate==='RECEIVE'||c.predicate==='GENERATE'||(c.predicate==='REQUIRES'&&force)){const target=c.predicate==='RECEIVE'?subj:subj?.role==='LIFT_SURFACE'||subj?.role==='VEHICLE'?subj:vehicle;act(c,'SHOW_FORCE',[force,target],stated??force?.direction??null);continue;}
   if(subj?.role==='FLUID'&&obj?.role==='VEHICLE'&&(c.predicate==='PUSH'||c.predicate==='DRIVES'||c.predicate==='MOVE')){act(c,'THRUST',[subj,obj],stated??'FORWARD');continue;}
   if(subj?.role==='PROPULSOR'&&(c.predicate==='PUSH'||c.predicate==='DRIVES'||c.predicate==='MOVE'||c.predicate==='PULL')){act(c,'THRUST',[subj,obj??vehicle],stated??'FORWARD');continue;}
   if(c.predicate==='FLY'){act(c,'TRAVEL',[subj??vehicle]);continue;}
   if(subj?.role==='FLUID'&&c.predicate==='DEFLECT'){act(c,'DEFLECT',[subj],stated??'DOWN');continue;}
   if(c.predicate==='DEFLECT'){act(c,'DEFLECT',[subj],stated);continue;}
   if(subj?.role==='FLUID'&&(L.FLOWING.has(c.predicate))){const part=[path,dst,obj].find(e=>e&&['LIFT_SURFACE','VEHICLE','PROPULSOR'].includes(e.role))??null;act(c,'STREAM',[subj,part]);continue;}
  }
  if(lvl&&(c.predicate==='RISE'||c.predicate==='DESCEND')){act(c,'LEVEL',[lvl],c.predicate==='RISE'?'UP':'DOWN');continue;}
  if((c.predicate==='RISE'||c.predicate==='DESCEND')&&subj&&!fluid&&subj.role!=='CONDUIT'){act(c,'MOVE_VERTICAL',[subj],c.predicate==='RISE'?'UP':'DOWN');continue;}
  if(c.predicate==='PULL'){if(fluid)act(c,'FLOW',[path??obj]);else{const target=obj??subj;act(c,dir?'MOVE_VERTICAL':'MOVE',[target],dir);}continue;}
  const gas=(e:typeof subj)=>Boolean(e&&e.heads.some(h=>L.GAS.test(h)));
  if(c.predicate==='HEAT'||c.predicate==='TURN_ON'){const h=[subj,obj].find(e=>e?.role==='HEAT_SOURCE')??(c.predicate==='TURN_ON'?obj:null);act(c,'ACTIVATE',[h]);continue;}
  if(c.predicate==='TURN_OFF'){act(c,'DEACTIVATE',[obj??subj]);continue;}
  if(c.predicate==='BOIL'){act(c,'BOIL',[]);continue;}
  if(c.predicate==='COOL'){act(c,'DEACTIVATE',[subj?.role==='FLUID'?null:subj],null,'COOL');continue;}
  if(c.predicate==='HAS'||c.predicate==='LOCATED'){act(c,'IDENTIFY',[c.predicate==='HAS'?subj:subj]);continue;}
  if(gas(subj)&&['ESCAPE','EXIT','RISE','FLOW','MOVE'].includes(c.predicate)){act(c,'PUFF',[subj,path??src??dst]);continue;}
  if(c.predicate==='BECOME'){if(gas(obj))act(c,'BOIL',[]);else act(c,'IDENTIFY',[subj]);continue;}
  if(L.FLOWING.has(c.predicate)&&(fluid||!subj)){
   if(src)act(c,'DEPART',[src]);
   if(path)act(c,'FLOW',[path]);
   const arrive=dst??(c.predicate==='ENTER'||c.predicate==='FILL'?obj:null);
   if(arrive)act(c,arrive.role==='CONDUIT'?'FLOW':'ARRIVE',[arrive]);
   if(!src&&!path&&!arrive)act(c,'FLOW',[obj]);
  }else if(c.predicate==='ROTATE'){act(c,'SPIN',[obj??subj],null,obj?'DRIVEN_BY:'+(subj?.id??''):null);}
  else if(c.predicate==='TRANSFER'||c.predicate==='DRIVES'){const target=dst??obj;act(c,target?.role==='ROTATING'?'SPIN':'TRANSFER',[target,subj]);}
  // An explicit direction in the clause ("para cima", "up") makes a push/move vertical.
  else if(c.predicate==='PUSH'||(c.predicate==='MOVE'&&!fluid)){const pushed=/\b(?:para cima|para baixo|up|upward|down|downward)\b/.test(text)?dir:null;act(c,pushed?'MOVE_VERTICAL':'MOVE',[obj??subj],pushed);}
  else if(c.predicate==='OPEN'||c.predicate==='CLOSE'){const g=[obj,subj].find(e=>e?.role==='GATE')??obj??subj;act(c,c.predicate==='OPEN'?'OPEN':'CLOSE',[g]);}
  else if(c.predicate==='STATE'){act(c,'SET_STATE',[subj],c.args.find(a=>a.role==='STATE')?.span.text??null);}
  else if(L.PURPOSE.has(c.predicate)||c.predicate==='TRANSFORM'||c.predicate==='IS_A'){
   act(c,'IDENTIFY',[subj]);
   if(L.FLOW_CUE.test(text)&&/\b(?:agua|water|liquido|liquid|fluido|fluid|ar|air|oleo|oil|vapor|steam)\b/.test(text))act(c,'FLOW',[],null,'FLOW_CUE');
   if(L.ROTATION_CUE.test(text)&&rotating)act(c,'SPIN',[rotating],null,'ROTATION_CUE');
  }else if(/CAUSE|PREVENTS|SOLVES|FAILS/.test(c.predicate))act(c,'HIGHLIGHT_CAUSE',[subj,obj]);
  else act(c,'NAME_ONLY',[subj,obj]);
 }
 const body={version:SCRIPT_MODE_VERSION,source,segments,claims,entities,actions,mainSubjectId:system?.id??(main?entities.find(e=>e.heads.includes(main))?.id??null:null),refusedExtensions:[] as {claimId:string;reason:string}[]};
 // Entity categories (time, region, property, quantity… are not objects) and mechanism relations.
 const PART=new Set(['CONDUIT','GATE','ROTATING','VANES','COMPONENT','HEAT_SOURCE','LIFT_SURFACE','PROPULSOR']);
 for(const e of entities){const c=categoryOf(e.heads[0]??null);const cat=c==='PHYSICAL_ENTITY'&&PART.has(e.role)?'COMPONENT':c;if(cat)e.category=cat;}
 const full={...body,mechanism:mechanismRelations({...body,fingerprint:''})};
 return{...full,fingerprint:jsonHash(full)};
}
/** Trust boundary: a factual relation is admissible only if every span it cites is literally in the script. */
export function refuseUnsupported(u:ScriptUnderstanding,relations:{id:string;subject:string;object:string;span?:{start:number;end:number}}[]){
 const s=u.source.normalized,refused:{id:string;reason:string}[]=[];
 for(const r of relations){
  const claim=u.claims.find(c=>c.id===r.id);
  if(!claim){refused.push({id:r.id,reason:'UNSUPPORTED_EXTENSION: relation has no script claim'});continue;}
  if(claim.status!=='SCRIPT_ASSERTED'){refused.push({id:r.id,reason:'UNSUPPORTED_EXTENSION: '+claim.status+' is not an assertion'});continue;}
  for(const part of [r.subject,r.object].filter(Boolean))if(!s.includes(part))refused.push({id:r.id,reason:'UNSUPPORTED_EXTENSION: text not in script: '+part.slice(0,60)});
 }
 return refused;
}
