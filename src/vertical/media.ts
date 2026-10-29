import {mkdir,writeFile,readFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {jsonHash} from '../editorial/fingerprint';
import {finalizeGroundedWriter} from '../writer';
import {sentences} from '../semantics/sentences';
import {narration,ffprobePath} from '../engine3d/audio/narration';
import {ffmpegExecutable} from '../sound/tools';
import {decodeAudio,audioQa} from '../sound/mixer';
import {evaluateDirected} from '../engine3d/directed';
import {directedSamples,motionMetrics} from '../engine3d/directed-metrics';
import type {DirectedSequence} from '../engine3d/directed';
import type {MediaInput} from './run';
/** Phase 25 media stages (VOICE → MP4_VALIDATION) for a vertical slice. This is the
 * Phase 19 grounded render path moved into versioned code: edge-tts narration of the
 * exact script units, measured-duration finalization, the existing DirectedSequence
 * composition, integer PCM budgets per narrative unit, mux and full decode. It adds no
 * scenes, text or assets; every input comes from the writer finalization. */
const run=promisify(execFile);
export async function produceMedia(m:MediaInput,out:string,label:string){
 const f=(n:string)=>path.join(out,n),save=async(n:string,x:unknown)=>{await mkdir(path.dirname(f(n)),{recursive:true});await writeFile(f(n),typeof x==='string'?x:JSON.stringify(x,null,2));return path.relative(process.cwd(),f(n)).replace(/\\/g,'/');};
 const writer=m.writer,script=writer.finalCandidate!.script,timing:Record<string,number>={};
 let tracks:Awaited<ReturnType<typeof narration>>[]=[],final!:ReturnType<typeof finalizeGroundedWriter>,s!:DirectedSequence;
 if(!await m.stage('VOICE',writer.fingerprint,async()=>{const t0=performance.now();
  const units=sentences({version:1,id:'grounded-voice',language:'pt-BR',script});
  for(const u of units)tracks.push(await narration(u.id,u.sourceSpan.text,30));
  if(tracks.map(t=>t.text).join('')!==units.map(u=>u.sourceSpan.text).join(''))throw Error('VOICE_SOURCE_EXACT');
  final=finalizeGroundedWriter(writer,m.pack,tracks.map(t=>({unitId:t.sceneId,durationSeconds:t.durationFrames/30})));timing.voiceMs=performance.now()-t0;
  return{status:final.productionReady?'PASS':'BLOCKED',reason:'FINALIZATION durationSeconds='+final.durationSeconds.toFixed(2)+' durationPassed='+final.durationPassed+' productionReady='+final.finalPreflight.productionReady,output:final.fingerprint,diagnostics:{units:units.length,voice:'pt-BR-AntonioNeural +0% +0Hz (edge-tts)',durationSeconds:final.durationSeconds,durationPassed:final.durationPassed,tracks:tracks.map(t=>({unit:t.sceneId,frames:t.durationFrames,audio:t.relativeAudioPath}))},artifacts:[await save('voice/tracks.json',tracks),await save('writer/finalization.json',final)]};}))return null;
 const c=final.finalPreflight.compiled,p=final.finalPreflight.plan;
 if(!await m.stage('EDITORIAL',final.fingerprint,async()=>{
  if(c.items.length!==1||!c.items[0].sequence)return{status:'BLOCKED',reason:'MULTI_ITEM_OR_MISSING_SEQUENCE items='+c.items.length};
  s=c.items[0].sequence;const maxWords=Math.max(...s.captions.map(q=>q.text.trim().split(/\s+/).length));
  return{status:maxWords<=3&&s.captions.length>0?'PASS':'BLOCKED',reason:'CAPTION_CONTRACT maxWords='+maxWords,output:jsonHash(s.captions),diagnostics:{captions:s.captions.length,maxCaptionWords:maxWords,captionsEstimated:true,sfx:'NONE — no existing SFX approval covers these events; voice priority preserved',onScreenText:s.shots.map(x=>x.onScreenText??null)}};}))return null;
 const samplesPerFrame=96000/s.fps,pcmFile=f('render/work/voice.f32');let roundingPadFrames=0;
 if(!await m.stage('COMPOSITION',jsonHash(s),async()=>{
  if(!Number.isInteger(samplesPerFrame))throw Error('Integer PCM sample budget required');
  const ffmpeg=ffmpegExecutable(),pcm=new Float32Array(s.totalFrames*samplesPerFrame);let offset=0;
  for(const t of tracks){const allocated=p.clauseTiming.filter(x=>x.unitId===t.sceneId).reduce((n,x)=>n+x.endFrame-x.startFrame,0),budget=allocated*samplesPerFrame;
   if(allocated<t.durationFrames)throw Error('Narrative unit cannot shorten measured speech');
   const data=await decodeAudio(ffmpeg,path.resolve('public',t.relativeAudioPath));if(data.length>budget)throw Error('Audio exceeds allocated narrative frame unit');
   pcm.set(data,offset);offset+=budget;roundingPadFrames+=allocated-t.durationFrames;}
  if(offset!==pcm.length)throw Error('TTS narrative frame budgets mismatch');
  await mkdir(path.dirname(pcmFile),{recursive:true});await writeFile(pcmFile,Buffer.from(pcm.buffer));
  return{status:'PASS',output:createHash('sha256').update(Buffer.from(pcm.buffer)).digest('hex'),diagnostics:{frames:s.totalFrames,fps:s.fps,width:s.width,height:s.height,roundingPadFrames,layers:['DirectedSequence 3D','captions lower third','voice']},artifacts:[await save('sequence/final-sequence.json',s)]};}))return null;
 const native=f('render/work/native.mp4'),output=f('render/'+label+'.mp4'),q=(x:number)=>Math.min(s.totalFrames-1,Math.max(0,Math.round(x)));
 const keyFrames=[...new Set([0,q(s.totalFrames*.25),q(s.totalFrames*.5),q(s.totalFrames*.75),s.totalFrames-1,...(s.demonstration?.steps??[]).flatMap(t=>[q(t.startFrame),q(t.endFrame)])])].sort((a,b)=>a-b);
 if(!await m.stage('RENDER',jsonHash(s),async()=>{const t0=performance.now(),{bundle}=await import('@remotion/bundler'),{openBrowser,selectComposition,renderMedia,renderStill}=await import('@remotion/renderer'),opts={gl:'angle' as const};
  await mkdir(f('qa/frames'),{recursive:true});const serveUrl=await bundle({entryPoint:path.resolve('src/index.tsx'),publicDir:path.resolve('public')}),browser=await openBrowser('chrome',{chromiumOptions:opts});
  try{const composition=await selectComposition({serveUrl,id:'DirectedSequence',inputProps:{direction:s},chromiumOptions:opts,puppeteerInstance:browser});
   for(const frame of keyFrames)await renderStill({serveUrl,composition,inputProps:{direction:s},frame,output:f('qa/frames/still-'+String(frame).padStart(4,'0')+'.png'),chromiumOptions:opts,puppeteerInstance:browser});
   const r0=performance.now();await renderMedia({serveUrl,composition,inputProps:{direction:s},codec:'h264',crf:20,outputLocation:native,chromiumOptions:opts,puppeteerInstance:browser,concurrency:2});timing.nativeRenderMs=performance.now()-r0;}
  finally{await browser.close({silent:true});}
  await run(ffmpegExecutable(),['-v','error','-y','-i',native,'-f','f32le','-ar','48000','-ac','2','-i',pcmFile,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t',String(s.totalFrames/s.fps),'-metadata','title='+m.topic,'-metadata','comment=REAL_WEB_SNAPSHOTS; GROUNDED_ONLY; EvidencePack='+m.pack.fingerprint+'; Writer='+writer.fingerprint,output]);
  timing.renderWallMs=performance.now()-t0;return{status:'PASS',output:createHash('sha256').update(await readFile(output)).digest('hex'),diagnostics:{keyFrames,timing},artifacts:[path.relative(process.cwd(),output).replace(/\\/g,'/')]};}))return null;
 let manifest:Record<string,unknown>|null=null;
 await m.stage('MP4_VALIDATION',output,async()=>{const ffmpeg=ffmpegExecutable();
  await run(ffmpeg,['-v','error','-xerror','-i',output,'-f','null','-']);
  const meta=JSON.parse((await run(ffprobePath(),['-v','error','-show_streams','-show_format','-of','json',output])).stdout),v=meta.streams.find((x:{codec_type:string})=>x.codec_type==='video'),a=meta.streams.find((x:{codec_type:string})=>x.codec_type==='audio');
  const issues:string[]=[];
  if(!v)issues.push('NO_VIDEO');if(!a)issues.push('NO_AUDIO');
  if(v&&(Number(v.nb_frames)!==s.totalFrames||v.width!==s.width||v.height!==s.height||v.r_frame_rate!==s.fps+'/1'))issues.push('VIDEO_GEOMETRY');
  if(a&&(a.sample_rate!=='48000'||a.channels!==2))issues.push('AUDIO_FORMAT');
  if(v&&a&&Math.abs(Number(v.duration)-Number(a.duration))>.055)issues.push('AV_DURATION_MISMATCH');
  const duration=Number(meta.format.duration);if(!(duration>=40&&duration<=60))issues.push('DURATION_OUT_OF_TARGET');
  await mkdir(f('qa/encoded'),{recursive:true});
  for(const frame of keyFrames)await run(ffmpeg,['-v','error','-y','-i',output,'-vf','select=eq(n\\,'+frame+')','-vsync','0','-frames:v','1',f('qa/encoded/frame-'+String(frame).padStart(4,'0')+'.png')]);
  const aq=await audioQa(ffmpeg,output);if(!aq.passed)issues.push('AUDIO_QA');
  const bytes=await readFile(output),sha256=createHash('sha256').update(bytes).digest('hex');
  const motion={metrics:motionMetrics(directedSamples(s),s.fps,s.width,s.height),demonstration:(s.demonstration?.steps??[]).map(t=>{const a0=evaluateDirected(s,t.startFrame).state.demonstration?.subjects[t.target],a1=evaluateDirected(s,Math.min(s.totalFrames-1,t.endFrame)).state.demonstration?.subjects[t.target];return{operation:t.operation,target:t.target,startFrame:t.startFrame,endFrame:t.endFrame,before:a0?.parameters??null,after:a1?.parameters??null,changed:jsonHash(a0)!==jsonHash(a1)};})};
  manifest={path:path.relative(process.cwd(),output).replace(/\\/g,'/'),sha256,bytes:bytes.length,duration,video:{codec:v?.codec_name,width:v?.width,height:v?.height,fps:v?.r_frame_rate,frames:Number(v?.nb_frames)},audio:{codec:a?.codec_name,sampleRate:a?.sample_rate,channels:a?.channels},formatTags:meta.format.tags,audioQa:aq,motion,keyFrames,timing,roundingPadFrames,finalizationFingerprint:final.fingerprint,sequenceFingerprint:jsonHash(s),planFingerprint:p.fingerprint,compiledFingerprint:c.fingerprint};
  await save('render/mp4-manifest.json',manifest);
  return{status:issues.length?'FAILED':'PASS',reason:issues.join(','),output:sha256,diagnostics:manifest};});
 return manifest;
}
