import {analyzeNaturalScript} from '../narrative';
import {normalize} from '../semantics/normalize';
import type {TopicScriptRequest,TopicAnalysis,TopicCapabilityMatch,WriterCapabilityProfile} from './contracts';
import {contentKey} from './request';
export function analyzeTopic(request:TopicScriptRequest):TopicAnalysis {
 const rawTopic=request.topic,n=normalize(rawTopic),sources=(request.sourceMaterial??[]).filter(s=>s.allowedForClaims),graphs=sources.map(s=>analyzeNaturalScript({version:1,id:'source-'+s.id,language:'pt-BR',script:s.text}));
 const g=analyzeNaturalScript({version:1,id:'topic-'+contentKey(request),language:'pt-BR',script:rawTopic});
 const entities=[...new Set([...g.entities,...graphs.flatMap(g=>g.entities)].flatMap(e=>e.semanticTags))].sort();
 const explicitTransfer=/\b(?:agua|liquido)\b/.test(n)&&/chega|chegar|percor|percorr|saindo|sai|ench|trajeto|caminho|reservatorio/.test(n);
 const accumulation=/\b(?:carro|veiculo)\b/.test(n)&&/acumul.*gelo|gelo.*acumul/.test(n);
 const sourceMode=sources.length>0;
 let family:TopicAnalysis['family']=sourceMode?'SOURCE':explicitTransfer?'TRANSFER':accumulation?'ACCUMULATION':'UNKNOWN';
 const unknown:string[]=[];
 if(sourceMode){const sourceTags=new Set(graphs.flatMap(g=>g.entities.flatMap(e=>e.semanticTags)));for(const tag of ['liquid','vehicle','scientific_crowd'])if(g.entities.some(e=>e.semanticTags.includes(tag))&&!sourceTags.has(tag))unknown.push('Topic/source subject mismatch: '+tag);}
 if(/reator|nuclear|motor|coracao|planeta|bomba|poco artesiano|pressao|geolog|gravidade/.test(n))unknown.push('Unprovided mechanism or specialized concept');
 if(/historia|segunda guerra|recorde|estatistica|pesquisa|por que|porque/.test(n))unknown.push('Factual explanation requires an authorized source');
 if(/pesquisadores|equipamentos cientificos/.test(n))unknown.push('scientific_crowd / scientific_equipment operations');
 if(/\d|\b(?:cinco|dez|vinte|cem|mil|segundos|horas|por cento)\b/.test(n)&&!sourceMode)unknown.push('Specific quantity requires sourceMaterial; topic is not a fact source');
 if(!sourceMode&&/\b(?:vostok|antartida|siberia|yakutsk)\b/.test(n))unknown.push('Specific named location requires sourceMaterial');
 // Unknown lexical residue is conservative: a recognizable liquid does not license
 // a specialized mechanism, extra subjects, or an arbitrary attached instruction.
 if(!sourceMode&&/avio|cientist|estacao|cidade|bateria|combustivel|voa|teletransport|explos|cura|radioativ/.test(n))unknown.push('Requested concept outside the supported structural angle');
 if(!sourceMode){const allowed=new Set('como a o as os um uma uns umas de do da dos das d em no na nos nas para ate pelo pela por e ao aos essa esse este esta neste nesta outro outra mesmo mesma mostre mostrar explique explicar acompanhe ver funciona agua liquido chega chegar sai sair saindo percorre percorrer percorrendo passa passando caminho trajeto tubo tubulacao recipiente reservatorio caixa carro veiculo acumula acumular acumulando acumulacao gelo frio enchendo encher enche enchimento entre inicio destino superior inferior normal superficie exemplo visual representacao processo'.split(' '));const residue=[...new Set(n.match(/[a-z]+/g)??[])].filter(t=>!allowed.has(t));if(residue.length)unknown.push('Unlicensed topic concepts: '+residue.join(', '));}
 if(unknown.length)family='UNKNOWN';
 return{rawTopic,normalizedTopic:n,entities,requestedRelation:family==='TRANSFER'?['source','path','destination']:[],requestedProcess:family==='TRANSFER'?['FLOW','ENTER','FILL']:[],requestedTransformation:family==='ACCUMULATION'?['ACCUMULATE','COVER']:[],questionType:/como/.test(n)?'HOW':n.includes('?')?'QUESTION':'SHOW',knownFromInput:[{text:rawTopic,provenance:'TOPIC',sourceMaterialId:null,sourceSpan:{start:0,end:rawTopic.length,text:rawTopic}},...sources.map(s=>({text:s.text,provenance:'SOURCE' as const,sourceMaterialId:s.id,sourceSpan:{start:0,end:s.text.length,text:s.text}}))],unknownRequirements:unknown,candidateDomains:sourceMode?[...new Set(graphs.flatMap(g=>g.events.map(e=>e.domain)))]:family==='TRANSFER'?['LIQUID_PROCESS']:family==='ACCUMULATION'?['VEHICLE_STATE']:[],confidence:family==='UNKNOWN'?'LOW':'HIGH',family,sourceGraphFingerprints:graphs.map(g=>g.fingerprint)};
}
export function matchTopic(a:TopicAnalysis,p:WriterCapabilityProfile):TopicCapabilityMatch {
 const required=a.family==='TRANSFER'?['FLOW','CONNECT','FILL']:a.family==='ACCUMULATION'?['OBJECT_ACCUMULATE','OBJECT_STATE_CHANGE']:[];
 const caps=new Set(p.snapshot.flatMap(n=>n.capabilities)),missingCapabilities=required.filter(c=>!caps.has(c));
 const missingConcepts=[...a.unknownRequirements];if(a.family==='UNKNOWN'&&!missingConcepts.length)missingConcepts.push('No unambiguous supported structural process in input');
 const supported=a.family!=='UNKNOWN'&&!missingCapabilities.length;
 return{status:supported?'SUPPORTED':a.entities.includes('scientific_crowd')?'PARTIALLY_SUPPORTED':a.family==='UNKNOWN'&&!a.unknownRequirements.length?'AMBIGUOUS':'UNSUPPORTED',missingConcepts,missingCapabilities,reason:supported?'A bounded visual angle is available; final eligibility still requires semantic/narrative/factual preflight':'No licensed executable explanation; geometric similarity never establishes conceptual support',possibleSupportedAngles:supported?[]:p.bundles.filter(b=>b.id==='LIQUID_TRANSFER'||b.id==='VEHICLE_ACCUMULATION').map(b=>'Separate request could use '+b.id+'; not an automatic replacement')};
}
