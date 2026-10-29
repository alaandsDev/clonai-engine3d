import {analyzeTopicSignals} from './analyze';
/** Subject phrase of a topic: the raw text minus intent cue spans (e.g. the
 * interrogative/explanatory frame) and edge function words. Used to build
 * search queries; it is never a fact and adds no words of its own. */
const EDGE=/^(?:o|a|os|as|um|uma|uns|umas|de|do|da|dos|das|que|e|se|the|a|an|of|does|do|is|are|how|why|what|work|works|funciona|funcionam)$/i;
const CUES=new Set(['functioning','definition','imperative-explain','why','interrogative','counterfactual']);
export function topicSubject(topic:string):string{
 // The English functioning signal spans the complete question. Preserve its
 // noun phrase instead of deleting the subject together with the intent cue.
 const english=topic.match(/^\s*(?:explain\s+)?how\s+(?:does|do)\s+(.+?)\s+works?\s*[?!.]*\s*$/i);
 if(english)return english[1].replace(/^(?:a|an|the)\s+/i,'').trim();
 const a=analyzeTopicSignals(topic),cut=a.signals.filter(s=>CUES.has(s.feature)).sort((x,y)=>x.start-y.start);
 let text='',at=0;for(const s of cut){if(s.start<at)continue;text+=topic.slice(at,s.start)+' ';at=s.end;}text+=topic.slice(at);
 const words=text.replace(/[?!.,;:]+/g,' ').split(/\s+/).filter(Boolean);
 while(words.length&&EDGE.test(words[0]))words.shift();while(words.length&&EDGE.test(words[words.length-1]))words.pop();
 return words.join(' ');
}
