/** Explicit editorial JSON production using the existing demonstration compiler and renderer.
 * Air paths, arrow lengths, travel speed and aircraft dimensions are schematic, not CFD. */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileDemonstration} from '../../src/engine3d/demonstration';
import {evaluateDemonstration} from '../../src/engine3d/demonstration-runtime';
import {DEMONSTRATION_COMPILER_VERSION,defaultEnvironmentState,type DemonstrationSubject,type SubjectState,type DemonstrationProgram,type VisualDemonstration} from '../../src/engine3d/demonstration-contracts';
import {evaluateDirected,type DirectedSequence,type CameraState,type CameraSegment} from '../../src/engine3d/directed';
import type {Vec3} from '../../src/engine3d/contracts';
import {captions} from '../../src/engine3d/director';
import {fitFocus} from '../../src/visual-causal/cinematic';
import {renderStills,contactSheet,renderMp4,validateMp4} from '../../src/visual-causal/media';
import {installNetworkGuard} from '../../src/script-mode/generate';
const root='out/engine3d/production/aviao',load=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const input=load(root+'/automatic/planner-input.json'),tracks=load(root+'/automatic/tracks.json'),script=readFileSync('roteiro-aviao.txt','utf8');
const timing=input.timing as {sentenceId:string;startFrame:number;endFrame:number}[],sentences=input.sentences as {id:string;text:string}[];
const fps=input.fps,total=input.totalFrames,w=(n:number)=>timing[n-1],sha=createHash('sha256').update(script).digest('hex');
const save=(name:string,value:unknown)=>{mkdirSync(root,{recursive:true});writeFileSync(root+'/'+name,typeof value==='string'?value:JSON.stringify(value,null,2),'utf8');};
const subjects:DemonstrationSubject[]=[],states:Record<string,SubjectState>={},palettes:Record<string,number>={};
function prop(id:string,resourceId:string,size:Vec3,position:Vec3,visible=false,rotation:Vec3=[0,0,0],scale:Vec3=[1,1,1],parentId?:string,palette?:number){subjects.push({id,kind:'PROP',resourceId,size,color:'#d4e3eb',...(parentId?{parentId}:{})});states[id]={position,rotation,scale,visible,stateId:'DEFAULT',parameters:{highlight:0}};if(palette!==undefined)palettes[id]=palette;}
prop('aircraft','PROP_AIRCRAFT_001',[5.2,1.8,5.9],[-.6,4,0],true);
prop('weight','PROP_VECTOR_ARROW_001',[.4,1.6,.4],[-.3,-.5,.25],false,[0,0,Math.PI],[1.5,1.6,1.5],'aircraft',1);
prop('lift','PROP_VECTOR_ARROW_001',[.4,1.6,.4],[.3,.5,.25],false,[0,0,0],[1.5,1.6,1.5],'aircraft',0);
prop('thrust','PROP_VECTOR_ARROW_001',[1.3,.4,.4],[2.6,0,.15],false,[0,0,-Math.PI/2],[1.5,1.3,1.5],'aircraft',2);
prop('foil','PROP_AIRFOIL_001',[2,.3,1.6],[0,4,0]);
prop('foilLift','PROP_VECTOR_ARROW_001',[.4,1.6,.4],[.7,4.4,1.1],false,[0,0,0],[1.25,1.2,1.25],undefined,0);
prop('wakeUpper','PROP_VECTOR_ARROW_001',[.4,.8,.4],[-1.65,3.85,1.1],false,[0,0,Math.PI/2+.40],[1,.8,1],undefined,2);
prop('wakeLower','PROP_VECTOR_ARROW_001',[.4,.8,.4],[-1.65,3.45,1.1],false,[0,0,Math.PI/2+.30],[1,.8,1],undefined,2);
prop('pressureUpper','PROP_VECTOR_ARROW_001',[.3,.55,.3],[.1,5.05,1.02],false,[0,0,Math.PI],[1,.55,1],undefined,2);
prop('pressureLower','PROP_VECTOR_ARROW_001',[.3,.95,.3],[.1,2.83,1.02],false,[0,0,0],[1,.95,1],undefined,3);
const paths:Record<string,Vec3[]>={
 upper:[[2.6,4.55,.9],[1.4,4.55,.9],[.6,4.65,.9],[-.3,4.43,.9],[-1.2,4.05,.9],[-2.6,3.45,.9]],
 lower:[[2.6,3.5,.9],[1.4,3.75,.9],[.5,3.82,.9],[-.3,3.78,.9],[-1.2,3.65,.9],[-2.6,3.05,.9]],
};
for(const[id,path]of Object.entries(paths)){subjects.push({id,kind:'PATH',size:[.028,.028,.028],path,color:'#37a9d5'});states[id]={position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],visible:false,stateId:'DEFAULT',parameters:{highlight:0,connection:1,flowProgress:0,direction:1,speed:1,amount:.8}};}
const program:DemonstrationProgram={version:1,compilerVersion:DEMONSTRATION_COMPILER_VERSION,id:'aircraft-lift-schematic',purpose:'Source-grounded editorial illustration of lift, airflow and steady level force balance; not a flight/CFD solver',claim:{id:'lift-and-weight',text:sentences.find(s=>s.id===w(10).sentenceId)!.text,type:'CAUSE_EFFECT',requiresVisualProof:false,cause:'Interaction between wing and air',transition:'Net aerodynamic lift',effect:'Lift balances weight in steady level flight'},subjects,initialState:{subjects:states,environment:{...defaultEnvironmentState,visibility:true},presenterMode:'DEMONSTRATION'},finalState:{subjects:states,environment:{...defaultEnvironmentState},presenterMode:'DEMONSTRATION'},presenterModes:[{startFrame:0,endFrame:total,mode:'DEMONSTRATION'}],steps:[]};
const visibility=(id:string,start:number,visible:boolean,duration=1)=>program.steps.push({startFrame:start,endFrame:start+duration,operation:visible?'APPEAR':'HIDE',target:id,parameters:{},easing:'LINEAR',purpose:'Narration-motivated diagram reveal; arrows encode direction, not calibrated magnitudes'});
program.steps.push({startFrame:0,endFrame:total,operation:'MOVE',target:'aircraft',parameters:{from:[-.6,4,0],to:[.6,4,0]},easing:'LINEAR',purpose:'Constant horizontal travel: level-flight illustration must not climb when lift balances weight'});
visibility('weight',w(2).startFrame,true);visibility('lift',w(3).startFrame,true);
visibility('weight',w(4).startFrame-3,false);visibility('lift',w(4).startFrame-3,false);visibility('thrust',w(4).startFrame,true);
visibility('aircraft',w(5).startFrame-1,false);visibility('thrust',w(5).startFrame-1,false);
for(const id of ['foil','upper','lower'])visibility(id,w(5).startFrame,true);
for(const id of ['upper','lower'])program.steps.push({startFrame:w(5).startFrame+2,endFrame:w(7).startFrame-8,operation:'FLOW',target:id,parameters:{path:paths[id],from:0,to:1,direction:'FORWARD',speed:1,amount:.8},easing:'LINEAR',purpose:'Progressively reveal schematic airflow over BOTH surfaces and downward in the wake; not equal-transit particles'});
program.steps.push({startFrame:w(6).startFrame,endFrame:w(6).endFrame-12,operation:'ROTATE',target:'foil',parameters:{from:[0,0,0],to:[0,0,.07]},easing:'EASE_IN_OUT',purpose:'Illustrate the wing angle relative to incoming air, without claiming a numeric angle of attack'});
for(const id of ['foilLift','wakeUpper','wakeLower'])visibility(id,w(7).startFrame,true);
for(const id of ['wakeUpper','wakeLower'])visibility(id,w(8).startFrame-6,false,2);
for(const id of ['upper','lower'])visibility(id,w(8).startFrame-3,false,2);
for(const id of ['pressureUpper','pressureLower'])visibility(id,w(8).startFrame,true);
for(const id of ['pressureUpper','pressureLower'])visibility(id,w(10).startFrame-6,false,2);
for(const id of ['foil','foilLift'])visibility(id,w(10).startFrame-2,false,2);
for(const id of ['aircraft','lift','weight'])visibility(id,w(10).startFrame,true);
program.steps.sort((a,b)=>a.startFrame-b.startFrame||a.target.localeCompare(b.target));program.finalState=evaluateDemonstration(program,total);
const corners=(lo:Vec3,hi:Vec3)=>Array.from({length:8},(_,i)=>[i&1?hi[0]:lo[0],i&2?hi[1]:lo[1],i&4?hi[2]:lo[2]] as Vec3);
const fit=(lo:Vec3,hi:Vec3,dir:Vec3,margin=1.2)=>fitFocus(corners(lo,hi),dir,2.2,margin);
const x=(f:number)=>-.6+1.2*f/total;
const air=(f:number,forces=false,view:Vec3=[.7,1.1,1])=>{
 const points:Vec3[]=[...corners([-2.6,-.35,-.36],[2.6,.35,.36]),[-2.43,1.2,0],[-1.4,1.2,0],...[-1,1].flatMap(s=>[[-.64,-.1,s*2.95],[-1.26,-.1,s*2.95],[-2.4,.15,s*1.2],[.65,-.61,s*1.23]] as Vec3[])];
 if(forces)points.push([.3,2.15,.25],[-.3,-2.15,.25]);
 return fitFocus(points.map(p=>[p[0]+x(f),p[1]+4,p[2]] as Vec3),view,2.2,1.16);
};
const engine=(f:number)=>fit([x(f)-.5,3.25,.55],[x(f)+1.3,4.35,1.55],[1.1,.35,1],1.35);
const wing=(f:number)=>fit([x(f)-1.4,3.65,.2],[x(f)+.9,4.65,3.0],[.35,1,1],1.25);
const profile=fit([-1.3,3.7,-.2],[1.4,4.8,1.4],[.08,.11,1],1.3);
const flow=fit([-2.75,2.9,-.1],[2.75,5.9,1.5],[.04,.06,1],1.18);
const pressure=fit([-1.2,2.7,-.1],[1.55,5.8,1.5],[.04,.06,1],1.25);
const pressureOblique=fit([-1.25,2.7,-.2],[1.55,5.8,1.5],[.32,.18,1],1.25);
type Shot={s:number;e:number;label:string;from:CameraState;to:CameraState};
const shots:Shot[]=[
 {s:0,e:w(1).endFrame,label:'COMO ELE VOA COM TANTO PESO?',from:air(0),to:air(w(1).endFrame)},
 {s:w(2).startFrame,e:w(2).endFrame,label:'PESO ↓',from:air(w(2).startFrame,true),to:air(w(2).endFrame,true)},
 {s:w(3).startFrame,e:250,label:'UMA FORÇA PARA CIMA',from:air(w(3).startFrame,true),to:air(250,true)},
 {s:250,e:w(3).endFrame,label:'SUSTENTAÇÃO ↑',from:air(250,true,[.55,.85,1]),to:air(w(3).endFrame,true,[.55,.85,1])},
 {s:w(4).startFrame,e:w(4).endFrame,label:'MOTORES → MOVIMENTO',from:engine(w(4).startFrame),to:engine(w(4).endFrame)},
 {s:w(5).startFrame,e:w(5).endFrame,label:'CORTE ESQUEMÁTICO DA ASA',from:profile,to:profile},
 {s:w(6).startFrame,e:w(6).endFrame,label:'FORMA + ÂNGULO',from:profile,to:flow},
 {s:w(7).startFrame,e:w(7).endFrame,label:'AR PARA BAIXO · ASA PARA CIMA',from:flow,to:flow},
 {s:w(8).startFrame,e:w(8).endFrame,label:'DIFERENÇAS DE PRESSÃO',from:pressure,to:pressure},
 {s:w(9).startFrame,e:w(9).endFrame,label:'A MESMA INTERAÇÃO',from:pressure,to:pressureOblique},
 {s:w(10).startFrame,e:w(10).endFrame,label:'VOO NIVELADO: SUSTENTAÇÃO = PESO',from:air(w(10).startFrame,true),to:air(w(10).endFrame,true)},
 {s:w(11).startFrame,e:w(11).endFrame,label:'ASAS + VELOCIDADE',from:wing(w(11).startFrame),to:wing(w(11).endFrame)},
 {s:w(12).startFrame,e:total,label:'PESO EQUILIBRADO PELA SUSTENTAÇÃO',from:air(w(12).startFrame,true,[.6,.9,1]),to:air(total,true,[.6,.9,1])},
];
const cameras:CameraSegment[]=[];
shots.forEach((s,i)=>{if(i)cameras.push({startFrame:s.s-1,endFrame:s.s,easing:'LINEAR',purpose:'Motivated cut: '+s.label,cameraId:'CAM_STATIC_001',behavior:'MOVE',startState:shots[i-1].to,endState:s.from});if(JSON.stringify(s.from)!==JSON.stringify(s.to))cameras.push({startFrame:s.s,endFrame:s.e-1,easing:'LINEAR',purpose:'Follow the narrated mechanism: '+s.label,cameraId:'CAM_STATIC_001',behavior:'MOVE',startState:s.from,endState:s.to});});
const initialProps=Object.fromEntries(subjects.filter(s=>s.kind==='PROP').map(s=>[s.id,{position:states[s.id].position,rotation:states[s.id].rotation,scale:states[s.id].scale,visible:states[s.id].visible,parameters:palettes[s.id]===undefined?{}:{palette:palettes[s.id]}}]));
const initial={actors:{},props:initialProps,camera:shots[0].from};
const direction:DirectedSequence={version:1,id:'aircraft-lift-production',fps,width:1080,height:1920,totalFrames:total,baseShot:{id:'aircraft-world',durationSeconds:total/fps,environment:{resourceId:'ENV_OCEAN_001'},characters:[],props:subjects.filter(s=>s.kind==='PROP').map(s=>({instanceId:s.id,resourceId:s.resourceId!,parameters:initialProps[s.id].parameters})),actions:[],vfx:[],camera:{resourceId:'CAM_STATIC_001'}},initialState:initial,finalState:initial,blocking:[],actionSegments:[],cameraSegments:cameras,focusSegments:[],propMotions:[],shots:shots.map((s,i)=>({id:'shot_'+(i+1),startFrame:s.s,endFrame:s.e,transition:i?'CUT':'CONTINUE',onScreenText:s.label})),captions:timing.flatMap((t,i)=>captions(sentences[i].text,t.startFrame,t.endFrame-t.startFrame))};
const {compilerVersion,...raw}=program;const authored:VisualDemonstration={...raw,direction};
// A compact tabletop scene stays in front of the existing environment's fog plane.
// Uniform scaling preserves projected geometry, angles, force equality and all attachments.
const layoutScale=.32,scaled=(v:Vec3)=>v.map(n=>n*layoutScale) as Vec3;
for(const sub of subjects){const st=states[sub.id];if(!sub.parentId){st.position=scaled(st.position);st.scale=scaled(st.scale);}}
for(const st of program.steps)if(st.target==='aircraft'&&st.operation==='MOVE'){st.parameters.from=scaled(st.parameters.from as Vec3);st.parameters.to=scaled(st.parameters.to as Vec3);}
for(const cam of new Set([direction.initialState.camera,...cameras.flatMap(c=>[c.startState,c.endState])])){cam.position=scaled(cam.position);cam.target=scaled(cam.target);}
// Repeated camera objects are shared by adjacent cuts; scale each pose exactly once.
for(const [id,st]of Object.entries(states))if(initialProps[id])Object.assign(initialProps[id],{position:st.position,scale:st.scale});
program.finalState=evaluateDemonstration(program,total);authored.finalState=program.finalState;
const {sequence:seq,fingerprint}=compileDemonstration(authored);
let maxVisible=0,maxActive=0,maxVerticalFlightError=0,maxForceDirectionError=0;
for(let f=0;f<=total;f++){const st=evaluateDemonstration(program,f);maxVisible=Math.max(maxVisible,Object.values(st.subjects).filter(s=>s.visible).length);maxActive=Math.max(maxActive,program.steps.filter(s=>f>=s.startFrame&&f<s.endFrame).length);maxVerticalFlightError=Math.max(maxVerticalFlightError,Math.abs(st.subjects.aircraft.position[1]-4*layoutScale));maxForceDirectionError=Math.max(maxForceDirectionError,Math.abs(st.subjects.lift.rotation[2]),Math.abs(st.subjects.weight.rotation[2]-Math.PI));}
if(maxVisible>8||maxActive>4||maxVerticalFlightError>1e-8||maxForceDirectionError>1e-8)throw Error('PRODUCTION_QA');
const qa={passed:true,authorship:'EXPLICIT_EDITORIAL_JSON_STORYBOARD',duration:total/fps,shots:shots.length,maxVisible,maxActive,maxVerticalFlightError,maxForceDirectionError,liftGlyphLength:1.6,weightGlyphLength:1.6,scriptSha256:sha,fingerprint,resourcesAdded:['PROP_AIRCRAFT_001','PROP_AIRFOIL_001','PROP_VECTOR_ARROW_001'],limitations:['Schematic geometry and air paths, not CFD or calibrated forces','Both wing surfaces participate; no equal-transit-time claim','Pressure glyphs are illustrative resultant contributions, not sampled pressure data','Sentence-based estimated caption timing','No claim of fully automatic visual planning or subjective listening']};
save('demonstration.json',authored);save('directed-sequence.json',seq);save('tracks.json',tracks);save('timing.json',timing);save('roteiro.txt',script);save('production-qa.json',qa);
const mode=process.argv[2]??'prepare';
if(mode==='preview'){const dir=root+'/'+(process.argv[3]??'preview'),frames=process.argv[4]?process.argv[4].split(',').map(Number):shots.map(s=>Math.floor((s.s+s.e)/2)),files=await renderStills({...seq,width:480,height:854},frames,dir);await contactSheet(files,dir+'/contact-sheet.png',4);console.log(JSON.stringify({dir,...qa}));}
else if(mode==='render'){const guard=installNetworkGuard();try{const output=root+'/master.mp4';if(existsSync(output))throw Error('MASTER_EXISTS: preserve before another render');const render=await renderMp4(seq,tracks,timing,output,{title:'Por que o avião consegue voar mesmo sendo tão pesado?',comment:'ClonAI; source-grounded editorial schematic; script='+sha});const media=await validateMp4(output,seq);save('media.json',{...media,render,externalInProcessCalls:guard.counters.external});if(!media.passed)throw Error(media.issues.join(','));console.log(JSON.stringify({qa,media}));}finally{guard.restore();}}
else console.log(JSON.stringify(qa));
