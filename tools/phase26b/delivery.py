import hashlib,json,pathlib,re,subprocess
root=pathlib.Path('out/engine3d/phase26');out=root/'phase26b'
load=lambda p:json.loads(pathlib.Path(p).read_text(encoding='utf-8-sig'))
git=lambda *a:subprocess.check_output(['git',*a],text=True,encoding='utf-8').strip()
changed=git('diff','--name-only').splitlines();untracked=git('ls-files','--others','--exclude-standard').splitlines();paths=changed+untracked
forbidden=[p for p in paths if pathlib.Path(p).name.startswith('.env') or any(x in p.lower() for x in ['node_modules/','__pycache__/','.credentials','scratchpad','/temp/'])]
boundary=[p for p in changed if p in ['src/research/web/http.ts','src/research/web/security.ts','src/research/web/fetcher.ts','src/research/web/robots.ts','src/research/web/cache.ts','package-lock.json','.gitignore']]
secret_findings=[]
pattern=re.compile(r'(?:gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{50,}|sk-(?:proj-)?[A-Za-z0-9_-]{35,})')
for p in paths:
    for i,line in enumerate(pathlib.Path(p).read_text(encoding='utf-8',errors='replace').splitlines(),1):
        if pattern.search(line):secret_findings.append(dict(path=p,line=i,reason='Potential credential; value deliberately omitted'))
manifest=load(root/'phase26b-baseline/manifest.json')
frozen=[dict(path=f,passed=hashlib.sha256((root/'phase26b-baseline/files'/f).read_bytes()).hexdigest()==h) for f,h in manifest['hashes'].items()]
for d in ['benchmarks','knowledge','graphs','stories','writer']:
    for k in 'ABCDEFGH':frozen.append(dict(path=f'{d}/{k}',passed=(root/'phase26b-baseline'/d/f'{k}.json').read_bytes()==(root/d/f'final-{k}.json').read_bytes()))
replay=load(out/'replay/final.json');checks=load(out/'analysis/checks.json');anti=load(out/'analysis/anti-hardcode.json')
registry=dict(engine3d=len(load('out/engine3d/catalog.json')),sfx=len(load('examples/sound/media-registry.json')['assets']),visual=len(load('examples/visual/media-registry.json')['assets']))
diff=subprocess.run(['git','diff','--check'],capture_output=True).returncode==0
staged=git('diff','--cached','--name-only').splitlines();head=git('rev-parse','HEAD');branch=git('branch','--show-current')
passed=not(forbidden or boundary or secret_findings or staged) and diff and all(r['passed'] for r in frozen) and replay['passed'] and all(r['checks'].get('knowledgeLoss') for r in replay['rows'] if r['contextual']) and all(r['exitCode']==0 for r in checks) and len(checks)==21 and anti['passed'] and registry==dict(engine3d=50,sfx=8,visual=5) and head=='19d55834c38d0fdf3dea86c4708cdf0db637dd63' and branch=='main'
result=dict(passed=passed,head=head,branch=branch,workingTree='DIRTY' if git('status','--short') else 'CLEAN',stagedFiles=staged,forbiddenPaths=forbidden,securityBoundaryTouched=boundary,potentialSecrets=secret_findings,diffCheck=diff,frozenBaseline=frozen,registry=registry,files=[dict(path=p,bytes=pathlib.Path(p).stat().st_size,sha256=hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()) for p in paths])
(out/'analysis/delivery.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(dict(passed=passed,head=head,branch=branch,files=len(paths),staged=len(staged),forbidden=forbidden,boundary=boundary,secretFindings=len(secret_findings),registry=registry)))
raise SystemExit(0 if passed else 1)
