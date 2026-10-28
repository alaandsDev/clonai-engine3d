import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planAutoDirector } from '../src/autodirector/planner';
import { compileAutoDirector } from '../src/autodirector/compiler';
import { segmentScript } from '../src/autodirector/claims';
import { capabilityGraph } from '../src/autodirector/capabilities';
import { templates } from '../src/autodirector/scoring';
import { resources } from '../src/engine3d/registry';
import { evaluateDirected } from '../src/engine3d/directed';
import { proofChecks } from '../src/autodirector/qa';
const f = (name = 'water') => JSON.parse(readFileSync(new URL('../examples/autodirector/' + name + '.json', import.meta.url), 'utf8'));
for (const [text, type, template] of [['Em quinto, uma cidade.', 'RANKING', 'RANKING'], ['A temperatura chegou a -63 graus.', 'TEMPERATURE', 'TEMPERATURE'], ['10 versus 20.', 'COMPARISON', 'COMPARISON'], ['Qual você escolheria?', 'QUESTION', 'QUESTION'], ['A porta abre.', 'OBJECT_STATE', 'REVEAL_DOOR']] as const)
    test('auto supported template ' + template, () => { const x = f(); x.script = text; x.claims = [{ id: 'one', text, type, startOffset: 0, endOffset: text.length, importance: 'PRIMARY', requiresVisualProof: type !== 'QUESTION' }]; const p = planAutoDirector(x); assert.equal(p.templateSelections[0]?.template, template); assert.equal(p.visualGaps.length, 0); compileAutoDirector(p); });
test('auto unsupported boiling and negated freezing are gaps, not a related process marked direct', () => { for (const text of ['A água ferve e evapora.', 'O objeto não acumula gelo.']) {
    const x = f();
    x.script = text;
    x.claims = [{ id: 'one', text, type: 'PROCESS', startOffset: 0, endOffset: text.length, importance: 'PRIMARY', requiresVisualProof: true }];
    const p = planAutoDirector(x);
    assert(p.visualGaps.length);
    assert(p.visualProofPlan.every(p => p.plannedProof !== 'DIRECT'));
} });
test('auto actorless repetition metrics do not invent an actor', async () => { const { directedSamples, motionMetrics } = await import('../src/engine3d/directed-metrics'); const p = planAutoDirector(f()), m = motionMetrics(directedSamples(p.directedSequences[0]), 30, 480, 854); assert.equal(m.actorPositionVariety.centralFramePercent, 0); assert(m.compositionSignatures.every(s => s.signature.actorScreenRegion === 'ABSENT')); });
test('auto input is closed, script mandatory and offsets refer to original UTF16 source', () => { for (const mutate of [(x: any) => delete x.script, (x: any) => x.topic = 'water', (x: any) => x.version = 2, (x: any) => x.claims[0].endOffset = 9999]) {
    const x = f();
    mutate(x);
    assert.throws(() => planAutoDirector(x));
} const x = f(), u = segmentScript(x); assert.equal(u.map(x => x.sourceText).join(''), x.script); for (const a of u)
    assert.equal(x.script.slice(a.startOffset, a.endOffset), a.sourceText); });
test('auto explicit claims carry confidence/source; no fixture scene instructions', () => { const p = planAutoDirector(f()); for (const c of p.claims.filter(c => c.source === 'EXPLICIT'))
    assert.equal(c.confidence, 'HIGH'); assert(!('directedSequences' in f())); assert(p.qaSummary.sourceCoverage); });
test('auto heuristic recognition is limited and rhetorical negation not direct', () => { const x = f(); delete x.claims; const p = planAutoDirector(x); assert(p.claims.every(c => c.source === 'HEURISTIC')); assert(p.claims.some(c => c.confidence === 'MEDIUM')); assert(p.claims.find(c => c.unitId === 'unit_1')?.requiresVisualProof === false); });
test('auto capability snapshot and planning are independent of registry enumeration order', () => { assert.deepEqual(capabilityGraph(resources), capabilityGraph([...resources].reverse())); assert.deepEqual(planAutoDirector(f(), capabilityGraph(resources)), planAutoDirector(f(), capabilityGraph([...resources].reverse()))); });
test('auto water claims individually resolve transfer, ascent, fill and storage', () => { const p = planAutoDirector(f()); for (const id of ['C1', 'C2', 'C3', 'C4']) {
    const q = p.visualProofPlan.find(c => c.claimId === id)!;
    assert.equal(q.plannedProof, 'DIRECT');
    assert(Object.values(q.checks).every(Boolean));
} const s = p.directedSequences[0], program = s.demonstration!, path = program.subjects.find(s => s.kind === 'PATH')!.path!; assert(path.at(-1)![1] > path[0][1]); assert(program.steps.some(s => s.operation === 'CONNECT')); assert(program.steps.some(s => s.operation === 'FLOW')); assert(program.steps.some(s => s.operation === 'INCREASE')); assert(evaluateDirected(s, s.totalFrames).state.demonstration!.subjects.destination.parameters.fillLevel > 0); });
test('auto resource/template scoring is explained and templates not considered proof alone', () => { const p = planAutoDirector(f()); assert.equal(templates.length, 9); for (const s of p.resourceSelections.filter(s => s.score)) {
    assert.equal(s.score, Object.values(s.scoreBreakdown).reduce((a, b) => a + b, 0));
    assert(s.alternatives.some(a => !a.accepted));
} const graph = capabilityGraph().filter(n => n.id !== 'primitive:PATH'); assert(planAutoDirector(f(), graph).visualGaps.length); });
test('auto freezing selects compatible exemplar by capability, not fixture id', () => { const x = f('freezing'), a = planAutoDirector(x); x.id = 'unrelated-new-name'; const b = planAutoDirector(x); assert.equal(a.templateSelections[0].template, b.templateSelections[0].template); assert(a.resourceSelections[0].resourceIds.includes('PROP_CAR_001')); assert(a.demonstrations[0].steps.some(s => s.operation === 'ACCUMULATE')); assert.equal(evaluateDirected(a.directedSequences[0], a.directedSequences[0].totalFrames).state.props.subject.parameters.frost, 1); });
test('auto impossible crowd never becomes presenter/radio/direct proof', () => { const p = planAutoDirector(f('impossible-researchers')); assert(p.visualGaps.some(g => g.reason === 'MISSING_SUBJECT')); assert.equal(p.directedSequences.length, 0); assert(p.visualProofPlan.every(x => x.plannedProof === 'NONE')); assert.equal(p.resourceSelections.length, 0); assert.equal(p.visualArc[0].mode, 'VISUAL_GAP'); });
test('auto strict gaps require exact explicit allowance; unknown allowances fail', () => { const x = f('impossible-researchers'); x.constraints.mode = 'STRICT'; assert.throws(() => planAutoDirector(x), /AUTO_STRICT_GAP/); x.constraints.allowedGapIds = ['gap_N1']; assert.equal(planAutoDirector(x).visualGaps.length, 1); x.constraints.allowedGapIds = ['anything']; assert.throws(() => planAutoDirector(x)); });
test('auto budget gaps are explicit rather than presenter substitutions', () => { const x = f(); x.constraints.maxSubjects = 1; const p = planAutoDirector(x); assert(p.visualGaps.some(g => g.reason === 'BUDGET_LIMIT')); assert.equal(p.directedSequences.length, 0); });
test('auto duration measured input changes frame budgets, never provider/rate or script', () => { const x = f(), u = segmentScript(x); x.measuredDurations = u.map(u => ({ unitId: u.id, durationSeconds: 2 })); const p = planAutoDirector(x); assert(p.narrativeUnits.every(u => u.timingConfidence === 'MEASURED')); assert.equal(p.input.script, x.script); assert.equal(p.directedSequences[0].totalFrames, 300); });
test('auto compiler preserves source text, validates contracts and rejects plan tampering', () => { const p = planAutoDirector(f()), c = compileAutoDirector(p); assert.equal(c.editorialPlan.source.text, p.input.script); assert.equal(c.directedSequences.length, 1); assert(c.renderPlan.renderable); p.visualProofPlan[0].plannedProof = 'DIRECT'; assert.throws(() => compileAutoDirector(p), /AUTO_FINGERPRINT/); });
test('auto deterministic results and fingerprints do not use clocks or file locations', () => { const a = planAutoDirector(f()), b = planAutoDirector(f()); assert.deepEqual(a, b); assert.equal(compileAutoDirector(a).fingerprint, compileAutoDirector(b).fingerprint); assert(!JSON.stringify(a).includes('C:\\Users')); assert.equal(resources.length, 50); });
test('auto per-claim proof rejects missing ascent, fill, storage and focus independently', () => {
    const p = planAutoDirector(f());
    for (const [id, mutate] of [
        ['C2', (s: any) => s.demonstration.subjects.find((x: any) => x.kind === 'PATH').path.forEach((v: number[]) => v[1] = 0)],
        ['C3', (s: any) => s.demonstration.steps = s.demonstration.steps.filter((x: any) => x.operation !== 'INCREASE')],
        ['C4', (s: any) => s.demonstration.steps = s.demonstration.steps.filter((x: any) => x.operation !== 'INCREASE')],
        ['C1', (s: any) => s.focusSegments = []],
    ] as const) {
        const s = structuredClone(p.directedSequences[0]);
        mutate(s);
        const checks = proofChecks(p.claims.find(c => c.id === id)!, p.templateSelections.find(c => c.claimId === id), s, p.narrativeUnits);
        assert(Object.values(checks).some(v => !v), id);
    }
});
test('auto heuristic numbers, comparisons and unsupported relations remain explicit', () => {
    for (const [script, type] of [['O valor é 42.', 'NUMBER'], ['10 versus 20.', 'COMPARISON'], ['A cidade fica situada ao norte.', 'LOCATION'], ['O processo muda porque recebe energia.', 'CAUSE_EFFECT']] as const) {
        const x = f();
        x.script = script;
        delete x.claims;
        const p = planAutoDirector(x);
        assert.equal(p.claims[0].type, type);
        if (['LOCATION', 'CAUSE_EFFECT'].includes(type))
            assert(p.visualGaps.length > 0);
    }
});
test('auto optional input fields reject malformed values', () => {
    for (const mutate of [(x: any) => x.constraints.allowedGapIds = 'gap_N1', (x: any) => x.measuredDurations = {}, (x: any) => x.castPreference = 'Caio', (x: any) => x.targetDuration = -1, (x: any) => x.constraints.maxSubjects = 1.5]) {
        const x = f();
        mutate(x);
        assert.throws(() => planAutoDirector(x));
    }
});
