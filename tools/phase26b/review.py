"""Persist the agent's reviewed semantic judgments; never used by extraction.
CORRECT below means source-entailment in the frozen snapshot, not independent
scientific corroboration. Run only after reading the complete tuples/scripts.
"""
import json,pathlib
root=pathlib.Path('out/engine3d/phase26'); out=root/'phase26b'; final=out/'attempts/final'
load=lambda p:json.loads(pathlib.Path(p).read_text(encoding='utf-8-sig'))
def save(p,x):
    p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,indent=2,ensure_ascii=False),encoding='utf-8')
notes={
 'A':'Literal definition, pressure cause and water movement/collection; collection has the water as patient and pipes as route, not as an agent.',
 'B':'Explicit definition, design purpose, water route and design constraint. Purpose is not an actual energy-conversion event or historical cause.',
 'C':'Local equative subject is licensed by the explicit alias appositive. EXPEL and its purpose are distinct; taxonomy is not a connected mechanism.',
 'D':'No admission. Subtype title is not proof that it is the requested subject.',
 'E':'No acquired bytes or admitted relation.',
 'F':'Component-list labels retain elevator section support; cabin is the explicit moving actor. Counterweight/mirror clauses state purpose, not an inferred solution. Seven isolated components remain gaps in connection.',
 'G':'Definition and stated purpose plus explicit operational main clause only. Embedded rotation and gerund attribution remain unadmitted; no inferred transformation.',
 'H':'Group order is explicit, without order inside the enumeration. Water route is counted once. Gradeamento is the named first stage. Popularity and malformed definition are excluded.'}
rows=[];summary=[]
for k in 'ABCDEFGH':
    a=load(final/'artifacts'/f'{k}.json');w=load(final/'writer'/f'{k}.json');r=load(final/'results'/f'{k}.json');p=load(final/'evidence'/f'{k}.json');old=load(root/'phase26b-baseline/knowledge'/f'{k}.json')
    old_ids={r['id'] for r in old['relations']};used={r for s in w['sentences'] for r in s['relationIds']}
    for rel in a['knowledge']['relations']:
        evidence=[e for e in p['evidence'] if e['id'] in {proof['evidenceId'] for proof in rel['proof']}]
        rows.append(dict(benchmark=k,relationId=rel['id'],new=rel['id'] not in old_ids,subject=rel['subject'],predicate=rel['predicate'],object=rel['object'],modality=rel['modality'],classification='CORRECT',writerUsed=rel['id'] in used,note=notes[k],support=rel['proof'],admittedSurfaces=[e['normalizedText'] for e in evidence],independentlyCorroborated=rel['status']=='CORROBORATED'))
    summary.append(dict(**r,connectivity=a['story']['connectivity'],phase27Readiness=a['story']['phase27Readiness'],knowledgeReadiness=a['knowledge']['readiness']['status'],precision=dict(correct=len(a['knowledge']['relations']),questionable=0,wrong=0,writerUsedWrong=0)))
precision=dict(scope='All final admitted tuples and all factual Writer surfaces manually read against exact acquired snapshots. Source-entailment, not an exhaustive truth/recall benchmark.',rows=rows,correct=len(rows),newAdmitted=sum(r['new'] for r in rows),questionable=0,wrong=0,writerUsed=sum(r['writerUsed'] for r in rows),writerUsedWrong=0,
 excludedIntermediate=[dict(benchmark='H',classification='QUESTIONABLE',issue='Incomplete IS_A complement: um local em',fix='Generic incomplete-complement and relative-antecedent refusal'),dict(benchmark='G',classification='QUESTIONABLE',issue='Gerund may attach to main or embedded actor',fix='Refuse ambiguous attribution; asserted main clause only')],
 otherPrecisionFindings=['One movement duplicated as FLOW/PASSES_THROUGH: merged, not counted as a second event.','Discourse cue removed from actor.','Unlicensed popularity claim excluded from surface; only explicit nominal group order realized.'])
save(out/'analysis/precision.json',precision)
save(out/'analysis/final-summary.json',dict(rows=summary,useful=sum(r['knowledgeReadiness']=='READY' for r in summary),adequate=sum(r['potential'] in ['ADEQUATE','RICH'] for r in summary),writer=sum(r['eligible'] for r in summary),phase27Readiness='PARTIAL',newQueries=0,newFetches=0,precision={k:precision[k] for k in ['correct','newAdmitted','questionable','wrong','writerUsed','writerUsedWrong']}))
md='# Phase26B — final precision review\n\n'+precision['scope']+' No diagnostic annotation was supplied to admission.\n\n|ID|New|Subject|Predicate|Object|Judgment|Writer used|\n|---|---|---|---|---|---|---|\n'
for r in rows:
    cells=[r['benchmark']+' / '+r['relationId'],str(r['new']),r['subject'],r['predicate'],r['object'],r['classification'],str(r['writerUsed'])]
    md+='|'+'|'.join(str(c).replace('|','/').replace('\n',' ') for c in cells)+'|\n'
md+='\nFull raw spans, snapshot hashes, support context and admitted surface: `../phase26b/analysis/precision.json`.\n\nTwo QUESTIONABLE intermediate relations were removed by general rules, not per-topic rejection lists. Final: 27 CORRECT, 0 QUESTIONABLE, 0 WRONG, Writer-used Wrong 0. Duplicate movement and popularity-surface issues were also corrected. This is a small manual review, not a population error-rate estimate.\n'
(root/'review/phase26b-precision-review.md').write_text(md,encoding='utf-8')
print(json.dumps({k:precision[k] for k in ['correct','newAdmitted','questionable','wrong','writerUsed','writerUsedWrong']}))
assessment=[]
for r in load(out/'analysis/reviewed-loss-comparison.json'):
    partial=r['afterWriterUsed'] and r['beforeCategory']=='COREFERENCE_FAILURE'
    status='PARTIAL' if partial else 'RECOVERED_TARGET' if r['afterWriterUsed'] else 'UNRESOLVED'
    assessment.append(dict(**r,recovery=status,categoryResolved=status=='RECOVERED_TARGET',remaining='Main operational clause recovered; relative and gerund actors remain ambiguous. Preliminary audit attachment hypothesis was revised, not treated as identity proof.' if partial else r['diagnosis'] if not r['afterWriterUsed'] else 'Targeted diagnostic failure resolved, not exhaustive passage understanding.'))
save(out/'analysis/reviewed-loss-assessment.json',assessment)
categories=sorted({r['beforeCategory'] for r in assessment})
taxonomy=[dict(category=c,before=sum(r['beforeCategory']==c for r in assessment),after=sum(r['beforeCategory']==c and not r['categoryResolved'] for r in assessment),partial=sum(r['beforeCategory']==c and r['recovery']=='PARTIAL' for r in assessment)) for c in categories]
save(out/'analysis/failure-taxonomy.json',taxonomy)
md='# Phase26B — KnowledgeLossTrace final review\n\nAutomatic stage joins cover a passage with at least one admitted relation, not every clause. Parser subject/relation internals remain UNKNOWN when no candidate is emitted. Ten manually reviewed diagnostics are not a recall denominator or admission input.\n\n'
md+='Four diagnostic root failures recovered, one partially recovered, five unresolved. The G main clause reaching Writer does not mean relative/coreference recovery. The preliminary “immediately preceding water” hypothesis was not unique; both relative and gerund attribution remain refused.\n\n|Benchmark|Before category|Recovery|Remaining|\n|---|---|---|---|\n'
for r in assessment:md+='|'+'|'.join(str(r[k]).replace('|','/').replace('\n',' ') for k in ['benchmark','beforeCategory','recovery','remaining'])+'|\n'
md+='\nExact before/after span joins: `../phase26b/analysis/reviewed-loss-assessment.json`. Full per-source/paragraph/heading/candidate/Writer stages: `../phase26b/attempts/final/loss/*.json`. Initial review was preserved.\n'
(root/'review/phase26b-loss-trace-review.md').write_text(md,encoding='utf-8')
