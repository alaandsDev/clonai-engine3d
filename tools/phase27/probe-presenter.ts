import {readFileSync} from 'node:fs';
import {renderStills,contactSheet} from '../../src/visual-causal/media';
import {validateDirected,projectPosition,evaluateDirected,type DirectedSequence} from '../../src/engine3d/directed';
/** Dev probe: where does the renderer draw the presenter for a given state position? */
const base=JSON.parse(readFileSync('out/engine3d/phase27/attempts/attempt-1/sequence.json','utf8')) as DirectedSequence;
const files:string[]=[];
for(const x of [-0.5,0,1]){
 const s=structuredClone(base);s.blocking=[];s.actionSegments=[];const p:[number,number,number]=[x,0,1.15];
 s.baseShot.characters[0].position=p;s.initialState.actors.presenter={position:p,facing:0};s.finalState=evaluateDirected({...s,finalState:s.initialState},s.totalFrames).state;
 const v=validateDirected(s);console.log(x,JSON.stringify(projectPosition(p,evaluateDirected(v,0).state.camera,480,854)));
 files.push(...await renderStills(v,[0],'out/engine3d/phase27/attempts/attempt-1/probe-presenter-'+String(x).replace('.','_')));
}
await contactSheet(files,'out/engine3d/phase27/attempts/attempt-1/probe-presenter.png',3);
