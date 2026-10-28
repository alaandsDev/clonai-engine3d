import type {TopicScriptRequest,ScriptCandidate,Revision} from './contracts';
import {assembleCandidate,safeAttentionPrompts,shortAttention} from './realizer';
import {wordCount,writerPolicy} from './request';
export function reviseDuration(request:TopicScriptRequest,c:ScriptCandidate,measuredSeconds:number,iteration:number):{candidate:ScriptCandidate;revision:Revision|null} {
 if(!Number.isFinite(measuredSeconds)||measuredSeconds<=0)throw Error('WRITER_DURATION invalid measured seconds');
 const target=request.targetDurationSeconds??{min:40,max:60};if(iteration>writerPolicy(request).maxRevisions||measuredSeconds>=target.min&&measuredSeconds<=target.max)return{candidate:c,revision:null};
 const us=c.utterances.map(({sourceSpan,...u})=>({...u}));const min=request.targetWords?.min??110,max=request.targetWords?.max??160;
 if(measuredSeconds>target.max){
  const desired=Math.max(min,Math.floor(wordCount(c.script)*((target.min+target.max)/2)/measuredSeconds));
  for(let i=us.length-1;i>=0&&wordCount(us.map(u=>u.text).join(' '))>desired;i--){if(us[i].permission.kind!=='EDITORIAL'||['HOOK','CONCLUSION','LIMITS'].includes(us[i].purpose))continue;const count=wordCount(us.map(u=>u.text).join(' '));if(count-wordCount(us[i].text)>=min)us.splice(i,1);else if(wordCount(us[i].text)>wordCount(shortAttention)&&count-wordCount(us[i].text)+wordCount(shortAttention)>=min)us[i]={...us[i],text:shortAttention,canonicalText:shortAttention};}
 }else{const text=safeAttentionPrompts.find(t=>!us.some(u=>u.text===t));if(text&&wordCount(c.script)+wordCount(text)<=max)us.push({blockId:'DURATION_'+iteration,purpose:'ATTENTION',operation:null,canonicalSubject:null,text,canonicalText:text,permission:{kind:'EDITORIAL',sourceMaterialId:null,sourceSpan:null,reason:'Measured-duration safe context expansion, no new factual information'}});}
 const{script,utterances,fingerprint,...base}=c,candidate=assembleCandidate(base,us);if(candidate.script===c.script)return{candidate:c,revision:null};
 return{candidate,revision:{candidateId:c.id,iteration,operation:measuredSeconds>target.max?'SHORTEN_CONTEXT':'EXPAND_SAFE_CONTEXT',before:c.script,after:candidate.script,reason:'Actual fixed-voice TTS measured '+measuredSeconds+'s outside '+target.min+'–'+target.max+'s; no rate/pitch adjustment',affectedGapIds:[],semanticImpact:'Only neutral editorial context changed; every licensed physical/source utterance is preserved',provenance:us.map(u=>u.permission),beforeFingerprint:c.fingerprint,afterFingerprint:candidate.fingerprint}};
}
