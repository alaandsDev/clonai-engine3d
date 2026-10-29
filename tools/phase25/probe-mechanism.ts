import {mechanismFacts} from '../../src/research/mechanism';
for(const x of process.argv.slice(2))console.log(JSON.stringify(mechanismFacts(x).map(m=>[m.fact.factType,m.fact.subject,m.fact.predicate,m.fact.object,x.slice(m.start,m.end)])));
