import React from 'react';
import {BackSide,Shape} from 'three';
import type {Vec3} from './contracts';

/** Reusable schematic resources. Local +X is the aircraft nose; +Y is up.
 * Shapes are editorial geometry, not a flight model or a computed pressure field. */
export const VECTOR_PALETTE=['#0d6e4a','#bd253c','#124c7d','#975400'] as const;
export const AIRFOIL_PROFILE:readonly (readonly [number,number])[]=[
 [1,0],[.985,.055],[.92,.12],[.7,.185],[.35,.23],[0,.215],[-.4,.145],[-.75,.065],[-1,0],[-.75,-.018],[-.4,-.035],[0,-.055],[.35,-.065],[.7,-.055],[.92,-.035],[.985,-.018],[1,0],
];
function polygon(points:readonly (readonly [number,number])[]){const s=new Shape();s.moveTo(...points[0]);for(const p of points.slice(1))s.lineTo(...p);s.closePath();return s;}
function Planform({points,y=0,color='#e8edf1',thickness=.065}:{points:readonly (readonly [number,number])[];y?:number;color?:string;thickness?:number}){
 const shape=polygon(points);
 return <group position={[0,y,0]} rotation={[Math.PI/2,0,0]}>
  <mesh><extrudeGeometry args={[shape,{depth:thickness,bevelEnabled:false}]} /><meshToonMaterial color={color}/></mesh>
  <mesh scale={[1.015,1.015,1.05]}><extrudeGeometry args={[shape,{depth:thickness,bevelEnabled:false}]} /><meshBasicMaterial color='#263747' side={BackSide}/></mesh>
 </group>;
}
function Ellipsoid({at,scale,color}:{at:Vec3;scale:Vec3;color:string}){return <group position={at}>
 <mesh scale={scale}><sphereGeometry args={[1,24,12]}/><meshToonMaterial color={color}/></mesh>
 <mesh scale={scale.map(v=>v*1.022) as Vec3}><sphereGeometry args={[1,24,12]}/><meshBasicMaterial color='#263747' side={BackSide}/></mesh>
 </group>;}
export function AircraftGeometry(){return <>
 <Ellipsoid at={[0,0,0]} scale={[2.55,.32,.33]} color='#f0f3f5'/>
 {[-1,1].map(side=><React.Fragment key={side}>
  <Planform points={[[.62,side*.2],[-.68,side*2.9],[-1.22,side*2.9],[-.52,side*.2]]} y={-.03}/>
  <Planform points={[[-1.42,side*.08],[-2.0,side*1.15],[-2.4,side*1.15],[-2.03,side*.08]]} y={.12} color='#3983b7'/>
  <Ellipsoid at={[.18,-.37,side*1.02]} scale={[.49,.21,.21]} color='#d3dde5'/>
  <mesh position={[.61,-.37,side*1.02]} rotation={[0,0,-Math.PI/2]}><cylinderGeometry args={[.145,.145,.025,20]}/><meshToonMaterial color='#263747'/></mesh>
  {Array.from({length:6},(_,i)=><mesh key={i} position={[-1.22+i*.43,.09,side*.322]}><boxGeometry args={[.16,.105,.026]}/><meshToonMaterial color='#26758f'/></mesh>)}
  <mesh position={[1.83,.155,side*.225]} rotation={[0,side*.55,0]}><boxGeometry args={[.32,.14,.035]}/><meshToonMaterial color='#26758f'/></mesh>
 </React.Fragment>)}
 <group position={[0,0,-.045]}><mesh><extrudeGeometry args={[polygon([[-1.42,.1],[-2.04,1.15],[-2.43,1.15],[-2.38,.08]]),{depth:.09,bevelEnabled:false}]}/><meshToonMaterial color='#3983b7'/></mesh></group>
 </>;}
export function AirfoilGeometry(){const shape=polygon(AIRFOIL_PROFILE);return <group position={[0,0,-.8]}>
 <mesh><extrudeGeometry args={[shape,{depth:1.6,bevelEnabled:false}]} /><meshToonMaterial color='#e8bf56'/></mesh>
 <mesh scale={[1.015,1.025,1.01]}><extrudeGeometry args={[shape,{depth:1.6,bevelEnabled:false}]} /><meshBasicMaterial color='#263747' side={BackSide}/></mesh>
 </group>;}
/** Unit vector glyph: base at the origin, tip at local Y=1. Length/direction use JSON transforms. */
export function VectorArrowGeometry({palette=0}:{palette?:number}){const color=VECTOR_PALETTE[Math.round(palette)];return <>
 <mesh position={[0,.36,0]} renderOrder={20}><cylinderGeometry args={[.035,.035,.72,12]}/><meshBasicMaterial color={color} depthTest={false} depthWrite={false}/></mesh>
 <mesh position={[0,.85,0]} renderOrder={20}><coneGeometry args={[.12,.3,16]}/><meshBasicMaterial color={color} depthTest={false} depthWrite={false}/></mesh>
 </>;}
