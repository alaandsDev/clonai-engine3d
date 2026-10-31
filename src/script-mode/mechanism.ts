import type {ScriptSpan,ScriptUnderstanding} from './contracts';
/** Phase29 mechanism semantics (pt-BR, deterministic). A second, conservative reading of each sentence that keeps
 * what the clause rules lose: transfers of materials/quantities, state and property changes, actions on a target
 * (compress, push…), control actions with the state the verb encodes, and routes (source → path → destination).
 * Precision over recall: a clause without a known mechanism verb emits nothing; a pronoun resolves only to a single
 * compatible antecedent nearby; sequences are never turned into causes; modality, negation and conditions are kept. */
export type EntityCategory='PHYSICAL_ENTITY'|'COMPONENT'|'MATERIAL'|'REGION'|'PROPERTY'|'QUANTITY'|'EVENT'|'ABSTRACT_CONCEPT'|'DISCOURSE'|'TIME';
export type MechType='TRANSFER'|'MOVE'|'STATE_CHANGE'|'PROPERTY_CHANGE'|'ACTION'|'CONTROL'|'CONTACT'|'CONTAIN';
export interface MechRef {text:string;start:number;end:number;head:string|null;category:EntityCategory|null;resolvedFrom?:string;region?:string}
export interface MechRelation {id:string;sentenceId:string;type:MechType;lemma:string;span:ScriptSpan;subject:MechRef|null;predicate:ScriptSpan;
 object?:MechRef;quantity?:MechRef;source?:MechRef;destination?:MechRef;path?:MechRef;property?:string;propertyOwner?:MechRef;direction?:'UP'|'DOWN'|'REACH';
 before?:string;after?:string;resultState?:string;negated:boolean;modality:'ASSERTED'|'POSSIBLE'|'CONDITIONAL';condition?:ScriptSpan;qualifiers:string[]}
/** Character-wise fold keeps offsets: one output char per input char. */
const fold=(s:string)=>[...s].map(c=>c.normalize('NFD')[0].toLowerCase()).join('');
const TIME=/^(?:tempo|hora|horas|momento|vez|vezes|dia|dias|segundo|segundos|minuto|minutos|instante)$/;
const REGION=/^(?:interior|exterior|dentro|fora|fundo|topo|traseira|tras|frente|lado|base|superficie|meio|centro)$/;
const PROPERTY=/^(?:pressao|temperatura|velocidade|nivel|volume|peso|densidade|altura|intensidade)$/;
const QUANTITY=/^(?:calor|energia|frio|eletricidade)$/;
const MATERIAL=/^(?:agua|ar|gas|gases|vapor|liquido|liquidos|fluido|fluidos|oleo|fumaca|sangue|suor|oxigenio|combustivel|gelo|areia|lama|materia|material)$/;
const DISCOURSE=/^(?:segredo|truque|coisa|coisas|jeito|maneira|forma|problema|resposta|pergunta|motivo|ideia|isso|isto|aquilo|tudo|nada|algo|resto|pouco|muito|parte)$/;
const ADVERB=/^(?:rapido|rapida|devagar|depressa|lentamente|logo|bem|mal|muito|pouco|mais|menos|ainda|sempre|nunca|tambem|so|apenas|ja|agora|sozinho|sozinha|juntos)$/;
const ABSTRACT=/^(?:fisica|ciencia|gravidade|natureza|interacao)$/;
/** Any verb form the mechanism reader knows (present or past): never a noun head. */
export const isMechVerb=(w:string)=>Boolean(verbOf(w));
export function categoryOf(head:string|null):EntityCategory|null{if(!head)return null;const h=fold(head);
 return TIME.test(h)?'TIME':REGION.test(h)?'REGION':PROPERTY.test(h)?'PROPERTY':QUANTITY.test(h)?'QUANTITY':MATERIAL.test(h)?'MATERIAL':DISCOURSE.test(h)?'DISCOURSE':ABSTRACT.test(h)?'ABSTRACT_CONCEPT':'PHYSICAL_ENTITY';}
/** Verb lexicon (3rd person present, sg/pl). */
const V:{re:RegExp;type:MechType;lemma:string;role?:string}[]=[
 {re:/^(?:absorve|absorvem|recebe|recebem|captura|capturam)$/,type:'TRANSFER',lemma:'ABSORB',role:'RECEIVER'},
 {re:/^(?:perde|perdem|libera|liberam|solta|soltam|cede|cedem|transfere|transferem|entrega|entregam)$/,type:'TRANSFER',lemma:'RELEASE',role:'GIVER'},
 {re:/^(?:tira|tiram|retira|retiram|remove|removem|extrai|extraem)$/,type:'TRANSFER',lemma:'REMOVE',role:'ACTOR'},
 {re:/^(?:joga|jogam|manda|mandam|envia|enviam|leva|levam)$/,type:'TRANSFER',lemma:'SEND',role:'ACTOR'},
 {re:/^(?:entra|entram)$/,type:'MOVE',lemma:'ENTER'},{re:/^(?:sai|saem)$/,type:'MOVE',lemma:'LEAVE'},
 {re:/^(?:passa|passam|circula|circulam|atravessa|atravessam)$/,type:'MOVE',lemma:'PASS'},{re:/^(?:vai|vao|segue|seguem)$/,type:'MOVE',lemma:'GO'},
 {re:/^(?:volta|voltam|retorna|retornam)$/,type:'MOVE',lemma:'RETURN'},{re:/^(?:vem|chega|chegam)$/,type:'MOVE',lemma:'ARRIVE'},
 {re:/^(?:escorre|escorrem|flui|fluem)$/,type:'MOVE',lemma:'FLOW'},
 // Phase29 generic physical constructions: collection in a place, leaving a source, draining, co-movement, containment.
 // (Forms that are also common nouns — "roda", "junta", "cerca" — are left out on purpose.)
 {re:/^(?:acumula|acumulam|deposita|depositam|concentra|concentram)$/,type:'MOVE',lemma:'ACCUMULATE'},
 {re:/^(?:deixa|deixam|abandona|abandonam)$/,type:'MOVE',lemma:'LEAVE_FROM'},
 {re:/^(?:drena|drenam|escoa|escoam|esvazia|esvaziam)$/,type:'MOVE',lemma:'DRAIN'},
 {re:/^(?:acompanha|acompanham)$/,type:'ACTION',lemma:'FOLLOW'},
 {re:/^(?:contem)$/,type:'CONTAIN',lemma:'CONTAIN'},{re:/^(?:envolve|envolvem|rodeia|rodeiam)$/,type:'CONTAIN',lemma:'SURROUND'},
 {re:/^(?:vira|viram|torna|tornam|fica|ficam|continua|continuam|permanece|permanecem)$/,type:'STATE_CHANGE',lemma:'BECOME'},
 {re:/^(?:ferve|fervem)$/,type:'STATE_CHANGE',lemma:'BOIL'},{re:/^(?:evapora|evaporam)$/,type:'STATE_CHANGE',lemma:'EVAPORATE'},{re:/^(?:condensa|condensam)$/,type:'STATE_CHANGE',lemma:'CONDENSE'},
 {re:/^(?:congela|congelam|solidifica|solidificam)$/,type:'STATE_CHANGE',lemma:'FREEZE'},{re:/^(?:derrete|derretem)$/,type:'STATE_CHANGE',lemma:'MELT'},
 {re:/^(?:esfria|esfriam)$/,type:'STATE_CHANGE',lemma:'COOL'},{re:/^(?:esquenta|esquentam|aquece|aquecem)$/,type:'STATE_CHANGE',lemma:'HEAT'},
 {re:/^(?:expande|expandem|dilata|dilatam)$/,type:'STATE_CHANGE',lemma:'EXPAND'},
 {re:/^(?:aumenta|aumentam|sobe|sobem|eleva|elevam)$/,type:'PROPERTY_CHANGE',lemma:'INCREASE'},{re:/^(?:diminui|diminuem|cai|caem|baixa|baixam|abaixa|abaixam|reduz|reduzem)$/,type:'PROPERTY_CHANGE',lemma:'DECREASE'},
 {re:/^(?:aperta|apertam|comprime|comprimem|pressiona|pressionam|esmaga|esmagam)$/,type:'ACTION',lemma:'COMPRESS'},
 {re:/^(?:empurra|empurram)$/,type:'ACTION',lemma:'PUSH'},{re:/^(?:puxa|puxam|suga|sugam)$/,type:'ACTION',lemma:'PULL'},{re:/^(?:gira|giram)$/,type:'ACTION',lemma:'ROTATE'},
 {re:/^(?:desliga|desligam|desativa|desativam)$/,type:'CONTROL',lemma:'SWITCH_OFF'},{re:/^(?:liga|ligam|ativa|ativam|aciona|acionam)$/,type:'CONTROL',lemma:'SWITCH_ON'},
 {re:/^(?:abre|abrem)$/,type:'CONTROL',lemma:'OPEN'},{re:/^(?:fecha|fecham)$/,type:'CONTROL',lemma:'CLOSE'},
];
const RESULT:Record<string,string>={SWITCH_OFF:'OFF',SWITCH_ON:'ON',OPEN:'OPEN',CLOSE:'CLOSED'};
/** Verb lookup with past-tense forms ("perdeu" → perde, "ficou" → fica, "saiu" → sai). */
const verbOf=(w:string)=>V.find(v=>v.re.test(w))??[w.replace(/ou$/,'a'),w.replace(/eu$/,'e'),w.replace(/iu$/,'i'),w.replace(/aram$/,'am'),w.replace(/eram$/,'em')].filter(x=>x!==w).map(x=>V.find(v=>v.re.test(x))).find(Boolean);
/** Participle → verb ("drenada" → drena, "pressionadas" → pressiona, "retida" → retem/retém-like forms ignored). */
const participleVerb=(w:string)=>{const m=/^(\w+?)(ad|id)(?:o|a|os|as)$/.exec(w);if(!m)return undefined;return V.find(v=>v.re.test(m[1]+(m[2]==='ad'?'a':'e')));};
/** Aspect: "começa a girar", "continua girando", "passa a circular" → the inner verb. */
const ASPECT=/^(?:comeca|comecam|continua|continuam|passa|passam|segue|seguem)$/;
const innerVerb=(w:string)=>/r$/.test(w)?V.find(v=>v.re.test(w.slice(0,-1)))??V.find(v=>v.re.test(w.slice(0,-2)+'e')):/(?:ando|endo|indo)$/.test(w)?V.find(v=>v.re.test(w.replace(/ando$/,'a').replace(/endo$/,'e').replace(/indo$/,'i'))):undefined;
/** "pressionadas contra", "encostado em": a participle of contact before a surface. */
const CONTACT_PART=/^(?:pressionad|empurrad|encostad|grudad|apertad|prensad|colad|jogad|achatad)(?:o|a|os|as)$/;
/** Size/intensity words before a noun are modifiers, never the head ("pequenos X", "mais água"). */
const PRE_ADJ=/^(?:pequen[oa]s?|grandes?|boa|boas|bom|bons|alt[oa]s?|baix[oa]s?|muit[oa]s?|pouc[oa]s?|mais|menos|divers[oa]s?|vari[oa]s?|fin[oa]s?|minuscul[oa]s?|enormes?)$/;
/** "parte/metade/maioria de X": the quantity is X, partially. */
const PARTITIVE=/^(?:parte|metade|maioria|resto|porcao)$/;
const PLURAL_DET=/^(?:os|as|uns|umas|esses|essas|estes|estas|seus|suas)$/;
const STATE_OF:Record<string,string>={BOIL:'BOILING',EVAPORATE:'GAS',CONDENSE:'LIQUID',FREEZE:'SOLID',MELT:'LIQUID',COOL:'COLD',HEAT:'HOT',EXPAND:'EXPANDED'};
const STATE_WORD=/^(?:gas|vapor|liquido|liquida|solido|solida|quente|quentes|frio|fria|frios|frias|gelado|gelada|ligado|ligada|desligado|desligada|aberto|aberta|fechado|fechada|cheio|cheia|vazio|vazia)$/;
const STATE_NORM=(w:string)=>({gas:'GAS',vapor:'GAS',liquido:'LIQUID',liquida:'LIQUID',solido:'SOLID',solida:'SOLID',quente:'HOT',quentes:'HOT',frio:'COLD',fria:'COLD',frios:'COLD',frias:'COLD',gelado:'COLD',gelada:'COLD',ligado:'ON',ligada:'ON',desligado:'OFF',desligada:'OFF',aberto:'OPEN',aberta:'OPEN',fechado:'CLOSED',fechada:'CLOSED',cheio:'FULL',cheia:'FULL',vazio:'EMPTY',vazia:'EMPTY'} as Record<string,string>)[w]??w.toUpperCase();
const DET=/^(?:o|a|os|as|um|uma|uns|umas|esse|essa|esses|essas|este|esta|seu|sua|meu|minha)$/;
const PRON=/^(?:ele|ela|eles|elas)$/;
const SKIP=/^(?:mas|entao|depois|assim|e|tambem|ainda|so|apenas|por|isso|quando|se|caso|enquanto)$/;
interface Tok {w:string;a:number;b:number}
const toks=(f:string,off:number):Tok[]=>[...f.matchAll(/[a-z0-9]+|[,:;.?!]/g)].map(m=>({w:m[0],a:off+m.index!,b:off+m.index!+m[0].length}));
const FEM=(det:string)=>/^(?:a|as|uma|umas|essa|essas|esta|sua|minha)$/.test(det);
/** Noun phrase starting at i: determiner? + noun (+ one modifier when not a verb/preposition), with "de/do/da X" owner kept separately. */
function np(t:Tok[],i:number,raw:string,base:number):{ref:MechRef;end:number;fem:boolean|null;pl:boolean|null;demonstrative:boolean;owner?:MechRef;ownerFem?:boolean|null}|null{
 let j=i,det='';if(t[j]&&DET.test(t[j].w)){det=t[j].w;j++;}
 while(t[j]&&t[j+1]&&PRE_ADJ.test(t[j].w)&&/^[a-z]/.test(t[j+1].w)&&!ADVERB.test(t[j+1].w)&&!verbOf(t[j+1].w)&&!/^(?:de|do|da|dos|das|para|por|em|que|e|a|o)$/.test(t[j+1].w))j++;
 const n=t[j];if(!n||/[,:;.?!]/.test(n.w)||n.w==='nao'||ADVERB.test(n.w)&&!det||Boolean(verbOf(n.w))||/^(?:de|do|da|dos|das|para|por|pelo|pela|em|no|na|com|sem|que|e|ao|ate)$/.test(n.w))return null;
 let end=j+1;if(t[end]&&!/[,:;.?!]/.test(t[end].w)&&!V.some(v=>v.re.test(t[end].w))&&!/^(?:de|do|da|dos|das|para|por|pelo|pela|em|no|na|com|que|e|ao|ate|o|a|os|as)$/.test(t[end].w)&&!STATE_WORD.test(t[end].w))end++;
 const s=t[i].a,e=t[end-1].b,ref:MechRef={text:raw.slice(s-base,e-base),start:s,end:e,head:n.w,category:categoryOf(n.w)};
 let owner:MechRef|undefined,ownerFem:boolean|null=null;if(t[end]&&/^(?:de|do|da|dos|das)$/.test(t[end].w)&&!REGION.test(t[end+1]?.w??'')){const o=np(t,end+1,raw,base);if(o){owner=o.ref;ownerFem=/^(?:da|das)$/.test(t[end].w)?true:/^(?:do|dos)$/.test(t[end].w)?false:o.fem;end=o.end;}}
 return{ref,end,fem:det?FEM(det):null,pl:det?PLURAL_DET.test(det):/[^u]s$/.test(n.w)?true:null,demonstrative:/^(?:esse|essa|esses|essas|este|esta)$/.test(det),owner,ownerFem};
}
export function mechanismRelations(u:ScriptUnderstanding):MechRelation[]{
 const out:MechRelation[]=[],script=u.source.normalized;
 type Ante={ref:MechRef;fem:boolean|null;pl?:boolean|null};
 let prevSubjects:Ante[]=[];
 for(const seg of u.segments){if(seg.role==='QUESTION')continue;
  const raw=seg.span.text,base=seg.span.start,f=fold(raw),t=toks(f,base),here:Ante[]=[];
  // "é" (verb) folds to "e" (conjunction): the original character tells them apart.
  const isAuxE=(i:number)=>t[i]?.w==='e'&&/[éÉ]/.test(script[t[i].a]??'');
  // Every noun phrase seen in this sentence (local antecedents for "dele/dela" and relative "que").
  const seen:(Ante&{endTok:Tok})[]=[];const note=(n:ReturnType<typeof np>,toksArr:Tok[])=>{if(n)seen.push({ref:n.ref,fem:n.fem,pl:n.pl,endTok:toksArr[n.end-1]});if(n?.owner)seen.push({ref:n.owner,fem:n.ownerFem??null,pl:null,endTok:toksArr[n.end-1]});return n;};
  let condition:ScriptSpan|undefined;let k=0;
  // "Quando/Se/Até/Antes de/Depois de … ," → condition clause (its own relations are CONDITIONAL).
  const cond=/^(?:quando|se|caso|ate|enquanto|antes de|depois de)\b/.exec(f);let condEnd=-1;
  // "Enquanto X, Y" is simultaneity (both asserted), not a condition.
  const whileClause=cond?.[0]==='enquanto';
  if(cond){const c=t.findIndex(x=>x.w===',');if(c>0){condEnd=c;condition={start:t[0].a,end:t[c-1].b,text:script.slice(t[0].a,t[c-1].b)};}}
  let lastSubject:Ante|null=null,lastObject:Ante|null=null,region:string|undefined,prevQuantity:MechRef|null=null,prevMaterial:MechRef|null=null,during:string|undefined;
  const resolve=(r:{ref:MechRef;fem:boolean|null;demonstrative:boolean}|null,isPron:boolean,fem:boolean|null,pl?:boolean):MechRef|null=>{
   const pool=[...here,...prevSubjects].filter(x=>x.ref.category!=='PROPERTY'&&x.ref.category!=='REGION'&&x.ref.category!=='TIME'&&x.ref.category!=='DISCOURSE');
   if(isPron){for(const scope of [here,prevSubjects]){const c=[...new Map(scope.filter(x=>pool.includes(x)&&(fem===null||x.fem===fem)&&(pl===undefined||x.pl==null||x.pl===pl)).map(x=>[x.ref.head,x])).values()];if(c.length===1)return{...c[0].ref,resolvedFrom:'PRONOUN'};if(c.length>1)return null;}return null;}
   if(r&&r.demonstrative){const same=pool.find(x=>x.ref.head===r.ref.head);return same?{...r.ref,resolvedFrom:'DEMONSTRATIVE'}:r.ref;}
   return r?.ref??null;};
  let pendingSub:{verb:typeof V[number];vi:number;state?:string}|null=null;
  while(k<t.length){
   // "Ao + infinitive X," → temporal subordinate whose subject is the next main clause's subject.
   if(t[k].w==='ao'&&t[k+1]&&/r$/.test(t[k+1].w)){const inf=t[k+1].w.slice(0,-1),vb=V.find(v=>v.re.test(inf)||v.re.test(inf.replace(/a$/,'e')));const comma=t.findIndex((x,i)=>i>k&&x.w===',');
    if(vb&&comma>k){const st=t.slice(k+2,comma).map(x=>x.w).find(w=>STATE_WORD.test(w));pendingSub={verb:vb,vi:k+1,...(st?{state:STATE_NORM(st)}:{})};k=comma+1;continue;}}
   // Time prefix "Durante X," → qualifier (never the subject).
   if(t[k].w==='durante'){const n=np(t,k+1,raw,base);if(n&&t[n.end]?.w===','){during='DURING:'+n.ref.head;k=n.end+1;continue;}}
   // Location prefix "Dentro da X," / "Na X," → region qualifier for the clause.
   const loc=/^(?:dentro|fora|atras|embaixo|em cima)$/.test(t[k].w)&&t[k+1]&&/^d[oa]s?$/.test(t[k+1].w)?np(t,k+2,raw,base):/^(?:na|no|nas|nos)$/.test(t[k].w)?np(t,k+1,raw,base):null;
   if(loc&&t[loc.end]?.w===','){region=(t[k].w==='dentro'?'INSIDE:':'AT:')+loc.ref.head;k=loc.end+1;continue;}
   // find the next verb
   const isInf=(w:string)=>/r$/.test(w)&&V.some(v=>v.re.test(w.slice(0,-1))||v.re.test(w.slice(0,-2)+'e')||v.re.test(w.slice(0,-1)+'m'));
   let vi=-1,aspect:{verb:typeof V[number];kind:string}|null=null,passive:typeof V[number]|undefined,estaAt=-1;for(let j=k;j<t.length;j++){
    if(ASPECT.test(t[j].w)&&!(j>0&&/^(?:a|o|as|os)$/.test(t[j-1].w))){const a1=t[j+1]?.w==='a'?j+2:j+1,iv=t[a1]?innerVerb(t[a1].w):undefined;if(iv){aspect={verb:iv,kind:/^(?:continua|continuam|segue|seguem)$/.test(t[j].w)?'CONTINUE':'START'};vi=a1;break;}}
    if((isAuxE(j)||/^(?:sao|foi|foram)$/.test(t[j].w))&&t[j+1]){const pv=participleVerb(t[j+1].w);if(pv){passive=pv;vi=j+1;break;}}
    if(/^(?:esta|estao)$/.test(t[j].w)&&t[j+1]&&/^(?:ainda|dentro|fora|preso|presa|presos|presas|retido|retida|retidos|retidas)$/.test(t[j+1].w)){estaAt=j;vi=j;break;}
    if(/^(?:pode|podem|consegue|conseguem|deve|devem|poderia)$/.test(t[j].w)&&t[j+1]&&isInf(t[j+1].w)||t[j-1]&&/^(?:pode|podem|consegue|conseguem|deve|devem|poderia)$/.test(t[j-1].w)&&false){vi=j+1;break;}
    if(j>k&&(t[j].w===':'||t[j].w===';'||t[j].w===','&&t[j+1]&&/^(?:e|que|mas)$/.test(t[j+1].w)&&!isAuxE(j+1))){k=j+1;if(t[k]?.w==='e'&&!isAuxE(k)||t[k]?.w==='mas')k++;continue;}
    if(Boolean(verbOf(t[j].w))&&!(j>0&&/^(?:a|o|as|os|um|uma|esse|essa)$/.test(t[j-1].w)&&j>k)){vi=j;break;}if(t[j].w==='.'||t[j].w==='?')break;}
   if(vi<0)break;
   const vw=t[vi].w,verb=aspect?.verb??passive??(estaAt===vi?V.find(v=>v.lemma==='BECOME'):undefined)??verbOf(vw)??V.find(v=>v.re.test(vw.slice(0,-1))||v.re.test(vw.slice(0,-2)+'e')||v.re.test(vw.slice(0,-1)+'m'))!;
   // subject = NP between k and verb (skipping connectors); "que" → antecedent; pronoun → local antecedent
   let s=k;if(condEnd>=0&&vi>condEnd&&s<=condEnd)s=condEnd+1;while(s<vi&&(SKIP.test(t[s].w)||t[s].w===','||t[s].w===':'||t[s].w==='nao'||t[s].w==='que'&&t[s-1]?.w==='so'))s++;
   let negated=false,modality:MechRelation['modality']=condition&&vi<condEnd&&!whileClause?'CONDITIONAL':'ASSERTED';
   const pre=t.slice(Math.max(k,condEnd>=0&&vi>condEnd?condEnd+1:k),vi).map(x=>x.w);
   if(pre.includes('nao'))negated=true;if(pre.some(w=>/^(?:pode|podem|consegue|conseguem|deve|devem|poderia)$/.test(w)))modality='POSSIBLE';
   let subject:MechRef|null=null,subjFem:boolean|null=null,subjPl:boolean|null=null;
   const firstW=t[s]?.w;
   if(firstW==='que'&&lastObject){subject={...lastObject.ref,resolvedFrom:'RELATIVE'};subjFem=lastObject.fem;}
   else if(firstW==='que'&&seen.length&&seen.at(-1)!.endTok===t[s-1]){const a=seen.filter(x=>x.endTok===t[s-1]).at(0)!;subject={...a.ref,resolvedFrom:'RELATIVE'};subjFem=a.fem;}
   else if(firstW&&PRON.test(firstW)){subjFem=/^ela/.test(firstW);subject=resolve(null,true,subjFem,/s$/.test(firstW));if(!subject)subject={text:raw.slice(t[s].a-base,t[s].b-base),start:t[s].a,end:t[s].b,head:null,category:null,resolvedFrom:'UNKNOWN'};}
   else if(s<vi&&!/^(?:ao|ate)$/.test(firstW)){const n=note(np(t,s,raw,base),t);if(n){subject=resolve(n,false,n.fem);subjFem=n.fem;subjPl=n.pl;}}
   else if(firstW==='ao'&&lastSubject){subject=lastSubject.ref;subjFem=lastSubject.fem;}
   if(!subject&&lastSubject&&s>=vi){subject=lastSubject.ref;subjFem=lastSubject.fem;} // coordination: "X fica quente e vai…"
   // "Ao + infinitive" is a temporal subordinate: its subject is the main clause's subject (next clause).
   // complements after the verb up to the next clause boundary
   const verbAhead=(i:number)=>{for(let q=i;q<Math.min(t.length,i+5);q++){if(/^[,.;?!]$/.test(t[q].w))return false;if(V.some(v=>v.re.test(t[q].w))&&!/^(?:a|o|as|os|um|uma)$/.test(t[q-1]?.w??''))return true;}return false;};
   let j=vi+1,end=j;while(end<t.length&&!/^[.;?!]$/.test(t[end].w)&&end!==condEnd&&t[end].w!=='enquanto'&&!(t[end].w==='que'&&end>j)&&!(t[end].w==='e'&&!isAuxE(end+1)&&verbAhead(end+1))&&!(t[end].w==='e'&&(isAuxE(end+1)||t[end+1]?.w==='se'&&Boolean(verbOf(t[end+2]?.w??''))))&&!(t[end].w===','&&t[end+1]&&(t[end+1].w==='que'||t[end+1].w==='e'||verbAhead(end+1)))&&!(t[end].w==='e'&&t[end+1]&&(V.some(v=>v.re.test(t[end+1].w))||PRON.test(t[end+1].w)||t[end+1].w===',')))end++;
   const comp=t.slice(j,end);
   const rel:MechRelation={id:'',sentenceId:seg.id,type:verb.type,lemma:verb.lemma,span:{start:t[s<vi?s:vi].a,end:t[Math.max(vi,end-1)].b,text:''},subject,predicate:{start:t[vi].a,end:t[vi].b,text:raw.slice(t[vi].a-base,t[vi].b-base)},negated,modality,qualifiers:[],...(condition&&modality==='ASSERTED'?{condition}:{})};
   if(region)rel.qualifiers.push(region);if(during)rel.qualifiers.push(during);if(aspect)rel.qualifiers.push('ASPECT:'+aspect.kind);if(passive)rel.qualifiers.push('PASSIVE');if(whileClause&&vi<condEnd)rel.qualifiers.push('WHILE');if(t[k-1]?.w==='enquanto'||t[s-1]?.w==='enquanto')rel.qualifiers.push('WHILE');
   if(firstW==='ao')rel.qualifiers.push('TEMPORAL_SUBORDINATE');
   // "volta a ser X" = state change back to X
   let c=0;if(verb.lemma==='RETURN'&&comp[0]?.w==='a'&&comp[1]?.w==='ser'){rel.type='STATE_CHANGE';rel.lemma='RETURN_TO_STATE';c=2;}
   const aspectual=verb.lemma==='RETURN'&&comp[0]?.w==='a'&&comp[1]&&comp[1].w!=='ser'&&(comp[1].w==='se'||/r$/.test(comp[1].w));
   const c0=c;
   const take=(i:number)=>note(np(comp as Tok[],i,raw,base),comp as Tok[]);let insideRef:MechRef|null=null,atRef:MechRef|null=null;
   while(c<comp.length){const w=comp[c].w;
    // "fica pressionado contra X": contact of the subject with a surface.
    if(c===c0&&rel.lemma==='BECOME'&&CONTACT_PART.test(w)){rel.type='CONTACT';rel.lemma='PRESS_AGAINST';c++;continue;}
    // "atravessa X": a transitive crossing — the noun phrase right after the verb is what is crossed (never a destination).
    if(c===c0&&/^atravess/.test(vw)&&DET.test(w)){const n=take(c);if(n){rel.object=n.ref;if(n.owner)rel.propertyOwner=n.owner;c=n.end;continue;}}
    // "sem + verb" ("sem parar") is manner, never a participant.
    if(w==='sem'&&comp[c+1]){rel.qualifiers.push('MANNER:sem '+comp[c+1].w);c+=2;continue;}
    if(w==='contra'){const n=take(c+1);if(n){rel.destination=n.ref;if(n.owner)rel.propertyOwner=n.owner;c=n.end;continue;}}
    // "cada vez mais/menos (rápido)": a stated trend of the action.
    if(w==='cada'&&comp[c+1]?.w==='vez'&&/^(?:mais|menos)$/.test(comp[c+2]?.w??'')){rel.qualifiers.push(comp[c+2].w==='mais'?'INCREASING':'DECREASING');c+=3+(comp[c+3]&&ADVERB.test(comp[c+3].w)?1:0);continue;}
    // "ao redor de X" / "em volta de X" / "em torno de X": the subject surrounds X ("dele/dela" → local antecedent).
    if((w==='ao'&&comp[c+1]?.w==='redor'||w==='em'&&/^(?:volta|torno)$/.test(comp[c+1]?.w??''))&&comp[c+2]){const d=comp[c+2].w,pr=/^(?:dele|dela|deles|delas)$/.exec(d);
     let inner:MechRef|null=null,next=c+3;if(pr){const fem=/a/.test(d.slice(3,4)),pl=/s$/.test(d),cand=seen.filter(x=>x.ref.head!==subject?.head&&x.ref.category!=='REGION'&&x.ref.category!=='MATERIAL'&&(x.fem===null||x.fem===fem)&&(x.pl==null||x.pl===pl));const u1=[...new Map(cand.map(x=>[x.ref.head,x])).values()];if(u1.length)inner={...u1.at(-1)!.ref,resolvedFrom:u1.length===1?'LOCAL_PRONOUN':'LOCAL_PRONOUN_NEAREST'};}
     else if(/^d(?:e|o|a|os|as)$/.test(d)){const n=take(c+3);if(n){inner=n.ref;next=n.end;}}
     if(inner&&rel.lemma==='BECOME'){rel.type='CONTAIN';rel.lemma='SURROUND';rel.object=inner;c=next;continue;}}
    // "para a parte externa/interna do X", "para fora/dentro do X": a region of X (side of its boundary).
    if(/^(?:para|pra)$/.test(w)){let q=c+1;if(/^(?:a|o)$/.test(comp[q]?.w??''))q++;let reg:string|null=null;
     if(comp[q]?.w==='parte'&&/^(?:externa|exterior|interna|interior|de)$/.test(comp[q+1]?.w??'')){const two=comp[q+1].w==='de';reg=/^(?:externa|exterior)$/.test(comp[q+1].w)||two&&comp[q+2]?.w==='fora'?'OUTSIDE':'INSIDE';q+=two?3:2;}
     else if(/^(?:fora|dentro)$/.test(comp[q]?.w??'')&&/^d(?:e|o|a|os|as)$/.test(comp[q+1]?.w??'')){reg=comp[q].w==='fora'?'OUTSIDE':'INSIDE';q+=1;}
     if(reg&&/^d(?:e|o|a|os|as)$/.test(comp[q]?.w??'')){const n=take(q+1);if(n){rel.destination={text:raw.slice(comp[c+1].a-base,n.ref.end-base),start:comp[c+1].a,end:n.ref.end,head:n.ref.head,category:'REGION',region:reg};c=n.end;continue;}}}
    if(/^(?:de|do|da|dos|das)$/.test(w)&&comp[c+1]?.w==='dentro'){rel.source={text:'dentro',start:comp[c+1].a,end:comp[c+1].b,head:'dentro',category:'REGION',region:'INSIDE'};c+=2;continue;}
    if(/^(?:para|pra)$/.test(w)&&comp[c+1]&&/^(?:cima|baixo|frente|tras)$/.test(comp[c+1].w)){rel.direction=({cima:'UP',baixo:'DOWN'} as Record<string,'UP'|'DOWN'>)[comp[c+1].w];rel.qualifiers.push('DIRECTION:'+comp[c+1].w);c+=2;continue;}
    if(/^(?:dentro|fora|atras|embaixo)$/.test(w)&&comp[c+1]&&/^d[oa]s?$/.test(comp[c+1].w)){const n=take(c+2);if(n){if(w==='dentro')insideRef=n.ref;rel.qualifiers.push((w==='dentro'?'INSIDE:':w==='fora'?'OUTSIDE:':w==='atras'?'BEHIND:':'BELOW:')+n.ref.head);c=n.end;continue;}}
    if(/^(?:de|do|da|dos|das)$/.test(w)&&rel.type==='MOVE'){const n=take(c+1);if(n){rel.source=n.ref;c=n.end;continue;}}
    if(/^(?:para|pra)$/.test(w)&&comp[c+1]&&/^(?:fora|dentro)$/.test(comp[c+1].w)){rel.destination={text:comp[c+1].w,start:comp[c+1].a,end:comp[c+1].b,head:comp[c+1].w,category:'REGION',region:comp[c+1].w==='fora'?'OUTSIDE':'INSIDE'};c+=2;continue;}
    if(/^(?:para|pra|ate|ao|aos|a)$/.test(w)&&(rel.type==='MOVE'||rel.type==='TRANSFER')){const n=take(c+1);if(n){rel.destination=n.ref;c=n.end;continue;}}
    if(w==='com'){const n=take(c+1);if(n){rel.qualifiers.push('WITH:'+n.ref.head);c=n.end;continue;}}
    if(w==='em'){let q=c+1;while(q<comp.length&&!/^(?:e|,)$/.test(comp[q].w))q++;rel.qualifiers.push('AT:'+raw.slice(comp[c+1]?.a-base,comp[q-1]?.b-base));c=q;continue;}
    if(/^(?:no|na|nos|nas)$/.test(w)){const n=take(c+1);if(n){if(rel.type==='MOVE'&&rel.lemma!=='PASS')rel.destination=n.ref;else{rel.qualifiers.push('AT:'+n.ref.head);if(n.ref.category==='PHYSICAL_ENTITY')atRef=n.ref;}c=n.end;continue;}}
    if(/^(?:por|pelo|pela|pelos|pelas|atraves)$/.test(w)){const n=take(c+1);if(n){if(rel.path)rel.qualifiers.push('VIA:'+n.ref.head);else rel.path=n.ref;c=n.end;continue;}}
    if(/^(?:de|do|da|dos|das)$/.test(w)&&rel.type==='TRANSFER'){const n=take(c+1);if(n){rel.source=n.ref.category==='REGION'?{...n.ref,region:'INSIDE'}:n.ref;c=n.end;continue;}}
    // A state word is the clause's state only right after the verb ("fica quente", "volta frio", "volta a ser líquido"), never a noun's adjective.
    if(STATE_WORD.test(w)&&c===c0&&(rel.type==='STATE_CHANGE'||rel.type==='MOVE')){rel.after=STATE_NORM(w);if(rel.type==='MOVE')rel.qualifiers.push('ARRIVES_'+STATE_NORM(w));c++;continue;}
    if(!rel.object&&DET.test(w)||!rel.object&&!/^(?:em|com|o|a)$/.test(w)&&/^[a-z]/.test(w)&&!V.some(v=>v.re.test(w))&&!STATE_WORD.test(w)){const n=take(c);if(n){if(n.ref.category==='TIME'){rel.qualifiers.push('DURATION:'+raw.slice(n.ref.start-base,(comp[n.end]?.a??n.ref.end)-base).replace(/[,:;\s]+$/,''));c=n.end;continue;}
     rel.object=n.ref;if(n.owner)rel.propertyOwner=n.owner;lastObject={ref:n.ref,fem:n.fem};if(n.owner){here.push({ref:n.owner,fem:n.ownerFem??null});if(n.ref.category==='PROPERTY'||n.ref.category==='QUANTITY')lastObject={ref:n.owner,fem:n.ownerFem??null};}c=n.end;continue;}}
    c++;}
   // Role-specific shaping (no new facts): quantities, properties, states and control results.
   // A passive action: the grammatical subject is the patient; without a stated agent nothing acts.
   if(passive&&rel.type==='ACTION'){if(rel.path&&subject){rel.object=subject;rel.subject=rel.path;delete rel.path;}else c=-1;}
   // "parte/metade da X": the participant is X, partially.
   if(rel.object&&PARTITIVE.test(rel.object.head??'')&&rel.propertyOwner){rel.object=rel.propertyOwner;delete rel.propertyOwner;rel.qualifiers.push('PARTIAL');}
   // "X deixa Y": X leaves Y (Y is the source); "deixa Y + infinitive" is causative, not a movement.
   if(rel.lemma==='LEAVE_FROM'){if(comp.some((x,i)=>i>0&&(/r$/.test(x.w)&&Boolean(verbOf(x.w.slice(0,-1)))||/(?:ad|id)(?:o|a|os|as)$/.test(x.w)||STATE_WORD.test(x.w))))c=-1;else if(rel.object){rel.source=rel.object;delete rel.object;rel.lemma='LEAVE';}else c=-1;}
   // "puxa a X da Y": the material comes from Y.
   if(rel.type==='ACTION'&&/^(?:PULL|PUSH)$/.test(rel.lemma)&&rel.object?.category==='MATERIAL'&&rel.propertyOwner&&!rel.source){rel.source=rel.propertyOwner;delete rel.propertyOwner;}
   // "X está/fica dentro da Y": Y contains X; "Y contém X": same relation, roles normalised (subject = content).
   // "X fica(m) no/na Y" (Y a physical thing, no state stated): X is located in Y.
   if(rel.lemma==='BECOME'&&!rel.after&&!insideRef&&atRef&&!rel.object&&subject&&subject.category!=='MATERIAL'&&subject.category!=='REGION')insideRef=atRef;
   if(rel.lemma==='BECOME'&&!rel.after&&insideRef&&!STATE_WORD.test(rel.object?.head??'')){rel.type='CONTAIN';rel.lemma='CONTAIN';rel.destination=insideRef;delete rel.object;}
   if(rel.lemma==='CONTAIN'&&verb.lemma==='CONTAIN'&&rel.object&&subject){rel.destination=subject;rel.subject=rel.object;delete rel.object;}
   if(rel.type==='CONTACT'&&!rel.destination)c=-1;
   if(rel.type==='TRANSFER'&&rel.object&&(rel.object.category==='QUANTITY'||rel.object.category==='MATERIAL')){rel.quantity=rel.object;delete rel.object;}
   // "absorve o calor da X" / "tira o calor da X": the quantity's owner is where it is taken from.
   if(rel.type==='TRANSFER'&&(rel.lemma==='ABSORB'||rel.lemma==='REMOVE')&&rel.quantity&&rel.propertyOwner&&!rel.source){rel.source=rel.propertyOwner;delete rel.propertyOwner;}
   if(rel.type==='MOVE'&&subject&&subject.category==='QUANTITY'){rel.type='TRANSFER';rel.quantity=subject;}
   if(rel.type==='MOVE'&&rel.destination?.category==='PROPERTY'&&subject){rel.type='PROPERTY_CHANGE';rel.property=rel.destination.head!;rel.propertyOwner=subject;rel.direction='REACH';rel.qualifiers.push('VALUE:'+rel.destination.text);delete rel.destination;}
   if(rel.type==='STATE_CHANGE'&&rel.object?.category==='PROPERTY'){rel.qualifiers.push('AT:'+rel.object.text);delete rel.object;}
   // "tira X … e joga para fora": the coordinated verb shares the object (local ellipsis, same sentence).
   if(rel.type==='TRANSFER'&&!rel.quantity&&!rel.object&&(prevQuantity??prevMaterial)&&s>=vi){rel.quantity=Object.assign({},(prevQuantity??prevMaterial) as MechRef,{resolvedFrom:'COORDINATION'});}
   if(rel.type==='MOVE'&&subject?.category==='PROPERTY'){rel.type='PROPERTY_CHANGE';rel.property=subject.head!;rel.direction='REACH';}
   if(rel.type==='PROPERTY_CHANGE'){if(subject?.category==='PROPERTY'){rel.property=subject.head!;rel.direction??=rel.lemma==='INCREASE'?'UP':'DOWN';}else if(rel.object?.category==='PROPERTY'){rel.property=rel.object.head!;rel.direction=rel.lemma==='INCREASE'?'UP':'DOWN';}else if(!rel.property){c=-1;}}
   if(rel.type==='STATE_CHANGE'){rel.after??=STATE_OF[rel.lemma]??(rel.object&&STATE_WORD.test(rel.object.head??'')?STATE_NORM(rel.object.head!):rel.object?.category==='MATERIAL'?STATE_NORM(rel.object.head!):undefined);if(rel.object?.category==='MATERIAL'&&rel.after===STATE_NORM(rel.object.head!))delete rel.object;}
   if(rel.type==='CONTROL')rel.resultState=RESULT[rel.lemma];
   // Pressing a control is not compressing a material.
   if(rel.lemma==='COMPRESS'&&rel.object&&rel.object.category!=='MATERIAL')rel.lemma='PRESS';
   // "entra ar no cano": with no subject before the verb, an arrival/entry verb takes the noun after it as subject.
   if(rel.type==='MOVE'&&s>=vi&&rel.object&&/^(?:ENTER|LEAVE|ARRIVE|FLOW|PASS)$/.test(rel.lemma)&&!(lastSubject&&s>=vi&&t[k-1]?.w==='e')&&!(lastSubject&&rel.object.category!=='MATERIAL')){rel.subject=rel.object;delete rel.object;}
   if(rel.type==='PROPERTY_CHANGE'){for(const x of ['source','destination'] as const)if(rel[x]){rel.qualifiers.push('VALUE:'+rel[x]!.text);delete rel[x];}}
   // Elliptical or non-physical participants ("a de trás", "tudo", "um pouco") cannot carry a relation.
   const bad=(x?:MechRef|null)=>Boolean(x&&(x.category==='REGION'||x.category==='DISCOURSE'||x.category==='TIME'));
   // A region may own a property ("o interior chega na temperatura certa").
   const usable=!aspectual&&!(bad(rel.subject)&&!(rel.type==='PROPERTY_CHANGE'&&rel.subject?.category==='REGION'))&&!(rel.type!=='CONTROL'&&rel.object&&rel.object.category==='REGION')&&c!==-1&&rel.subject&&!(rel.type==='STATE_CHANGE'&&!rel.after)&&!(rel.type==='PROPERTY_CHANGE'&&!rel.property)&&!(rel.type==='ACTION'&&!rel.object&&!rel.quantity&&rel.lemma!=='ROTATE')&&!(rel.type==='CONTAIN'&&!rel.destination&&!rel.object);
   rel.qualifiers=[...new Set(rel.qualifiers)];
   if(usable){rel.span.text=script.slice(rel.span.start,rel.span.end);rel.id='MR_'+seg.id+'_'+out.filter(r=>r.sentenceId===seg.id).length;out.push(JSON.parse(JSON.stringify(rel)) as MechRelation);
    if(pendingSub){const p=pendingSub,sub:MechRelation={id:rel.id+'_SUB',sentenceId:seg.id,type:p.verb.type,lemma:p.verb.lemma,span:{start:t[p.vi-1].a,end:t[p.vi].b,text:script.slice(t[p.vi-1].a,t[p.vi].b)},subject,predicate:{start:t[p.vi].a,end:t[p.vi].b,text:script.slice(t[p.vi].a,t[p.vi].b)},negated:false,modality:'ASSERTED',qualifiers:['TEMPORAL_SUBORDINATE'],...(p.state?{after:p.state}:{})};
     if(sub.type!=='STATE_CHANGE'||sub.after)out.splice(out.length-1,0,JSON.parse(JSON.stringify(sub)) as MechRelation);pendingSub=null;}}
   if(rel.quantity)prevQuantity=rel.quantity;if(rel.object?.category==='MATERIAL')prevMaterial=rel.object;
   if(subject&&subject.category!=='PROPERTY'){lastSubject={ref:subject,fem:subjFem,pl:firstW&&PRON.test(firstW)?/s$/.test(firstW):subjPl};if(!subject.resolvedFrom?.startsWith('REL'))here.push(lastSubject);}
   k=end+(t[end]?.w===','||t[end]?.w==='e'&&!isAuxE(end)?1:0);if(t[k]?.w==='e'&&!isAuxE(k))k++;
  }
  // Antecedents for the next sentence come from this sentence only (its subjects, or its leading noun phrase).
  if(!here.length){let q=0;while(t[q]&&(SKIP.test(t[q].w)||t[q].w===','))q++;const n=np(t,q,raw,base);if(n)here.push({ref:n.ref,fem:n.fem,pl:n.pl});}
  prevSubjects=here;
 }
 return out;
}
/** Graph built only from admitted relations: nodes are participant heads (resolved), edges join participants of one relation. */
export function mechanismGraph(rel:MechRelation[]){
 const parts=(r:MechRelation)=>[r.subject,r.object,r.quantity,r.source,r.destination,r.path,r.propertyOwner].filter((x):x is MechRef=>Boolean(x&&x.head&&x.category!=='REGION'&&x.category!=='TIME'&&x.category!=='DISCOURSE')).map(x=>x.head!);
 const admitted=rel.filter(r=>!r.negated&&r.modality!=='POSSIBLE');
 const connected=admitted.filter(r=>admitted.some(o=>o!==r&&parts(o).some(p=>parts(r).includes(p))));
 // longest chain in text order where consecutive relations share a participant
 const best=admitted.map(()=>1);for(let i=0;i<admitted.length;i++)for(let j=0;j<i;j++)if(parts(admitted[j]).some(p=>parts(admitted[i]).includes(p)))best[i]=Math.max(best[i],best[j]+1);
 const count=(t:MechType)=>admitted.filter(r=>r.type===t).length;
 return{relations:admitted.length,connectedRelations:connected.length,longestConnectedChain:Math.max(0,...best),stateChanges:count('STATE_CHANGE'),transfers:count('TRANSFER'),moves:count('MOVE'),propertyChanges:count('PROPERTY_CHANGE'),controlActions:count('CONTROL'),actions:count('ACTION'),nodes:[...new Set(admitted.flatMap(parts))]};
}
