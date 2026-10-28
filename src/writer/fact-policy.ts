import {analyzeTopic} from './topic';
import {planOutline,sourceRealization} from './outline';
import {realizeScript,safeAttentionPrompts,shortAttention} from './realizer';
import {analyzeNaturalScript} from '../narrative';
import {normalize} from '../semantics/normalize';
import type {TopicScriptRequest,ScriptCandidate,FactAudit,WriterCapabilityProfile} from './contracts';
import type {SemanticNarrativeGraph} from '../semantics/narrative-contracts';
/** Closed, auditable realization language. This is provenance validation, not a
 * universal factual/entailment model. Source facts are quotations with at most
 * the documented unique-liquid subject clarification. */
export function auditFacts(request:TopicScriptRequest,c:ScriptCandidate,g:SemanticNarrativeGraph,profile:WriterCapabilityProfile):FactAudit {
 const issues:FactAudit['issues']=[],provenance:FactAudit['claimProvenance']=[];
 const issue=(code:string,text:string,reason:string)=>{if(!issues.some(i=>i.code===code&&i.text===text))issues.push({code,text,reason});};
 const a=analyzeTopic(request),trustedOutline=planOutline(request,a,profile,c.strategy);
 const trusted=[0,1,2].flatMap(i=>realizeScript(request,trustedOutline,c.strategy,profile,i).utterances);
 const licensed=new Set([...trusted.map(u=>u.text),...safeAttentionPrompts,shortAttention]);
 if(c.script!==c.utterances.map(u=>u.text).join('\n'))issue('SCRIPT_LEDGER_MISMATCH',c.script,'Script must consist exactly of the audited utterances');
 for(const u of c.utterances){
  if(c.script.slice(u.sourceSpan.start,u.sourceSpan.end)!==u.text)issue('SPAN_MISMATCH',u.text,'Output span does not match the actual script');
  if(!licensed.has(u.text))issue('UNLICENSED_SURFACE',u.text,'Not a licensed realization of this request, strategy, and capability snapshot');
  if(u.permission.kind==='SOURCE_FACT'){
   const s=request.sourceMaterial?.find(s=>s.id===u.permission.sourceMaterialId&&s.allowedForClaims),span=u.permission.sourceSpan;
   if(!s||!span||s.text.slice(span.start,span.end)!==span.text||sourceRealization(span.text,s.text)!==u.text)issue('SOURCE_MISMATCH',u.text,'Fact is not traceable to the exact authorized source span / bounded grammar clarification');
  }
 }
 const allowedSources=(request.sourceMaterial??[]).filter(s=>s.allowedForClaims),allowedText=allowedSources.map(s=>s.text).join(' '),allLicensedNumbers:string[]=allowedText.match(/-?\d+(?:[.,]\d+)?/g)??[];
 for(const n of c.script.match(/-?\d+(?:[.,]\d+)?/g)??[])if(!allLicensedNumbers.includes(n))issue('UNTRACEABLE_NUMBER',n,'Topic alone does not license factual quantities');
 const sensitive=/\b(?:Vostok|Antártida|Sibéria|Yakutsk|bateria|motor|combustível|pressão|bomba|gravidade|bar|watts|recorde|estatística)\b/giu;
 for(const m of c.script.matchAll(sensitive))if(!normalize(allowedText).includes(normalize(m[0])))issue('UNTRACEABLE_SPECIFIC',m[0],'Specific entity/mechanism absent from authorized sourceMaterial');
 if(/\b(?:porque|devido a|causa|provoca)\b/i.test(c.script)&&!/\b(?:porque|devido a|causa|provoca)\b/i.test(allowedText))issue('UNTRACEABLE_CAUSE',c.script,'Unprovided causal mechanism');
 for(const claim of g.claims.filter(q=>q.requiresVisualProof)){
  const u=c.utterances.find(u=>claim.sourceSpan.start>=u.sourceSpan.start&&claim.sourceSpan.end<=u.sourceSpan.end+1);
  if(!u||u.permission.kind==='EDITORIAL'||!licensed.has(u.text))issue('UNSUPPORTED_FACT',claim.text,'Semantic Engine extracted a factual claim outside licensed physical/source text');
  else if((request.factPolicy??'STRUCTURAL_ONLY')==='SOURCE_ONLY'&&u.permission.kind!=='SOURCE_FACT')issue('SOURCE_REQUIRED_FOR_CLAIM',claim.text,'SOURCE_ONLY requires a source span for every factual claim');
  if(u)provenance.push({claimId:claim.id,sourceMaterialId:u.permission.sourceMaterialId,sourceSpan:u.permission.sourceSpan,kind:u.permission.kind,reason:u.permission.reason});
 }
 // Direction/order contradiction detection reuses Semantic Engine predicates and
 // quantities. It never guesses a scientific explanation for a numeric change.
 for(const s of allowedSources){const sg=analyzeNaturalScript({version:1,id:'source-fact-check',language:'pt-BR',script:s.text});
  const transitions=sg.events.filter(e=>['INCREASE','DECREASE'].includes(e.predicate)).map(e=>({predicate:e.predicate,values:sg.analysis.quantities.filter(q=>e.quantityIds.includes(q.id)).map(q=>q.value)})).filter(t=>t.values.length===2);
  for(const t of transitions){if((t.values[1]>t.values[0])!==(t.predicate==='INCREASE'))issue('SOURCE_CONTRADICTION',s.text,'Source numeric ordering contradicts its change direction');}
  for(let i=0;i<transitions.length;i++)for(let j=i+1;j<transitions.length;j++)if(JSON.stringify(transitions[i].values)===JSON.stringify(transitions[j].values)&&transitions[i].predicate!==transitions[j].predicate)issue('SOURCE_CONTRADICTION',s.text,'Opposite directions with the same provided endpoints');
 }
 const physical=g.claims.filter(q=>q.requiresVisualProof),grounded=provenance.filter(p=>(request.factPolicy==='SOURCE_ONLY'?p.kind==='SOURCE_FACT':p.kind!=='EDITORIAL')).length;
 const omissions:FactAudit['omissions']=[];
 for(const s of allowedSources){const used=c.utterances.filter(u=>u.permission.sourceMaterialId===s.id).map(u=>u.permission.sourceSpan!);for(const block of trustedOutline.blocks.filter(b=>b.permission.sourceMaterialId===s.id)){const span=block.permission.sourceSpan!;if(!used.some(u=>u.start<=span.start&&u.end>=span.end))omissions.push({sourceMaterialId:s.id,sourceSpan:span,reason:'Source unit omitted from the candidate'});}}
 if(omissions.length&&!request.constraints?.allowSourceOmissions)issue('SOURCE_OMISSION',omissions.map(o=>o.sourceMaterialId).join(','),'Source omission policy forbids dropping provided facts');
 const specific=issues.filter(i=>['UNTRACEABLE_NUMBER','UNTRACEABLE_SPECIFIC','UNTRACEABLE_CAUSE'].includes(i.code)).length;
 return{passed:issues.length===0,unsupportedFactCount:issues.length,untraceableSpecificClaimCount:specific,sourceGroundingRate:physical.length?grounded/physical.length:0,issues,claimProvenance:provenance,omissions};
}
