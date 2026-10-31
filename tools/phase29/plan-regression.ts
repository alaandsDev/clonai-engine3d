/** Operator (Phase29): re-plan stored Script Mode outputs with the current engine (same script, same stored timing) and
 * report what changed versus the stored plan. Usage: tsx tools/phase29/plan-regression.ts <output-dir>... */
import {readFileSync} from 'node:fs';import path from 'node:path';
import {ingestScript} from '../../src/script-mode/ingest';import {understandScript} from '../../src/script-mode/understand';
import {plannerInputFromScript} from '../../src/script-mode/input';import {planVisualCausal} from '../../src/visual-causal/planner';
for(const dir of process.argv.slice(2)){
 const old=JSON.parse(readFileSync(path.join(dir,'visual-plan.json'),'utf8')),pin=JSON.parse(readFileSync(path.join(dir,'planner-input.json'),'utf8'));
 const u=understandScript(ingestScript(readFileSync(path.join(dir,'script.txt'),'utf8'))),plan=planVisualCausal(plannerInputFromScript(u,pin.timing,pin.fps));
 const ents=(p:typeof plan)=>p.world.entities.map(e=>e.entityId+':'+e.assembly+(e.variant?'/'+e.variant:'')).sort(),beats=(p:typeof plan)=>p.beats.map(b=>b.sentenceId+':'+b.visualIntent+':'+b.operations.map(o=>o.operation+'@'+o.target).join('+'));
 const eo=ents(old),en=ents(plan),bo=beats(old),bn=beats(plan);
 console.log('== '+path.basename(dir)+'  template '+old.world.template+'→'+plan.world.template+'  context '+(old.context?.context??'-')+'→'+(plan.context?.context??'-')+'  identical='+(JSON.stringify(eo)===JSON.stringify(en)&&JSON.stringify(bo)===JSON.stringify(bn)));
 const minus=eo.filter(x=>!en.includes(x)),plus=en.filter(x=>!eo.includes(x));if(minus.length||plus.length)console.log('  entities -',minus.join(' '),' +',plus.join(' '));
 const bm=bo.filter(x=>!bn.includes(x)),bp=bn.filter(x=>!bo.includes(x));if(bm.length||bp.length){console.log('  beats -',bm.join(' | '));console.log('  beats +',bp.join(' | '));}
 const go=(old.gaps??[]).map((g:{relationId:string})=>g.relationId).sort(),gn=plan.gaps.map(g=>g.relationId).sort();if(JSON.stringify(go)!==JSON.stringify(gn))console.log('  gaps',go.join(','),'→',gn.join(','));
}
