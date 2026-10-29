import {analyzeNaturalScript} from '../../src/narrative';
const script=process.argv.slice(2).join('\n');
const g=analyzeNaturalScript({version:1,id:'probe',language:'pt-BR',script});
for(const c of g.claims)console.log(c.id,c.requiresVisualProof,c.predicate,c.status,c.narrativeRole,JSON.stringify(c.text));
