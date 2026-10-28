import {capabilityGraph} from '../autodirector/capabilities';
import type {CapabilityNode} from '../autodirector/contracts';
import {jsonHash} from '../editorial/fingerprint';
import type {WriterCapabilityProfile} from './contracts';
const unique=(xs:string[])=>[...new Set(xs)].sort();
export function buildCapabilityProfile(snapshot:CapabilityNode[]=capabilityGraph()):WriterCapabilityProfile {
 const nodes=structuredClone(snapshot).map(n=>({...n,capabilities:unique(n.capabilities),semanticTags:unique(n.semanticTags)})).sort((a,b)=>a.id.localeCompare(b.id,'en'));
 const rules=[
  {id:'LIQUID_TRANSFER',tags:['liquid','reservoir','connection'],caps:['FLOW','CONNECT','FILL'],subjects:['liquid','container','path'],ops:['EXIT','FLOW','ENTER','FILL','INCREASE'],relations:['source','path','destination'],proof:['process','spatial_relation','quantity_change']},
  {id:'LIQUID_UPWARD',tags:['upward'],caps:['FLOW'],subjects:[],ops:['RISE'],relations:[],proof:[]},
  {id:'STORAGE',tags:['storage'],caps:['OBJECT_STATE_HOLD','FILL'],subjects:[],ops:['STORE'],relations:['state_hold'],proof:['state_change']},
  {id:'VEHICLE_ACCUMULATION',tags:['vehicle','freezable'],caps:['OBJECT_ACCUMULATE','OBJECT_STATE_CHANGE'],subjects:['vehicle','ice'],ops:['ACCUMULATE','COVER'],relations:['state_change'],proof:['state_change']},
  {id:'DOOR',tags:['door'],caps:['DOOR_OPEN','DOOR_STATE_PERSIST','ACTOR_APPROACH'],subjects:['door'],ops:['OPEN'],relations:['state_change'],proof:['state_change']},
  {id:'NUMBER_DISPLAY',tags:['number'],caps:['DISPLAY_NUMBER','DISPLAY_TEXT'],subjects:['number'],ops:['DISPLAY_NUMBER'],relations:['quantity'],proof:['text_quantity']},
 ];
 const tags=new Set(nodes.filter(n=>n.capabilities.length).flatMap(n=>n.semanticTags)),caps=new Set(nodes.flatMap(n=>n.capabilities));
 const accepted=rules.filter(r=>r.tags.every(t=>tags.has(t))&&r.caps.every(c=>caps.has(c)));
 const raw={version:'writer-capability-profile/1.0.0',subjects:unique(accepted.flatMap(r=>r.subjects)),operations:unique(accepted.flatMap(r=>r.ops)),relations:unique(accepted.flatMap(r=>r.relations)),proofTypes:unique(accepted.flatMap(r=>r.proof)),bundles:accepted.map(r=>({id:r.id,operations:r.ops,requirements:r.caps,evidenceNodeIds:nodes.filter(n=>n.capabilities.some(c=>r.caps.includes(c))&&n.semanticTags.some(t=>r.tags.includes(t))).map(n=>n.id)})),snapshot:nodes};
 return {...raw,fingerprint:jsonHash(raw)};
}
