import {extractFrames,contactSheet} from '../../src/visual-causal/media';
/** Operator harness: extract named event frames from an encoded MP4 and build a sheet. */
const [mp4,out,list,cols]=process.argv.slice(2);
if(!mp4||!out||!list)throw Error('Usage: events <mp4> <sheet.png> <f1,f2,...> [columns]');
const files=await extractFrames(mp4,list.split(',').map(Number),out.replace(/\.png$/,''));
await contactSheet(files,out,Number(cols??6));console.log(files.length);
