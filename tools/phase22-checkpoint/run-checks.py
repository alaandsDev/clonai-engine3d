from pathlib import Path
import subprocess,json,re,time,os,sys
root=Path('out/engine3d/phase22');(root/'logs').mkdir(parents=True,exist_ok=True)
pre='--prebench' in sys.argv
commands=([['npm.cmd','run','check:research-v3'],['npm.cmd','run','typecheck'],['npx.cmd','tsx','--test','tests/research.test.ts','tests/web-research.test.ts','tests/research-v2.test.ts'],['npx.cmd','tsx','tools/phase22-checkpoint/preflight.ts']] if pre else [['npm.cmd','run',name] for name in ['typecheck','check:engine3d','check:editorial','check:sound','check:visual','check:motion','check:demonstration','check:autodirector','check:semantics','check:narrative','check:writer','check:research','check:web-research','check:research-v2','check:research-v3','engine3d:catalog']])
rows=[]
for i,cmd in enumerate(commands):
 start=time.perf_counter();done=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,env={**os.environ,'NO_COLOR':'1'},encoding='utf-8',errors='replace')
 label=(cmd[-1] if cmd[0]=='npm.cmd' else 'legacy-research-tests' if '--test' in cmd else 'preflight').replace(':','-').replace('/','-')
 log=root/'logs'/(('prebench-' if pre else 'check-')+label+'.txt');log.write_text(done.stdout,encoding='utf-8')
 counts={k:int(m.group(1)) for k in ['tests','pass','fail','skipped','cancelled'] if(m:=re.search(r'(?:# |ℹ )'+k+r' (\d+)',done.stdout))}
 row={'command':' '.join(cmd).replace('npm.cmd','npm').replace('npx.cmd','npx'),'exitCode':done.returncode,'elapsedSeconds':round(time.perf_counter()-start,3),'counts':counts,'log':str(log).replace('\\','/')};rows.append(row)
 (root/'analysis'/('prebench-checks.json' if pre else 'checks.json')).write_text(json.dumps(rows,indent=2),encoding='utf-8');print(json.dumps(row),flush=True)
 if done.returncode:print(done.stdout[-8000:],flush=True);raise SystemExit(1)
