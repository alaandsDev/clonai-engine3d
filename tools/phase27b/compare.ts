import {readdirSync} from 'node:fs';
import path from 'node:path';
import {contactSheet} from '../../src/visual-causal/media';
/** Operator harness: two-row comparison sheet (top row = before, bottom row = after, same frames). */
const [before,after,out]=process.argv.slice(2);
const list=(d:string)=>readdirSync(d).filter(f=>f.endsWith('.png')).sort().map(f=>path.join(d,f));
const a=list(before),b=list(after);if(a.length!==b.length)throw Error('frame count mismatch');
console.log(await contactSheet([...a,...b],out,a.length));
