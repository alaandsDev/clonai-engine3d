"""Persist the finite source-by-source review performed before Writer rebuild.
Verdicts are audit data; they never participate in runtime admission."""
import json,hashlib
from pathlib import Path
root=Path('out/engine3d/phase28b')
def load(p):return json.loads(p.read_text('utf-8-sig'))
review={
'KR_306eb11216d88841e019':'Explicit cabo→freio, aciona mecanicamente; attached-to-car modifier and the preceding overspeed context retained. No always, governor→brake or problem/solution claim added.',
'KR_bb7677043194508219b7':'Explicit cabo→limitador, movimenta; same bounded subject shared by the coordinated predicates. No inferred sequence between the two objects.',
'KR_19bb3974c98fbc2416ab':'The explicitly qualified water leaving the turbine is conducted through the duct called tubo de sucção. Local path, not an independent actor or global alias.',
'KR_27bd53f8944b24d7a3ec':'Explicit local entry source; reservatório OU canal de nível mais elevado remains disjunctive, with the source energy qualifier retained.',
'KR_6451e4087d23318f9a3f':'Explicit local discharge destination canal de nível mais baixo; outlet energy qualifier retained. No inferred causal pressure edge.',
'KR_e63a67c8549d43b12ae3':'Incoming water explicitly passes through a closed duct; path distinguished from destination.',
'KR_b7439b1439337e0fb1ba':'Complete destination retains the alternatives curved blades/nozzles/injectors and their relative clause. Does not claim that water moves to the rotor or that alternatives all coexist.',
'KR_2ae8f38e1f8aa3cc9949':'Restrictive relative explicitly identifies water that leaves the turbine; EXIT uses that entire qualified actor. No cross-sentence water alias.',
'KR_a641ec202ea0e5ebe334':'Explicit final destination reservatório OU canal inferior; same sentence-qualified actor and explicit route direction. No inferred downstream process.'}
rows=[]
for b in ['well','elevator','turbine']:
 p=load(root/'attempts/04'/b/'pack.json')
 for r in load(root/'attempts/04'/b/'new-relations.json'):
  assert r['id'] in review,'Unreviewed relation; stop before Writer'
  proofs=[]
  for pr in r['proof']:
   src=next(s for s in p['sources'] if s['id']==pr['sourceId'])
   assert hashlib.sha256(src['content'].encode()).hexdigest()==pr['snapshotHash']
   for sp in [pr['span'],*pr['contextSpans']]:
    # Engine offsets are UTF16, including non-BMP source HTML.
    assert src['content'].encode('utf-16-le')[sp['start']*2:sp['end']*2].decode('utf-16-le')==sp['text']
   proofs.append({'sourceId':pr['sourceId'],'snapshotHash':pr['snapshotHash'],'locator':pr['sourceLocator'],'span':pr['span'],'contextSpans':pr['contextSpans'],'parse':pr.get('resolution',{}).get('parse')})
  rows.append({'benchmark':b,'relationId':r['id'],'subject':r['subject'],'predicate':r['predicate'],'object':r['object'],'modality':r['modality'],'verdict':'CORRECT','reason':review[r['id']],'proof':proofs})
assert len(rows)==len(review)==9
(root/'review').mkdir(exist_ok=True)
(root/'review/new-relations.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),'utf-8')
print(json.dumps({'reviewed':len(rows),'correct':len(rows),'questionable':0,'wrong':0,'scope':'FINITE_NEW_ADMITTED_RELATIONS_ONLY; not global recall or precision'}))
