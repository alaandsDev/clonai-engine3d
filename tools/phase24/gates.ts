import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
/** Implementation gates, each tied to a test name or artifact; computed from outputs, not asserted by hand. */
const j=(f:string)=>JSON.parse(readFileSync('out/engine3d/phase24/'+f,'utf8'));
const bench=j('analysis/benchmarks.json'),anti=j('analysis/anti-hardcode.json'),integ=j('analysis/integrity.json'),replay=j('replay/replay.json'),cold=j('integration/cold-phase23.json'),pop=j('integration/population-phase23.json'),proc=j('integration/process-fixture.json');
const checks=existsSync('out/engine3d/phase24/analysis/checks-final.tsv')?readFileSync('out/engine3d/phase24/analysis/checks-final.tsv','utf8').trim().split('\n').map(l=>l.split('\t')):[];
const logDir='out/engine3d/phase24/logs/checks-final',logName=existsSync(logDir)?readdirSync(logDir).find(f=>f.includes('topic-intelligence')):undefined,testLog=logName?readFileSync(logDir+'/'+logName,'utf8'):'';
const t=(name:string)=>new RegExp('✔ topic '+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).test(testLog);
const row=(id:string)=>bench.rows.find((r:{id:string})=>r.id===id);
const gates:[string,boolean,string][]=[
 ['G01 opt-in versioned topicPlanningVersion 1',t('legacy compatibility: no opt-in means no change'),'test'],
 ['G02 TopicAnalysis has all required fields',t('benchmarks A-H classify intent, mode and research level'),'test'],
 ['G03 normalization deterministic',t('normalization folds accents, case, punctuation and whitespace deterministically'),'test'],
 ['G04 signal spans auditable',t('signal spans map back to the raw topic'),'test'],
 ['G05 PT/EN intents',t('PT and EN phrasings reach the same structural plan'),'test'],
 ['G06 every ContentIntent reachable',t('every ContentIntent is reachable from generic phrasing'),'test'],
 ['G07 every ContentMode',t('content modes cover factual, comparative, ranking, hypothetical, creative, hybrid and unknown'),'test'],
 ['G08 levels NONE..STRICT',t('research levels NONE..STRICT are all produced and ordered'),'test'],
 ['G09 claim risk table',t('claim risk table: ranking CRITICAL, measurements HIGH, mechanisms MEDIUM, fiction LOW without evidence'),'test'],
 ['G10 ranking STRICT + v4 + session scope',t('ranking route keeps STRICT safeguards, Research v4 and session scope'),'test'],
 ['G11 Cold routing not relaxed',cold.policy.notRelaxed===true,'integration/cold-phase23.json'],
 ['G12 Cold writer blocked on Phase23 outcome',cold.gate?.decision==='BLOCKED','integration/cold-phase23.json'],
 ['G13 Research v4 / Phase23 untouched',integ.protectedTouched.length===0,'analysis/integrity.json'],
 ['G14 unsupported ranking fails before research',t('ranking without a researchable metric or residency criterion fails before research'),'test'],
 ['G15 process/cause/history/science/biography routes',t('process, cause-effect, history, science and biography routes'),'test'],
 ['G16 quantity/census HIGH',t('count and census cues are HIGH-risk quantities with corroboration quorum'),'test'],
 ['G17 population routing not relaxed',pop.policy?.notRelaxed===true,'integration/population-phase23.json'],
 ['G18 hypothetical premise preserved',t('hypothetical premise is preserved, labelled and never researched as fact'),'test'],
 ['G19 fiction isolation',t('fiction isolation: fictional events never become FactGap, EvidenceRequirement or STRICT research'),'test'],
 ['G20 hybrid epistemic separation',t('hybrid keeps fiction and fact layers separated'),'test'],
 ['G21 paraphrase equivalence',t('paraphrases are structurally equivalent'),'test'],
 ['G22 cross-topic equivalence',t('cross-topic structural equivalence without topic-specific rules'),'test'],
 ['G23 ambiguous topics clarify',t('ambiguous bare topics require clarification and never default to research-free'),'test'],
 ['G24 overrides validated/recorded/unsafe rejected',t('overrides are validated, recorded, may only tighten, and unsafe ones are rejected'),'test'],
 ['G25 topic text is data',t('text is data: embedded instructions cannot change routing or overrides'),'test'],
 ['G26 no clock/random/network',t('plan fingerprint is deterministic and free of clock, randomness and network'),'test'],
 ['G27 replay offline',replay.allValid===true,'replay/replay.json'],
 ['G28 tamper detected (re-signed)',replay.tamperResigned.valid===false,'replay/replay.json'],
 ['G29 research integration end-to-end (fixture)',proc.writer?.status==='PRODUCTION_ELIGIBLE','integration/process-fixture.json'],
 ['G30 writer derivation authoritative',t('writer derivation keeps plan topic and policy authoritative'),'test'],
 ['G31 semantic claim stage metadata',t('semantic claim stage metadata reuses modality and fiction boundary'),'test'],
 ['G32 visual hints without assets',t('visual hints name existing arcs only and create no assets'),'test'],
 ['G33 benchmarks A-H pass',bench.summary.benchmarks.every((b:{pass:boolean})=>b.pass),'analysis/benchmarks.json'],
 ['G34 all 24 topics pass',bench.summary.passed===bench.summary.all,'analysis/benchmarks.json'],
 ['G35 structural equivalence pairs',bench.summary.equivalence.every((e:{equal:boolean})=>e.equal),'analysis/benchmarks.json'],
 ['G36 anti-hardcode 0 BLOCKER',anti.passed===true,'analysis/anti-hardcode.json'],
 ['G37 anti-hardcode negative control detected',existsSync('out/engine3d/phase24/analysis/anti-hardcode-negative-control.json')&&j('analysis/anti-hardcode-negative-control.json').passed===false,'analysis/anti-hardcode-negative-control.json'],
 ['G38 registry unchanged (50 entries)',integ.catalogEntries===50,'analysis/integrity.json'],
 ['G39 full regression all PASS',checks.length===18&&checks.every(c=>c[1]==='0'),'analysis/checks-final.tsv'],
 ['G40 H creative and A strict extremes',row('H-mars-fiction').actual.mode==='CREATIVE'&&row('A-cold-ranking').actual.level==='STRICT','analysis/benchmarks.json'],
];
const out={passed:gates.filter(g=>g[1]).length,total:gates.length,gates:gates.map(([gate,pass,evidence])=>({gate,pass,evidence}))};
writeFileSync('out/engine3d/phase24/analysis/implementation-gates.json',JSON.stringify(out,null,2));
console.log(out.passed+'/'+out.total);for(const g of out.gates)if(!g.pass)console.log('FAIL',g.gate);
