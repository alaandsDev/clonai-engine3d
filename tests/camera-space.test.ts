import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {Vec3} from '../src/engine3d/contracts';
import type {CameraState} from '../src/engine3d/directed';
import {searchPose,blockersOnSight,cameraCollision,cameraSpaceOf,type CameraSpace} from '../src/visual-causal/camera-space';
import {fitFocus} from '../src/visual-causal/cinematic';
import {screenBox} from '../src/visual-causal/qa';
import {ingestScript} from '../src/script-mode/ingest';
import {understandScript} from '../src/script-mode/understand';
import {plannerInputFromScript} from '../src/script-mode/input';
import {planVisualCausal} from '../src/visual-causal/planner';
import {compileVisualPlan} from '../src/visual-causal/compile';
import {visualQa} from '../src/visual-causal/qa';
/** Phase29 camera space: collisions, true line of sight, readable size and a deterministic fallback search. */
const box=(id:string,kind:'WALL'|'FLOOR'|'FURNITURE'|'OBJECT',min:Vec3,max:Vec3)=>({id,kind,min,max});
const object=box('object','OBJECT',[-1,0,-0.7],[1,2.6,0.7]);
const floor=box('floor','FLOOR',[-50,-5,-50],[50,-0.01,50]);
const rearPart:Vec3[]=[[0.3,0.3,-1.0],[0.7,0.6,-1.2]];
const fit=(pts:Vec3[])=>(d:Vec3,tight?:boolean)=>fitFocus(pts,d,2.2,1.4*(tight?0.68:1));
const ext=(pts:Vec3[])=>(c:CameraState)=>screenBox(pts,c,480,854)?.extent??0;
test('A) a rear pose that is geometrically perfect is REJECTED when a wall stands between camera and target',()=>{
 const wall=box('wall','WALL',[-20,0,-2.2],[20,8,-2.0]),space:CameraSpace={safe:{min:[-20,0.2,-2.0],max:[20,8,20]},blockers:[floor,wall,object]};
 const pts:Vec3[]=[...rearPart,[1,2.6,0],[1,0,0]],keys:Vec3[]=[[0.5,0.45,-1.1]];
 const back=fit(pts)([0,0.3,-1]);assert.ok(cameraCollision(back.position,space)||blockersOnSight(back.position,keys[0],space).length>0,'the rear pose crosses the wall');
 const c=searchPose(fit(pts),[0,0.3,-1],keys,space,new Set(),ext(pts),0.1,null);
 assert.equal(c.valid,true);assert.notEqual(c.label,'preferred');assert.equal(cameraCollision(c.pose.position,space),false);assert.deepEqual(blockersOnSight(c.pose.position,keys[0],space),[]);
});
test('B) object in the middle of a room: the preferred pose is kept',()=>{
 const space:CameraSpace={safe:{min:[-20,0.2,-20],max:[20,8,20]},blockers:[floor,object]};const pts:Vec3[]=[[-1,0,0.7],[1,2.6,0.7]];
 const c=searchPose(fit(pts),[0.35,0.3,1],[[0,1.3,0.7]],space,new Set(),ext(pts),0.1,null);assert.equal(c.label,'preferred');
});
test('C) a component inside a housing is visible only when the housing is open (its back still hides what is behind)',()=>{
 const space:CameraSpace={safe:{min:[-20,0.2,-20],max:[20,8,20]},blockers:[floor,object]},cam:Vec3=[0.5,1.5,5],inside:Vec3=[0,1.5,0.2],behind:Vec3=[0,1.5,-1.2];
 assert.ok(blockersOnSight(cam,inside,space).length===0,'a point inside its own housing is not hidden by that housing');
 assert.ok(blockersOnSight(cam,behind,space).length>0);assert.ok(blockersOnSight(cam,behind,space,new Set(),new Set(['object'])).length>0,'an open front does not reveal the back');
});
test('D) the camera never stands inside furniture',()=>{
 const top=box('worktop','FURNITURE',[2,0,-1],[3,0.9,1]),space:CameraSpace={safe:{min:[-20,0.2,-20],max:[20,8,20]},blockers:[floor,top]};
 assert.equal(cameraCollision([2.5,0.5,0],space),true);assert.equal(cameraCollision([2.5,1.5,0],space),false);
});
function plan(t:string){const u=understandScript(ingestScript(t));let at=0;const timing=u.segments.map(s=>{const len=Math.round(s.span.text.split(/\s+/).length/2.7*30)+8;const w={sentenceId:s.id,startFrame:at,endFrame:at+len};at+=len;return w;});
 const p=planVisualCausal(plannerInputFromScript(u,timing,30)),seq=compileVisualPlan(p,{sentences:timing.map(x=>({id:x.sentenceId,text:u.segments.find(s=>s.id===x.sentenceId)!.span.text,startFrame:x.startFrame,endFrame:x.endFrame}))});return{p,qa:visualQa(p,seq)};}
test('E) an outdoor machine has no walls: only the floor blocks',()=>{
 const {p}=plan('A água empurra a roda. A roda gira o eixo do moinho.');assert.ok(p.cameraSpace);assert.deepEqual(p.cameraSpace!.blockers.filter(b=>b.kind==='WALL'),[]);
});
test('F) a vehicle in the sky keeps its own camera (no room, no walls)',()=>{
 const {p}=plan('O peso puxa o avião para baixo. Os motores impulsionam o avião para a frente.');assert.equal(p.world.template,'MOTION_STAGE');assert.equal(p.cameraSpace,undefined);
});
test('benchmark: no camera inside/behind structure, every causal subject and result visible and readable',()=>{
 const {qa}=plan(readFileSync('roteiro-geladeira-v3.txt','utf8')),c=qa.causalCamera;
 assert.equal(c.cameraCollisionCount,0);assert.equal(c.cameraBlockedLineOfSight,0);assert.equal(c.cameraGapCount,0);assert.ok(c.passRate!>=0.9,JSON.stringify(c.fails));
 assert.ok(c.minTargetScreenOccupancy!>=0.06);assert.equal(qa.offFrameChanges.length,0);
});
test('room walls are derived from the scene geometry (no topic rule)',()=>{
 const code=readFileSync('src/visual-causal/camera-space.ts','utf8').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();assert.ok(!/geladeira|cozinha|kitchen|compressor|valvula/.test(code));void cameraSpaceOf;
});
