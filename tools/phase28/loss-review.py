"""Finite diagnostic passage audit. These records are never source Evidence."""
import json
from pathlib import Path

root = Path('out/engine3d/phase28')
decisions = {
    'KLT_d0a9616e4341f8bc78f6': 'Useful aquifer/pressure passage; omitted plural actor plus category alternatives. Context passes, no candidate emitted. Subject versus relation substage is not separately observed; no manual coreference/admission.',
    'KLT_177c4949c65bb866854f': 'Explicit negated pumping need and restricted equipment purpose. Negative-safety refusal is observed; it cannot be converted into an unconditional new cause or solution.',
    'KLT_f0de7ab4f83e2d2bc391': 'Comparison and often-qualified purity/mineral content, not a connected physical event. Coupled parser refuses; no ranking/quantitative claims fabricated.',
    'KLT_5116e2124140542d075c': 'Historical/deictic model reference and multiple possible power sources. Contextualization alone does not make this an asserted universal mechanism of the requested system.',
    'KLT_15654e56ea219c1da09b': 'Explicit numerical sizing constraint outside this conservative mechanism grammar. Quantitative guard is observed; no numerical physics rule added.',
    'KLT_1e069322853604214f3b': 'Useful explicit cable/limiter/brake sentence. Context passes but appositional subject and coordinated predicates produce no candidate. Observed loss is coupled subject/relation extraction, not Evidence quorum.',
    'KLT_3bd99124e0cc74ac4a29': 'Useful input/output level contrast with a locative frame, coordinated verbs and parenthetical energy qualifiers. Context passes, no candidate emitted; no guessed shared water identity, destination or temporal edge admitted.',
    'KLT_ff032a4c0ab11766900f': 'Useful qualitative pressure/velocity input-output comparison, with and/or and alternatives. Candidate emission fails; this phase does not turn the comparison into a numerical simulation.',
    'KLT_dcbc241c56e7cd4ed263': 'Useful exit-water/suction-duct passage. Relative subject plus appositive route is outside the bounded parser. No output-water/input-water alias is fabricated.'
}
rows = []
for key in ('well', 'elevator', 'turbine'):
    loss = json.loads((root / key / 'loss-trace.json').read_text('utf-8'))
    for trace in loss['traces']:
        if trace['id'] in decisions:
            rows.append({'benchmark': key, 'traceId': trace['id'], 'sourceId': trace['sourceId'], 'snapshotHash': trace['snapshotHash'], 'span': trace['span'], 'text': trace['text'], 'observedStages': trace['stages'], 'firstLoss': trace['firstLoss'], 'guardReason': trace['reason'], 'review': decisions[trace['id']], 'manualEvidence': False, 'admittedByReview': False})
if {r['traceId'] for r in rows} != set(decisions):
    raise RuntimeError('REVIEWED_PASSAGE_NOT_FOUND')
(root / 'review' / 'knowledge-loss-finite.json').write_text(json.dumps({'reviewedPassages': len(rows), 'populationRecall': 'NOT_MEASURED', 'admissionInput': False, 'rows': rows}, indent=2, ensure_ascii=False), 'utf-8')
print(json.dumps({'reviewedPassages': len(rows), 'manualEvidence': False}))
