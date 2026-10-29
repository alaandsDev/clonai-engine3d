from pathlib import Path
import subprocess,json,time,sys,shutil,hashlib
sys.stdout.reconfigure(encoding='utf-8')
root=Path('out/engine3d/phase23');rows=[]
pre=json.loads((root/'analysis/prebench-checks.json').read_text(encoding='utf-8'))
assert len(pre)==2 and all(c['exitCode']==0 for c in pre)
assert json.loads((root/'analysis/preflight.json').read_text(encoding='utf-8'))['passed']
archived=set()
if '--archive-prior' in sys.argv:
 parent=root/'development-attempts';index=1
 while(parent/('run-'+str(index))).exists():index+=1
 archive=parent/('run-'+str(index));archive.mkdir(parents=True)
 manifest=[]
 for label in ['real-cold-places-v4','real-population-census-v4']:
  old=root/'logs'/(label+'.json')
  if old.exists():
   shutil.copy2(old,archive/old.name);archived.add(label)
   manifest.append({'session':label,'sha256':hashlib.sha256(old.read_bytes()).hexdigest(),'role':'SUPERSEDED_LIVE_DEVELOPMENT_OBSERVATION','reason':'Shared failure memory corrected after the population benchmark exposed repeated pursuit of the same blocked URL across facts.'})
 for file in ['analysis/live-runs.json','analysis/metrics.json','analysis/final-status.json','logs/live-cold.txt','logs/live-population.txt']:
  old=root/file
  if old.exists():shutil.copy2(old,archive/Path(file).name)
 (archive/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
for kind in ['cold','population']:
 label='real-cold-places-v4' if kind=='cold' else 'real-population-census-v4'
 if(root/'logs'/(label+'.json')).exists() and label not in archived:raise SystemExit('Preserve an existing real session explicitly before rerunning: '+label)
 cmd=['npm.cmd','run','research:web','--',f'examples/research/web-v4-{kind}-request.json',str(root)]
 start=time.perf_counter();done=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 (root/'logs'/f'live-{kind}.txt').write_bytes(done.stdout)
 row={'command':' '.join(cmd),'exitCode':done.returncode,'wallSeconds':round(time.perf_counter()-start,3)};rows.append(row)
 (root/'analysis/live-runs.json').write_text(json.dumps(rows,indent=2),encoding='utf-8');print(json.dumps(row),flush=True)
 print(done.stdout.decode('utf-8',errors='replace')[-2500:],flush=True)
 if done.returncode:raise SystemExit(done.returncode)
