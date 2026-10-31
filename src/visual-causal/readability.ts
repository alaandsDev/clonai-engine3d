import type {Vec3} from '../engine3d/contracts';
import {evaluateDirected,type DirectedSequence} from '../engine3d/directed';
import {evaluateDemonstration} from '../engine3d/demonstration-runtime';
import type {BeatOperation,VisualCausalPlan,WorldEntity} from './contracts';
import {bounds,screenBox,pointStatus,worldPosition} from './qa';
/** Phase29 causal readability and meaningful stasis, measured on the compiled sequence (evaluated camera + evaluated
 * demonstration state), never on the existence of geometry. */
const ENVIRONMENT=new Set(['INTERIOR_ROOM','STUDIO_BACKDROP','CLOUD_FIELD','WATER_SURFACE','ROAD_STRIP']);
/** Shapes that do not say what a part is (a plain block or slab); everything else is a recognisable silhouette. */
const GENERIC=new Set(['DISPLAY_BLOCK','PANEL']);
const headAt=(path:Vec3[],t:number):Vec3=>{const l=path.slice(1).map((q,i)=>Math.hypot(q[0]-path[i][0],q[1]-path[i][1],q[2]-path[i][2]));let r=l.reduce((a,b)=>a+b,0)*Math.min(1,Math.max(0,t));
 for(let i=0;i<l.length;i++){if(r<=l[i]){const k=l[i]?r/l[i]:0;return path[i].map((v,j)=>v+(path[i+1][j]-v)*k) as Vec3;}r-=l[i];}return path[path.length-1];};
export type ReadabilityCriterion='SUBJECT_IDENTIFIABLE'|'ACTION_VISIBLE'|'STATE_DIFFERENCE_VISIBLE'|'RESULT_VISIBLE'|'ROUTE_VISIBLE'|'PARENT_CONTEXT_AVAILABLE';
/** For each factual demonstration: can the viewer tell WHAT it is, WHAT happens, WHAT changed and the RESULT without the voice?
 * PASS needs every applicable criterion. */
export function causalReadability(plan:VisualCausalPlan,seq:DirectedSequence){
 const ent=new Map(plan.world.entities.map(e=>[e.entityId,e])),enc=plan.spatialMap?ent.get(plan.spatialMap.object):plan.world.entities.find(e=>e.assembly==='ENCLOSURE');
 const prog=seq.demonstration,T=plan.totalFrames,clampF=(f:number)=>Math.max(0,Math.min(T-1,Math.round(f)));
 const ds=(f:number)=>prog?evaluateDemonstration(prog,clampF(f)):null;
 const rows:{beatId:string;sentenceId:string|null;intent:string;criteria:Partial<Record<ReadabilityCriterion,boolean>>;pass:boolean;missing:ReadabilityCriterion[];detail:{beforeShown:boolean;afterHoldFrames:number;magnitude:number}}[]=[];
 const narrationDependent:{beatId:string;sentenceId:string|null;intent:string;reason:string}[]=[];
 for(const b of plan.beats.filter(b=>b.grounding==='FACTUAL_DEMONSTRATION')){
  const acts=b.operations.filter(o=>!['HIGHLIGHT','REVEAL','HIDE'].includes(o.operation)&&!o.observed);
  if(!acts.length){narrationDependent.push({beatId:b.id,sentenceId:b.sentenceId,intent:b.visualIntent,reason:'Only a highlight or a sustained state: the relation is carried by the narration'});continue;}
  const op:BeatOperation=acts.at(-1)!,t=ent.get(op.target);if(!t)continue;
  const len=b.endFrame-b.startFrame,f0=b.startFrame+op.startOffset*len,f1=b.startFrame+op.endOffset*len,fm=(f0+f1)/2,targets=[...new Set(acts.map(o=>ent.get(o.target)).filter((e):e is WorldEntity=>Boolean(e)))];
  const own=(e:WorldEntity,f:number):Vec3=>(ds(f)?.subjects[e.entityId]?.position as Vec3|undefined)??e.position;
 const pos=(e:WorldEntity,f:number):Vec3=>worldPosition(plan,ds(f),e);void own;
  const flow=op.operation==='FLOW'&&t.kind==='PATH',vis=(p:Vec3,f:number)=>pointStatus(plan,seq,clampF(f),p,targets)==='VISIBLE';
  const subj=(f:number,k:number):Vec3=>flow?headAt(t.path!,k):pos(t,f),result=(f:number):Vec3=>flow?t.path!.at(-1)!:pos(t,f);
  // WHAT: the place the beat is about (focus) must have a recognisable silhouette; a carrier is read through that place.
  // A state volume is read through the part it covers (the coil inside, the valve it surrounds).
  const f0cus=ent.get(b.focusEntityId??'')??t,covered=f0cus.assembly==='STATE_TINT'?plan.world.entities.find(e=>e.form&&e!==f0cus&&[0,1,2].every(i=>Math.abs((e.kind==='PATH'?e.path![Math.floor(e.path!.length/2)]:e.position)[i]-f0cus.position[i])<=f0cus.size[i]/2+0.05)):undefined,what=covered??f0cus,identity=Boolean(what.form)||what===enc||what.assembly==='ENCLOSURE'||!GENERIC.has(what.assembly??'DISPLAY_BLOCK')&&what.kind!=='PATH'&&what.assembly!=='STATE_TINT'&&what.assembly!=='TRANSFER_PATH';
  const c:Partial<Record<ReadabilityCriterion,boolean>>={};
  c.SUBJECT_IDENTIFIABLE=identity&&(vis(pos(what,fm),fm)||vis(subj(fm,0.5),fm));
  const from=Number(op.parameters.from??0),to=Number(op.parameters.to??1),mag=flow?1:op.operation==='MOVE'?Math.hypot(...(op.parameters.to as number[]).map((v,i)=>v-(op.parameters.from as number[])[i]) as [number,number,number]):Math.abs(to-from);
  c.ACTION_VISIBLE=mag>=0.3&&vis(subj(fm,0.5),fm);
  // WHAT CHANGED: the before state is on screen before the action, the after state stays on screen after it.
  // Before: the place of the change is on screen for 0.2 s before the change starts (possibly at the end of the previous beat).
  // (for a part moving into place, the place is where it arrives: empty before, occupied after).
  const place:Vec3=flow?t.path![0]:op.operation==='MOVE'?op.parameters.to as Vec3:pos(t,f0),before=[6,3].every(d=>vis(place,f0-d))?6:0;
  let after=0;for(let f=Math.ceil(f1);f<Math.min(T,f1+30);f++){if(ds(f)?.subjects[t.entityId]?.visible===false)break;after++;}
  c.STATE_DIFFERENCE_VISIBLE=mag>=0.3&&before>=(flow?3:6)&&after>=9&&vis(result(f1),Math.min(T-1,f1+4));
  c.RESULT_VISIBLE=vis(result(f1),f1-1);
  if(flow){let seen=0;for(let k=0;k<=4;k++){const f=f0+(f1-f0)*k/4;if(vis(headAt(t.path!,k/4),f))seen++;}c.ROUTE_VISIBLE=seen>=4;}
  if(enc){let ok=false;for(let f=fm;f>=Math.max(0,fm-90)&&!ok;f-=15){const cam=evaluateDirected(seq,clampF(f)).state.camera,eb=screenBox(bounds({...enc,position:pos(enc,f)}),cam,seq.width,seq.height);ok=(eb?.extent??0)>=0.15&&(eb?.visibleFraction??0)>=0.25;}c.PARENT_CONTEXT_AVAILABLE=ok;}
  const missing=(Object.entries(c) as [ReadabilityCriterion,boolean][]).filter(([,v])=>!v).map(([k])=>k);
  rows.push({beatId:b.id,sentenceId:b.sentenceId,intent:b.visualIntent,criteria:c,pass:!missing.length,missing,detail:{beforeShown:before>0,afterHoldFrames:after,magnitude:+mag.toFixed(2)}});}
 const rate=(k:ReadabilityCriterion)=>{const r=rows.filter(x=>k in x.criteria);return r.length?+(r.filter(x=>x.criteria[k]).length/r.length).toFixed(3):null;};
 return{checked:rows.length,passed:rows.filter(r=>r.pass).length,causalReadabilityRate:rows.length?+(rows.filter(r=>r.pass).length/rows.length).toFixed(3):null,
  criteria:Object.fromEntries((['SUBJECT_IDENTIFIABLE','ACTION_VISIBLE','STATE_DIFFERENCE_VISIBLE','RESULT_VISIBLE','ROUTE_VISIBLE','PARENT_CONTEXT_AVAILABLE'] as ReadabilityCriterion[]).map(k=>[k,rate(k)])),
  fails:rows.filter(r=>!r.pass).map(r=>({beatId:r.beatId,sentenceId:r.sentenceId,intent:r.intent,missing:r.missing,detail:r.detail})),narrationDependent};
}
/** MEANINGFUL_VISUAL_STASIS: time with no PHYSICAL change in the demonstration state (a parameter, position, rotation or the
 * visibility of a non-environment subject). Camera drift, captions, highlights, particle noise and idle animation are not
 * state changes, so they never count as progress. A frame is "changing" when the state 0.2 s before and after differ. */
export function meaningfulStasis(plan:VisualCausalPlan,seq:DirectedSequence,threshold=1.5){
 const prog=seq.demonstration,fps=plan.fps,T=plan.totalFrames;if(!prog)return null;
 const subs=prog.subjects.filter(s=>!ENVIRONMENT.has(s.assembly??'')),step=3,half=6;
 const snap=(f:number)=>evaluateDemonstration(prog,Math.max(0,Math.min(T-1,f)));
 const differs=(f:number)=>{const a=snap(f-half),z=snap(f+half);return subs.some(s=>{const p=a.subjects[s.id],q=z.subjects[s.id];if(!p||!q)return false;if(p.visible!==q.visible)return true;if(!p.visible)return false;
  if(Math.hypot(...p.position.map((v,i)=>v-q.position[i]) as [number,number,number])>=0.03||Math.hypot(...p.rotation.map((v,i)=>v-q.rotation[i]) as [number,number,number])>=0.03)return true;
  return Object.keys(p.parameters).some(k=>k!=='highlight'&&Math.abs((p.parameters[k]??0)-(q.parameters[k]??0))>=0.03);});};
 const frames:number[]=[];for(let f=0;f<T;f+=step)frames.push(f);
 const changing=frames.map(differs);
 const runs:{start:number;end:number;still:boolean}[]=[];frames.forEach((f,i)=>{const r=runs.at(-1);if(r&&r.still===!changing[i])r.end=f+step;else runs.push({start:f,end:f+step,still:!changing[i]});});
 const still=runs.filter(r=>r.still).map(r=>({start:r.start,end:Math.min(T,r.end),seconds:+((Math.min(T,r.end)-r.start)/fps).toFixed(2)}));
 // Change events: changing runs, merged when the pause between them is shorter than 0.3 s.
 let events=0,lastEnd=-1e9;for(const r of runs.filter(r=>!r.still)){if(r.start-lastEnd>0.3*fps)events++;lastEnd=r.end;}
 const beatAt=(f:number)=>plan.beats.find(b=>f>=b.startFrame&&f<b.endFrame);
 return{longestMeaningfulStasis:still.length?Math.max(...still.map(s=>s.seconds)):0,meaningfulChangesPer10s:+(events/(T/fps)*10).toFixed(2),changeEvents:events,
  stasisOver:still.filter(s=>s.seconds>threshold).map(s=>({...s,from:+(s.start/fps).toFixed(2),to:+(s.end/fps).toFixed(2),sentences:[...new Set(plan.beats.filter(b=>b.endFrame>s.start&&b.startFrame<s.end).map(b=>b.sentenceId))],intent:beatAt(s.start)?.visualIntent??null}))};
}
