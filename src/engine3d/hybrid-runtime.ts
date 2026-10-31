import {evaluateDirected,projectPosition,type DirectedSequence,type SequenceState} from './directed';
import {instanceMatrix,localToWorld} from './transforms';
import type {Vec3} from './contracts';
import type {EditorialWindow,WorldAnnotation} from '../editorial/hybrid-contracts';
export const editorialActive=(w:EditorialWindow,f:number)=>f>=w.startFrame&&f<w.endFrame;
export const editorialOpacity=(w:EditorialWindow,f:number)=>editorialActive(w,f)?Math.min(1,(f-w.startFrame+1)/5,(w.endFrame-f)/5):0;
/** Uses the same evaluated world poses (including parent transforms) as the physical renderer. */
export function annotationWorldPoints(s:DirectedSequence,state:SequenceState,a:WorldAnnotation):Vec3[]{
 const sub=s.demonstration?.subjects.find(x=>x.id===a.entityId),live=state.demonstration?.subjects[a.entityId];
 if(!sub||!live?.visible)return[];
 const path=sub.path?.length?sub.path:undefined;
 const local=path?(a.anchor==='START'?[path[0]]:a.anchor==='END'?[path.at(-1)!]:path):[[0,0,0] as Vec3];
 const matrix=instanceMatrix(live);return local.map(p=>localToWorld(p,matrix).toArray() as Vec3);
}
/** Pure frame/spec evaluation. Editorial graphics never mutate physical state or proof. */
export function evaluateHybridFrame(s:DirectedSequence,frame:number,state=evaluateDirected(s,frame).state){
 const track=s.hybridEditorial,diagrams=track?.diagrams.filter(d=>editorialActive(d,frame))??[];
 const annotations=(track?.annotations.filter(a=>editorialActive(a,frame))??[]).map(a=>{
  const worldPoints=annotationWorldPoints(s,state,a),points=worldPoints.map(p=>projectPosition(p,state.camera,s.width,s.height));
  return{...a,worldPoints,points,visible:points.length>0&&points.every(p=>p.depth>-1&&p.depth<1)&&points.some(p=>p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1),opacity:editorialOpacity(a,frame)};
 });
 return{worldId:track?.worldId??null,presenterId:track?.presenterId??null,diagrams:diagrams.map(d=>({...d,opacity:editorialOpacity(d,frame)})),annotations,
  words:(track?.words.filter(w=>editorialActive(w,frame))??[]).map(w=>({...w,opacity:editorialOpacity(w,frame)})),
  questions:(track?.questions.filter(q=>editorialActive(q,frame))??[]).map(q=>({...q,opacity:editorialOpacity(q,frame)})),
  simplification:diagrams.length?'TEMPORARY_EDITORIAL_SCRIM' as const:'NONE' as const};
}
