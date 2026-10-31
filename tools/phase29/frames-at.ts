/** Operator: contact sheet of specific frames. Usage: tsx tools/phase29/frames-at.ts <video.mp4> <out.png> <cols> <f1> <f2> ... */
import path from 'node:path';import {extractFrames,contactSheet} from '../../src/visual-causal/media';
const [video,out,cols,...fs]=process.argv.slice(2);
const files=await extractFrames(video,fs.map(Number),path.join(path.dirname(out),'frames-at'));await contactSheet(files,out,Number(cols));console.log(out);
