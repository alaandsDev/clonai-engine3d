import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { analyzeScript, parseSemantics, toAutoDirectorInput, semanticQa, type SemanticAnalysis, type SemanticInput } from '../src/semantics';
import { planAutoDirector } from '../src/autodirector/planner';
import { compileAutoDirector } from '../src/autodirector/compiler';
import { evaluateDirected } from '../src/engine3d/directed';
import { normalizedView, normalize } from '../src/semantics/normalize';
const fixture = (name: string): SemanticInput => JSON.parse(readFileSync(new URL('../examples/semantics/' + name + '.json', import.meta.url), 'utf8'));
const parse = (script: string) => analyzeScript({ version: 1, id: 'independent-input', language: 'pt-BR', script });
const plan = (a: SemanticAnalysis) => planAutoDirector(toAutoDirectorInput(a));
for (const file of readdirSync(new URL('../examples/semantics/gold/', import.meta.url)).sort()) {
    const name = file.replace('.gold.json', '');
    test('semantic gold ' + name, () => {
        const input = fixture(name), gold = JSON.parse(readFileSync(new URL('../examples/semantics/gold/' + file, import.meta.url), 'utf8')), a = analyzeScript(input), p = plan(a);
        assert.equal('claims' in input, false);
        assert(semanticQa(a).passed);
        for (const tag of gold.entityTags ?? [])
            assert(a.entities.some(e => e.semanticTags.includes(tag)), tag);
        for (const type of gold.entityTypes ?? [])
            assert(a.entities.some(e => e.type === type), type);
        for (const predicate of gold.predicates ?? [])
            assert(a.predicates.some(p => p.name === predicate), predicate);
        for (const type of gold.claimTypes ?? [])
            assert(a.claims.some(c => c.type === type), type);
        for (const type of gold.forbiddenClaimTypes ?? [])
            assert(!a.claims.some(c => c.type === type), type);
        for (const type of gold.relationTypes ?? [])
            assert(a.relations.some(r => r.type === type), type);
        for (const type of gold.forbiddenRelationTypes ?? [])
            assert(!a.relations.some(r => r.type === type), type);
        for (const [text, tag] of Object.entries(gold.references ?? {})) {
            const refs = a.references.filter(r => r.sourceSpan.text === text);
            assert(refs.length, text);
            for (const ref of refs) {
                assert(ref.selectedEntityId, text);
                assert(a.entities.find(e => e.id === ref.selectedEntityId)?.semanticTags.includes(tag as string));
            }
        }
        if (gold.quantities)
            assert.deepEqual(a.quantities.map(q => [q.value, q.dimension]), gold.quantities);
        if (gold.direction)
            assert(a.relations.some(r => r.details.direction === gold.direction));
        if (gold.oneSubjectFor)
            assert.equal(new Set(a.predicates.filter(p => gold.oneSubjectFor.includes(p.name)).map(p => p.subjectEntityId)).size, 1);
        if (gold.causalConfidence) {
            const r = a.relations.find(r => r.type === 'CAUSE_EFFECT')!;
            assert(gold.causalConfidence.includes(r.confidence));
            assert.deepEqual(r.predicateIds.map(id => a.predicates.find(p => p.id === id)!.name), gold.causePredicates);
        }
        if (gold.ambiguousReference) {
            const r = a.references.find(r => r.sourceSpan.text === gold.ambiguousReference)!;
            assert.equal(r.selectedEntityId, null);
            assert.equal(r.confidence, 'AMBIGUOUS');
            assert(r.candidateEntityIds.length > 1);
            assert(a.ambiguities.some(a => a.type === 'AMBIGUOUS_REFERENCE'));
        }
        if (gold.noHighDependent)
            assert(a.claims.filter(c => c.referenceIds.some(id => a.references.find(r => r.id === id)?.selectedEntityId === null)).every(c => c.confidence !== 'HIGH' && c.status !== 'RESOLVED'));
        if (gold.noHighAmbiguous)
            assert(a.claims.filter(c => c.ambiguityIds.length).every(c => c.confidence !== 'HIGH'));
        if (gold.negatedPredicate)
            assert(a.predicates.some(p => p.name === gold.negatedPredicate && p.negated));
        if (gold.modalPredicate)
            assert(a.predicates.filter(p => p.name === gold.modalPredicate).every(p => p.modality !== 'ASSERTED'));
        if (gold.questionOnly)
            assert(a.claims.every(c => c.type === 'QUESTION' && c.interrogative && !c.requiresVisualProof));
        if (gold.quantityCount !== undefined)
            assert.equal(a.quantities.length, gold.quantityCount);
        for (const concept of gold.forbiddenConcepts ?? [])
            assert(!normalize(JSON.stringify(a)).includes(normalize(concept)), concept);
        if (gold.executable !== undefined)
            assert.equal(p.directedSequences.length > 0, gold.executable);
        if (gold.noDirect)
            assert(p.visualProofPlan.every(c => c.plannedProof !== 'DIRECT'));
        if (gold.requiredGap)
            assert(p.visualGaps.some(g => g.reason === gold.requiredGap));
        if (gold.hasGaps)
            assert(p.visualGaps.length);
        if (gold.ellipsis)
            assert(a.mentions.some(m => m.kind === 'ELLIPSIS' && a.entities.find(e => e.id === m.entityId)?.semanticTags.includes('vehicle')));
        if (gold.stateProcess)
            assert(a.claims.some(c => c.stateTransition?.process === gold.stateProcess && c.stateTransition?.final === gold.stateFinal));
        if (gold.primaryPredicates)
            assert.deepEqual(a.claims.filter(c => c.requiresVisualProof).map(c => c.predicate), gold.primaryPredicates);
        if (gold.words) {
            const n = input.script.split(/\s+/).length;
            assert(n >= gold.words[0] && n <= gold.words[1]);
        }
    });
}
test('semantic spans retain accents, decomposed Unicode, emoji and UTF16 offsets', () => {
    const a = parse('💧 A água sobe pelo tubo. Ela entra na caixa.');
    assert(semanticQa(a).passed);
    for (const p of a.predicates)
        assert.equal(a.script.slice(p.sourceSpan.start, p.sourceSpan.end), p.sourceSpan.text);
    const v = normalizedView('💧 água');
    const start = v.text.indexOf('agua'), s = v.span(start, start + 4);
    assert.equal(s.text, 'água');
});
test('semantic input rejects manual claims and topic-only inputs', () => { assert.throws(() => analyzeScript({ ...fixture('water'), claims: [] } as SemanticInput)); assert.throws(() => analyzeScript({ version: 1, id: 'x', language: 'pt-BR', topic: 'water' } as unknown as SemanticInput)); });
test('semantic measured quantities cover requested signed words, decimal, units and ranks', () => {
    for (const [script, value, dimension] of [['A temperatura é -89°C.', -89, 'TEMPERATURE'], ['A temperatura é menos oitenta e nove graus.', -89, 'TEMPERATURE'], ['A temperatura é 63 graus negativos.', -63, 'TEMPERATURE'], ['O valor é 20%.', 20, 'PERCENTAGE'], ['O valor é vinte por cento.', 20, 'PERCENTAGE'], ['A distância é cinco quilômetros.', 5, 'DISTANCE'], ['O tempo é três horas.', 3, 'TIME'], ['A velocidade é 5 km/h.', 5, 'SPEED'], ['O valor é 2,5 metros.', 2.5, 'DISTANCE'], ['número 1', 1, 'COUNT'], ['primeiro lugar', 1, 'RANK'], ['#5', 5, 'RANK'], ['posição cinco', 5, 'RANK']] as const) {
        const a = parse(script);
        assert(a.quantities.some(q => q.value === value && q.dimension === dimension), script);
    }
});
test('semantic two numbers retain order and decrease compares signed values', () => { const a = analyzeScript(fixture('quantity')); const r = a.relations.find(r => r.details.initial === -20)!; assert.equal(r.details.final, -60); assert.equal(r.details.direction, 'DECREASE'); });
test('semantic contradictory numeric direction abstains without correcting facts', () => { const a = parse('A temperatura caiu de -60 graus para -20 graus.'); assert(a.ambiguities.some(a => a.type === 'CONFLICTING_INTERPRETATIONS')); assert(a.claims.every(c => c.confidence !== 'HIGH')); assert(plan(a).visualProofPlan.every(c => c.plannedProof !== 'DIRECT')); });
test('semantic cause marker mutation removes causal proposition', () => { const x = fixture('causal'); const positive = analyzeScript(x), negative = parse(x.script.replace('Por isso, ', '')); assert(positive.claims.some(c => c.type === 'CAUSE_EFFECT')); assert(!negative.claims.some(c => c.type === 'CAUSE_EFFECT')); assert(!negative.relations.some(r => r.type === 'CAUSE_EFFECT')); });
test('semantic antecedent removal leaves a reference unresolved', () => { const a = parse('Ele começou a congelar.'); assert(a.unresolvedReferences.length); assert.equal(a.predicates[0].subjectEntityId, null); assert(a.claims.every(c => c.confidence !== 'HIGH')); });
test('semantic negation removal changes semantics, never silently cancels double negatives', () => { const a = parse('O carro não congelou.'), b = parse('O carro congelou.'); assert(a.predicates[0].negated); assert(!b.predicates[0].negated); assert.notEqual(a.fingerprint, b.fingerprint); const double = parse('O carro não deixou de não congelar.'); assert(double.ambiguities.some(a => a.type === 'CONFLICTING_INTERPRETATIONS')); assert(plan(double).visualProofPlan.every(c => c.plannedProof !== 'DIRECT')); });
test('semantic possible/hypothetical/uncertain and question assertions are guarded', () => { for (const script of ['A água pode congelar.', 'A água poderia congelar.', 'Talvez a água congele.', 'Provavelmente a água congelou.', 'Será que a água congela?']) {
    const a = parse(script), p = plan(a);
    assert(p.visualProofPlan.every(c => c.plannedProof !== 'DIRECT'), script);
    assert(!a.claims.some(c => c.requiresVisualProof && c.modality === 'ASSERTED' && !c.interrogative && c.status === 'RESOLVED'), script);
} });
test('semantic two same-type entities do not force a pronoun choice', () => { const a = parse('O carro azul ficou perto do carro vermelho. Ele começou a congelar.'); assert.equal(a.references.find(r => r.sourceSpan.text === 'Ele')?.selectedEntityId, null); assert(a.references.some(r => r.confidence === 'AMBIGUOUS')); });
test('semantic reference outside bounded context abstains', () => { const a = parse('O carro estava normal. A porta abre. A temperatura caiu. A água entra. Ele começou a congelar.'); assert.equal(a.references.find(r => r.sourceSpan.text === 'Ele')?.selectedEntityId, null); });
test('semantic freeze completion and ice are never invented from dust or onset alone', () => { for (const script of ['O carro começou a acumular gelo.', 'O carro começou a acumular poeira. Depois o veículo ficou coberto.']) {
    const a = parse(script);
    if (script.includes('poeira'))
        assert(!a.claims.some(c => c.stateTransition?.process === 'ACCUMULATE ICE'));
    assert(plan(a).visualProofPlan.every(c => c.plannedProof !== 'DIRECT'));
} });
test('semantic comparison preserves operands and difference without absolute values', () => { const a = parse('A cidade A é vinte graus mais fria que a cidade B.'); const r = a.relations.find(r => r.type === 'COMPARISON')!; assert(r.subjectEntityId && r.objectEntityId && r.subjectEntityId !== r.objectEntityId); assert.equal(r.details.operator, 'COLDER_THAN'); assert.equal(r.details.difference, 20); assert.equal(r.details.absoluteValuesInferred, false); assert(a.claims.some(c => c.type === 'COMPARISON')); assert(!a.claims.some(c => c.type === 'TEMPERATURE')); });
test('semantic ranking plus temperature keeps separate quantities and claims', () => { const a = parse('Em quinto lugar, a cidade Aurora registra menos vinte graus.'); assert(a.quantities.some(q => q.value === 5 && q.dimension === 'RANK')); assert(a.quantities.some(q => q.value === -20 && q.dimension === 'TEMPERATURE')); assert(a.claims.some(c => c.type === 'RANKING')); assert(a.claims.some(c => c.type === 'TEMPERATURE')); assert(!a.relations.some(r => r.type === 'COMPARISON')); });
test('semantic temporal before/after is explicit and overlap is not invented as after', () => { const a = parse('O carro congelou. Depois o veículo ficou coberto.'); assert(a.relations.some(r => r.type === 'TEMPORAL_AFTER')); const b = parse('Enquanto a água entra, o nível aumenta.'); assert(!b.relations.some(r => r.type === 'TEMPORAL_AFTER')); });
test('semantic dedup merges exact alias repetitions, retaining evidence and distinct changes', () => { const a = parse('O carro congelou. Ele congelou. O veículo congelou.'); assert.equal(a.claims.filter(c => c.predicate === 'FREEZE').length, 1); assert(a.claims[0].sourceEvidence.length >= 3); const b = parse('O carro congelou. Depois o veículo derreteu. O carro congelou.'); assert.equal(b.claims.filter(c => c.predicate === 'FREEZE').length, 2); });
test('semantic claim chains share entity and retain distinct level/storage propositions', () => { const a = analyzeScript(fixture('water')); const level = a.claims.find(c => c.predicate === 'INCREASE')!, store = a.claims.find(c => c.predicate === 'STORE')!; assert(level.previousClaimIds.length); assert(store.previousClaimIds.length); assert.notEqual(level.canonicalFingerprint, store.canonicalFingerprint); });
test('semantic deterministic, independent calls, renamed IDs/proper names and vehicle synonym', () => { const x = fixture('water'), a = analyzeScript(x); assert.deepEqual(a, analyzeScript(x)); analyzeScript(fixture('ambiguous')); assert.deepEqual(a, analyzeScript(x)); const renamed = analyzeScript({ ...fixture('external-knowledge'), id: 'different-name', script: fixture('external-knowledge').script.replace('Vostok', 'Aurora') }); assert.deepEqual(a.language, renamed.language); assert.equal(renamed.entities[0].type, 'PLACE'); assert.equal(renamed.quantities.length, 0); const b = analyzeScript({ ...fixture('freezing'), id: 'random-id', script: fixture('freezing').script.replace('carro', 'veículo') }); assert.equal(plan(b).directedSequences.length, 1); });
test('semantic adapter preserves source, provenance, confidence and never re-labels claims as human', () => { const a = analyzeScript(fixture('water')), x = toAutoDirectorInput(a), p = planAutoDirector(x), c = compileAutoDirector(p); assert.equal(x.script, a.script); assert(x.claims!.every(c => c.extraction?.extractionSource === 'SEMANTIC_ENGINE')); assert(p.claims.every(c => c.source === 'SEMANTIC_ENGINE')); assert(c.renderPlan.renderable); a.claims[0].negated = false; assert.throws(() => toAutoDirectorInput(a), /SEMANTIC_FINGERPRINT/); });
test('semantic strict rejects ambiguity and Auto Director strict rejects impossible proof', () => { assert.throws(() => toAutoDirectorInput(analyzeScript(fixture('ambiguous')), { mode: 'SEMANTIC_STRICT' }), /SEMANTIC_STRICT/); assert.throws(() => planAutoDirector(toAutoDirectorInput(analyzeScript(fixture('researchers')), { constraints: { mode: 'STRICT' } })), /AUTO_STRICT_GAP/); });
test('semantic script-only freezing reaches native sequence demonstration and final state', () => { const a = analyzeScript(fixture('freezing')), p = plan(a), c = compileAutoDirector(p), s = c.directedSequences[0]; assert(s); assert.equal(c.demonstrations.length, 1); assert(p.resourceSelections.some(s => s.resourceIds.includes('PROP_CAR_001'))); assert.equal(evaluateDirected(s, s.totalFrames).state.props.subject.parameters.frost, 1); assert(p.visualProofPlan.filter(c => c.plannedProof === 'DIRECT').length >= 2); });
test('semantic fixture IDs do not participate in extraction or visual choices', () => { const x = fixture('water'), a = plan(analyzeScript(x)), b = plan(analyzeScript({ ...x, id: 'a-completely-different-id' })); assert.deepEqual(a.resourceSelections, b.resourceSelections); assert.deepEqual(a.claims.map(c => [c.type, c.semanticTags]), b.claims.map(c => [c.type, c.semanticTags])); });
test('semantic dedup preserves different initial/context states and explicit temporal repetitions', () => { const a = parse('O carro estava normal. Ele estava exposto ao frio.'); assert.equal(a.claims.length, 2); const b = parse('O carro congelou. Depois o veículo congelou.'); assert.equal(b.claims.filter(c => c.predicate === 'FREEZE').length, 2); });
test('semantic state changes have no unquoted motor, battery, fuel or numeric temperature facts', () => { const a = parse('O carro ficou horas no frio e começou a acumular gelo.'); assert(!a.entities.some(e => /motor|bateria|combustivel/.test(e.canonicalName))); assert.equal(a.quantities.length, 0); assert(a.claims.filter(c => c.predicate === 'ACCUMULATE').every(c => c.stateTransition?.final === null)); });
test('semantic descriptor references and feminine/plural pronouns remain bounded and conservative', () => { for (const script of ['O carro estava normal. Esse começou a congelar.', 'O carro estava normal. O objeto começou a congelar.', 'A água entra no tubo. Ela sobe.', 'Pesquisadores trabalham. Eles trabalham.']) {
    const a = parse(script);
    assert(a.references.some(r => r.selectedEntityId !== null), script);
} const a = parse('O rádio ficou perto do carro. O objeto começou a congelar.'); assert(a.references.some(r => r.selectedEntityId === null)); });
test('semantic parse output owns its arrays and cannot mutate the rule lexicon',()=>{const input=fixture('water'),before=analyzeScript(input),parsed=parseSemantics(input);parsed.entities[0].semanticTags.push('caller-mutation');assert.deepEqual(analyzeScript(input),before);});
