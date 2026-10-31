import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import path from 'node:path';
import {renderMp4,validateMp4,extractFrames,contactSheet} from '../../src/visual-causal/media';
import {installNetworkGuard} from '../../src/script-mode/generate';
const root='out/engine3d/script-mode/roteiro-panela-product-pass',load=(p:string)=>JSON.parse(readFileSync(root+'/'+p,'utf8'));
const seq=load('directed-sequence.json'),plan=load('visual-plan.json'),tracks=load('tracks.json'),input=load('planner-input.json');
const ledgerPath=root+'/render-ledger.json',ledger=existsSync(ledgerPath)?load('render-ledger.json'):[];if(ledger.length>=3)throw Error('MAXIMUM_THREE_FULL_RENDERS');const id=String(ledger.length+1).padStart(2,'0'),dir=root+'/attempts/'+id;mkdirSync(dir,{recursive:true});
ledger.push({id,status:'STARTED',frames:seq.totalFrames});writeFileSync(ledgerPath,JSON.stringify(ledger,null,2));
const guard=installNetworkGuard();try{
 const output=dir+'/video.mp4',render=await renderMp4(seq,tracks,input.timing,output,{title:input.topic,comment:'PRODUCT_PASS; USER_SCRIPT; script='+input.scriptFingerprint+'; plan='+plan.fingerprint});
 const media=await validateMp4(output,seq);if(!media.passed)throw Error('MP4_VALIDATION '+media.issues.join(','));
 const pcts=Array.from({length:21},(_,i)=>Math.min(seq.totalFrames-1,Math.round(i*(seq.totalFrames-1)/20))),events=plan.beats.map((b:any)=>Math.floor((b.startFrame+b.endFrame)/2)),frames=[...new Set([...pcts,...events])].sort((a,b)=>a-b),files=await extractFrames(output,frames,dir+'/frames'),fileFor=(f:number)=>files[frames.indexOf(f)];
 await contactSheet(pcts.map(fileFor),dir+'/contact-sheet.png',7);await contactSheet(events.map(fileFor),dir+'/event-sheet.png',5);
 for(const file of ['visual-plan.json','directed-sequence.json','tracks.json','planner-input.json','qa.json'])copyFileSync(root+'/'+file,dir+'/'+file);
 const summary={...media,render,attempt:id,externalInProcessCalls:guard.counters.external,path:output};writeFileSync(dir+'/media.json',JSON.stringify(summary,null,2));ledger.at(-1).status='RENDERED';writeFileSync(ledgerPath,JSON.stringify(ledger,null,2));console.log(JSON.stringify(summary));
}finally{guard.restore();}
