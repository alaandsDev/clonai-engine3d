import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {decodeAudio} from '../../sound/mixer';
import {ffmpegExecutable} from '../../sound/tools';
import type {VoiceTrack} from '../../visual-causal/media';
import {defaultConfig} from './narration';
export const SCRIPT_NARRATION_CONFIG=Object.freeze({...defaultConfig,rate:'-3%'});
export type PauseKind='NORMAL_CONTINUATION'|'SHORT_PAUSE'|'PARAGRAPH_PAUSE'|'DRAMATIC_PAUSE';
export const PACING=Object.freeze({version:1,thresholdDb:-45,windowSeconds:.01,guardSeconds:.09,minTrimSeconds:.12,pauses:{NORMAL_CONTINUATION:.22,SHORT_PAUSE:.29,PARAGRAPH_PAUSE:.42,DRAMATIC_PAUSE:.60}});
/** Acoustic quiet, not phoneme recognition. Only boundary silence is removed;
 * every sample between the first and last detected activity is preserved. */
export function boundaryTrim(pcm:Float32Array,sampleRate=48000,channels=2){
 if(!pcm.length||pcm.length%channels||sampleRate<8000)throw Error('PACING_INVALID_PCM');
 const frames=pcm.length/channels,block=Math.max(1,Math.round(sampleRate*PACING.windowSeconds)),active:number[]=[];
 for(let a=0;a<frames;a+=block){const end=Math.min(frames,a+block);let energy=0;for(let i=a*channels;i<end*channels;i++)energy+=pcm[i]*pcm[i];if(Math.sqrt(energy/((end-a)*channels))>=10**(PACING.thresholdDb/20))active.push(a);}
 if(!active.length)throw Error('PACING_SILENT_CLIP');
 const first=active[0],last=Math.min(frames,active.at(-1)!+block),guard=Math.ceil(PACING.guardSeconds*sampleRate);
 const lead=first/sampleRate,tail=(frames-last)/sampleRate;
 const start=lead>=PACING.minTrimSeconds?Math.max(0,first-guard):0,end=tail>=PACING.minTrimSeconds?Math.min(frames,last+guard):frames;
 return{start,end,frames,leadingSeconds:lead,trailingSeconds:tail,keptLeadingSeconds:(first-start)/sampleRate,keptTrailingSeconds:(end-last)/sampleRate,removedSeconds:(frames-(end-start))/sampleRate};
}
function floatWav(pcm:Float32Array){const b=Buffer.alloc(44+pcm.byteLength);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(3,20);b.writeUInt16LE(2,22);b.writeUInt32LE(48000,24);b.writeUInt32LE(384000,28);b.writeUInt16LE(8,32);b.writeUInt16LE(32,34);b.write('data',36);b.writeUInt32LE(pcm.byteLength,40);for(let i=0;i<pcm.length;i++)b.writeFloatLE(pcm[i],44+i*4);return b;}
export async function paceNarration(tracks:VoiceTrack[],kinds:PauseKind[],fps:number,root=process.cwd()):Promise<VoiceTrack[]>{
 if(kinds.length!==tracks.length||!Number.isInteger(fps)||fps<1)throw Error('PACING_TIMELINE_INPUT');
 const ff=ffmpegExecutable(),out:VoiceTrack[]=[];
 for(let i=0;i<tracks.length;i++){
  const t=tracks[i],file=path.join(root,'public',t.relativeAudioPath),pcm=await decodeAudio(ff,file),trim=boundaryTrim(pcm),kept=pcm.slice(trim.start*2,trim.end*2),key=createHash('sha256').update(await readFile(file)).update(JSON.stringify(PACING)).update(JSON.stringify(trim)).digest('hex'),rel='audio/paced/'+key+'.wav';
  await mkdir(path.join(root,'public/audio/paced'),{recursive:true});await writeFile(path.join(root,'public',rel),floatWav(kept));
  out.push({...t,durationFrames:Math.ceil((trim.end-trim.start)/48000*fps),relativeAudioPath:rel,pacing:{...trim,sourceRelativeAudioPath:t.relativeAudioPath,rawDurationSeconds:trim.frames/48000,durationSeconds:(trim.end-trim.start)/48000,pauseKind:kinds[i],pauseSeconds:0,voiceRate:t.voiceRate??'+0%',thresholdDb:PACING.thresholdDb,guardSeconds:PACING.guardSeconds}});
 }
 for(let i=0;i<out.length;i++){const t=out[i],p=t.pacing!,next=out[i+1]?.pacing;
  const retained=p.keptTrailingSeconds+(next?.keptLeadingSeconds??0),rounding=t.durationFrames/fps-p.durationSeconds;
  const desired=next?PACING.pauses[p.pauseKind]:.2;
  t.pauseAfterFrames=Math.max(0,Math.round((desired-retained-rounding)*fps));p.pauseSeconds=t.pauseAfterFrames/fps;
 }
 return out;
}
