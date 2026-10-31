import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sentenceSpans} from '../src/script-mode/ingest';
import {writeProgressive,scriptCuriosityMetrics} from '../src/writer/progressive';
/** Curiosity-Driven Progressive Scripting: true statements reorganised into curiosity loops, nothing invented. */
const F='tests/fixtures/progressive/';
const DOMAINS={domestic:F+'domestico-chuveiro.txt',natural:F+'natural-chuva.txt',machine:F+'maquina-macaco.txt',biological:F+'biologico-suor.txt'};
const read=(f:string)=>readFileSync(f,'utf8');
const fold=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const SCHOOL=/^(?:depois|em seguida|para isso|primeiro|por fim|alem disso|na sequencia)\b/;

for(const [kind,file] of Object.entries(DOMAINS)){
 test(`${kind}: every statement survives, editorial units add no content, school transitions are gone`,()=>{
  const src=read(file),p=writeProgressive(src);
  assert.equal(p.audit.passed,true,JSON.stringify(p.audit));
  const n=sentenceSpans(src).length;
  assert.deepEqual([...new Set(p.units.filter(u=>u.kind==='FACT').map(u=>u.sourceIndex))].sort((a,b)=>a!-b!),[...Array(n).keys()]);
  assert.ok(sentenceSpans(p.script).every(s=>!SCHOOL.test(fold(s.text))));
  const m=scriptCuriosityMetrics(p.script,p),v1=scriptCuriosityMetrics(src);
  assert.equal(m.technicalTransitions,0);assert.ok(v1.technicalTransitions>=1);
  assert.equal(m.questionsClosed,m.questionsOpened);
 });
 test(`${kind}: every question is answered by a later statement (no decorative questions)`,()=>{
  const p=writeProgressive(read(file)),pos=new Map(p.units.map((u,i)=>[u.id,i]));
  for(const q of p.questions){assert.ok(q.answeredBy,q.text);assert.ok(pos.get(q.answeredBy!)!>pos.get(q.id)!);
   assert.equal(p.units.find(u=>u.id===q.answeredBy)!.kind,'FACT');}
  for(const u of p.units.filter(u=>u.kind==='EDITORIAL'))assert.ok(!/\b(?:sera que|quer saber|sabe o que)\b/.test(fold(u.text)),u.text);
 });
}
test('a paradox hook only when the text states opposite poles; otherwise the opening question leads',()=>{
 assert.equal(writeProgressive(read(DOMAINS.natural)).hookType,'PARADOX');
 for(const f of [DOMAINS.domestic,DOMAINS.machine])assert.notEqual(writeProgressive(read(f)).hookType,'PARADOX');
 assert.equal(writeProgressive(read(DOMAINS.biological)).hookType,'WHY');
});
test('paradox hook: the observation opens the video and comes back as the closing callback',()=>{
 const p=writeProgressive(read(DOMAINS.natural)),obs=p.units[0];
 assert.equal(obs.role,'HOOK_OBSERVATION');assert.equal(p.units[1].role,'QUESTION');
 assert.equal(p.units.filter(u=>u.sourceIndex===obs.sourceIndex).length,2);
 assert.equal(p.questions[0].answeredBy,p.units.find(u=>u.role==='CONSEQUENCE')!.id);
});
test('a purpose connector becomes a how-question answered by the same statement',()=>{
 const p=writeProgressive(read(DOMAINS.biological)),q=p.units.find(u=>u.operation==='PURPOSE_TO_HOW_QUESTION')!;
 assert.ok(q);assert.equal(p.units[p.units.indexOf(q)+1].id,q.answeredBy);
});
test('a control statement answers whether the controlled part runs all the time',()=>{
 const p=writeProgressive(read(DOMAINS.domestic)),q=p.units.find(u=>u.operation==='CONTROL_QUESTION')!;
 assert.ok(q&&/resistencia/.test(fold(q.text)),q?.text);
});
test('questions without an answer in the text are never inserted',()=>{
 // Something is taken in but never released later: no "where does it go" question.
 const p=writeProgressive('Como a esponja funciona? A esponja absorve a água. A esponja fica pesada.');
 assert.ok(!p.units.some(u=>u.operation==='DESTINATION_QUESTION'));
 // A purpose connector with nothing before it has no goal to ask about.
 const q=writeProgressive('Para isso, a bomba empurra a água. A água sobe.');
 assert.ok(!q.units.some(u=>u.operation==='PURPOSE_TO_HOW_QUESTION'));assert.equal(q.audit.passed,true);
});
test('a part that does not act on something already introduced gets no component bridge',()=>{
 const p=writeProgressive('Como funciona? O calor entra o tempo todo pela porta. A caixa guarda o calor.');
 assert.ok(!p.units.some(u=>u.operation==='COMPONENT_BRIDGE'&&/calor/.test(u.text)));
});
test('deterministic',()=>{for(const f of Object.values(DOMAINS))assert.equal(writeProgressive(read(f)).fingerprint,writeProgressive(read(f)).fingerprint);});
test('writer code has no topic branches',()=>{
 const code=fold(readFileSync('src/writer/progressive.ts','utf8'));
 assert.ok(!/geladeira|chuveiro|chuva|macaco|suor|compressor|evaporador|termostato|aviao|panela|descarga|barco/.test(code));
});

// ---- Retention compression (V2 → V3) ----
import {compressRetention,insertedWords} from '../src/writer/retention';
import {WORDS_PER_SECOND} from '../src/writer/progressive';
const FRIDGE_V1='roteiro-geladeira.txt';
for(const [kind,file] of Object.entries({...DOMAINS,fridge:FRIDGE_V1})){
 test(`retention ${kind}: shorter or equal, every statement kept, audit passes, no open question, visuals not reduced`,()=>{
  const v2=writeProgressive(read(file)),r=compressRetention(v2),v3=r.result;
  assert.equal(v3.audit.passed,true,JSON.stringify(v3.audit));
  assert.deepEqual(v3.audit.missingFacts,[]);assert.ok(v3.questions.every(q=>q.answeredBy));
  assert.ok(r.metrics.after.words<=r.metrics.before.words);// A fusion may add one function word (que/onde) while removing a repeated noun phrase.
  assert.ok(r.metrics.after.insertedWords<=r.metrics.before.insertedWords+r.operations.filter(o=>o.op.endsWith("FUSION")).length);
  assert.ok(r.metrics.after.visualizableBeats>=r.metrics.before.visualizableBeats);
  assert.equal(v3.hookType,v2.hookType);assert.equal(v3.paradoxes.length,v2.paradoxes.length);
  // A fused sentence stays short; fusions only add function words.
  assert.ok(v3.units.every(u=>wcount(u.text)<=22||!u.sourceIndices||u.sourceIndices.length===1));
  for(const o of r.operations)assert.ok(o.addedWords.every(w=>['que','onde','ao','e','para','conseguir'].includes(w)),o.op+':'+o.addedWords);
 });
}
const wcount=(s:string)=>s.split(/\s+/).filter(Boolean).length;
test('retention: structural extras are removed only above the target, the paradox hook and callback stay',()=>{
 const v2=writeProgressive(read(FRIDGE_V1)),r=compressRetention(v2);
 assert.ok(r.metrics.before.estimatedSeconds>60&&r.metrics.after.estimatedSeconds<=60);
 assert.equal(r.result.units[0].role,'HOOK_OBSERVATION');
 assert.ok(r.result.units.some(u=>u.role==='CONSEQUENCE'&&u.sourceIndices!.includes(v2.paradoxes[0].observationIndex)));
 assert.ok(r.result.loops.length>=2&&r.result.loops.length<=4);
 // With room to spare nothing structural is removed.
 const loose=compressRetention(v2,{maxSeconds:120});
 assert.ok(!loose.operations.some(o=>o.op==='QUESTION_REMOVED'||o.op==='QUESTION_TO_CAUSAL_TRANSITION'));
 assert.equal(loose.result.questions.length,v2.questions.length);
});
test('retention: under the target only lossless rewrites run',()=>{
 for(const f of Object.values(DOMAINS)){const r=compressRetention(writeProgressive(read(f)));
  assert.ok(r.operations.every(o=>['RELATIVE_FUSION','LOCATION_FUSION','REPEAT_FUSION','CALLBACK_FUSION','BRIDGE_REMOVED'].includes(o.op)),f);}
});
test('retention: generic fusions keep who-does-what',()=>{
 const p=writeProgressive('Como funciona? A bomba empurra a água. A água sobe pelo cano. A água vai para a caixa. Na caixa, a água fica parada.');
 const r=compressRetention(p),t=r.result.script;
 assert.match(t,/A bomba empurra a água, que sobe pelo cano\./);
 // The location fusion is either applied, or refused because the Director would lose the second action.
 assert.ok(/vai para a caixa, onde fica parada\./.test(t)||r.rejected.some(x=>x.op==='LOCATION_FUSION'&&/Visual Demonstration Director/.test(x.reason)));
 assert.ok(insertedWords(r.result)<=2);
});
test('retention is deterministic and has no topic branches',()=>{
 assert.equal(compressRetention(writeProgressive(read(FRIDGE_V1))).result.fingerprint,compressRetention(writeProgressive(read(FRIDGE_V1))).result.fingerprint);
 assert.ok(!/geladeira|chuveiro|chuva|macaco|suor|compressor|evaporador|termostato|grade/.test(fold(readFileSync('src/writer/retention.ts','utf8'))));
 assert.ok(WORDS_PER_SECOND>0);
});
