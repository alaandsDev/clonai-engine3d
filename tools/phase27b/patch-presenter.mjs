import {readFileSync,writeFileSync} from 'node:fs';
const edit=(f,pairs)=>{let s=readFileSync(f,'utf8');for(const [a,b] of pairs){if(s.split(a).length!==2)throw Error('anchor '+f+': '+a.slice(0,70));s=s.replace(a,b);}writeFileSync(f,s);};
edit('src/engine3d/assemblies.tsx',[
 [`{pieces.map(([at, size], i) => i === 0 && front > 0 ? (front < 0.999 && <mesh key={i} position={[at[0], at[1] - front * 0.6, at[2]]}><boxGeometry args={size} /><meshToonMaterial color={ground} transparent opacity={1 - front} depthWrite={false} /></mesh>) : <mesh key={i} position={at}><boxGeometry args={size} /><meshToonMaterial color={ground} /></mesh>)}`,
  `{pieces.map(([at, size], i) => (i === 0 && front >= 0.999) ? null : <mesh key={i} position={i === 0 ? [at[0], at[1] - front * front * 9, at[2]] : at}><boxGeometry args={size} /><meshToonMaterial color={ground} /></mesh>)}`],
 [`    const joints = path.filter((_, i) => { let at = 0; for (let k = 0; k < i; k++) at += lengths[k]; return at <= connected + 1e-6; });`,`    const joints = path.filter((_, i) => { if (i === 0 || i === path.length - 1) return false; let at = 0; for (let k = 0; k < i; k++) at += lengths[k]; return at <= connected + 1e-6; });`],
 [`<sphereGeometry args={[r * 1.18, 14, 10]} />`,`<sphereGeometry args={[r * 1.12, 14, 10]} />`]]);
// Cutaway reveal keeps the presenter in view: the gesture motivates the camera move into the section.
edit('src/visual-causal/planner.ts',[[`grounding:'EDITORIAL_TRANSITION',visualIntent:'CUTAWAY_REVEAL',presenterIntent:'NONE',presenterVisible:false,cameraZone:'CUTAWAY',cameraMotivation:'Reveal the hidden part of the same system',focusEntityId:'system_conduit'`,`grounding:'EDITORIAL_TRANSITION',visualIntent:'CUTAWAY_REVEAL',presenterIntent:'REVEAL_SYSTEM',presenterVisible:true,cameraZone:'CUTAWAY',cameraMotivation:'Follow the presenter gesture into the hidden part of the same system',focusEntityId:'system_conduit'`]]);
edit('src/visual-causal/compile.ts',[
 [`   if(need<=Math.min(40,Math.round(len*0.6)))cams.push({startFrame:b.startFrame,endFrame:b.startFrame+Math.max(8,need),`,`   // A presenter gesture leads a reveal: the camera starts once the arm is raised (gesture-motivated move).
   const lead=b.presenterIntent==='REVEAL_SYSTEM'?Math.min(12,Math.round(len*0.15)):0,room=Math.min(lead?60:40,Math.round(len*(lead?0.75:0.6)));
   if(need<=room)cams.push({startFrame:b.startFrame+lead,endFrame:b.startFrame+lead+Math.max(lead?Math.round(room*0.8):8,need),`],
 [` const blocking:ActorBlocking[]=[];const actions:ActionSegment[]=[];
 const first=plan.beats[0],walkEnd=first.startFrame+Math.max(12,Math.round((first.endFrame-first.startFrame)*0.7));
 const startPos:Vec3=[home[0]-0.9,0,home[2]+0.45];
 blocking.push({startFrame:first.startFrame,endFrame:walkEnd,easing:'EASE_IN_OUT',purpose:'Presenter walks into the world toward the system',actorId:p.entityId,startPosition:startPos,endPosition:home,startFacing:1.3,endFacing:p.facing,movementType:'APPROACH',intent:'ENTER_SCENE',target:{type:'POSITION',position:center(ent(plan.beats.find(b=>b.focusEntityId)?.focusEntityId??w.entities[0].entityId))}});
 for(const b of plan.beats.filter(b=>b.presenterVisible&&b.presenterIntent!=='ESTABLISH_CONTEXT'&&b.presenterIntent!=='NONE')){
  const focus=b.focusEntityId?center(ent(b.focusEntityId)):b.presenterIntent==='FINAL_PAYOFF'?[0.8,0.5,0] as Vec3:center(w.entities[0]);
  const resourceId=['POINT_TO_SYSTEM','POINT_TO_COMPONENT','FINAL_PAYOFF'].includes(b.presenterIntent)?'ACTION_POINT_001':'ACTION_LOOK_001';
  const [s,e]=span(b,0.1,0.85),prev=actions.at(-1);if(prev&&prev.endFrame>s)continue;
  actions.push({startFrame:s,endFrame:e,easing:'EASE_IN_OUT',purpose:b.presenterIntent+' (editorial; not visual proof)',resourceId,actorId:p.entityId,targetPosition:focus,fromProgress:0,toProgress:1});
 }`,` const blocking:ActorBlocking[]=[];const actions:ActionSegment[]=[];
 // Presenter arc (editorial): enter → observe → point → gesture leads the reveal → out of focus during the
 // mechanism → return → react. Every look/point aims at a real world position (entity centre or camera).
 const first=plan.beats[0],walkEnd=first.startFrame+Math.max(12,Math.round((first.endFrame-first.startFrame)*0.7));
 const startPos:Vec3=[home[0]-0.9,0,home[2]+0.45],systemFocus=center(ent(plan.beats.find(b=>b.focusEntityId)?.focusEntityId??w.entities[0].entityId));
 blocking.push({startFrame:first.startFrame,endFrame:walkEnd,easing:'EASE_IN_OUT',purpose:'Presenter walks into the world toward the system',actorId:p.entityId,startPosition:startPos,endPosition:home,startFacing:1.3,endFacing:p.facing,movementType:'APPROACH',intent:'ENTER_SCENE',target:{type:'POSITION',position:systemFocus}});
 const act=(s:number,e:number,resourceId:string,intent:string,target:Vec3)=>{const prev=actions.at(-1);if(e-s<8||(prev&&prev.endFrame>=s))return;actions.push({startFrame:s,endFrame:e,easing:'EASE_IN_OUT',purpose:intent+' (editorial; not visual proof)',resourceId,actorId:p.entityId,targetPosition:target,fromProgress:0,toProgress:1});};
 if(first.presenterIntent==='ESTABLISH_CONTEXT')act(walkEnd-6,first.endFrame-2,'ACTION_LOOK_001','OBSERVE_SYSTEM',systemFocus);
 let facing=p.facing;
 for(const b of plan.beats.filter(b=>b.presenterVisible&&b.presenterIntent!=='ESTABLISH_CONTEXT'&&b.presenterIntent!=='NONE')){
  const focus=b.focusEntityId?center(ent(b.focusEntityId)):center(w.entities[0]),[s,e]=span(b,0.08,0.88);
  if(b.presenterIntent==='FINAL_PAYOFF'){
   // Return: look back at the whole system, turn toward the viewer, react with a wave.
   const consumer=w.entities.filter(x=>x.role==='CONTEXT_PROP'||x.role==='CONDUIT').at(-1),cam=w.cameraZones.WORLD.position,[ts,te]=span(b,0.4,0.62),toCam=Math.atan2(cam[0]-home[0],cam[2]-home[2]);
   act(s,span(b,0,0.4)[1],'ACTION_LOOK_001','FINAL_PAYOFF',consumer?center(consumer):systemFocus);
   const end=+(facing+(toCam-facing)*0.7).toFixed(4);blocking.push({startFrame:ts,endFrame:te,easing:'EASE_IN_OUT',purpose:'Presenter turns toward the viewer for the payoff',actorId:p.entityId,startPosition:home,endPosition:home,startFacing:facing,endFacing:end,movementType:'TURN',intent:'REACT',target:{type:'POSITION',position:cam}});facing=end;
   act(span(b,0.45,1)[0],span(b,0,0.97)[1],'ACTION_WAVE_001','REACT_TO_EVENT',cam);continue;}
  if(b.presenterIntent==='REVEAL_SYSTEM'){act(b.startFrame,span(b,0,0.7)[1],'ACTION_POINT_001','REVEAL_SYSTEM',focus);continue;}
  if(b.presenterIntent==='OBSERVE_SYSTEM'){
   // Observe, then a short second point anticipates the next beat (keeps the presenter alive in long holds).
   const [m]=span(b,0.55,1);act(s,m-2,'ACTION_LOOK_001','OBSERVE_SYSTEM',focus);continue;}
  act(s,e,['POINT_TO_SYSTEM','POINT_TO_COMPONENT'].includes(b.presenterIntent)?'ACTION_POINT_001':'ACTION_LOOK_001',b.presenterIntent,focus);
 }`]]);
