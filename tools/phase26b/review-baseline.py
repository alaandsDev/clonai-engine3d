import json, pathlib, hashlib
root=pathlib.Path('out/engine3d/phase26')
load=lambda p:json.loads(pathlib.Path(p).read_text(encoding='utf-8'))
# Human diagnostic review selectors only. No runtime/extraction stage reads
# these annotations, and no expected fact is inserted into an EvidencePack.
review=[
 ('A','Geralmente são abertos','SUBJECT_RESOLVED','COREFERENCE_FAILURE','Omitted plural subject; the surrounding prose is needed. The later negated sentence must remain negated.','Bounded paragraph context; otherwise refuse'),
 ('B','O rotor é suportado','RELATION_PARSED','PASSIVE_VOICE_MISS','Explicit passive support relation is outside the grammar; B already remains positive.','Generic support/passive grammar only if independently tested'),
 ('C','Um motor a reação (AO','CANDIDATE_EXTRACTED','SENTENCE_FRAGMENTATION','AO orthography years are being treated as factual quantities; the relative clause also needs its explicit antecedent.','Mask citation/orthography metadata with offsets, then resolve local relative clause'),
 ('D','Uma bomba centrífuga trabalha','CONTEXTUALIZED','SUBJECT_IDENTITY_FAILURE','A subtype/application source is not an identity proof for the requested topic. Do not rename it to the requested subject.','Search normalized prepositions or preserve explicitly sourced subtype scope'),
 ('F','Contrapeso — Componente','CONTEXTUALIZED','SECTION_CONTEXT_LOST','The exact main document has a component-list section outside the tiny heading allowlist. Inside it an explicit named subject has a function.','Structural component frame; bounded named clause, not guessed o qual'),
 ('F','Caixa ou caixa de corrida —','CONTEXTUALIZED','SECTION_CONTEXT_LOST','Definition-list style item explicitly locates cabin motion inside the named part.','Reuse list/paragraph label structure with supporting spans'),
 ('G','As usinas hidroelétricas funcionam','SUBJECT_RESOLVED','COREFERENCE_FAILURE','Finite main clause is taken as one malformed subject; the relative subject is explicitly the immediately preceding água.','Bounded relative-clause extraction; retain enclosing support'),
 ('G','Depois de passar pela turbina','SUBJECT_RESOLVED','AMBIGUITY_REFUSAL','The fronted clause has an omitted subject and no comma. Do not guess which entity passes through.','Keep as refused unless a safe context resolver proves the antecedent'),
 ('H','Em seguida a água passa','CONTEXTUALIZED','DOCUMENT_CONTEXT_LOST','Facility/process wrapper in title is not recognized; prose already explicitly describes the requested process. Citation suffix also blocks the numeric guard.','Generic facility-for-process scope plus citation-aware segmentation'),
]
rows=[]
for key,prefix,stage,category,why,fix in review:
    traces=load(root/'phase26b/loss-baseline'/f'{key}.json')['traces']
    hit=next(t for t in traces if t['text'].startswith(prefix))
    rows.append(dict(benchmark=key,traceId=hit['id'],sourceId=hit['sourceId'],span=hit['span'],snapshotHash=hit['snapshotHash'],firstObservedLoss=stage,category=category,why=why,potentialFix=fix,manualEvidence=False,precisionExpectation='Diagnostic mechanism passage, not admission'))
rows.append(dict(benchmark='E',traceId=None,firstObservedLoss='DISCOVERED',category='DISCOVERY_MISS',why='All eight queries returned provider HTTP 429; zero sources. This is not an extraction/admission failure.',potentialFix='One bounded fresh recovery run after backoff; stop again on 429',manualEvidence=False))
target=root/'phase26b-baseline/reviewed-loss-trace.json'
if target.exists():raise SystemExit('Reviewed baseline already frozen; do not overwrite')
target.write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
summary=load(root/'phase26b/analysis/baseline-summary.json')
md='# Phase26B — reviewed failure analysis BEFORE behaviour changes\n\nPhase26 baseline: 2/8 useful, 2/8 adequate, 2/8 eligible. Frozen report, runtime hashes and eight results: `phase26b-baseline/`.\n\nKnowledgeLossTrace is sentence-level, preserves paragraph/document/heading and exact raw snapshot spans. The combined Phase26 parser cannot distinguish candidate/subject/relation failure automatically; reviewed rows below identify the specific observed guard. Broad candidate counts are NOT measured recall; navigation, historical anecdotes and unrelated documents remain negative examples. Nothing in this review is fed to Research as Evidence.\n\n'
md+='|Benchmark|Fetches|Contributing|Potential windows (unreviewed)|Extracted|Admitted|First loss|Category|Example span|Why lost / fix|\n|---|---|---|---|---|---|---|---|---|---|\n'
for r in rows:
    b=next(s for s in summary if s['id']==r['benchmark']);span=r.get('span');example=(r.get('sourceId','')+':'+str(span['start'])+'–'+str(span['end'])+' '+span['text'][:180]) if span else 'No acquired bytes'
    cells=[r['benchmark'],b['fetches'],b['contributing'],b['potentialPassages'],b['extractedRelations'],b['admitted'],r['firstObservedLoss'],r['category'],example,r['why']+' '+r['potentialFix']]
    md+='|'+'|'.join(str(x).replace('|','/').replace('\n',' ') for x in cells)+'|\n'
md+='\n## Reviewed passage provenance\n\n'
for r in rows:
    if r.get('span'):md+='### '+r['benchmark']+' / '+r['traceId']+'\n\nSnapshot SHA-256 `'+r['snapshotHash']+'`, raw offsets '+str(r['span']['start'])+'–'+str(r['span']['end'])+'.\n\n> '+r['span']['text'].replace('\n',' ')+'\n\n'+r['why']+'\n\n'
md+='## Decision before implementation\n\n1. Parsing class first: citation and orthography annotations, preserving all source offsets and rejecting real numeric assertions.\n2. Re-run affected snapshots before any contextual change.\n3. Then generic document/component context, followed by bounded relative/function clauses only where observed.\n4. E is a provider failure. D remains an identity/search issue; admitting a generic subtype as the requested system is forbidden.\n5. Admission is not the dominant loss stage in the reviewed set. No quorum or readiness relaxation is justified.\n'
(root/'review/phase26b-failure-analysis.md').write_text(md,encoding='utf-8')
print('Reviewed KnowledgeLossTrace frozen:',len(rows),'windows / discovery records')
