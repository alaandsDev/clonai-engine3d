import path from 'node:path';
import {generateFromScript} from '../src/script-mode/generate';
/** Script Mode product command: npm run clonai:script -- --script <file.txt> [--out <dir>] [--label <name>] [--no-render] [--style explainer] [--hd]
 * Also accepts --script-text "<inline script>". The script is untrusted narrative text: it is never executed. */
const args=process.argv.slice(2),get=(k:string)=>{const i=args.indexOf(k);return i>=0?args[i+1]:undefined;};
const scriptPath=get('--script'),scriptText=get('--script-text');
if(!scriptPath&&!scriptText){console.error('Usage: npm run clonai:script -- --script <file.txt> [--out <dir>] [--label <name>] [--no-render]');process.exit(2);}
const outDir=get('--out')??path.join('out','engine3d','script-mode',path.basename(scriptPath??'inline',path.extname(scriptPath??'')));
const r=await generateFromScript({scriptPath,scriptText,outDir,label:get('--label')??'video',render:!args.includes('--no-render'),style:get('--style')==='explainer'?'EXPLAINER':'CLASSIC',hd:args.includes('--hd')});
const s=r.summary,m=s.mp4 as {path?:string;duration?:number;passed?:boolean}|null;
console.log(['ClonAI Script Mode — USER_SCRIPT → MP4',
 'video:      '+(m?.path??'(not rendered)'),
 'duration:   '+(m?.duration?.toFixed(2)??'-')+' s  valid='+(m?.passed??'-'),
 'coverage:   '+s.coverage.coveragePercent+'%  (DIRECT '+s.coverage.DIRECT+', PARTIAL '+s.coverage.PARTIAL+', SYMBOLIC '+s.coverage.SYMBOLIC+', EDITORIAL '+s.coverage.EDITORIAL+', UNREPRESENTED '+s.coverage.UNREPRESENTED+')',
 'gaps:       '+(s.gaps.length?s.gaps.map(g=>g.predicate+': '+g.reason).join(' | '):'none'),
 'QA:         '+(Object.entries(s.qa.dims).filter(([,v])=>v!=='PASS'&&v!=='NOT_APPLICABLE').map(([k,v])=>k+'='+v).join(', ')||'all PASS'),
 'direction:  '+s.direction.demonstrations.count+' demonstrations '+JSON.stringify(s.direction.demonstrations.strategies)+' support '+JSON.stringify(s.direction.demonstrations.support),
 'density:    '+s.direction.meaningfulVisualChanges+' meaningful changes ('+s.direction.meaningfulChangesPer10s+'/10s), longest without change '+s.direction.longestNoMeaningfulChangeSeconds+' s, subject states '+s.direction.progressiveSubjectStates+', stage switches '+s.direction.microStageSwitches+', label-only '+s.direction.labelOnlyExplanations+', arrow-only '+s.direction.arrowOnlyExplanations,
 'execution:  '+(s.direction.execution.demonstrationExecutionRate??'-')+' ('+s.direction.execution.executed+'/'+s.direction.execution.selectedExecutable+' executable strategies executed)'+(s.direction.execution.notExecuted.length?'  NOT EXECUTED: '+s.direction.execution.notExecuted.join(', '):'')+'  wait-only factual beats '+s.direction.execution.waitOnlyFactualBeats+'  spatial violations '+s.direction.execution.spatialRelationViolations.length,
 'camera:     causal pass '+(s.qa.causalCamera?.passRate??'-')+' ('+s.qa.causalCamera?.passed+'/'+s.qa.causalCamera?.checked+'), occlusion failures '+s.qa.causalCamera?.occlusionFailures+', off-frame changes '+s.qa.offFrameChanges?.length+'  sync error ms median '+s.qa.semanticSync?.medianMs+' p90 '+s.qa.semanticSync?.p90Ms+' worst '+s.qa.semanticSync?.worstMs,
 'spatial:    '+JSON.stringify(s.qa.spatial),
 'stasis:     '+s.qa.longestMeaningfulStasisSeconds.toFixed(2)+' s  shots '+s.qa.shots+' cuts '+s.qa.cuts,
 'demo QA:    '+(s.qa.demonstrationQa?.verdict??'-')+(s.qa.demonstrationQa?.failed.length?'  FAILED: '+s.qa.demonstrationQa.failed.join(', '):''),
 'readability: '+(s.qa.readability?.causalReadabilityRate??'-')+' ('+s.qa.readability?.passed+'/'+s.qa.readability?.checked+')  meaningful stasis (strict): longest '+(s.qa.meaningfulStasis?.longestMeaningfulStasis??'-')+' s, '+(s.qa.meaningfulStasis?.meaningfulChangesPer10s??'-')+' changes/10s',
 'network:    research 0, external in-process '+s.network.externalInProcessCalls+', TTS service sentences '+s.network.ttsServiceSentences+' (cached '+s.network.ttsCachedSentences+')',
 'time:       render '+(s.performance.renderMs/1000).toFixed(1)+' s, total '+(s.performance.totalMs/1000).toFixed(1)+' s',
 'artifacts:  '+outDir].join('\n'));
