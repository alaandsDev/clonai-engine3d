import {jsonHash} from '../editorial/fingerprint';
import type {TopicScriptRequest,WriterPolicy} from './contracts';
const keys=(x:object,allowed:string[],where:string)=>{for(const k of Object.keys(x))if(!allowed.includes(k))throw Error('WRITER_INPUT unknown '+where+'.'+k);};
export function validateRequest(x:TopicScriptRequest):void {
 if(!x||typeof x!=='object'||Array.isArray(x))throw Error('WRITER_INPUT object required');
 keys(x,['version','id','topic','language','format','factPolicy','targetWords','targetDurationSeconds','sourceMaterial','constraints','style'],'request');
 if(x.version!==1||typeof x.id!=='string'||!x.id.trim()||typeof x.topic!=='string'||!x.topic.trim()||x.topic.length>4000||x.language!=='pt-BR'||x.format!==undefined&&x.format!=='vertical_short')throw Error('WRITER_INPUT invalid identity/topic/language/format');
 if(!['SOURCE_ONLY','STRUCTURAL_ONLY','GROUNDED_ONLY','UNVERIFIED_CREATIVE'].includes(x.factPolicy??'STRUCTURAL_ONLY')||x.factPolicy==='UNVERIFIED_CREATIVE')throw Error('WRITER_FACT_POLICY unsupported policy; UNVERIFIED_CREATIVE is reserved');
 for(const [key,range] of [['targetWords',x.targetWords],['targetDurationSeconds',x.targetDurationSeconds]] as const){if(!range)continue;keys(range,['min','max'],key);if(!Number.isFinite(range.min)||!Number.isFinite(range.max)||range.min<1||range.max<range.min||range.max>(key==='targetWords'?300:120))throw Error('WRITER_INPUT invalid '+key);}
 if(x.sourceMaterial!==undefined&&!Array.isArray(x.sourceMaterial))throw Error('WRITER_INPUT source array');
 const ids=new Set<string>();for(const s of x.sourceMaterial??[]){keys(s,['id','text','provenance','allowedForClaims'],'source');if(typeof s.id!=='string'||!s.id||ids.has(s.id)||typeof s.text!=='string'||!s.text.trim()||s.text.length>12000||typeof s.provenance!=='string'||!s.provenance.trim()||typeof s.allowedForClaims!=='boolean')throw Error('WRITER_INPUT source metadata');ids.add(s.id);}
 if(x.constraints){keys(x.constraints,['minExecutableTimelineRate','maxPrimaryGapRate','maxRevisions','maxPrimaryClaims','maxCentralEntities','maxDomains','allowSourceOmissions'],'constraints');for(const [k,v] of Object.entries(x.constraints)){if(k==='allowSourceOmissions'){if(typeof v!=='boolean')throw Error('WRITER_INPUT omission boolean');}else if(!Number.isFinite(v)||Number(v)<0||Number(v)>(k.includes('Rate')?1:k==='maxRevisions'?2:k==='maxDomains'?2:16)||!k.includes('Rate')&&!Number.isInteger(v))throw Error('WRITER_INPUT invalid budget '+k);}}
 if(x.style){keys(x.style,['tone'],'style');if(x.style.tone!==undefined&&!['CLEAR','CONVERSATIONAL'].includes(x.style.tone))throw Error('WRITER_INPUT tone');}
}
export function writerPolicy(x:TopicScriptRequest):WriterPolicy{return{version:'writer-policy/1.0.0',minExecutableTimelineRate:.85,maxPrimaryGapRate:.15,maxRevisions:2,maxPrimaryClaims:8,maxCentralEntities:4,maxDomains:2,allowSourceOmissions:false,...x.constraints};}
/** Request ID is transport metadata and never chooses content or semantic IDs. */
export function contentKey(x:TopicScriptRequest){const{id,...content}=x;return jsonHash(JSON.parse(JSON.stringify({...content,factPolicy:x.factPolicy??'STRUCTURAL_ONLY'}))).slice(0,16);}
export const wordCount=(text:string)=>text.trim()?text.trim().split(/\s+/).length:0;
