import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildEvidencePack,contentHash,type SourceInput,type ResearchRequest} from '../src/research';
import {mechanismTextView} from '../src/research/contextual-mechanism';
import {localMechanismClauses,contextualModality} from '../src/research/mechanism-clauses';
import {buildMechanismKnowledge} from '../src/curiosity/knowledge';
import {mechanismConnectivity,phase27Readiness} from '../src/curiosity/connectivity';
import {buildCuriosityStoryPlan,curiosityStoryPotential} from '../src/curiosity/story';
import {buildKnowledgeLossTrace} from '../src/curiosity/knowledge-loss';
import {writeCausalCuriosity,verifyCuriosityWriter} from '../src/writer/curiosity';
import {validateEvidencePack} from '../src/research/qa';
import {jsonHash} from '../src/editorial/fingerprint';
const base=JSON.parse(readFileSync('examples/research/ranking-sources.json','utf8')).sources[0] as SourceInput;
const req=(topic='Como funciona um módulo de circulação?'):ResearchRequest=>({version:1,id:'context-fixture',topic,language:'pt-BR',researchGoal:'PROCESS',desiredFactTypes:['PROCESS'],sourcePolicy:{researchVersion:4,mechanismVersion:2,contextualMechanisms:true,allowEnglishExtraction:true}});
const build=(content:string,title='Módulo de circulação',r=req())=>buildEvidencePack(r,{version:1,id:'synthetic-context',fixture:true,labels:['DEMO_FIXTURE','SYNTHETIC_TEST_SOURCES','NOT_REAL_WORLD_FACTS'],sources:[{...structuredClone(base),id:'context',title,publisher:'Synthetic fixture institution',canonicalLocator:'https://fixture.example/context',contentType:content.includes('<h')?'text/html':'text/plain',content,contentHash:contentHash(content),provenance:{originKey:'fixture-context',description:'Fictitious mechanism text; not real-world facts'}}]});
const graphFixture=(tuples:string[][])=>{const k=buildMechanismKnowledge(build('O módulo é uma estrutura. O fluido flui pelo canal.'));const sample=k.relations[0];return{...k,relations:tuples.map(([subject,predicate,object],i)=>({...sample,id:'synthetic-edge-'+i,subject,predicate,object})),metrics:{...k.metrics,physicalClaims:tuples.filter(([,p])=>['FLOW','TRANSFORM'].includes(p)).length}};};

test('connectivity distinguishes a star from a multistep mechanism; ten isolated facts cannot become RICH',()=>{
 const star=graphFixture(Array.from({length:10},(_,i)=>['sistema','FLOW','destino '+i]));assert.equal(mechanismConnectivity(star).longestMechanismChain.edges,1);assert.equal(mechanismConnectivity(star).mechanismChainCoverage,0);
 const isolated=graphFixture(Array.from({length:10},(_,i)=>['sujeito '+i,['FLOW','TRANSFORM','USED_FOR','IS_A','PRECEDES'][i%5],'objeto '+i]));assert.notEqual(curiosityStoryPotential(isolated,true).rating,'RICH');assert.equal(mechanismConnectivity(isolated).connectedComponents,10);
 const chain=graphFixture([['fluido','FLOW','canal'],['canal','TRANSFORM','saída']]);const c=mechanismConnectivity(chain);assert.equal(c.longestMechanismChain.edges,2);assert.equal(c.mechanismChainCoverage,1);assert(c.longestMechanismChain.searchComplete);
});
test('cycles do not invent infinite chains; disconnected problem and solution do not create recovery',()=>{
 const k=graphFixture([['a','FLOW','b'],['b','FLOW','a'],['módulo','FAILS_BECAUSE','obstrução'],['guia','SOLVES','vibração']]);const c=mechanismConnectivity(k);assert.equal(c.longestMechanismChain.edges,1);assert.equal(c.problemSolutionChainCoverage,0);assert.equal(c.problemSolutionPairs.length,0);
 k.relations[3].object='obstrução';assert.equal(mechanismConnectivity(k).problemSolutionChainCoverage,1);
});
test('causal paths normalize inverse predicates and do not count purpose as actual causal propagation',()=>{
 const k=graphFixture([['pressão','CAUSES','fluxo'],['movimento','CAUSED_BY','fluxo'],['movimento','USED_FOR','objetivo']]);assert.equal(mechanismConnectivity(k).longestCausalChain.edges,2);
 const f=graphFixture([['impureza','CAUSES','obstrução'],['módulo','FAILS_BECAUSE','obstrução']]);assert.equal(mechanismConnectivity(f).longestCausalChain.edges,2);
});
test('Phase27 readiness requires all seven dimensions; metadata does not create assets or identity edges',()=>{
 const thin=graphFixture([['fluido','FLOW','canal']]);assert.equal(phase27Readiness(thin).status,'PARTIAL');assert(phase27Readiness(thin).missing.includes('problemSolution'));assert.equal(phase27Readiness(graphFixture([])).status,'NOT_READY');
 const rich=graphFixture([['a','FLOW','b'],['b','TRANSFORM','c'],['c','FLOW','d'],['a','FAILS_BECAUSE','obstrução'],['guia','SOLVES','obstrução'],['a','LOCATED_IN','câmara']]);assert.equal(phase27Readiness(rich).status,'READY');assert.equal(phase27Readiness(rich).visualExecution,'NOT_IMPLEMENTED');
});
test('KnowledgeLossTrace reports actual joins and unknown internals; reviewed annotations are never admission input',()=>{
 const p=build('O módulo é uma máquina que expele o fluido para gerar movimento. Ele gira a roda.'),a=buildCuriosityStoryPlan(p),w=writeCausalCuriosity(p),trace=buildKnowledgeLossTrace(p,a,w);
 assert(trace.traces.some(t=>t.stages.WRITER_USED===true));const missing=trace.traces.find(t=>t.text.startsWith('Ele '));assert(missing);assert.equal(missing.stages.CANDIDATE_EXTRACTED,false);assert.equal(missing.stages.SUBJECT_RESOLVED,null);assert.equal(trace.manualEvidence,false);assert.equal(trace.fingerprint,buildKnowledgeLossTrace(p,a,w).fingerprint);
 const bad=structuredClone(a);bad.graph.edges[0].to='invented';assert.throws(()=>buildKnowledgeLossTrace(p,bad,w),/PROVENANCE_MISMATCH/);
});
test('context proof and controlled realization cannot be re-signed to admit invented context or script',()=>{
 const p=build('O módulo é uma máquina que expele fluido para gerar movimento.'),a=buildCuriosityStoryPlan(p),w=writeCausalCuriosity(p);assert(verifyCuriosityWriter(p,w,a));
 const bad=structuredClone(p),e=bad.evidence.find(e=>e.mechanismContext)!;e.mechanismContext!.supportingSpans[0].text='invented support';const {fingerprint:_,...raw}=e;e.fingerprint=jsonHash(raw);const {fingerprint:__,...body}=bad;bad.fingerprint=jsonHash(body);assert.throws(()=>validateEvidencePack(bad));
 const wrong=structuredClone(w);wrong.script+=' Invented cause.';const {fingerprint:___,...writerBody}=wrong;wrong.fingerprint=jsonHash(writerBody);assert.equal(verifyCuriosityWriter(p,wrong),false);
});
test('contextual annotation view masks metadata with exact offsets; numbers remain numeric',()=>{
 const t='O módulo (AO 1945: grafia) move o fluido[7].';const v=mechanismTextView(t);assert.equal(v.masked.length,t.length);assert(!v.masked.includes('1945'));assert(!v.masked.includes('[7]'));assert(mechanismTextView('O fluido chega a 40 graus.').masked.includes('40'));
});
test('same source movement is not counted twice as FLOW and PASSES_THROUGH; discourse cue is not an actor',()=>{
 for(const text of ['Em seguida o fluido passa por um canal.','Then the fluid flows through the channel.']){const p=build(text),k=buildMechanismKnowledge(p);assert.equal(k.metrics.physicalClaims,1);assert(k.relations.every(r=>!/^Em seguida|^Then/.test(r.subject)));}
});
test('equative relative resolves explicit antecedent in two domains; ambiguity and pronouns refuse',()=>{
 for(const s of ['O módulo é um aparelho que expele fluido para gerar movimento.','A câmara é uma estrutura que empurra fluido para mover a roda.']){const r=localMechanismClauses(s);assert(r.some(r=>r.fact.factType==='PROCESS'));assert(r.some(r=>r.fact.predicate==='USED_FOR'));assert(r.every(r=>r.resolution==='CONTEXT_RESOLVED_RELATION'));}
 for(const s of ['Ela é uma máquina que empurra o fluido.','O módulo é uma estrutura perto da roda que gira o eixo.'])assert.equal(localMechanismClauses(s).filter(r=>r.fact.factType==='PROCESS').length,0);
});
test('explicit function stays purpose, not actual cause, in different components',()=>{
 for(const s of ['O suporte tem a função de reduzir a vibração.','The guide has the function of controlling the fluid.']){const r=localMechanismClauses(s);assert(r.some(r=>r.fact.predicate==='USED_FOR'));assert(!r.some(r=>r.fact.predicate==='CAUSES'));}
});
test('list label is structural evidence for local motion, not a guessed relative subject',()=>{
 for(const s of ['Canal — Parte do módulo na qual o líquido se move.','Câmara — Local onde a roda se move.']){const r=localMechanismClauses(s);assert(r.some(r=>r.fact.predicate==='IS_A'));assert(r.some(r=>r.fact.predicate==='MOVE_WITHIN'));assert.equal(contextualModality(s),'ASSERTED');}
 assert.equal(localMechanismClauses('O aparelho e a roda ficam juntos. Ele gira.').length,0);
});
test('operational frame and controlled gerund preserve the stated actor; no guessed relative attachment',()=>{
 for(const s of ['As estruturas funcionam através da pressão do fluido, transformando a energia em movimento.','The module operates using fluid, converting energy into motion.']){const r=localMechanismClauses(s);assert(r.some(r=>r.fact.predicate==='OPERATE_BY'));assert(r.some(r=>r.fact.predicate==='TRANSFORM'));assert(!r.some(r=>r.fact.predicate==='ROTATE'));}
});
test('embedded relative makes the gerund actor ambiguous; both languages refuse attribution and conditional truncation',()=>{
 for(const s of ['As estruturas funcionam através da pressão do fluido que move a roda, transformando energia em movimento.','The module operates using fluid which moves a wheel, converting energy into motion.']){const r=localMechanismClauses(s);assert(!r.some(r=>r.fact.predicate==='TRANSFORM'));assert(!r.some(r=>r.fact.predicate==='ROTATE'));assert(r.filter(r=>r.fact.predicate==='OPERATE_BY').every(r=>!r.text.includes('transformando')&&!r.text.includes('converting')));}
 assert.equal(localMechanismClauses('O módulo funciona através do fluido que gira a roda, transformando energia se o canal estiver aberto.').length,0);
});
test('nominal process group order is explicit; unordered lists do not create sequence or transitive cause',()=>{
 for(const s of ['As etapas de mistura e separação são seguidas pela filtragem.','The steps of mixing and cooling followed by separation.']){const r=localMechanismClauses(s);assert.equal(r.filter(r=>r.fact.predicate==='PRECEDES').length,1);assert(!r.some(r=>r.fact.predicate==='CAUSES'));assert(r.every(r=>!r.fact.subject.endsWith('são')));}
 assert.equal(localMechanismClauses('As etapas de mistura, filtração e separação.').filter(r=>r.fact.predicate==='PRECEDES').length,0);
});
test('bounded realization preserves conditional context and never treats a conditional connector as an actor',()=>{
 for(const text of ['Se a mistura estiver pronta, as etapas de mistura e filtração são seguidas pela separação.','If the mixture is ready, the steps of mixing and filtering are followed by separation.']){const r=localMechanismClauses(text).find(r=>r.fact.predicate==='PRECEDES');assert(r);assert.equal(r.text,text);assert(r.fact.qualifiers.includes('MODALITY:HYPOTHETICAL'));}
 for(const text of ['Quando o módulo é uma máquina que expele fluido.','When the chamber is a machine that expels fluid.'])assert.equal(localMechanismClauses(text).length,0);
});
test('contextual false positives: negation, metaphor, comparison, invented history, and numeric conditions refuse',()=>{
 for(const s of ['O módulo não é uma máquina que empurra fluido.','Como metáfora, o módulo é uma máquina que empurra ideias.','O aparelho foi criado porque o fluido parava.','Quando a pressão passa de 40, o módulo empurra fluido.'])assert.equal(localMechanismClauses(s).length,0,s);
});
test('precision review: malformed complements refuse, alias appositive resolves, ranking is not narrated as mechanism',()=>{
 assert(!localMechanismClauses('O módulo é um local em que recebe o fluido.').some(r=>r.fact.object==='um local em'));
 const alias=localMechanismClauses('Um aparelho, também conhecido como módulo, é um dispositivo que expele fluido.');assert(alias.some(r=>r.fact.subject==='Um aparelho'));
 const source='A tecnologia mais utilizada consiste nas etapas de mistura e filtração, seguidas pela separação.';
 const r=localMechanismClauses(source);assert.equal(r.length,1);assert.equal(r[0].fact.predicate,'PRECEDES');assert(!r[0].text.includes('mais utilizada'));assert(r[0].text.includes('mistura e filtração'));
});
test('document wrapper is process context, never subject substitution; two different processes',()=>{
 for(const name of ['circulação de fluido','mistura de fluido']){const r=req('Como funciona a '+name+'?'),text='<h1>Unidade de '+name+'</h1><h2>Processo de operação</h2><p>O fluido flui pelo canal. O atrito causa vibração.</p>';
  const p=build(text,'Unidade de '+name,r);assert(p.evidence.some(e=>e.mechanismContext));assert(p.evidence.filter(e=>e.mechanismContext).every(e=>!e.supports.subject.includes(name)));}
 const bad=build('<h1>Museu de circulação de fluido</h1><p>O fluido flui pelo canal.</p>','Museu de circulação de fluido',req('Como funciona a circulação de fluido?'));assert.equal(bad.evidence.filter(e=>e.mechanismContext).length,0);
});
test('component section context preserves ancestry; unrelated headings/history/captions stay excluded',()=>{
 const text='<h1>Módulo de circulação</h1><h2>Elementos de um módulo de circulação</h2><p>O fluido flui pelo canal.</p><figcaption>O motor move a roda.</figcaption><h2>História</h2><h3>Outro componente</h3><p>O motor gira a roda.</p>';
 const p=build(text);const ev=p.evidence.filter(e=>e.mechanismContext);assert(ev.some(e=>e.supports.predicate==='FLOW'));assert(!ev.some(e=>e.supports.subject.includes('motor')));assert(ev.every(e=>e.contextSpans?.length));
});
test('citation suffix cannot destroy the next sentence; orthography is not a measurement, two contexts',()=>{
 for(const text of ['O líquido flui pelo canal[7]. O atrito causa vibração.','O módulo (AO 1945: grafia) move o líquido.']){
  const p=build(text);assert(p.evidence.some(e=>e.mechanismContext));for(const e of p.evidence){assert.equal(p.sources[0].content.slice(e.sourceSpan.start,e.sourceSpan.end),e.exactText);}
 }
 assert(!build('O líquido flui a 40 graus.').evidence.some(e=>e.mechanismContext),'Factual numeric scope still refused');
});
