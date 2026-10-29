import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resources as registry} from '../../src/engine3d/registry';
import {environmentCapabilities} from '../../src/engine3d/demonstration-runtime';
import {DEMONSTRATION_LIMITS} from '../../src/engine3d/demonstration-contracts';
/** Phase 27 baseline: read-only snapshot of the Phase25 visual result, Phase26 inputs and current capabilities. */
const out='out/engine3d/phase27/baseline';mkdirSync(out,{recursive:true});
const sha=(f:string)=>existsSync(f)?createHash('sha256').update(readFileSync(f)).digest('hex'):null;
const m25=JSON.parse(readFileSync('out/engine3d/phase25/final/render/mp4-manifest.json','utf8')),t25=JSON.parse(readFileSync('out/engine3d/phase25/final/trace.json','utf8'));
const vis=t25.stages.find((s:{stage:string})=>s.stage==='VISUAL_DEMONSTRATION').diagnostics,seq=JSON.parse(readFileSync('out/engine3d/phase25/final/sequence/final-sequence.json','utf8'));
const phase25={mp4:m25.path,sha256:sha(m25.path),recordedSha256:m25.sha256,duration:m25.duration,frames:m25.video.frames,shots:seq.shots.length,cameraSegments:seq.cameraSegments.length,demonstrationSteps:seq.demonstration?.steps.map((s:{operation:string;startFrame:number;endFrame:number})=>[s.operation,s.startFrame,s.endFrame]),
 visualChangesPerMinute:m25.motion.metrics.visualChangesPerMinute,longestSecondsWithoutVisualChange:m25.motion.metrics.longestSecondsWithoutVisualChange,proof:vis.proofDistribution,
 worldContext:'NONE (ENV_LAB_001 with environment hidden; two cylinders and a path)',presenter:'NONE',cutaway:'NONE',subjects:seq.demonstration?.subjects.map((s:{id:string;kind:string})=>s.id+':'+s.kind),
 qualitative:'Abstract objects floating on a flat background; flow visible for ~3 s; small subjects after a pulled-back reframe; ~34 s without new action (Phase25 review).'};
const w='out/engine3d/phase26/phase26b/attempts/final/writer/A.json',wa=JSON.parse(readFileSync(w,'utf8'));
const phase26={writer:w,sha256:sha(w),status:wa.status,words:wa.metrics.words,script:wa.script,relations:wa.handoff.relations.map((r:{id:string;subject:string;predicate:string;object:string;visualHints:string[]})=>({id:r.id,predicate:r.predicate,subject:r.subject,object:r.object,visualHints:r.visualHints})),persistentSystemIntent:wa.handoff.persistentSystemIntent,visualExecution:wa.handoff.visualExecution};
const resources=registry.map(r=>({id:r.id,kind:r.type as string,status:(r as unknown as {status?:string}).status??null}));
const capabilities={environmentGroundCutaway:resources.filter(r=>r.kind==='environment').map(r=>[r.id,environmentCapabilities(r.id).includes('groundCutaway')]),demonstrationLimits:DEMONSTRATION_LIMITS,subjectKinds:['PROP','BOX','CYLINDER','PATH','LAYER'],operations:['APPEAR','DISAPPEAR','MOVE','ROTATE','SCALE','CHANGE_STATE','REVEAL','HIDE','ACCUMULATE','DECREASE','INCREASE','FLOW','CONNECT','SEPARATE','HIGHLIGHT'],presenterModes:['PRESENTER','DEMONSTRATION','HYBRID']};
const counts=resources.reduce((m,r)=>(m[r.kind]=(m[r.kind]??0)+1,m),{} as Record<string,number>);
writeFileSync(out+'/baseline.json',JSON.stringify({phase25,phase26,registry:{total:resources.length,counts,resources},capabilities},null,2));
console.log(JSON.stringify({phase25:{...phase25,demonstrationSteps:undefined,subjects:undefined},phase26:{status:phase26.status,words:phase26.words,relations:phase26.relations.length},registry:counts,cutawayEnvs:capabilities.environmentGroundCutaway.filter(x=>x[1])},null,1));
