import json,subprocess,shutil,wave
from pathlib import Path
import numpy as np
R=Path('out/engine3d/script-mode/roteiro-panela-product-pass');tracks=json.loads((R/'tracks.json').read_text());inp=json.loads((R/'planner-input.json').read_text());ff=shutil.which('ffmpeg')
if not ff:
 import imageio_ffmpeg
 ff=imageio_ffmpeg.get_ffmpeg_exe()
rate=48000;out=np.zeros((inp['totalFrames']*rate//inp['fps'],2),np.float32)
for tr,win in zip(tracks,inp['timing']):
 raw=subprocess.check_output([ff,'-v','error','-i',str(Path('public')/tr['relativeAudioPath']),'-ar',str(rate),'-ac','2','-f','f32le','-']);x=np.frombuffer(raw,'<f4').reshape(-1,2);start=win['startFrame']*rate//inp['fps'];out[start:start+len(x)]=x
def wav(p,data):
 with wave.open(str(p),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(rate);f.writeframes((np.clip(data,-1,1)*32767).astype('<i2').tobytes())
wav(R/'narration-preview.wav',out)
start=inp['timing'][4]['startFrame']*rate//inp['fps'];end=inp['timing'][9]['startFrame']*rate//inp['fps']
wav(R/'continuous-audition.wav',out[start:end]);print(json.dumps({'duration':len(out)/rate,'audition':'CONTIGUOUS_UNEDITED_EXCERPT','voiceRate':tracks[0].get('voiceRate','+0%')}))
