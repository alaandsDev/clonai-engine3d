import {normalize} from '../../semantics/normalize';
import {topicSubject} from '../../topic/subject';
import type {SearchResult} from './contracts';
import {mechanismRules} from '../mechanism-language';
/** Selection metadata only. Never Evidence, an identity alias, or authority. */
export const identityTokens=(s:string)=>normalize(s.replace(/<[^>]*>/g,' ')).match(/[a-z][a-z0-9]*/g)?.filter(w=>!['a','o','as','os','um','uma','de','do','da','dos','das','the','an','of','for','and','e'].includes(w)).map(w=>w.length>5&&w.endsWith('ores')?w.slice(0,-2):w.length>4&&w.endsWith('s')?w.slice(0,-1):w)??[];
const mechanical=new RegExp('\\b(?:'+mechanismRules.filter(r=>r.type==='PROCESS').map(r=>r.pattern).join('|')+')\\b');
const intent=(s:string)=>/\b(?:mecanismo|mechanism|principio|principle|operacao|operation|through|causad[oa]s?|devido|funciona|funcionam|working)\b/.test(normalize(s))||mechanical.test(normalize(s));
export interface SearchResultRelevance {resultFingerprint:string;score:number;signals:string[];penalties:string[];decision:'FETCH'|'SKIP_LOW_RELEVANCE'|'SKIP_SCOPE_MISMATCH';topicTokens:string[]}
export function searchResultRelevance(topic:string,r:Pick<SearchResult,'title'|'snippet'|'url'|'fingerprint'>):SearchResultRelevance{
 let leaf=r.url.split('/').at(-1)??'';try{leaf=decodeURIComponent(leaf);}catch{/* Metadata remains untrusted; transport validates URLs independently. */}
 const target=[...new Set(identityTokens(topicSubject(topic)))],title=identityTokens(r.title),snippet=identityTokens(r.snippet),url=identityTokens(leaf);
 const covers=(xs:string[])=>target.length>0&&target.every(t=>xs.includes(t)),t=covers(title),s=covers(snippet),u=covers(url),exact=t&&title.length===target.length,mechanism=intent(r.title+' '+r.snippet),signals:string[]=[],penalties:string[]=[];
 if(t)signals.push('TITLE_ALL_TOPIC_TOKENS');if(s)signals.push('SNIPPET_ALL_TOPIC_TOKENS');if(u)signals.push('URL_ALL_TOPIC_TOKENS');if(exact)signals.push('EXACT_TOPIC_TITLE');if(mechanism)signals.push('MECHANISM_INTENT');
 const partial=target.some(x=>title.includes(x));if(partial&&!t&&target.length>1)penalties.push('DISCRIMINATING_TOPIC_QUALIFIER_MISSING');if(!t&&s&&!mechanism)penalties.push('INCIDENTAL_SNIPPET_MENTION');
 const decision=partial&&!t&&target.length>1?'SKIP_SCOPE_MISMATCH':exact||t&&mechanism||!t&&s&&mechanism?'FETCH':!t&&!s&&!u?'SKIP_SCOPE_MISMATCH':'SKIP_LOW_RELEVANCE';
 const score=(exact?100:t?65:0)+(s?20:0)+(u?5:0)+(mechanism?15:0)-penalties.length*25;
 return{resultFingerprint:r.fingerprint,score,signals,penalties,decision,topicTokens:target};
}
export function postFetchScope(topic:string,doc:{title:string;normalized:{text:string}}){
 const target=identityTokens(topicSubject(topic)),title=identityTokens(doc.title.split(/\s[–—-]\s/)[0]);
 const body=doc.normalized.text.split('\n').filter(l=>{const t=identityTokens(l);return normalize(l)!==normalize(doc.title)&&!(t.length===target.length&&target.every(x=>t.includes(x)));}).join('\n').slice(0,8000),early=identityTokens(body);
 const exact=target.length>0&&target.length===title.length&&target.every(t=>title.includes(t)),mentions=target.length>0&&target.every(t=>early.includes(t)),context=mentions&&intent(body),accepted=mentions&&(exact||context);
 return{onTopic:accepted,identity:accepted&&exact?'DOCUMENT_IDENTITY':context?'CONTEXT_ONLY_NOT_IDENTITY':'SCOPE_REJECTED',reason:accepted&&exact?'Qualified document identity confirmed in body':context?'Qualified topic and mechanism in body; extraction scope still independently required':'Title/metadata alone do not establish body scope',evidenceCreated:false as const};
}
