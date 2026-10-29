import {readFileSync,readdirSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import path from 'node:path';
import {normalize} from '../../src/semantics/normalize';
/** Phase 27 anti-hardcode over runtime code (src/, cli/): benchmark topics, Phase26 script sentences,
 * relation labels used on screen, and topic-keyed branches. Tests/tools/docs are classified, not scanned as runtime. */
const fold=(s:string)=>normalize(s).replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
const writers=['A','B','C','D','E','F','G','H'].map(k=>'out/engine3d/phase26/phase26b/attempts/final/writer/'+k+'.json');
// FACT sentences only: EDITORIAL hooks are the Phase26 Writer's generic, topic-independent templates.
const sentences=writers.flatMap(f=>JSON.parse(readFileSync(f,'utf8')).sentences.filter((s:{kind:string})=>s.kind==='FACT').map((s:{text:string})=>s.text)).filter((t:string)=>t.length>30);
const labels=['águas subterrâneas','diferença de pressão','poço artesiano','canos','Casa de máquinas','Contrapeso','cabine','Patamar ou pavimento'];
const topics=['poço artesiano','artesian','turbina hidráulica','hydraulic turbine','elevador','elevator','motor a jato','bomba d\'água','geladeira','usina hidrelétrica','tratamento de água','contrapeso','cabine'];
const branch=/\b(?:if|case|===|includes)\b[^\n]{0,60}(?:poco|artesian|turbin|elevador|elevator|cabine|contrapeso|geladeira)/;
const files:string[]=[];const walk=(d:string)=>{for(const e of readdirSync(d)){const f=path.join(d,e).replace(/\\/g,'/');if(statSync(f).isDirectory())walk(f);else if(/\.(?:ts|tsx)$/.test(f))files.push(f);}};walk('src');walk('cli');
const findings:{file:string;kind:string;value:string;classification:string}[]=[];
const legacy=new Set(['src/writer/topic.ts']);// Phase18 refusal regex (pre-Phase24), unchanged
for(const f of files){const raw=readFileSync(f,'utf8'),t=fold(raw);
 for(const s of sentences)if(t.includes(fold(s)))findings.push({file:f,kind:'SCRIPT_SENTENCE',value:s.slice(0,60),classification:'BLOCKER'});
 for(const v of topics)if(new RegExp('(?<![a-z])'+fold(v)+'(?![a-z])').test(t))findings.push({file:f,kind:'TOPIC',value:v,classification:legacy.has(f)?'PRE_PHASE24_LEGACY_REFUSAL':/^src\/(?:visual-causal|engine3d)\//.test(f)?'BLOCKER':'PRE_PHASE27_UNCHANGED_RUNTIME'});
 // A label word that only occurs inside a generic cue lexicon line (const X=/\b(?:a|b|...)/) is a lexicon member, not a fixed label.
 if(/^src\/visual-causal\//.test(f))for(const l of labels){const re=new RegExp('(?<![a-z])'+fold(l)+'(?![a-z])');if(!re.test(t))continue;const lines=raw.split('\n').filter(x=>re.test(fold(x)));
  findings.push({file:f,kind:'SCREEN_LABEL',value:l,classification:lines.length&&lines.every(x=>/^const [A-Z_]+=\/\\b\(\?:/.test(x.trim()))?'GENERIC_CUE_LEXICON_MEMBER':'BLOCKER'});}
 if(branch.test(normalize(raw)))findings.push({file:f,kind:'TOPIC_BRANCH',value:(normalize(raw).match(branch)??[''])[0].slice(0,60),classification:legacy.has(f)?'PRE_PHASE24_LEGACY_REFUSAL':'BLOCKER'});}
const blockers=findings.filter(f=>f.classification==='BLOCKER');
const result={passed:!blockers.length,scannedRuntimeFiles:files.length,targets:{scriptSentences:sentences.length,topics:topics.length,labels:labels.length},counts:findings.reduce((m,f)=>(m[f.classification]=(m[f.classification]??0)+1,m),{} as Record<string,number>),findings,
 note:'World templates hold generic editorial coordinates (staging) shared by every topic using that template; labels come from relation text at run time.'};
mkdirSync('out/engine3d/phase27/analysis',{recursive:true});writeFileSync(process.env.AH_OUT??'out/engine3d/phase27/analysis/anti-hardcode.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({passed:result.passed,scanned:result.scannedRuntimeFiles,counts:result.counts,blockers},null,1));
