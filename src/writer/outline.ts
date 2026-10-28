import {analyzeNaturalScript} from '../narrative';
import {normalize} from '../semantics/normalize';
import type {TopicScriptRequest,TopicAnalysis,WriterCapabilityProfile,VisualNarrativeStrategy,ScriptOutline,OutlineBlock,Permission} from './contracts';
export function sourceRealization(text:string,allSource:string):string {
 const g=analyzeNaturalScript({version:1,id:'source-grammar',language:'pt-BR',script:allSource}),liquids=g.entities.filter(e=>e.semanticTags.includes('liquid'));
 // A narrowly bounded surface clarification. A unique liquid already introduced
 // by the source licenses an explicit noun in the source's elliptical entrance.
 let result=text.trim();
 const unambiguousTransfer=g.clauses.every(c=>g.events.some(e=>e.clauseId===c.id))&&g.events.every(e=>['EXIT','FLOW','ENTER','INCREASE'].includes(e.predicate)&&(!e.subjectEntityIds.length?e.predicate==='ENTER'&&/^\s*Depois\s+entra\b/i.test(e.sourceSpan.text):e.subjectEntityIds.every(id=>g.entities.find(x=>x.id===id)?.semanticTags.some(t=>t==='liquid'||t==='level'))));
 if(liquids.length===1&&unambiguousTransfer){const subject=/liquido/.test(normalize(liquids[0].sourceSpan.text))?'O líquido':'A água';result=result.replace(/^Ela\b/,subject).replace(/^(Depois)\s+entra\b/i,'$1, '+subject.toLowerCase()+' entra');}
 // Introduce already source-named containers explicitly, without adding an
 // object, location, quantity, relation or mechanism to the provided content.
 result=result.replace(/\bdo recipiente (inferior|superior)\b/g,'de um recipiente $1').replace(/\bno recipiente (inferior|superior)\b/g,'em um recipiente $1');
 result=result.replace(/,\s*onde o nível aumenta\b/gi,'. O nível aumenta');
 return result;
}
export function planOutline(request:TopicScriptRequest,a:TopicAnalysis,p:WriterCapabilityProfile,s:VisualNarrativeStrategy):ScriptOutline {
 const topicSpan={start:0,end:request.topic.length,text:request.topic};
 const structural:Permission={kind:'TOPIC_STRUCTURE',sourceMaterialId:null,sourceSpan:topicSpan,reason:'Requested structural demonstration; schematic staging is not a factual mechanism or real-world measurement'};
 const editorial:Permission={kind:'EDITORIAL',sourceMaterialId:null,sourceSpan:null,reason:'Neutral observation/instruction about the representation; no world fact'};
 const facts:OutlineBlock[]=[];
 const block=(purpose:string,operation:string|null,permission:Permission,textSeed:string|null=null,canonicalSubject:string|null=null):OutlineBlock=>({id:'',purpose,targetClaims:operation?[operation+' as a textual visual intention, not a SemanticClaim']:[],requiredCapabilities:operation?[operation]:[],estimatedWords:operation?10:17,risk:'LOW',visualIntent:operation?operation.toLowerCase()+' of the represented subject':'Guide attention without adding a physical event',operation,permission,textSeed,canonicalSubject});
 if((request.sourceMaterial??[]).some(x=>x.allowedForClaims)){
  for(const source of request.sourceMaterial!.filter(x=>x.allowedForClaims)){
   const g=analyzeNaturalScript({version:1,id:'source-outline-'+source.id,language:'pt-BR',script:source.text});
   for(const u of g.analysis.narrativeUnits)facts.push(block('SOURCE_SEQUENCE','SOURCE_TEXT',{kind:'SOURCE_FACT',sourceMaterialId:source.id,sourceSpan:{...u.sourceSpan},reason:'Source text retained; bounded elliptical subject clarification is separately reproducible'},sourceRealization(u.sourceSpan.text,source.text)));
  }
 }else if(a.family==='TRANSFER'){
  const subject=/liquido/.test(a.normalizedTopic)?'O líquido':'A água';
  facts.push(block('ORIGIN','EXIT',structural,null,subject),block('PATH','FLOW',{...structural,kind:'VISUAL_CONVENTION',reason:'A schematic connecting tube instantiates the requested path, without asserting a real supply mechanism'},null,subject),block('DESTINATION','ENTER',structural,null,subject),block('RESULT','FILL',structural,null,'O nível'));
 }else if(a.family==='ACCUMULATION'){
  facts.push(block('ONSET','ACCUMULATE',structural,null,'O carro'),block('PROGRESS','ACCUMULATE',structural,null,'O veículo'),block('RESULT','COVER',structural,null,'O carro'),block('HOLD','COVER',structural,null,'O veículo'));
 }
 const contexts=s.narrativeArc.filter(p=>['HOOK','OVERVIEW','SETUP','GOAL','PAUSE','CONCLUSION'].includes(p)).map(purpose=>block(purpose,null,editorial));
 // SOURCE_SEQUENCE preserves physical order and meaning. Narrative variation is
 // in question/goal/attention placement, never reversal of causal operations.
 let blocks:OutlineBlock[]=[];
 if(s.id==='PATH_JOURNEY')blocks=[facts[0],contexts.find(c=>c.purpose==='HOOK')!,facts[1],...contexts.filter(c=>c.purpose==='PAUSE'),...facts.slice(2),...contexts.filter(c=>c.purpose==='CONCLUSION')].filter(Boolean);
 else if(s.id==='BEFORE_AFTER')blocks=[...contexts.filter(c=>['SETUP','HOOK'].includes(c.purpose)),...facts.slice(0,2),...contexts.filter(c=>c.purpose==='PAUSE'),...facts.slice(2),...contexts.filter(c=>c.purpose==='CONCLUSION')];
 else blocks=[...contexts.filter(c=>c.purpose!=='CONCLUSION'),...facts,...contexts.filter(c=>c.purpose==='CONCLUSION')];
 if(!blocks.some(b=>b.purpose==='SETUP'||b.purpose==='OVERVIEW'||b.purpose==='GOAL'))blocks.splice(1,0,block('SETUP',null,editorial));
 // Word padding is composed from neutral attention blocks, not new facts.
 blocks.push(block('LIMITS',null,editorial),block('ATTENTION',null,editorial));
 const central=s.centralSubject==='vehicle'?['vehicle','ice']:['liquid','source_container','path','destination_container'];
 return{strategyId:s.id,hookType:s.hook,conclusionType:s.id==='PATH_JOURNEY'?'OPEN_QUESTION':s.id==='QUESTION_REVEAL'?'ANSWER_REVEAL':'RECAP',blocks:blocks.map((b,i)=>({...b,id:'B'+(i+1)})),centralEntities:central,domains:[s.centralSubject==='vehicle'?'VEHICLE_STATE':'LIQUID_PROCESS']};
}
