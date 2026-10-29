import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {buildTopicPlan,verifyTopicPlan,buildRoutedResearchRequest,policyNotRelaxed,topicWriterGate,deriveWriterRequest,type TopicPlan} from '../../src/topic';
import {jsonHash} from '../../src/editorial/fingerprint';
import {buildEvidencePack,type ResearchRequest,type SourcePack} from '../../src/research';
import {writeGroundedTopic} from '../../src/writer';
/** Phase 24 benchmark runner. Offline: Topic planning plus recorded Phase23
 * outcomes and local fixtures; no live research is executed here. */
const root='out/engine3d/phase24';
const put=(dir:string,name:string,value:unknown)=>{mkdirSync(path.join(root,dir),{recursive:true});writeFileSync(path.join(root,dir,name+'.json'),JSON.stringify(value,null,2));};
const log:string[]=[];
type Expect={id:string;topic:string;intents:string[];mode:string;level:string[];route:string;group:string};
const benchmarks:Expect[]=[
 {id:'A-cold-ranking',group:'benchmark',topic:'Os cinco lugares mais frios onde pessoas vivem permanentemente.',intents:['RANKING','GEOGRAPHIC'],mode:'FACTUAL_RANKING',level:['STRICT'],route:'GROUNDED_ONLY'},
 {id:'B-artesian-well',group:'benchmark',topic:'Como funciona um poço artesiano?',intents:['EXPLANATION','PROCESS','TECHNICAL'],mode:'FACTUAL_EXPLANATORY',level:['STANDARD'],route:'GROUNDED_ONLY'},
 {id:'C-blue-sky',group:'benchmark',topic:'Por que o céu é azul?',intents:['EXPLANATION','SCIENTIFIC','CAUSE_EFFECT'],mode:'FACTUAL_EXPLANATORY',level:['STANDARD'],route:'GROUNDED_ONLY'},
 {id:'D-space-race',group:'benchmark',topic:'Como começou a corrida espacial?',intents:['HISTORICAL'],mode:'FACTUAL',level:['STANDARD','HEAVY'],route:'GROUNDED_ONLY'},
 {id:'E-octopus-color',group:'benchmark',topic:'Como os polvos mudam de cor?',intents:['BIOLOGICAL','SCIENTIFIC','PROCESS','CAUSE_EFFECT'],mode:'FACTUAL_EXPLANATORY',level:['STANDARD'],route:'GROUNDED_ONLY'},
 {id:'F-jet-engine',group:'benchmark',topic:'Como funciona um motor a jato?',intents:['TECHNICAL','PROCESS','EXPLANATION'],mode:'FACTUAL_EXPLANATORY',level:['STANDARD'],route:'GROUNDED_ONLY'},
 {id:'G-moon-vanishes',group:'benchmark',topic:'O que aconteceria se a Lua desaparecesse?',intents:['HYPOTHETICAL','SCIENTIFIC','CAUSE_EFFECT'],mode:'FACTUAL_HYPOTHETICAL',level:['STANDARD'],route:'GROUNDED_ONLY'},
 {id:'H-mars-fiction',group:'benchmark',topic:'Um astronauta acorda sozinho em Marte e encontra uma estrutura misteriosa.',intents:['NARRATIVE','FICTION'],mode:'CREATIVE',level:['NONE','LIGHT'],route:'CREATIVE_ISOLATED'},
 {id:'P1-explain-well',group:'paraphrase-of-B',topic:'Explique o funcionamento de um poço artesiano.',intents:['EXPLANATION','PROCESS','TECHNICAL'],mode:'FACTUAL_EXPLANATORY',level:['STANDARD'],route:'GROUNDED_ONLY'},
 {id:'P2-en-well',group:'paraphrase-of-B',topic:'How does an artesian well work?',intents:['EXPLANATION','PROCESS','TECHNICAL'],mode:'FACTUAL_EXPLANATORY',level:['STANDARD'],route:'GROUNDED_ONLY'},
 {id:'P3-en-sky',group:'paraphrase-of-C',topic:'Why is the sky blue?',intents:['EXPLANATION','SCIENTIFIC','CAUSE_EFFECT'],mode:'FACTUAL_EXPLANATORY',level:['STANDARD'],route:'GROUNDED_ONLY'},
 {id:'X1-hydraulic-turbine',group:'cross-topic-of-B',topic:'Como funciona uma turbina hidráulica?',intents:['EXPLANATION','PROCESS','TECHNICAL'],mode:'FACTUAL_EXPLANATORY',level:['STANDARD'],route:'GROUNDED_ONLY'},
 {id:'X2-chameleon',group:'cross-topic-of-E',topic:'Como os camaleões mudam de cor?',intents:['BIOLOGICAL','PROCESS','CAUSE_EFFECT'],mode:'FACTUAL_EXPLANATORY',level:['STANDARD'],route:'GROUNDED_ONLY'},
 {id:'X3-hot-ranking',group:'cross-topic-of-A',topic:'Os cinco lugares mais quentes onde pessoas vivem permanentemente.',intents:['RANKING','GEOGRAPHIC'],mode:'FACTUAL_RANKING',level:['STRICT'],route:'GROUNDED_ONLY'},
 {id:'X4-sun-vanishes',group:'cross-topic-of-G',topic:'E se o Sol desaparecesse?',intents:['HYPOTHETICAL','CAUSE_EFFECT'],mode:'FACTUAL_HYPOTHETICAL',level:['STANDARD'],route:'GROUNDED_ONLY'},
 {id:'X5-portal-fiction',group:'cross-topic-of-H',topic:'Uma menina encontra um portal no quintal.',intents:['NARRATIVE','FICTION'],mode:'CREATIVE',level:['NONE'],route:'CREATIVE_ISOLATED'},
 {id:'X6-biography',group:'extra-domain',topic:'Quem foi Santos Dumont?',intents:['BIOGRAPHICAL'],mode:'FACTUAL',level:['HEAVY'],route:'GROUNDED_ONLY'},
 {id:'X7-comparison',group:'extra-domain',topic:'Qual é melhor: carro elétrico ou carro a gasolina?',intents:['COMPARISON'],mode:'FACTUAL_COMPARATIVE',level:['HEAVY'],route:'GROUNDED_ONLY'},
 {id:'X8-myth',group:'extra-domain',topic:'É verdade que raios nunca caem duas vezes no mesmo lugar?',intents:['MYTH_CHECK'],mode:'FACTUAL',level:['HEAVY'],route:'GROUNDED_ONLY'},
 {id:'X9-hybrid',group:'extra-domain',topic:'Conte uma história em que uma gota de água explica como funciona o ciclo da chuva.',intents:['NARRATIVE','FICTION','EXPLANATION','PROCESS'],mode:'HYBRID',level:['STANDARD'],route:'HYBRID_SEPARATED'},
 ...['Marte','Napoleão','Buracos negros','Água'].map((topic,i)=>({id:'U'+(i+1)+'-ambiguous',group:'ambiguous',topic,intents:[] as string[],mode:'UNKNOWN',level:['STANDARD'],route:'CLARIFICATION_REQUIRED'})),
];
const rows:Record<string,unknown>[]=[],plans:Record<string,TopicPlan>={};
for(const b of benchmarks){
 const t0=process.hrtime.bigint(),p=buildTopicPlan({topicPlanningVersion:1,topic:b.topic}),ms=Number(process.hrtime.bigint()-t0)/1e6;plans[b.id]=p;
 const detected=[p.analysis.primaryIntent,...p.analysis.secondaryIntents],missing=b.intents.filter(i=>!detected.includes(i as never));
 const primaryOk=b.intents.length?b.intents.includes(p.analysis.primaryIntent):p.analysis.primaryIntent==='UNKNOWN';
 const pass=!missing.length&&primaryOk&&p.analysis.contentMode===b.mode&&b.level.includes(p.analysis.researchRequirement)&&p.writerRoute.kind===b.route;
 put('inputs',b.id,{topicPlanningVersion:1,topic:b.topic});put('topic-analysis',b.id,p.analysis);put('topic-plans',b.id,p);put('claim-requirements',b.id,p.claimRequirements);put('routes',b.id,{research:p.researchRoute,writer:p.writerRoute,visualHints:p.visualHints});
 const row={id:b.id,group:b.group,topic:b.topic,expected:{intents:b.intents,mode:b.mode,level:b.level,route:b.route},actual:{primary:p.analysis.primaryIntent,secondary:p.analysis.secondaryIntents,mode:p.analysis.contentMode,level:p.analysis.researchRequirement,route:p.writerRoute.kind,researchGoal:p.researchRoute.researchGoal,researchVersion:p.researchRoute.researchVersion,families:p.analysis.expectedClaimFamilies,riskFlags:p.analysis.riskFlags},missingIntents:missing,primaryOk,pass,structuralSignature:p.structuralSignature,fingerprint:p.fingerprint,ms};
 put('benchmarks',b.id,row);rows.push(row);log.push(`${pass?'PASS':'FAIL'} ${b.id} ${p.analysis.primaryIntent} ${p.analysis.contentMode} ${p.analysis.researchRequirement} ${p.writerRoute.kind} ${ms.toFixed(2)}ms`);
}
const sig=(id:string)=>plans[id].structuralSignature;
const equivalence=[['B-artesian-well','P1-explain-well'],['B-artesian-well','P2-en-well'],['C-blue-sky','P3-en-sky'],['B-artesian-well','X1-hydraulic-turbine'],['B-artesian-well','F-jet-engine'],['E-octopus-color','X2-chameleon'],['A-cold-ranking','X3-hot-ranking']].map(([a,b])=>({a,b,equal:sig(a)===sig(b)}));
// Integration 1: Cold — routed request vs the Phase23 operator request, and the writer gate on the recorded Phase23 outcome (no new live research).
const coldInput=JSON.parse(readFileSync('out/engine3d/phase23/inputs/real-cold-places-v4.json','utf8')).request as ResearchRequest;
const sessionFile='out/engine3d/phase23/logs/real-cold-places-v4.json',session=existsSync(sessionFile)?JSON.parse(readFileSync(sessionFile,'utf8')):null;
const outcome=session?{resultState:session.quality.resultState,writerStatus:session.writer?.status??null,rankingStatus:session.EvidencePack.ranking?.status??null,productionEligibility:session.EvidencePack.quality.productionEligibility}:null;
const coldPlan=plans['A-cold-ranking'],coldRouted=buildRoutedResearchRequest(coldPlan,{id:'phase24-cold-routed',evaluationDate:coldInput.sourcePolicy?.evaluationDate??undefined})!;
const coldIntegration={phase23SessionFile:sessionFile,phase23SessionSha256:existsSync(sessionFile)?createHash('sha256').update(readFileSync(sessionFile)).digest('hex'):null,phase23Outcome:outcome,routedRequest:coldRouted,phase23Request:coldInput,policy:policyNotRelaxed(coldRouted,coldInput),
 gate:outcome?topicWriterGate(coldPlan,outcome):null,notCarriedOver:['allowEnglishExtraction','maxSourceBytes','maxTotalSourceBytes','maxNormalizedCharacters','residencyMaxAgeYears','observationSitePolicy','singleOriginAuthority (omitted: stricter)'],note:'Research v4 was not re-run; Phase23 results are read only.'};
put('integration','cold-phase23',coldIntegration);
// Integration 2: population benchmark topic routing compared with its Phase23 request (classification only).
const popInput=JSON.parse(readFileSync('out/engine3d/phase23/inputs/real-population-census-v4.json','utf8')).request as ResearchRequest,popPlan=buildTopicPlan({topicPlanningVersion:1,topic:popInput.topic});
put('topic-plans','phase23-population',popPlan);
let popRouted:ResearchRequest|null=null,popError:string|null=null;try{popRouted=buildRoutedResearchRequest(popPlan,{id:'phase24-pop'});}catch(e){popError=(e as Error).message;}
put('integration','population-phase23',{topic:popInput.topic,analysis:{primary:popPlan.analysis.primaryIntent,mode:popPlan.analysis.contentMode,level:popPlan.analysis.researchRequirement,families:popPlan.analysis.expectedClaimFamilies},routed:popRouted,error:popError,policy:popRouted?policyNotRelaxed(popRouted,popInput):null});
// Integration 3: offline end-to-end Topic -> Research (fixture) -> Writer.
const ex=(n:string)=>JSON.parse(readFileSync('examples/research/'+n+'.json','utf8'));
const procPlan=buildTopicPlan({topicPlanningVersion:1,topic:ex('process-request').topic}),procReq=buildRoutedResearchRequest(procPlan,{id:'phase24-process'})!,pack=buildEvidencePack(procReq,ex('process-sources') as SourcePack);
const procGate=topicWriterGate(procPlan,{resultState:null,writerStatus:null,rankingStatus:pack.ranking?.status??null,productionEligibility:pack.quality.productionEligibility});
const writer=procGate.decision==='PROCEED_GROUNDED'?writeGroundedTopic(deriveWriterRequest(procPlan,{version:1,id:'phase24-process-writer',language:'pt-BR'}),pack):null;
put('integration','process-fixture',{plan:procPlan.fingerprint,routedRequest:procReq,pack:{fingerprint:pack.fingerprint,groundedFacts:pack.groundedFacts.length,eligibility:pack.quality.productionEligibility,fixture:pack.fixture,labels:pack.labels},gate:procGate,writer:writer?{status:writer.status,script:writer.finalCandidate?.script??null,fingerprint:writer.fingerprint}:null});
// Writer gates for every benchmark without research state.
put('integration','writer-gates',Object.fromEntries(Object.entries(plans).map(([id,p])=>[id,topicWriterGate(p,null)])));
// Replay and tamper.
const replay=Object.entries(plans).map(([id,p])=>({id,...verifyTopicPlan(JSON.parse(JSON.stringify(p)))}));
const tampered=JSON.parse(JSON.stringify(coldPlan)) as TopicPlan;tampered.researchRoute.level='LIGHT';const{fingerprint:_f,...raw}=tampered;const resigned={...raw,fingerprint:jsonHash(raw)} as TopicPlan;
put('replay','replay',{plans:replay,allValid:replay.every(r=>r.valid),tamperUnsigned:verifyTopicPlan(tampered),tamperResigned:verifyTopicPlan(resigned)});
const summary={benchmarks:rows.filter(r=>r.group==='benchmark').map(r=>({id:r.id,pass:r.pass})),all:rows.length,passed:rows.filter(r=>r.pass).length,equivalence,coldPolicyNotRelaxed:coldIntegration.policy.notRelaxed,coldGate:coldIntegration.gate?.decision,processWriter:writer?.status??null,replayAllValid:replay.every(r=>r.valid),tamperDetected:!verifyTopicPlan(resigned).valid};
put('analysis','benchmarks',{rows,summary});
mkdirSync(path.join(root,'logs'),{recursive:true});writeFileSync(path.join(root,'logs','benchmarks.txt'),log.join('\n')+'\n');
console.log(log.join('\n'));console.log(JSON.stringify(summary,null,1));
