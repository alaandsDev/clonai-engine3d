/** Production operator: an explicitly authored JSON storyboard, not topic logic in the engine.
 * Reuses the established compiler, assemblies, narration, renderer and media validation.
 * Automatic Script Mode artifacts are retained separately with their real coverage (16.7%). */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {jsonHash} from '../../src/editorial/fingerprint';
import {VISUAL_CAUSAL_VERSION,type VisualCausalPlan,type WorldEntity,type CausalVisualBeat} from '../../src/visual-causal/contracts';
import {compileVisualPlan} from '../../src/visual-causal/compile';
import {validateVisualPlan} from '../../src/visual-causal/verify';
import {fitFocus} from '../../src/visual-causal/cinematic';
import {evaluateDirected,validateDirected,type CameraState,type CameraSegment} from '../../src/engine3d/directed';
import {evaluateDemonstration} from '../../src/engine3d/demonstration-runtime';
import type {Vec3} from '../../src/engine3d/contracts';
import {renderStills,contactSheet,renderMp4,validateMp4,type VoiceTrack} from '../../src/visual-causal/media';
import {installNetworkGuard} from '../../src/script-mode/generate';

const root='out/engine3d/production/elevador',automatic=root+'/automatic',load=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const input=load(automatic+'/planner-input.json'),tracks:VoiceTrack[]=load(automatic+'/tracks.json');
const script=readFileSync('roteiro-elevador.txt','utf8'),sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
const sentences=input.sentences as {id:string;text:string}[],timing=input.timing as {sentenceId:string;startFrame:number;endFrame:number}[];
const fps=input.fps,total=input.totalFrames,worldId='elevador-editorial-world';
const save=(name:string,value:unknown)=>{mkdirSync(root,{recursive:true});writeFileSync(root+'/'+name,typeof value==='string'?value:JSON.stringify(value,null,2),'utf8');};
const windowFor=(n:number)=>timing[n-1];
const make=(id:string,assembly:WorldEntity['assembly'],size:Vec3,position:Vec3,color:string,extra:Partial<WorldEntity>={}):WorldEntity=>({entityId:id,worldId,role:id==='shaft'?'MAIN_SYSTEM':'SYSTEM_COMPONENT',grounding:'FACTUAL',abstraction:'ABSTRACT_SYSTEM_REPRESENTATION',kind:'BOX',relationIds:['script-position'],participant:id,label:null,size,position,rotation:[0,0,0],color,initiallyVisible:true,...(assembly?{assembly}:{}),...extra});
const entities:WorldEntity[]=[
 make('shaft','FRAME_PANEL',[1.9,5.6,.16],[0,2.8,-.44],'#8fa3ae'),
 make('car','CARRIAGE',[1.2,1.2,.8],[0,1.55,.18],'#e0a93f'),
 make('cable',undefined,[.035,3.65,.035],[0,3.975,.05],'#344c5a'),
 make('landing','PANEL',[1.15,.12,.95],[1.225,2.74,.18],'#b5c7d0'),
 make('sensor',undefined,[.18,.16,.16],[.7,.55,0],'#20c1ef',{parentId:'car'}),
 make('reference',undefined,[.22,.18,.18],[.95,3.95,.18],'#77dc99'),
 make('controller','DISPLAY_BLOCK',[.60,.7,.35],[1.9,1.05,.18],'#398de8'),
 make('encoder','PEG',[.7,.35,.7],[.35,5.82,.05],'#98a8b4',{kind:'CYLINDER',rotation:[Math.PI/2,0,0]}),
 make('index',undefined,[.17,.035,.035],[.13,.19,0],'#f6c34a',{parentId:'encoder',initiallyVisible:false}),
 make('tape','PANEL',[.12,5.45,.055],[.95,2.9,.15],'#77dc99',{initiallyVisible:false}),
];
const zone:CameraState={position:[2,4.2,13],target:[0,2.65,0]};
const relationIds=['script-position','script-control','script-encoder','script-reference','script-leveling','script-alternative'];
const beats:CausalVisualBeat[]=timing.map((t,i)=>({id:'beat_'+(i+1),order:i,sentenceId:t.sentenceId,storyNodeIds:[],relationIds:[relationIds[Math.min(5,Math.floor(i/2))]],evidenceIds:[],grounding:'FACTUAL_DEMONSTRATION',visualIntent:sentences[i].text,presenterIntent:i===0?'ESTABLISH_CONTEXT':i===11?'FINAL_PAYOFF':'NONE',presenterVisible:i===0||i===11,cameraZone:i===0||i===11?'WORLD':'SYSTEM',cameraMotivation:'Author-directed illustration of the narrated mechanism',focusEntityId:'shaft',label:null,operations:[],transitionIds:[],proof:{level:'SYMBOLIC',rationale:'Editorial schematic based on cited manufacturer documentation; geometry is illustrative, not a calibrated controller simulation.'},startFrame:t.startFrame,endFrame:t.endFrame,timing:'SENTENCE_BOUNDARY'}));
// Keep cross-sentence travel as ONE operation. Voice boundaries do not restart the motion.
const travelStart=windowFor(4).startFrame,slowStart=windowFor(8).startFrame,levelStart=windowFor(9).startFrame,aligned=levelStart+90;
const stages=[{s:travelStart,e:slowStart,a:1.55,b:3.16,easing:'LINEAR'},{s:slowStart,e:levelStart,a:3.16,b:3.35,easing:'EASE_OUT'},{s:levelStart,e:aligned,a:3.35,b:3.4,easing:'EASE_IN_OUT'}] as const;
const raw={version:VISUAL_CAUSAL_VERSION,topic:'Como um elevador sabe exatamente em qual andar parar?',worldId,scriptFingerprint:sha(script),storyFingerprint:jsonHash(sentences),relationsFingerprint:jsonHash(relationIds),world:{worldId,template:'ENCLOSURE' as const,environmentId:'ENV_LAB_001',presenter:{entityId:'presenter',resourceId:'CHAR_CAIO_001',home:[-1.7,0,.3] as Vec3,facing:.55,scale:.66},cutaway:{kind:'NONE' as const,openAmount:0,revealsEntityIds:[]},cameraZones:{WORLD:zone,SYSTEM:zone,CUTAWAY:zone,COMPONENT:zone,ACTION:zone,RESULT:zone},entities,maxSimultaneousVisible:8},beats,transitions:[],gaps:[],fps,totalFrames:total};
const plan:VisualCausalPlan={...raw,fingerprint:jsonHash(raw)};
const admissible=validateVisualPlan(plan,relationIds);if(!admissible.valid)throw Error(admissible.issues.join(','));
const seq=compileVisualPlan(plan,{sentences:timing.map((t,i)=>({id:t.sentenceId,text:sentences[i].text,startFrame:t.startFrame,endFrame:t.endFrame})),width:1080,height:1920});
const program=seq.demonstration!;
program.purpose='Source-grounded authored schematic; distances, speeds and hardware shapes are editorial. No claim of an automatic planning pass.';
program.steps=[];
for(const g of stages){
 const rope=(y:number)=>(5.8-(y+.6)),mid=(y:number)=>(5.8+y+.6)/2;
 const step=(operation:'MOVE'|'SCALE'|'ROTATE',target:string,from:Vec3,to:Vec3)=>program.steps.push({startFrame:g.s,endFrame:g.e,operation,target,parameters:{from,to},easing:g.easing,purpose:'Continuous approach and final alignment; illustration of position-controlled travel'});
 step('MOVE','car',[0,g.a,.18],[0,g.b,.18]);
 step('MOVE','cable',[0,mid(g.a),.05],[0,mid(g.b),.05]);
 step('SCALE','cable',[1,rope(g.a)/3.65,1],[1,rope(g.b)/3.65,1]);
 step('ROTATE','encoder',[Math.PI/2,-(g.a-1.55)*7,0],[Math.PI/2,-(g.b-1.55)*7,0]);
}
const effect=(s:number,e:number,operation:'HIGHLIGHT'|'HIDE'|'APPEAR',target:string)=>program.steps.push({startFrame:s,endFrame:e,operation,target,parameters:operation==='HIGHLIGHT'?{amount:.22}:{},easing:'LINEAR',purpose:operation==='HIGHLIGHT'?'Emphasize the narrated component':'Separate alternative hardware examples; no implication that every model uses both'});
effect(windowFor(2).startFrame+4,windowFor(3).endFrame-3,'HIGHLIGHT','controller');
effect(travelStart-7,travelStart-5,'HIDE','controller');
effect(travelStart-3,travelStart-1,'APPEAR','index');
effect(aligned+1,windowFor(9).endFrame-4,'HIGHLIGHT','reference');
effect(windowFor(10).startFrame,windowFor(10).startFrame+3,'HIDE','reference');
effect(windowFor(11).startFrame,windowFor(11).startFrame+2,'APPEAR','tape');
effect(windowFor(12).startFrame,windowFor(12).startFrame+2,'HIDE','tape');
effect(windowFor(12).startFrame,windowFor(12).startFrame+2,'HIDE','index');
effect(windowFor(12).startFrame+3,windowFor(12).startFrame+4,'APPEAR','controller');
effect(windowFor(12).startFrame+3,windowFor(12).startFrame+4,'APPEAR','reference');
program.steps.sort((a,b)=>a.startFrame-b.startFrame||a.target.localeCompare(b.target));
program.finalState=evaluateDemonstration(program,total);
seq.initialState.demonstration=program.initialState;
// Camera poses use the same existing fitFocus, with an explicit authored framing for the two floor edges.
const box=(lo:Vec3,hi:Vec3)=>Array.from({length:8},(_,i)=>[i&1?hi[0]:lo[0],i&2?hi[1]:lo[1],i&4?hi[2]:lo[2]] as Vec3);
const fit=(lo:Vec3,hi:Vec3,direction:Vec3=[.2,.12,1],margin=1.3)=>fitFocus(box(lo,hi),direction,2.1,margin);
const world=fit([-2.1,0,-.5],[2.3,6.3,.8],[.12,.10,1],1.16);
const control=fit([1.45,.6,-.1],[2.3,1.55,.7],[.25,.22,1],1.35);
const encoder=fit([-.2,5.28,-.2],[.9,6.25,.5],[.2,.10,1],1.35);
const carView=(f:number)=>{const y=evaluateDemonstration(program,f).subjects.car.position[1];return fit([-.82,y-.8,-.35],[1.2,y+.85,.8],[.22,.12,1],1.25);};
const sensorView=(f:number)=>{const y=evaluateDemonstration(program,f).subjects.sensor.position[1];return fit([.22,y-.45,-.15],[1.3,Math.max(4.12,y+.3),.7],[.20,.10,1],1.25);};
const floorView=fit([-.72,2.45,-.15],[1.85,3.6,.8],[.16,.08,1],1.3);
const macroFloor=fit([.05,2.48,-.1],[1.65,3.15,.75],[.10,.06,1],1.4);
const tapeView=fit([.38,2.05,-.15],[1.25,5.25,.6],[.18,.10,1],1.3);
const shotDefs=[
 {s:0,e:windowFor(1).endFrame,label:'COMO ELE PARA NO ANDAR CERTO?',from:world,to:world},
 {s:windowFor(2).startFrame,e:windowFor(3).endFrame,label:'1 · DESTINO',from:control,to:control},
 {s:travelStart,e:windowFor(4).endFrame,label:'A CABINE PRECISA SER LOCALIZADA',from:carView(travelStart),to:carView(windowFor(4).endFrame)},
 {s:windowFor(5).startFrame,e:windowFor(5).endFrame,label:'2 · MOTOR + ENCODER',from:encoder,to:encoder},
 {s:windowFor(6).startFrame,e:windowFor(6).endFrame,label:'DESLOCAMENTO + VELOCIDADE',from:carView(windowFor(6).startFrame),to:carView(windowFor(6).endFrame)},
 {s:windowFor(7).startFrame,e:windowFor(7).endFrame,label:'SENSOR + REFERÊNCIA DO ANDAR',from:sensorView(windowFor(7).startFrame),to:sensorView(windowFor(7).endFrame)},
 {s:slowStart,e:levelStart,label:'3 · DESACELERAÇÃO',from:carView(slowStart),to:carView(levelStart)},
 {s:levelStart,e:aligned,label:'NIVELAMENTO',from:floorView,to:floorView},
 {s:aligned,e:windowFor(9).endFrame,label:'PISOS ALINHADOS',from:macroFloor,to:macroFloor},
 {s:windowFor(10).startFrame,e:windowFor(10).endFrame,label:'O SISTEMA VARIA ENTRE MODELOS',from:carView(levelStart),to:carView(levelStart)},
 {s:windowFor(11).startFrame,e:windowFor(11).endFrame,label:'OUTRA SOLUÇÃO: FITA CODIFICADA',from:tapeView,to:tapeView},
 {s:windowFor(12).startFrame,e:windowFor(12).startFrame+65,label:'DESTINO',from:control,to:control},
 {s:windowFor(12).startFrame+65,e:windowFor(12).startFrame+125,label:'POSIÇÃO',from:sensorView(total),to:sensorView(total)},
 {s:windowFor(12).startFrame+125,e:total,label:'CONTROLE DO MOVIMENTO',from:world,to:world},
];
const cameras:CameraSegment[]=[];
for(let i=0;i<shotDefs.length;i++){const x=shotDefs[i];if(i)cameras.push({startFrame:x.s-1,endFrame:x.s,easing:'LINEAR',purpose:'Motivated editorial cut: '+x.label,cameraId:'CAM_STATIC_001',behavior:'MOVE',startState:shotDefs[i-1].to,endState:x.from});
 if(jsonHash(x.from)!==jsonHash(x.to))cameras.push({startFrame:x.s,endFrame:x.e-1,easing:'LINEAR',purpose:'Follow cabin/attached sensor through the continuous trip: '+x.label,cameraId:'CAM_STATIC_001',behavior:'MOVE',startState:x.from,endState:x.to});
}
seq.initialState.camera=world;seq.cameraSegments=cameras;seq.focusSegments=[];
seq.shots=shotDefs.map((x,i)=>({id:'shot_'+(i+1),startFrame:x.s,endFrame:x.e,transition:i?'CUT':'CONTINUE',onScreenText:x.label}));
// The presenter returns only for the final wide shot, not over the controller/sensor inserts.
program.presenterModes=[{startFrame:0,endFrame:windowFor(1).endFrame,mode:'HYBRID'},{startFrame:windowFor(1).endFrame,endFrame:shotDefs.at(-1)!.s,mode:'DEMONSTRATION'},{startFrame:shotDefs.at(-1)!.s,endFrame:total,mode:'HYBRID'}];
program.initialState.presenterMode='HYBRID';program.finalState=evaluateDemonstration(program,total);
seq.finalState=evaluateDirected(seq,total).state;
validateDirected(seq);
// Fail before rendering on attachment drift, cable detachment, budget or final leveling error.
let maxAttachmentError=0,maxCableError=0,maxVisible=0,maxActive=0;
for(let f=0;f<=total;f++){const st=evaluateDemonstration(program,f),car=st.subjects.car,sensor=st.subjects.sensor,cable=st.subjects.cable;maxAttachmentError=Math.max(maxAttachmentError,Math.hypot(sensor.position[0]-car.position[0]-.7,sensor.position[1]-car.position[1]-.55,sensor.position[2]-car.position[2]));maxCableError=Math.max(maxCableError,Math.abs(cable.position[1]+3.65*cable.scale[1]/2-5.8),Math.abs(cable.position[1]-3.65*cable.scale[1]/2-(car.position[1]+.6)));maxVisible=Math.max(maxVisible,Object.values(st.subjects).filter(x=>x.visible).length);maxActive=Math.max(maxActive,program.steps.filter(x=>f>=x.startFrame&&f<x.endFrame).length);}
const final=evaluateDemonstration(program,total),levelError=Math.abs((final.subjects.car.position[1]-.6)-(final.subjects.landing.position[1]+.06));
if(maxAttachmentError>1e-8||maxCableError>1e-8||levelError>1e-8||maxVisible>8||maxActive>4)throw Error('PRODUCTION_GEOMETRY_QA');
const qa={passed:true,maxAttachmentError,maxCableError,levelError,maxVisible,maxActive,duration:total/fps,width:seq.width,height:seq.height,shots:seq.shots.length,voice:tracks[0].voiceRate,scriptSha256:sha(script),authorship:'EXPLICIT_EDITORIAL_JSON_STORYBOARD',automaticCoveragePercent:16.7,sourceGrounding:'Manufacturer documentation; see fontes.md. No engine EvidencePack or automatic extraction success is fabricated.',limitations:['Schematic hardware, not a manufacturer model','Distances and time are editorial; not an engineering simulation','Motor/encoder represented by an existing shaft/cap assembly with an attached index','Caption timings are sentence-based estimates, not forced alignment']};
save('roteiro.txt',script);save('storyboard.json',plan);save('directed-sequence.json',seq);save('tracks.json',tracks);save('timing.json',timing);save('production-qa.json',qa);
const mode=process.argv[2]??'prepare';
if(mode==='preview'){const preview={...seq,width:480,height:854},frames=shotDefs.map(x=>Math.min(total-1,Math.floor((x.s+x.e)/2)));const files=await renderStills(preview,frames,root+'/preview');await contactSheet(files,root+'/preview/contact-sheet.png',4);console.log(JSON.stringify({preview:root+'/preview/contact-sheet.png',...qa}));}
else if(mode==='render'){const guard=installNetworkGuard();try{const dest=root+'/como-o-elevador-para.mp4';if(existsSync(dest))throw Error('MASTER_ALREADY_EXISTS: preserve the existing master before another render');const result=await renderMp4(seq,tracks,timing,dest,{title:plan.topic,comment:'ClonAI; source-grounded editorial schematic; script='+sha(script)});const media=await validateMp4(dest,seq);save('media.json',{...media,render:result,externalInProcessCalls:guard.counters.external});if(!media.passed)throw Error(media.issues.join(','));console.log(JSON.stringify({...qa,media}));}finally{guard.restore();}}
else console.log(JSON.stringify(qa));
