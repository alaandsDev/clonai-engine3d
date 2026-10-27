import React from 'react';
import {Composition,registerRoot} from 'remotion';
import plan from '../examples/cold-opening.json';
import {compileDirectorPlan} from './engine3d/director';
import {SequenceRenderer} from './engine3d/renderer';
import type {DirectorPlan,ProceduralSequence} from './engine3d/contracts';
const sequence=compileDirectorPlan(plan as unknown as DirectorPlan);
const Root=()=> <>{['DirectorSequence','CharacterPreview','ResourcePlayground','ShotBuilder'].map(id=><Composition key={id} id={id} component={SequenceRenderer} defaultProps={{sequence:id==='DirectorSequence'?sequence:{...sequence,shots:[{...sequence.shots[0],startFrame:0}],scenes:[],totalFrames:90,captions:[]}}} durationInFrames={sequence.totalFrames} fps={sequence.fps} width={sequence.width} height={sequence.height} calculateMetadata={({props})=>{const s=props.sequence as ProceduralSequence;return {durationInFrames:s.totalFrames,fps:s.fps,width:s.width,height:s.height}}}/>)}</>;
registerRoot(Root);
