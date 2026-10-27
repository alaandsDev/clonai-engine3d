import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderMedia,renderStill,selectComposition} from '@remotion/renderer';
import {registry} from '../src/engine3d/registry';
import {compileDirectorPlan} from '../src/engine3d/director';
import {resolveShot} from '../src/engine3d/validation';
import {narration,FakeNarrationProvider} from '../src/engine3d/audio/narration';
import type {DirectorPlan,ResourceType} from '../src/engine3d/contracts';
const [command,...args]=process.argv.slice(2);const out=path.resolve('out/engine3d');await mkdir(out,{recursive:true});
const json=async(file:string,value:unknown)=>writeFile(file,JSON.stringify(value,null,2));
const input=async()=>JSON.parse(await readFile(args.find(a=>!a.startsWith('--'))??'examples/cold-opening.json','utf8'));
try{
if(command==='catalog'){await json(path.join(out,'catalog.json'),registry.entries);console.log(`Catalog: ${registry.entries.length} resources`)}
else if(command==='search'){const type=args[args.indexOf('--type')+1],tag=args[args.indexOf('--tag')+1];console.log(JSON.stringify(registry.entries.filter(r=>(!args.includes('--type')||r.type===type)&&(!args.includes('--tag')||r.tags.includes(tag))),null,2))}
else if(command==='resolve-shot'){console.log(JSON.stringify(resolveShot(await input()),null,2))}
else if(['director','render-director','previews'].includes(command)){
 const plan=await input() as DirectorPlan;compileDirectorPlan({...plan,timingMode:'fixed'});
 const tracks=[];if(args.includes('--narrated')||plan.timingMode==='narration'){for(const scene of plan.scenes)tracks.push(await narration(scene.id,scene.narration,plan.format.fps,args.includes('--fake')?new FakeNarrationProvider():undefined));plan.timingMode='narration'}
 const sequence=compileDirectorPlan(plan,tracks);await json(path.join(out,'storyboard.json'),sequence);await json(path.join(out,'audio-manifest.json'),tracks);console.log(JSON.stringify({cast:plan.cast,scenes:sequence.scenes,shots:sequence.shots.map(s=>({id:s.id,startFrame:s.startFrame,endFrame:s.endFrame,resources:[s.environment.resourceId,...s.characters.map(c=>c.resourceId),...s.props.map(c=>c.resourceId),...s.actions.map(c=>c.resourceId),...s.vfx.map(c=>c.resourceId),s.camera.resourceId]})),continuity:'validated',status:'OK'},null,2));
 if(command!=='director'){console.log('Bundling generic renderer…');const serveUrl=await bundle({entryPoint:path.resolve('src/index.tsx'),publicDir:path.resolve('public')});const inputProps={sequence};const chromiumOptions={gl:'angle' as const};const composition=await selectComposition({serveUrl,id:'DirectorSequence',inputProps,chromiumOptions});
 if(command==='previews'){const directory=path.join(out,'previews');await mkdir(directory,{recursive:true});for(const shot of sequence.shots)for(const [label,offset]of [['start',0],['middle',Math.floor(shot.durationFrames/2)],['end',shot.durationFrames-1]] as const){await renderStill({serveUrl,composition,inputProps,frame:shot.startFrame+offset,output:path.join(directory,`${shot.id}-${label}.png`),chromiumOptions});console.log(`${shot.id}-${label}.png`)}}
 else {const outputLocation=path.join(out,`${plan.id}${tracks.length?'-narrated':''}.mp4`);await renderMedia({serveUrl,composition,inputProps,codec:'h264',audioCodec:'aac',outputLocation,chromiumOptions,concurrency:2,onProgress:({progress})=>{if(Math.floor(progress*100)%10===0)process.stdout.write(`\rRender ${Math.round(progress*100)}%`)}});console.log(`\n${outputLocation}`)}
 }
}else throw new Error(`Unknown command ${command}`);
}catch(e){console.error(e);process.exitCode=1}
