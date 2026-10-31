import {jsonHash} from '../editorial/fingerprint';
import {normalize} from '../semantics/normalize';
import {topicSubject} from '../topic/subject';
import type {Vec3} from '../engine3d/contracts';
import type {CameraState} from '../engine3d/directed';
import {VISUAL_CAUSAL_VERSION} from './contracts';
import {planScriptWorld} from './script-world';
import {withHybridEditorial} from './editorial-grammar';
import type {BeatOperation,CameraZone,CausalVisualBeat,PersistentWorld,PlannerInput,PlannerRelation,PresenterIntent,VisualCausalPlan,VisualGap,VisualStateTransition,WorldEntity,WorldTemplate} from './contracts';
/** Closed generic cue tables (spatial language, not topic nouns). */
const SUBSURFACE=/subterr|subsolo|aquifer|lencol|freatic|underground|groundwater|subsurface/;
const SURFACE=/superficie|surface|para cima|ao topo|to the top|upward/;
const CONDUIT=/\b(?:canos?|tubos?|tubulac|dutos?|condutos?|canais|canal|pipes?|tubes?|ducts?|conduits?)\b/;
const CONSUMER=/residenc|domestic|resident|household|moradia|\bcasas?\b|\bhomes?\b/;
const FLOWING=new Set(['FLOW','RISE','ENTER','EXIT','PASSES_THROUGH','COLLECT','DESCEND']);
const CONTAINMENT=new Set(['MOVE_WITHIN','LOCATED_IN','PASSES_THROUGH']);
const PURPOSE=new Set(['USED_FOR','DESIGNED_FOR','REQUIRES','HAS_GOAL','ENABLES']);
const fold=(s:string)=>normalize(s).replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
const ARTICLE=/^(?:o|a|os|as|um|uma|uns|umas|the|an|a)\s+/;
/** Short on-screen label from a grounded participant: its own words, cut before a clause/qualifier. */
export function participantLabel(text:string){
 const words=fold(text).replace(ARTICLE,'').split(' ');const out:string[]=[];
 for(const w of words){if(out.length>=2&&/^(?:entre|que|onde|cujo|cuja|ou|e|para|com|sem|em|no|na|por|pela|pelo|ate|from|that|which|with|into|to)$/.test(w))break;out.push(w);if(out.length>=4)break;}
 while(out.length&&/^(?:de|do|da|dos|das|of)$/.test(out[out.length-1]))out.pop();
 const raw=text.replace(/^\s*(?:o|a|os|as|um|uma|the|an)\s+/i,'').split(/\s+/).slice(0,out.length).join(' ').replace(/[,;:(].*$/,'');
 return raw||null;
}
const id=(prefix:string,x:unknown)=>prefix+'_'+jsonHash(x).slice(0,12);
const cam=(position:Vec3,target:Vec3):CameraState=>({position,target});
/** Editorial layouts per template: positions are staging, never facts. */
const ZONES:Record<WorldTemplate,Record<CameraZone,CameraState>>={
 // Sized from the 44° vertical FOV at 9:16 (horizontal half-width ≈ 0.227 × distance).
 // Three-quarter views: depth comes from the oblique angle, the section is read from the front.
 TERRAIN_SUBSURFACE:{WORLD:cam([-3.4,2.0,7.4],[0.3,1.05,-0.6]),SYSTEM:cam([0.4,1.45,5.7],[-0.62,0.95,-0.1]),CUTAWAY:cam([1.6,1.6,8.4],[-0.2,-1.4,-0.3]),COMPONENT:cam([1.0,-2.3,5.0],[0,-3.4,-0.4]),ACTION:cam([1.0,-1.4,6.0],[0,-2.0,-0.4]),RESULT:cam([-1.0,1.9,6.3],[1.0,0.5,-0.7])},
 ENCLOSURE:{WORLD:cam([0.6,3.4,12.6],[0.3,2.1,0]),SYSTEM:cam([-0.4,2.3,8.6],[-0.5,1.8,0]),CUTAWAY:cam([0.3,2.4,6.6],[0,2.0,-0.2]),COMPONENT:cam([0.3,2.0,5.0],[0,1.8,-0.2]),ACTION:cam([0.4,2.4,6.4],[0,2.0,-0.2]),RESULT:cam([1.4,2.6,7.4],[0.9,2.0,0])},
 OPEN_STAGE:{WORLD:cam([0.8,2.6,9.0],[0.3,1.0,0]),SYSTEM:cam([0.3,1.6,5.4],[0,0.9,0]),CUTAWAY:cam([0.2,1.4,5.0],[0,0.8,0]),COMPONENT:cam([0.3,1.2,4.2],[0.2,0.8,0]),ACTION:cam([0.3,1.4,5.0],[0.2,0.8,0]),RESULT:cam([1.0,1.6,5.6],[0.8,0.8,0])},
 // Script Mode computes its zones from the layout (script-world.ts); this entry is only a type default.
 MECHANISM_STAGE:{WORLD:cam([0.8,2.6,9.0],[0.3,1.0,0]),SYSTEM:cam([0.3,1.6,5.4],[0,0.9,0]),CUTAWAY:cam([0.2,1.4,5.0],[0,0.8,0]),COMPONENT:cam([0.3,1.2,4.2],[0.2,0.8,0]),ACTION:cam([0.3,1.4,5.0],[0.2,0.8,0]),RESULT:cam([1.0,1.6,5.6],[0.8,0.8,0])},
 MOTION_STAGE:{WORLD:cam([0.8,2.6,9.0],[0.3,1.0,0]),SYSTEM:cam([0.3,1.6,5.4],[0,0.9,0]),CUTAWAY:cam([0.2,1.4,5.0],[0,0.8,0]),COMPONENT:cam([0.3,1.2,4.2],[0.2,0.8,0]),ACTION:cam([0.3,1.4,5.0],[0.2,0.8,0]),RESULT:cam([1.0,1.6,5.6],[0.8,0.8,0])},
};
const ENV:Record<WorldTemplate,string>={TERRAIN_SUBSURFACE:'ENV_FOREST_001',ENCLOSURE:'ENV_CITY_001',OPEN_STAGE:'ENV_LAB_001',MECHANISM_STAGE:'ENV_FOREST_001',MOTION_STAGE:'ENV_FOREST_001'};
interface Roles {system:string|null;systemRelations:string[];medium:PlannerRelation|null;conduit:PlannerRelation|null;consumer:boolean;containment:PlannerRelation|null;components:PlannerRelation[]}
function roles(input:PlannerInput):Roles{
 const subject=fold(topicSubject(input.topic)),rels=input.relations;
 const isSystem=(s:string)=>{const f=fold(s).replace(ARTICLE,'');return Boolean(subject)&&(f===subject||f.includes(subject)||subject.includes(f));};
 const sysDef=rels.find(r=>r.predicate==='IS_A'&&isSystem(r.subject));
 const medium=rels.find(r=>FLOWING.has(r.predicate)&&r.predicate!=='COLLECT')??null;
 const conduit=rels.find(r=>FLOWING.has(r.predicate)&&r!==medium&&CONDUIT.test(fold(r.object)))??(medium&&CONDUIT.test(fold(medium.object))?medium:null);
 const sentence=(r:PlannerRelation)=>input.sentences.filter(s=>r.sentenceIds.includes(s.id)).map(s=>fold(s.text)).join(' ');
 return{system:sysDef?.subject??(subject||null),systemRelations:sysDef?[sysDef.id]:[],medium,conduit,consumer:Boolean(conduit&&CONSUMER.test(sentence(conduit))),containment:rels.find(r=>CONTAINMENT.has(r.predicate)&&r.predicate!=='PASSES_THROUGH')??null,
  components:rels.filter(r=>r.predicate==='IS_A'&&!isSystem(r.subject))};
}
export function chooseTemplate(input:PlannerInput):WorldTemplate{
 const r=roles(input),text=(x:PlannerRelation|null)=>x?fold(x.subject+' '+x.object):'';
 if(r.medium&&SUBSURFACE.test(text(r.medium)))return'TERRAIN_SUBSURFACE';
 if(r.containment)return'ENCLOSURE';
 return'OPEN_STAGE';
}
function buildWorld(input:PlannerInput,worldId:string):{world:PersistentWorld;r:Roles}{
 const template=chooseTemplate(input),r=roles(input),entities:WorldEntity[]=[];
 const add=(e:Omit<WorldEntity,'worldId'|'rotation'>&{rotation?:Vec3})=>{if(input.groundedStory&&e.grounding==='FACTUAL'&&!e.relationIds.length)e={...e,grounding:'EDITORIAL',abstraction:'EDITORIAL_DECORATION',participant:null,label:null};entities.push({rotation:[0,0,0],...e,worldId});};
 const sysLabel=r.system?participantLabel(r.system):null;
 let revealed:string[]=[],cutaway:PersistentWorld['cutaway']={kind:'NONE',openAmount:0,revealsEntityIds:[]};
 if(template==='TERRAIN_SUBSURFACE'){
  // Solid ground block whose top is flush with the floor; its front notch opens as the section view.
  add({entityId:'ground_layer',role:'CUTAWAY_LAYER',grounding:'EDITORIAL',abstraction:'EDITORIAL_DECORATION',kind:'LAYER',layer:'subsurface',assembly:'TERRAIN_SECTION',relationIds:[],participant:null,label:null,size:[8,5,6],position:[0,-2.595,0],color:'#8a5a3b',initiallyVisible:true});
  add({entityId:'medium',role:'MEDIUM',grounding:'FACTUAL',abstraction:'ABSTRACT_SYSTEM_REPRESENTATION',kind:'LAYER',layer:'deep',assembly:'LIQUID_VOLUME',relationIds:[r.medium!.id],participant:r.medium!.subject,label:participantLabel(r.medium!.subject),size:[8,1.1,6],position:[0,-3.5,0],color:'#2f86d1',initiallyVisible:false});
  const top=SURFACE.test(fold(r.medium!.object))?0.25:-0.2;
  add({entityId:'system_conduit',role:'MAIN_SYSTEM',grounding:'FACTUAL',abstraction:'ABSTRACT_SYSTEM_REPRESENTATION',kind:'PATH',assembly:'PIPE',relationIds:[...r.systemRelations,r.medium!.id],participant:r.system,label:sysLabel,size:[0.2,0.2,0.2],position:[0,0,0],path:[[0,-3.4,0],[0,top,0]],color:'#5c6f7c',initiallyVisible:true});
  add({entityId:'system_head',role:'MAIN_SYSTEM',grounding:'FACTUAL',abstraction:'ABSTRACT_SYSTEM_REPRESENTATION',kind:'CYLINDER',assembly:'OPEN_BASIN',relationIds:[...r.systemRelations],participant:r.system,label:sysLabel,size:[1.0,0.75,1.0],position:[0,0.375,0],color:'#3d5260',initiallyVisible:true});
  revealed=['medium'];cutaway={kind:'GROUND_TRENCH',openAmount:1,revealsEntityIds:revealed};
 }else if(template==='ENCLOSURE'){
  const c=r.containment!;
  add({entityId:'housing',role:'MAIN_SYSTEM',grounding:'FACTUAL',abstraction:'ABSTRACT_SYSTEM_REPRESENTATION',kind:'BOX',assembly:'FRAME_PANEL',relationIds:[c.id],participant:c.object,label:participantLabel(c.object),size:[1.9,4.4,0.16],position:[0,2.2,-0.9],color:'#6f8796',initiallyVisible:true});
  add({entityId:'housing_cover',role:'CUTAWAY_LAYER',grounding:'EDITORIAL',abstraction:'EDITORIAL_DECORATION',kind:'BOX',assembly:'PANEL',relationIds:[],participant:null,label:null,size:[1.9,4.4,0.16],position:[0,2.2,0.5],color:'#9fb3bd',initiallyVisible:true});
  add({entityId:'moving_component',role:'SYSTEM_COMPONENT',grounding:'FACTUAL',abstraction:'ABSTRACT_SYSTEM_REPRESENTATION',kind:'BOX',assembly:'CARRIAGE',relationIds:[c.id],participant:c.subject,label:participantLabel(c.subject),size:[1.2,1.1,0.9],position:[0,0.7,-0.25],color:'#d9a441',initiallyVisible:true});
  cutaway={kind:'HOUSING_SECTION',openAmount:1,revealsEntityIds:['moving_component']};
 }else{
  add({entityId:'system_body',role:'MAIN_SYSTEM',grounding:'FACTUAL',abstraction:'ABSTRACT_SYSTEM_REPRESENTATION',kind:'BOX',relationIds:[...r.systemRelations],participant:r.system,label:sysLabel,size:[1.6,1.2,1.2],position:[0,0.6,-0.4],color:'#6f8796',initiallyVisible:true});
  if(r.medium)add({entityId:'system_conduit',role:'CONDUIT',grounding:'FACTUAL',abstraction:'ABSTRACT_SYSTEM_REPRESENTATION',kind:'PATH',relationIds:[r.medium.id],participant:r.medium.subject,label:participantLabel(r.medium.subject),size:[0.15,0.15,0.15],position:[0,0,0],path:[[-1.8,0.6,0.4],[-0.8,0.6,0.4],[0.8,0.6,0.4]],color:'#5c6f7c',initiallyVisible:true});
 }
 // Components named by IS_A relations are displayed side by side (display slots), never assembled:
 // their real placement is not in the evidence, so no spatial relation is drawn between them.
 const slots:Vec3[]=template==='ENCLOSURE'?[[2.0,0.35,0.2],[2.0,1.35,0.2],[2.0,2.35,0.2],[2.0,3.35,0.2]]:[[1.9,0.3,0.6],[1.9,1.1,0.6]];
 r.components.filter(c=>!entities.some(e=>e.participant&&fold(e.participant)===fold(c.subject))).slice(0,Math.min(slots.length,8-entities.length-(r.conduit&&template==='TERRAIN_SUBSURFACE'?2:0))).forEach((c,i)=>add({entityId:'component_'+(i+1),role:'SYSTEM_COMPONENT',grounding:'FACTUAL',abstraction:'ABSTRACT_SYSTEM_REPRESENTATION',kind:'BOX',assembly:'DISPLAY_BLOCK',relationIds:[c.id],participant:c.subject,label:participantLabel(c.subject),size:[0.7,0.6,0.5],position:slots[i],color:'#b9c7cf',initiallyVisible:false}));
 if(r.conduit&&template==='TERRAIN_SUBSURFACE'){
  add({entityId:'outlet_conduit',role:'CONDUIT',grounding:'FACTUAL',abstraction:'ABSTRACT_SYSTEM_REPRESENTATION',kind:'PATH',assembly:'PIPE',relationIds:[r.conduit.id],participant:r.conduit.object,label:participantLabel(r.conduit.object.replace(/^\s*(?:atrav[eé]s\s+d[eoa]s?|por|pel[oa]s?|through|via)\s+/i,'')),size:[0.1,0.1,0.1],position:[0,0,0],path:r.consumer?[[0.52,0.16,0],[1.55,0.16,0],[2.1,0.16,-1.15]]:[[0.42,0.16,0],[1.38,0.16,0]],color:'#5c6f7c',initiallyVisible:true});
  if(r.consumer)add({entityId:'consumer_body',role:'CONTEXT_PROP',grounding:'EDITORIAL',abstraction:'EDITORIAL_CONTEXT_FROM_SENTENCE',kind:'BOX',assembly:'GABLED_BUILDING',relationIds:[],participant:null,label:null,size:[1.3,1.5,1.1],position:[2.1,0.75,-1.7],color:'#e9d8b8',initiallyVisible:true});
 }
 const env=input.environmentId??ENV[template];
 return{r,world:{worldId,template,environmentId:env,presenter:{entityId:'presenter',resourceId:'CHAR_CAIO_001',home:template==='ENCLOSURE'?[-1.6,0,0.9]:[-1.25,0,-0.2],facing:1.1,scale:0.82},cutaway,cameraZones:ZONES[template],entities}};
}
/** Position of a relation inside its sentence (fraction 0..1), from its literal participants. */
function anchor(sentence:string,r:PlannerRelation){const s=fold(sentence);for(const part of [r.object,r.subject]){const k=fold(part).split(' ').slice(0,3).join(' ');const at=k?s.indexOf(k):-1;if(at>=0)return at/Math.max(1,s.length);}return 0;}
export function planVisualCausal(input:PlannerInput):VisualCausalPlan{
 // Script Mode converges here: the same plan contract, built from the understood user script.
 if(input.scriptUnderstanding)return withHybridEditorial(input,planScriptWorld(input));
 if(!input.sentences.length||!input.timing.length)throw Error('VISUAL_PLAN_INPUT sentences/timing required');
 const known=new Set(input.relations.map(r=>r.id));
 for(const s of input.sentences)for(const rid of s.relationIds)if(!known.has(rid))throw Error('VISUAL_PLAN_INPUT sentence cites unknown relation '+rid);
 const worldId=id('WORLD',{topic:input.topic,story:input.storyFingerprint});
 const {world,r}=buildWorld(input,worldId),beats:CausalVisualBeat[]=[],transitions:VisualStateTransition[]=[],gaps:VisualGap[]=[];
 const ent=(eid:string)=>world.entities.find(e=>e.entityId===eid);
 const state:Record<string,Record<string,number|boolean>>={};
 for(const e of world.entities)state[e.entityId]={visible:e.initiallyVisible,connection:e.kind==='PATH'?(e.role==='MAIN_SYSTEM'?1:0):0,flowProgress:0,fillLevel:0,y:e.position[1]};
 state.ENVIRONMENT={groundCutaway:0};
 const version:Record<string,number>={};
 const change=(beatId:string,entityId:string,operation:VisualStateTransition['operation'],parameter:string|null,to:number|boolean,grounded:string|null,reason:string|null)=>{
  const key=parameter??'visible',from=state[entityId][key];if(from===to)return null;
  version[entityId]=(version[entityId]??0)+1;state[entityId][key]=to;
  const t:VisualStateTransition={id:id('VT',{beatId,entityId,key,to}),beatId,entityId,operation,parameter,from,to,grounding:grounded?'GROUNDED':'EDITORIAL',evidenceRelationId:grounded,editorialReason:reason,stateVersion:version[entityId]};transitions.push(t);return t.id;};
 const timing=(sid:string)=>input.timing.find(t=>t.sentenceId===sid)!;
 type Draft=Omit<CausalVisualBeat,'id'|'order'|'startFrame'|'endFrame'|'timing'|'transitionIds'>&{weight:number;anchorAt?:number;apply?:(beatId:string)=>(string|null)[]};
 const facts=input.sentences.filter(s=>s.kind==='FACT'),firstFact=input.sentences.findIndex(s=>s.kind==='FACT');
 const evid=(rs:PlannerRelation[])=>[...new Set(rs.flatMap(r=>r.evidenceIds))].sort();
 const ops=(...o:Omit<BeatOperation,'startOffset'|'endOffset'>[]):BeatOperation[]=>o.map(x=>({...x,startOffset:0,endOffset:1}));
 const mainHead=world.entities.find(e=>e.role==='MAIN_SYSTEM'&&e.kind!=='PATH')??world.entities.find(e=>e.role==='MAIN_SYSTEM')!;
 const schedule=(drafts:Draft[],start:number,end:number,sentenceId:string|null,exact:boolean)=>{
  const total=drafts.reduce((n,d)=>n+d.weight,0),span=end-start;let cursor=start;
  drafts.forEach((d,i)=>{const len=i===drafts.length-1?end-cursor:Math.max(12,Math.round(span*d.weight/total));const a=cursor,b=Math.min(end,a+len);cursor=b;
   const beatId=id('BEAT',{sentenceId,i,intent:d.visualIntent,relationIds:d.relationIds});const tids=(d.apply?.(beatId)??[]).filter((x):x is string=>Boolean(x));
   const {weight:_w,anchorAt:_a,apply:_ap,...rest}=d;beats.push({...rest,id:beatId,order:beats.length,startFrame:a,endFrame:b,timing:exact&&drafts.length===1?'SENTENCE_BOUNDARY':'ESTIMATED_WITHIN_SENTENCE',transitionIds:tids});});
 };
 // Hook / editorial sentences before the first fact establish world then system.
 const lead=input.sentences.slice(0,Math.max(0,firstFact));
 if(lead.length){const a=timing(lead[0].id).startFrame,b=timing(lead[lead.length-1].id).endFrame;
  schedule([{sentenceId:lead[0].id,storyNodeIds:[],relationIds:[],evidenceIds:[],grounding:'EDITORIAL_CONTEXT',visualIntent:'WORLD_ESTABLISHING',presenterIntent:'ESTABLISH_CONTEXT',presenterVisible:true,cameraZone:'WORLD',cameraMotivation:'Establish where the system exists before any explanation',focusEntityId:null,label:null,operations:[],proof:null,weight:0.55},
   {sentenceId:lead[lead.length-1].id,storyNodeIds:[],relationIds:[],evidenceIds:[],grounding:'PRESENTER_ACTION',visualIntent:'SYSTEM_ESTABLISHING',presenterIntent:'POINT_TO_SYSTEM',presenterVisible:true,cameraZone:'SYSTEM',cameraMotivation:'New focus: the explained system',focusEntityId:mainHead.entityId,label:null,operations:ops({operation:'HIGHLIGHT',target:mainHead.entityId,parameters:{amount:0.2}}),proof:null,weight:0.45}],a,b,lead[0].id,false);}
 let cutawayOpen=false;
 for(const s of facts){
  const t=timing(s.id),rels=s.relationIds.map(rid=>input.relations.find(x=>x.id===rid)!).sort((x,y)=>anchor(s.text,x)-anchor(s.text,y)||x.id.localeCompare(y.id,'en'));
  const drafts:Draft[]=[];
  const base=(rel:PlannerRelation)=>({sentenceId:s.id,storyNodeIds:rel.storyNodeIds,relationIds:[rel.id],evidenceIds:evid([rel])});
  for(const rel of rels){
   const p=rel.predicate,f=fold(rel.subject+' '+rel.object);
   const target=world.entities.find(e=>e.relationIds.includes(rel.id)&&e.role!=='MAIN_SYSTEM')??world.entities.find(e=>e.relationIds.includes(rel.id))??null;
   if(p==='IS_A'&&target&&target.role==='MAIN_SYSTEM'){
    drafts.push({...base(rel),grounding:'FACTUAL_DEMONSTRATION',visualIntent:'SYSTEM_IDENTITY',presenterIntent:'OBSERVE_SYSTEM',presenterVisible:true,cameraZone:'SYSTEM',cameraMotivation:'Name the system that stays in view',focusEntityId:mainHead.entityId,label:mainHead.label,operations:ops({operation:'HIGHLIGHT',target:mainHead.entityId,parameters:{amount:0.25}}),proof:{level:'SYMBOLIC',rationale:'Abstract system representation labelled with the source term; the category itself is not visually provable'},weight:1});
   }else if(p==='IS_A'&&target){
    drafts.push({...base(rel),grounding:'FACTUAL_DEMONSTRATION',visualIntent:'COMPONENT_IDENTITY',presenterIntent:'POINT_TO_COMPONENT',presenterVisible:true,cameraZone:'COMPONENT',cameraMotivation:'New component introduced',focusEntityId:target.entityId,label:target.label,operations:ops({operation:'REVEAL',target:target.entityId,parameters:{}},{operation:'HIGHLIGHT',target:target.entityId,parameters:{amount:0.25}}),proof:{level:'SYMBOLIC',rationale:'Labelled abstract component in a display slot; its placement is not claimed'},weight:1,apply:b=>[change(b,target.entityId,'REVEAL',null,true,rel.id,null)]});
   }else if(FLOWING.has(p)&&rel===r.medium){
    if(world.cutaway.kind==='GROUND_TRENCH'&&!cutawayOpen){cutawayOpen=true;
     drafts.push({...base(rel),relationIds:[],storyNodeIds:[],evidenceIds:[],grounding:'EDITORIAL_TRANSITION',visualIntent:'CUTAWAY_REVEAL',presenterIntent:'REVEAL_SYSTEM',presenterVisible:true,cameraZone:'CUTAWAY',cameraMotivation:'Follow the presenter gesture into the hidden part of the same system',focusEntityId:'system_conduit',label:null,operations:ops({operation:'INCREASE',target:'ENVIRONMENT',parameters:{parameter:'groundCutaway',from:0,to:world.cutaway.openAmount}},...world.cutaway.revealsEntityIds.map(e=>({operation:'REVEAL' as const,target:e,parameters:{}}))),proof:null,weight:0.9,
      apply:b=>[change(b,'ENVIRONMENT','INCREASE','groundCutaway',world.cutaway.openAmount,null,'Section view; does not change system identity'),...world.cutaway.revealsEntityIds.map(e=>change(b,e,'REVEAL',null,true,null,'Revealed by cutaway'))]});
     drafts.push({...base(rel),relationIds:[],storyNodeIds:[],evidenceIds:[],grounding:'EDITORIAL_TRANSITION',visualIntent:'COMPONENT_FOCUS',presenterIntent:'NONE',presenterVisible:false,cameraZone:'COMPONENT',cameraMotivation:'Focus the participant before it acts',focusEntityId:'medium',label:ent('medium')?.label??null,operations:ops({operation:'HIGHLIGHT',target:'medium',parameters:{amount:0.12}}),proof:null,weight:0.6});
    }
    const conduit=world.entities.find(e=>e.kind==='PATH'&&e.relationIds.includes(rel.id))!;
    const fill=world.entities.find(e=>e.kind==='CYLINDER'&&e.role==='MAIN_SYSTEM');
    if(Number(state[conduit.entityId].connection)<1)drafts.push({...base(rel),relationIds:[],storyNodeIds:[],evidenceIds:[],grounding:'EDITORIAL_TRANSITION',visualIntent:'ROUTE_SETUP',presenterIntent:'NONE',presenterVisible:false,cameraZone:'ACTION',cameraMotivation:'Prepare the existing abstract path before movement',focusEntityId:conduit.entityId,label:null,operations:ops({operation:'CONNECT',target:conduit.entityId,parameters:{from:Number(state[conduit.entityId].connection),to:1}}),proof:null,weight:0.2,apply:b=>[change(b,conduit.entityId,'CONNECT','connection',1,null,'Abstract path setup; not an additional factual relation')]});
    drafts.push({...base(rel),grounding:'FACTUAL_DEMONSTRATION',visualIntent:'DIRECTIONAL_MOVEMENT',presenterIntent:'NONE',presenterVisible:false,cameraZone:'ACTION',cameraMotivation:'Follow the movement from its source to its destination',focusEntityId:conduit.entityId,label:null,
     operations:[{operation:'FLOW',target:conduit.entityId,parameters:{path:conduit.path,from:0,to:1,direction:'FORWARD',speed:1,amount:0.85},startOffset:0,endOffset:0.75},...(fill?[{operation:'INCREASE' as const,target:fill.entityId,parameters:{parameter:'fillLevel',from:0,to:0.8},startOffset:0.55,endOffset:1}]:[])],
     proof:{level:SURFACE.test(fold(rel.object))||!fill?'DIRECT':'PARTIAL',rationale:'Source participant, moving medium and stated destination are all shown; motion runs along the conduit'},weight:1.4,
     apply:b=>[change(b,conduit.entityId,'FLOW','flowProgress',1,rel.id,null),...(fill?[change(b,fill.entityId,'INCREASE','fillLevel',0.8,rel.id,null)]:[])]});
   }else if(p==='CAUSED_BY'||p==='CAUSES'){
    const affected=world.entities.find(e=>e.participant&&f.includes(fold(e.participant))&&e.role==='MEDIUM')??target??mainHead;
    const unsupported=input.groundedStory&&affected.grounding==='EDITORIAL',reason='No grounded participant for this cause; editorial prop cannot be visual proof';if(unsupported)gaps.push({relationId:rel.id,predicate:p,reason});
    drafts.push({...base(rel),grounding:'FACTUAL_DEMONSTRATION',visualIntent:'CAUSE_ATTRIBUTION',presenterIntent:'NONE',presenterVisible:false,cameraZone:'COMPONENT',cameraMotivation:'Return to the participant whose behaviour is being explained',focusEntityId:affected.entityId,label:participantLabel(p==='CAUSED_BY'?rel.object:rel.subject),operations:ops({operation:'HIGHLIGHT',target:affected.entityId,parameters:{amount:0.12}}),proof:{level:unsupported?'NONE':'SYMBOLIC',rationale:unsupported?reason:'The cause is named on screen and its participant highlighted; the mechanism of the cause is not drawn'},weight:1.6});
   }else if(rel===r.conduit&&world.entities.some(e=>e.entityId==='outlet_conduit')){
    const back=cutawayOpen;cutawayOpen=false;
    drafts.push({...base(rel),grounding:'FACTUAL_DEMONSTRATION',visualIntent:'RESULT_TRANSFER',presenterIntent:'NONE',presenterVisible:false,cameraZone:'RESULT',cameraMotivation:'New state: the medium leaves the system through the conduit',focusEntityId:'outlet_conduit',label:ent('outlet_conduit')?.label??null,
     operations:[...(back?[{operation:'DECREASE' as const,target:'ENVIRONMENT',parameters:{parameter:'groundCutaway',from:world.cutaway.openAmount,to:0},startOffset:0,endOffset:0.12}]:[]),{operation:'CONNECT',target:'outlet_conduit',parameters:{from:0,to:1},startOffset:0.15,endOffset:0.45},{operation:'FLOW',target:'outlet_conduit',parameters:{path:ent('outlet_conduit')!.path,from:0,to:1,direction:'FORWARD',speed:1,amount:0.85},startOffset:0.45,endOffset:0.95}],
     proof:{level:'PARTIAL',rationale:'Transfer through the conduit is shown; the conduit geometry and destination are abstract/editorial'},weight:1.3,
     apply:b=>[...(back?[change(b,'ENVIRONMENT','DECREASE','groundCutaway',0,null,'Return to the surface after the section view')]:[]),change(b,'outlet_conduit','CONNECT','connection',1,rel.id,null),change(b,'outlet_conduit','FLOW','flowProgress',1,rel.id,null)]});
   }else if(CONTAINMENT.has(p)&&rel===r.containment){
    if(world.cutaway.kind==='HOUSING_SECTION')drafts.push({...base(rel),relationIds:[],storyNodeIds:[],evidenceIds:[],grounding:'EDITORIAL_TRANSITION',visualIntent:'CUTAWAY_REVEAL',presenterIntent:'NONE',presenterVisible:false,cameraZone:'CUTAWAY',cameraMotivation:'Open the housing to show what moves inside it',focusEntityId:'housing',label:null,operations:ops({operation:'HIDE',target:'housing_cover',parameters:{}}),proof:null,weight:0.8,apply:b=>[change(b,'housing_cover','HIDE',null,false,null,'Section view of the housing cover')]});
    const m=ent('moving_component')!,to:Vec3=[m.position[0],m.position[1]+2.2,m.position[2]];
    drafts.push({...base(rel),grounding:'FACTUAL_DEMONSTRATION',visualIntent:'MOVEMENT_WITHIN',presenterIntent:'NONE',presenterVisible:false,cameraZone:'ACTION',cameraMotivation:'Follow the component moving inside its container',focusEntityId:m.entityId,label:m.label,operations:[{operation:'MOVE',target:m.entityId,parameters:{from:m.position,to},startOffset:0.1,endOffset:0.9}],proof:{level:'DIRECT',rationale:'The component moves inside the stated container'},weight:1.4,apply:b=>[change(b,m.entityId,'MOVE','y',to[1],rel.id,null)]});
   }else{
    const reason=PURPOSE.has(p)?'Purpose/constraint is not a visual event; named with its participant only':'No generic visual operation for '+p;
    gaps.push({relationId:rel.id,predicate:p,reason});
    drafts.push({...base(rel),grounding:'FACTUAL_DEMONSTRATION',visualIntent:'RELATION_NAMED',presenterIntent:'OBSERVE_SYSTEM',presenterVisible:true,cameraZone:'SYSTEM',cameraMotivation:'Hold the system while a non-visual relation is narrated',focusEntityId:(target??mainHead).entityId,label:participantLabel(rel.subject),operations:ops({operation:'HIGHLIGHT',target:(target??mainHead).entityId,parameters:{amount:0.15}}),proof:{level:'NONE',rationale:reason},weight:1});
   }
  }
  if(!drafts.length)drafts.push({sentenceId:s.id,storyNodeIds:[],relationIds:[],evidenceIds:[],grounding:'EDITORIAL_CONTEXT',visualIntent:'HOLD_SYSTEM',presenterIntent:'OBSERVE_SYSTEM',presenterVisible:true,cameraZone:'SYSTEM',cameraMotivation:'Hold the system',focusEntityId:mainHead.entityId,label:null,operations:[],proof:null,weight:1});
  // Payoff: the last fact sentence ends by returning to the world (editorial), if long enough.
  const last=s===facts[facts.length-1]&&t.endFrame-t.startFrame>=input.fps*3;
  if(last)drafts.push({sentenceId:s.id,storyNodeIds:[],relationIds:[],evidenceIds:[],grounding:'EDITORIAL_CONTEXT',visualIntent:'RETURN_TO_WORLD',presenterIntent:'FINAL_PAYOFF',presenterVisible:true,cameraZone:'WORLD',cameraMotivation:'Return to context: the whole system in its world',focusEntityId:null,label:null,operations:[],proof:null,weight:0.6});
  schedule(drafts,t.startFrame,t.endFrame,s.id,true);
 }
 // Trailing editorial sentences after the last fact hold the world.
 for(const s of input.sentences.slice(firstFact).filter(s=>s.kind==='EDITORIAL')){const t=timing(s.id);schedule([{sentenceId:s.id,storyNodeIds:[],relationIds:[],evidenceIds:[],grounding:'EDITORIAL_CONTEXT',visualIntent:'RETURN_TO_WORLD',presenterIntent:'FINAL_PAYOFF',presenterVisible:true,cameraZone:'WORLD',cameraMotivation:'Return to context',focusEntityId:null,label:null,operations:[],proof:null,weight:1}],t.startFrame,t.endFrame,s.id,true);}
 beats.sort((a,b)=>a.startFrame-b.startFrame);beats.forEach((b,i)=>b.order=i);
 const raw={version:VISUAL_CAUSAL_VERSION,topic:input.topic,worldId,scriptFingerprint:input.scriptFingerprint,storyFingerprint:input.storyFingerprint,relationsFingerprint:jsonHash(input.relations),world,beats,transitions,gaps:gaps.sort((a,b)=>a.relationId.localeCompare(b.relationId,'en')),fps:input.fps,totalFrames:input.totalFrames,...(input.groundedStory?{groundedStoryHandoff:{progressionFingerprint:input.groundedStory.fingerprint,beats:beats.map(b=>({beatId:b.id,roles:b.grounding==='FACTUAL_DEMONSTRATION'?input.sentences.find(s=>s.id===b.sentenceId)?.roles??[]:[],stateDescriptionIds:input.groundedStory!.states.filter(s=>b.relationIds.includes(s.relationId)).map(s=>s.id),problemSolutionRelationIds:input.groundedStory!.problemSolutionPairs.filter(p=>b.relationIds.includes(p.problemRelationId)||b.relationIds.includes(p.solutionRelationId)).flatMap(p=>[p.problemRelationId,p.solutionRelationId])}))}}:{})};
 const result={...raw,...(input.previewOnly?{previewOnly:true as const}:{})};return withHybridEditorial(input,{...result,fingerprint:jsonHash(result)});
}
