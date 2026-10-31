/** Operator (Phase29 readability): BEFORE vs AFTER frames at the same narrative moments (sentence + fraction), side by side.
 * Usage: tsx tools/phase29/readability-compare.ts <before-dir> <after-dir> <out.png> */
import path from 'node:path';import {readFileSync} from 'node:fs';import {extractFrames,contactSheet} from '../../src/visual-causal/media';
const [before,after,out]=process.argv.slice(2);
// moment: [label, sentence, fraction of the sentence]
const MOMENTS:[string,string,number][]=[['heat entering','SEG_04',0.75],['heat taken from inside','SEG_05',0.45],['heat thrown out','SEG_05',0.92],['question: how?','SEG_06',0.6],
 ['evaporator','SEG_08',0.8],['boils / becomes gas','SEG_09',0.8],['absorbs heat','SEG_10',0.8],['question: where does the heat go?','SEG_11',0.85],
 ['compressor squeezes','SEG_12',0.3],['gets hot','SEG_12',0.5],['compressor → grille','SEG_12',0.92],['grille releases heat','SEG_13',0.45],['back to liquid','SEG_13',0.9],
 ['valve: pressure drops','SEG_14',0.4],['returns cold inside','SEG_14',0.92],['interior reaches temperature','SEG_15',0.35],['thermostat switches compressor off','SEG_15',0.92],
 ['payoff: heat from inside','SEG_16',0.15],['payoff: heat reaches the back','SEG_16',0.5],['payoff: closing / final','SEG_16',0.97]];
const frameOf=(dir:string,seg:string,k:number)=>{const t=(JSON.parse(readFileSync(path.join(dir,'planner-input.json'),'utf8')).timing as {sentenceId:string;startFrame:number;endFrame:number}[]).find(x=>x.sentenceId===seg)!;return Math.round(t.startFrame+(t.endFrame-t.startFrame)*k);};
const files:string[]=[];
for(const [label,seg,k] of MOMENTS){const fb=frameOf(before,seg,k),fa=frameOf(after,seg,k);
 const [b]=await extractFrames(path.join(before,'video.mp4'),[fb],path.join(path.dirname(out),'cmp-before'));const [a]=await extractFrames(path.join(after,'video.mp4'),[fa],path.join(path.dirname(out),'cmp-after'));
 files.push(b,a);console.log(label.padEnd(36),seg,'before f'+fb,'after f'+fa);}
await contactSheet(files,out,6);console.log(out);
