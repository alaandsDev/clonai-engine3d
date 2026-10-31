"""Reusable production operator: continuous narration and sentence-estimated SRT from saved JSON."""
import json, subprocess, shutil, wave, sys
from pathlib import Path
import numpy as np
root=Path(sys.argv[1])
def load(name): return json.loads((root/name).read_text(encoding='utf-8'))
seq,tracks,timing=load('directed-sequence.json'),load('tracks.json'),load('timing.json')
ff=shutil.which('ffmpeg')
if not ff:
 import imageio_ffmpeg
 ff=imageio_ffmpeg.get_ffmpeg_exe()
audio=np.zeros((seq['totalFrames']*48000//seq['fps'],2),np.float32)
for track,win in zip(tracks,timing):
 assert track['sentenceId']==win['sentenceId']
 raw=subprocess.check_output([ff,'-v','error','-i',str(Path('public')/track['relativeAudioPath']),'-ar','48000','-ac','2','-f','f32le','-'])
 pcm=np.frombuffer(raw,'<f4').reshape(-1,2);start=win['startFrame']*48000//seq['fps']
 assert len(pcm)<=(win['endFrame']-win['startFrame'])*48000//seq['fps']
 audio[start:start+len(pcm)]=pcm
with wave.open(str(root/'narracao.wav'),'wb') as f:
 f.setnchannels(2);f.setsampwidth(2);f.setframerate(48000);f.writeframes((np.clip(audio,-1,1)*32767).astype('<i2').tobytes())
subprocess.run([ff,'-v','error','-y','-i',str(root/'narracao.wav'),'-c:a','libmp3lame','-b:a','160k',str(root/'narracao.mp3')],check=True)
def stamp(frame):
 ms=round(frame*1000/seq['fps']);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
(root/'legendas.srt').write_text('\n\n'.join(f'{i}\n{stamp(c["startFrame"])} --> {stamp(c["endFrame"])}\n{c["text"]}' for i,c in enumerate(seq['captions'],1))+'\n',encoding='utf-8')
print(json.dumps({'duration':len(audio)/48000,'peak':float(np.max(np.abs(audio))),'captionCues':len(seq['captions']),'timeline':'CONTINUOUS; no montage, stretch or overlapping sentences'}))
