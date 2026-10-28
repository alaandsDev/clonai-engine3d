import type {Arc,TopicAnalysis,WriterCapabilityProfile,VisualNarrativeStrategy} from './contracts';
export const arcLibrary:{id:Arc;requirements:string[];arc:string[];hook:string;conclusion:string}[]=[
 {id:'PROCESS_EXPLAINER',requirements:['process','subject'],arc:['HOOK','OVERVIEW','ORIGIN','PATH','DESTINATION','RESULT','CONCLUSION'],hook:'PROCESS_QUESTION',conclusion:'RECAP'},
 {id:'STATE_TRANSFORMATION',requirements:['state_change','subject'],arc:['HOOK','SETUP','ONSET','PROGRESS','RESULT','HOLD','CONCLUSION'],hook:'CHANGE_QUESTION',conclusion:'STATE_RECAP'},
 {id:'BEFORE_AFTER',requirements:['state_change','subject'],arc:['SETUP','HOOK','ONSET','PROGRESS','PAUSE','RESULT','HOLD','CONCLUSION'],hook:'BEFORE_AFTER',conclusion:'COMPARE_OBSERVATIONS'},
 {id:'PATH_JOURNEY',requirements:['source','path','destination'],arc:['ORIGIN','HOOK','PATH','PAUSE','DESTINATION','RESULT','CONCLUSION'],hook:'DESTINATION_QUESTION',conclusion:'OPEN_QUESTION'},
 {id:'QUANTITY_PROGRESSION',requirements:['quantity_change','licensed_quantities'],arc:['HOOK','SETUP','PROGRESS','RESULT','CONCLUSION'],hook:'QUANTITY_QUESTION',conclusion:'QUANTITY_RECAP'},
 {id:'RANKING',requirements:['ranking','licensed_quantities'],arc:['HOOK','SETUP','RESULT','CONCLUSION'],hook:'RANK_QUESTION',conclusion:'ORDER_RECAP'},
 {id:'COMPARISON',requirements:['comparison','licensed_quantities'],arc:['HOOK','SETUP','RESULT','CONCLUSION'],hook:'COMPARE_QUESTION',conclusion:'COMPARE_RECAP'},
 {id:'OBJECT_EXPLAINER',requirements:['object_explanation'],arc:['HOOK','SETUP','RESULT','CONCLUSION'],hook:'OBJECT_QUESTION',conclusion:'OBJECT_RECAP'},
 {id:'QUESTION_REVEAL',requirements:['process_or_state','subject'],arc:['HOOK','GOAL','ORIGIN','PATH','ONSET','PROGRESS','DESTINATION','RESULT','HOLD','CONCLUSION'],hook:'RESULT_QUESTION',conclusion:'ANSWER_REVEAL'},
];
export function generateStrategies(a:TopicAnalysis,p:WriterCapabilityProfile):VisualNarrativeStrategy[]{
 const liquid=a.family==='TRANSFER'||a.family==='SOURCE'&&a.entities.includes('liquid'),state=a.family==='ACCUMULATION'||a.family==='SOURCE'&&a.entities.includes('vehicle');
 const hasTransfer=p.bundles.some(b=>b.id==='LIQUID_TRANSFER'),hasState=p.bundles.some(b=>b.id==='VEHICLE_ACCUMULATION');
 const available=new Set<string>(['subject',...(liquid&&hasTransfer?['process','source','path','destination','process_or_state']:[]),...(state&&hasState?['state_change','process_or_state']:[])]);
 return arcLibrary.map(s=>{const missingRequirements=s.requirements.filter(k=>!available.has(k));return{id:s.id,eligible:a.family!=='UNKNOWN'&&!missingRequirements.length,requirements:s.requirements,missingRequirements,hook:s.hook,centralSubject:liquid?'liquid':state?'vehicle':'unresolved',visualGoal:liquid?'Trace the represented transfer and observe destination level':state?'Observe the illustrated accumulation and covered surface':'No authorized visual goal',supportedProcesses:liquid&&hasTransfer?['FLOW','ENTER','FILL']:[],supportedStateChanges:state&&hasState?['ACCUMULATE','COVER']:[],supportedQuantities:[],narrativeArc:s.arc,estimatedCapabilityCoverage:1-missingRequirements.length/s.requirements.length,reason:missingRequirements.length?'Missing abstract concept/capability: '+missingRequirements.join(', '):'Capability requirements met; factual permission and semantic preflight remain mandatory'};});
}
