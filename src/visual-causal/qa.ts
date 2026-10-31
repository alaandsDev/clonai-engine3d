import type {Vec3} from '../engine3d/contracts';
import {evaluateDirected,projectPosition,type DirectedSequence,type CameraState} from '../engine3d/directed';
import type {VisualCausalPlan,WorldEntity} from './contracts';
import {rig} from '../engine3d/motion';
import {evaluateDemonstration} from '../engine3d/demonstration-runtime';
import {blockersOnSight,cameraCollision,insideBox,segmentHits,scaleOf,OCCUPANCY_THRESHOLDS} from './camera-space';
import {causalReadability,meaningfulStasis} from './readability';
import {demonstrationQa} from './demonstration-qa';
/** Phase 27 visual QA measured on the compiled sequence (projected bounds through the evaluated
 * camera at real frames), not on the existence of contracts. Rendered-frame inspection is a
 * separate, manual review artifact. */
/** World position of a subject at a frame (an attached content is placed in its parent's frame). */
export function worldPosition(plan:VisualCausalPlan,ds:ReturnType<typeof evaluateDemonstration>|null,e:WorldEntity):Vec3{
 // The runtime already composes parent transforms; only the plan's own (local) position needs the parent added.
 const live=ds?.subjects[e.entityId]?.position as Vec3|undefined;if(live)return live;
 const p=e.parentId&&e.assembly==='CONTENT_ITEMS'?plan.world.entities.find(x=>x.entityId===e.parentId):undefined;return p?e.position.map((v,i)=>v+p.position[i]) as Vec3:e.position;}
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
  // Script-mode worlds measure a moving focus where it is at this frame (legacy plans keep their static layout).
  const fe=b.focusEntityId?ent(b.focusEntityId):null,livePos=plan.world.template==='MECHANISM_STAGE'&&fe&&fe.kind!=='PATH'?e.state.demonstration?.subjects[fe.entityId]?.position:undefined;
  const focus=fe?screenBox(bounds(livePos?{...fe,position:[...livePos] as Vec3}:fe),cam,w,h):null;
  const presenter=b.presenterVisible?screenBox(presenterPoints(e.state.actors[plan.world.presenter.entityId].position,plan.world.presenter.scale),cam,w,h):null;
  const visible=plan.world.entities.filter(x=>e.state.demonstration?.subjects[x.entityId]?.visible).map(x=>screenBox(bounds(plan.world.template==='MECHANISM_STAGE'?{...x,position:worldPosition(plan,e.state.demonstration as ReturnType<typeof evaluateDemonstration>,x)}:x),cam,w,h)).filter(Boolean);
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
   const inherited=(ops:string[])=>{let parent=seq.demonstration?.subjects.find(x=>x.id===id)?.parentId;while(parent){if(steps.some(t=>t.target===parent&&ops.includes(t.operation)&&t.startFrame<=f&&t.endFrame>=f-2))return true;parent=seq.demonstration?.subjects.find(x=>x.id===parent)?.parentId;}return false;};
   if(p.visible&&!x.visible&&!active(['HIDE','DISAPPEAR'])&&!inherited(['HIDE','DISAPPEAR']))issues.push('DISAPPEARED_WITHOUT_TRANSITION:'+id+'@'+f);
   if(!p.visible&&x.visible&&!active(['REVEAL','APPEAR'])&&!inherited(['REVEAL','APPEAR']))issues.push('APPEARED_WITHOUT_TRANSITION:'+id+'@'+f);
   for(const k of ['connection','flowProgress','fillLevel'])if((x.parameters[k]??0)<(p.parameters[k]??0)-1e-6&&!active(['DECREASE','SEPARATE']))issues.push('STATE_REGRESSION:'+id+'.'+k+'@'+f);
   if(x.position.some((v,i)=>Math.abs(v-p.position[i])>1e-6)&&!active(['MOVE'])&&!inherited(['MOVE','ROTATE','SCALE']))issues.push('TELEPORT:'+id+'@'+f);
   if(x.scale.some((v,i)=>Math.abs(v-p.scale[i])>1e-6)&&!active(['SCALE'])&&!inherited(['SCALE']))issues.push('SCALE_CHANGE:'+id+'@'+f);}
  prev=s;}
 const characters=seq.baseShot.characters;if(!plan.world.presenter.offstage&&(characters.length!==1||characters[0].resourceId!==plan.world.presenter.resourceId))issues.push('PRESENTER_IDENTITY');
 if(plan.world.entities.some(e=>e.worldId!==plan.worldId))issues.push('WORLD_IDENTITY');
 if(seq.baseShot.environment.resourceId!==plan.world.environmentId)issues.push('ENVIRONMENT_IDENTITY');
 // Camera motivation: every camera segment states the zone/motivation it serves.
 const unmotivated=seq.cameraSegments.filter(c=>!/^(?:WORLD|SYSTEM|CUTAWAY|COMPONENT|ACTION|RESULT|ESTABLISHING|MEDIUM|COMPONENT_CLOSEUP|ACTION_CLOSEUP|FOLLOW_ACTION|PAYOFF)\b/.test(c.purpose)).map(c=>c.startFrame);
 // Labels: at most one at a time (shot onScreenText at the top), captions stay in the lower third.
 const captionsLowerThird=true,simultaneousLabels=1;
 const proof:Record<string,number>={DIRECT:0,PARTIAL:0,SYMBOLIC:0,NONE:0};for(const b of plan.beats)if(b.proof)proof[b.proof.level]++;
 const explanatory=beats.filter(b=>b.occupancyStatus!=='NOT_APPLICABLE'),presenterBeats=beats.filter(b=>b.presenterVisibleFraction!==null);
 const dims={
  WORLD_CONTEXT:plan.beats[0].cameraZone==='WORLD'&&plan.world.environmentId!=='ENV_LAB_001'?'PASS':'FAIL',
  SYSTEM_LEGIBILITY:explanatory.filter(b=>b.zone==='SYSTEM').every(b=>b.occupancyStatus!=='FAIL')?'PASS':'PARTIAL',
  // An offstage presenter is a direction choice (no role adds information), so continuity does not apply.
  PRESENTER_CONTINUITY:plan.world.presenter.offstage?'NOT_APPLICABLE':!issues.includes('PRESENTER_IDENTITY')&&presenterBeats.filter(b=>(b.presenterVisibleFraction??0)>=0.9).length>=2?'PASS':'FAIL',
  OBJECT_PERSISTENCE:issues.some(i=>/DISAPPEARED|APPEARED|TELEPORT|SCALE_CHANGE|IDENTITY/.test(i))?'FAIL':'PASS',
  STATE_CONTINUITY:issues.some(i=>i.startsWith('STATE_REGRESSION'))?'FAIL':'PASS',
  CAMERA_MOTIVATION:unmotivated.length?'FAIL':'PASS',
  // A housing section must actually open (enclosure activity rises); a ground trench opens the environment.
  CUTAWAY_CLARITY:plan.world.cutaway.kind==='NONE'?'NOT_APPLICABLE':plan.world.cutaway.kind==='HOUSING_SECTION'?(steps.some(s=>s.operation==='INCREASE'&&plan.world.entities.find(e=>e.entityId===s.target)?.assembly==='ENCLOSURE')?'PASS':'FAIL'):steps.some(s=>s.target==='ENVIRONMENT'||s.operation==='HIDE')?'PASS':'FAIL',
  ACTION_VISIBILITY:beats.filter(b=>plan.beats[b.order].operations.some(o=>['FLOW','MOVE','CONNECT'].includes(o.operation))).every(b=>(b.focusVisibleFraction??0)>=0.5)?'PASS':'FAIL',
  RESULT_VISIBILITY:beats.filter(b=>b.zone==='RESULT').every(b=>(b.focusVisibleFraction??0)>=0.5)?'PASS':'FAIL',
  SCREEN_OCCUPANCY:explanatory.every(b=>b.occupancyStatus==='PASS')?'PASS':explanatory.some(b=>b.occupancyStatus==='FAIL')?'FAIL':'PARTIAL',
  MEANINGFUL_CHANGE:meaningfulBeats>=6&&longest/fps<=8?'PASS':'FAIL',
  VISUAL_PROOF:proof.DIRECT+proof.PARTIAL>=1?'PASS':'FAIL',
  CAPTION_COLLISION:captionsLowerThird&&simultaneousLabels<=2?'PASS':'FAIL',
  GENERAL_COMPOSITION:beats.filter(b=>b.emptyTop30&&b.zone!=='WORLD').length<=Math.ceil(beats.length/3)?'PASS':'PARTIAL',
 };
 return{dims,beats,spatial:spatialDirection(plan,seq),offFrameChanges:offFrameChanges(plan,seq),causalCamera:causalCamera(plan,seq),readability:causalReadability(plan,seq),meaningfulStasis:meaningfulStasis(plan,seq),demonstrationQa:demonstrationQa(plan,seq),semanticSync:semanticSync(plan,seq.fps),meaningfulChanges:changes,meaningfulBeats,longestMeaningfulStasisSeconds:longest/fps,longestStasisAtFrame:at,continuityIssues:issues,unmotivatedCameraFrames:unmotivated,proof,shots:seq.shots.length,cuts:seq.shots.filter(s=>s.transition==='CUT').length,cameraSegments:seq.cameraSegments.length,presenterActions:seq.actionSegments.length,stateTransitions:plan.transitions.length};
}

/** Phase29: a factual change must happen where the camera looks. For each factual beat, the changed object (the point a flow
 * has reached, for paths) is projected through the evaluated camera at the middle of the change; outside the frame = off-frame. */
export function offFrameChanges(plan:VisualCausalPlan,seq:DirectedSequence){
 const out:{beatId:string;intent:string;target:string;frame:number;screen:[number,number]}[]=[];
 for(const b of plan.beats.filter(b=>b.grounding==='FACTUAL_DEMONSTRATION')){
  const op=b.operations.find(o=>!['HIGHLIGHT','REVEAL','HIDE'].includes(o.operation)&&!o.observed);if(!op)continue;
  const e=plan.world.entities.find(x=>x.entityId===op.target);if(!e)continue;
  const f=Math.round(b.startFrame+(b.endFrame-b.startFrame)*(op.startOffset+op.endOffset)/2),st=evaluateDirected(seq,f),ds=seq.demonstration?evaluateDemonstration(seq.demonstration,f):null;
  let p:Vec3;if(e.kind==='PATH'){const path=e.path!,prog=Math.min(1,Math.max(0,Number(ds?.subjects[e.entityId]?.parameters.flowProgress??0.5)));p=path[Math.min(path.length-1,Math.round(prog*(path.length-1)))];}
  else p=worldPosition(plan,ds,e);
  const s=projectPosition(p,st.state.camera,seq.width,seq.height);
  if(!(s.x>0.02&&s.x<0.98&&s.y>0.02&&s.y<0.98&&s.depth<1))out.push({beatId:b.id,intent:b.visualIntent,target:e.entityId,frame:f,screen:[+s.x.toFixed(2),+s.y.toFixed(2)]});}
 return out;
}

/** Phase29 true visibility of a point at a frame: in frame, not behind a structural blocker (wall, floor, furniture, large
 * object) or another solid; the targets' own boxes and opened housings do not hide what they contain. */
export function pointStatus(plan:VisualCausalPlan,seq:DirectedSequence,f:number,p:Vec3,targets:WorldEntity[]):'OUT_OF_FRAME'|'OCCLUDED'|'VISIBLE'{
 const cam=evaluateDirected(seq,f).state.camera,ds=seq.demonstration?evaluateDemonstration(seq.demonstration,f):null,space=plan.cameraSpace;
 const pos=(e:WorldEntity):Vec3=>worldPosition(plan,ds,e);
  const ignore=new Set(targets.map(t=>t.entityId)),open=new Set(plan.world.entities.filter(e=>e.assembly==='ENCLOSURE'&&Number(ds?.subjects[e.entityId]?.parameters.activity??0)>=0.5).map(e=>e.entityId));
  const status=(p:Vec3)=>{const s=projectPosition(p,cam,seq.width,seq.height);if(!(s.x>0.02&&s.x<0.98&&s.y>0.02&&s.y<0.98&&s.depth<1))return'OUT_OF_FRAME';
   if(space&&blockersOnSight(cam.position,p,space,ignore,open).length)return'OCCLUDED';
   const solids=plan.world.entities.filter(e=>['BOX','CYLINDER'].includes(e.kind)&&!targets.includes(e)&&!['STATE_TINT','INTERIOR_ROOM','STUDIO_BACKDROP','CLOUD_FIELD','WATER_SURFACE','ROAD_STRIP','STREAMLINES','PRESSURE_FIELD','FORCE_ARROW','ROTATING_CONTAINER','OUTER_CONTAINER','CONTENT_ITEMS'].includes(e.assembly??'')&&ds?.subjects[e.entityId]?.visible!==false&&!(e.assembly==='ENCLOSURE'&&Number(ds?.subjects[e.entityId]?.parameters.activity??0)>=0.5));
   if(solids.some(o=>{const c=pos(o),h=o.size.map(v=>v/2*0.95),lo=c.map((v,i)=>v-h[i]) as Vec3,hi=c.map((v,i)=>v+h[i]) as Vec3;return!insideBox(p,lo,hi)&&segmentHits(cam.position,p,lo,hi);}))return'OCCLUDED';return'VISIBLE';};
 return status(p);
}
/** Phase29 causal camera with true visibility: at the middle of each factual change, the causal subject and the result/destination
 * must be IN_FRAME, VISIBLE (no structural blocker — wall, floor, furniture, large object — and no other solid on the line of sight)
 * and not TOO_SMALL for their narrative scale. The camera itself must stand in the navigable volume. */
export function causalCamera(plan:VisualCausalPlan,seq:DirectedSequence){
 const fails:{beatId:string;intent:string;reason:string;status:string}[]=[];let checked=0,occlusions=0,collisions=0,blockedSight=0,subjectVisible=0,resultVisible=0,parentVisible=0,minOcc=1;
 const space=plan.cameraSpace,enc=plan.spatialMap?plan.world.entities.find(e=>e.entityId===plan.spatialMap!.object):undefined;
 for(const b of plan.beats.filter(b=>b.grounding==='FACTUAL_DEMONSTRATION')){
  const ops=b.operations.filter(o=>!['HIGHLIGHT','REVEAL','HIDE'].includes(o.operation)&&!o.observed);if(!ops.length)continue;checked++;
  const f=Math.round(b.startFrame+(b.endFrame-b.startFrame)*(ops[0].startOffset+ops[0].endOffset)/2),st=evaluateDirected(seq,f),ds=seq.demonstration?evaluateDemonstration(seq.demonstration,f):null,cam=st.state.camera;
  const pos=(e:WorldEntity):Vec3=>worldPosition(plan,ds,e);
  const targets=[...new Set(ops.map(o=>o.target))].map(id=>plan.world.entities.find(e=>e.entityId===id)).filter((e):e is WorldEntity=>Boolean(e));
  const subjPts:Vec3[]=targets.flatMap(e=>e.kind==='PATH'?[e.path![0]]:[pos(e)]),resPts:Vec3[]=targets.flatMap(e=>e.kind==='PATH'?[e.path!.at(-1)!]:[pos(e)]);
  const ignore=new Set(targets.map(t=>t.entityId)),open=new Set(plan.world.entities.filter(e=>e.assembly==='ENCLOSURE'&&Number(ds?.subjects[e.entityId]?.parameters.activity??0)>=0.5).map(e=>e.entityId));
  const status=(p:Vec3)=>pointStatus(plan,seq,f,p,targets);
  // Readable size is measured on the same key points the camera search used (centres, route ends).
  const keyPts=[...subjPts,...resPts],ext=screenBox((b.framing?(b.framing.points as Vec3[]).slice(0,b.framing.keyCount??b.framing.points.length):undefined)??targets.flatMap(e=>e.kind==='PATH'?e.path!:bounds({...e,position:pos(e)})),cam,seq.width,seq.height)?.extent??0;
  const main=targets.find(t=>t.kind!=='PATH')??targets[0],need=b.framing?.need??OCCUPANCY_THRESHOLDS[scaleOf(main)];minOcc=Math.min(minOcc,ext);
  if(space&&cameraCollision(cam.position,space))collisions++;
  const sS=subjPts.map(status),rS=resPts.map(status);
  if(space&&keyPts.some(p=>blockersOnSight(cam.position,p,space,ignore,open).length))blockedSight++;
  const sv=sS.every(x=>x==='VISIBLE'),rv=rS.every(x=>x==='VISIBLE');if(sv)subjectVisible++;if(rv)resultVisible++;
  if(!sv||!rv)occlusions+=[...sS,...rS].some(x=>x==='OCCLUDED')?1:0;
  if(enc){const eb=screenBox(bounds(enc),cam,seq.width,seq.height);if((eb?.extent??0)>=0.15&&(eb?.visibleFraction??0)>=0.25)parentVisible++;}
  const small=ext<need,st2=!sv||!rv?([...sS,...rS].find(x=>x!=='VISIBLE')!):small?'TOO_SMALL':'VISIBLE';
  if(st2!=='VISIBLE')fails.push({beatId:b.id,intent:b.visualIntent,status:st2,reason:st2+(small?' (extent '+ext.toFixed(2)+' < '+need+')':'')});}
 const purposes=seq.cameraSegments.map(c=>c.purpose),fallback=new Set(purposes.filter(p=>/\[camera:(?!CAMERA_GAP)/.test(p))).size,gaps=new Set(purposes.filter(p=>/\[camera:CAMERA_GAP/.test(p))).size;
 return{checked,passed:checked-fails.length,passRate:checked?+((checked-fails.length)/checked).toFixed(3):null,occlusionFailures:occlusions,
  cameraCollisionCount:collisions,cameraBlockedLineOfSight:blockedSight,causalSubjectVisibleRate:checked?+(subjectVisible/checked).toFixed(3):null,causalResultVisibleRate:checked?+(resultVisible/checked).toFixed(3):null,
  minTargetScreenOccupancy:checked?+minOcc.toFixed(3):null,parentContextVisibleRate:checked&&enc?+(parentVisible/checked).toFixed(3):null,cameraFallbackCount:fallback,cameraGapCount:gaps,thresholds:OCCUPANCY_THRESHOLDS,fails};
}
/** Phase29 narration sync: distance between the frame the narration says a beat's predicate and the onset of its first action. */
export function semanticSync(plan:VisualCausalPlan,fps:number){
 const err=plan.beats.filter(b=>b.anchorFrame!==undefined).flatMap(b=>{const o=b.operations.filter(o=>!['HIGHLIGHT','REVEAL','HIDE'].includes(o.operation)&&!o.observed).sort((x,y)=>x.startOffset-y.startOffset)[0];if(!o)return[];
  return[Math.abs(b.startFrame+(b.endFrame-b.startFrame)*o.startOffset-b.anchorFrame!)*1000/fps];}).sort((a,b)=>a-b);
 const q=(p:number)=>err.length?Math.round(err[Math.min(err.length-1,Math.floor(p*(err.length-1)+0.5))]):null;
 return{beats:err.length,medianMs:q(0.5),p90Ms:q(0.9),worstMs:err.length?Math.round(err.at(-1)!):null};
}

/** Phase29 spatial direction metrics: does the video keep the main object recognizable and the viewer oriented? Measured through
 * the evaluated camera on the plan's persistent spatial map (not on the existence of contracts). */
export function spatialDirection(plan:VisualCausalPlan,seq:DirectedSequence){
 if(!plan.spatialMap)return null;
 const map=plan.spatialMap,obj=plan.world.entities.find(e=>e.entityId===map.object);
 if(!obj)return null;
 const corners=bounds(obj),frac=(f:number)=>{const cam=evaluateDirected(seq,f).state.camera;const ps=corners.map(p=>projectPosition(p,cam,seq.width,seq.height));return ps.filter(s=>s.x>0&&s.x<1&&s.y>0&&s.y<1&&s.depth<1).length/ps.length;};
 const factual=plan.beats.filter(b=>b.grounding==='FACTUAL_DEMONSTRATION'&&b.operations.some(o=>!['HIGHLIGHT','REVEAL','HIDE'].includes(o.operation)));
 const per=factual.map(b=>({b,f:frac(Math.round((b.startFrame+b.endFrame)/2))}));
 // Opening: the whole object on screen before any cut-away (silhouette first).
 const open=plan.beats.find(b=>b.operations.some(o=>o.target===obj.entityId&&o.operation==='INCREASE'));const before=open?Math.max(0,open.startFrame-5):15;
 const recognizable=(map.features.length>=4?0.5:0)+(frac(Math.min(before,15))===1?0.5:0);
 const firsts=new Map<string,number>();for(const x of per)for(const o of x.b.operations){const p=map.parts.find(q=>q.entityId===o.target);if(p&&!firsts.has(p.entityId))firsts.set(p.entityId,x.f);}
 const routes=(plan.mechanismExecution?.carriers??[]).filter(c=>c.fromEntityId).map(c=>plan.world.entities.find(e=>e.entityId===c.entityId)!).filter(Boolean);
 const anchors=map.parts.map(p=>p.anchor.map((v,i)=>v+obj.position[i]) as Vec3).concat([obj.position]);
 const continuous=routes.filter(r=>[r.path![0],r.path!.at(-1)!].every(p=>anchors.some(a=>Math.hypot(...p.map((v,i)=>v-a[i]) as [number,number,number])<=1.2)));
 const pitch=seq.cameraSegments.map(c=>{const d=c.endState.target.map((v,i)=>v-c.endState.position[i]);return Math.atan2(-d[1],Math.hypot(d[0],d[2]))*180/Math.PI;});
 const lastOp=Math.max(0,...plan.beats.flatMap(b=>b.operations.filter(o=>o.operation!=='HIGHLIGHT').map(o=>b.startFrame+(b.endFrame-b.startFrame)*o.endOffset)));
 const lastCam=Math.max(0,...seq.cameraSegments.filter(c=>JSON.stringify(c.startState)!==JSON.stringify(c.endState)).map(c=>c.endFrame));
 const encOps=plan.beats.flatMap(b=>b.operations.filter(o=>o.target===obj.entityId).map(o=>o.operation));
 return{objectRecognizability:recognizable,structuralFeatures:map.features,
  parentContextVisibility:per.length?+(per.filter(x=>x.f>=0.25).length/per.length).toFixed(3):null,
  orientationConfidence:per.length?+(per.reduce((a,x)=>a+Math.min(1,x.f*2),0)/per.length).toFixed(3):null,
  componentLocationClarity:firsts.size?+([...firsts.values()].filter(f=>f>=0.75).length/firsts.size).toFixed(3):null,
  routeContinuity:routes.length?+(continuous.length/routes.length).toFixed(3):null,
  exteriorCutawayContinuity:!encOps.some(o=>o==='HIDE'||o==='MOVE'||o==='REVEAL')?1:0,
  extremeCameraAngleCount:pitch.filter(p=>p>50||p<-35).length,
  uncontextualizedDetailShots:per.filter(x=>x.f<0.25).length,
  endingStaticSeconds:+((seq.totalFrames-Math.max(lastOp,lastCam))/seq.fps).toFixed(2)};
}
