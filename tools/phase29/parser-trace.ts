/** Operator: sentence-by-sentence trace of what Script Mode understanding emits (claims, actions, entities) and what it loses. */
import {readFileSync} from 'node:fs';import {ingestScript} from '../../src/script-mode/ingest';import {understandScript} from '../../src/script-mode/understand';
const u=understandScript(ingestScript(readFileSync(process.argv[2],'utf8')));
for(const s of u.segments){const cs=u.claims.filter(c=>c.segmentId===s.id);
 console.log(s.id,s.role,'|',s.span.text);
 if(!cs.length)console.log('   LOST: no clause rule matched (segment role '+s.role+')');
 for(const c of cs){const a=u.actions.find(x=>x.claimId===c.id);console.log('   ',c.status,c.predicate,'S=«'+c.subject.text+'»','V=«'+c.trigger.text+'»',c.args.map(x=>x.role+'=«'+x.span.text+'»').join(' '),'→',a?.action??'-',a?.entityIds.map(id=>u.entities.find(e=>e.id===id)!.label+':'+u.entities.find(e=>e.id===id)!.role).join(',')??'');}}
