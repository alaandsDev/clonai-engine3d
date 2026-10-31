/** Operator: camera pose, collision and line of sight at given seconds, for a rendered Script Mode folder (uses the new camera space). */
import {readFileSync} from 'node:fs';import {evaluateDirected} from '../../src/engine3d/directed';import {cameraSpaceOf,cameraCollision,blockersOnSight} from '../../src/visual-causal/camera-space';
const [dir,...secs]=process.argv.slice(2),plan=JSON.parse(readFileSync(dir+'/visual-plan.json','utf8')),seq=JSON.parse(readFileSync(dir+'/directed-sequence.json','utf8'));
const space=plan.cameraSpace??cameraSpaceOf(plan.world);
for(const s of secs){const f=Math.round(Number(s)*seq.fps),cam=evaluateDirected(seq,f).state.camera,b=plan.beats.find((x:any)=>x.startFrame<=f&&x.endFrame>f),seg=seq.cameraSegments.find((c:any)=>c.startFrame<=f&&c.endFrame>=f);
 const tg=b.operations.find((o:any)=>!['HIGHLIGHT','REVEAL','HIDE'].includes(o.operation))?.target,e=plan.world.entities.find((x:any)=>x.entityId===tg),p=e?(e.kind==='PATH'?e.path[0]:e.position):cam.target;
 console.log(s+'s',b.visualIntent,'cam',JSON.stringify(cam.position.map((v:number)=>+v.toFixed(1))),'collision',cameraCollision(cam.position,space),'blocked by',blockersOnSight(cam.position,p,space,new Set([tg])).map(x=>x.id).join(',')||'-','|',(seg?.purpose??'').slice(0,90));}
