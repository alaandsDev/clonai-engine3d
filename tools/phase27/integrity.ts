import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resources} from '../../src/engine3d/registry';
/** Phase 27 integrity: historical MP4 hashes (Phase23 list + Phase25 final), registry counts, touched files. */
const sha=(f:string)=>existsSync(f)?createHash('sha256').update(readFileSync(f)).digest('hex'):null;
const p23=JSON.parse(readFileSync('out/engine3d/phase23/analysis/integrity.json','utf8'));
const videos=[...(p23.videos as {file?:string;path?:string;sha256:string}[]).map(v=>({file:v.path??v.file!,recorded:v.sha256})),{file:'out/engine3d/phase25/final/render/final.mp4',recorded:'c901c5a8c6b742fffe4f2d0d203920caa3454fb11a97d0393f853355f999e926'}].map(v=>({...v,now:sha(v.file),unchanged:sha(v.file)===v.recorded}));
const changed=execFileSync('git',['diff','--name-only','7de502dc34a92bd18467e310095fadb5018889e9'],{encoding:'utf8'}).split('\n').filter(Boolean),untracked=execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).split('\n').filter(Boolean);
const counts=resources.reduce((m,r)=>(m[r.type]=(m[r.type]??0)+1,m),{} as Record<string,number>);
const out={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),videos,allVideosUnchanged:videos.every(v=>v.unchanged),registry:{Engine3D:resources.length,counts},changedTracked:changed,untracked,securityFilesTouched:[...changed,...untracked].filter(f=>/src\/research\/web\/|src\/research\/(?:request|qa|pack)\.ts/.test(f)),packageLockTouched:changed.includes('package-lock.json'),assetsAdded:[...changed,...untracked].filter(f=>/^public\/|\.(?:glb|gltf|png|wav|mp3)$/.test(f))};
writeFileSync('out/engine3d/phase27/analysis/integrity.json',JSON.stringify(out,null,2));console.log(JSON.stringify({...out,videos:videos.length},null,1));
