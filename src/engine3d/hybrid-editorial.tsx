import React from 'react';
import type {DirectedSequence,SequenceState} from './directed';
import {evaluateHybridFrame} from './hybrid-runtime';
import {COMPOSITION_Z} from '../composition-layers';
/** Generic vectors over the existing live 3D world; no topic-specific assets/layouts. */
export function HybridEditorialOverlay({direction,frame,state}:{direction:DirectedSequence;frame:number;state?:SequenceState}){
 const e=evaluateHybridFrame(direction,frame,state);
 if(!e.diagrams.length&&!e.annotations.some(a=>a.visible)&&!e.words.length&&!e.questions.length)return null;
 const marker=direction.id.replace(/[^a-zA-Z0-9_-]/g,'')+'-editorial-arrow';
 return <svg data-hybrid-editorial="HYBRID_3D_V1" data-world-id={e.worldId??''} data-presenter-id={e.presenterId??''}
  viewBox="0 0 1000 1000" preserveAspectRatio="none" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:COMPOSITION_Z.TEXT}}>
  <defs><marker id={marker} markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="#78d3f3" strokeWidth="1.8"/></marker></defs>
  {e.questions.map(q=><g key={q.id} data-question-reset={q.questionSentenceId} opacity={q.opacity}><rect width="1000" height="1000" fill="#0d1a29" opacity=".12"/><path d="M430 240 L570 240" stroke="#78d3f3" strokeWidth="3"/></g>)}
  {e.annotations.filter(a=>a.visible).map(a=>{const points=a.points.map(p=>({x:p.x*1000,y:p.y*1000})),target=points[Math.floor(points.length/2)];
   return <g key={a.id} data-annotation={a.kind} data-target={a.entityId} opacity={a.opacity} fill="none" stroke="#78d3f3" strokeWidth="3">
    {a.kind==='PATH'||a.kind==='FLOW'?<polyline data-geometry-path="true" points={points.map(p=>`${p.x},${p.y}`).join(' ')} strokeDasharray={a.kind==='FLOW'?'14 10':undefined} strokeDashoffset={a.kind==='FLOW'?-(frame-a.startFrame)*2:undefined} markerEnd={`url(#${marker})`}/>
     :a.kind==='ARROW'?<line data-anchor-x={target.x} data-anchor-y={target.y} x1={Math.max(70,target.x-90)} y1={Math.max(150,target.y-70)} x2={target.x} y2={target.y} markerEnd={`url(#${marker})`}/>
     :a.kind==='SHORT_LABEL'?null:a.kind==='DESTINATION_MARKER'?<rect x={target.x-13} y={target.y-13} width="26" height="26"/>
     :<ellipse cx={target.x} cy={target.y} rx={a.kind==='HIGHLIGHT'?42:22} ry={a.kind==='HIGHLIGHT'?26:14} fill={a.kind==='SOURCE_MARKER'?'#78d3f3':a.kind==='HIGHLIGHT'?'rgba(120,211,243,.12)':'none'}/>}
    {a.label&&<g stroke="none"><rect x={Math.max(70,Math.min(700,target.x-90))} y={Math.max(160,target.y-112)} width="220" height="30" rx="7" fill="#0d1a29" opacity=".94"/>
     <text x={Math.max(180,Math.min(810,target.x+20))} y={Math.max(181,target.y-91)} fontFamily="Arial,sans-serif" fontSize="15" textAnchor="middle" fill="white">{a.label}</text></g>}
   </g>;})}
  {e.diagrams.map(d=><g key={d.id} data-micro-diagram={d.shape} data-proof="EDITORIAL_ONLY" opacity={d.opacity}>
   <rect data-simplification="temporary" width="1000" height="1000" fill="#0d1a29" opacity=".25"/>
   <rect x="90" y="280" width="820" height="360" rx="24" fill="#123047" opacity=".96" stroke="#78d3f3" strokeWidth="2"/>
   {d.edges.map((edge,i)=>{const a=d.nodes.find(n=>n.id===edge.from)!,b=d.nodes.find(n=>n.id===edge.to)!,x1=110+a.position[0]*780,y1=310+a.position[1]*270,x2=110+b.position[0]*780,y2=310+b.position[1]*270;
    return <g key={i} data-edge-relation={edge.relationId}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#78d3f3" strokeWidth="3" strokeDasharray={edge.kind==='MOVEMENT'?'12 8':undefined} strokeDashoffset={edge.kind==='MOVEMENT'?-(frame-d.startFrame)*2:undefined} markerEnd={edge.kind==='POSITION'?undefined:`url(#${marker})`}/>
     <text x={(x1+x2)/2} y={(y1+y2)/2-35} textAnchor="middle" fill="#cdeaf5" fontFamily="Arial,sans-serif" fontSize="12">{edge.label}</text></g>;})}
   {d.nodes.map(n=>{const x=110+n.position[0]*780,y=310+n.position[1]*270,words=n.label.split(/\s+/),lines=words.length>3?[words.slice(0,Math.ceil(words.length/2)).join(' '),words.slice(Math.ceil(words.length/2)).join(' ')]:[n.label];
    return <g key={n.id} data-semantic-node={n.id}><rect x={x-82} y={y-28} width="164" height="56" rx="13" fill="#163e57" stroke="#a0d7e9" strokeWidth="2"/>
     <text x={x} y={y-(lines.length-1)*9+6} textAnchor="middle" fill="white" fontFamily="Arial,sans-serif" fontSize="16">{lines.map((l,i)=><tspan key={i} x={x} dy={i?18:0}>{l}</tspan>)}</text></g>;})}
  </g>)}
  {e.words.map(w=><g key={w.id} data-causal-word={w.text} data-proof="EDITORIAL_ONLY" opacity={w.opacity}><rect x="250" y="178" width="500" height="58" rx="12" fill="#0d1a29" opacity=".92"/>
   <text x="500" y="216" fill="#b9e9f8" textAnchor="middle" fontSize="28" fontFamily="Arial,sans-serif" fontWeight="700">{w.text}</text></g>)}
 </svg>;
}
