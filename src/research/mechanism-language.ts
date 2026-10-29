import {modalityOf} from '../semantics/predicates';
import {normalize} from '../semantics/normalize';
import type {Modality} from '../semantics/contracts';
/** Closed bilingual grammar. Every pattern has an explicit verb/connector;
 * adjacency, article order and component co-occurrence never imply cause. */
export const mechanismRules: {predicate:string;pattern:string;reverse?:boolean;type?:'DEFINITION'|'RELATION'|'PROCESS'}[] = [
 {predicate:'HAS_GOAL',pattern:'(?:tem como objetivo|tem a finalidade de|has the goal of|aims to)'},
 {predicate:'ATTEMPTS',pattern:'(?:tenta|tentam|attempts? to|tries to)'},
 {predicate:'FAILS_BECAUSE',pattern:'(?:falha porque|falha devido a|fails because|fails due to)'},
 {predicate:'REQUIRES',pattern:'(?:requer|requerem|necessita de|necessitam de|requires?|needs?)'},
 {predicate:'SOLVES',pattern:'(?:resolve|resolvem|soluciona|solucionam|solves?|remedies)'},
 {predicate:'PREVENTS',pattern:'(?:evita|evitam|impede|impedem|prevents?|stops?)'},
 {predicate:'ENABLES',pattern:'(?:permite|permitem|possibilita|possibilitam|allows?|enables?)'},
 {predicate:'USED_FOR',pattern:'(?:e usado para|e usada para|sao usados para|sao usadas para|serve para|servem para|is used to|are used to|serves to|serve to)'},
 {predicate:'USED_FOR',pattern:'(?:(?:e|sao) (?:[a-z]+ ){0,3}projetad[oa]s?(?: especificamente)? para|(?:is|are) (?:[a-z]+ ){0,3}designed (?:specifically )?to)'},
 {predicate:'CAUSED_BY',pattern:'(?:ocorre devido a|ocorrem devido a|acontece devido a|ocorre por causa de|ocorre porque|acontece porque|occurs because of|happens because of|occurs due to|happens due to|occurs because|happens because)'},
 {predicate:'CAUSES',pattern:'(?:causa|causam|provoca|provocam|resulta em|resultam em|causes?|results? in)'},
 {predicate:'CONTAINS',pattern:'(?:contem|contem-se|inclui|incluem|consiste em|consistem em|e composto de|e composta de|contains?|includes?|consists? of)'},
 {predicate:'LOCATED_IN',pattern:'(?:esta dentro de|esta dentro do|esta dentro da|fica dentro de|is inside|is within)'},
 {predicate:'LOCATED_BELOW',pattern:'(?:esta abaixo de|esta abaixo do|fica abaixo de|is below|is beneath)'},
 {predicate:'LOCATED_ABOVE',pattern:'(?:esta acima de|esta acima do|fica acima de|is above)'},
 {predicate:'SURROUNDS',pattern:'(?:envolve|envolvem|circunda|circundam|surrounds?)'},
 {predicate:'TRANSFORM',pattern:'(?:e convertido em|e convertida em|se transforma em|transforma-se em|torna-se|is converted into|becomes?)',type:'PROCESS'},
 {predicate:'MOVE',pattern:'(?:(?:e movido|e movida|sao movidos|sao movidas) (?:por|pelo|pela|pelos|pelas)|is moved by|are moved by)',reverse:true,type:'PROCESS'},
 {predicate:'DRIVES',pattern:'(?:e acionado por|e acionada por|is driven by|are driven by)',reverse:true,type:'PROCESS'},
 {predicate:'ROTATE',pattern:'(?:e girado por|e girada por|is rotated by|are rotated by)',reverse:true,type:'PROCESS'},
 {predicate:'COMPRESS',pattern:'(?:e comprimido por|e comprimida por|is compressed by|are compressed by)',reverse:true,type:'PROCESS'},
 {predicate:'PUSH',pattern:'(?:e empurrado por|e empurrada por|is pushed by|are pushed by)',reverse:true,type:'PROCESS'},
 {predicate:'FLOW',pattern:'(?:flui|fluem|escoa|escoam|circula|circulam|flows?|circulates?)',type:'PROCESS'},
 {predicate:'MOVE',pattern:'(?:move|movem|movimenta|movimentam|moves?)',type:'PROCESS'},
 {predicate:'ENTER',pattern:'(?:entra|entram|enters?)',type:'PROCESS'},
 {predicate:'EXIT',pattern:'(?:sai|saem|leaves?|exits?)',type:'PROCESS'},
 {predicate:'OPEN',pattern:'(?:abre|abrem|opens?|abrir)',type:'PROCESS'},
 {predicate:'CLOSE',pattern:'(?:fecha|fecham|closes?|fechar)',type:'PROCESS'},
 {predicate:'RISE',pattern:'(?:sobe|sobem|rises?)',type:'PROCESS'},
 {predicate:'DESCEND',pattern:'(?:desce|descem|descends?)',type:'PROCESS'},
 {predicate:'DRIVES',pattern:'(?:aciona|acionam|drives?)',type:'PROCESS'},
 {predicate:'ROTATE',pattern:'(?:gira|giram|rotaciona|rotacionam|rotates?|turns?)',type:'PROCESS'},
 {predicate:'COMPRESS',pattern:'(?:comprime|comprimem|compresses?|compress)',type:'PROCESS'},
 {predicate:'PUSH',pattern:'(?:empurra|empurram|impulsiona|impulsionam|pushes?|push)',type:'PROCESS'},
 {predicate:'PASSES_THROUGH',pattern:'(?:passa por|passam por|passa atraves de|passes? through)',type:'PROCESS'},
 {predicate:'OUTPUTS',pattern:'(?:produz|produzem|outputs?|produces?)',type:'PROCESS'},
 {predicate:'COLLECT',pattern:'(?:(?:e|sao) captad[oa]s?|is collected|are collected)',type:'PROCESS'},
 {predicate:'FLOW',pattern:'(?:(?:e|sao) levad[oa]s? (?:atraves de|por)|is carried through|are carried through)',type:'PROCESS'},
 {predicate:'TRANSFORM',pattern:'(?:(?:e|sao) transformad[oa]s? em|is transformed into|are transformed into)',type:'PROCESS'},
 {predicate:'TRANSFORM',pattern:'(?:converte|convertem|converts?|transforma|transformam|transforms?)',type:'PROCESS'},
 {predicate:'IS_A',pattern:'(?:e|sao|is|are)',type:'DEFINITION'},
];
export const negativeMechanism = /\b(?:nao|nunca|jamais|nem|not|never|neither|cannot|cant|doesnt|isnt|arent|dont|wouldnt|couldnt|shouldnt|mustnt|wasnt|werent|hasnt|havent|wont)\b|\b(?:fails? to|failed to|falha em|deixa de)\b/;
export const unsafeMechanism = /\?|\b(?:ignore|instrucoes|prompt|inventad[oa]|fictional|imaginary|historicamente|inventado|inventada|invented|historically)\b/;
export function mechanismModality(text:string):Modality {
 const t=normalize(text),m=modalityOf(text);
 if(m!=='ASSERTED')return m;
 return /\b(?:would|could|se|if|without|sem)\b/.test(t)?'HYPOTHETICAL':/\b(?:can|may|might)\b/.test(t)?'POSSIBLE':/\b(?:usually|sometimes|typically|under certain conditions|geralmente|normalmente|as vezes|sob certas condicoes)\b/.test(t)?'UNCERTAIN':'ASSERTED';
}
export const mechanismPronoun=/^(?:it|this|that|they|he|she|ele|ela|eles|elas|isso|isto|esse|essa)(?:\s|$)/;
export const processSection=/^(?:[\d. ]*)?(?:funcionamento|operacao|principios?|principio de funcionamento|estrutura|componentes|etapas|processo|mecanismo|construcao|problemas|falhas|operation|principles?|working principle|structure|components|stages|process|mechanism|construction|problems|failures)$/;
