/** Operator: ~1 frame per second contact sheet of an MP4. Usage: tsx tools/phase29/sheet-1fps.ts <dir-with-video.mp4> <seconds> */
import path from 'node:path';import {extractFrames,contactSheet} from '../../src/visual-causal/media';
const [dir,secs]=process.argv.slice(2),n=Math.floor(Number(secs));
const files=await extractFrames(path.join(dir,'video.mp4'),Array.from({length:n},(_,i)=>i*30+15),path.join(dir,'frames-1fps'));
await contactSheet(files,path.join(dir,'contact-sheet-1fps.png'),10);console.log(files.length);
