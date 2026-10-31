import type {Vec3} from '../engine3d/contracts';
import type {CameraState} from '../engine3d/directed';
import type {PersistentWorld,WorldEntity} from './contracts';
/** Phase29 camera space: where a camera may stand and what it cannot see through. Built from the scene's structural geometry
 * (room walls, floor, worktop, large opaque objects) — never from the topic. Used by the camera search and by QA. */
export interface CameraBlocker {id:string;kind:'WALL'|'FLOOR'|'FURNITURE'|'OBJECT';min:Vec3;max:Vec3}
export interface CameraSpace {safe:{min:Vec3;max:Vec3};blockers:CameraBlocker[]}
/** Readable size on a phone, by narrative scale: projected extent (max of width/height, fraction of the frame). Calibrated once,
 * shared by every topic. */
export const OCCUPANCY_THRESHOLDS={DETAIL:0.06,COMPONENT:0.1,REGION:0.16,OBJECT:0.22,WORLD:0.12} as const;
export type NarrativeScale=keyof typeof OCCUPANCY_THRESHOLDS;
export const scaleOf=(e:WorldEntity):NarrativeScale=>{const m=Math.max(...e.size);return e.kind==='PATH'?'REGION':m<0.3?'DETAIL':m<1.2?'COMPONENT':m<2.2?'OBJECT':'WORLD';};
// Containment parts are drawn see-through (translucent outer vessel, open/perforated drum, loose content).
const NON_BLOCKING=new Set(['ROTATING_CONTAINER','OUTER_CONTAINER','CONTENT_ITEMS','INTERIOR_ROOM','STATE_TINT','TRANSFER_PATH','STUDIO_BACKDROP','CLOUD_FIELD','WATER_SURFACE','ROAD_STRIP','STREAMLINES','PRESSURE_FIELD','FORCE_ARROW','STEAM_PLUME','FLAME','PIPE']);
export function cameraSpaceOf(world:PersistentWorld,finalPos:(e:WorldEntity)=>Vec3=e=>e.position):CameraSpace{
 const blockers:CameraBlocker[]=[{id:'floor',kind:'FLOOR',min:[-200,-5,-200],max:[200,-0.01,200]}];
 let safe:{min:Vec3;max:Vec3}={min:[-60,0.15,-60],max:[60,40,60]};
 const room=world.entities.find(e=>e.assembly==='INTERIOR_ROOM');
 if(room){const [W,H,D]=room.size.map(v=>v*4),[cx,,cz]=room.position,x0=cx-W/2,x1=cx+W/2,z0=cz-D/2,z1=cz+D/2;
  // Walls drawn by the room: back and left (the room is open toward the viewer and to the right).
  blockers.push({id:'wall_back',kind:'WALL',min:[x0-0.3,0,z0-0.3],max:[x1+0.3,H+2,z0+0.06]},{id:'wall_left',kind:'WALL',min:[x0-0.3,0,z0-0.3],max:[x0+0.06,H+2,z1+0.3]},
   {id:'worktop',kind:'FURNITURE',min:[x0+0.05,0,cz-D*0.4],max:[x0+0.65,0.9,cz+D*0.1]});
  safe={min:[x0+0.25,0.2,z0+0.25],max:[x1+6,H+3,z1+8]};}
 for(const e of world.entities){if(e.kind==='PATH'||NON_BLOCKING.has(e.assembly??'')||e.role==='CONTEXT_PROP'&&e.assembly!=='RAISED_GROUND'||Math.max(...e.size)<0.45)continue;
  const c=finalPos(e),h=e.size.map(v=>v/2);blockers.push({id:e.entityId,kind:'OBJECT',min:c.map((v,i)=>v-h[i]) as Vec3,max:c.map((v,i)=>v+h[i]) as Vec3});}
 return{safe,blockers};
}
/** Segment a→b crosses the box (slab test), ignoring the last few centimetres at the target. */
export function segmentHits(a:Vec3,b:Vec3,min:Vec3,max:Vec3){let t0=0,t1=1;for(let i=0;i<3;i++){const d=b[i]-a[i];if(Math.abs(d)<1e-9){if(a[i]<min[i]||a[i]>max[i])return false;continue;}let u=(min[i]-a[i])/d,v=(max[i]-a[i])/d;if(u>v)[u,v]=[v,u];t0=Math.max(t0,u);t1=Math.min(t1,v);if(t0>t1)return false;}return t1>0.001&&t0<0.97;}
export const insideBox=(p:Vec3,min:Vec3,max:Vec3)=>[0,1,2].every(i=>p[i]>=min[i]&&p[i]<=max[i]);
/** Blockers between the camera and a point; a box that contains the point (the target's own housing, an opened section) does not count. */
export function blockersOnSight(cam:Vec3,p:Vec3,space:CameraSpace,ignore:Set<string>=new Set(),open:Set<string>=new Set()){
 // An opened housing (front section removed) only hides what is behind its back face.
 return space.blockers.filter(k=>!ignore.has(k.id)&&!insideBox(p,k.min,k.max)&&(open.has(k.id)?p[2]<k.min[2]&&segmentHits(cam,p,[k.min[0],k.min[1],k.min[2]],[k.max[0],k.max[1],k.min[2]+0.06]):segmentHits(cam,p,k.min,k.max)));}
export function cameraCollision(cam:Vec3,space:CameraSpace){return!insideBox(cam,space.safe.min,space.safe.max)||space.blockers.some(k=>insideBox(cam,k.min,k.max));}
/** Deterministic candidate directions around the planner's preferred one (front-side, side, side-rear, rear-side, raised, lowered). */
export function candidateDirs(base:Vec3):{label:string;dir:Vec3}[]{
 const s=base[0]>=0?1:-1,out:{label:string;dir:Vec3}[]=[{label:'preferred',dir:base}];
 for(const [label,dir] of [['front-side',[s*0.45,0.3,1]],['side',[s*1,0.35,0.15]],['side-rear',[s*1,0.4,-0.5]],['rear-side',[s*0.55,0.4,-1]],['front-side-other',[-s*0.45,0.3,1]],['side-other',[-s*1,0.35,0.15]],['raised-front',[s*0.3,0.62,1]],['lowered-side',[s*1,0.12,0.3]]] as [string,Vec3][])out.push({label,dir});
 return out;
}
export interface PoseChoice {pose:CameraState;label:string;valid:boolean;reason:string;dir:Vec3;tight:boolean}
/** Pick the best valid pose: no collision, line of sight to every key point, then score visibility, occupancy and continuity. */
export function searchPose(fit:(dir:Vec3,tight?:boolean)=>CameraState,base:Vec3,keys:Vec3[],space:CameraSpace,ignore:Set<string>,extent:(c:CameraState)=>number,need:number,prev:CameraState|null,open:Set<string>=new Set()):PoseChoice{
 let best:{c:CameraState;label:string;score:number;dir:Vec3;tight:boolean}|null=null,safe:{c:CameraState;label:string;rank:number;dir:Vec3;tight:boolean}|null=null,firstReason='';
 // Each direction is tried at the fitted distance, then closer (a tighter frame) when the room is too small for the first.
 for(const {label:l0,dir} of candidateDirs(base))for(const tight of [false,true]){const c=fit(dir,tight),label=l0+(tight?'-closer':'');
  const collide=cameraCollision(c.position,space),blocked=keys.filter(p=>blockersOnSight(c.position,p,space,ignore,open).length).length,size=extent(c);
  const d=c.target.map((v,i)=>v-c.position[i]),pitch=Math.atan2(-d[1],Math.hypot(d[0],d[2]))*180/Math.PI,extreme=pitch>50||pitch<-35;
  if(label==='preferred')firstReason=collide?'camera inside/behind structure':blocked?'line of sight blocked':size<need?'target too small':extreme?'extreme angle':'';
  // A gap still needs a camera that stands in free space: remember the least bad one (clear sight first, then size).
  if(!collide&&!extreme){const rank=(blocked?0:2)+Math.min(1,size/need);if(!safe||rank>safe.rank)safe={c,label,rank,dir,tight};}
  if(collide||blocked||extreme||size<need)continue;
  const travel=prev?Math.hypot(...c.position.map((v,i)=>v-prev.position[i]) as [number,number,number]):0;
  const score=2*Math.min(1,size/need)-0.05*travel+(label==='preferred'?0.5:0);
  if(!best||score>best.score)best={c,label,score,dir,tight};}
 if(best)return{pose:best.c,label:best.label,valid:true,reason:best.label==='preferred'?'':firstReason,dir:best.dir,tight:best.tight};
 return{pose:safe?.c??fit(base),label:'CAMERA_GAP',valid:false,reason:(firstReason||'no candidate with clear sight and readable size')+(safe?'; using '+safe.label+' (free space)':''),dir:safe?.dir??base,tight:safe?.tight??false};
}
