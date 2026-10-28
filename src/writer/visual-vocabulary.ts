import type {WriterCapabilityProfile} from './contracts';
/** Small compositional grammar; lexical forms are shared across topics/strategies.
 * No complete script, concrete asset, scene, claim object, or fixture ID lives here. */
export const verbForms:Record<string,string[]>={EXIT:['sai de','sai de'],FLOW:['percorre','passa pelo'],ENTER:['entra em','entra em'],FILL:['aumenta','aumenta'],ACCUMULATE:['começa a acumular','acumula'],COVER:['fica coberto de','permanece coberto de']};
export function visualVocabulary(p:WriterCapabilityProfile){return Object.fromEntries(Object.entries(verbForms).filter(([op])=>p.operations.includes(op)).map(([op,forms])=>[op,[...forms]]));}
