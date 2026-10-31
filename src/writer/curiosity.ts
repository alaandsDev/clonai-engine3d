import {jsonHash} from '../editorial/fingerprint';
import {normalize} from '../semantics/normalize';
import {analyzeNaturalScript} from '../narrative';
import {buildCuriosityStoryPlan,verifyCuriosityArtifacts,type CuriosityArtifacts} from '../curiosity/story';
import {CAUSAL,PHYSICAL,entityKey} from '../curiosity/knowledge';
import {topicSubject} from '../topic/subject';
import {validateEvidencePack} from '../research/qa';
import {buildTopicPlan,topicWriterGate} from '../topic';
import type {EvidencePack} from '../research/contracts';
import {wordCount} from './request';
import {groundedProgression} from '../curiosity/progression';

const hooks={pt:['Você consegue acompanhar o que acontece dentro desse sistema?','O que cada parte faz para o sistema funcionar?'],en:['Can you follow what happens inside this system?','What does each part do in this system?']};
export interface CuriositySentence {id:string;kind:'FACT'|'EDITORIAL';text:string;span:{start:number;end:number;text:string};storyNodeIds:string[];relationIds:string[];factIds:string[];evidenceIds:string[];roles:string[];epistemicClass?:'FACT_SUPPORTED'|'QUESTION'|'EDITORIAL_CONTEXT';realization?:'SOURCE_SURFACE'|'BOUNDED_DEFINITION'}
/** Process Writer route: admitted source surfaces (or a bounded grammatical
 * realization of explicit nominal group order), plus connective questions.
 * No synthetic facts/causes, no padding to satisfy a duration target.
 * Narrative eligibility is independent of Engine3D visual production gates. */
export function writeCausalCuriosity(pack:EvidencePack){
 validateEvidencePack(pack);
 if(pack.researchPlan.policy.mechanismVersion!==2||pack.researchPlan.request.researchGoal!=='PROCESS')throw Error('CURIOSITY_ROUTE requires mechanismVersion 2 PROCESS');
 const a=buildCuriosityStoryPlan(pack),plan=buildTopicPlan({topicPlanningVersion:1,topic:pack.topic});
 const gate=topicWriterGate(plan,{resultState:null,writerStatus:null,rankingStatus:pack.ranking?.status??null,productionEligibility:pack.quality.productionEligibility});
 let eligible=gate.decision==='PROCEED_GROUNDED'&&['ADEQUATE','RICH'].includes(a.story.potential.rating);
 const progressive=pack.researchPlan.policy.progressiveStory===true,omissions:{relationId:string;reason:string}[]=[];
 const language=plan.analysis.language==='en'?'en':'pt';
 const rows:Omit<CuriositySentence,'id'|'span'>[]=[];
 if(a.story.nodes.length)rows.push({kind:'EDITORIAL',text:hooks[language][parseInt(a.story.fingerprint.slice(0,6),16)%2],storyNodeIds:[],relationIds:[],factIds:[],evidenceIds:[],roles:['HOOK'],...(progressive?{epistemicClass:'QUESTION' as const}:{})});
 const used=new Set<string>();
 // Follow source event order where given. Adjacent solutions share a literal
 // problem node; their navigation does not add an asserted causal relation.
 const pending=[...a.story.nodes],ordered:typeof pending=[];
 while(pending.length){const n=pending.shift()!;ordered.push(n);const next=a.story.links.find(l=>l.from===n.id&&pending.some(p=>p.id===l.to&&p.role==='SOLUTION'));if(next){const at=pending.findIndex(p=>p.id===next.to);ordered.push(...pending.splice(at,1));}}
 if(a.story.progression){const prefix=(id:string)=>{const r=a.knowledge.relations.find(r=>r.id===id)!;return entityKey(r.subject)===entityKey(topicSubject(pack.topic))?r.predicate==='HAS_GOAL'?0:r.predicate==='IS_A'?1:2:2;};ordered.sort((x,y)=>prefix(x.relationId)-prefix(y.relationId)||a.story.progression!.orderedRelationIds.indexOf(x.relationId)-a.story.progression!.orderedRelationIds.indexOf(y.relationId));}
 for(const node of ordered){
  const relation=a.knowledge.relations.find(r=>r.id===node.relationId)!;
  if(progressive&&relation.modality!=='ASSERTED'){omissions.push({relationId:relation.id,reason:'NON_ASSERTED_NOT_FACTUAL_BACKBONE'});continue;}
  const proof=[...relation.proof].sort((x,y)=>Number(pack.sources.find(s=>s.id===y.sourceId)?.language===(language==='pt'?'pt-BR':'en'))-Number(pack.sources.find(s=>s.id===x.sourceId)?.language===(language==='pt'?'pt-BR':'en'))||x.sourceId.localeCompare(y.sourceId,'en')||x.span.start-y.span.start)[0];
  const e=pack.evidence.find(e=>e.id===proof.evidenceId)!;let text=e.normalizedText.trim(),realization:'SOURCE_SURFACE'|'BOUNDED_DEFINITION'='SOURCE_SURFACE';
  // Admitted surface preserves original negation/modality/context. A resolved
  // nominal order uses only its explicitly stated groups and order verb.
  // Never narrate only half a conjunctive or conditional statement.
  let linked=a.knowledge.relations.filter(r=>(!progressive||r.modality==='ASSERTED')&&r.proof.some(p=>p.sourceId===proof.sourceId&&p.span.start===proof.span.start&&p.span.end===proof.span.end));
  if(progressive&&wordCount(text)>19*Math.max(1,linked.length)){
   // Only an unqualified explicit definition may use the canonical S/P/O.
   // Otherwise omit a low-density unit, never trim away a condition/modal.
   const definition=relation.subject+(pack.sources.find(s=>s.id===proof.sourceId)?.language==='en'?' is ':' é ')+relation.object+'.';
   const qualified=/\b(?:nao|não|nunca|not|never|pode|podem|might|may|se|if|quando|unless|caso|exceto|except|apenas|somente|only)\b/i.test(text);
   if(relation.predicate==='IS_A'&&!qualified&&!/^(?:local|parte|componente|sistema|place|part|component|system)$/i.test(relation.object)&&wordCount(definition)<=19){text=definition;linked=[relation];realization='BOUNDED_DEFINITION';}
   else{omissions.push({relationId:relation.id,reason:'LOW_DENSITY_CANNOT_COMPRESS_WITHOUT_LOSS'});continue;}
  }
  const surface=normalize(text);if(used.has(surface))continue;
  const words=wordCount(rows.map(r=>r.text).join(' '));
  if(words+wordCount(text)>160&&rows.some(r=>r.kind==='FACT'))continue;
  used.add(surface);
  rows.push({kind:'FACT',text,storyNodeIds:a.story.nodes.filter(n=>linked.some(r=>r.id===n.relationId)).map(n=>n.id),relationIds:linked.map(r=>r.id),factIds:[...new Set(linked.flatMap(r=>r.factIds))].sort(),evidenceIds:progressive?[...new Set(linked.flatMap(r=>r.proof.filter(p=>p.sourceId===proof.sourceId&&p.span.start===proof.span.start&&p.span.end===proof.span.end).map(p=>p.evidenceId)))].sort():[e.id],roles:[...new Set(a.story.nodes.filter(n=>linked.some(r=>r.id===n.relationId)).map(n=>n.role))],...(progressive?{epistemicClass:'FACT_SUPPORTED' as const,realization}:{})});
 }
 let at=0;
 const sentences:CuriositySentence[]=rows.map((r,i)=>{const span={start:at,end:at+r.text.length,text:r.text};at=span.end+1;return{...r,id:'CS'+(i+1),span};});
 const script=sentences.map(s=>s.text).join('\n'),factual=sentences.filter(s=>s.kind==='FACT'),relationIds=[...new Set(factual.flatMap(s=>s.relationIds))];
 if(progressive)eligible=eligible&&factual.length>0&&a.knowledge.relations.some(r=>relationIds.includes(r.id)&&r.modality==='ASSERTED'&&PHYSICAL.has(r.predicate));
 // Preserve rich relation semantics alongside the legacy graph. This is a
 // typed direction handoff, not a claim injection into the visual compiler.
 const legacyGraph=script?analyzeNaturalScript({version:1,id:'curiosity-'+a.story.fingerprint.slice(0,16),language:'pt-BR',script}):null;
 const handoff={version:'causal-semantic-handoff/1.0.0',storyFingerprint:a.story.fingerprint,scriptFingerprint:jsonHash(script),legacyGraph,
  relations:relationIds.map(id=>{const r=a.knowledge.relations.find(r=>r.id===id)!;return{...r,sentenceIds:factual.filter(s=>s.relationIds.includes(id)).map(s=>s.id),storyNodeIds:a.story.nodes.filter(n=>n.relationId===id).map(n=>n.id),visualHints:a.story.nodes.find(n=>n.relationId===id)!.visualHints};}),
  persistentSystemIntent:a.story.persistentSystemIntent,visualExecution:'NOT_EVALUATED',unsupportedLegacyRelations:relationIds.filter(id=>!['FLOW','ENTER','EXIT','RISE','DESCEND','ROTATE','MOVE'].includes(a.knowledge.relations.find(r=>r.id===id)!.predicate)),...(progressive?{progression:groundedProgression(a.knowledge,relationIds),storyNeeds:a.story.needs}:{})};
 const metrics={groundedKnowledgeUnits:relationIds.length,groundedSentenceUnits:factual.length,editorialUnits:sentences.length-factual.length,groundedRatio:sentences.length?factual.length/sentences.length:0,words:wordCount(script),estimatedSeconds:wordCount(script)/2.6,
  omittedRelationIds:a.knowledge.relations.filter(r=>!relationIds.includes(r.id)).map(r=>r.id),...(progressive?{omissions,classification:handoff.progression!.classification,maxEstimatedSecondsPerIdea:Math.max(0,...factual.map(s=>wordCount(s.text)/2.6/Math.max(1,s.relationIds.length)))}:{})};
 const review={explainsWhy:progressive?handoff.progression!.metrics.causalEdges>0:handoff.relations.some(r=>CAUSAL.has(r.predicate)),showsProgression:progressive?['PROGRESSIVE','PROGRESSIVE_CAUSAL'].includes(handoff.progression!.classification):handoff.relations.some(r=>r.predicate==='PRECEDES')||a.story.links.some(l=>relationIds.includes(l.from.slice(3))&&relationIds.includes(l.to.slice(3))),solutionsGrounded:handoff.relations.filter(r=>['SOLVES','PREVENTS'].includes(r.predicate)).every(r=>r.proof.length>0),avoidsEncyclopediaList:handoff.relations.some(r=>CAUSAL.has(r.predicate))&&handoff.relations.some(r=>PHYSICAL.has(r.predicate)),avoidsFakeHistory:a.story.historicalClaims.length===0,functionalPayoff:handoff.relations.some(r=>['OUTPUTS','TRANSFORM'].includes(r.predicate))};
 const raw={version:'causal-curiosity-writer/1.0.0',route:'CAUSAL_CURIOSITY_PROCESS',packFingerprint:pack.fingerprint,storyFingerprint:a.story.fingerprint,gate,eligible,status:eligible?'SCRIPT_GROUNDED':a.knowledge.relations.length?'KNOWLEDGE_LIMITED':'BLOCKED',lengthStatus:metrics.words<110?'KNOWLEDGE_LIMITED':metrics.words>160?'SOURCE_SENTENCE_TOO_LONG':'TARGET_RANGE',reason:eligible?'Narrative ready; visual production requires a separate gate':gate.decision!=='PROCEED_GROUNDED'?gate.reasons.join(';'):'Story potential '+a.story.potential.rating,script,sentences,metrics,review,handoff};
 return{...raw,fingerprint:jsonHash(raw)};
}
export type CuriosityWriter=ReturnType<typeof writeCausalCuriosity>;
/** Full replay detects re-signed relation, story, span and script changes. */
export function verifyCuriosityWriter(pack:EvidencePack,writer:CuriosityWriter,artifacts?:CuriosityArtifacts){
 return (!artifacts||verifyCuriosityArtifacts(pack,artifacts))&&jsonHash(writeCausalCuriosity(pack))===jsonHash(writer);
}
