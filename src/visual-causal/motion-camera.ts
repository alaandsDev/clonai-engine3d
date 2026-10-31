import type {Vec3} from '../engine3d/contracts';
import type {CameraSegment,CameraState} from '../engine3d/directed';
import type {VisualCausalPlan,WorldEntity} from './contracts';
import {frameCamera} from './script-world';
/** Phase29 tracking camera for MOTION_STAGE: every beat is its own shot (a cut, as in fast curiosity edits) and inside
 * the shot the camera keeps moving around the body (orbit + slight push), so the moving body is always being followed.
 * A focus part (surface, propulsor) is framed close; other beats use the zone pose. Pure function of the plan. */
const r3=(v:Vec3):Vec3=>v.map(x=>+x.toFixed(3)) as Vec3;
function orbit(c:CameraState,deg:number,push:number):CameraState{
 const d=c.position.map((v,i)=>v-c.target[i]) as Vec3,a=deg*Math.PI/180,x=d[0]*Math.cos(a)-d[2]*Math.sin(a),z=d[0]*Math.sin(a)+d[2]*Math.cos(a),k=1-push;
 return{position:r3([c.target[0]+x*k,c.target[1]+d[1]*k,c.target[2]+z*k]),target:c.target};
}
export function motionCameras(plan:VisualCausalPlan){
 const w=plan.world,cams:CameraSegment[]=[],cuts:number[]=[];
 // Children are positioned relative to their parent (attached parts): frame them where they sit on the subject.
 const worldPos=(e:WorldEntity):Vec3=>{const p=e.parentId?w.entities.find(x=>x.entityId===e.parentId):null;return p?worldPos(p).map((v,i)=>v+e.position[i]) as Vec3:e.position;};
 const box=(e:WorldEntity):Vec3[]=>{const c=worldPos(e);return[[c[0]-e.size[0]/2,c[1]-e.size[1]/2,c[2]-e.size[2]/2],[c[0]+e.size[0]/2,c[1]+e.size[1]/2,c[2]+e.size[2]/2]];};
 const pose=(i:number):CameraState=>{const b=plan.beats[i],zone=w.cameraZones[b.cameraZone],f=b.focusEntityId?w.entities.find(e=>e.entityId===b.focusEntityId):null;
  let c=zone;
  // A focused part is framed close (one side of a symmetric part, so the shot gets near it).
  if(f&&b.cameraZone==='COMPONENT'&&f.role!=='MAIN_SYSTEM')c=frameCamera(box(f).map(p=>[p[0],p[1],Math.max(worldPos(f)[2],p[2])] as Vec3),[0.22,0.42,1],1.3,3.8);
  // Alternating variants rotate the angle so consecutive shots of the same zone differ.
  return b.cameraVariant?orbit(c,b.cameraVariant*35,0):orbit(c,(i%3-1)*12,0);};
 let current=pose(0);
 plan.beats.forEach((b,i)=>{
  const start=pose(i),len=b.endFrame-b.startFrame,full=orbit(start,i%2?14:-14,0.07);
  // Short shots of distant poses drift less, so the in-shot motion never reads as a jump (≈0.1 units/frame on average).
  const travel=Math.hypot(...full.position.map((v,j)=>v-start.position[j])),k=travel>0?Math.min(1,0.1*Math.max(1,len)/travel):1,drift=k<1?orbit(start,(i%2?14:-14)*k,0.07*k):full;
  if(i>0){cams.push({startFrame:b.startFrame-1,endFrame:b.startFrame,easing:'LINEAR',purpose:b.cameraZone+' (cut): '+b.cameraMotivation,cameraId:'CAM_STATIC_001',behavior:'MOVE',startState:current,endState:start});cuts.push(b.startFrame);}
  cams.push({startFrame:b.startFrame,endFrame:b.endFrame-(i<plan.beats.length-1?1:0),easing:'EASE_IN_OUT',purpose:b.cameraZone+': tracking the moving body ('+b.visualIntent.toLowerCase()+')',cameraId:'CAM_PAN_RIGHT_001',behavior:'MOVE',startState:start,endState:drift});
  current=drift;
 });
 return{cameras:cams,cuts,final:current,initial:pose(0)};
}
