import type {Vec3} from '../engine3d/contracts';
import type {OverlayLabel,OverlayTrack,OverlayTransition,OverlayWord} from '../engine3d/overlay';
import {spokenText} from '../engine3d/director';
import {REWIND_CUE,FORWARD_CUE} from '../script-mode/lexicon';
import {isMechVerb} from '../script-mode/mechanism';
import type {VisualCausalPlan,WorldEntity} from './contracts';
/** Explainer overlay from the plan (deterministic): one-word captions timed inside each sentence, the words that name a
 * part introduced in that sentence highlighted, a label on each part when it first appears (a "term" label for the system
 * and for parts with a functional silhouette, a "pill" for the others) and rewind / fast-forward marks on time cues.
 * Labels only name what the script names (the entity's own words); nothing is added. */
const fold=(x:string)=>x.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
const sg=(x:string)=>fold(x).replace(/(?:oes|aes)$/,'ao').replace(/s$/,'');
const DET=/^(?:o|a|os|as|um|uma|uns|umas|esse|essa|esses|essas|este|esta|seu|sua|seus|suas|the|an?)$/i;
const STOP=/^(?:que|atras|dentro|embaixo|acima|perto|sobre|fora|entre|which|that|behind|inside)$/;
/** The part's name as the script says it: no article, no verb, no relative clause, at most three words. */
export function labelText(label:string):string|null{
 let w=label.trim().split(/\s+/);const pm=fold(label).match(/^(?:(?:o|a) )?parte (?:externa|interna|de fora|de dentro) d[oae]s? (.+)$/);if(pm)w=label.trim().split(/\s+/).slice(-pm[1].split(' ').length);
 while(w.length&&(DET.test(fold(w[0]))||w.length>1&&/^(?:pequen[oa]s?|grandes?|divers[oa]s?|vari[oa]s?)$/.test(fold(w[0]))))w=w.slice(1);
 const out:string[]=[];for(const x of w){const f=fold(x);if(!f||isMechVerb(f)||STOP.test(f)||out.length>=3)break;out.push(x.replace(/[,.;:!?]+$/,''));}
 while(out.length&&/^(?:de|do|da|dos|das|com|e|em|no|na)$/.test(fold(out.at(-1)!)))out.pop();
 return out.length?out.join(' '):null;
}
const LABELLED=(e:WorldEntity)=>e.role!=='CONTEXT_PROP'&&Boolean(e.label)&&!['STATE_TINT','TRANSFER_PATH','INTERIOR_ROOM','STUDIO_BACKDROP','CLOUD_FIELD','WATER_SURFACE','ROAD_STRIP'].includes(e.assembly??'')&&(e.kind!=='PATH'||e.assembly==='PIPE');
export function buildOverlay(plan:VisualCausalPlan,sentences:{id:string;text:string;startFrame:number;endFrame:number}[],fps:number):OverlayTrack{
 // A label word is written as the script writes it (accents and all).
 const spelled=new Map<string,string>();for(const s of sentences)for(const w of s.text.split(/\s+/)){const c=w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'');if(c&&!spelled.has(fold(c)))spelled.set(fold(c),c);}
 const ent=new Map(plan.world.entities.map(e=>[e.entityId,e])),labels:OverlayLabel[]=[],seen=new Set<string>(),keysBySentence=new Map<string,Set<string>>();
 // ---- labels: a part's first appearance (as a target or the focus of a beat) ----
 for(const b of plan.beats){const ids=[...new Set([b.focusEntityId,...b.operations.filter(o=>o.operation!=='HIDE').map(o=>o.target)].filter((x):x is string=>Boolean(x)))];
  for(const id of ids){const e=ent.get(id);if(!e||seen.has(id)||!LABELLED(e))continue;const raw=labelText(e.label!);if(!raw)continue;const text=raw.split(/\s+/).map(w=>spelled.get(fold(w))??w).join(' ');seen.add(id);
   const start=b.startFrame+Math.min(6,Math.floor((b.endFrame-b.startFrame)/4)),end=Math.min(plan.totalFrames,Math.max(start+Math.round(fps*1.2),Math.min(b.endFrame+Math.round(fps*0.8),start+Math.round(fps*2.6))));
   if(labels.filter(l=>l.startFrame<end&&start<l.endFrame).length>=2)continue;
   const top:Vec3=e.kind==='PATH'?e.path![Math.floor(e.path!.length/2)]:e.position;
   labels.push({id:'label_'+id,text:text.toUpperCase(),kind:e.role==='MAIN_SYSTEM'||e.form&&e.form!=='CONDUIT'?'TERM':'PILL',subjectId:e.kind==='PATH'?null:id,point:top,lift:e.kind==='PATH'?0.25:+(e.size[1]/2+0.25).toFixed(3),startFrame:start,endFrame:end,tone:b.hypothetical?'BAD':'NEUTRAL'});
   if(b.sentenceId){const k=keysBySentence.get(b.sentenceId)??new Set<string>();for(const w of text.split(/\s+/))if(fold(w).length>3)k.add(sg(w));keysBySentence.set(b.sentenceId,k);}}}
 // ---- words: spoken words timed by length inside each sentence window ----
 const words:OverlayWord[]=[];
 for(const s of sentences){const ws=spokenText(s.text).split(/\s+/).filter(Boolean),len=s.endFrame-s.startFrame;if(!ws.length||len<1)continue;
  // Too many words for the window: pair them (never a cue shorter than 3 frames).
  const groups:string[]=[];const per=len/ws.length<3?Math.ceil(3*ws.length/len):1;for(let i=0;i<ws.length;i+=per)groups.push(ws.slice(i,i+per).join(' '));
  const weight=groups.map(g=>g.length+3),total=weight.reduce((a,b)=>a+b,0),keys=keysBySentence.get(s.id)??new Set<string>();let acc=0;
  groups.forEach((g,i)=>{const a=s.startFrame+Math.round(len*acc/total);acc+=weight[i];const b=i===groups.length-1?s.endFrame:s.startFrame+Math.round(len*acc/total);if(b>a)words.push({text:g.replace(/[,;:]+$/,''),startFrame:a,endFrame:b,key:g.split(/\s+/).some(w=>keys.has(sg(w)))});});}
 // ---- time transitions on stated cues ----
 const transitions:OverlayTransition[]=sentences.flatMap(s=>{const f=fold(s.text),kind=REWIND_CUE.test(f)?'REWIND':FORWARD_CUE.test(f)?'FORWARD':null;return kind?[{kind,startFrame:s.startFrame,endFrame:Math.min(s.endFrame,s.startFrame+Math.round(fps*0.9))} as OverlayTransition]:[];});
 return{version:1,captionStyle:'WORD',words,labels,transitions};
}
