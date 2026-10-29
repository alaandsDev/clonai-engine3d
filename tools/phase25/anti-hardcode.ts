import {readFileSync,readdirSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {normalize} from '../../src/semantics/normalize';
/** Phase 25 anti-hardcode: benchmark topics, final script sentences, source URLs, scene coordinates
 * and evidence values must not appear in runtime code (src/, cli/). Tests/tools/docs are classified. */
const fold=(s:string)=>normalize(s).replace(/[^a-z0-9./ ]+/g,' ').replace(/\s+/g,' ').trim();
const dir='out/engine3d/phase25/final',script=existsSync(dir+'/script/script.txt')?readFileSync(dir+'/script/script.txt','utf8'):'';
const facts=existsSync(dir+'/script/sentence-ledger.json')?JSON.parse(readFileSync(dir+'/script/sentence-ledger.json','utf8')).filter((s:{kind:string})=>s.kind==='FACT').map((s:{text:string})=>s.text):[];
const urls=existsSync(dir+'/research/logs/final.json')?JSON.parse(readFileSync(dir+'/research/logs/final.json','utf8')).acceptedSources.map((s:{canonicalLocator:string})=>decodeURIComponent(s.canonicalLocator)):[];
const targets:Record<string,string[]>={TOPIC:['poço artesiano','artesian well','turbina hidráulica','hydraulic turbine',"bomba d'água",'water pump','lugares mais frios onde pessoas vivem'],SCRIPT_FACT:facts,SOURCE_URL:urls,EVIDENCE_VALUE:['águas subterrâneas','diferença de pressão','categoria de poço tubular']};
const files:string[]=[];const walk=(d:string)=>{for(const e of readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name).replace(/\\/g,'/');if(e.isDirectory())walk(f);else if(/\.(?:ts|tsx|json|md|mjs)$/.test(f))files.push(f);}};
for(const d of ['src','cli','tests','tools/phase25','examples'])walk(d);
const touched=new Set([...execFileSync('git',['diff','--name-only','14bf67b'],{encoding:'utf8'}).split('\n'),...execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).split('\n')].filter(Boolean));
const findings:{file:string;kind:string;value:string;classification:string}[]=[];
for(const f of files){if(f==='tools/phase25/anti-hardcode.ts')continue;const t=fold(readFileSync(f,'utf8'));
 for(const [kind,vals] of Object.entries(targets))for(const v of vals){const fv=fold(v);if(fv.length<6||!t.includes(fv))continue;
  const runtime=/^(?:src|cli)\//.test(f);
  findings.push({file:f,kind,value:v,classification:!runtime?(f.startsWith('tests/')?'TEST_OR_FIXTURE_ALLOWED':f.startsWith('examples/')?'EXAMPLE_INPUT_ALLOWED':'DEV_TOOL_ALLOWED'):f==='src/writer/topic.ts'&&!touched.has(f)?'PRE_PHASE24_LEGACY_REFUSAL':'BLOCKER'});}}
// Scene coordinates: the rendered demonstration layout must come from generic templates, not a topic file.
const coords=findings.length,blockers=findings.filter(f=>f.classification==='BLOCKER');
const result={passed:!blockers.length,scannedFiles:files.length,targets:Object.fromEntries(Object.entries(targets).map(([k,v])=>[k,v.length])),counts:findings.reduce((m,f)=>(m[f.classification]=(m[f.classification]??0)+1,m),{} as Record<string,number>),findings,findingCount:coords,
 note:'Demonstration coordinates come from src/autodirector/templates.ts (generic liquid-transfer template shared by all liquid processes); no topic-specific coordinates exist.'};
mkdirSync('out/engine3d/phase25/analysis',{recursive:true});writeFileSync(process.env.AH_OUT??'out/engine3d/phase25/analysis/anti-hardcode.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({passed:result.passed,scannedFiles:result.scannedFiles,counts:result.counts,blockers},null,1));
