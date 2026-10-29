import {readFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {registrableDomain,archivedOriginal} from '../../src/research/origins';
import type {ResearchSession} from '../../src/research/web';
export async function antiHardcodeV4(sessions:ResearchSession[],inputFiles:string[]=[]){
 const targets:Record<string,Set<string>>={SUBJECT:new Set(),VALUE:new Set(),DOMAIN:new Set(),URL:new Set(),PUBLISHER:new Set(),STATION:new Set(),RANKING_ORDER:new Set()};
 for(const s of sessions){const p=s.EvidencePack;for(const f of p.groundedFacts){if(f.canonicalFact.subject.length>=4)targets.SUBJECT.add(f.canonicalFact.subject);if(f.canonicalFact.quantity)targets.VALUE.add(f.canonicalFact.quantity.originalValue);}
  for(const n of p.v3?.entityGraph.nodes??[])if(n.kind==='STATION')targets.STATION.add(n.name);
  for(const src of p.sources){const locator=archivedOriginal(src.canonicalLocator)??src.canonicalLocator;targets.URL.add(src.canonicalLocator);targets.DOMAIN.add(registrableDomain(new URL(locator).hostname));}
  for(const r of s.v2?.references??[])targets.DOMAIN.add(registrableDomain(new URL(r.targetUrl).hostname));
  for(const publisher of p.v3?.publishers??[])if(publisher.name&&publisher.name.length>=6)targets.PUBLISHER.add(publisher.name);
  if(p.ranking?.items.length)targets.RANKING_ORDER.add(p.ranking.items.map(i=>i.subject).join(' > '));
 }
 const files:string[]=[];const walk=async(dir:string)=>{for(const e of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())await walk(file);else if(/\.(?:ts|tsx|json|py|mjs|md)$/.test(file))files.push(file);}};
 for(const dir of ['src','cli','tests','examples','tools/phase22-checkpoint','tools/phase23'])await walk(dir);files.push(...inputFiles);
 const findings:{file:string;kind:string;value:string;classification:string}[]=[];
 const touched=new Set([...execFileSync('git',['diff','--name-only','d1b8d00'],{encoding:'utf8'}).split('\n'),...execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).split('\n')].filter(Boolean));
 const providers=new Set(['wikipedia.org','wikidata.org','openalex.org','archive.org','crossref.org','datacite.org','data.gov.uk']);
 const escape=(x:string)=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 for(const file of [...new Set(files)]){const rel=file.replace(/\\/g,'/');if(/(?:anti-hardcode|research-v[234]-audit)\.ts$/.test(rel))continue;const text=await readFile(file,'utf8');
  for(const[kind,values]of Object.entries(targets))for(const value of values){if(!value)continue;
   const exact=new RegExp((/^\w/.test(value)?'\\b':'')+escape(value)+(/\w$/.test(value)?'\\b':''),['SUBJECT','PUBLISHER','STATION'].includes(kind)?'':'i');if(!exact.test(text))continue;
   const classification=kind==='DOMAIN'&&providers.has(value)?'ALLOWED_GENERIC_PROVIDER_OR_CORPUS':rel.endsWith('.md')?'DOCUMENTATION':!touched.has(rel)?'PRE_CHECKPOINT_UNCHANGED':kind==='VALUE'&&rel==='tests/research-v4.test.ts'?'FICTITIOUS_TEST_QUANTITY_NOT_RUNTIME':'BLOCKER';
   findings.push({file:rel,kind,value,classification});
  }
 }
 return{passed:!findings.some(f=>f.classification==='BLOCKER'),scannedFiles:new Set(files).size,targets:Object.fromEntries(Object.entries(targets).map(([k,v])=>[k,[...v].sort()])),findings,exclusions:'Acquired snapshots, cache, sessions, reviews and reports are output data, never runtime seeds. Unchanged checkpoint fixtures and generic corpus/provider rules are explicitly reported, not concealed.'};
}
