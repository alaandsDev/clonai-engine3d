import {readFileSync,writeFileSync} from 'node:fs';
import {visualQa} from '../../src/visual-causal/qa';
/** Operator tool (Phase29): recompute qa.json/summary QA for an existing Script Mode output from its saved plan and sequence (no re-render). */
const dir=process.argv[2],read=(f:string)=>JSON.parse(readFileSync(dir+'/'+f,'utf8'));
const qa=visualQa(read('visual-plan.json'),read('directed-sequence.json')),s=read('summary.json');
s.qa={dims:qa.dims,longestMeaningfulStasisSeconds:qa.longestMeaningfulStasisSeconds,shots:qa.shots,cuts:qa.cuts,proof:qa.proof,continuityIssues:qa.continuityIssues.length};
writeFileSync(dir+'/qa.json',JSON.stringify(qa,null,2));writeFileSync(dir+'/summary.json',JSON.stringify(s,null,2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(qa.dims).filter(([,v])=>v!=='PASS'&&v!=='NOT_APPLICABLE'))),qa.beats.filter(b=>b.occupancyStatus!=='PASS'&&b.occupancyStatus!=='NOT_APPLICABLE').map(b=>b.order+':'+b.zone+':'+b.focus+':'+(b.focusExtent?.toFixed(2))+'/'+(b.focusVisibleFraction?.toFixed(2))).join(' '));
