import React from "react";
import { Composition, registerRoot } from "remotion";
import { SequenceRenderer } from "./engine3d/renderer";
import type { DirectorPlan, ProceduralSequence } from "./engine3d/contracts";
import { studioSequence } from "./engine3d/studio";
import { validateSequence } from "./engine3d/sequence-validation";
import { EditorialVisualRenderer,validateVisualPayload } from "./visual/renderer";
import { COMPOSITOR_VERSION,type VisualCompositionPlan } from "./visual/contracts";
import {DirectedRenderer} from './engine3d/directed-renderer';
import {validateDirected,type DirectedSequence} from './engine3d/directed';
// Generic development default from the existing library; no example import.
const sequence = studioSequence("character");
const {sceneId:directedScene,startFrame:directedStart,endFrame:directedEnd,durationFrames:directedFrames,...directedBase}=sequence.shots[0];
const directedInitial={actors:{[sequence.shots[0].characters[0].instanceId]:{position:[0,0,0] as [number,number,number],facing:0}},props:{},camera:{position:[0,2.1,7.4] as [number,number,number],target:[0,1.25,0] as [number,number,number]}};
const defaultDirection:DirectedSequence={version:1,id:'directed-preview',fps:30,width:480,height:854,totalFrames:90,baseShot:{...directedBase,id:'directed-base',durationSeconds:3,props:[],actions:[],vfx:[]},initialState:directedInitial,finalState:directedInitial,blocking:[],actionSegments:[],cameraSegments:[],focusSegments:[],propMotions:[],shots:[{id:'continuous',startFrame:0,endFrame:90,transition:'CONTINUE'}],captions:[]};
const emptyVisualPlan:VisualCompositionPlan={version:1,compositorVersion:COMPOSITOR_VERSION,editorialFingerprint:"0".repeat(64),fps:sequence.fps,canvas:{width:sequence.width,height:sequence.height},totalFrames:sequence.totalFrames,safeZone:{x:.08,y:.08,width:.84,height:.72},captionZone:{x:.07,y:.72,width:.86,height:.2},layers:[],unresolved:[]};
const presets = {
  DirectorSequence: sequence,
  CharacterPreview: studioSequence("character"),
  ResourcePlayground: studioSequence("prop"),
  EnvironmentPreview: studioSequence("environment"),
  ShotBuilder: {
    ...sequence,
    shots: [{ ...sequence.shots[0], startFrame: 0 }],
    scenes: [],
    totalFrames: 90,
    totalDuration: 3,
    captions: [],
  },
};
const Root = () => (
  <>
    <Composition id="DirectedSequence" component={DirectedRenderer} defaultProps={{direction:defaultDirection}} durationInFrames={90} fps={30} width={480} height={854} calculateMetadata={({props})=>{const d=validateDirected(props.direction);return {durationInFrames:d.totalFrames,fps:d.fps,width:d.width,height:d.height};}}/>
    <Composition id="EditorialVisualSequence" component={EditorialVisualRenderer} defaultProps={{sequence,visualPlan:emptyVisualPlan,bindings:[]}} durationInFrames={sequence.totalFrames} fps={sequence.fps} width={sequence.width} height={sequence.height} calculateMetadata={({props})=>{validateVisualPayload(props.sequence,props.visualPlan,props.bindings);return {durationInFrames:props.sequence.totalFrames,fps:props.sequence.fps,width:props.sequence.width,height:props.sequence.height};}}/>
    {Object.entries(presets).map(([id, s]) => (
      <Composition
        key={id}
        id={id}
        component={SequenceRenderer}
        defaultProps={{ sequence: s }}
        durationInFrames={s.totalFrames}
        fps={s.fps}
        width={s.width}
        height={s.height}
        calculateMetadata={({ props }) => {
          const s = validateSequence(props.sequence as ProceduralSequence);
          return {
            durationInFrames: s.totalFrames,
            fps: s.fps,
            width: s.width,
            height: s.height,
          };
        }}
      />
    ))}
  </>
);
registerRoot(Root);
