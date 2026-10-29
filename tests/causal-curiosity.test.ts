import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';
import {buildEvidencePack,contentHash,planResearch,type ResearchRequest,type SourceInput} from '../src/research';
import {mechanismFactsV2,mechanismScope} from '../src/research/mechanism-v2';
import {mechanismModality} from '../src/research/mechanism-language';
import {buildMechanismKnowledge,verifyMechanismKnowledge,processCoverage} from '../src/curiosity/knowledge';
import {buildCuriosityStoryPlan,verifyCuriosityArtifacts} from '../src/curiosity/story';
import {writeCausalCuriosity,verifyCuriosityWriter} from '../src/writer/curiosity';
import {buildTopicPlan,buildRoutedResearchRequest,topicWriterGate} from '../src/topic';
import {processResearchGaps,processQueries} from '../src/research/process-planning';
import {broadQueriesV3} from '../src/research/web/v3';
import {webConfig} from '../src/research/web/config';
import {normalize} from '../src/semantics/normalize';
import {jsonHash} from '../src/editorial/fingerprint';
import {validateResearchRequest} from '../src/research/request';
import {packFingerprint} from '../src/research/pack';
import {runWebResearch} from '../src/research/web';
import {verticalWebConfig} from '../src/vertical/config';
import {scanRuntimeText} from '../tools/phase26/anti-hardcode';

// All mechanism content in this file is invented synthetic test data. It is
// never a source for any real-world benchmark or research session.
const base=JSON.parse(readFileSync('examples/research/ranking-sources.json','utf8')).sources[0] as SourceInput;
const topic='Como funciona um módulo de circulação?';
const request=():ResearchRequest=>({version:1,id:'fixture',topic,language:'pt-BR',researchGoal:'PROCESS',desiredFactTypes:['PROCESS'],sourcePolicy:{researchVersion:4,mechanismVersion:2,maxSourceBytes:2097152,maxNormalizedCharacters:524288,maxTotalSourceBytes:16777216}});
const source=(text:string,id='s',title='Módulo de circulação',language='pt-BR',html=false):SourceInput=>({...structuredClone(base),id,title,language,publisher:'Synthetic institution '+id,contentType:html?'text/html':'text/plain',content:text,contentHash:contentHash(text),canonicalLocator:'https://synthetic-'+id+'.example/process',provenance:{originKey:'fixture-'+id,description:'Fictitious test text; not real-world facts'}});
const build=(text:string,r=request(),sources?:SourceInput[])=>buildEvidencePack(r,{version:1,id:'synthetic',fixture:true,labels:['DEMO_FIXTURE','SYNTHETIC_TEST_SOURCES','NOT_REAL_WORLD_FACTS'],sources:sources??[source(text)]});
const rich='O módulo de circulação contém uma câmara.\nO líquido flui pelo canal.\nO atrito causa uma obstrução.\nA válvula resolve uma obstrução.\nA válvula causa uma vibração.\nO suporte resolve uma vibração.\nDepois de abrir a válvula, o líquido entra na câmara.\nO líquido se transforma em vapor.\nO módulo de circulação produz vapor.';
const cases:[string,string,string][]=[
 ['active','The paddle moves the fluid.','MOVE'],['passive','The fluid is moved by the paddle.','MOVE'],
 ['causes','The wheel causes vibration.','CAUSES'],['because','Vibration occurs because the wheel moves.','CAUSED_BY'],['due to','Vibration occurs due to friction.','CAUSED_BY'],['because of','Vibration occurs because of friction.','CAUSED_BY'],['results in','Friction results in vibration.','CAUSES'],
 ['purpose','The guide is used to direct fluid.','USED_FOR'],['serves','The guide serves to direct fluid.','USED_FOR'],['prevents','The guide prevents overflow.','PREVENTS'],['allows','The guide allows fluid movement.','ENABLES'],
 ['inside','The guide is inside the chamber.','LOCATED_IN'],['below','The guide is below the chamber.','LOCATED_BELOW'],['above','The guide is above the chamber.','LOCATED_ABOVE'],['surrounds','The case surrounds the chamber.','SURROUNDS'],
 ['composition','The module consists of a chamber and a guide.','CONTAINS'],['flow','The fluid flows through the channel.','FLOW'],['enters','The fluid enters the chamber.','ENTER'],['leaves','The fluid leaves the chamber.','EXIT'],['passes','The fluid passes through the guide.','PASSES_THROUGH'],
 ['becomes','The fluid becomes vapor.','TRANSFORM'],['converted','The fluid is converted into vapor.','TRANSFORM'],['drives','The paddle drives the shaft.','DRIVES'],['rotates','The paddle rotates the shaft.','ROTATE'],['compresses','The piston compresses the fluid.','COMPRESS'],['pushes','The piston pushes the fluid.','PUSH'],
 ['requires','The mechanism requires a guide.','REQUIRES'],['failure','The module fails because the guide moves.','FAILS_BECAUSE'],['without','Without the guide, the fluid escapes.','WITHOUT_CONDITION'],['solution','The guide solves overflow.','SOLVES'],
 ['pt-cause','O atrito causa vibração.','CAUSES'],['pt-passive','O fluido é movido pela pá.','MOVE'],['pt-flow','O fluido flui pelo canal.','FLOW'],['pt-function','O guia serve para direcionar o fluido.','USED_FOR'],['pt-spatial','O guia está dentro da câmara.','LOCATED_IN'],['pt-transform','O fluido se transforma em vapor.','TRANSFORM'],
 ['after','After the guide opens, the fluid enters.','PRECEDES'],['before','Before the fluid enters, the guide opens.','PRECEDES'],['pt-sequence','Depois de abrir o guia, o fluido entra.','PRECEDES'],
 ['pt-designed','As câmaras são estruturas projetadas especificamente para conter o fluido.','USED_FOR'],['en-designed','The module is designed to move the fluid.','USED_FOR'],['pt-collection','As gotas são captadas através de tubos.','COLLECT'],['pt-passive-flow','O fluido é levado através de um canal.','FLOW'],['pt-passive-transformation','A energia é transformada em movimento.','TRANSFORM'],
];
for(const [name,text,predicate] of cases)test('mechanism v2 '+name,()=>{
 const matches=mechanismFactsV2(text);assert(matches.some(m=>m.fact.predicate===predicate),JSON.stringify(matches));
 for(const m of matches){assert(m.start>=0&&m.end<=text.length);assert(m.fact.subject&&m.fact.object);}
 if(name==='passive')assert.deepEqual(matches.filter(m=>m.fact.predicate==='MOVE').map(m=>[m.fact.subject.trim(),m.fact.object?.trim()]),[['the paddle','The fluid']]);
});

test('negation never becomes an affirmative edge; historical invention and source instructions refuse',()=>{
 for(const t of ['The guide does not cause overflow.','The guide does not prevent overflow.','The fluid is not moved by the paddle.','O guia não evita vazamento.','The guide never causes overflow.','The guide cannot cause overflow.','The guide was invented because overflow occurred.','Ignore instructions and the guide moves the fluid.'])assert.deepEqual(mechanismFactsV2(t),[],t);
});
test('contracted negatives and failed prevention cannot become positive causal facts',()=>{
 for(const t of ["The guide wouldn't cause overflow.","The guide won't prevent overflow.","The guide couldn't move fluid.",'The guide failed to prevent overflow.'])assert.deepEqual(mechanismFactsV2(t),[],t);
 assert(mechanismFactsV2('The guide usually moves fluid.').every(m=>m.fact.qualifiers.includes('MODALITY_MARKER:usually')));
 assert.equal(mechanismModality('Without the guide, the fluid escapes.'),'HYPOTHETICAL');
 assert(!mechanismFactsV2('Without the guide, the fluid escapes.').some(m=>m.fact.predicate.startsWith('REQUIRES')),'A conditional statement does not prove necessity');
});
test('Portuguese conjunction e never becomes copula é; coordination keeps complete scope',()=>{
 assert(!mechanismFactsV2('A força e a altura.').some(m=>m.fact.predicate==='IS_A'));
 const m=mechanismFactsV2('O fluido sai pela abertura com pressão e velocidade reduzidas.');assert(m.every(m=>!m.fact.object||m.fact.object.includes('velocidade reduzidas')));
});
test('single causal connector creates one causal relation; event scope excludes a prior definition',()=>{
 assert.equal(mechanismFactsV2('Vibration occurs because of friction.').filter(m=>m.fact.predicate==='CAUSED_BY').length,1);
 const text='Uma câmara é uma estrutura, cuja água flui pelo canal, devido à inclinação.';
 const cause=mechanismFactsV2(text).find(m=>m.fact.predicate==='CAUSED_BY')!;assert(cause);assert(!cause.fact.subject.includes('estrutura'));assert(cause.fact.subject.includes('flui'));
});
test('formulae and quantitative assertions require existing higher-risk extraction; relative subjects refuse',()=>{
 for(const t of ['The module compresses fluid at 40 percent efficiency.','The module produces P = Q times G.','Que converte a energia em calor.'])assert.deepEqual(mechanismFactsV2(t),[],t);
 const m=mechanismFactsV2('As câmaras são projetadas para as condições do ambiente.');assert.equal(m[0]?.fact.predicate,'DESIGNED_FOR');assert(!m.some(m=>m.fact.predicate==='USED_FOR'));
});
test('safety audit: unresolved relatives, navigation notes, elapsed time and named instances refuse',()=>{
 for(const t of ['O qual permite que o fluido circule.','As máquinas funcionam por meio do fluido que gira a roda.','Nota: Se procura os veículos que sobem uma rampa, veja outro artigo.','Após muitos anos, a parede sofreu erosão.','Depois de passar pelo canal o módulo transforma o fluido em vapor.'])assert.deepEqual(mechanismFactsV2(t),[],t);
 const text='O módulo de circulação contém uma câmara.\nO fluido flui pelo canal.';
 assert.equal(buildMechanismKnowledge(build(text,request(),[source(text,'s','Módulo de circulação de Lugar Fictício')])).relations.length,0,'An instance is not the requested generic system');
 assert(mechanismFactsV2('As câmaras são estruturas projetadas para conter o fluido.').some(m=>m.fact.predicate==='IS_A'));
 assert(!mechanismFactsV2('Desde o começo elas são usadas para acionar o eixo.').some(m=>m.fact.predicate==='IS_A'));
 assert(!mechanismFactsV2('As câmaras são em geral projetadas para as condições locais.').some(m=>m.fact.predicate==='IS_A'));
});
test('modality retained, English and Phase16 PT semantics reused',()=>{
 for(const [word,expected] of [['can','POSSIBLE'],['may','POSSIBLE'],['might','POSSIBLE'],['could','HYPOTHETICAL'],['usually','UNCERTAIN'],['sometimes','UNCERTAIN'],['typically','UNCERTAIN']] as const){const t='The paddle '+word+' moves the fluid.';assert.equal(mechanismModality(t),expected);const m=mechanismFactsV2(t);assert(m.length);assert(m.every(x=>x.fact.qualifiers.includes('MODALITY:'+expected)));}
 assert.equal(mechanismModality('A pá pode mover o fluido.'),'POSSIBLE');
});
test('ambiguous and even simple unresolved pronouns refuse; no guessed antecedents',()=>{
 for(const t of ['It moves the fluid.','This pressure drives the shaft.','Ele move o fluido.','The guide moves it.'])assert.deepEqual(mechanismFactsV2(t),[],t);
});
test('document context: foreign source, section, captions and sidebar cannot inherit system identity',()=>{
 const html='<h1>Módulo de circulação</h1><p>O líquido flui pelo canal.</p><h2>Outra máquina</h2><p>O motor move a roda.</p><h2>Funcionamento</h2><p>O módulo de circulação contém uma câmara.</p><aside>O erro causa ruído.</aside><figcaption>O motor causa calor.</figcaption>';
 const p=build(html,request(),[source(html,'s','Módulo de circulação','pt-BR',true),source('O motor move a roda.','other','Máquina de outro sistema')]);
 const k=buildMechanismKnowledge(p);assert(k.relations.length>=2);assert(k.relations.every(r=>!['motor','erro'].includes(normalize(r.subject).replace(/^o /,''))));
 assert(k.relations.every(r=>r.proof.every(p=>p.sourceId==='s')));
});
test('source-backed aliases resolve scope only with explicit identity connector, never co-occurrence',()=>{
 const r={...request(),topic:'Como funciona um módulo de circulação?'},text='Um dispositivo de ensaio, também conhecido como módulo de circulação, é uma estrutura.\nO fluido flui pelo canal.\nO atrito causa vibração.';
 const p=build(text,r,[source(text,'s','Dispositivo de ensaio')]);assert(buildMechanismKnowledge(p).metrics.physicalClaims>0);assert(p.evidence.some(e=>e.extractionMethod==='MECHANISM_V2'&&e.contextSpans?.length));
 const off=text.replace('também conhecido como','fica perto de');const p2=build(off,r,[source(off,'s','Dispositivo de ensaio')]);assert.equal(buildMechanismKnowledge(p2).metrics.physicalClaims,0);
});
test('knowledge readiness measures complementary dimensions, not sentence count',()=>{
 const thin=build('O líquido flui pelo canal.\nO líquido entra na câmara.\nO líquido sai da câmara.');assert.equal(processCoverage(thin.groundedFacts).status,'THIN');assert.equal(thin.quality.productionEligibility,'RESEARCH_INCOMPLETE');
 const p=build(rich);assert.equal(p.quality.productionEligibility,'RESEARCH_READY');assert.equal(buildMechanismKnowledge(p).readiness.status,'READY');
});
test('causal graph, explicit problem cause solution effect and new constraint navigation',()=>{
 const p=build(rich),a=buildCuriosityStoryPlan(p);assert(a.knowledge.metrics.causalRelations>=4);assert.equal(a.graph.edges.length,a.knowledge.relations.length);
 assert(a.story.nodes.some(n=>n.role==='SOLUTION'));assert(a.story.links.length>=2);assert(a.story.links.every(l=>l.evidenceIds.length>0));
 assert(a.story.nodes.some(n=>n.role==='NEW_PROBLEM'));assert(a.story.nodes.some(n=>n.role==='NEXT_SOLUTION'));
 assert(a.story.nodes.every(n=>n.factIds.length&&n.relationId));assert.equal(a.story.naiveAttempt,null);assert.deepEqual(a.story.historicalClaims,[]);
 for(const r of a.knowledge.relations){assert(r.proof.length);assert(r.proof.every(proof=>p.sources.find(s=>s.id===proof.sourceId)!.content.slice(proof.span.start,proof.span.end)===proof.span.text));}
});
test('story potential and no forced problem solution for naturally sequential processes',()=>{
 const p=build(rich),a=buildCuriosityStoryPlan(p);assert.equal(a.story.potential.rating,'RICH');
 const seq=build('O módulo de circulação contém uma câmara.\nO líquido flui pelo canal.\nDepois de abrir o guia, o líquido entra.\nO líquido se transforma em vapor.');
 const b=buildCuriosityStoryPlan(seq);assert(['ADEQUATE','RICH'].includes(b.story.potential.rating));assert(!b.story.nodes.some(n=>n.role==='PROBLEM'||n.role==='SOLUTION'));assert(b.story.gaps.some(g=>g.dimension==='hasProblem'));
 const conditional=buildCuriosityStoryPlan(build('O líquido flui pelo canal.\nSem guia, o líquido entra na câmara.\nO guia evita movimento.'));
 assert(!conditional.story.nodes.some(n=>n.role==='PROBLEM'||n.role==='SOLUTION'),'Absence/prevention alone does not identify a problem or a solution');
 assert(!conditional.story.potential.dimensions.hasProblem&&!conditional.story.potential.dimensions.hasSolution);
});
test('curiosity Writer route, source-exact trace, no filler for duration, rich semantic handoff',()=>{
 const p=build(rich),w=writeCausalCuriosity(p);assert(w.eligible,w.reason);assert.equal(w.route,'CAUSAL_CURIOSITY_PROCESS');assert.equal(w.metrics.editorialUnits,1);assert(w.metrics.groundedRatio>.7);assert.equal(w.lengthStatus,'KNOWLEDGE_LIMITED');
 for(const s of w.sentences.filter(s=>s.kind==='FACT')){assert(s.factIds.length&&s.relationIds.length&&s.storyNodeIds.length);assert(p.evidence.some(e=>s.evidenceIds.includes(e.id)&&e.normalizedText===s.text));assert.equal(w.script.slice(s.span.start,s.span.end),s.text);}
 assert.equal(w.handoff.relations.length,w.metrics.groundedKnowledgeUnits);assert(w.handoff.unsupportedLegacyRelations.length);assert.equal(w.handoff.visualExecution,'NOT_EVALUATED');
 assert(w.handoff.persistentSystemIntent.required);assert(w.handoff.relations.every(r=>r.visualHints.length));
});
test('functional reason is not historical invention, and co-occurrence is not cause',()=>{
 const a=buildCuriosityStoryPlan(build('O módulo de circulação contém uma câmara.\nO líquido flui pelo canal.\nO guia evita vazamento.'));
 assert(a.graph.edges.some(e=>e.relation==='PREVENTS'));assert(a.graph.edges.every(e=>e.causality==='FUNCTIONAL'));assert.deepEqual(a.story.historicalClaims,[]);
 assert(!mechanismFactsV2('The guide and overflow exist.').some(m=>m.fact.predicate==='CAUSES'));
});
test('deterministic artifacts and zero-network replay from JSON round-trip',()=>{
 const p=build(rich),a=buildCuriosityStoryPlan(p),w=writeCausalCuriosity(p),oldFetch=globalThis.fetch,oldRandom=Math.random,oldNow=Date.now;
 try{globalThis.fetch=(()=>{throw Error('NO NETWORK');}) as typeof fetch;Math.random=()=>{throw Error('NO RANDOM');};Date.now=()=>{throw Error('NO CLOCK');};
 assert(verifyCuriosityArtifacts(p,JSON.parse(JSON.stringify(a))));assert(verifyCuriosityWriter(p,JSON.parse(JSON.stringify(w)),a));assert(verifyMechanismKnowledge(p,a.knowledge));
 }finally{globalThis.fetch=oldFetch;Math.random=oldRandom;Date.now=oldNow;}
});
test('tamper and re-signed tamper: graph relation, story node, problem solution link, Evidence span',()=>{
 const p=build(rich),a=buildCuriosityStoryPlan(p),w=writeCausalCuriosity(p);
 for(const mutate of [(x:typeof a)=>{x.graph.edges[0].relation='CAUSES';},(x:typeof a)=>{x.story.nodes[0].role='PROBLEM';},(x:typeof a)=>{x.story.links[0].to='fake';}]){const b=structuredClone(a);mutate(b);assert(!verifyCuriosityArtifacts(p,b));}
 const bad=structuredClone(w);bad.script+=' Invented fact.';const{fingerprint:_,...raw}=bad;bad.fingerprint=jsonHash(raw);assert(!verifyCuriosityWriter(p,bad));
 const ep=structuredClone(p);ep.evidence[0].sourceSpan.text+='x';assert.throws(()=>buildMechanismKnowledge(ep),/FINGERPRINT|SPAN/);
 const signed=structuredClone(p);signed.evidence[0].supports.predicate='UNLICENSED';const{fingerprint:ef,...er}=signed.evidence[0];signed.evidence[0].fingerprint=jsonHash(er);signed.fingerprint=packFingerprint(signed);assert.throws(()=>buildMechanismKnowledge(signed),/REDERIVATION/);
});
test('process acquisition respects provider 429 stop, without network or retry bypass',async()=>{
 let calls=0;const result=await runWebResearch(request(),verticalWebConfig('pt'),{searchProvider:{kind:'SYNTHETIC_429_PROVIDER',search:async()=>{calls++;return{results:[],diagnostic:'SEARCH_PROVIDER_UNAVAILABLE HTTP 429',latencyMs:0};}}});
 assert.equal(calls,1);assert.equal(result.acceptedSources.length,0);assert.equal(result.queryPlan.length,1);assert.equal(result.quality.resultState,'REAL_RESEARCH_BLOCKED');
});
test('anti-hardcode scanner detects injected topics and acquired source/script targets',()=>{
 assert(scanRuntimeText('src/fake.ts',"return 'motor a jato';").some(h=>h.classification==='BLOCKER'));
 assert(scanRuntimeText('src/fake.ts',"return 'https://source.example/secret';",['https://source.example/secret']).some(h=>h.classification==='BLOCKER'));
 assert(scanRuntimeText('src/fake.ts','const expected = "A prepared complete solution";',['A prepared complete solution']).some(h=>h.classification==='BLOCKER'));
});
test('queries are subject-driven, missing-relation directed, scoped opt-in, and use bilingual families',()=>{
 const r=request(),plan=planResearch(r),p=build(rich),q=processQueries(plan);assert.equal(q[0].text,'módulo de circulação');assert(q[1].text.includes('princípio de funcionamento'));
 assert(processResearchGaps(p).every(g=>g.id&&g.missingRelation&&g.evidenceRequirement));assert(processQueries(plan,p,1).every(q=>q.derivedFrom?.startsWith('PG_')));
 assert.deepEqual(broadQueriesV3(plan,webConfig({enabled:true})),q);
 const en=processQueries(planResearch({...r,topic:'How does a circulation module work?'}));assert(en[1].text.includes('working principle'));
 assert.throws(()=>validateResearchRequest({...r,researchGoal:'RANKING'}),/mechanismVersion/);
});
test('cross-domain fictitious fixtures use the same grammar and Writer',()=>{
 for(const [name,rows] of [['câmara de circulação',rich.replaceAll('módulo de circulação','câmara de circulação')],['módulo de giro','O módulo de giro contém uma roda.\nO eixo gira a roda.\nO atrito causa vibração.\nO suporte evita vibração.\nO módulo de giro produz movimento.']] as const){const r={...request(),topic:'Como funciona um '+name+'?'};const p=build(rows,r,[source(rows,'s',name)]);assert(buildMechanismKnowledge(p).metrics.physicalClaims>0);assert(writeCausalCuriosity(p).eligible);}
});
test('English topic subject, full EvidencePack, story and Writer integrate without translation or empty queries',()=>{
 const text='The circulation module contains a chamber.\nThe fluid flows through the channel.\nFriction causes vibration.\nThe guide prevents vibration.\nThe fluid becomes vapor.\nThe circulation module produces vapor.';
 const r={...request(),topic:'How does a circulation module work?',sourcePolicy:{...request().sourcePolicy,allowEnglishExtraction:true}};
 const p=build(text,r,[source(text,'s','Circulation module','en')]),w=writeCausalCuriosity(p);
 assert.equal(processQueries(planResearch(r))[0].text,'circulation module');assert(buildMechanismKnowledge(p).relations.length>=6);assert(w.eligible,w.reason);assert(w.script.includes('The fluid flows through the channel.'));assert(w.handoff.relations.every(r=>r.proof.length));
});
test('benchmark paraphrases preserve principal intent and evidence requirements',()=>{
 for(const [a,b] of [['Como funciona uma turbina hidráulica?','Explique o funcionamento de uma turbina hidráulica.'],['Como uma geladeira consegue resfriar alimentos?','Explique como funciona a refrigeração de uma geladeira.']]){const x=buildTopicPlan({topicPlanningVersion:1,topic:a}),y=buildTopicPlan({topicPlanningVersion:1,topic:b});assert.equal(x.researchRoute.level,y.researchRoute.level);assert.equal(x.researchRoute.researchGoal,y.researchRoute.researchGoal);assert.deepEqual(x.claimRequirements.map(r=>[r.claimFamily,r.evidenceRequirement]),y.claimRequirements.map(r=>[r.claimFamily,r.evidenceRequirement]));}
});
test('Cold, fiction, hypothetical, high risk regression: no relaxation',()=>{
 const cold=JSON.parse(readFileSync('tests/fixtures/phase24/cold-phase23-reference.json','utf8')),p=buildTopicPlan({topicPlanningVersion:1,topic:cold.request.topic});assert.equal(p.researchRoute.level,'STRICT');assert.equal(topicWriterGate(p,cold.outcome).decision,'BLOCKED');assert.equal(buildRoutedResearchRequest(p,{id:'cold'})!.sourcePolicy!.minIndependentSources,2);
 const fiction=buildTopicPlan({topicPlanningVersion:1,topic:'Um astronauta acorda sozinho em Marte e encontra uma estrutura misteriosa.'});assert.equal(fiction.analysis.contentMode,'CREATIVE');assert(!fiction.researchRoute.evidenceRequirements.some(e=>e.claimFamily==='FICTIONAL_EVENT'));
 const hypothetical=buildTopicPlan({topicPlanningVersion:1,topic:'O que aconteceria se a Lua desaparecesse?'});assert.equal(hypothetical.analysis.factualityProfile.hypotheticalPremise?.asserted,false);
 const r={...request(),sourcePolicy:{...request().sourcePolicy,minIndependentSources:2}};assert.equal(build(rich,r).quality.productionEligibility,'RESEARCH_INCOMPLETE');assert(!writeCausalCuriosity(build(rich,r)).eligible);
});
test('runtime anti-hardcode covers all eight processes and benchmark-specific source/script strings',()=>{
 const banned=['poco artesiano','artesian well','turbina hidraulica','hydraulic turbine','motor a jato','jet engine','bomba d agua','water pump','geladeira','refrigerator','elevador','elevator','usina hidreletrica','hydroelectric','tratamento de agua','water treatment'];
 const files:string[]=[];const walk=(d:string)=>{for(const n of readdirSync(d)){const f=path.join(d,n);if(statSync(f).isDirectory())walk(f);else if(/\.tsx?$/.test(f))files.push(f);}};walk('src');walk('cli');
 for(const f of files){const raw=readFileSync(f,'utf8'),t=normalize(raw).replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ');for(const b of banned){const name=f.replace(/\\/g,'/');if(name==='src/writer/topic.ts'&&b==='poco artesiano')continue;if(name==='src/topic/signals.ts'&&['geladeira','refrigerator','elevador','elevator'].includes(b)){assert(raw.split('\n').filter(l=>normalize(l).includes(b)).every(l=>/^ TECHNICAL:/.test(l)),'Only existing generic domain lexicon members allowed');continue;}assert(!t.includes(b),f+' '+b);}}
});
