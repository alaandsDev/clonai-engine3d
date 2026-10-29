import {readFileSync,writeFileSync} from 'node:fs';
const edit=(f,pairs)=>{let s=readFileSync(f,'utf8');for(const [a,b] of pairs){if(s.split(a).length!==2)throw Error('anchor '+f+': '+a.slice(0,70));s=s.replace(a,b);}writeFileSync(f,s);};
edit('src/visual-causal/contracts.ts',[[`size:Vec3;position:Vec3;rotation:Vec3;path?:Vec3[];color:string;initiallyVisible:boolean;
}`,`size:Vec3;position:Vec3;rotation:Vec3;path?:Vec3[];color:string;initiallyVisible:boolean;
 /** Generic stylized assembly used to draw the entity (editorial geometry; never a fact). */
 assembly?:Assembly;
}`]]);
let c=readFileSync('src/visual-causal/contracts.ts','utf8');if(!c.includes("import type {Assembly}")){c="import type {Assembly} from '../engine3d/demonstration-contracts';\n"+c;writeFileSync('src/visual-causal/contracts.ts',c);}
edit('src/engine3d/demonstration-contracts.ts',[[`TERRAIN_SECTION: 30, LIQUID_VOLUME: 12, PIPE: 14,`,`TERRAIN_SECTION: 22, LIQUID_VOLUME: 14, PIPE: 12,`]]);
edit('src/visual-causal/planner.ts',[
 [` TERRAIN_SUBSURFACE:{WORLD:cam([0.45,2.9,10.8],[0.4,0.85,0]),SYSTEM:cam([-0.45,1.75,7.2],[-0.45,1.15,0]),CUTAWAY:cam([0.15,0.7,7.6],[0,-1.6,-0.4]),COMPONENT:cam([0.15,-0.9,5.4],[0,-2.9,-0.5]),ACTION:cam([0.15,-0.5,6.6],[0,-1.9,-0.4]),RESULT:cam([1.0,1.4,5.6],[1.0,0.45,0])},`,
  ` // Three-quarter views: depth comes from the oblique angle, the section is read from the front.
 TERRAIN_SUBSURFACE:{WORLD:cam([-1.9,2.7,10.2],[0.45,0.7,-0.5]),SYSTEM:cam([-1.2,1.55,5.6],[-0.35,0.75,0]),CUTAWAY:cam([1.4,0.6,6.4],[0,-1.9,-0.3]),COMPONENT:cam([0.9,-2.2,4.6],[0,-3.4,-0.4]),ACTION:cam([1.0,-1.4,5.8],[0,-2.0,-0.4]),RESULT:cam([-0.6,1.7,5.2],[1.2,0.45,-0.7])},`],
 [`  add({entityId:'ground_layer',role:'CUTAWAY_LAYER',grounding:'EDITORIAL',abstraction:'EDITORIAL_DECORATION',kind:'LAYER',layer:'subsurface',relationIds:[],participant:null,label:null,size:[4.4,2.3,0.8],position:[0,-1.3,-0.75],color:'#8a5a3b',initiallyVisible:false});
  add({entityId:'medium',role:'MEDIUM',grounding:'FACTUAL',abstraction:'ABSTRACT_SYSTEM_REPRESENTATION',kind:'LAYER',layer:'deep',relationIds:[r.medium!.id],participant:r.medium!.subject,label:participantLabel(r.medium!.subject),size:[4.4,2.6,0.8],position:[0,-3.75,-0.75],color:'#2f86d1',initiallyVisible:false});`,
  `  // Solid ground block whose top is flush with the floor; its front notch opens as the section view.
  add({entityId:'ground_layer',role:'CUTAWAY_LAYER',grounding:'EDITORIAL',abstraction:'EDITORIAL_DECORATION',kind:'LAYER',layer:'subsurface',assembly:'TERRAIN_SECTION',relationIds:[],participant:null,label:null,size:[8,5,6],position:[0,-2.595,0],color:'#8a5a3b',initiallyVisible:true});
  add({entityId:'medium',role:'MEDIUM',grounding:'FACTUAL',abstraction:'ABSTRACT_SYSTEM_REPRESENTATION',kind:'LAYER',layer:'deep',assembly:'LIQUID_VOLUME',relationIds:[r.medium!.id],participant:r.medium!.subject,label:participantLabel(r.medium!.subject),size:[8,1.1,6],position:[0,-3.5,0],color:'#2f86d1',initiallyVisible:false});`],
 [`kind:'PATH',relationIds:[...r.systemRelations,r.medium!.id],participant:r.system,label:sysLabel,size:[0.24,0.24,0.24]`,`kind:'PATH',assembly:'PIPE',relationIds:[...r.systemRelations,r.medium!.id],participant:r.system,label:sysLabel,size:[0.2,0.2,0.2]`],
 [`kind:'CYLINDER',relationIds:[...r.systemRelations],participant:r.system,label:sysLabel,size:[0.8,0.7,0.8]`,`kind:'CYLINDER',assembly:'OPEN_BASIN',relationIds:[...r.systemRelations],participant:r.system,label:sysLabel,size:[0.8,0.7,0.8]`],
 [`  revealed=['ground_layer','medium'];cutaway={kind:'GROUND_TRENCH',openAmount:0.4,revealsEntityIds:revealed};`,`  revealed=['medium'];cutaway={kind:'GROUND_TRENCH',openAmount:1,revealsEntityIds:revealed};`],
 [`kind:'BOX',relationIds:[c.id],participant:c.object,label:participantLabel(c.object),size:[1.9,4.4,0.16]`,`kind:'BOX',assembly:'FRAME_PANEL',relationIds:[c.id],participant:c.object,label:participantLabel(c.object),size:[1.9,4.4,0.16]`],
 [`kind:'BOX',relationIds:[],participant:null,label:null,size:[1.9,4.4,0.16]`,`kind:'BOX',assembly:'PANEL',relationIds:[],participant:null,label:null,size:[1.9,4.4,0.16]`],
 [`kind:'BOX',relationIds:[c.id],participant:c.subject,label:participantLabel(c.subject),size:[1.2,1.1,0.9]`,`kind:'BOX',assembly:'CARRIAGE',relationIds:[c.id],participant:c.subject,label:participantLabel(c.subject),size:[1.2,1.1,0.9]`],
 [`kind:'BOX',relationIds:[c.id],participant:c.subject,label:participantLabel(c.subject),size:[0.7,0.6,0.5]`,`kind:'BOX',assembly:'DISPLAY_BLOCK',relationIds:[c.id],participant:c.subject,label:participantLabel(c.subject),size:[0.7,0.6,0.5]`],
 [`8-entities.length-(r.conduit&&template==='TERRAIN_SUBSURFACE'?3:0)`,`8-entities.length-(r.conduit&&template==='TERRAIN_SUBSURFACE'?2:0)`],
 [`kind:'PATH',relationIds:[r.conduit.id],participant:r.conduit.object,`,`kind:'PATH',assembly:'PIPE',relationIds:[r.conduit.id],participant:r.conduit.object,`],
 [`size:[0.1,0.1,0.1],position:[0,0,0],path:[[0.42,0.16,0],[1.38,0.16,0]],color:'#5c6f7c',initiallyVisible:true});
  if(r.consumer){
   add({entityId:'consumer_body',role:'CONTEXT_PROP',grounding:'EDITORIAL',abstraction:'EDITORIAL_CONTEXT_FROM_SENTENCE',kind:'BOX',relationIds:[],participant:null,label:null,size:[1.1,0.95,1.0],position:[1.95,0.48,-0.3],color:'#e9d8b8',initiallyVisible:true});
   add({entityId:'consumer_roof',role:'CONTEXT_PROP',grounding:'EDITORIAL',abstraction:'EDITORIAL_CONTEXT_FROM_SENTENCE',kind:'BOX',relationIds:[],participant:null,label:null,size:[0.84,0.84,1.15],position:[1.95,0.96,-0.3],rotation:[0,0,Math.PI/4],color:'#c4483d',initiallyVisible:true});
  }`,`size:[0.1,0.1,0.1],position:[0,0,0],path:r.consumer?[[0.42,0.16,0],[1.55,0.16,0],[2.1,0.16,-1.15]]:[[0.42,0.16,0],[1.38,0.16,0]],color:'#5c6f7c',initiallyVisible:true});
  if(r.consumer)add({entityId:'consumer_body',role:'CONTEXT_PROP',grounding:'EDITORIAL',abstraction:'EDITORIAL_CONTEXT_FROM_SENTENCE',kind:'BOX',assembly:'GABLED_BUILDING',relationIds:[],participant:null,label:null,size:[1.3,1.5,1.1],position:[2.1,0.75,-1.7],color:'#e9d8b8',initiallyVisible:true});`],
 [`home:template==='ENCLOSURE'?[-1.6,0,0.9]:[-1.25,0,0.55]`,`home:template==='ENCLOSURE'?[-1.6,0,0.9]:[-1.45,0,0.9]`]]);
edit('src/visual-causal/compile.ts',[[`...(e.layer?{layer:e.layer}:{})})),`,`...(e.layer?{layer:e.layer}:{}),...(e.assembly?{assembly:e.assembly}:{})})),`]]);
edit('src/engine3d/library.tsx',[
 [`      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, 12-(state?.fogIntensity??0)*8, 28-(state?.fogIntensity??0)*18]} />`,`      <color attach="background" args={[style?'#e3efe9':bg]} />
      <fog attach="fog" args={[style?'#e3efe9':bg, (style?18:12)-(state?.fogIntensity??0)*8, (style?60:28)-(state?.fogIntensity??0)*18]} />`],
 [`ground={'#'+new Color(PALETTE.GRASS).multiply(`,`ground={'#'+new Color(forest?PALETTE.GRASS:baseGround).multiply(`]]);
