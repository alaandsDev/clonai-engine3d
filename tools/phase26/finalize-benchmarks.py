import os, pathlib, subprocess, sys
root = pathlib.Path('out/engine3d/phase26')
env = dict(os.environ, NODE_OPTIONS='--max-old-space-size=2048')
# One process at a time bounds retained snapshot/normalization memory. No new
# acquisition: final = reprocess verified existing snapshots with frozen code.
for identity in (sys.argv[1] if len(sys.argv)>1 else 'CDEFGH'):
    p = subprocess.run(['cmd.exe','/d','/c','npx','tsx','tools/phase26/run.ts','final',identity], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    (root/'logs'/('final-process-'+identity+'.log')).write_bytes(p.stdout)
    print(identity+' exit='+str(p.returncode), flush=True)
    if p.returncode:
        raise SystemExit(p.returncode)
for identity in 'AB':
    p = subprocess.run(['cmd.exe','/d','/c','npx','tsx','tools/phase26/run.ts','recorded',identity], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    (root/'logs'/('recorded-process-'+identity+'.log')).write_bytes(p.stdout)
    print('recorded-'+identity+' exit='+str(p.returncode), flush=True)
    if p.returncode:
        raise SystemExit(p.returncode)
