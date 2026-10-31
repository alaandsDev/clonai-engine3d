import {readFileSync,statSync,writeFileSync,mkdirSync,existsSync,lstatSync,realpathSync} from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import dns from 'node:dns';
import {jsonHash} from '../editorial/fingerprint';
import {execFileSync} from 'node:child_process';
import {ffmpegExecutable} from '../sound/tools';
import {ffprobePath} from '../engine3d/audio/narration';
import {cacheKey} from '../engine3d/audio/narration';
import {paceNarration,SCRIPT_NARRATION_CONFIG,type PauseKind} from '../engine3d/audio/pacing';
import {planVisualCausal} from '../visual-causal/planner';
import {validateVisualPlan,inventedFactualRelations} from '../visual-causal/verify';
import {compileVisualPlan} from '../visual-causal/compile';
import {visualQa} from '../visual-causal/qa';
import {synthesize,sentenceTiming,renderMp4,validateMp4,extractFrames,contactSheet,type VoiceTrack} from '../visual-causal/media';
import {ingestScript,MAX_SCRIPT_CHARS} from './ingest';
import {understandScript} from './understand';
import {plannerInputFromScript} from './input';
import {scriptCoverage,scriptProvenance,scriptMetrics} from './report';
import {directionMetrics} from '../visual-causal/direction-metrics';
import {productionPreflight,preflightText} from '../production/preflight';
import {PRODUCTION_PROFILE} from '../production/profile';
import {productionRenderGate} from '../production/render-gate';
/** One-command Script Mode generation (I/O shell around the pure core): script file → artifacts → MP4.
 * No Research, Evidence, StoryNeed or web access; outbound in-process network is refused. The only
 * external service is the existing edge-tts narration, used once per uncached sentence. */
const ALLOWED_EXT=new Set(['.txt','.md']);
/** Path safety: a regular text file inside the project tree, bounded size, no symlink escape. */
export function readScriptFile(file:string,root=process.cwd()){
 const abs=path.resolve(root,file),rootReal=realpathSync(root);
 if(!existsSync(abs))throw Error('SCRIPT_PATH not found: '+file);
 if(lstatSync(abs).isSymbolicLink())throw Error('SCRIPT_PATH symbolic links are refused');
 const real=realpathSync(abs),rel=path.relative(rootReal,real);
 if(rel.startsWith('..')||path.isAbsolute(rel))throw Error('SCRIPT_PATH must be inside the project directory');
 if(!ALLOWED_EXT.has(path.extname(real).toLowerCase()))throw Error('SCRIPT_PATH only .txt/.md scripts are accepted');
 const st=statSync(real);if(!st.isFile())throw Error('SCRIPT_PATH not a regular file');if(st.size>MAX_SCRIPT_CHARS*4)throw Error('SCRIPT_PATH file too large');
 return readFileSync(real,'utf8');
}
/** In-process network guard: loopback (Remotion bundle server, local browser) is allowed; anything else is refused and counted. */
export function installNetworkGuard(){
 const counters={external:0,loopback:0,blocked:[] as string[]};
 const local=(h:unknown)=>typeof h!=='string'||h===''||/^(?:localhost|127\.\d+\.\d+\.\d+|::1|\[::1\]|0\.0\.0\.0|::)$/i.test(h);
 const hostOf=(a:unknown[]):unknown=>{const x=a[0];if(typeof x==='string'){try{return new URL(x).hostname;}catch{return x;}}if(x instanceof URL)return x.hostname;if(x&&typeof x==='object')return(x as {hostname?:string;host?:string}).hostname??(x as {host?:string}).host??'localhost';return'localhost';};
 const wrap=<T extends object>(mod:T,key:string)=>{const orig=(mod as Record<string,unknown>)[key] as (...a:unknown[])=>unknown;(mod as Record<string,unknown>)[key]=(...a:unknown[])=>{const h=hostOf(a);if(!local(h)){counters.external++;counters.blocked.push(key+':'+String(h));throw Error('SCRIPT_MODE_NETWORK_FORBIDDEN '+String(h));}counters.loopback++;return orig.apply(mod,a);};return()=>{(mod as Record<string,unknown>)[key]=orig;};};
 const restore=[wrap(http,'request'),wrap(http,'get'),wrap(https,'request'),wrap(https,'get'),wrap(net,'connect'),wrap(net,'createConnection')];
 const origLookup=dns.lookup;(dns as {lookup:unknown}).lookup=((host:string,...rest:unknown[])=>{if(!local(host)&&!net.isIP(String(host))){counters.external++;counters.blocked.push('dns:'+host);const cb=rest.at(-1);if(typeof cb==='function')(cb as (e:Error)=>void)(Error('SCRIPT_MODE_NETWORK_FORBIDDEN '+host));return;}return(origLookup as unknown as (...a:unknown[])=>unknown)(host,...rest);}) as typeof dns.lookup;
 const origFetch=globalThis.fetch;globalThis.fetch=((input:unknown,init?:unknown)=>{const h=hostOf([input]);if(!local(h)){counters.external++;counters.blocked.push('fetch:'+String(h));return Promise.reject(Error('SCRIPT_MODE_NETWORK_FORBIDDEN '+String(h)));}counters.loopback++;return origFetch(input as string,init as RequestInit);}) as typeof fetch;
 return{counters,restore:()=>{restore.forEach(r=>r());(dns as {lookup:unknown}).lookup=origLookup;globalThis.fetch=origFetch;}};
}
export interface GenerateOptions {scriptPath?:string;scriptText?:string;outDir:string;fps?:number;render?:boolean;environmentId?:string;label?:string}
export async function generateFromScript(o:GenerateOptions){
 const fps=o.fps??30,t0=performance.now(),guard=installNetworkGuard();
 let preflightSaved=false;
 const save=(n:string,x:unknown)=>{const f=path.join(o.outDir,n);mkdirSync(path.dirname(f),{recursive:true});writeFileSync(f,typeof x==='string'?x:JSON.stringify(x,null,2));return f;};
 try{
  const raw=o.scriptText??readScriptFile(o.scriptPath!);
  const source=ingestScript(raw),t1=performance.now();
  const u=understandScript(source),t2=performance.now();
  const segments=u.segments.map(s=>({id:s.id,text:s.span.text}));
  const cached=segments.filter(s=>existsSync(path.resolve('public','audio',cacheKey(s.text,SCRIPT_NARRATION_CONFIG,'edge-tts')+'.mp3'))).length;
  const rawTracks:VoiceTrack[]=await synthesize(segments,fps,SCRIPT_NARRATION_CONFIG);
  const kinds:PauseKind[]=u.segments.map((s,i)=>{const next=u.segments[i+1];if(!next)return'SHORT_PAUSE';if(source.normalized.slice(s.span.end,next.span.start).includes('\n\n'))return'PARAGRAPH_PAUSE';const here=u.actions.filter(a=>u.claims.some(c=>c.id===a.claimId&&c.segmentId===s.id)),there=u.actions.filter(a=>u.claims.some(c=>c.id===a.claimId&&c.segmentId===next.id));return here.some(a=>there.some(b=>a.entityIds.some(id=>b.entityIds.includes(id))))?'NORMAL_CONTINUATION':'SHORT_PAUSE';});
  const tracks:VoiceTrack[]=await paceNarration(rawTracks,kinds,fps),t3=performance.now();
  const timing=sentenceTiming(tracks,8),input={...plannerInputFromScript(u,timing,fps,o.environmentId),hybridEditorial:{enabled:true as const}},plan=planVisualCausal(input);
  const validation=validateVisualPlan(plan,input.relations.map(r=>r.id));
  if(!validation.valid)throw Error('SCRIPT_PLAN_INVALID '+validation.issues.join(','));
  const seq=compileVisualPlan(plan,{width:PRODUCTION_PROFILE.output.width,height:PRODUCTION_PROFILE.output.height,sentences:timing.map(t=>({id:t.sentenceId,text:segments.find(s=>s.id===t.sentenceId)!.text,startFrame:t.startFrame,endFrame:t.endFrame}))}),t4=performance.now();
  const qa=visualQa(plan,seq),coverage=scriptCoverage(u,plan),provenance=scriptProvenance(u,plan,seq),metrics=scriptMetrics(u,plan,qa,coverage);
  save('script.txt',raw);save('script-normalized.txt',source.normalized);save('semantic-claims.json',u);save('planner-input.json',input);save('raw-tracks.json',rawTracks);save('tracks.json',tracks);save('visual-plan.json',plan);save('directed-sequence.json',seq);save('qa.json',qa);save('script-provenance.json',provenance);save('coverage.json',coverage);
  const dependencyIssues=tracks.filter(t=>!existsSync(path.resolve('public',t.relativeAudioPath))).map(t=>'Missing TTS track '+t.sentenceId);
  if(o.render!==false){
   try{execFileSync(ffmpegExecutable(),['-version'],{stdio:'ignore'});execFileSync(ffprobePath(),['-version'],{stdio:'ignore'});}catch{dependencyIssues.push('FFmpeg/ffprobe unavailable');}
  }
  const preflight=productionPreflight({input,plan,sequence:seq,qa,dependencyIssues});
  save('hybrid-editorial.json',plan.hybridEditorial);save('hybrid-editorial-qa.json',preflight.hybridEditorial);
  save('production-preflight.json',preflight);save('production-preflight.md',preflightText(preflight));preflightSaved=true;
  let mp4:Record<string,unknown>|null=null,render={nativeMs:0,wallMs:0},frames:string[]=[];
  if(o.render!==false&&preflight.productionReady){
   const file=path.join(o.outDir,(o.label??'video')+'.mp4');
   const authorized=await productionRenderGate(preflight,seq,r=>{save('production-preflight.json',r);save('production-preflight.md',preflightText(r));},()=>renderMp4(seq,tracks,timing,file,{title:input.topic,comment:'PHASE29_SCRIPT_MODE; source=USER_SCRIPT; script='+source.fingerprint+'; plan='+plan.fingerprint}));
   if(authorized.status!=='RENDERED')throw Error('PRODUCTION_AUTHORIZATION_CHANGED');
   render=authorized.result!;
   const mv=await validateMp4(file,seq);mp4={path:file.replace(/\\/g,'/'),...mv};
   const q=(x:number)=>Math.min(seq.totalFrames-1,Math.round(x)),pct=Array.from({length:21},(_,i)=>q(i*(seq.totalFrames-1)/20)),mids=plan.beats.map(b=>q((b.startFrame+b.endFrame)/2));
   frames=await extractFrames(file,[...new Set([...pct,...mids])].sort((a,b)=>a-b),path.join(o.outDir,'frames'));
   await contactSheet(await extractFrames(file,pct,path.join(o.outDir,'frames-pct')),path.join(o.outDir,'contact-sheet.png'),7);
   await contactSheet(await extractFrames(file,mids,path.join(o.outDir,'frames-beats')),path.join(o.outDir,'contact-sheet-beats.png'),5);
  }
  const t5=performance.now();
  const summary={productionPreflight:preflight,sourceType:source.sourceType,script:source.fingerprint,plan:plan.fingerprint,sequence:jsonHash(seq),mp4,frames:frames.length,metrics,coverage:coverage.summary,direction:directionMetrics(plan),gaps:plan.gaps,invented:inventedFactualRelations(plan,input.relations.map(r=>r.id)),
   qa:{dims:qa.dims,spatial:qa.spatial,offFrameChanges:qa.offFrameChanges,causalCamera:qa.causalCamera,semanticSync:qa.semanticSync,readability:qa.readability,meaningfulStasis:qa.meaningfulStasis,demonstrationQa:qa.demonstrationQa,longestMeaningfulStasisSeconds:qa.longestMeaningfulStasisSeconds,shots:qa.shots,cuts:qa.cuts,proof:qa.proof,continuityIssues:qa.continuityIssues.length},
   network:{researchCalls:0,evidenceRequired:0,storyNeedCalls:0,externalInProcessCalls:guard.counters.external,blocked:guard.counters.blocked,ttsServiceSentences:segments.length-cached,ttsCachedSentences:cached},
   performance:{ingestionMs:t1-t0,semanticsMs:t2-t1,ttsMs:t3-t2,planningMs:t4-t3,renderMs:render.wallMs,totalMs:t5-t0}};
  save('summary.json',summary);
  return{summary,plan,seq,qa,u,input,coverage};
 }catch(error){
  if(!preflightSaved){const blocked={version:1,profile:PRODUCTION_PROFILE.id,stage:'PREPARATION',productionReady:false,decision:'RENDER BLOCKED',blockers:[{severity:'BLOCKER',category:'TECHNICAL',code:'PREPARATION_FAILED',message:String(error)}]};save('production-preflight.json',blocked);save('production-preflight.md','PRODUCTION_READY: NO\nRENDER BLOCKED\n'+String(error));}
  throw error;
 }finally{guard.restore();}
}
