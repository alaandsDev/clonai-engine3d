import {createHash} from 'node:crypto';
import {jsonHash} from '../editorial/fingerprint';
import {SCRIPT_MODE_VERSION,SCRIPT_SOURCE_TYPE,type ScriptSource,type ScriptSpan} from './contracts';
/** Script ingestion: whitespace/line-break normalization only. Words, punctuation and order are
 * never rewritten; every later span refers to the normalized text, whose fingerprint is recorded. */
export const MAX_SCRIPT_CHARS=20000;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
export function ingestScript(raw:string):ScriptSource{
 if(typeof raw!=='string')throw Error('SCRIPT_INPUT text required');
 if(raw.includes('\u0000'))throw Error('SCRIPT_INPUT binary content refused');
 if(raw.length>MAX_SCRIPT_CHARS)throw Error('SCRIPT_INPUT script too long');
 const ops:string[]=[];let t=raw;
 const step=(name:string,f:(s:string)=>string)=>{const n=f(t);if(n!==t)ops.push(name);t=n;};
 step('STRIP_BOM',s=>s.replace(/^﻿/,''));
 step('LINE_BREAKS',s=>s.replace(/\r\n?/g,'\n'));
 step('SPACES',s=>s.replace(/[\t  -​ ]/g,' ').replace(/ {2,}/g,' '));
 step('TRIM_LINES',s=>s.split('\n').map(l=>l.trim()).join('\n'));
 step('BLANK_LINES',s=>s.replace(/\n{3,}/g,'\n\n'));
 step('TRIM',s=>s.trim());
 if(!t)throw Error('SCRIPT_INPUT empty script');
 const words=t.split(/\s+/).filter(w=>/[\p{L}\p{N}]/u.test(w)).length;
 const body={sourceType:SCRIPT_SOURCE_TYPE,version:SCRIPT_MODE_VERSION,originalFingerprint:sha(raw),normalized:t,normalizations:ops,words};
 return{...body,fingerprint:jsonHash(body)};
}
/** Sentence segmentation with exact offsets (a decimal point or abbreviation dot is not a boundary). */
export function sentenceSpans(text:string):ScriptSpan[]{
 const out:ScriptSpan[]=[];let start=0;
 const push=(end:number)=>{let a=start,b=end;while(a<b&&/\s/.test(text[a]))a++;while(b>a&&/\s/.test(text[b-1]))b--;if(b>a)out.push({start:a,end:b,text:text.slice(a,b)});start=end;};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='\n'&&(text[i+1]==='\n'||!/[.!?:;,]/.test(text[i-1]??''))){push(i);continue;}
  if(!/[.!?…]/.test(c))continue;
  if(c==='.'&&/\d/.test(text[i-1]??'')&&/\d/.test(text[i+1]??''))continue;
  let j=i;while(/[.!?…"'”»)]/.test(text[j+1]??''))j++;
  if(j+1<text.length&&!/\s/.test(text[j+1]))continue;
  push(j+1);i=j;
 }
 push(text.length);return out;
}
