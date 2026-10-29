import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {normalize} from '../../src/semantics/normalize';
const fold=(s:string)=>normalize(s).replace(/[^a-z0-9./ ]/g,' ').replace(/\s+/g,' ').trim();
const topics=['poço artesiano','artesian well','turbina hidráulica','hydraulic turbine','motor a jato','jet engine',"bomba d'água",'water pump','geladeira','refrigerator','elevador','elevator','usina hidrelétrica','hydroelectric','tratamento de água','water treatment'];
export function scanRuntimeText(file:string,text:string,extra:string[]=[]){
 const hits:{file:string;value:string;classification:string}[]=[];
 for(const value of [...topics,...extra]){
  const target=fold(value);if(target.length<6||!fold(text).includes(target))continue;
  const lines=text.split('\n').filter(l=>fold(l).includes(target));
  const lexicon=file==='src/topic/signals.ts'&&['geladeira','refrigerator','elevador','elevator'].includes(value)&&lines.every(l=>/^ TECHNICAL:/.test(l));
  const legacy=file==='src/writer/topic.ts'&&target==='poco artesiano';
  hits.push({file,value,classification:lexicon?'EXISTING_GENERIC_DOMAIN_LEXICON':legacy?'EXISTING_LEGACY_REFUSAL':'BLOCKER'});
 }
 return hits;
}
export function runAntiHardcode(outputFile='out/engine3d/phase26/analysis/anti-hardcode.json',extraTargets:string[]=[]){
 const files:string[]=[];const walk=(dir:string)=>{for(const e of readdirSync(dir,{withFileTypes:true})){const f=dir+'/'+e.name;if(e.isDirectory())walk(f);else if(/\.tsx?$/.test(f))files.push(f);}};walk('src');walk('cli');
 const extra:string[]=[...extraTargets];
 for(const file of readdirSync('out/engine3d/phase26/research').filter(f=>f.endsWith('.json'))){const s=JSON.parse(readFileSync('out/engine3d/phase26/research/'+file,'utf8'));for(const a of s.acceptedSources)extra.push(a.canonicalLocator);}
 for(const file of readdirSync('out/engine3d/phase26/writer').filter(f=>/^analyze-.*\.json$/.test(f))){const w=JSON.parse(readFileSync('out/engine3d/phase26/writer/'+file,'utf8'));for(const s of w.sentences.filter((s:any)=>s.kind==='FACT'))if(s.text.length>35)extra.push(s.text);}
 const findings=files.flatMap(f=>scanRuntimeText(f,readFileSync(f,'utf8'),extra));
 // Every permitted pre-existing occurrence must still match the checkpoint;
 // no broad whitelist can hide a newly introduced benchmark solution.
 const oldLex=execFileSync('git',['show','19d5583:src/topic/signals.ts'],{encoding:'utf8'}).split('\n').find(l=>/^ TECHNICAL:/.test(l));
 const newLex=readFileSync('src/topic/signals.ts','utf8').split('\n').find(l=>/^ TECHNICAL:/.test(l));
 const refusalUnchanged=execFileSync('git',['show','19d5583:src/writer/topic.ts'],{encoding:'utf8'}).replace(/\r/g,'')===readFileSync('src/writer/topic.ts','utf8').replace(/\r/g,'');
 const negative=scanRuntimeText('src/injected-negative-control.ts',"if(topic === 'poço artesiano') return {expectedFacts:['a prepared answer'],source:'https://benchmark.example/answer'};");
 const result={passed:findings.every(f=>f.classification!=='BLOCKER')&&oldLex===newLex&&refusalUnchanged&&negative.some(f=>f.classification==='BLOCKER'),scannedFiles:files.length,findings,blockers:findings.filter(f=>f.classification==='BLOCKER'),existingLexiconUnchanged:oldLex===newLex,legacyRefusalUnchanged:refusalUnchanged,negativeControlDetected:negative.some(f=>f.classification==='BLOCKER'),dynamicTargets:extra.length,classification:'Tests, fixtures, benchmark operators and reports may contain topics; runtime may not contain their solutions.'};
 mkdirSync(outputFile.replace(/[/\\][^/\\]+$/,''),{recursive:true});writeFileSync(outputFile,JSON.stringify(result,null,2));return result;
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/phase26/anti-hardcode.ts')){const r=runAntiHardcode();console.log(JSON.stringify({passed:r.passed,files:r.scannedFiles,blockers:r.blockers,negativeControl:r.negativeControlDetected}));if(!r.passed)process.exitCode=1;}
