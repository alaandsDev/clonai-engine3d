import path from 'node:path';
import {generateFromScript} from '../../src/script-mode/generate';
import {renderStills,contactSheet} from '../../src/visual-causal/media';
/** Operator preview (Phase29): Script Mode pipeline without MP4, then stills at beat mid-frames. */
const [script,label]=process.argv.slice(2);
const out=path.join('out/engine3d/phase29/previews',label);
const r=await generateFromScript({scriptPath:script,outDir:out,render:false});
const frames=r.plan.beats.map(b=>Math.round((b.startFrame+b.endFrame)/2));
const files=await renderStills(r.seq,frames,path.join(out,'stills'));
await contactSheet(files,path.join(out,'preview-sheet.png'),5);
console.log(out,JSON.stringify(r.summary.qa));
