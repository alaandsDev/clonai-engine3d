import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {narration,ffprobePath,defaultConfig,type NarrationConfig} from '../engine3d/audio/narration';
import {ffmpegExecutable} from '../sound/tools';
import {decodeAudio,audioQa} from '../sound/mixer';
import type {DirectedSequence} from '../engine3d/directed';
/** Phase 27 media helpers: the Phase19/25 render path (edge-tts narration of exact sentences,
 * existing DirectedSequence composition, integer PCM budgets, mux, full decode). */
const run=promisify(execFile);
export interface VoiceTrack {sentenceId:string;text:string;durationFrames:number;relativeAudioPath:string;voiceRate?:string;pauseAfterFrames?:number;pacing?:{start:number;end:number;frames:number;leadingSeconds:number;trailingSeconds:number;keptLeadingSeconds:number;keptTrailingSeconds:number;removedSeconds:number;sourceRelativeAudioPath:string;rawDurationSeconds:number;durationSeconds:number;pauseKind:import('../engine3d/audio/pacing').PauseKind;pauseSeconds:number;voiceRate:string;thresholdDb:number;guardSeconds:number}}
export async function synthesize(sentences:{id:string;text:string}[],fps:number,config?:NarrationConfig):Promise<VoiceTrack[]>{
 const out:VoiceTrack[]=[];for(const s of sentences){const t=await narration(s.id,s.text,fps,undefined,config??defaultConfig);out.push({sentenceId:s.id,text:s.text,durationFrames:t.durationFrames,relativeAudioPath:t.relativeAudioPath,...(config?{voiceRate:config.rate}:{})});}return out;
}
/** Contiguous sentence windows; each window is exactly the measured speech plus a short pause. */
export function sentenceTiming(tracks:VoiceTrack[],pauseFrames:number){let at=0;return tracks.map((t,i)=>{const len=t.durationFrames+(t.pauseAfterFrames??(i<tracks.length-1?pauseFrames:0)),w={sentenceId:t.sentenceId,startFrame:at,endFrame:at+len};at+=len;return w;});}
export async function renderStills(seq:DirectedSequence,frames:number[],dir:string){
 const {bundle}=await import('@remotion/bundler'),{openBrowser,selectComposition,renderStill}=await import('@remotion/renderer'),opts={gl:'angle' as const};
 await mkdir(dir,{recursive:true});const serveUrl=await bundle({entryPoint:path.resolve('src/index.tsx'),publicDir:path.resolve('public')}),browser=await openBrowser('chrome',{chromiumOptions:opts});const files:string[]=[];
 try{const composition=await selectComposition({serveUrl,id:'DirectedSequence',inputProps:{direction:seq},chromiumOptions:opts,puppeteerInstance:browser});
  for(const f of frames){const file=path.join(dir,'still-'+String(f).padStart(4,'0')+'.png');await renderStill({serveUrl,composition,inputProps:{direction:seq},frame:f,output:file,chromiumOptions:opts,puppeteerInstance:browser});files.push(file);}}
 finally{await browser.close({silent:true});}return files;
}
export async function contactSheet(files:string[],output:string,columns=6){
 const ff=ffmpegExecutable(),rows=Math.ceil(files.length/columns),pad=rows*columns-files.length,inputs=[...files,...Array(pad).fill(files[files.length-1])];
 const layout=inputs.map((_,i)=>`${(i%columns)?Array.from({length:i%columns},(_,k)=>'w'+0).join('+'):'0'}_${Math.floor(i/columns)?Array.from({length:Math.floor(i/columns)},()=>'h0').join('+'):'0'}`).join('|');
 await mkdir(path.dirname(output),{recursive:true});
 await run(ff,['-v','error','-y',...inputs.flatMap(f=>['-i',f]),'-filter_complex',inputs.map((_,i)=>`[${i}]scale=240:-1[s${i}]`).join(';')+';'+inputs.map((_,i)=>`[s${i}]`).join('')+`xstack=inputs=${inputs.length}:layout=${layout}`,output]);
 return output;
}
export async function renderMp4(seq:DirectedSequence,tracks:VoiceTrack[],timing:{sentenceId:string;startFrame:number;endFrame:number}[],output:string,meta:Record<string,string>){
 const {bundle}=await import('@remotion/bundler'),{openBrowser,selectComposition,renderMedia}=await import('@remotion/renderer'),opts={gl:'angle' as const},ff=ffmpegExecutable();
 const work=path.join(path.dirname(output),'work');await mkdir(work,{recursive:true});const native=path.join(work,'native.mp4'),pcmFile=path.join(work,'voice.f32');
 const t0=performance.now(),serveUrl=await bundle({entryPoint:path.resolve('src/index.tsx'),publicDir:path.resolve('public')}),browser=await openBrowser('chrome',{chromiumOptions:opts});let nativeMs=0;
 try{const composition=await selectComposition({serveUrl,id:'DirectedSequence',inputProps:{direction:seq},chromiumOptions:opts,puppeteerInstance:browser});const r0=performance.now();
  await renderMedia({serveUrl,composition,inputProps:{direction:seq},codec:'h264',crf:20,outputLocation:native,chromiumOptions:opts,puppeteerInstance:browser,concurrency:2});nativeMs=performance.now()-r0;}
 finally{await browser.close({silent:true});}
 const spf=96000/seq.fps;if(!Number.isInteger(spf))throw Error('Integer PCM sample budget required');
 const pcm=new Float32Array(seq.totalFrames*spf);
 for(const t of tracks){const w=timing.find(x=>x.sentenceId===t.sentenceId)!,budget=(w.endFrame-w.startFrame)*spf,data=await decodeAudio(ff,path.resolve('public',t.relativeAudioPath));
  if(w.endFrame-w.startFrame<t.durationFrames||data.length>budget)throw Error('Sentence window cannot shorten measured speech');pcm.set(data,w.startFrame*spf);}
 await writeFile(pcmFile,Buffer.from(pcm.buffer));
 await run(ff,['-v','error','-y','-i',native,'-f','f32le','-ar','48000','-ac','2','-i',pcmFile,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t',String(seq.totalFrames/seq.fps),...Object.entries(meta).flatMap(([k,v])=>['-metadata',k+'='+v]),output]);
 return{nativeMs,wallMs:performance.now()-t0};
}
export async function validateMp4(file:string,seq:DirectedSequence){
 const ff=ffmpegExecutable();await run(ff,['-v','error','-xerror','-i',file,'-f','null','-']);
 const meta=JSON.parse((await run(ffprobePath(),['-v','error','-show_streams','-show_format','-of','json',file])).stdout),v=meta.streams.find((x:{codec_type:string})=>x.codec_type==='video'),a=meta.streams.find((x:{codec_type:string})=>x.codec_type==='audio');
 const issues:string[]=[];if(!v)issues.push('NO_VIDEO');if(!a)issues.push('NO_AUDIO');
 if(v&&(Number(v.nb_frames)!==seq.totalFrames||v.width!==seq.width||v.height!==seq.height||v.r_frame_rate!==seq.fps+'/1'))issues.push('VIDEO_GEOMETRY');
 if(a&&(a.sample_rate!=='48000'||a.channels!==2))issues.push('AUDIO_FORMAT');
 if(v&&a&&Math.abs(Number(v.duration)-Number(a.duration))>.055)issues.push('AV_DURATION_MISMATCH');
 const aq=await audioQa(ff,file);if(!aq.passed)issues.push('AUDIO_QA');
 const bytes=await readFile(file);
 return{passed:!issues.length,issues,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,duration:Number(meta.format.duration),video:{codec:v?.codec_name,width:v?.width,height:v?.height,fps:v?.r_frame_rate,frames:Number(v?.nb_frames)},audio:{codec:a?.codec_name,sampleRate:a?.sample_rate,channels:a?.channels},audioQa:aq,tags:meta.format.tags};
}
export async function extractFrames(file:string,frames:number[],dir:string){const ff=ffmpegExecutable();await mkdir(dir,{recursive:true});const files:string[]=[];for(const f of frames){const o=path.join(dir,'frame-'+String(f).padStart(4,'0')+'.png');await run(ff,['-v','error','-y','-i',file,'-vf','select=eq(n\\,'+f+')','-vsync','0','-frames:v','1',o]);files.push(o);}return files;}
