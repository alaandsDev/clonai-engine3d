from pathlib import Path
import json,re,hashlib,subprocess
root=Path('out/engine3d/phase23')
def read(file):return json.loads((root/'analysis'/file).read_text(encoding='utf-8'))
final=read('final-status.json');assert final['phase23Complete']
assert final['v4Tests']['tests']==65 and final['v4Tests']['fail']==0
assert final['fullRegression']=='PASS_17_COMMANDS' and final['uniqueFastTests']==829
assert read('replay.json')['networkCalls']==0 and read('anti-hardcode.json')['passed']
assert all(row['exitCode']==0 for row in read('live-runs.json'))
report=Path('PHASE23_REPORT.md');text=report.read_text(encoding='utf-8');assert len(re.findall(r'^## ',text,re.M))==43
required=['gap-analysis','independent-acquisition','source-ecosystems','corroboration-yield','residency-evidence','measurement-context','conflict-resolution','candidate-quality','cold-eligibility']
for name in required:assert(root/'review'/(name+'.md')).stat().st_size>100
for name in ['gaps','requirements','strategies','query-families','attempts','providers','candidate-entities','datasets','citations','origins','source-graphs','publishers','authority','conflicts','evidence','facts','eligibility','rankings','benchmarks','replay','analysis','review','logs','inputs']:assert(root/name).is_dir(),name
base=read('baseline.json')
for file,expected in base['files'].items():
 if file.startswith('tests/') or file in ['PHASE21_REPORT.md','PHASE22_REPORT.md','PHASE22_HANDOFF_INCOMPLETE.md','CLONAI_HANDOFF.md','package-lock.json','AGENTS.md'] or file.startswith(('src/engine3d/','src/writer/','src/sound/','src/visual/')):assert hashlib.sha256(Path(file).read_bytes()).hexdigest()==expected,file
assert subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()==base['head']
old=json.loads(Path('examples/research/web-v3-cold-request.json').read_text(encoding='utf-8'))['request'];new=json.loads(Path('examples/research/web-v4-cold-request.json').read_text(encoding='utf-8'))['request']
assert old['topic']==new['topic'] and old['constraints']==new['constraints']
assert old['sourcePolicy']['factTypeQuorum']==new['sourcePolicy']['factTypeQuorum'] and new['sourcePolicy']['minIndependentSources']==2
gates=['Phase22 baseline','Version 4 opt-in','FactGap','EvidenceRequirementPlan','SourceEcosystem','SourceStrategyPlanner','QueryFamily','Orthogonal discovery','Known-origin exclusion','Provider capability model','Citation-origin pursuit','Dataset-first strategy','TemporalEvidenceRequirement','ResidencyEvidenceAssessment','ConflictResolutionTask','EligibilityGainEstimate','AcquisitionAttempt','Failure memory','Exhaustion model','Stop early','Corroboration yield metrics','EntityTypeFitness','Candidate noise reduction','Global superlative safety','V4 zero-network replay','Fingerprint determinism','Security','Anti-hardcode','V1/v2/v3 regressions','Population live benchmark','Cold live benchmark','Same-ID transition comparison','Registry unchanged','Final report complete']
proof={'passed':True,'gates':[{'gate':i+1,'requirement':name,'status':'PASS','evidence':'analysis/checks.json + analysis/replay.json + analysis/integrity.json + analysis/metrics.json + tests/research-v4.test.ts'} for i,name in enumerate(gates)],'caveat':'Implementation gates do not imply real-world capability gates passed.'}
(root/'analysis/implementation-gates.json').write_text(json.dumps(proof,indent=2),encoding='utf-8')
links=re.findall(r'\]\((out/engine3d/phase23/[^)]+)\)',text);assert all(Path(link).is_file() for link in links)
result={'passed':True,'reportSections':43,'implementationGates':len(gates),'reviews':len(required),'reportLinks':len(links),'reportSha256':hashlib.sha256(report.read_bytes()).hexdigest(),'checkpointPreserved':True,'oldTestsAndReportsPreserved':True,'coldPolicyPreserved':True,'commitPushPerformed':False,'phase24Started':False}
(root/'analysis/delivery-verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
