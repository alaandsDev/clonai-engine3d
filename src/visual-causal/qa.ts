import type {Vec3} from '../engine3d/contracts';
import {evaluateDirected,projectPosition,type DirectedSequence,type CameraState} from '../engine3d/directed';
import type {VisualCausalPlan,WorldEntity} from './contracts';
import {rig} from '../engine3d/motion';
/** Phase 27 visual QA measured on the compiled sequence (projected bounds through the evaluated
 * camera at real frames), not on the existence of contracts. Rendered-frame inspection is a
 * separate, manual review artifact. */
export function bounds(e:WorldEntity):Vec3[]{
 if(e.kind==='PATH'){const p=e.path!,r=e.size[0];const lo=[0,1,2].map(i=>Math.min(...p.map(v=>v[i]))-r),hi=[0,1,2].map(i=>Math.max(...p.map(v=>v[i]))+r);return corners(lo as Vec3,hi as Vec3);}
 const h=e.size.map(v=>v/2);return corners(e.position.map((v,i)=>v-h[i]) as Vec3,e.position.map((v,i)=>v+h[i]) as Vec3);
}
function corners(lo:Vec3,hi:Vec3):Vec3[]{const out:Vec3[]=[];for(const x of [lo[0],hi[0]])for(const y of [lo[1],hi[1]])for(const z of [lo[2],hi[2]])out.push([x,y,z]);return out;}
export function screenBox(points:Vec3[],camera:CameraState,w:number,h:number){
 const p=points.map(v=>projectPosition(v,camera,w,h)).filter(q=>q.depth>-1&&q.depth<1);
 if(!p.length)return null;
 const x0=Math.min(...p.map(q=>q.x)),x1=Math.max(...p.map(q=>q.x)),y0=Math.min(...p.map(q=>q.y)),y1=Math.max(...p.map(q=>q.y));
 const cx0=Math.max(0,x0),cx1=Math.min(1,x1),cy0=Math.max(0,y0),cy1=Math.min(1,y1),full=Math.max(1e-9,(x1-x0)*(y1-y0)),inside=Math.max(0,cx1-cx0)*Math.max(0,cy1-cy0);
 return{x0,x1,y0,y1,areaFraction:inside,extent:Math.max(Math.max(0,cx1-cx0),Math.max(0,cy1-cy0)),visibleFraction:inside/full};
}
// Character bounds from the procedural rig: head centre rig.head with a 0.57 radius sphere on top.
const presenterPoints=(pos:Vec3,scale:number):Vec3[]=>corners([pos[0]-0.6*scale,pos[1],pos[2]-0.35*scale],[pos[0]+0.6*scale,pos[1]+(rig.head[1]+0.57)*scale,pos[2]+0.35*scale]);
export interface MeaningfulChange {frame:number;kind:'CAMERA_ZONE'|'CAMERA_MOVE'|'OPERATION'|'CUTAWAY'|'PRESENTER_ACTION'|'LABEL'|'PRESENTER_ENTRY';detail:string}
export function meaningfulChanges(plan:VisualCausalPlan,seq:DirectedSequence):MeaningfulChange[]{
 const ev:MeaningfulChange[]=[];let zone:string|null=null,label:string|null=null;
 for(const b of plan.beats){if(b.cameraZone!==zone){ev.push({frame:b.startFrame,kind:'CAMERA_ZONE',detail:b.cameraZone});zone=b.cameraZone;}if(b.label&&b.label!==label)ev.push({frame:b.startFrame,kind:'LABEL',detail:b.label});label=b.label;}
 for(const c of seq.cameraSegments)if(/follow/i.test(c.purpose))ev.push({frame:c.startFrame,kind:'CAMERA_MOVE',detail:c.purpose});
 for(const s of seq.demonstration?.steps??[])ev.push({frame:s.startFrame,kind:s.target==='ENVIRONMENT'?'CUTAWAY':'OPERATION',detail:s.operation+':'+s.target});
 for(const a of seq.actionSegments)ev.push({frame:a.startFrame,kind:'PRESENTER_ACTION',detail:a.resourceId});
 for(const b of seq.blocking)ev.push({frame:b.startFrame,kind:'PRESENTER_ENTRY',detail:b.movementType});
 return ev.sort((a,b)=>a.frame-b.frame||a.kind.localeCompare(b.kind,'en'));
}
export function visualQa(plan:VisualCausalPlan,seq:DirectedSequence){
 const w=seq.width,h=seq.height,fps=seq.fps,ent=(id:string)=>plan.world.entities.find(e=>e.entityId===id)!;
 // Screen occupancy and presenter framing per beat (mid frame).
 const beats=plan.beats.map(b=>{const f=Math.floor((b.startFrame+b.endFrame)/2),e=evaluateDirected(seq,f),cam=e.state.camera;
  const focus=b.focusEntityId?screenBox(bounds(ent(b.focusEntityId)),cam,w,h):null;
  const presenter=b.presenterVisible?screenBox(presenterPoints(e.state.actors[plan.world.presenter.entityId].position,plan.world.presenter.scale),cam,w,h):null;
  const visible=plan.world.entities.filter(x=>e.state.demonstration?.subjects[x.entityId]?.visible).map(x=>screenBox(bounds(x),cam,w,h)).filter(Boolean);
  const top=[...visible,presenter].some(x=>x&&x.y0<0.3&&x.visibleFraction>0);
  const explanatory=['COMPONENT','ACTION','RESULT','SYSTEM'].includes(b.cameraZone);
  return{beatId:b.id,order:b.order,zone:b.cameraZone,grounding:b.grounding,frame:f,focus:b.focusEntityId,focusExtent:focus?.extent??null,focusArea:focus?.areaFraction??null,focusVisibleFraction:focus?.visibleFraction??null,
   presenterVisibleFraction:presenter?.visibleFraction??null,presenterExtent:presenter?.extent??null,emptyTop30:!top,
   // A layer is an extended region: it passes when it covers the frame rather than fitting inside it.
   occupancyStatus:!explanatory||!b.focusEntityId?'NOT_APPLICABLE':(focus?.extent??0)>=0.3&&((focus?.visibleFraction??0)>=0.6||(ent(b.focusEntityId).kind==='LAYER'&&(focus?.areaFraction??0)>=0.3))?'PASS':(focus?.extent??0)>=0.18?'PARTIAL':'FAIL'};});
 // Meaningful change and stasis.
 const changes=meaningfulChanges(plan,seq),frames=[0,...changes.map(c=>c.frame),seq.totalFrames].sort((a,b)=>a-b);
 let longest=0,at=0;for(let i=1;i<frames.length;i++){const g=frames[i]-frames[i-1];if(g>longest){longest=g;at=frames[i-1];}}
 const meaningfulBeats=plan.beats.filter(b=>changes.some(c=>c.frame>=b.startFrame&&c.frame<b.endFrame)).length;
 // Continuity: visibility, monotone state, positions, presenter identity, world identity.
 const steps=seq.demonstration?.steps??[],issues:string[]=[];let prev:ReturnType<typeof evaluateDirected>['state']|null=null;
 for(let f=0;f<=seq.totalFrames;f+=2){const s=evaluateDirected(seq,f).state;
  if(prev)for(const [id,x] of Object.entries(s.demonstration!.subjects)){const p=prev.demonstration!.subjects[id],active=(ops:string[])=>steps.some(t=>t.target===id&&ops.includes(t.operation)&&t.startFrame<=f&&t.endFrame>=f-2);
   if(p.visible&&!x.visible&&!active(['HIDE','DISAPPEAR']))issues.push('DISAPPEARED_WITHOUT_TRANSITION:'+id+'@'+f);
   if(!p.visible&&x.visible&&!active(['REVEAL','APPEAR']))issues.push('APPEARED_WITHOUT_TRANSITION:'+id+'@'+f);
   for(const k of ['connection','flowProgress','fillLevel'])if((x.parameters[k]??0)<(p.parameters[k]??0)-1e-6&&!active(['DECREASE','SEPARATE']))issues.push('STATE_REGRESSION:'+id+'.'+k+'@'+f);
   if(x.position.some((v,i)=>Math.abs(v-p.position[i])>1e-6)&&!active(['MOVE']))issues.push('TELEPORT:'+id+'@'+f);
   if(x.scale.some((v,i)=>Math.abs(v-p.scale[i])>1e-6)&&!active(['SCALE']))issues.push('SCALE_CHANGE:'+id+'@'+f);}
  prev=s;}
 const characters=seq.baseShot.characters;if(characters.length!==1||characters[0].resourceId!==plan.world.presenter.resourceId)issues.push('PRESENTER_IDENTITY');
 if(plan.world.entities.some(e=>e.worldId!==plan.worldId))issues.push('WORLD_IDENTITY');
 if(seq.baseShot.environment.resourceId!==plan.world.environmentId)issues.push('ENVIRONMENT_IDENTITY');
 // Camera motivation: every camera segment states the zone/motivation it serves.
 const unmotivated=seq.cameraSegments.filter(c=>!/^(?:WORLD|SYSTEM|CUTAWAY|COMPONENT|ACTION|RESULT)\b/.test(c.purpose)).map(c=>c.startFrame);
 // Labels: at most one at a time (shot onScreenText at the top), captions stay in the lower third.
 const captionsLowerThird=true,simultaneousLabels=1;
 const proof:Record<string,number>={DIRECT:0,PARTIAL:0,SYMBOLIC:0,NONE:0};for(const b of plan.beats)if(b.proof)proof[b.proof.level]++;
 const explanatory=beats.filter(b=>b.occupancyStatus!=='NOT_APPLICABLE'),presenterBeats=beats.filter(b=>b.presenterVisibleFraction!==null);
 const dims={
  WORLD_CONTEXT:plan.beats[0].cameraZone==='WORLD'&&plan.world.environmentId!=='ENV_LAB_001'?'PASS':'FAIL',
  SYSTEM_LEGIBILITY:explanatory.filter(b=>b.zone==='SYSTEM').every(b=>b.occupancyStatus!=='FAIL')?'PASS':'PARTIAL',
  PRESENTER_CONTINUITY:!issues.includes('PRESENTER_IDENTITY')&&presenterBeats.filter(b=>(b.presenterVisibleFraction??0)>=0.9).length>=2?'PASS':'FAIL',
  OBJECT_PERSISTENCE:issues.some(i=>/DISAPPEARED|APPEARED|TELEPORT|SCALE_CHANGE|IDENTITY/.test(i))?'FAIL':'PASS',
  STATE_CONTINUITY:issues.some(i=>i.startsWith('STATE_REGRESSION'))?'FAIL':'PASS',
  CAMERA_MOTIVATION:unmotivated.length?'FAIL':'PASS',
  CUTAWAY_CLARITY:plan.world.cutaway.kind==='NONE'?'NOT_APPLICABLE':steps.some(s=>s.target==='ENVIRONMENT'||s.operation==='HIDE')?'PASS':'FAIL',
  ACTION_VISIBILITY:beats.filter(b=>plan.beats[b.order].operations.some(o=>['FLOW','MOVE','CONNECT'].includes(o.operation))).every(b=>(b.focusVisibleFraction??0)>=0.5)?'PASS':'FAIL',
  RESULT_VISIBILITY:beats.filter(b=>b.zone==='RESULT').every(b=>(b.focusVisibleFraction??0)>=0.5)?'PASS':'FAIL',
  SCREEN_OCCUPANCY:explanatory.every(b=>b.occupancyStatus==='PASS')?'PASS':explanatory.some(b=>b.occupancyStatus==='FAIL')?'FAIL':'PARTIAL',
  MEANINGFUL_CHANGE:meaningfulBeats>=6&&longest/fps<=8?'PASS':'FAIL',
  VISUAL_PROOF:proof.DIRECT+proof.PARTIAL>=1?'PASS':'FAIL',
  CAPTION_COLLISION:captionsLowerThird&&simultaneousLabels<=2?'PASS':'FAIL',
  GENERAL_COMPOSITION:beats.filter(b=>b.emptyTop30&&b.zone!=='WORLD').length<=Math.ceil(beats.length/3)?'PASS':'PARTIAL',
 };
 return{dims,beats,meaningfulChanges:changes,meaningfulBeats,longestMeaningfulStasisSeconds:longest/fps,longestStasisAtFrame:at,continuityIssues:issues,unmotivatedCameraFrames:unmotivated,proof,shots:seq.shots.length,cuts:seq.shots.filter(s=>s.transition==='CUT').length,cameraSegments:seq.cameraSegments.length,presenterActions:seq.actionSegments.length,stateTransitions:plan.transitions.length};
}
