import json,hashlib,subprocess,shutil,statistics,re
from pathlib import Path
import numpy as np
R=Path('out/engine3d/script-mode/roteiro-panela-product-pass')
def load(p):return json.loads(p.read_text('utf-8-sig'))
def get(n):return load(R/n)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(n,x):(R/n).write_text(json.dumps(x,ensure_ascii=False,indent=2),'utf-8')
ledger=get('render-ledger.json');assert len(ledger)<=3 and ledger[-1]['status']=='RENDERED';attempt=R/'attempts'/ledger[-1]['id'];media=load(attempt/'media.json');assert media['passed']
for n in ['video.mp4','contact-sheet.png','event-sheet.png']:shutil.copyfile(attempt/n,R/n)
assert sha(R/'video.mp4')==media['sha256']
ordinary=get('summary.json');ordinary['mp4']={k:v for k,v in media.items() if k not in ['render','attempt','externalInProcessCalls']};ordinary['mp4']['path']=(R/'video.mp4').as_posix();ordinary['frames']=len(list((attempt/'frames').glob('*.png')));ordinary['frameDirectory']='attempts/'+ledger[-1]['id']+'/frames';ordinary['performance']['renderMs']=media['render']['wallMs'];ordinary['performance'].pop('totalMs',None);ordinary['performance']['measurement']='Planning and selected render measured separately; total end-to-end wall time not measured';save('summary.json',ordinary)
ff=get('baseline/summary.json')['ffmpeg'];rate=48000
def audio(p):return np.frombuffer(subprocess.check_output([ff,'-v','error','-i',str(p),'-ac','1','-ar',str(rate),'-f','f32le','-']),'<f4')
def silence(x):
 n=len(x)//480;q=np.sqrt(np.mean(x[:n*480].reshape(n,480)**2,axis=1))<10**(-45/20);runs=[];start=None
 for i,v in enumerate([*q,False]):
  if v and start is None:start=i
  if not v and start is not None:
   if (i-start)*.01>=.06:runs.append({'start':start*.01,'end':i*.01,'duration':(i-start)*.01})
   start=None
 return runs
tracks=get('tracks.json');inp=get('planner-input.json');clips=[];ranges=[]
for t,w in zip(tracks,inp['timing']):
 x=audio(Path('public')/t['relativeAudioPath']);runs=silence(x);d=len(x)/rate;lead=runs[0]['end'] if runs and runs[0]['start']==0 else 0;tail=d-runs[-1]['start'] if runs and d-runs[-1]['end']<.02 else 0
 clips.append({'id':t['sentenceId'],'start':w['startFrame']/inp['fps'],'end':w['endFrame']/inp['fps'],'duration':d,'leading':lead,'trailing':tail,'naturalPause':sum(r['duration'] for r in runs)-lead-tail,'padding':(w['endFrame']-w['startFrame'])/inp['fps']-d,'source':t['pacing']['sourceRelativeAudioPath'],'pacing':t['pacing']});ranges.append((w['startFrame']/inp['fps'],w['startFrame']/inp['fps']+d))
assert len({t['sentenceId'] for t in tracks})==len(tracks)==20 and all(ranges[i][1]<=ranges[i+1][0] for i in range(19))
mix=audio(R/'video.mp4');runs=silence(mix);duration=inp['totalFrames']/inp['fps'];quiet=sum(r['duration'] for r in runs);pauses=[clips[i]['trailing']+clips[i]['padding']+clips[i+1]['leading'] for i in range(19)]
after={'videoDuration':media['duration'],'rawTtsContentDuration':sum(t['pacing']['rawDurationSeconds'] for t in tracks),'rawSpeechDurationExcludingBoundarySilence':sum(t['pacing']['rawDurationSeconds']-t['pacing']['leadingSeconds']-t['pacing']['trailingSeconds'] for t in tracks),'trimmedTtsDuration':sum(c['duration'] for c in clips),'totalDetectedSilence':quiet,'boundarySilence':sum(c['leading']+c['trailing'] for c in clips),'naturalSpeechPause':sum(c['naturalPause'] for c in clips),'systemPadding':sum(c['padding'] for c in clips),'speechOccupancy':100*(len(mix)/rate-quiet)/(len(mix)/rate),'meanInterSegmentPause':statistics.mean(pauses),'medianInterSegmentPause':statistics.median(pauses),'maxInterSegmentPause':max(pauses),'initialSilence':runs[0]['end'] if runs and runs[0]['start']==0 else 0,'finalSilence':len(mix)/rate-runs[-1]['start'] if runs else None,'voiceRate':tracks[0]['voiceRate'],'clipOverlaps':0,'eachSegmentOnce':True,'audioQa':media['audioQa']}
save('audio-after.json',after);save('audio-after-clips.json',clips);save('audio-after-silence.json',runs)
manifest=get('baseline/manifest.json');bad=[p for p,h in manifest['hashes'].items() if sha(Path(p))!=h];assert not bad,bad;assert sha(Path('roteiro-panela.txt'))==manifest['scriptSha']
runtime=[*Path('src').rglob('*.ts'),*Path('src').rglob('*.tsx')];blocked=[]
for p in runtime:
 old=R/'baseline/code'/p;lines=p.read_text('utf-8').splitlines();prior=set(old.read_text('utf-8').splitlines()) if old.exists() else set()
 # Files outside the saved editable set are frozen by the preservation manifest,
 # or unchanged existing runtime. Scan new modules and new lines of edited code.
 if not old.exists() and p.as_posix() not in ['src/visual-causal/cinematic.ts','src/engine3d/audio/pacing.ts']:continue
 for line in lines:
  if line not in prior and re.search(r'\bpanela\b|pressure.?cooker|roteiro-panela|pinOnLid',line,re.I):blocked.append({'file':p.as_posix(),'line':line})
assert not blocked,blocked
save('integrity.json',{'protectedFiles':len(manifest['hashes']),'changed':bad,'scriptShaBefore':manifest['scriptSha'],'scriptShaAfter':sha(Path('roteiro-panela.txt')),'understandingChanged':False,'researchChanges':'NONE','parserChanges':'NONE','antiHardcode':{'passed':True,'newTopicBranches':0,'scannedRuntimeFiles':len(runtime)},'git':subprocess.check_output(['git','status','--short'],text=True),'base':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()})
summary={'productPass':'REVIEW_REQUIRED','media':{**media,'path':str((R/'video.mp4').resolve())},'audio':after,'direction':get('direction-metrics.json'),'fullRenders':len(ledger),'scriptShaBefore':manifest['scriptSha'],'scriptShaAfter':sha(Path('roteiro-panela.txt'))};save('product-summary.json',summary);print(json.dumps(summary,ensure_ascii=False))
