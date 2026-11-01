/** Operator: reference-video study sheets (one frame every N seconds, tiled). Usage: tsx tools/reference-sheets.ts <video> <outDir> <everySec> <cols> */
import path from 'node:path';import {extractFrames,contactSheet} from '../src/visual-causal/media';
const [video,out,every,cols]=process.argv.slice(2),fps=30,{execFileSync}=await import('node:child_process');
const dur=Number(execFileSync(path.resolve('node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe'),['-v','error','-show_entries','format=duration','-of','csv=p=0',video]).toString().trim());
const frames=Array.from({length:Math.floor(dur/Number(every))},(_,i)=>Math.round((i*Number(every)+0.5)*fps));
const files=await extractFrames(video,frames,path.join(out,'frames'));
const per=Number(cols)*4;for(let k=0;k*per<files.length;k++)await contactSheet(files.slice(k*per,(k+1)*per),path.join(out,'sheet-'+String(k+1).padStart(2,'0')+'.png'),Number(cols));
console.log(files.length,'frames',Math.ceil(files.length/per),'sheets');
