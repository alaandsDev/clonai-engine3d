"""Run both portable requests serially; retain the pre-final-statistic-guard observations."""
from pathlib import Path
import json, shutil, subprocess, time, sys
root=Path('out/engine3d/phase22')
archive=root/'attempts'/'before-averaged-extreme-guard'
archive.mkdir(parents=True,exist_ok=True)
labels=['real-cold-places-v3','real-population-census-v3']
manifest=[]
for label in labels:
    original=root/'logs'/(label+'.json')
    saved=archive/(label+'.json')
    if original.exists() and not saved.exists():shutil.copy2(original,saved)
    if saved.exists():
        data=json.loads(saved.read_text(encoding='utf-8'))
        manifest.append({'session':label,'processingFingerprint':data['processingFingerprint'],'quality':data['quality'],'role':'SUPERSEDED_LIVE_OBSERVATION_NOT_FINAL_BENCHMARK','reason':'Final safety guard rejects averages of record extrema; initial Cold replay correctly rejected changed processing.'})
(archive/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
results=[]
prior=root/'analysis'/'live-runs.json'
if prior.exists():
    attempts=root/'attempts'
    attempt_index=1
    while (attempts/f'run-{attempt_index}').exists():attempt_index+=1
    run_archive=attempts/f'run-{attempt_index}'
    run_archive.mkdir()
    shutil.copy2(prior,run_archive/'live-runs.json')
    for name in ['cold','population']:
        log=root/'logs'/f'final-live-{name}.txt'
        if log.exists():shutil.copy2(log,run_archive/log.name)
for name in ['cold','population']:
    cmd=['npm.cmd','run','research:web','--',f'examples/research/web-v3-{name}-request.json',str(root)]
    start=time.perf_counter()
    done=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,encoding='utf-8',errors='replace')
    (root/'logs'/f'final-live-{name}.txt').write_text(done.stdout,encoding='utf-8')
    row={'command':' '.join(cmd),'exitCode':done.returncode,'wallSeconds':round(time.perf_counter()-start,3)}
    results.append(row)
    (root/'analysis'/'live-runs.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    print(json.dumps(row),flush=True)
    print(done.stdout[-2600:],flush=True)
    if done.returncode:sys.exit(done.returncode)
