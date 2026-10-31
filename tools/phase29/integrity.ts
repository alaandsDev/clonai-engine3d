import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resources} from '../../src/engine3d/registry';
/** Phase29 integrity (read-only): HEAD/branch, registries, historical MP4s (Phase23 list + Phase25/27/27B finals),
 * the Phase28B preservation manifest (reports, handoff, lockfile, Phase28 outputs) and files touched by Phase29. */
const sha=(f:string)=>existsSync(f)?createHash('sha256').update(readFileSync(f)).digest('hex'):null;
const git=(...a:string[])=>execFileSync('git',a,{encoding:'utf8'}).trim();
const p23=JSON.parse(readFileSync('out/engine3d/phase23/analysis/integrity.json','utf8'));
const videos=[...(p23.videos as {file?:string;path?:string;sha256:string}[]).map(v=>({file:v.path??v.file!,recorded:v.sha256})),
 {file:'out/engine3d/phase25/final/render/final.mp4',recorded:'c901c5a8c6b742fffe4f2d0d203920caa3454fb11a97d0393f853355f999e926'},
 {file:'out/engine3d/phase27/final/phase27-well-final.mp4',recorded:'51823d2f6788df9fc9473de290829f128faf83327c2931a2898a787ae050ec6a'},
 {file:'out/engine3d/phase27b/final/phase27b-well-final.mp4',recorded:'e7d72e43ded29a9a3ef00ccba09fdbc64281cd35ce75fe3c869ebaf33323e5f9'}].map(v=>({...v,now:sha(v.file),unchanged:sha(v.file)===v.recorded}));
const manifest=JSON.parse(readFileSync('out/engine3d/phase28b/preservation/manifest.json','utf8')) as {hashes:Record<string,string>};
const phase28Outputs=Object.entries(manifest.hashes).filter(([f])=>!f.startsWith('src/')&&!f.startsWith('tests/')&&!f.startsWith('cli/')&&f!=='package.json').map(([f,h])=>({file:f,unchanged:sha(f)===h}));
const counts=resources.reduce((m,r)=>(m[r.type]=(m[r.type]??0)+1,m),{} as Record<string,number>);
const sfx=JSON.parse(readFileSync('examples/sound/media-registry.json','utf8')),visual=JSON.parse(readFileSync('examples/visual/media-registry.json','utf8'));
const len=(x:{assets?:unknown[];entries?:unknown[]}|unknown[])=>Array.isArray(x)?x.length:(x.assets??x.entries??[]).length;
const changed=git('diff','--name-only').split('\n').filter(Boolean),untracked=git('ls-files','--others','--exclude-standard').split('\n').filter(Boolean);
const out={head:git('rev-parse','HEAD'),branch:git('branch','--show-current'),expectedHead:'3290fb2756013d0dfc9d69f6dbff701634bba31d',videos,allVideosUnchanged:videos.every(v=>v.unchanged),
 phase28OutputsChecked:phase28Outputs.length,phase28OutputsUnchanged:phase28Outputs.every(x=>x.unchanged),phase28OutputsChanged:phase28Outputs.filter(x=>!x.unchanged).map(x=>x.file),
 registry:{Engine3D:resources.length,SFX:len(sfx),VISUAL:len(visual),counts},changedTracked:changed,untracked,
 securityFilesTouchedByPhase29:changed.filter(f=>/src\/research\/web\/(?:fetcher|provider|search|contracts)\.ts|src\/research\/(?:request|qa|pack)\.ts/.test(f)).filter(f=>!Object.keys(manifest.hashes).includes(f)||sha(f)!==manifest.hashes[f]),
 packageLockTouched:changed.includes('package-lock.json'),assetsAdded:[...changed,...untracked].filter(f=>/^public\/|\.(?:glb|gltf|png|wav|mp3)$/.test(f))};
mkdirSync('out/engine3d/phase29/analysis',{recursive:true});writeFileSync('out/engine3d/phase29/analysis/integrity.json',JSON.stringify(out,null,2));
console.log(JSON.stringify({head:out.head,branch:out.branch,videos:videos.length,allVideosUnchanged:out.allVideosUnchanged,phase28:out.phase28OutputsChecked+' '+out.phase28OutputsUnchanged,changed:out.phase28OutputsChanged.slice(0,5),registry:out.registry,security:out.securityFilesTouchedByPhase29,lock:out.packageLockTouched,assets:out.assetsAdded}));
