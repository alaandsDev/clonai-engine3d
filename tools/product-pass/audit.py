import json,hashlib,subprocess,shutil,re,statistics
from pathlib import Path
import numpy as np
R=Path('out/engine3d/script-mode/roteiro-panela-product-pass');B=Path('out/engine3d/script-mode/roteiro-panela')
R.mkdir(parents=True,exist_ok=True)
def load(p):return json.loads(p.read_text('utf-8-sig'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,x):(R/p).parent.mkdir(parents=True,exist_ok=True);(R/p).write_text(json.dumps(x,ensure_ascii=False,indent=2),'utf-8')
ff=shutil.which('ffmpeg')
if not ff:
 import imageio_ffmpeg
 ff=imageio_ffmpeg.get_ffmpeg_exe()
def audio(p):return np.frombuffer(subprocess.check_output([ff,'-v','error','-i',str(p),'-ac','1','-ar','48000','-f','f32le','-']),dtype='<f4')
def silence(x,threshold=-45):
 size=480;n=len(x)//size;v=x[:n*size].reshape(n,size);quiet=np.sqrt(np.mean(v*v,axis=1))<10**(threshold/20);runs=[];start=None
 for i,s in enumerate([*quiet,False]):
  if s and start is None:start=i
  if not s and start is not None:
   if (i-start)*.01>=.06:runs.append({'start':start*.01,'end':i*.01,'duration':(i-start)*.01})
   start=None
 return runs
if not (R/'baseline/manifest.json').exists():
 protected=[Path('roteiro-panela.txt'),*Path('src/research').rglob('*.ts'),Path('src/script-mode/understand.ts'),Path('src/script-mode/lexicon.ts'),Path('src/script-mode/ingest.ts')]
 for root in [B,Path('out/engine3d/phase27'),Path('out/engine3d/phase27b'),Path('out/engine3d/phase28'),Path('out/engine3d/phase28b'),Path('out/engine3d/phase29')]:
  if root.exists():protected.extend(p for p in root.rglob('*') if p.is_file())
 save('baseline/manifest.json',{'hashes':{p.as_posix():sha(p) for p in protected},'scriptSha':sha(Path('roteiro-panela.txt')),'gitStatus':subprocess.check_output(['git','status','--short'],text=True),'base':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()})
 for p in [*Path('src/script-mode').glob('*.ts'),*Path('src/visual-causal').glob('*.ts'),Path('src/engine3d/demonstration-runtime.ts'),Path('src/engine3d/demonstration-contracts.ts'),Path('src/engine3d/demonstration-geometry.tsx'),Path('src/engine3d/assemblies.tsx')]:
  q=R/'baseline/code'/p;q.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,q)
tracks=load(B/'tracks.json');inp=load(B/'planner-input.json');plan=load(B/'visual-plan.json');seq=load(B/'directed-sequence.json');u=load(B/'semantic-claims.json');rows=[];cliprows=[]
for tr in tracks:
 x=audio(Path('public')/tr['relativeAudioPath']);runs=silence(x);d=len(x)/48000;lead=runs[0]['end'] if runs and runs[0]['start']==0 else 0;trail=d-runs[-1]['start'] if runs and d-runs[-1]['end']<.02 else 0;win=next(w for w in inp['timing'] if w['sentenceId']==tr['sentenceId']);cliprows.append({'id':tr['sentenceId'],'text':tr['text'],'seconds':d,'leading':lead,'trailing':trail,'internalSilence':sum(s['duration'] for s in runs)-lead-trail,'silence':runs,'start':win['startFrame']/seq['fps'],'end':win['endFrame']/seq['fps'],'systemPadding':(win['endFrame']-win['startFrame'])/seq['fps']-d})
for kind,items in [('script_segment',inp['timing']),('semantic_beat',u['segments']),('visual_beat',plan['beats']),('shot',seq['shots']),('caption',seq['captions']),('TTS_clip',tracks),('camera_transition',seq['cameraSegments'])]:
 for it in items:
  sid=it.get('sentenceId') or it.get('id') if kind in ['script_segment','semantic_beat','TTS_clip'] else it.get('sentenceId')
  w=next((w for w in inp['timing'] if w['sentenceId']==sid),None);s=it.get('startFrame',w['startFrame'] if w else None);e=it.get('endFrame',w['endFrame'] if w else None)
  associated=next((c for c in cliprows if c['id']==sid),None)
  if kind=='TTS_clip':associated=next(c for c in cliprows if c['id']==it['sentenceId']);s=associated['start']*seq['fps'];e=s+associated['seconds']*seq['fps']
  overlaps=[c for c in cliprows if s is not None and c['start']<e/seq['fps'] and c['end']>s/seq['fps']]
  rows.append({'kind':kind,'id':it.get('id',sid),'start':s/seq['fps'] if s is not None else None,'end':e/seq['fps'] if e is not None else None,'duration':(e-s)/seq['fps'] if s is not None else None,'sentenceId':sid,'associatedSentence':associated['text'] if associated else None,'sentenceIds':[c['id'] for c in overlaps],'associatedSentences':[c['text'] for c in overlaps],'speechDuration':associated['seconds'] if associated else sum(c['seconds'] for c in overlaps),'padding':associated['systemPadding'] if associated and kind=='script_segment' else 0,'minimumDurationApplied':0 if kind in ['script_segment','TTS_clip'] else '12 frames per visual draft, partitioned inside speech window; not additive' if kind=='visual_beat' else 'NONE','transitionDuration':(e-s)/seq['fps'] if kind=='camera_transition' and s is not None else 1/seq['fps'] if kind=='shot' and it.get('transition')=='CUT' else 0})
mix=audio(B/'video.mp4');runs=silence(mix);boundaries=[cliprows[i]['trailing']+cliprows[i]['systemPadding']+cliprows[i+1]['leading'] for i in range(len(cliprows)-1)];raw=sum(c['seconds'] for c in cliprows);detected=sum(s['duration'] for s in runs);system=sum(c['systemPadding'] for c in cliprows);edges=sum(c['leading']+c['trailing'] for c in cliprows)
summary={'scriptWords':len(Path('roteiro-panela.txt').read_text('utf-8').split()),'videoDuration':seq['totalFrames']/seq['fps'],'rawTtsContentDuration':raw,'rawSpeechDurationExcludingBoundarySilence':raw-edges,'totalDetectedSilence':detected,'initialSilence':runs[0]['end'] if runs and runs[0]['start']==0 else 0,'finalSilence':len(mix)/48000-runs[-1]['start'] if runs else 0,'boundarySilence':edges,'naturalSpeechPause':sum(c['internalSilence'] for c in cliprows),'systemPadding':system,'speechOccupancy':100*(len(mix)/48000-detected)/(len(mix)/48000),'meanInterSegmentPause':statistics.mean(boundaries),'medianInterSegmentPause':statistics.median(boundaries),'maxInterSegmentPause':max(boundaries),'voiceRate':'+0%','actualHardCuts':sum(s['transition']=='CUT' for s in seq['shots']),'userReportedCuts':9,'silenceMethod':'10ms RMS <-45dBFS, >=60ms; estimate of acoustic quiet, not forced-alignment or breath recognition','ffmpeg':ff}
save('baseline/audio-clips.json',cliprows);save('baseline/timeline.json',rows);save('baseline/audio-silence.json',runs);save('baseline/summary.json',summary);print(json.dumps(summary,ensure_ascii=False))
