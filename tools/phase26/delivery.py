import gc, hashlib, json, pathlib, subprocess
root = pathlib.Path('out/engine3d/phase26')
read = lambda p: json.loads(pathlib.Path(p).read_text(encoding='utf-8-sig'))
stats = []
for identity in 'ABCDEFGH':
    pack = read(root/'evidence'/f'final-{identity}.json')
    mechanism = lambda fact: 'MECHANISM_V2' in fact['qualifiers']
    stats.append(dict(id=identity, sources=len(pack['sources']), acceptedSources=sum(s['accepted'] for s in pack['sourceAssessments']),
        evidenceExtracted=len(pack['evidence']), factCandidatesExtracted=len(pack['factCandidates']),
        mechanismCandidatesExtracted=sum(mechanism(f['canonicalFact']) for f in pack['factCandidates']),
        mechanismFactsAdmitted=sum(f['usableForPrimaryClaim'] and mechanism(f['canonicalFact']) for f in pack['groundedFacts'])))
    del pack
    gc.collect()
(root/'analysis/extraction.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
git = lambda *args: subprocess.check_output(['git',*args],text=True,encoding='utf-8').strip()
changed = git('diff','--name-only').splitlines()
untracked = git('ls-files','--others','--exclude-standard').splitlines()
paths = changed+untracked
forbidden = [p for p in paths if p.endswith('.env') or any(part in p.lower() for part in ['node_modules/','__pycache__/','.credentials','scratchpad'])]
security_touched = [p for p in changed if p in ['src/research/web/http.ts','src/research/web/security.ts','src/research/web/fetcher.ts','src/research/web/robots.ts','src/research/web/cache.ts','package-lock.json','.gitignore']]
replay = read(root/'replay/final.json')
result = dict(head=git('rev-parse','HEAD'),branch=git('branch','--show-current'),workingTree='DIRTY' if git('status','--short') else 'CLEAN',
    stagedFiles=git('diff','--cached','--name-only').splitlines(),changedTracked=changed,untracked=untracked,
    forbiddenPaths=forbidden,securityBoundaryFilesTouched=security_touched,files=[dict(path=p,bytes=pathlib.Path(p).stat().st_size,sha256=hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()) for p in paths],
    benchmarkExtraction=stats,historicalIntegrityPassed=replay['passed'],
    reportSections=sum(line.startswith('## ') for line in pathlib.Path('PHASE26_REPORT.md').read_text(encoding='utf-8').splitlines()),reviews=len(list((root/'review').glob('*.md'))))
(root/'analysis/delivery.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(dict(head=result['head'],branch=result['branch'],workingTree=result['workingTree'],staged=len(result['stagedFiles']),files=len(paths),forbidden=forbidden,securityTouched=security_touched,reportSections=result['reportSections'],reviews=result['reviews'],extraction=stats),indent=2))
if forbidden or security_touched or not replay['passed']:
    raise SystemExit(1)
