import {normalize,normalizedView} from '../semantics/normalize';
import {modalityOf} from '../semantics/predicates';
import {CONTENT_INTENTS} from './contracts';
import type {ContentIntent,ContentMode,EpistemicMode,SignalMatch,TopicAnalysis,ComparisonProfile,TemporalProfile,ClaimFamily} from './contracts';
import {SIGNAL_RULES,SUPERLATIVE_DIMENSIONS,countOf,PT_FUNCTION,EN_FUNCTION} from './signals';
import {expectedFamilies,claimRequirements,researchLevel} from './claims';
/** Folded, punctuation-collapsed view whose offsets map back to the raw topic. */
export function topicView(raw:string){
 const v=normalizedView(raw);let text='';const map:number[]=[];let space=true;
 for(let i=0;i<v.text.length;i++){const c=v.text[i],keep=/[a-z0-9'-]/.test(c);if(!keep){if(space)continue;space=true;text+=' ';map.push(i);}else{space=false;text+=c;map.push(i);}}
 if(text.endsWith(' ')){text=text.slice(0,-1);map.pop();}
 return{text,span:(start:number,end:number)=>v.span(map[start],map[end-1]+1)};
}
export const normalizeTopic=(topic:string)=>topicView(topic).text;
/** Priority decides the primary intent only; all detected intents stay visible. */
const PRIMARY_PRIORITY:ContentIntent[]=['NARRATIVE','HYPOTHETICAL','RANKING','COMPARISON','MYTH_CHECK','BIOGRAPHICAL','HISTORICAL','LIST'];
const QUESTION_FAMILIES:[RegExp,ClaimFamily][]=[[/^(?:quantos|quantas|quanto|how many|how much)(?![a-z])/,'QUANTITY'],[/^(?:quando|when)(?![a-z])/,'EVENT_DATE'],[/^(?:onde|where)(?![a-z])/,'LOCATION']];
export function analyzeTopicSignals(topic:string):TopicAnalysis{
 const view=topicView(topic),text=view.text,signals:SignalMatch[]=[];
 for(const rule of SIGNAL_RULES){rule.pattern.lastIndex=0;for(const m of text.matchAll(rule.pattern)){if(!m[0])continue;const span=view.span(m.index!,m.index!+m[0].length);signals.push({id:rule.id,intent:rule.intent,feature:rule.feature,start:span.start,end:span.end,text:span.text});}}
 const ptScore=[...text.matchAll(PT_FUNCTION)].length,enScore=[...text.matchAll(EN_FUNCTION)].length;
 const language:TopicAnalysis['language']=enScore>ptScore?'en':ptScore>enScore||!enScore?'pt':'mixed';
 if(language==='en'&&/^a [a-z]+/.test(text)){const span=view.span(0,text.indexOf(' ',2)<0?text.length:text.indexOf(' ',2));signals.push({id:'fiction.indefinite-protagonist',intent:null,feature:'indefinite-start',start:span.start,end:span.end,text:span.text});}
 signals.sort((a,b)=>a.start-b.start||a.end-b.end||a.id.localeCompare(b.id,'en'));
 const has=(feature:string)=>signals.some(s=>s.feature===feature),reasonCodes:string[]=[],riskFlags:string[]=[];
 const question=topic.includes('?')||has('interrogative');
 const hypothetical=has('counterfactual')||(has('subjunctive')&&has('conditional'))||modalityOf(topic)==='HYPOTHETICAL';
 const fiction=has('fiction-marker')||(has('indefinite-start')&&has('narrative-verb')&&!question);
 const intents=new Set<ContentIntent>(signals.flatMap(s=>s.intent?[s.intent]:[]));
 if(fiction){intents.add('NARRATIVE');intents.add('FICTION');reasonCodes.push(has('fiction-marker')?'FICTION_EXPLICIT_MARKER':'FICTION_NARRATIVE_PREMISE');}
 else{intents.delete('FICTION');}
 if(hypothetical){intents.add('HYPOTHETICAL');intents.add('CAUSE_EFFECT');reasonCodes.push('HYPOTHETICAL_PREMISE_DETECTED');}
 // A narrative premise is not an explanation request just because it contains a domain noun.
 const explanatory=has('functioning')||has('definition')||has('imperative-explain')||has('why');
 const words=text.split(' ').filter(Boolean),bare=!question&&!fiction&&!hypothetical&&words.length<=3&&[...intents].every(i=>['SCIENTIFIC','TECHNICAL','BIOLOGICAL','GEOGRAPHIC'].includes(i));
 const questionFamilies=QUESTION_FAMILIES.filter(([p])=>p.test(text)).map(([,f])=>f);
 if(questionFamilies.length&&!explanatory)intents.add('EXPLANATION');
 // Counts and census figures are specific quantities even without a question word.
 if((has('quantity')||has('population'))&&!questionFamilies.includes('QUANTITY')&&!intents.has('RANKING'))questionFamilies.push('QUANTITY');
 let primary:ContentIntent='UNKNOWN';
 if(bare){reasonCodes.push(intents.size?'AMBIGUOUS_BARE_TOPIC':'NO_INTENT_SIGNAL');riskFlags.push('AMBIGUOUS_INTENT');}
 else{
  primary=PRIMARY_PRIORITY.find(i=>intents.has(i))??(explanatory?'EXPLANATION':has('manner-change')?'PROCESS':(['PROCESS','CAUSE_EFFECT','EXPLANATION','BIOLOGICAL','TECHNICAL','SCIENTIFIC','GEOGRAPHIC'] as ContentIntent[]).find(i=>intents.has(i))??'UNKNOWN');
  if(primary==='UNKNOWN'){reasonCodes.push('NO_INTENT_SIGNAL');riskFlags.push('AMBIGUOUS_INTENT');}
  else reasonCodes.push('PRIMARY_INTENT_'+primary);
 }
 const anchors=[...new Set([...topic.matchAll(/(?<![\p{L}\p{N}])\p{Lu}[\p{L}\p{M}'-]*/gu)].filter(m=>m.index!>0||words.length===1).map(m=>m[0]))].sort();
 const secondary=CONTENT_INTENTS.filter(i=>i!==primary&&i!=='UNKNOWN'&&intents.has(i));
 const factualRequest=explanatory||['RANKING','COMPARISON','HISTORICAL','BIOGRAPHICAL','MYTH_CHECK','LIST'].some(i=>intents.has(i as ContentIntent));
 const contentMode:ContentMode=fiction?(factualRequest?'HYBRID':'CREATIVE'):primary==='UNKNOWN'?'UNKNOWN':hypothetical?'FACTUAL_HYPOTHETICAL':intents.has('RANKING')?'FACTUAL_RANKING':intents.has('COMPARISON')?'FACTUAL_COMPARATIVE':['EXPLANATION','PROCESS','CAUSE_EFFECT','SCIENTIFIC','TECHNICAL','BIOLOGICAL'].includes(primary)?'FACTUAL_EXPLANATORY':'FACTUAL';
 reasonCodes.push('MODE_'+contentMode);
 const dim=SUPERLATIVE_DIMENSIONS.find(d=>{d.pattern.lastIndex=0;return d.pattern.test(text);})??null;
 const ranking=intents.has('RANKING')&&contentMode!=='CREATIVE';
 const comparisonProfile:ComparisonProfile=ranking?{kind:'SUPERLATIVE_RANKING',rankingCount:countOf(text),direction:dim?.direction??null,dimension:dim?.id??null,scope:'SESSION_CANDIDATES',globalSuperlativeGuard:true}:intents.has('COMPARISON')?{kind:'PAIRWISE',rankingCount:null,direction:null,dimension:null,scope:null,globalSuperlativeGuard:false}:intents.has('LIST')?{kind:'LIST',rankingCount:countOf(text),direction:null,dimension:null,scope:null,globalSuperlativeGuard:false}:{kind:'NONE',rankingCount:null,direction:null,dimension:null,scope:null,globalSuperlativeGuard:false};
 const residence=has('residence')&&!fiction;
 if(ranking){riskFlags.push('GLOBAL_SUPERLATIVE_GUARD');if(!dim||!dim.metric)riskFlags.push('RANKING_METRIC_UNSUPPORTED');else if(dim.qualifier)riskFlags.push('RANKING_QUALIFIER_DEFAULTED');if(residence&&!has('permanent'))riskFlags.push('RESIDENCY_CRITERION_AMBIGUOUS');}
 const years=[...new Set(signals.filter(s=>s.feature==='year').map(s=>Number(s.text)))].sort((a,b)=>a-b);
 const temporalProfile:TemporalProfile=fiction?{kind:'FICTIONAL',currentnessRequired:false,explicitYears:years}:hypothetical?{kind:'HYPOTHETICAL',currentnessRequired:false,explicitYears:years}:intents.has('HISTORICAL')||intents.has('BIOGRAPHICAL')?{kind:'HISTORICAL',currentnessRequired:false,explicitYears:years}:has('current')||residence?{kind:'CURRENT',currentnessRequired:true,explicitYears:years}:contentMode==='FACTUAL_EXPLANATORY'?{kind:'TIMELESS',currentnessRequired:false,explicitYears:years}:{kind:'UNSPECIFIED',currentnessRequired:false,explicitYears:years};
 if(temporalProfile.currentnessRequired)riskFlags.push('CURRENTNESS_REQUIRED');
 const negated=has('negation');if(negated)riskFlags.push('NEGATED_PREMISE');
 if(hypothetical)riskFlags.push('COUNTERFACTUAL_PREMISE');
 if(fiction&&anchors.length)riskFlags.push('REAL_ENTITY_IN_FICTION');
 if(contentMode==='HYBRID')riskFlags.push('MIXED_EPISTEMIC');
 if(intents.has('BIOGRAPHICAL'))riskFlags.push('REAL_PERSON');
 const premiseSignal=signals.find(s=>s.feature==='subjunctive')??signals.find(s=>s.feature==='counterfactual');
 const premiseText=premiseSignal?topic.slice(premiseSignal.start).replace(/[?.!]+\s*$/,'').trim():hypothetical?topic.trim():null;
 const epistemicModes:EpistemicMode[]=contentMode==='CREATIVE'?['CREATIVE']:contentMode==='HYBRID'?['CREATIVE','FACTUAL']:contentMode==='FACTUAL_HYPOTHETICAL'?['FACTUAL','HYPOTHETICAL','SUPPORTED_INFERENCE']:contentMode==='UNKNOWN'?['UNKNOWN']:intents.has('PROCESS')?['FACTUAL','STRUCTURAL']:['FACTUAL'];
 const families=expectedFamilies({mode:contentMode,intents:[...intents],rankingMetric:dim?.metric??null,residence,anchors,questionFamilies,definitional:has('definition')});
 const reqs=claimRequirements(families,temporalProfile),level=researchLevel(reqs,contentMode);
 const interpretations:ContentIntent[]=primary!=='UNKNOWN'?[]:CONTENT_INTENTS.filter(i=>i==='EXPLANATION'||intents.has(i)||(i==='HISTORICAL'||i==='BIOGRAPHICAL')&&anchors.length>0&&!intents.size);
 const writerRequirement:TopicAnalysis['writerRequirement']=contentMode==='UNKNOWN'?'CLARIFICATION_REQUIRED':contentMode==='CREATIVE'?'CREATIVE_ISOLATED':contentMode==='HYBRID'?'HYBRID_SEPARATED':level==='NONE'?'STRUCTURAL_ONLY':'GROUNDED_ONLY';
 return{topic,normalizedTopic:normalize(topic).replace(/\s+/g,' ').trim(),language,primaryIntent:primary,secondaryIntents:secondary,contentMode,
  factualityProfile:{epistemicModes,requiresExternalFacts:contentMode!=='CREATIVE',topicIsEvidence:false,hypotheticalPremise:hypothetical&&premiseText?{text:premiseText,preserved:true,asserted:false}:null,fictionalPremise:fiction,realWorldAnchors:anchors,negated,question},
  comparisonProfile,temporalProfile,creativeProfile:{fiction,narrativePremise:fiction?topic.trim():null,fictionalEventsAreEvidence:false,realSettingAnchors:fiction?anchors:[]},
  expectedClaimFamilies:families,researchRequirement:level,writerRequirement,riskFlags:[...new Set(riskFlags)].sort(),reasonCodes:[...new Set(reasonCodes)],interpretations,signals};
}
