import {assembleProgressive,sourceStatements,scriptCuriosityMetrics,fold,words,wc,WORDS_PER_SECOND,type ProgressiveScript,type ProgressiveUnit} from './progressive';
/** Retention compression over a curiosity-loop script (deterministic, pt-BR). Every inserted unit costs time, so:
 *  1. Lossless rewrites always run, best saving first: fusing statements that repeat a noun or a phrase (relative
 *     "que", location "onde", repeated "ao + infinitive"), dropping a component bridge when a question right before
 *     already opens the gap, and closing the callback in one sentence. Fusions never reorder events or change who
 *     does what, and a fused sentence stays short (≤ 22 words).
 *  2. While the estimate is above the editorial target, structural extras are removed weakest first:
 *     component bridges → how-questions that a short causal transition can carry → control questions.
 *     The hook/paradox, its callback and every source statement always stay.
 *  A rewrite is rejected if it lowers the number of ideas the Visual Demonstration Director can show (read-only use).
 * The result is re-audited with the writer's own audit (no new content words, no open question). */
export const RETENTION_VERSION='retention-compression/1.0.0';
const FUSION_WORDS=new Set(['que','onde','ao','conseguir','e']);
const MAX_FUSED_WORDS=22;
export interface RetentionOperation {op:string;units:string[];before:string[];after:string;removedWords:string[];addedWords:string[];justification:string}
export interface RejectedRewrite {op:string;units:string[];reason:string}
const strip=(s:string)=>s.replace(/[.!?]\s*$/,'');
const lowFirst=(s:string)=>s.charAt(0).toLowerCase()+s.slice(1);
const isQ=(u?:ProgressiveUnit)=>Boolean(u&&/\?$/.test(u.text));
const text=(us:ProgressiveUnit[])=>us.map(u=>u.text).join(' ');
/** Multiset word difference, for the operation log. */
function delta(before:string,after:string){const b=words(before),a=words(after);const take=(xs:string[],ys:string[])=>{const left=[...ys];return xs.filter(x=>{const i=left.indexOf(x);if(i>=0){left.splice(i,1);return false;}return true;});};return{removed:take(b,a),added:take(a,b)};}
interface Candidate {op:string;units:ProgressiveUnit[];involved:ProgressiveUnit[];after:string;justification:string}

export function compressRetention(v2:ProgressiveScript,opts:{maxSeconds?:number}={}){
 const maxSeconds=opts.maxSeconds??60,statements=sourceStatements(v2.source),hookIndex=v2.paradoxes[0]?.observationIndex??null;
 let units:ProgressiveUnit[]=v2.units.map(u=>u.sourceIndex===null?{...u}:{...u,sourceIndices:u.sourceIndices??[u.sourceIndex]});
 const ops:RetentionOperation[]=[],rejected:RejectedRewrite[]=[],visual=new Map<string,number>();
 const beats=(us:ProgressiveUnit[])=>{const t=text(us);if(!visual.has(t))visual.set(t,scriptCuriosityMetrics(t,{units:us,loops:[],questions:[],paradoxes:[],hookType:'STATEMENT'} as unknown as ProgressiveScript).visualizableBeats);return visual.get(t)!;};
 const clone=(us:ProgressiveUnit[])=>us.map(u=>({...u,...(u.sourceIndices?{sourceIndices:[...u.sourceIndices]}:{})}));
 const remap=(us:ProgressiveUnit[],from:string,to:string)=>us.forEach(u=>{if(u.answeredBy===from)u.answeredBy=to;});
 const restore=(u:ProgressiveUnit)=>{if(u.operation?.includes('SUBJECT_PRONOMINALISED'))u.text=statements[u.sourceIndex!];};
 // ---- candidate rewrites (pure: each returns a new unit list) ----
 const dropBridge=(k:number,why:string):Candidate=>{const us=clone(units),b=us[k],next=us[k+1];restore(next);us.splice(k,1);return{op:'BRIDGE_REMOVED',units:us,involved:[units[k],units[k+1]],after:next.text,justification:why};};
 const fuse=(k:number,t:string,op:string,why:string):Candidate=>{const us=clone(units),a=us[k],b=us[k+1];
  a.text=t;a.sourceIndices=[...a.sourceIndices!,...b.sourceIndices!];a.operation=(a.operation?a.operation+'+':'')+op;
  if(b.role==='CONSEQUENCE'||b.role==='PAYOFF')a.role=a.role==='CONSEQUENCE'?'CONSEQUENCE':b.role;remap(us,b.id,a.id);us.splice(k+1,1);
  return{op,units:us,involved:[units[k],units[k+1]],after:t,justification:why};};
 const lossless=():Candidate[]=>{const out:Candidate[]=[];
  for(let k=0;k<units.length;k++)if(units[k].operation==='COMPONENT_BRIDGE'&&(isQ(units[k-1])||isQ(units[k-2])))
   out.push(dropBridge(k,'The question right before already opens the gap the bridge announced; the statement keeps its original subject'));
  for(let k=0;k+1<units.length;k++){const a=units[k],b=units[k+1];if(a.kind!=='FACT'||b.kind!=='FACT'||isQ(a)||isQ(b))continue;const A=a.text,B=b.text,fa=fold(A);
   // "…vai para a X…" + "Na X, o Y …" (Y already in the first statement) → "…para a X…, onde …"
   const loc=/^(?:Na|No|Nas|Nos) (\S+), (?:o|a|os|as) (\S+) (.+)$/.exec(B);
   if(loc&&new RegExp('\\bpara (?:o|a|os|as) '+fold(loc[1])+'\\b').test(fa)&&words(A).includes(fold(loc[2])))
    out.push(fuse(k,strip(A)+', onde '+loc[3],'LOCATION_FUSION','The second statement happens at the place the first one names; "onde" carries that place and the repeated subject'));
   // "… X." + "O X …" (the first statement ends with the noun the second is about) → "… X, que …"
   const end=/\s(\S+)\.$/.exec(A),rel=/^(?:O|A|Os|As) (\S+) (.+)$/.exec(B);
   if(end&&rel&&fold(end[1])===fold(rel[1])&&!/^(?:ele|ela|eles|elas)\b/i.test(rel[2]))
    out.push(fuse(k,strip(A)+', que '+rel[2],'RELATIVE_FUSION','The second statement is about the object the first one ends with; "que" replaces the repeated noun'));
   // "… e vira X." + "Ao virar X, ele …" → "… e, ao virar X, …"
   const last=/^(.*) e (\S+) (.+)\.$/.exec(A),ao=/^Ao (\S+) (.+?), (?:ele|ela|eles|elas) (.+)$/i.exec(B);
   if(last&&ao&&fold(ao[1]).startsWith(fold(last[2]).slice(0,-1))&&fold(ao[2])===fold(last[3]))
    out.push(fuse(k,last[1]+' e, ao '+ao[1]+' '+ao[2]+', '+ao[3],'REPEAT_FUSION','The second statement repeats the change the first one ends with; it is said once, as the moment of the second action'));
   // Callback + its explanation close the hook in one sentence (the place keeps its full name in the opening).
   if(a.role==='CONSEQUENCE'&&hookIndex!==null&&a.sourceIndices?.includes(hookIndex)&&!a.operation?.includes('CALLBACK')&&b.role==='PAYOFF'&&/^É /.test(B)){
    const q=units.find(u=>u.role==='QUESTION'),topic=q?/\b(?:um|uma|o|a)\s+(\S+)/i.exec(q.text.replace(/^Mas\s+/,''))?.[1]?.replace(/[?.,]/g,''):null;
    let t=strip(A);if(topic){const shorter=t.replace(new RegExp(' (?:da|do|das|dos) '+topic+'\\b','i'),'');if(wc(shorter)>=4)t=shorter;}
    out.push(fuse(k,t+': '+lowFirst(B),'CALLBACK_FUSION','The callback and its explanation close the hook in one sentence; the opening observation keeps the full name of the place'));}
  }
  return out.filter(c=>c.op==='BRIDGE_REMOVED'||wc(c.after)<=MAX_FUSED_WORDS);};
 const accept=(c:Candidate)=>{
  if(beats(c.units)<beats(units)){const ids=c.involved.map(u=>u.id);if(!rejected.some(r=>r.op===c.op&&r.units.join()===ids.join()))rejected.push({op:c.op,units:ids,reason:'Would lower the ideas the Visual Demonstration Director can show'});return false;}
  const before=c.involved.map(u=>u.text),d=delta(before.join(' '),c.after);
  ops.push({op:c.op,units:c.involved.map(u=>u.id),before,after:c.after,removedWords:d.removed,addedWords:d.added,justification:c.justification});units=c.units;return true;};
 const runLossless=()=>{const tried=new Set<string>();for(;;){
  const cs=lossless().filter(c=>!tried.has(c.op+c.involved.map(u=>u.id).join('+'))).sort((x,y)=>wc(text(x.units))-wc(text(y.units)));
  if(!cs.length)return;const c=cs[0];tried.add(c.op+c.involved.map(u=>u.id).join('+'));accept(c);}};
 runLossless();
 // ---- structural extras, weakest first, only while above the editorial target ----
 const seconds=()=>wc(text(units))/WORDS_PER_SECOND;
 const budget:[string,(k:number)=>Candidate][]=[
  ['COMPONENT_BRIDGE',k=>dropBridge(k,'Above the target duration: the part is introduced by the statement itself')],
  ['PURPOSE_TO_HOW_QUESTION',k=>{const us=clone(units),q=us[k],a=us.find(u=>u.id===q.answeredBy)!;a.text='Para conseguir isso, '+lowFirst(a.text);us.splice(k,1);
   return{op:'QUESTION_TO_CAUSAL_TRANSITION',units:us,involved:[units[k],units.find(u=>u.id===q.answeredBy)!],after:a.text,justification:'Above the target duration: the purpose is carried by a short causal transition instead of a question'};}],
  ['CONTROL_QUESTION',k=>{const us=clone(units);us.splice(k,1);return{op:'QUESTION_REMOVED',units:us,involved:[units[k]],after:'',justification:'Above the target duration: the control statement stays; only the question that announced it is removed'};}],
 ];
 for(const [kind,make] of budget){const skip=new Set<string>();
  while(seconds()>maxSeconds){const k=units.findIndex(u=>u.operation===kind&&!skip.has(u.id));if(k<0)break;skip.add(units[k].id);if(accept(make(k)))runLossless();}}
 const result=assembleProgressive(v2.source,units,v2.hookType,v2.paradoxes,FUSION_WORDS);
 return{version:RETENTION_VERSION,result,operations:ops,rejected,metrics:retentionMetrics(v2,result)};
}
/** Words not traceable to a source statement of the same unit (questions, bridges, connectors added by fusions). */
export function insertedWords(p:ProgressiveScript){
 const st=sourceStatements(p.source).map(words);
 return p.units.reduce((n,u)=>{if(u.kind==='EDITORIAL')return n+wc(u.text);const left=(u.sourceIndices??[u.sourceIndex!]).flatMap(i=>st[i]);
  return n+words(u.text).filter(w=>{const i=left.indexOf(w);if(i>=0){left.splice(i,1);return false;}return true;}).length;},0);
}
export function retentionMetrics(before:ProgressiveScript,after:ProgressiveScript){
 const m=(p:ProgressiveScript)=>{const c=scriptCuriosityMetrics(p.script,p),total=sourceStatements(p.source).length;
  return{words:c.words,estimatedSeconds:c.estimatedSeconds,curiosityLoops:c.curiosityLoops,questionsOpened:c.questionsOpened,questionsClosed:c.questionsClosed,paradoxes:c.paradoxesUsed,causalBridges:c.causalBridges,
   factsPreserved:`${total-p.audit.missingFacts.length}/${total}`,insertedWords:insertedWords(p),visualizableBeats:c.visualizableBeats,units:p.units.length};};
 return{before:m(before),after:m(after)};
}
