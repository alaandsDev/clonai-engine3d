/** Delivery mux: preserve rendered H.264, apply constant narration gain, enable MP4 fast start. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {ffmpegExecutable} from '../../src/sound/tools';
import {validateMp4,extractFrames,contactSheet} from '../../src/visual-causal/media';
const run=promisify(execFile),root=process.argv[2]??'out/engine3d/production/elevador';
const seq=JSON.parse(readFileSync(root+'/directed-sequence.json','utf8'));
const output=root+'/'+(process.argv[4]??'elevador-youtube-tiktok.mp4');
if(existsSync(output))throw Error('DELIVERY_ALREADY_EXISTS: preserve before re-export');
await run(ffmpegExecutable(),['-v','error','-i',root+'/'+(process.argv[3]??'como-o-elevador-para.mp4'),'-f','f32le','-ar','48000','-ac','2','-i',root+'/work/voice.f32','-map','0:v:0','-map','1:a:0','-c:v','copy','-af','volume=4.5dB','-ar','48000','-ac','2','-c:a','aac','-b:a','192k','-t',String(seq.totalFrames/seq.fps),'-movflags','+faststart',output],{timeout:180000,maxBuffer:2*1024*1024});
const media=await validateMp4(output,seq);
const bytes=readFileSync(output),boxes:string[]=[];let at=0;
while(at+8<=bytes.length){const size=bytes.readUInt32BE(at);boxes.push(bytes.toString('ascii',at+4,at+8));if(size<8)break;at+=size;}
const fastStart=boxes.indexOf('moov')>=0&&boxes.indexOf('moov')<boxes.indexOf('mdat');
if(!media.passed||!fastStart)throw Error('DELIVERY_QA '+JSON.stringify({media,fastStart}));
const frames=[30,130,280,417,530,655,790,920,1015,1190,1380].filter(x=>x<seq.totalFrames);
const files=await extractFrames(output,frames,root+'/final-frames');
await contactSheet(files,root+'/final-contact-sheet.png',4);
writeFileSync(root+'/delivery.json',JSON.stringify({...media,output,fastStart,constantAudioGainDb:4.5,videoReencoded:false,speechTimeStretch:false,captionTiming:'SENTENCE_ESTIMATE',subjectiveListening:'NOT_CLAIMED; listening sample shared with user'},null,2),'utf8');
console.log(JSON.stringify({output,fastStart,...media}));
