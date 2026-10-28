"""Read-only selected-media technical inspection. No directory scan or original write."""
import os,json,hashlib,subprocess,math
from pathlib import Path
from PIL import Image,ImageDraw
import imageio_ffmpeg
P=Path('out/engine3d/phase11').resolve();ROOT=Path(os.environ['CLONAI_MEDIA_ROOT']).resolve(strict=True)
FFMPEG=os.environ.get('CLONAI_FFMPEG') or imageio_ffmpeg.get_ffmpeg_exe()
FFPROBE=os.environ.get('FFPROBE_PATH') or str(Path('node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe').resolve())
def save(n,v):(P/n).write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
def run(args):return subprocess.run(args,check=True,capture_output=True,timeout=120)
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def safe(rel):
 parts=rel.split('/')
 if any(s in ('','..','.') for s in parts) or '\\' in rel or ':' in rel or '\x00' in rel:raise ValueError('unsafe relative path')
 p=(ROOT/rel).resolve(strict=True)
 if not p.is_relative_to(ROOT) or not p.is_file():raise ValueError('containment/missing media')
 return p
candidates=json.loads((P/'visual-candidates.json').read_text(encoding='utf-8'))['candidates']
assert 0<len(candidates)<=26
review=P/'visual-review';review.mkdir(exist_ok=True)
assets=[];tests=[];reviews=[]
known=json.loads(Path('examples/visual/media-registry.json').read_text(encoding='utf-8'))['assets'] if Path('examples/visual/media-registry.json').exists() else []
approvals=json.loads((P/'visual-approvals.json').read_text(encoding='utf-8')) if (P/'visual-approvals.json').exists() else []
tool=run([FFMPEG,'-version']).stdout.decode().splitlines()[0]
for c in candidates:
 audit=c['audit'];file=safe(audit['relativePath']);before=file.stat();source_hash=digest(file)
 if any(a['id']==c['id'] and a['contentHash']!=source_hash for a in known):raise ValueError('source hash changed; explicit registry/approval revision required')
 if before.st_size!=audit['sizeBytes']:raise ValueError('selected source size changed since audit')
 meta=json.loads(run([FFPROBE,'-v','error','-show_streams','-show_format','-of','json',str(file)]).stdout)
 stream=next(s for s in meta['streams'] if s['codec_type']=='video')
 width,height=int(stream['width']),int(stream['height']);is_video=c['subtype']=='VIDEO'
 run([FFMPEG,'-hide_banner','-v','error','-xerror','-err_detect','explode','-i',str(file),'-map','0:v:0','-an','-f','null','-'])
 if is_video:
  a,b=stream['r_frame_rate'].split('/');fps=float(a)/float(b);duration=float(meta['format']['duration']);assert math.isfinite(duration) and duration>0
  rgba=run([FFMPEG,'-hide_banner','-v','error','-i',str(file),'-an','-vf','scale=96:96,format=rgba','-fps_mode','passthrough','-f','rawvideo','-']).stdout
  assert rgba and len(rgba)%(96*96*4)==0
  alphas=rgba[3::4];lo,hi=min(alphas),max(alphas);frames=len(rgba)//(96*96*4)
  times=[0,duration*.25,duration*.5,duration*.75,max(0,duration-max(.25,2/fps))]
  thumbs=[];corners=[]
  for i,t in enumerate(times):
   target=review/f'{c["id"]}-sample-{i}.png'
   run([FFMPEG,'-hide_banner','-v','error','-y','-ss',str(t),'-i',str(file),'-frames:v','1','-vf','scale=320:-1',str(target)])
   im=Image.open(target).convert('RGBA');thumbs.append(im.copy());corners.extend(im.getpixel(x) for x in [(0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1)])
  sheet=Image.new('RGB',(320*5,240),'#bed7e4')
  for i,im in enumerate(thumbs):sheet.paste(im.convert('RGB'),(i*320,25));ImageDraw.Draw(sheet).text((i*320+5,5),f'{times[i]:.3f}s',fill='black')
  sheet_path=review/f'{c["id"]}-contact.jpg';sheet.save(sheet_path,quality=90)
  preview=review/f'{c["id"]}.mp4';preview_duration=duration
  run([FFMPEG,'-hide_banner','-v','error','-y','-i',str(file),'-t',str(preview_duration),'-an','-vf','scale=640:-2,fps=30','-c:v','libx264','-pix_fmt','yuv420p','-crf','20',str(preview)])
  preview_path=preview.relative_to(Path.cwd()).as_posix();preview_hash=digest(preview);method='all source frames spatially reduced to 96x96 RGBA; 5 representative full-color thumbnails'
 else:
  with Image.open(file) as original:
   original.load();im=original.convert('RGBA');alpha=im.getchannel('A');lo,hi=alpha.getextrema();corners=[im.getpixel(x) for x in [(0,0),(width-1,0),(0,height-1),(width-1,height-1)]]
   thumb=im.copy();thumb.thumbnail((640,400));preview=review/f'{c["id"]}.png';background=Image.new('RGBA',thumb.size,'#bed7e4');background.alpha_composite(thumb);background.convert('RGB').save(preview)
  fps=0;duration=0;frames=1;preview_path=preview.relative_to(Path.cwd()).as_posix();preview_hash=digest(preview);method='native full-image RGBA pixel alpha extrema; decoded by Pillow and FFmpeg'
 black=sum(max(p[:3])<24 for p in corners)/len(corners);white=sum(min(p[:3])>235 for p in corners)/len(corners)
 classification='TRUE_ALPHA' if lo<255 else 'BLACK_BACKGROUND' if black>=.8 else 'WHITE_BACKGROUND' if white>=.8 else 'BLEND_REQUIRED'
 assert c['compositionMode']!='ALPHA' or classification=='TRUE_ALPHA'
 assert source_hash==digest(file) and before.st_mtime_ns==file.stat().st_mtime_ns
 technical=dict(kind='VIDEO' if is_video else 'IMAGE',format=file.suffix[1:].upper(),codec=stream['codec_name'],width=width,height=height,fps=fps,duration=duration,frameCount=frames,sizeBytes=before.st_size,alphaClass=classification,alphaEvidence=dict(method=method,min=lo,max=hi),decodeVerified=True)
 asset=dict(id=c['id'],version=1,type=c['type'],subtype=c['subtype'],roleTags=c['roleTags'],relativePath=audit['relativePath'],sourceCatalog='pack-audit-v1',sourceAuditId=audit['id'],contentHash=source_hash,technicalMetadata=technical,semanticMetadata=c.get('semanticMetadata',dict(description='Candidate requires human review of visible shape/motion and context',evidence='Phase7 classification + Phase11 selected-file decode/preview; not approved')),compositionMode=c['compositionMode'],lifecycleStatus='TESTED',licenseStatus='DECLARED',provenance='External user pack; read-only Phase7/Phase11 selected-media evidence')
 assets.append(asset);tests.append(dict(assetId=c['id'],passed=True,sourceHash=source_hash,technicalMetadata=technical,originalUnchanged=True,blackCornerFraction=black,whiteCornerFraction=white))
 reviews.append(dict(assetId=c['id'],sourceHash=source_hash,preview=preview_path,previewHash=preview_hash,sourceDuration=duration,previewDuration=preview_duration if is_video else 0,contactSheet=(sheet_path.relative_to(Path.cwd()).as_posix() if is_video else None),movingPreviewAvailable=is_video,compositionMode=c['compositionMode'],approvalStatus=[a for a in approvals if a['assetId']==c['id']],derivativeSettings='review-only reduced image on blue background or full selected clip at 640px/30fps H264 mute',toolVersion=tool))
save('visual-registry.json',dict(version=1,assets=assets));save('visual-technical-tests.json',dict(passed=True,count=len(tests),tests=tests));save('pack-validation.json',dict(passed=True,count=len(tests),packRescanned=False,originalWrites=False,tests=tests));save('visual-review-manifest.json',dict(version=1,review=reviews,videoRequiresMotionReview=True))
if not (P/'visual-approvals.json').exists():save('visual-approvals.json',[])
print(json.dumps(dict(tested=len(assets),approved=0,files=[r['preview'] for r in reviews]),indent=2))
