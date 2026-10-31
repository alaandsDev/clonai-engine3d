import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {Box3,Matrix4,Euler,Quaternion,Vector3,SphereGeometry,BoxGeometry,CylinderGeometry,ConeGeometry,ExtrudeGeometry} from 'three';
import {AircraftGeometry,AirfoilGeometry,VectorArrowGeometry,AIRFOIL_PROFILE} from '../src/engine3d/aeronautics';
import {PROP_MESHES} from '../src/engine3d/demonstration-contracts';
import {registry} from '../src/engine3d/registry';
import {requireExecutor} from '../src/engine3d/executors';
import {parameters} from '../src/engine3d/validation';

/** Evaluate the reusable geometry tree without a browser, GPU, network or clock. */
function geometry(root:React.ReactNode){const bounds=new Box3(),transforms:Matrix4[]=[],meshes:Box3[]=[];
 const visit=(node:React.ReactNode,parent=new Matrix4())=>{
  if(Array.isArray(node)){node.forEach(n=>visit(n,parent));return;}if(!React.isValidElement(node))return;
  const p=node.props as any;
  if(typeof node.type==='function'){visit((node.type as (p:any)=>React.ReactNode)(p),parent);return;}
  const m=parent.clone();if(node.type==='group'||node.type==='mesh'){const pos=p.position??[0,0,0],rot=p.rotation??[0,0,0],s=p.scale??[1,1,1];m.multiply(new Matrix4().compose(new Vector3(...pos),new Quaternion().setFromEuler(new Euler(...rot)),new Vector3(...s)));}
  if(node.type==='mesh'){
   const g=React.Children.toArray(p.children).find(n=>React.isValidElement(n)&&typeof n.type==='string'&&n.type.endsWith('Geometry')) as React.ReactElement<any>|undefined;
   assert(g,'mesh must declare geometry');const a=g.props.args??[];
   const kinds:any={sphereGeometry:SphereGeometry,boxGeometry:BoxGeometry,cylinderGeometry:CylinderGeometry,coneGeometry:ConeGeometry,extrudeGeometry:ExtrudeGeometry};
   const mesh=new kinds[g.type as string](...a);mesh.computeBoundingBox();const b=mesh.boundingBox!.clone().applyMatrix4(m);assert([...b.min.toArray(),...b.max.toArray()].every(Number.isFinite));bounds.union(b);meshes.push(b);transforms.push(m);mesh.dispose();
  }
  if(p.children)visit(p.children,m);
 };visit(root);return{bounds,meshes,transforms};}
test('aeronautics resources have explicit executors, searchable tags and bounded geometry',()=>{
 const entries=[['PROP_AIRCRAFT_001',React.createElement(AircraftGeometry),'flight'],['PROP_AIRFOIL_001',React.createElement(AirfoilGeometry),'section'],['PROP_VECTOR_ARROW_001',React.createElement(VectorArrowGeometry),'force']] as const;
 for(const[id,element,tag]of entries){const r=registry.getById(id);assert(r?.status==='available');assert(r.tags.includes(tag));assert(requireExecutor(id,'prop'));const g=geometry(element);assert(g.meshes.length>0);assert(g.meshes.length<=PROP_MESHES[id],id+' mesh budget must cover its actual renderer');}
});
test('aircraft silhouette has a fuselage, broad wings and an elevated tail',()=>{const g=geometry(React.createElement(AircraftGeometry)),size=g.bounds.getSize(new Vector3());assert(size.x>=5&&size.z>=5.7);assert(g.bounds.max.y>=1.1);assert(size.x<6&&size.z<6.1);});
test('airfoil is a closed finite profile with positive thickness, not a flat plate',()=>{assert.deepEqual(AIRFOIL_PROFILE[0],AIRFOIL_PROFILE.at(-1));assert(AIRFOIL_PROFILE.every(p=>p.every(Number.isFinite)));const b=geometry(React.createElement(AirfoilGeometry)).bounds;assert(b.max.y-b.min.y>.25);assert(b.max.z-b.min.z>=1.6);assert(b.min.x<=-1&&b.max.x>=1);});
test('vector arrow is a unit glyph whose tip and base match JSON force transforms',()=>{for(let palette=0;palette<4;palette++){parameters('PROP_VECTOR_ARROW_001',{palette});const g=geometry(React.createElement(VectorArrowGeometry,{palette}));assert(Math.abs(g.bounds.min.y)<1e-6);assert(Math.abs(g.bounds.max.y-1)<1e-6);assert.equal(g.meshes.length,2);}assert.throws(()=>parameters('PROP_VECTOR_ARROW_001',{palette:4}));assert.throws(()=>parameters('PROP_VECTOR_ARROW_001',{palette:-1}));});
test('procedural geometry is identical when recreated and has no frame or random input',()=>{for(const element of[React.createElement(AircraftGeometry),React.createElement(AirfoilGeometry),React.createElement(VectorArrowGeometry,{palette:2})]){const a=geometry(element),b=geometry(element);assert.deepEqual(a.meshes.map(x=>[x.min.toArray(),x.max.toArray()]),b.meshes.map(x=>[x.min.toArray(),x.max.toArray()]));}});
