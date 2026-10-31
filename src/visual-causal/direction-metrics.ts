import type {VisualCausalPlan} from './contracts';
import {demonstrationSummary} from './demonstrations';
import {demonstrationExecution} from './demonstration-execution';
/** Phase29 information density of a plan (pure). A meaningful visual change is a state change of a subject the viewer
 * reads: an operation other than HIGHLIGHT on a subject, its parts or an attached manifestation. Backdrops (unattached
 * context props: medium, studio) count only when a factual beat changes them (a shown result), never for stage swaps.
 * Camera moves and cuts are not counted, so cutting more cannot inflate the density. */
export function directionMetrics(plan:VisualCausalPlan){
 const fps=plan.fps,ent=new Map(plan.world.entities.map(e=>[e.entityId,e]));
 const counts=(o:{operation:string;target:string},factual=false)=>{const e=ent.get(o.target);if(o.operation==='HIGHLIGHT'||!e)return false;
  return e.role!=='CONTEXT_PROP'||Boolean(e.parentId)||(factual&&o.operation!=='REVEAL'&&o.operation!=='HIDE');};
 const times=plan.beats.flatMap(b=>b.operations.filter(o=>counts(o,b.grounding==='FACTUAL_DEMONSTRATION')).map(o=>b.startFrame+(b.endFrame-b.startFrame)*o.startOffset)).sort((a,b)=>a-b);
 const total=plan.totalFrames,marks=[0,...times,total];let longest=0;
 for(let i=1;i<marks.length;i++)longest=Math.max(longest,marks[i]-marks[i-1]);
 const factual=plan.beats.filter(b=>b.grounding==='FACTUAL_DEMONSTRATION');
 const acting=(b:typeof factual[number])=>b.operations.filter(o=>counts(o,true));
 // Label-only: the factual idea is carried by a highlight/label alone. Arrow-only: only force arrows change.
 const labelOnly=factual.filter(b=>!acting(b).length).length;
 const arrowOnly=factual.filter(b=>{const a=acting(b);return a.length>0&&a.every(o=>ent.get(o.target)?.assembly==='FORCE_ARROW');}).length;
 const demos=plan.demonstrations??[],sum=demonstrationSummary(demos);
 return{meaningfulVisualChanges:times.length,meaningfulChangesPer10s:+(times.length/(total/fps)*10).toFixed(2),longestNoMeaningfulChangeSeconds:+(longest/fps).toFixed(2),
  demonstrations:sum,progressiveSubjectStates:plan.direction?.subjectVersions??sum.subjectVersions,microStageSwitches:plan.direction?.stageSwitches??0,
  labelOnlyExplanations:labelOnly,arrowOnlyExplanations:arrowOnly,execution:demonstrationExecution(plan),presenterRoles:[...new Set(demos.map(d=>d.presenterRole).filter((r):r is NonNullable<typeof r>=>Boolean(r)))]};
}
