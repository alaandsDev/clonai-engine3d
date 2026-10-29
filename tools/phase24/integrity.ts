import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
/** Records that Phase24 touched no Research/Writer/Engine3D source and left Phase23 artifacts intact. */
const sha=(f:string)=>existsSync(f)?createHash('sha256').update(readFileSync(f)).digest('hex'):null;
const changed=execFileSync('git',['diff','--name-only','a76e0c1'],{encoding:'utf8'}).split('\n').filter(Boolean);
const untracked=execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).split('\n').filter(Boolean);
const protectedPrefixes=['src/research/','src/writer/','src/semantics/','src/narrative/','src/engine3d/','src/autodirector/','src/visual/','src/sound/','src/editorial/','public/','package-lock.json'];
const phase23=['PHASE23_REPORT.md','out/engine3d/phase23/analysis/final-status.json','out/engine3d/phase23/analysis/metrics.json','out/engine3d/phase23/analysis/real-world-gates.json','out/engine3d/phase23/logs/real-cold-places-v4.json','out/engine3d/phase23/logs/real-population-census-v4.json'];
const catalog=JSON.parse(readFileSync('out/engine3d/catalog.json','utf8'));
const result={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),changedTracked:changed,untracked,protectedTouched:[...changed,...untracked].filter(f=>protectedPrefixes.some(p=>f.startsWith(p))),phase23Sha256:Object.fromEntries(phase23.map(f=>[f,sha(f)])),catalogEntries:Array.isArray(catalog)?catalog.length:Object.keys(catalog).length};
writeFileSync('out/engine3d/phase24/analysis/integrity.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,1));
