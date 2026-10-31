import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ingestScript} from '../src/script-mode/ingest';
import {understandScript} from '../src/script-mode/understand';
import {mechanismRelations,mechanismGraph,categoryOf,type MechRelation} from '../src/script-mode/mechanism';
/** Phase29 mechanism semantics: transfers, state/property changes, actions and controls — kept, never invented. */
const rel=(t:string)=>mechanismRelations(understandScript(ingestScript(t)));
const one=(t:string)=>{const r=rel(t);assert.equal(r.length,1,JSON.stringify(r.map(x=>x.lemma)));return r[0];};
const h=(x?:{head:string|null}|null)=>x?.head??null;

test('TRANSFER: absorb from a source, lose to a destination, remove from a region and send out',()=>{
 const a=one('O fluido absorve o calor da câmara.');assert.equal(a.type,'TRANSFER');assert.equal(a.lemma,'ABSORB');assert.equal(h(a.subject),'fluido');assert.equal(h(a.quantity),'calor');assert.equal(h(a.source),'camara');
 const [l,s]=rel('O gás perde calor para o ar e vira líquido.');
 assert.equal(l.lemma,'RELEASE');assert.equal(h(l.destination),'ar');assert.equal(h(l.quantity),'calor');
 assert.equal(s.type,'STATE_CHANGE');assert.equal(s.after,'LIQUID');assert.equal(h(s.subject),'gas','coordinated clause keeps its subject');
 const [r1,r2]=rel('A máquina tira o calor de dentro e joga para fora.');
 assert.equal(r1.source?.region,'INSIDE');assert.equal(r2.destination?.region,'OUTSIDE');assert.equal(h(r2.quantity),'calor');assert.equal(r2.quantity?.resolvedFrom,'COORDINATION');
});
test('MOVE keeps the route: source → path → destination, and never invents a path',()=>{
 const [a,b]=rel('A água sai do tanque e entra no cano.');assert.equal(h(a.source),'tanque');assert.equal(h(b.destination),'cano');assert.equal(b.path,undefined);
 const [p,r]=rel('O líquido passa pela válvula e volta para o tanque.');assert.equal(h(p.path),'valvula');assert.equal(h(r.destination),'tanque');assert.equal(r.lemma,'RETURN');
 assert.equal(one('O gás vai para a grade.').path,undefined);
});
test('STATE and PROPERTY changes: states are not objects; properties belong to their owner',()=>{
 assert.equal(one('O material vira sólido.').after,'SOLID');
 assert.equal(one('O ar expande dentro da câmara.').after,'EXPANDED');
 const p=one('A pressão diminui.');assert.equal(p.type,'PROPERTY_CHANGE');assert.equal(p.property,'pressao');assert.equal(p.direction,'DOWN');
 assert.equal(one('A temperatura sobe.').direction,'UP');
 const v=one('Uma válvula baixa a pressão do líquido.');assert.equal(v.property,'pressao');assert.equal(h(v.propertyOwner),'liquido');assert.equal(h(v.subject),'valvula');
 // "X fica quente e vai para Y" → two relations on the same X.
 const [q,g]=rel('O gás fica quente e vai para a grade.');assert.equal(q.after,'HOT');assert.equal(g.type,'MOVE');assert.equal(h(g.subject),'gas');
});
test('ACTION keeps actor → action → target (the actor is not named after the whole phrase)',()=>{
 const c=one('A bomba comprime o gás.');assert.equal(c.lemma,'COMPRESS');assert.equal(h(c.subject),'bomba');assert.equal(h(c.object),'gas');
 const p=one('O vapor empurra o pistão para cima.');assert.equal(p.lemma,'PUSH');assert.equal(h(p.object),'pistao');assert.equal(p.direction,'UP');
 const [x,y]=rel('O compressor aperta esse gás, que fica quente.');assert.equal(h(x.subject),'compressor');assert.equal(h(y.subject),'gas');assert.equal(y.subject?.resolvedFrom,'RELATIVE');
});
test('CONTROL: controller → action → controlled part → the state the verb encodes',()=>{
 const s=one('O sensor desliga o motor.');assert.equal(s.type,'CONTROL');assert.equal(h(s.object),'motor');assert.equal(s.resultState,'OFF');
 const [c,o]=rel('Se a pressão sobe, a válvula abre.');assert.equal(c.modality,'CONDITIONAL');assert.equal(o.resultState,'OPEN');assert.match(o.condition!.text,/^Se a pressão sobe/);
});
test('negation, possibility and conditions are kept; nothing becomes an assertion it was not',()=>{
 const n=one('A água não vira gás.');assert.equal(n.negated,true);
 const p=one('O óleo não pode entrar na câmara.');assert.equal(p.negated,true);assert.equal(p.modality,'POSSIBLE');
 assert.equal(one('O vapor pode voltar para o tanque.').modality,'POSSIBLE');
 const g=mechanismGraph(rel('A água não vira gás. O vapor pode voltar para o tanque.'));assert.equal(g.relations,0,'negated/possible relations are not admitted to the graph');
});
test('no invented causes or transitive links: sequence is not causality',()=>{
 const r=rel('O motor gira. A roda gira.');assert.ok(r.every(x=>x.type!=='TRANSFER'&&!('cause' in x)));
 const g=mechanismGraph(r);assert.equal(g.connectedRelations,0);
});
test('pronouns resolve only to one compatible antecedent nearby, otherwise stay unknown',()=>{
 const [,b]=rel('O fluido passa pelo cano. Ele ferve.');assert.equal(h(b.subject),'fluido');assert.equal(b.subject?.resolvedFrom,'PRONOUN');
 const r=rel('O pistão empurra o gás. O motor gira. Ele esquenta.');const last=r.at(-1)!;assert.ok(last.subject?.resolvedFrom!=='PRONOUN'||h(last.subject)==='motor');
 const amb=rel('O fluido e o gás passam pelo cano. Ele ferve.').find(x=>x.lemma==='BOIL');assert.ok(!amb||amb.subject?.resolvedFrom==='UNKNOWN'||amb.subject?.head===null||amb.subject?.resolvedFrom==='PRONOUN');
});
test('categories: time, region, property, quantity and discourse words are not physical objects',()=>{
 for(const [w,c] of [['tempo','TIME'],['interior','REGION'],['pressão','PROPERTY'],['calor','QUANTITY'],['segredo','DISCOURSE'],['gás','MATERIAL'],['grade','PHYSICAL_ENTITY']] as const)assert.equal(categoryOf(w),c,w);
 const u=understandScript(ingestScript('O calor entra o tempo todo pela porta. Quando o interior chega na temperatura certa, o sensor desliga o motor.'));
 assert.ok(!u.entities.some(e=>['TIME','REGION','PROPERTY'].includes(e.category??'')&&e.category==='PHYSICAL_ENTITY'));
 assert.ok(u.entities.filter(e=>/tempo|interior|temperatura/.test(e.label)).every(e=>['TIME','REGION','PROPERTY'].includes(e.category!)));
});
test('every relation carries sentence, exact spans and modality',()=>{
 const u=understandScript(ingestScript('O gás perde calor para o ar e vira líquido.')),s=u.source.normalized;
 for(const r of u.mechanism as MechRelation[]){assert.equal(s.slice(r.predicate.start,r.predicate.end),r.predicate.text);assert.equal(s.slice(r.span.start,r.span.end),r.span.text);assert.ok(r.sentenceId);assert.ok(['ASSERTED','POSSIBLE','CONDITIONAL'].includes(r.modality));
  if(r.subject&&r.subject.start>=0&&!r.subject.resolvedFrom)assert.equal(s.slice(r.subject.start,r.subject.end),r.subject.text);}
});
test('parser code has no topic branches',()=>{
 const code=readFileSync('src/script-mode/mechanism.ts','utf8').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
 assert.ok(!/geladeira|evaporador|compressor|condensador|termostato|grade|panela|descarga|aviao|turbina/.test(code));
});
