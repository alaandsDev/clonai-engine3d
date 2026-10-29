from pathlib import Path
import subprocess,json,re,time,sys
sys.stdout.reconfigure(encoding='utf-8')
root=Path('out/engine3d/phase23');(root/'logs').mkdir(parents=True,exist_ok=True)
pre='--prebench' in sys.argv
names=['typecheck','check:research-v4'] if pre else ['typecheck','check:engine3d','check:editorial','check:sound','check:visual','check:motion','check:demonstration','check:autodirector','check:semantics','check:narrative','check:writer','check:research','check:web-research','check:research-v2','check:research-v3','check:research-v4','engine3d:catalog']
rows=[]
for name in names:
 start=time.perf_counter();done=subprocess.run(['npm.cmd','run',name],stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 log=root/'logs'/(('prebench-' if pre else 'check-')+name.replace(':','-')+'.txt');log.write_bytes(done.stdout)
 text=done.stdout.decode('utf-8',errors='replace');counts={key:int(m.group(1)) for key in ['tests','pass','fail','skipped','cancelled'] if(m:=re.search(r'(?:# |ℹ )'+key+r' (\d+)',text))}
 row={'command':'npm run '+name,'exitCode':done.returncode,'elapsedSeconds':round(time.perf_counter()-start,3),'counts':counts,'log':str(log).replace('\\','/')};rows.append(row)
 (root/'analysis'/('prebench-checks.json' if pre else 'checks.json')).write_text(json.dumps(rows,indent=2),encoding='utf-8');print(json.dumps(row),flush=True)
 if done.returncode:print(text[-6000:],flush=True);raise SystemExit(done.returncode)
