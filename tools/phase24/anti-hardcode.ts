import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {normalize} from '../../src/semantics/normalize';
import {LEXICON} from '../../src/topic/signals';
/** Phase 24 anti-hardcode. Looks for benchmark topic strings, distinctive
 * benchmark phrases and term->expected-route couplings in runtime code. Tests,
 * fixtures, docs and this audit are allowed and classified explicitly. */
const fold=(s:string)=>normalize(s).replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
const TOPICS=['Os cinco lugares mais frios onde pessoas vivem permanentemente.','Como funciona um poço artesiano?','Por que o céu é azul?','Como começou a corrida espacial?','Como os polvos mudam de cor?','Como funciona um motor a jato?','O que aconteceria se a Lua desaparecesse?','Um astronauta acorda sozinho em Marte e encontra uma estrutura misteriosa.','Explique o funcionamento de um poço artesiano.','Como funciona uma turbina hidráulica?'];
const PHRASES=['poco artesiano','ceu e azul','ceu azul','corrida espacial','polvos mudam','motor a jato','lua desaparecesse','astronauta acorda','estrutura misteriosa','lugares mais frios','pessoas vivem permanentemente','turbina hidraulica','mudam de cor'];
const ROUTE_VALUES='STRICT|HEAVY|STANDARD|LIGHT|FACTUAL_RANKING|FACTUAL_EXPLANATORY|FACTUAL_HYPOTHETICAL|CREATIVE|HISTORICAL|BIOLOGICAL|TECHNICAL|SCIENTIFIC';
const TERMS=['poco','artesiano','ceu','azul','espacial','corrida','polvo','polvos','jato','lua','marte','astronauta','misteriosa','frios'];
const files:string[]=[];const walk=(d:string)=>{for(const e of readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())walk(f);else if(/\.(?:ts|tsx|json|py|mjs|md)$/.test(f))files.push(f.replace(/\\/g,'/'));}};
for(const d of ['src','cli','tests','examples','tools/phase24'])walk(d);
const touched=new Set([...execFileSync('git',['diff','--name-only','a76e0c1'],{encoding:'utf8'}).split('\n'),...execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).split('\n')].filter(Boolean));
const topLevel=(v:string)=>{let depth=0,n=1;for(const c of v){if(c==='(')depth++;else if(c===')')depth--;else if(c==='|'&&!depth)n++;}return n;};
const findings:{file:string;kind:string;value:string;classification:string}[]=[];
const classify=(file:string,kind:string)=>file.startsWith('tests/')?'TEST_OR_FIXTURE_ALLOWED':file.endsWith('.md')?'DOCUMENTATION':file==='tools/phase24/benchmarks.ts'||file==='tools/phase24/probe.ts'||file==='tools/phase24/probe-integration.ts'?'BENCHMARK_HARNESS_ALLOWED':!touched.has(file)?'PRE_PHASE24_UNCHANGED':kind==='LEXICON_TERM'?'GENERIC_DOMAIN_LEXICON_MEMBER':'BLOCKER';
for(const file of files){if(file==='tools/phase24/anti-hardcode.ts')continue;const raw=readFileSync(file,'utf8'),text=fold(raw);
 for(const t of TOPICS)if(text.includes(fold(t)))findings.push({file,kind:'BENCHMARK_TOPIC',value:t,classification:classify(file,'BENCHMARK_TOPIC')});
 for(const p of PHRASES)if(new RegExp('(?<![a-z0-9])'+p+'(?![a-z0-9])').test(text))findings.push({file,kind:'BENCHMARK_PHRASE',value:p,classification:classify(file,'BENCHMARK_PHRASE')});
 if(file.startsWith('src/')){
  // A topic term coupled on the same line with an expected route/intent literal is a hardcoded decision.
  for(const line of raw.split('\n'))for(const term of TERMS){const fl=normalize(line);if(new RegExp('(?<![a-z])'+term+'(?![a-z])').test(fl)&&new RegExp("['\"](?:"+ROUTE_VALUES+")['\"]").test(line)&&!/LEXICON|pattern:words|forms/.test(line))findings.push({file,kind:'TERM_ROUTE_COUPLING',value:term,classification:classify(file,'TERM_ROUTE_COUPLING')});}
  if(file==='src/topic/signals.ts')for(const term of TERMS)for(const [cls,lex] of Object.entries(LEXICON))if(new RegExp('^(?:'+lex+')$').test(term))findings.push({file,kind:'LEXICON_TERM',value:term+' in '+cls,classification:classify(file,'LEXICON_TERM')});
 }
}
const result={passed:!findings.some(f=>f.classification==='BLOCKER'),scannedFiles:files.length,lexiconSizes:Object.fromEntries(Object.entries(LEXICON).map(([k,v])=>[k,topLevel(v)])),targets:{topics:TOPICS,phrases:PHRASES,terms:TERMS},
 counts:findings.reduce((m,f)=>(m[f.classification]=(m[f.classification]??0)+1,m),{} as Record<string,number>),findings,
 note:'Domain lexicons are broad generic classes (dozens of members each). A member term never selects a route alone: routes come from intent/mode/claim-family rules; cross-topic tests use other members of the same classes.'};
mkdirSync('out/engine3d/phase24/analysis',{recursive:true});writeFileSync('out/engine3d/phase24/analysis/anti-hardcode.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({passed:result.passed,scannedFiles:result.scannedFiles,counts:result.counts,lexiconSizes:result.lexiconSizes,blockers:findings.filter(f=>f.classification==='BLOCKER'),lexicon:findings.filter(f=>f.kind==='LEXICON_TERM').map(f=>f.value)},null,1));
