/** Generic snapshot inspector: npx tsx tools/phase28b/diagnose.ts pack.json sourceId */
import {readFileSync} from 'node:fs';
import {validateEvidencePack} from '../../src/research/qa';
import {mechanismWindows,contextualWindowScope} from '../../src/research/contextual-mechanism';
import {parseMechanismSentence} from '../../src/research/mechanism-parser';
import type {EvidencePack} from '../../src/research/contracts';
const[file,id]=process.argv.slice(2);if(!file||!id)throw Error('Usage: diagnose.ts validated-pack.json sourceId');
const p=JSON.parse(readFileSync(file,'utf8')) as EvidencePack;validateEvidencePack(p);const s=p.sources.find(s=>s.id===id);if(!s)throw Error('SOURCE_NOT_FOUND');
console.log(JSON.stringify({sourceId:id,snapshotHash:s.contentHash,manualEvidence:false,windows:mechanismWindows(s).map(w=>({span:w.span,scope:contextualWindowScope(s,p.researchPlan,w),parser:parseMechanismSentence(w.text)}))},null,2));
