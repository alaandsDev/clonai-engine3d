import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';
import {newTrace,startStage,finishStage,verifyTrace,VERTICAL_STAGES,type VerticalSliceAttempt} from '../src/vertical/trace';
import {runVerticalSlice,type SessionLike} from '../src/vertical/run';
import {buildProvenance,verifyProvenance,validateAttempts,PROVENANCE_LINKS} from '../src/vertical/provenance';
import {verticalWebConfig} from '../src/vertical/config';
import {mechanismFacts,extractMechanismEvidence,sourceAboutSubject} from '../src/research/mechanism';
import {buildEvidencePack,planResearch,contentHash,realizeGroundedFact,allowedGroundedEditorial,processEditorial,type ResearchRequest,type SourceInput,type SourcePack} from '../src/research';
import {queryPlan} from '../src/research/web/queries';
import {webConfig} from '../src/research/web/config';
import {buildTopicPlan,buildRoutedResearchRequest,topicWriterGate,topicSubject} from '../src/topic';
import {analyzeNaturalScript} from '../src/narrative';
import {evaluateDirected} from '../src/engine3d/directed';
import {normalize} from '../src/semantics/normalize';
import {jsonHash} from '../src/editorial/fingerprint';
// Synthetic, fictitious fixtures only (no network). Benchmark topics appear in tests, never in runtime.
const base=(JSON.parse(readFileSync(new URL('../examples/research/ranking-sources.json',import.meta.url),'utf8')) as SourcePack).sources[0];
const source=(id:string,title:string,content:string):SourceInput=>({...structuredClone(base),id,title,publisher:'Fixture '+id,canonicalLocator:'fixture://phase25/'+id,content,contentHash:contentHash(content),provenance:{originKey:'synthetic-'+id,description:'Synthetic Phase25 test text; not real-world facts.'}});
const DAM='Como funciona uma barragem?';
const damText='Uma barragem é um tipo de estrutura hidráulica, cuja água acumulada flui pelo vertedouro, devido à força da gravidade.\nA água não sobe para o reservatório superior.';
const damPack=(request:ResearchRequest,extra:SourceInput[]=[])=>buildEvidencePack(request,{version:1,id:'phase25-fixture',fixture:true,labels:['DEMO_FIXTURE','SYNTHETIC_TEST_SOURCES','NOT_REAL_WORLD_FACTS'],sources:[source('dam','Barragem — fixture sintética',damText),...extra]});
const routed=(topic:string)=>buildRoutedResearchRequest(buildTopicPlan({topicPlanningVersion:1,topic}),{id:'t',capacity:{maxSourceBytes:2097152,maxTotalSourceBytes:16777216,maxNormalizedCharacters:524288}})!;
const memory=()=>{const files:Record<string,unknown>={};return{files,save:async(n:string,x:unknown)=>{files[n]=x;return n;}};};
const fixtureResearch=(extra:SourceInput[]=[])=>async(r:ResearchRequest):Promise<SessionLike>=>{const pack=damPack(r,extra);return{mode:'FIXTURE',sessionFile:null,sessionFingerprint:pack.fingerprint,queries:[],quality:{acceptedSources:pack.sources.length,resultState:'FIXTURE'},pack,networkRequests:0};};

test('vertical trace: stage order, blocking skips downstream, timestamps excluded from fingerprint, tamper detected', ()=>{
 let t=newTrace('x','l');assert.equal(t.stages.length,VERTICAL_STAGES.length);
 assert.throws(()=>startStage(t,'RESEARCH',1),/VERTICAL_STAGE_ORDER/);
 t=startStage(t,'TOPIC_ANALYSIS',1,'2026-01-01T00:00:00Z');assert.throws(()=>startStage(t,'TOPIC_ANALYSIS',1),/RESTART/);
 t=finishStage(t,'TOPIC_ANALYSIS',{status:'PASS',output:2},'2026-01-01T00:00:01Z');
 let u=startStage(newTrace('x','l'),'TOPIC_ANALYSIS',1,null);u=finishStage(u,'TOPIC_ANALYSIS',{status:'PASS',output:2},null);assert.equal(t.fingerprint,u.fingerprint);
 t=startStage(t,'RESEARCH_ROUTING',2);assert.throws(()=>finishStage(t,'RESEARCH_ROUTING',{status:'BLOCKED'}),/REASON_REQUIRED/);
 t=finishStage(t,'RESEARCH_ROUTING',{status:'BLOCKED',blockingReason:'why'});
 assert.deepEqual(t.firstBlocker,{stage:'RESEARCH_ROUTING',reason:'why'});assert.equal(t.furthestStage,'TOPIC_ANALYSIS');
 assert(t.stages.slice(2).every(s=>s.status==='SKIPPED'));assert(verifyTrace(t));
 assert(!verifyTrace({...t,firstBlocker:null}));
});
test('vertical attempt history: numbering and documented changes', ()=>{
 const a=(n:number,change:string|null):VerticalSliceAttempt=>({attemptNumber:n,blockingStage:'RESEARCH',blockingReason:'r',changeIntroduced:change,whyGeneralizable:change?'generic':null,testsAdded:[],resultAfterChange:null,regressions:[],nextStageReached:null});
 assert(validateAttempts([a(1,'c'),a(2,null)]).valid);assert(!validateAttempts([a(1,null),a(2,null)]).valid);assert(!validateAttempts([a(2,'c')]).valid);
});
test('vertical mechanism grammar: flow/rise/enter, definition, explicit cause; negation and truncation rejected', ()=>{
 const m=(s:string)=>mechanismFacts(s).map(x=>[x.fact.factType,x.fact.subject,x.fact.predicate,x.fact.object]);
 assert.deepEqual(m(damText.split('\n')[0]),[['DEFINITION','barragem','IS_A','um tipo de estrutura hidráulica'],['PROCESS','água acumulada','FLOW','pelo vertedouro'],['RELATION','água acumulada','CAUSED_BY','à força da gravidade']]);
 assert.deepEqual(m('O vapor sobe pela chaminé.'),[['PROCESS','vapor','RISE','pela chaminé']]);
 assert.deepEqual(m('O oxigênio entra nos pulmões.'),[['PROCESS','oxigênio','ENTER','nos pulmões']]);
 assert.deepEqual(m(damText.split('\n')[1]),[]);assert.deepEqual(m('Talvez a água suba para o topo.'),[]);assert.deepEqual(m('A água sobe para o tanque?'),[]);
 assert.deepEqual(m('A água sai pela base do rotor com pressão e velocidade muito reduzidas.'),[],'coordination may share a modifier');
 assert.deepEqual(m('A água sai pela abertura lateral inferior do grande tanque externo de concreto.'),[],'over-long phrase is rejected, never cut');
 for(const x of mechanismFacts(damText.split('\n')[0]))assert.equal(damText.slice(x.start,x.end).length>0,true);
});
test('vertical process readiness: PROCESS route grounds mechanism prose from on-subject sources only', ()=>{
 const r=routed(DAM),p=damPack(r,[source('off','Arquitetura de templos — fixture','A água flui pelo canal lateral, devido à inclinação do piso.')]);
 assert.equal(r.researchGoal,'PROCESS');assert.equal(p.quality.productionEligibility,'RESEARCH_READY');
 assert.deepEqual(p.groundedFacts.map(g=>g.factType).sort(),['DEFINITION','PROCESS','RELATION']);
 assert(p.groundedFacts.every(g=>g.sourceIds.every(id=>id==='dam')),'off-subject document contributes nothing');
 for(const e of p.evidence){const s=p.sources.find(s=>s.id===e.sourceId)!;assert.equal(s.normalized.text.slice(e.sourceSpan.start,e.sourceSpan.end),e.exactText);assert.equal(e.extractionMethod,'MECHANISM_PT_V1');}
 const plan=planResearch(r);assert(sourceAboutSubject(p.sources.find(s=>s.id==='dam')!,plan));assert(!sourceAboutSubject(p.sources.find(s=>s.id==='off')!,plan));
});
test('vertical mechanism extraction is route-aware: FACTS/RANKING requests are unchanged', ()=>{
 const r={...routed(DAM),researchGoal:'FACTS' as const};const p=damPack(r);
 assert.equal(p.evidence.filter(e=>e.extractionMethod==='MECHANISM_PT_V1').length,0);
 assert.equal(extractMechanismEvidence(p.sources[0],planResearch(r)).evidence.length,0);
});
test('vertical writer process route: realized tuples, process editorial, every fact sentence grounded', ()=>{
 const plan=buildTopicPlan({topicPlanningVersion:1,topic:DAM}),p=damPack(routed(DAM));
 assert.equal(topicWriterGate(plan,{resultState:null,writerStatus:null,rankingStatus:null,productionEligibility:p.quality.productionEligibility}).decision,'PROCEED_GROUNDED');
 assert.deepEqual(p.groundedFacts.map(realizeGroundedFact).sort(),['A água acumulada flui pelo vertedouro.','Esse fluxo acontece devido à força da gravidade.','Uma barragem é um tipo de estrutura hidráulica.']);
 assert.deepEqual(allowedGroundedEditorial({...p,fixture:false}),processEditorial,'non-fixture PROCESS packs use the process editorial set');
 for(const line of processEditorial){const n=normalize(line);assert(!/\d/.test(n)&&!/\b(?:porque|devido|causa|barragem|agua)\b/.test(n),line);}
});
test('vertical semantics: non-physical definition/cause, physical flow, upward destination', ()=>{
 const g=analyzeNaturalScript({version:1,id:'s',language:'pt-BR',script:'Uma barragem é um tipo de estrutura hidráulica.\nA água acumulada flui pelo vertedouro.\nEsse fluxo acontece devido à força da gravidade.\nO carro é um veículo vermelho.\nA água flui para a superfície.'});
 const by=(t:string)=>g.claims.find(c=>c.text===t)!;
 assert.equal(by('Uma barragem é um tipo de estrutura hidráulica.').narrativeRole,'CONTEXT');assert(by('Uma barragem é um tipo de estrutura hidráulica.').semanticTags.includes('definition'));
 assert(by('Esse fluxo acontece devido à força da gravidade.').semanticTags.includes('causal_explanation'));
 assert.equal(by('A água acumulada flui pelo vertedouro.').predicate,'FLOW');assert(by('A água acumulada flui pelo vertedouro.').requiresVisualProof);
 assert.equal(by('O carro é um veículo vermelho.').narrativeRole,'FACT','plain predication stays a fact');
 assert(by('A água flui para a superfície.').semanticTags.includes('upward'));assert(!by('A água acumulada flui pelo vertedouro.').semanticTags.includes('upward'));
 const plural=analyzeNaturalScript({version:1,id:'p',language:'pt-BR',script:'As águas fluem para o tanque.'}).claims[0];assert.equal(plural.predicate,'FLOW');assert.equal(plural.status,'RESOLVED');
});
test('vertical slice end-to-end (fixture research): every pure stage passes; continuity, camera, honest proof', async()=>{
 const m=memory(),r=await runVerticalSlice(DAM,'fixture',{evaluationDate:'2026-10-29',save:m.save,research:fixtureResearch()});
 const st=(n:string)=>r.trace.stages.find(s=>s.stage===n)!;
 for(const n of ['TOPIC_ANALYSIS','RESEARCH_ROUTING','RESEARCH','EVIDENCE','WRITER','SCRIPT','SEMANTICS','NARRATIVE','AUTO_DIRECTION','VISUAL_DEMONSTRATION','DIRECTED_SEQUENCE','ENGINE3D'])assert.equal(st(n).status,'PASS',n+' '+st(n).blockingReason);
 assert.equal(r.trace.firstBlocker,null);assert.equal(r.trace.furthestStage,'ENGINE3D');assert.equal(st('VOICE').status,'NOT_STARTED');
 const matrix=st('VISUAL_DEMONSTRATION').diagnostics.matrix as {visualProof:string;proofScope:string}[];
 assert.deepEqual(matrix.map(x=>x.visualProof).sort(),['DIRECT','NONE','NONE']);assert(matrix.filter(x=>x.visualProof==='NONE').every(x=>x.proofScope.startsWith('NON_PHYSICAL_EXPLANATION')));
 assert(['FLOW','CONNECT'].every(o=>(st('VISUAL_DEMONSTRATION').diagnostics.operations as string[]).includes(o)));
 const seq=(m.files['sequence/sequences.json'] as Parameters<typeof evaluateDirected>[0][]);assert.equal(seq.length,1,'one persistent system, not one scene per sentence');
 const s=seq[0];for(const f of [0,Math.floor(s.totalFrames/2),s.totalFrames-1]){const subjects=evaluateDirected(s,f).state.demonstration!.subjects;assert(['source','destination','connection'].every(k=>subjects[k].visible),'object continuity at '+f);}
 assert.equal(s.shots.length,1);for(let i=1;i<s.cameraSegments.length;i++)assert(s.cameraSegments[i].startFrame>=s.cameraSegments[i-1].endFrame,'camera segments do not overlap');
 const reframe=s.cameraSegments.find(c=>c.behavior==='REFRAME');if(reframe)assert(reframe.endState.position[2]>=15,'consequence reframe keeps the whole system in frame');
 const fl=s.demonstration!.steps.find(x=>x.operation==='FLOW')!;assert.notEqual(evaluateDirected(s,fl.startFrame).state.demonstration!.subjects.connection.parameters.flowProgress,evaluateDirected(s,fl.endFrame).state.demonstration!.subjects.connection.parameters.flowProgress,'FLOW visibly changes');
});
test('vertical replay: same inputs give the same trace fingerprint; a changed source changes it', async()=>{
 const a=await runVerticalSlice(DAM,'r',{evaluationDate:'2026-10-29',save:memory().save,research:fixtureResearch()}),b=await runVerticalSlice(DAM,'r',{evaluationDate:'2026-10-29',save:memory().save,research:fixtureResearch()});
 assert.equal(a.trace.fingerprint,b.trace.fingerprint);
 const c=await runVerticalSlice(DAM,'r',{evaluationDate:'2026-10-29',save:memory().save,research:fixtureResearch([source('dam2','Barragem — segunda fixture','A água flui pelas comportas.')])});
 assert.notEqual(a.trace.fingerprint,c.trace.fingerprint);
});
test('vertical provenance: complete chain, link mismatch and re-signed tamper detected', ()=>{
 const links=Object.fromEntries(PROVENANCE_LINKS.map(k=>[k,'h-'+k])) as Record<typeof PROVENANCE_LINKS[number],string>,p=buildProvenance(links,'LIVE');
 assert(verifyProvenance(p,links).valid);assert.throws(()=>buildProvenance({...links,mp4Sha256:''},'LIVE'),/PROVENANCE_LINK_MISSING/);
 const t={...p,links:{...p.links,script:'other'}};assert(verifyProvenance(t,{}).issues.includes('CHAIN_FINGERPRINT'));
 const{fingerprint:_,...raw}=t,resigned={...t,fingerprint:jsonHash(raw)};assert(verifyProvenance(resigned,{}).valid);assert(verifyProvenance(resigned,{script:'h-script'}).issues.includes('LINK_MISMATCH:script'));
});
test('vertical secondary generalization: same machinery reads other processes and verbs', ()=>{
 const s=topicSubject('Como funciona uma turbina hidráulica?');assert.equal(s,'turbina hidráulica');
 for(const [sentence,pred] of [['O vapor sobe pela chaminé.','RISE'],['O oxigênio entra nos pulmões.','ENTER'],['O sangue circula pelas artérias.','FLOW'],['A roda gira em torno do eixo.','ROTATE']] as const)assert.equal(mechanismFacts(sentence)[0]?.fact.predicate,pred,sentence);
 const plan=buildTopicPlan({topicPlanningVersion:1,topic:'Como funciona uma turbina hidráulica?'});assert.equal(plan.researchRoute.researchGoal,'PROCESS');assert.equal(plan.analysis.researchRequirement,'STANDARD');
 const q=queryPlan(planResearch(routed('Como funciona uma turbina hidráulica?')),webConfig(verticalWebConfig('pt')));assert.deepEqual(q.map(x=>x.text),['turbina hidráulica','turbina hidráulica funcionamento']);
});
test('vertical Cold STRICT regression: routing, quorum and blocked writer unchanged; no mechanism reading', ()=>{
 const cold=JSON.parse(readFileSync(new URL('./fixtures/phase24/cold-phase23-reference.json',import.meta.url),'utf8'));
 const plan=buildTopicPlan({topicPlanningVersion:1,topic:cold.request.topic});assert.equal(plan.researchRoute.level,'STRICT');assert.equal(plan.researchRoute.researchVersion,4);
 assert.equal(topicWriterGate(plan,cold.outcome).decision,'BLOCKED');
 const q=queryPlan(planResearch(cold.request),webConfig({enabled:true}));assert.equal(q[0].text,'coldest inhabited places permanent population');
 const p=buildEvidencePack(cold.request,{version:1,id:'c',fixture:true,labels:['DEMO_FIXTURE','SYNTHETIC_TEST_SOURCES','NOT_REAL_WORLD_FACTS'],sources:[source('c','Os cinco lugares mais frios onde pessoas vivem permanentemente','A água flui para o mar.')]});
 assert.equal(p.evidence.filter(e=>e.extractionMethod==='MECHANISM_PT_V1').length,0);
});
test('vertical fiction and hypothetical regressions', async()=>{
 let called=0;const r=await runVerticalSlice('Um astronauta acorda sozinho em Marte e encontra uma estrutura misteriosa.','f',{evaluationDate:'2026-10-29',save:memory().save,research:async()=>{called++;throw Error('no research for fiction');}});
 assert.equal(r.trace.firstBlocker?.stage,'TOPIC_ANALYSIS');assert.equal(called,0);
 const g=buildTopicPlan({topicPlanningVersion:1,topic:'O que aconteceria se a Lua desaparecesse?'});assert.deepEqual(g.analysis.factualityProfile.hypotheticalPremise,{text:'se a Lua desaparecesse',preserved:true,asserted:false});
 assert(!g.researchRoute.evidenceRequirements.some(e=>e.claimFamily==='HYPOTHETICAL_PREMISE'));
});
test('vertical anti-hardcode: runtime contains no benchmark topic, script or source', ()=>{
 const files:string[]=[];const walk=(d:string)=>{for(const e of readdirSync(d)){const f=path.join(d,e);if(statSync(f).isDirectory())walk(f);else if(/\.(?:ts|tsx)$/.test(f))files.push(f);}};walk('src');walk('cli');
 const banned=['poco artesiano','artesian well','turbina hidraulica','hydraulic turbine','bomba d agua','bomba dagua','water pump','aguas subterraneas fluem','diferenca de pressao','pt.wikipedia.org/wiki'];
 // Pre-Phase24 legacy writer: a conservative regex that REFUSES this topic as an unprovided mechanism (unchanged; not a route).
 const legacy=new Set(['src/writer/topic.ts|poco artesiano']);
 for(const f of files){const t=normalize(readFileSync(f,'utf8')).replace(/[^a-z0-9./ ]+/g,' ').replace(/\s+/g,' ');for(const b of banned)if(!legacy.has(f.replace(/\\/g,'/')+'|'+b))assert(!t.includes(b),f+' contains '+b);}
});
test('vertical legacy compatibility: non-process editorial and FACTS queries unchanged', ()=>{
 const pop=JSON.parse(readFileSync(new URL('../examples/research/web-v4-population-request.json',import.meta.url),'utf8')).request as ResearchRequest;
 const q=queryPlan(planResearch(pop),webConfig({enabled:true}));assert.equal(q[0].text,pop.topic);
 const fx=buildEvidencePack(JSON.parse(readFileSync(new URL('../examples/research/process-request.json',import.meta.url),'utf8')),JSON.parse(readFileSync(new URL('../examples/research/process-sources.json',import.meta.url),'utf8')));
 assert.equal(fx.quality.productionEligibility,'RESEARCH_READY');assert(fx.evidence.every(e=>e.extractionMethod!=='MECHANISM_PT_V1'),'demo table path unchanged');
});
