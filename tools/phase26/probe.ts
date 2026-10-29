import {readFileSync} from 'node:fs';
import {mechanismFactsV2} from '../../src/research/mechanism-v2';
const [file,term]=process.argv.slice(2),s=JSON.parse(readFileSync(file,'utf8'));
for(const src of s.EvidencePack.sources.filter((x:any)=>x.title.startsWith(term))){
 console.log(src.title);
 for(const text of src.normalized.text.split('\n').filter((x:string)=>x.length>45&&!x.includes('\t')).slice(0,12))console.log(JSON.stringify({text,parsed:mechanismFactsV2(text).map(m=>[m.fact.subject,m.fact.predicate,m.fact.object])}));
}
