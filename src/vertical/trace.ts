import {jsonHash} from '../editorial/fingerprint';
/** Phase 25 vertical-slice instrumentation. A trace records what the existing
 * pipeline did for one topic; it never decides content. Timestamps are
 * metadata only and are excluded from the deterministic fingerprint. */
export const VERTICAL_STAGES=['TOPIC_ANALYSIS','RESEARCH_ROUTING','RESEARCH','EVIDENCE','WRITER','SCRIPT','SEMANTICS','NARRATIVE','AUTO_DIRECTION','VISUAL_DEMONSTRATION','DIRECTED_SEQUENCE','ENGINE3D','VOICE','EDITORIAL','COMPOSITION','RENDER','MP4_VALIDATION'] as const;
export type VerticalStage=typeof VERTICAL_STAGES[number];
export type StageStatus='NOT_STARTED'|'RUNNING'|'PASS'|'PARTIAL'|'BLOCKED'|'FAILED'|'SKIPPED';
export interface StageRecord {stage:VerticalStage;status:StageStatus;inputFingerprint:string|null;outputFingerprint:string|null;startedAt:string|null;completedAt:string|null;blockingReason:string|null;diagnostics:Record<string,unknown>;artifacts:string[]}
export interface VerticalSliceAttempt {attemptNumber:number;blockingStage:VerticalStage|null;blockingReason:string|null;changeIntroduced:string|null;whyGeneralizable:string|null;testsAdded:string[];resultAfterChange:string|null;regressions:string[];nextStageReached:VerticalStage|null}
export interface VerticalSliceTrace {version:'vertical-slice-trace/1.0.0';topic:string;label:string;stages:StageRecord[];firstBlocker:{stage:VerticalStage;reason:string}|null;furthestStage:VerticalStage|null;fingerprint:string}
const blank=(stage:VerticalStage):StageRecord=>({stage,status:'NOT_STARTED',inputFingerprint:null,outputFingerprint:null,startedAt:null,completedAt:null,blockingReason:null,diagnostics:{},artifacts:[]});
export function newTrace(topic:string,label:string):VerticalSliceTrace{return seal({version:'vertical-slice-trace/1.0.0',topic,label,stages:VERTICAL_STAGES.map(blank),firstBlocker:null,furthestStage:null,fingerprint:''});}
const ORDER=new Map(VERTICAL_STAGES.map((s,i)=>[s,i]));
/** Transitions: a stage can only start once every earlier stage is PASS/PARTIAL/SKIPPED;
 * after a BLOCKED/FAILED stage, every later stage is SKIPPED. */
export function startStage(t:VerticalSliceTrace,stage:VerticalStage,input:unknown,now:string|null=null):VerticalSliceTrace{
 const i=ORDER.get(stage)!;
 for(const prior of t.stages.slice(0,i))if(!['PASS','PARTIAL','SKIPPED'].includes(prior.status))throw Error('VERTICAL_STAGE_ORDER '+stage+' after '+prior.stage+'='+prior.status);
 if(t.stages[i].status!=='NOT_STARTED')throw Error('VERTICAL_STAGE_RESTART '+stage);
 const stages=t.stages.map(s=>s.stage===stage?{...s,status:'RUNNING' as const,inputFingerprint:input===undefined?null:jsonHash(input),startedAt:now}:s);
 return seal({...t,stages});
}
export function finishStage(t:VerticalSliceTrace,stage:VerticalStage,r:{status:Exclude<StageStatus,'NOT_STARTED'|'RUNNING'>;output?:unknown;blockingReason?:string|null;diagnostics?:Record<string,unknown>;artifacts?:string[]},now:string|null=null):VerticalSliceTrace{
 const i=ORDER.get(stage)!;if(t.stages[i].status!=='RUNNING'&&r.status!=='SKIPPED')throw Error('VERTICAL_STAGE_NOT_RUNNING '+stage);
 if((r.status==='BLOCKED'||r.status==='FAILED')&&!r.blockingReason)throw Error('VERTICAL_BLOCK_REASON_REQUIRED '+stage);
 let stages=t.stages.map(s=>s.stage===stage?{...s,status:r.status,outputFingerprint:r.output===undefined?null:jsonHash(r.output),completedAt:now,blockingReason:r.blockingReason??null,diagnostics:r.diagnostics??{},artifacts:r.artifacts??[]}:s);
 let firstBlocker=t.firstBlocker;
 if(r.status==='BLOCKED'||r.status==='FAILED'){firstBlocker??={stage,reason:r.blockingReason!};stages=stages.map((s,j)=>j>i?{...s,status:'SKIPPED' as const,blockingReason:'UPSTREAM_'+r.status+':'+stage}:s);}
 const reached=stages.filter(s=>s.status==='PASS'||s.status==='PARTIAL').map(s=>s.stage);
 return seal({...t,stages,firstBlocker,furthestStage:reached.at(-1)??null});
}
/** Fingerprint ignores wall-clock metadata so replays of the same inputs agree. */
export function traceFingerprint(t:Omit<VerticalSliceTrace,'fingerprint'>){return jsonHash({...t,stages:t.stages.map(({startedAt:_s,completedAt:_c,...rest})=>rest)});}
function seal(t:VerticalSliceTrace):VerticalSliceTrace{const{fingerprint:_,...raw}=t;return{...raw,fingerprint:traceFingerprint(raw)};}
export function verifyTrace(t:VerticalSliceTrace){const{fingerprint,...raw}=t;return traceFingerprint(raw)===fingerprint;}
