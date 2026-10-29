import {CAUSAL,PHYSICAL,SPATIAL,entityKey,type MechanismKnowledge} from './knowledge';

/** Literal entity graph only: neither shared document nor editorial adjacency
 * creates an identity, causal edge, or a sequence. Paths are simple directed
 * paths; bounded search explicitly reports incompleteness instead of guessing. */
export function mechanismConnectivity(k:MechanismKnowledge){
 const edges=k.relations.map(r=>({id:r.id,from:entityKey(r.subject),to:entityKey(r.object),predicate:r.predicate}));
 const nodes=[...new Set(edges.flatMap(e=>[e.from,e.to]))].sort();
 const components=(es:typeof edges)=>{const remaining=new Set(es.flatMap(e=>[e.from,e.to])),out:string[][]=[];while(remaining.size){const seen=new Set<string>(),todo=[remaining.values().next().value!];while(todo.length){const n=todo.pop()!;if(seen.has(n))continue;seen.add(n);remaining.delete(n);for(const e of es)if(e.from===n||e.to===n)todo.push(e.from===n?e.to:e.from);}out.push([...seen].sort());}return out.sort((a,b)=>b.length-a.length||a.join().localeCompare(b.join(),'en'));};
 const path=(es:typeof edges)=>{let explored=0,complete=true,best:string[]=[];const visit=(n:string,seen:Set<string>,ids:string[])=>{if(++explored>100000){complete=false;return;}if(ids.length>best.length)best=ids;for(const e of es.filter(e=>e.from===n&&!seen.has(e.to)).sort((a,b)=>a.id.localeCompare(b.id,'en'))){if(!complete)return;visit(e.to,new Set([...seen,e.to]),[...ids,e.id]);}};for(const n of [...new Set(es.flatMap(e=>[e.from,e.to]))].sort()){if(!complete)break;visit(n,new Set([n]),[]);}return{edges:best.length,relationIds:best,searchComplete:complete};};
 const physical=edges.filter(e=>PHYSICAL.has(e.predicate)),weak=components(edges),mechanism=components(physical);
 const chainIds=new Set<string>();for(const a of physical)for(const b of physical)if(a.id!==b.id&&a.to===b.from&&a.from!==b.to){chainIds.add(a.id);chainIds.add(b.id);}
 const problems=edges.filter(e=>e.predicate==='FAILS_BECAUSE'),solutions=edges.filter(e=>e.predicate==='SOLVES');
 const pairs=problems.flatMap(p=>solutions.filter(s=>s.to===p.to).map(s=>({problem:p.id,solution:s.id,sharedProblem:p.to})));
 const pairedIds=new Set(pairs.flatMap(p=>[p.problem,p.solution]));
 return{nodes:nodes.length,edges:edges.length,connectedComponents:weak.length,componentSizes:weak.map(c=>c.length),largestConnectedComponent:weak[0]?.length??0,
  largestConnectedMechanismComponent:mechanism[0]?.length??0,largestConnectedMechanismRelations:Math.max(0,...mechanism.map(c=>physical.filter(e=>c.includes(e.from)&&c.includes(e.to)).length)),
  longestConnectedPath:path(edges),longestMechanismChain:path(physical),longestCausalChain:path(edges.filter(e=>CAUSAL.has(e.predicate)&&e.predicate!=='USED_FOR').map(e=>['CAUSED_BY','FAILS_BECAUSE'].includes(e.predicate)?{...e,from:e.to,to:e.from}:e)),longestSequenceChain:path(edges.filter(e=>e.predicate==='PRECEDES')),
  mechanismChainCoverage:physical.length?chainIds.size/physical.length:0,problemSolutionChainCoverage:problems.length+solutions.length?pairedIds.size/(problems.length+solutions.length):0,problemSolutionPairs:pairs,
  stateChanges:physical.filter(e=>['TRANSFORM','RISE','DESCEND','OPEN','CLOSE','OUTPUTS'].includes(e.predicate)).length,explicitProblems:problems.length,explicitSolutions:solutions.length,
  measurement:'Literal participants; purpose is not measured as an actual causal chain; bounded paths expose searchComplete'};
}
export function phase27Readiness(k:MechanismKnowledge,c=mechanismConnectivity(k)){
 const dimensions={mechanismDensity:k.metrics.physicalClaims>=3,connectedness:c.longestMechanismChain.searchComplete&&c.longestMechanismChain.edges>=2,stateChanges:c.stateChanges>0,spatial:k.relations.some(r=>SPATIAL.has(r.predicate)),problemSolution:c.problemSolutionPairs.length>0,visualizable:k.metrics.physicalClaims>0,persistentSystemPotential:c.largestConnectedMechanismRelations>=2};
 const status=Object.values(dimensions).every(Boolean)?'READY':dimensions.visualizable?'PARTIAL':'NOT_READY';
 return{status,dimensions,missing:Object.entries(dimensions).filter(([,v])=>!v).map(([key])=>key),visualExecution:'NOT_IMPLEMENTED',reason:'Planning metadata only; narrative eligibility does not authorize or guarantee visual execution'};
}
