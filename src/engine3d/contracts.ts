export type Vec3 = [number, number, number];
export type ResourceType = 'character'|'environment'|'prop'|'action'|'camera'|'vfx'|'scenePreset';
export type Anchor = 'head'|'face'|'leftHand'|'rightHand'|'chest';
export interface Resource {id:string;type:ResourceType;name:string;description:string;tags:string[];status:'available'|'experimental'|'deprecated';source:string;capabilities:string[];metadata:{parameters:Record<string,{min?:number;max?:number}>;compatibleCharacters?:string[];anchors?:Anchor[];performanceClass:'light'|'medium'}}
export interface Transform {position?:Vec3;rotation?:Vec3;scale?:Vec3}
export interface Instance extends Transform {instanceId:string;resourceId:string;parameters?:Record<string,number>;continuityKey?:string;initialState?:Record<string,number>;finalState?:Record<string,number>}
export interface Binding {resourceId:string;start:number;end:number;actor?:string;target?:string;anchor?:Anchor;targetPosition?:Vec3;direction?:Vec3;parameters?:Record<string,number>}
export interface ShotSpec {id:string;durationSeconds:number;environment:{resourceId:string};characters:Instance[];props:Instance[];actions:Binding[];vfx:Binding[];camera:{resourceId:string;parameters?:Record<string,number>};onScreenText?:string;visualIntent?:string;narrationSegment?:string}
export interface DirectorShot extends Omit<ShotSpec,'environment'|'characters'> {order:number;environment?:{resourceId:string};characters:(Omit<Instance,'resourceId'>&{castId:string;resourceId?:string})[];transition?:string}
export interface DirectorScene {id:string;order:number;narration:string;environment:{resourceId:string};shots:DirectorShot[]}
export interface DirectorPlan {id:string;title:string;format:{width:number;height:number;fps:number};style:string;cast:Record<string,string>;timingMode:'fixed'|'narration';scenes:DirectorScene[]}
export interface CaptionCue {text:string;startFrame:number;endFrame:number}
export interface NarrationTrack {sceneId:string;text:string;spokenText:string;provider:string;voice:string;durationSeconds:number;durationFrames:number;relativeAudioPath:string;cacheKey:string;timingSource:'tts_boundary'|'estimated_proportional'}
export interface SequenceShot extends ShotSpec {sceneId:string;startFrame:number;endFrame:number;durationFrames:number}
export interface ProceduralSequence {id:string;title:string;fps:number;width:number;height:number;totalDuration:number;totalFrames:number;scenes:{id:string;narration:string;startFrame:number;durationFrames:number;audio?:NarrationTrack}[];shots:SequenceShot[];captions:CaptionCue[]}
export class EngineError extends Error {constructor(public code:string, message:string){super(`${code}: ${message}`);this.name='EngineError'}}
export const fail=(code:string,message:string):never=>{throw new EngineError(code,message)};
