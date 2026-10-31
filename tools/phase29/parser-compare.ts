/** Operator: parser BEFORE (clause claims/actions only) vs AFTER (+ mechanism relations, entity categories), plus junk objects. */
import {readFileSync} from 'node:fs';import {ingestScript} from '../../src/script-mode/ingest';import {understandScript} from '../../src/script-mode/understand';import {mechanismGraph} from '../../src/script-mode/mechanism';
import {plannerInputFromScript} from '../../src/script-mode/input';import {planVisualCausal} from '../../src/visual-causal/planner';import {validateVisualPlan} from '../../src/visual-causal/verify';
const NONVIS=['TIME','REGION','PROPERTY','QUANTITY','DISCOURSE','ABSTRACT_CONCEPT'];
for(const f of process.argv.slice(2)){const u=understandScript(ingestScript(readFileSync(f,'utf8'))),known=new Set(u.claims.filter(c=>c.status==='SCRIPT_ASSERTED').map(c=>c.id));
 const before={assertedClaims:known.size,visualActions:u.actions.filter(a=>known.has(a.claimId)&&a.action!=='NAME_ONLY').length,unparsedSentences:u.segments.filter(s=>s.role!=='QUESTION'&&!u.claims.some(c=>c.segmentId===s.id)).length,
  junkCandidates:u.entities.filter(e=>NONVIS.includes(e.category??'')&&!['ABSTRACT','ACTOR','FLUID','FORCE'].includes(e.role)&&e.claimIds.some(c=>known.has(c))).map(e=>e.label)};
 let at=0;const timing=u.segments.map(s=>{const w={sentenceId:s.id,startFrame:at,endFrame:at+90};at+=90;return w;});const input=plannerInputFromScript(u,timing,30),p=planVisualCausal(input);
 const drawnJunk=p.world.entities.filter(w=>w.assembly!=='FORCE_ARROW'&&u.entities.some(e=>w.scriptEntityIds?.includes(e.id)&&NONVIS.includes(e.category??'')&&!w.scriptEntityIds.some(id=>!NONVIS.includes(u.entities.find(x=>x.id===id)?.category??''))));
 const g=mechanismGraph(u.mechanism??[]),covered=new Set((u.mechanism??[]).map(r=>r.sentenceId));
 console.log(f,JSON.stringify({before,after:{mechanismRelations:(u.mechanism??[]).length,sentencesWithoutAnyRelation:u.segments.filter(s=>s.role!=='QUESTION'&&!u.claims.some(c=>c.segmentId===s.id)&&!covered.has(s.id)).length,junkDrawn:drawnJunk.map(w=>w.label),template:p.world.template,valid:validateVisualPlan(p,input.relations.map(r=>r.id)).valid},graph:{...g,nodes:g.nodes.length}}));}
