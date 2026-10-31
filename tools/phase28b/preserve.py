import hashlib, json, shutil, subprocess
from pathlib import Path
root=Path('out/engine3d/phase28b'); target=root/'preservation'
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for chunk in iter(lambda:f.read(1048576),b''):h.update(chunk)
 return h.hexdigest()
def git(*args):return subprocess.check_output(['git',*args],text=True,encoding='utf-8').strip()
assert git('rev-parse','HEAD')=='3290fb2756013d0dfc9d69f6dbff701634bba31d'
assert git('branch','--show-current')=='main'
if (target/'manifest.json').exists():raise RuntimeError('PRESERVATION_ALREADY_FROZEN')
paths=set(git('diff','--name-only').splitlines())|set(git('ls-files','--others','--exclude-standard').splitlines())
for file in sorted(paths):
 if file.startswith('tools/phase28b/'):continue
 p=Path(file); q=target/'dirty-tree'/p;q.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,q)
historical=[Path(p) for p in ['AGENTS.md','CLONAI_HANDOFF.md','PHASE25_REPORT.md','PHASE26_REPORT.md','PHASE27_REPORT.md','PHASE27B_REPORT.md','PHASE28_REPORT.md','package-lock.json']]
historical += [p for p in Path('out/engine3d/phase28').rglob('*') if p.is_file()]
manifest={'head':git('rev-parse','HEAD'),'branch':'main','initialState':'DIRTY — Phase28 UNCOMMITTED','status':git('status','--short'),'hashes':{p.as_posix():sha(p) for p in historical},'dirtyFiles':sorted(paths-{'tools/phase28b/preserve.py'})}
target.mkdir(parents=True,exist_ok=True);(target/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False),'utf-8')
print(json.dumps({'historicalFiles':len(historical),'dirtyFilesSaved':len(paths)-1,'head':manifest['head']}))
