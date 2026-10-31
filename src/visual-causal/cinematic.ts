import {Vector3} from 'three';
import type {Vec3} from '../engine3d/contracts';
import type {CameraState,CameraSegment} from '../engine3d/directed';
import type {DemonstrationProgram} from '../engine3d/demonstration-contracts';
import {evaluateDemonstration} from '../engine3d/demonstration-runtime';
import {rig} from '../engine3d/motion';
import type {VisualCausalPlan,CausalVisualBeat,WorldEntity} from './contracts';
import {bounds,screenBox} from './qa';
import {searchPose,insideBox,cameraCollision,blockersOnSight,type PoseChoice} from './camera-space';
const distance=(a:Vec3,b:Vec3)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const add=(a:Vec3,b:Vec3)=>a.map((v,i)=>v+b[i]) as Vec3;
/** Fit in camera coordinates, preserving caption space and an explicit focus region. */
export function fitFocus(points:Vec3[],direction:Vec3,minDistance:number,margin=1.3):CameraState{
 const lo=[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),hi=[0,1,2].map(i=>Math.max(...points.map(p=>p[i]))),center=lo.map((v,i)=>(v+hi[i])/2) as Vec3;
 const dir=new Vector3(...direction).normalize(),right=new Vector3(0,1,0).cross(dir).normalize(),up=dir.clone().cross(right).normalize();let d=minDistance;
 for(const p of points){const v=new Vector3(...p).sub(new Vector3(...center));d=Math.max(d,margin*Math.abs(v.dot(right))/(Math.tan(22*Math.PI/180)*9/16)+v.dot(dir),margin*Math.abs(v.dot(up))/Math.tan(22*Math.PI/180)+v.dot(dir));}
 const target=add(center,[0,-Math.min(.15,d*.025),0]);return{position:add(target,dir.multiplyScalar(d).toArray() as Vec3),target};
}
export function cinematicCameras(plan:VisualCausalPlan,program:DemonstrationProgram){
 const w=plan.world,fps=plan.fps,cameras:CameraSegment[]=[],cuts=new Set<number>();
 const pose=(e:WorldEntity,f:number):WorldEntity=>{const s=evaluateDemonstration(program,f).subjects[e.entityId];return{...e,position:s.position,rotation:s.rotation,initiallyVisible:s.visible};};
 const wideMotion=new Set(plan.beats.filter(b=>{const e=w.entities.find(e=>e.entityId===b.focusEntityId);if(!e||!b.operations.some(o=>o.operation==='MOVE'))return false;let prev=pose(e,b.startFrame).position;for(let f=b.startFrame+1;f<b.endFrame;f++){const next=pose(e,f).position;if(distance(prev,next)>.2)return true;prev=next;}return false;}).map(b=>b.id));
 const region=(b:CausalVisualBeat)=>{let e=w.entities.find(e=>e.entityId===b.focusEntityId);while(e?.parentId)e=w.entities.find(p=>p.entityId===e!.parentId);return e?.entityId??'WORLD';};
 const choices=new Map<string,PoseChoice>(),follow=new Map<string,{end:CameraState;full:boolean;fromCurrent?:boolean}>();
 const camera=(b:CausalVisualBeat,f:number):CameraState=>{
  // The planner's causal framing (source + route + destination + parent housing) is honoured as is.
  if(b.framing&&!b.presenterVisible){const fr=b.framing,fit=(d:Vec3,tight?:boolean)=>fitFocus(fr.points as Vec3[],d,2.2,(Math.abs(d[0])>0.6||d[1]>0.8?1.5:1.25)*(tight?0.68:1));
   const space=plan.cameraSpace;if(!space)return fit(fr.dir as Vec3);
   // Camera search: the preferred pose is kept only if it stands in free space, sees every key point and makes the target readable.
   const keys=(fr.keys as Vec3[]|undefined)??(fr.points as Vec3[]).slice(0,fr.keyCount??fr.points.length),targets=new Set(b.operations.map(o=>o.target));
   // Only the targets' own boxes are ignored; a housing that contains one key point is ignored for that point only (blockersOnSight).
   const ignore=new Set([...targets]);void insideBox;
   const sizePts=(fr.points as Vec3[]).slice(0,fr.keyCount??fr.points.length),extent=(c:CameraState)=>{const bx=screenBox(sizePts,c,480,854);return bx?.extent??0;};
   const st=evaluateDemonstration(program,f),open=new Set(plan.world.entities.filter(e=>e.assembly==='ENCLOSURE'&&Number(st.subjects[e.entityId]?.parameters.activity??0)>=0.5).map(e=>e.entityId));
   const choice=searchPose(fit,fr.dir as Vec3,keys,space,ignore,extent,fr.need??0.1,null,open);choices.set(b.id,choice);
   // A pose may be used only if it stands in free space, at a level-ish angle, with clear sight to its own key points.
   const ok=(c:CameraState,ks:Vec3[])=>{const d=c.target.map((v,i)=>v-c.position[i]),pitch=Math.atan2(-d[1],Math.hypot(d[0],d[2]))*180/Math.PI;return!cameraCollision(c.position,space)&&pitch<=50&&pitch>=-35&&ks.every(p=>!blockersOnSight(c.position,p,space,ignore,open).length);};
   const pick=(pts:Vec3[],d:Vec3,ks:Vec3[])=>[false,true].map(t=>fitFocus(pts,d,2.2,(Math.abs(d[0])>0.6||d[1]>0.8?1.5:1.25)*(t?0.68:1))).find(c=>ok(c,ks));
   // SOURCE → PATH → DESTINATION: open on the source half, follow to the destination half (the move must stay in free space).
   if(fr.track&&!fr.track.from.length){const z=pick(fr.track.to as Vec3[],(fr.track.toDir as Vec3|undefined)??choice.dir,keys.slice(-1));if(z){follow.set(b.id,{end:z,full:true,fromCurrent:true});return choice.pose;}}
   if(fr.track&&fr.track.from.length){const a=pick(fr.track.from as Vec3[],(fr.track.fromDir as Vec3|undefined)??choice.dir,keys.slice(0,1)),z=pick(fr.track.to as Vec3[],(fr.track.toDir as Vec3|undefined)??choice.dir,keys.slice(-1));
    const mid=a&&z?{position:a.position.map((v,i)=>(v+z.position[i])/2) as Vec3,target:a.target}:null;
    if(a&&z&&mid&&!cameraCollision(mid.position,space)){follow.set(b.id,{end:z,full:true});return a;}}
   // OBJECT → REGION → COMPONENT: the first appearance opens on the whole object, then pushes in to the part.
   if(fr.reveal){const z=pick(fr.reveal as Vec3[],choice.dir,keys);if(z)follow.set(b.id,{end:z,full:false});}
   return choice.pose;}
  const e0=w.entities.find(e=>e.entityId===b.focusEntityId),e=e0?pose(e0,f):undefined;
  if(b.presenterVisible){const main=w.entities.find(x=>x.assembly==='VESSEL')??w.entities.find(x=>x.role==='MAIN_SYSTEM')??w.entities[0],p=w.presenter,points=[...bounds(pose(main,f)),add(p.home,[-.6*p.scale,0,0]),add(p.home,[.6*p.scale,(rig.head[1]+.57)*p.scale,0])];return fitFocus(points,[.2,.27,1],3.6,1.17);}
  if(!e)return fitFocus(w.entities.filter(x=>x.initiallyVisible&&!x.parentId&&x.assembly!=='RAISED_GROUND'&&x.assembly!=='INTERIOR_ROOM').flatMap(x=>bounds(pose(x,f))),[.35,.3,1],3,1.2);
  const small=Math.max(...e.size)<.65,gas=e.assembly==='STEAM_PLUME';
  let points=bounds(e),direction:Vec3=gas?[.15,.12,1]:b.shotType==='CUTAWAY'?[.3,.42,1]:e.assembly==='FLAME'?[.55,.12,1]:[.3,.24,1];
  if(small){const base=add(e.position,[0,-e.size[1]*.65,0]);points.push(add(base,[-.35,-.12,-.22]),add(base,[.35,.12,.22]));}
  if(e.assembly==='VESSEL'){const shell=w.entities.filter(x=>!x.parentId&&x.assembly==='FLAME');points.push(...shell.flatMap(x=>bounds(pose(x,f))));}
  // A sectioned closure moves as one assembly; its attached controls remain in frame.
  if(e.assembly==='LID')points.push(...w.entities.filter(x=>x.parentId===e.entityId).flatMap(x=>bounds(pose(x,f))));
  if(gas&&e.parentId){const emitter=w.entities.find(x=>x.entityId===e.parentId);if(emitter)points.push(...bounds(pose(emitter,f)));}
  if(wideMotion.has(b.id)&&e0)for(let at=b.startFrame;at<=b.endFrame;at+=2)points.push(...bounds(pose(e0,at)));
  const framed=fitFocus(points,direction,small?1.35:gas?2.5:2.2,small?1.18:gas?1.55:1.2);
  // A tall effect and its emitter share the usable area above lower-third captions.
  // Optical framing only: no change to the effect's physical origin or timing.
  return gas?{position:add(framed.position,[0,-.22,0]),target:add(framed.target,[0,-.22,0])}:framed;
 };
 const initial=camera(plan.beats[0],0);let current=initial;
 for(let i=0;i<plan.beats.length;i++){
  const b=plan.beats[i],previous=plan.beats[i-1],len=b.endFrame-b.startFrame,end=Math.max(b.startFrame+1,b.endFrame-2),desired0=camera(b,b.startFrame),desired=follow.get(b.id)?.fromCurrent?current:desired0,dist=Math.max(distance(current.position,desired.position),distance(current.target,desired.target));
  const same=!b.framing&&previous?.focusEntityId===b.focusEntityId&&previous?.shotType===b.shotType,need=Math.max(8,Math.ceil(dist*1.6/.18));let cursor=b.startFrame;
  if(dist>.05&&!same){const room=Math.max(8,Math.min(Math.round(fps*.95),Math.floor(len*.55))),newRegion=previous&&region(previous)!==region(b);
   // A follow needs its whole beat: a long opening move becomes a cut to the source view (same object, same side).
   if(i>0&&(need>room&&(newRegion||need>=len-3)||follow.get(b.id)?.full&&!follow.get(b.id)?.fromCurrent&&dist>1.5)){
    const at=b.startFrame-1;cameras.push({startFrame:at,endFrame:at+1,easing:'LINEAR',purpose:b.shotType+' (cut): '+b.cameraMotivation,cameraId:'CAM_STATIC_001',behavior:'MOVE',startState:current,endState:desired});cuts.add(b.startFrame);current=desired;
   }else{const n=Math.min(end-cursor,Math.max(room,Math.min(need,Math.floor(len*.75))));if(n>0){const to=camera(b,cursor+n);cameras.push({startFrame:cursor,endFrame:cursor+n,easing:'EASE_IN_OUT',purpose:b.shotType+': motivated push/reframe; '+b.cameraMotivation,cameraId:'CAM_STATIC_001',behavior:'MOVE',startState:current,endState:to});current=to;cursor+=n;}}
  }
  if(end-cursor<3)continue;
  const fol=follow.get(b.id);
  if(fol&&!b.presenterVisible){const n=fol.full?end-cursor:Math.max(3,Math.min(end-cursor,Math.round(len*0.45)));
   // The move goes AROUND the subject (short arc segments about the midpoint of the two targets), never through it: every
   // waypoint must stand in free space with clearance from solid objects; otherwise the shot cuts to the end pose.
   const c0=current.target.map((v,i)=>(v+fol.end.target[i])/2) as Vec3,polar=(p:Vec3)=>{const d=p.map((v,i)=>v-c0[i]),r=Math.hypot(d[0],d[1],d[2]);return{r,az:Math.atan2(d[0],d[2]),el:Math.asin(d[1]/Math.max(1e-6,r))};};
   const A=polar(current.position),Z=polar(fol.end.position);let daz=Z.az-A.az;if(daz>Math.PI)daz-=2*Math.PI;if(daz<-Math.PI)daz+=2*Math.PI;
   const steps=Math.abs(daz)>0.5?4:1,way=(t:number):CameraState=>{if(steps===1)return{position:current.position.map((v,i)=>v+(fol.end.position[i]-v)*t) as Vec3,target:current.target.map((v,i)=>v+(fol.end.target[i]-v)*t) as Vec3};
    const r=A.r+(Z.r-A.r)*t,az=A.az+daz*t,el=A.el+(Z.el-A.el)*t;return{position:[c0[0]+r*Math.cos(el)*Math.sin(az),c0[1]+r*Math.sin(el),c0[2]+r*Math.cos(el)*Math.cos(az)],target:current.target.map((v,i)=>v+(fol.end.target[i]-v)*t) as Vec3};};
   const space=plan.cameraSpace,clear=(c:CameraState)=>!space||!cameraCollision(c.position,space)&&!space.blockers.some(k=>k.kind==='OBJECT'&&[0,1,2].every(j=>c.position[j]>=k.min[j]-0.8&&c.position[j]<=k.max[j]+0.8));
   const pts=Array.from({length:steps*4+1},(_,j)=>way(j/(steps*4))),arc=pts.slice(1).reduce((a,c,j)=>a+Math.max(distance(c.position,pts[j].position),distance(c.target,pts[j].target)),0);
   if(!pts.every(clear)){cameras.push({startFrame:cursor,endFrame:cursor+1,easing:'LINEAR',purpose:b.shotType+' (cut): the follow would cross the subject',cameraId:'CAM_STATIC_001',behavior:'MOVE',startState:current,endState:fol.end});cuts.add(cursor+1);current=fol.end;cursor+=1;}
   else{// Continuity: ≤ 0.2 per frame (an eased single move peaks near twice its mean speed; arc pieces are linear); a move that
    // cannot fit goes only part of the way along the same arc.
    const k=Math.min(1,n*.2/Math.max(1e-6,arc*(steps===1?2:1.15))),seg=Math.max(1,Math.floor(n/steps));
    for(let s=0;s<steps;s++){const a0=cursor+s*seg,a1=s===steps-1?cursor+n:a0+seg,to=way(k*(s+1)/steps);
     cameras.push({startFrame:a0,endFrame:a1,easing:steps===1?'EASE_IN_OUT':'LINEAR',purpose:b.shotType+(fol.full?': track the route from source to destination (around the subject)':': reveal — from the whole object to the part'),cameraId:'CAM_STATIC_001',behavior:'MOVE',startState:current,endState:to});current=to;}
    cursor+=n;}
   if(end-cursor<3)continue;}
  const moving=!wideMotion.has(b.id)&&b.operations.some(o=>o.operation==='MOVE'&&!o.observed),focus=b.focusEntityId;
  let to=current;
  if(moving&&focus){const e=w.entities.find(e=>e.entityId===focus)!,start=pose(e,cursor).position,finish=pose(e,end).position,delta=finish.map((v,j)=>v-start[j]) as Vec3;to={position:add(current.position,delta),target:add(current.target,delta)};}
  else if(!b.presenterVisible){const ratio=1-(Math.min(1,(end-cursor)/fps/5)*.045);to={position:current.position.map((v,j)=>current.target[j]+(v-current.target[j])*ratio) as Vec3,target:current.target};}
  if(moving&&focus||distance(current.position,to.position)>.005){cameras.push({startFrame:cursor,endFrame:end,easing:moving?'LINEAR':'EASE_IN_OUT',purpose:b.shotType+(choices.get(b.id)&&choices.get(b.id)!.label!=='preferred'?' [camera:'+choices.get(b.id)!.label+(choices.get(b.id)!.reason?' — '+choices.get(b.id)!.reason:'')+']':'')+': '+(moving?'follow attached subject action':'hold focus with a restrained push'),cameraId:'CAM_STATIC_001',behavior:moving?'FOLLOW':'MOVE',...(moving&&focus?{focusTarget:{type:'PROP' as const,id:focus,offset:[0,0,0] as Vec3}}:{}),startState:current,endState:to});current=to;}
 }
 return{initial,cameras,cuts,final:current};
}
