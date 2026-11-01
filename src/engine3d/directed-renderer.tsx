import React, { useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import { validateDirected, evaluateDirected, type DirectedSequence } from './directed';
import { SequenceRenderer, ProceduralShot } from './renderer';
import type { ProceduralSequence } from './contracts';
import {DemonstrationGeometry,environmentStyleOf} from './demonstration-geometry';
import { OverlayLayer } from './overlay-layer';
/** Generic continuous world driven by JSON; captions use the existing renderer. */
export function DirectedRenderer({ direction: input }: {
    direction: DirectedSequence;
}) {
    const direction = useMemo(() => validateDirected(input), [input]), frame = useCurrentFrame(), e = evaluateDirected(direction, frame);
    const sequence = useMemo<ProceduralSequence>(() => ({ id: direction.id, title: direction.id, fps: direction.fps, width: direction.width, height: direction.height, totalFrames: direction.totalFrames, totalDuration: direction.totalFrames / direction.fps, scenes: [], shots: [{ ...direction.baseShot, sceneId: 'continuous', startFrame: 0, endFrame: direction.totalFrames, durationFrames: direction.totalFrames }], captions: direction.overlay ? [] : direction.captions }), [direction]);
    // Explainer overlay (one-word captions, labels, time marks) replaces the phrase captions when present.
    const overlay = direction.overlay ? <OverlayLayer overlay={direction.overlay} frame={frame} camera={e.state.camera} subjects={e.state.demonstration?.subjects as never} width={direction.width} height={direction.height} /> : undefined;
    return <SequenceRenderer sequence={sequence} editorialLayers={overlay} world={<ProceduralShot shot={e.shot} environmentState={e.state.demonstration?.environment} environmentStyle={environmentStyleOf(direction.demonstration,e.state.demonstration)} worldExtras={direction.demonstration&&e.state.demonstration?<DemonstrationGeometry program={direction.demonstration} state={e.state.demonstration} frame={frame} fps={direction.fps}/>:undefined} directed={{ camera: e.state.camera, poses: e.poses, visibleProps: e.visibleProps,presenterVisible:e.state.demonstration?.presenterMode!=='DEMONSTRATION',propHighlights:Object.fromEntries(Object.entries(e.state.demonstration?.subjects??{}).map(([id,s])=>[id,s.parameters.highlight??0])) }}/>}/>;
}
