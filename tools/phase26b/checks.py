import json,pathlib,re,subprocess,time,os,sys
root=pathlib.Path('out/engine3d/phase26/phase26b')
(root/'logs').mkdir(parents=True,exist_ok=True)
(root/'analysis').mkdir(parents=True,exist_ok=True)
commands=['typecheck','check:engine3d','check:editorial','check:sound','check:visual','check:motion','check:demonstration','check:autodirector','check:semantics','check:narrative','check:writer','check:research','check:web-research','check:research-v2','check:research-v3','check:research-v4','check:topic-intelligence','check:vertical-slice','check:causal-curiosity','check:contextual-mechanism','engine3d:catalog']
rows=[]
for command in commands:
    at=time.monotonic()
    p=subprocess.run(['cmd.exe','/d','/c','npm','run',command],env=dict(os.environ,NODE_OPTIONS='--max-old-space-size=1536'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    output=p.stdout.decode('utf-8',errors='replace');file=root/'logs'/(command.replace(':','-')+'.log');file.write_text(output,encoding='utf-8')
    match=re.search(r'(?:#|ℹ) tests (\d+)',output)
    row=dict(command=command,exitCode=p.returncode,tests=int(match[1]) if match else None,seconds=round(time.monotonic()-at,3),log=str(file).replace('\\','/'));rows.append(row)
    (root/'analysis/checks.json').write_text(json.dumps(rows,indent=2),encoding='utf-8');print(json.dumps(row),flush=True)
    if p.returncode:sys.exit(1)
