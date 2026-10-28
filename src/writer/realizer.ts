import {jsonHash} from '../editorial/fingerprint';
import type {TopicScriptRequest,ScriptOutline,VisualNarrativeStrategy,ScriptCandidate,Utterance,WriterCapabilityProfile} from './contracts';
import {wordCount} from './request';
import {visualVocabulary} from './visual-vocabulary';
const contexts:Record<string,string>={
 OVERVIEW:'Observe a representação esquemática por inteiro, com atenção ao início, ao caminho e ao destino do exemplo visual.',
 SETUP:'Acompanhe esta representação esquemática com atenção ao mesmo objeto, sem imaginar detalhes além do que o exemplo apresenta.',
 GOAL:'Observe primeiro o objetivo desta representação e compare mentalmente o início com o resultado, sem acrescentar explicações ao exemplo.',
 PAUSE:'Observe cada parte com calma, mantendo a atenção no mesmo exemplo visual durante esta explicação.',
 CONCLUSION:'Em resumo, o objetivo desta explicação é acompanhar a sequência representada, com atenção ao início e ao resultado do exemplo.',
 LIMITS:'Nesta explicação, observe somente a representação, sem supor medidas, duração ou mecanismos reais a partir deste exemplo esquemático.',
 ATTENTION:'Por fim, acompanhe o exemplo por inteiro e compare as partes descritas, sem imaginar acontecimentos fora desta representação visual.',
};
export const safeAttentionPrompts=['Observe os detalhes da representação com atenção, sem confundir este exemplo visual com uma descrição completa de qualquer situação real.','Acompanhe a sequência do exemplo com calma, mantendo a atenção nas partes descritas e na ligação entre o início e o resultado.'];
export const shortAttention='Observe a sequência do exemplo e mantenha a atenção no conteúdo desta representação visual.';
export function assembleCandidate(base:Omit<ScriptCandidate,'script'|'utterances'|'fingerprint'>,utterances:Omit<Utterance,'sourceSpan'>[]):ScriptCandidate {
 let at=0;const script=utterances.map(u=>u.text.trim()).join('\n'),us=utterances.map(u=>{const text=u.text.trim(),span={start:at,end:at+text.length,text};at+=text.length+1;return{...u,text,sourceSpan:span};});
 const raw={...base,script,utterances:us};return{...raw,fingerprint:jsonHash(raw)};
}
export function realizeScript(request:TopicScriptRequest,outline:ScriptOutline,strategy:VisualNarrativeStrategy,profile:WriterCapabilityProfile,index:number):ScriptCandidate {
 const vocabulary=visualVocabulary(profile),liquid=strategy.centralSubject==='liquid';let seenCover=0,seenAccum=0;
 const us:Omit<Utterance,'sourceSpan'>[]=outline.blocks.map(b=>{
  let text=b.textSeed??'';
  const subject=b.canonicalSubject??(liquid?'A água':'O carro');
  if(!text&&b.operation){const forms=vocabulary[b.operation];if(!forms)throw Error('WRITER_CAPABILITY missing operation '+b.operation);
   if(b.operation==='EXIT')text=subject+' '+forms[0]+' um recipiente nesta representação.';
   if(b.operation==='FLOW')text=subject+(index%2?' passa pelo tubo':' percorre o tubo')+' até o recipiente de destino.';
   if(b.operation==='ENTER')text=subject+' entra no recipiente de destino.';
   if(b.operation==='FILL')text='O nível aumenta dentro do recipiente de destino.';
   if(b.operation==='ACCUMULATE')text=subject+(seenAccum++?' acumula gelo na superfície durante a representação.':' começa a acumular gelo nesta representação.');
   if(b.operation==='COVER')text=subject+(seenCover++?' permanece coberto de gelo na representação.':' fica coberto de gelo neste exemplo visual.');
  }
  if(!text&&b.purpose==='HOOK')text=(request.sourceMaterial??[]).some(s=>s.allowedForClaims)?'O que observar na sequência desta representação, com atenção ao conteúdo fornecido para o exemplo?':strategy.id==='PATH_JOURNEY'?'Como acompanhar o caminho entre o início e o destino deste exemplo visual?':strategy.id==='QUESTION_REVEAL'?'O que observar no resultado desta representação, sem imaginar detalhes fora do exemplo?':liquid?'Como acompanhar o trajeto de um líquido entre o início e o destino nesta representação?':'O que muda na superfície de um carro durante esta representação de acúmulo de gelo?';
  if(!text)text=contexts[b.purpose]??contexts.ATTENTION;
  if(b.purpose==='CONCLUSION'&&outline.conclusionType==='OPEN_QUESTION')text='Qual parte do caminho merece mais atenção nesta representação: o início, a ligação entre as partes ou o destino?';
  if(b.purpose==='CONCLUSION'&&outline.conclusionType==='ANSWER_REVEAL')text='Em resumo, observe o resultado do exemplo e retome mentalmente as partes da representação, sem acrescentar uma explicação externa.';
  return{blockId:b.id,purpose:b.purpose,operation:b.operation,text,canonicalText:text,permission:structuredClone(b.permission),canonicalSubject:b.canonicalSubject};
 });
 const min=request.targetWords?.min??110,max=request.targetWords?.max??160;
 // Generic context budget adjustment, never changing the physical utterances.
 let contextIndex=0;const padding=safeAttentionPrompts;
 while(wordCount(us.map(u=>u.text).join(' '))<min&&contextIndex<padding.length){const text=padding[contextIndex++];us.push({blockId:'SAFE_CONTEXT_'+contextIndex,purpose:'ATTENTION',operation:null,text,canonicalText:text,canonicalSubject:null,permission:{kind:'EDITORIAL',sourceMaterialId:null,sourceSpan:null,reason:'Neutral attention prompt; no additional fact'}});}
 while(wordCount(us.map(u=>u.text).join(' '))>max){const reversed=[...us].reverse().findIndex(u=>u.purpose==='ATTENTION'||u.purpose==='PAUSE'||u.purpose==='OVERVIEW');if(reversed<0)break;us.splice(us.length-1-reversed,1);}
 return assembleCandidate({id:'candidate-'+(index+1),provider:'DETERMINISTIC_LOCAL',strategy,outline,estimatedGapRisk:outline.blocks.some(b=>b.risk==='MEDIUM')?.2:0},us);
}
