import type { EntityType, PredicateName } from './contracts';
export const referenceWindow = 2;
export const confidenceWeights = { textualEvidence: .2, explicitPredicate: .3, clearSubject: .25, clearObject: .1, quantity: .15, highReference: .12, mediumReference: -.12, unknownSubject: -.35, ambiguousReference: -.6, unsupportedPredicate: -.35 };
export const confidenceThresholds = { HIGH: .75, MEDIUM: .5 };
export const entityRules: {
    pattern: string;
    name: string;
    type: EntityType;
    gender: 'M' | 'F';
    tags: string[];
}[] = [
    { pattern: 'caixa d[’\u0027]agua|reservatorio(?: inferior| superior)?|recipiente|caixa(?: inferior| superior)?', name: 'container', type: 'OBJECT', gender: 'M', tags: ['container'] },
    { pattern: 'agua|liquido', name: 'water', type: 'SUBSTANCE', gender: 'F', tags: ['liquid'] },
    { pattern: 'tubulacao|tubo', name: 'pipe', type: 'OBJECT', gender: 'M', tags: ['path'] },
    { pattern: 'carro(?: (?:azul|vermelho|branco|preto|a|b))?|veiculo(?: (?:azul|vermelho|branco|preto|a|b))?', name: 'vehicle', type: 'OBJECT', gender: 'M', tags: ['vehicle', 'freezable'] },
    { pattern: 'gelo', name: 'ice', type: 'SUBSTANCE', gender: 'M', tags: ['ice'] },
    { pattern: 'temperatura', name: 'temperature', type: 'MEASUREMENT', gender: 'F', tags: ['temperature'] },
    { pattern: 'nivel', name: 'level', type: 'MEASUREMENT', gender: 'M', tags: ['level'] },
    { pattern: 'multidao(?: de pesquisadores)?|pesquisadores', name: 'researchers', type: 'GROUP', gender: 'M', tags: ['scientific_crowd'] },
    { pattern: 'equipamentos(?: cientificos)?(?: complexos)?', name: 'equipment', type: 'OBJECT', gender: 'M', tags: ['scientific_equipment'] },
    { pattern: 'estacao|cidade(?: [a-z])?|local|lugar|garagem', name: 'place', type: 'PLACE', gender: 'M', tags: ['place'] },
    { pattern: 'radio', name: 'radio', type: 'OBJECT', gender: 'M', tags: ['radio'] },
    { pattern: 'objeto', name: 'object', type: 'OBJECT', gender: 'M', tags: ['generic_object'] },
    { pattern: 'frio(?: extremo)?', name: 'cold', type: 'ENVIRONMENT', gender: 'M', tags: ['cold'] },
    { pattern: 'porta', name: 'door', type: 'OBJECT', gender: 'F', tags: ['door'] }
];
export const predicateRules: {
    name: PredicateName;
    pattern: string;
}[] = [
    { name: 'ACCUMULATE', pattern: '(?:comeca(?:r)?|comecou) a acumular|acumul(?:a|ar|ou|ando)' },
    { name: 'INCREASE', pattern: '(?:comeca|comecou) a aumentar|aument(?:ava|a|ar|ou)|cresce|fica maior' },
    { name: 'DECREASE', pattern: '(?:comeca|comecou) a diminuir|diminui(?:r|u)?|caiu|cair|cai' },
    { name: 'FREEZE', pattern: '(?:comeca|comecou) a congelar|congel(?:a|e|ar|ou|ado|ada)' },
    { name: 'MELT', pattern: 'derret(?:e|eu|er)' },
    { name: 'COVER', pattern: '(?:completamente )?cobert[oa]|cobr(?:e|ir|iu)' },
    { name: 'STORE', pattern: 'armazenad[oa]|armazena|guardad[oa]|guardar' },
    { name: 'FLOW', pattern: 'cheg(?:ava|a|ou|ar)|flui(?:r)?|percorre|passa' },
    { name: 'ENTER', pattern: 'entr(?:ava|a|ou|ar)' }, { name: 'EXIT', pattern: 'sai(?:a|u|r)?' },
    { name: 'RISE', pattern: '(?:precisa )?subir|sobe|subiu|subia' },
    { name: 'FALL', pattern: 'desce|desceu' }, { name: 'FILL', pattern: 'enche|ench(?:er|eu)' },
    { name: 'EMPTY', pattern: 'esvazia|esvaziou' }, { name: 'OPEN', pattern: 'abre|abriu|abrir' },
    { name: 'CLOSE', pattern: 'fecha|fechou' }, { name: 'CONNECT', pattern: 'conecta|liga|conectou' },
    { name: 'SEPARATE', pattern: 'separa|separou' }, { name: 'ROTATE', pattern: 'gira|girou' },
    { name: 'APPEAR', pattern: 'aparece|apareceu|surge' }, { name: 'DISAPPEAR', pattern: 'desaparece|sumiu' },
    { name: 'OPERATE', pattern: 'opera(?:va|m)?|operou|trabalham' },
    { name: 'COMPARE', pattern: 'mais fri[oa] que|mais rapid[oa] que|maior que|menor que|duas vezes|metade|dobro|triplo|versus' },
    { name: 'REVEAL', pattern: 'revela|revelou' }, { name: 'MOVE', pattern: 'move|moveu|colocou' },
    { name: 'HAS', pattern: 'tem|possui' }, { name: 'BECOME', pattern: 'torna-se' },
    { name: 'MEASURE', pattern: 'mediu|mede|registra(?:va)?' }, { name: 'IS', pattern: 'estava|esta|ficou|fica|expost[oa]|e' },
    { name: 'UNKNOWN', pattern: 'falhar|falhou|afirmou|afirma' }
];
export const causalMarkers = 'por isso|porque|faz com que|causa|provoca|devido a|como resultado';
export const temporalMarkers = 'antes|depois|em seguida|entao|quando|enquanto|ate|comeca|comecou|continua|termina';
