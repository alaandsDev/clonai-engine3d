import {readFileSync,readdirSync,statSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
/** Phase29 anti-hardcode scan: runtime code must not branch on the pilot topic, the probe topic or
 * pilot script phrases. Lexicon cue words shared by many domains are reported, not blocked. */
const roots=['src','cli/script-mode.ts'],files:string[]=[];
const walk=(p:string)=>{if(statSync(p).isDirectory())for(const f of readdirSync(p))walk(path.join(p,f));else if(/\.(ts|tsx)$/.test(p))files.push(p.split(path.sep).join('/'));};roots.forEach(walk);
const phase29=files.filter(f=>/src\/script-mode\/|src\/visual-causal\/script-world|cli\/script-mode|src\/engine3d\/(assemblies|demonstration-(contracts|geometry))/.test(f));
const pilot=readFileSync('out/engine3d/phase29/input/pilot-script.txt','utf8');
const phrases=['tubo de sucção','lâminas curvas','canal inferior','energia hidráulica','nível mais elevado','nível mais baixo','duto fechado','velocidade de rotação','energia cinética','torque e velocidade','reservatório ou canal'];
const topics=/turbin|hidr[aá]ulic|hydraulic|suc[cç][aã]o|elevador|elevator|po[cç]o artesiano|artesian|bicicleta|bicycle|pedal(?:ar)?\b/i;
const blockers:{file:string;line:number;text:string;rule:string}[]=[],notes:{file:string;line:number;text:string}[]=[];
for(const f of phase29){readFileSync(f,'utf8').split('\n').forEach((l,i)=>{const code=l.replace(/\/\*.*?\*\/|\/\/.*$/g,'');
 if(topics.test(code))blockers.push({file:f,line:i+1,text:l.trim().slice(0,140),rule:'TOPIC_TERM'});
 for(const p of phrases)if(code.toLowerCase().includes(p))blockers.push({file:f,line:i+1,text:l.trim().slice(0,140),rule:'PILOT_PHRASE'});
 if(/if\s*\(.*(?:pilot|benchmark|turbine)/i.test(code))blockers.push({file:f,line:i+1,text:l.trim().slice(0,140),rule:'PILOT_BRANCH'});
 if(topics.test(l)&&!topics.test(code))notes.push({file:f,line:i+1,text:l.trim().slice(0,140)});});}
// Control: the scanner must detect an injected topic branch.
const control=topics.test("if(topic.includes('turbina'))return renderTurbine();");
const lex=readFileSync('src/script-mode/lexicon.ts','utf8').match(/\^\(\?:([^)]*)\)\$/g)??[];
const pilotWords=new Set(pilot.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').match(/\p{L}+/gu));
const sharedCues=[...new Set(lex.flatMap(x=>x.slice(4,-2).split('|')).filter(w=>pilotWords.has(w)))].sort();
const out={filesScanned:phase29.length,allRuntimeFiles:files.length,blockers,commentMentions:notes,negativeControlDetected:control,genericCueWordsAlsoInPilot:sharedCues,verdict:blockers.length===0&&control?'PASS':'FAIL'};
mkdirSync('out/engine3d/phase29/analysis',{recursive:true});writeFileSync('out/engine3d/phase29/analysis/anti-hardcode.json',JSON.stringify(out,null,2));
console.log(JSON.stringify({verdict:out.verdict,files:out.filesScanned,blockers:blockers.length,control,sharedCues,commentMentions:notes.length}));
