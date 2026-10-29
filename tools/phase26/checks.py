import json, pathlib, re, subprocess, time, sys, os
root = pathlib.Path('out/engine3d/phase26')
(root/'logs').mkdir(parents=True, exist_ok=True)
(root/'analysis').mkdir(parents=True, exist_ok=True)
commands = ['typecheck','check:engine3d','check:editorial','check:sound','check:visual','check:motion','check:demonstration','check:autodirector','check:semantics','check:narrative','check:writer','check:research','check:web-research','check:research-v2','check:research-v3','check:research-v4','check:topic-intelligence','check:vertical-slice','check:causal-curiosity','engine3d:catalog']
resume = '--resume' in sys.argv
prior = json.loads((root/'analysis'/'checks.json').read_text(encoding='utf-8')) if resume else []
if prior:
    (root/'analysis'/'checks-before-final-validation.json').write_text(json.dumps(prior, indent=2), encoding='utf-8')
forced = {'typecheck','check:engine3d','check:topic-intelligence','check:vertical-slice','check:causal-curiosity'}
rows = list(prior)
for command in commands:
    previous = next((row for row in prior if row['command'] == command), None)
    if previous and previous['exitCode'] == 0 and command not in forced:
        continue
    start = time.monotonic()
    p = subprocess.run(['cmd.exe','/d','/c','npm','run',command], env=dict(os.environ, NODE_OPTIONS='--max-old-space-size=1536'), stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    output = p.stdout.decode('utf-8', errors='replace')
    file = root/'logs'/('check-'+command.replace(':','-')+'.log')
    file.write_text(output, encoding='utf-8')
    count = re.search(r'(?:#|ℹ) tests (\d+)', output)
    row = dict(command=command, exitCode=p.returncode, tests=int(count[1]) if count else None, seconds=round(time.monotonic()-start,3),log=str(file).replace('\\','/'))
    rows = [old for old in rows if old['command'] != command] + [row]
    (root/'analysis'/'checks.json').write_text(json.dumps(rows, indent=2), encoding='utf-8')
    print(json.dumps(row), flush=True)
raise SystemExit(1 if any(row['exitCode'] for row in rows) else 0)
