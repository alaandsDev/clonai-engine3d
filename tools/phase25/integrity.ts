import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
/** Phase 25 integrity: historical MP4 hashes (as recorded by Phase 23), registry counts, touched files. */
const p23=JSON.parse(readFileSync('out/engine3d/phase23/analysis/integrity.json','utf8'));
const videos=(p23.videos as {path?:string;file?:string;sha256:string}[]).map(v=>{const f=v.path??v.file!;const now=existsSync(f)?createHash('sha256').update(readFileSync(f)).digest('hex'):null;return{file:f,recorded:v.sha256,now,unchanged:now===v.sha256};});
const catalog=JSON.parse(readFileSync('out/engine3d/catalog.json','utf8'));
const changed=execFileSync('git',['diff','--name-only','14bf67b'],{encoding:'utf8'}).split('\n').filter(Boolean),untracked=execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).split('\n').filter(Boolean);
const out={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),historicalVideos:videos,allVideosUnchanged:videos.every(v=>v.unchanged),registry:p23.registry,catalogEntries:Array.isArray(catalog)?catalog.length:Object.keys(catalog).length,changedTracked:changed,untracked,securityFilesTouched:changed.filter(f=>/research\/web\/(?:fetcher|http|robots|security|cache)/.test(f)),packageLockTouched:changed.includes('package-lock.json')};
writeFileSync('out/engine3d/phase25/analysis/integrity.json',JSON.stringify(out,null,2));console.log(JSON.stringify({...out,historicalVideos:videos.length},null,1));
