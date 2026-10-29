import {jsonHash} from '../editorial/fingerprint';
import type {Vec3} from '../engine3d/contracts';
import {evaluateDirected,validateDirected,type DirectedSequence,type CameraState,type ActionSegment,type ActorBlocking,type CameraSegment,type FocusSegment} from '../engine3d/directed';
import {DEMONSTRATION_COMPILER_VERSION,defaultEnvironmentState,type DemonstrationProgram,type DemonstrationStep,type SubjectState} from '../engine3d/demonstration-contracts';
import {evaluateDemonstration} from '../engine3d/demonstration-runtime';
import {captions} from '../engine3d/director';
import type {CausalVisualBeat,VisualCausalPlan,WorldEntity} from './contracts';
import {screenBox,bounds} from './qa';
/** Compiles a VisualCausalPlan to the existing DirectedSequence contract (same renderer). */
const center=(e:WorldEntity):Vec3=>e.kind==='PATH'?e.path!.reduce((a,p)=>a.map((v,i)=>v+p[i]/e.path!.length) as Vec3,[0,0,0] as Vec3):e.position;
const dist=(a:Vec3,b:Vec3)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
function cameraId(from:CameraState,to:CameraState){const a=dist(from.position,from.target),b=dist(to.position,to.target);return b<a-0.6?'CAM_PUSH_IN_001':b>a+0.6?'CAM_PULL_OUT_001':to.position[0]>from.position[0]?'CAM_PAN_RIGHT_001':'CAM_PAN_LEFT_001';}
function subjectState(e:WorldEntity):SubjectState{
 const parameters:Record<string,number>=e.kind==='PATH'?{connection:e.role==='MAIN_SYSTEM'?1:0,flowProgress:0,direction:1,speed:1,amount:0.85,highlight:0}:e.kind==='CYLINDER'?{fillLevel:0,highlight:0}:{highlight:0};
 return{position:[...e.position] as Vec3,rotation:[...e.rotation] as Vec3,scale:[1,1,1],visible:e.initiallyVisible,stateId:'DEFAULT',parameters};
}
export interface CompileTiming {sentences:{id:string;text:string;startFrame:number;endFrame:number}[];width?:number;height?:number}
export function compileVisualPlan(plan:VisualCausalPlan,timing:CompileTiming):DirectedSequence{
 const w=plan.world,total=plan.totalFrames,fps=plan.fps,ent=(id:string)=>w.entities.find(e=>e.entityId===id)!;
 const span=(b:CausalVisualBeat,a:number,z:number)=>{const len=b.endFrame-b.startFrame,s=b.startFrame+Math.round(a*len),e=Math.max(s+1,Math.min(b.endFrame,b.startFrame+Math.round(z*len)));return[s,e] as const;};
 const steps:DemonstrationStep[]=[];
 for(const b of plan.beats)for(const o of b.operations){const [s,e]=span(b,o.startOffset,o.endOffset);
  steps.push({startFrame:s,endFrame:e,operation:o.operation,target:o.target,parameters:structuredClone(o.parameters),easing:o.operation==='FLOW'?'LINEAR':'EASE_IN_OUT',purpose:b.visualIntent+(b.relationIds.length?' ['+b.relationIds.join(',')+']':' [editorial]')});}
 const modes:DemonstrationProgram['presenterModes']=[];
 for(const b of plan.beats){const mode=b.presenterVisible?'HYBRID' as const:'DEMONSTRATION' as const,last=modes.at(-1);if(last&&last.mode===mode)last.endFrame=b.endFrame;else modes.push({startFrame:b.startFrame,endFrame:b.endFrame,mode});}
 const direct=plan.beats.find(b=>b.proof?.level==='DIRECT')??plan.beats.find(b=>b.grounding==='FACTUAL_DEMONSTRATION');
 const initialDemo={subjects:Object.fromEntries(w.entities.map(e=>[e.entityId,subjectState(e)])),environment:{...defaultEnvironmentState,visibility:true},presenterMode:modes[0].mode};
 const program:DemonstrationProgram={version:1,compilerVersion:DEMONSTRATION_COMPILER_VERSION,id:plan.worldId+'-demonstration',purpose:'Visual-causal plan compiled from grounded relations; staging is editorial',
  claim:{id:direct?.relationIds[0]??'NONE',text:timing.sentences.find(s=>s.id===direct?.sentenceId)?.text.slice(0,240)??plan.topic,type:'PROCESS',requiresVisualProof:true},
  subjects:w.entities.map(e=>({id:e.entityId,kind:e.kind,size:e.size,color:e.color,...(e.path?{path:e.path}:{}),...(e.layer?{layer:e.layer}:{}),...(e.assembly?{assembly:e.assembly}:{})})),initialState:initialDemo,steps:steps.sort((a,b)=>a.startFrame-b.startFrame||a.target.localeCompare(b.target,'en')),finalState:initialDemo,presenterModes:modes};
 program.finalState=evaluateDemonstration(program,total);
 // Camera: move to each new zone at the start of the beat; ACTION beats follow the moving medium.
 // A zone change is a smooth move when it fits the per-frame continuity limit inside the beat,
 // otherwise a motivated CUT at the beat start (the shot is marked CUT).
 // The zone pose is used when it keeps the beat's focus well framed; otherwise the camera keeps the
 // zone's viewing direction and reframes on the focus entity's own bounds (never leaves it off-frame).
 const beatCamera=(b:CausalVisualBeat):CameraState=>{
  const zone=w.cameraZones[b.cameraZone];if(!b.focusEntityId||b.cameraZone==='WORLD'||b.cameraZone==='CUTAWAY')return zone;
  const e=ent(b.focusEntityId);
  // A layer is an extended region (medium, stratum): the zone frames a portion of it by design.
  if(e.kind==='LAYER')return zone;
  const box=screenBox(bounds(e),zone,timing.width??480,timing.height??854);
  const cx=box?(box.x0+box.x1)/2:-1,cy=box?(box.y0+box.y1)/2:-1;
  if(box&&box.visibleFraction>=0.6&&cx>0.15&&cx<0.85&&cy>0.1&&cy<0.9)return zone;
  const c=center(e),sz=bounds(e).reduce((m,p)=>m.map((v,i)=>Math.max(v,Math.abs(p[i]-c[i]))) as Vec3,[0,0,0] as Vec3);
  const d=Math.max(3.2,1.45*Math.max(sz[1]/0.404,Math.max(sz[0],sz[2])/0.227)),dir=zone.position.map((v,i)=>v-zone.target[i]),n=Math.hypot(...dir)||1;
  return{position:c.map((v,i)=>+(v+dir[i]/n*d).toFixed(3)) as Vec3,target:c.map(v=>+v.toFixed(3)) as Vec3};
 };
 const cams:CameraSegment[]=[],cuts=new Set<number>();let current=beatCamera(plan.beats[0]);
 for(const b of plan.beats){
  const len=b.endFrame-b.startFrame,to=beatCamera(b);
  if(b!==plan.beats[0]&&jsonHash(to)!==jsonHash(current)){
   const need=Math.ceil(1.6*Math.max(dist(current.position,to.position),dist(current.target,to.target))/0.2),prevEnd=cams.at(-1)?.endFrame??0;
   // A presenter gesture leads a reveal: the camera starts once the arm is raised (gesture-motivated move).
   const lead=b.presenterIntent==='REVEAL_SYSTEM'?Math.min(12,Math.round(len*0.15)):b.presenterIntent==='POINT_TO_SYSTEM'&&b.presenterVisible?Math.min(6,Math.round(len*0.1)):0,room=Math.min(lead?60:40,Math.round(len*(lead?0.75:0.6)));
   if(need<=room)cams.push({startFrame:b.startFrame+lead,endFrame:b.startFrame+lead+Math.max(lead?Math.round(room*0.8):8,need),easing:'EASE_IN_OUT',purpose:b.cameraZone+': '+b.cameraMotivation,cameraId:cameraId(current,to),behavior:'MOVE',startState:current,endState:to});
   else if(b.startFrame-1>=prevEnd){cams.push({startFrame:b.startFrame-1,endFrame:b.startFrame,easing:'LINEAR',purpose:b.cameraZone+' (cut): '+b.cameraMotivation,cameraId:'CAM_STATIC_001',behavior:'MOVE',startState:current,endState:to});cuts.add(b.startFrame);}
   else continue;
   current=to;}
  const flow=b.operations.find(o=>o.operation==='FLOW'&&ent(o.target).path);
  if(b.cameraZone==='ACTION'&&flow){const p=ent(flow.target).path!,dy=p[p.length-1][1]-p[0][1],[s,e]=span(b,Math.max(0.3,flow.startOffset),Math.min(1,flow.endOffset+0.05));const start=cams.at(-1)?.endFrame??0;
   if(Math.abs(dy)>0.5&&s>=start){const next:CameraState={position:[current.position[0],current.position[1]+dy*0.35,current.position[2]],target:[current.target[0],current.target[1]+dy*0.55,current.target[2]]};cams.push({startFrame:s,endFrame:e,easing:'EASE_IN_OUT',purpose:'ACTION: follow the medium along the conduit',cameraId:'CAM_PAN_RIGHT_001',behavior:'MOVE',startState:current,endState:next});current=next;}}
  // Long holds on a focus get a slow push-in (attention, not new information).
  const free=Math.max(b.startFrame,cams.at(-1)?.endFrame??0)+2;
  if(['COMPONENT','SYSTEM'].includes(b.cameraZone)&&b.endFrame-2-free>=fps*2.5){const next:CameraState={position:current.position.map((v,i)=>+(v+(current.target[i]-v)*0.12).toFixed(3)) as Vec3,target:current.target};cams.push({startFrame:free,endFrame:b.endFrame-2,easing:'EASE_IN_OUT',purpose:b.cameraZone+': slow push holds attention on the focus',cameraId:'CAM_PUSH_IN_001',behavior:'MOVE',startState:current,endState:next});current=next;}
 }
 const p=w.presenter,home=p.home;
 const blocking:ActorBlocking[]=[];const actions:ActionSegment[]=[];
 // Presenter arc (editorial): enter → observe → point → gesture leads the reveal → out of focus during the
 // mechanism → return → react. Every look/point aims at a real world position (entity centre or camera).
 const first=plan.beats[0],walkEnd=first.startFrame+Math.max(12,Math.round((first.endFrame-first.startFrame)*0.7));
 const startPos:Vec3=[home[0]-0.9,0,home[2]+0.45],systemFocus=center(ent(plan.beats.find(b=>b.focusEntityId)?.focusEntityId??w.entities[0].entityId));
 blocking.push({startFrame:first.startFrame,endFrame:walkEnd,easing:'EASE_IN_OUT',purpose:'Presenter walks into the world toward the system',actorId:p.entityId,startPosition:startPos,endPosition:home,startFacing:1.3,endFacing:p.facing,movementType:'APPROACH',intent:'ENTER_SCENE',target:{type:'POSITION',position:systemFocus}});
 const act=(s:number,e:number,resourceId:string,intent:string,target?:Vec3)=>{const prev=actions.at(-1);if(e-s<8||(prev&&prev.endFrame>=s))return;actions.push({startFrame:s,endFrame:e,easing:'EASE_IN_OUT',purpose:intent+' (editorial; not visual proof)',resourceId,actorId:p.entityId,...(target?{targetPosition:target}:{}),fromProgress:0,toProgress:1});};
 if(first.presenterIntent==='ESTABLISH_CONTEXT')act(walkEnd-6,first.endFrame-2,'ACTION_LOOK_001','OBSERVE_SYSTEM',systemFocus);
 let facing=p.facing;
 for(const b of plan.beats.filter(b=>b.presenterVisible&&b.presenterIntent!=='ESTABLISH_CONTEXT'&&b.presenterIntent!=='NONE')){
  const focus=b.focusEntityId?center(ent(b.focusEntityId)):center(w.entities[0]),[s,e]=span(b,0.08,0.88);
  if(b.presenterIntent==='FINAL_PAYOFF'){
   // Return: look back at the whole system, turn toward the viewer, react with a wave.
   const consumer=w.entities.filter(x=>x.role==='CONTEXT_PROP'||x.role==='CONDUIT').at(-1),cam=w.cameraZones.WORLD.position,[ts,te]=span(b,0.4,0.62),toCam=Math.atan2(cam[0]-home[0],cam[2]-home[2]);
   act(s,span(b,0,0.4)[1],'ACTION_LOOK_001','FINAL_PAYOFF',consumer?center(consumer):systemFocus);
   const end=+(facing+(toCam-facing)*0.7).toFixed(4);blocking.push({startFrame:ts,endFrame:te,easing:'EASE_IN_OUT',purpose:'Presenter turns toward the viewer for the payoff',actorId:p.entityId,startPosition:home,endPosition:home,startFacing:facing,endFacing:end,movementType:'TURN',intent:'REACT',target:{type:'POSITION',position:cam}});facing=end;
   act(span(b,0.45,1)[0],span(b,0,0.97)[1],'ACTION_WAVE_001','REACT_TO_EVENT');continue;}
  // Indicate where the hidden part meets the visible world (a downward point at its exposed end reads as a gesture).
  if(b.presenterIntent==='REVEAL_SYSTEM'){const fe=b.focusEntityId?ent(b.focusEntityId):null,top=fe?.path?[...fe.path].sort((x,y)=>y[1]-x[1])[0]:focus;act(b.startFrame,span(b,0,0.7)[1],'ACTION_POINT_001','REVEAL_SYSTEM',top);continue;}
  if(b.presenterIntent==='OBSERVE_SYSTEM'){
   // Observe, then a short second point anticipates the next beat (keeps the presenter alive in long holds).
   const [m]=span(b,0.55,1);act(s,m-2,'ACTION_LOOK_001','OBSERVE_SYSTEM',focus);continue;}
  act(s,e,['POINT_TO_SYSTEM','POINT_TO_COMPONENT'].includes(b.presenterIntent)?'ACTION_POINT_001':'ACTION_LOOK_001',b.presenterIntent,focus);
 }
 const focus:FocusSegment[]=plan.beats.map(b=>({startFrame:b.startFrame,endFrame:b.endFrame,easing:'LINEAR',purpose:b.visualIntent,target:b.focusEntityId?{type:'POSITION',position:center(ent(b.focusEntityId))}:{type:'ACTOR',id:p.entityId,offset:[0,1.2,0]}}));
 const caps=timing.sentences.flatMap(s=>captions(s.text,s.startFrame,s.endFrame-s.startFrame));
 const seq:DirectedSequence={version:1,id:plan.worldId+'-sequence',fps,width:timing.width??480,height:timing.height??854,totalFrames:total,
  baseShot:{id:plan.worldId+'-world',durationSeconds:total/fps,environment:{resourceId:w.environmentId},characters:[{instanceId:p.entityId,resourceId:p.resourceId,position:startPos,parameters:{},rotation:[0,0,0],scale:[p.scale,p.scale,p.scale]}],props:[],actions:[],vfx:[],camera:{resourceId:'CAM_STATIC_001'}} as unknown as DirectedSequence['baseShot'],
  initialState:{actors:{[p.entityId]:{position:startPos,facing:1.3}},props:{},camera:beatCamera(plan.beats[0]),demonstration:program.initialState},finalState:{actors:{},props:{},camera:current},
  blocking,actionSegments:actions,cameraSegments:cams,focusSegments:focus,propMotions:[],
  shots:plan.beats.map(b=>({id:'shot_'+String(b.order+1).padStart(2,'0'),startFrame:b.startFrame,endFrame:b.endFrame,transition:(cuts.has(b.startFrame)?'CUT':'CONTINUE') as 'CUT'|'CONTINUE',...(b.label?{onScreenText:b.label}:{})})),captions:caps,demonstration:program};
 const end=evaluateDirected(seq,total).state;seq.finalState=end;
 return validateDirected(seq);
}
