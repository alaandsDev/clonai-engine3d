import type {ContentIntent} from './contracts';
/** Closed, auditable PT/EN signal tables. Patterns run on accent-folded,
 * lowercase text. They are generic linguistic cues and broad domain
 * vocabularies; none encodes a specific benchmark topic or expected route.
 * Domain lexicons are deliberately wide classes (any animal, any machine, any
 * astronomical body), so a member term never selects a route by itself. */
export interface SignalRule {id:string;intent:ContentIntent|null;feature:string;pattern:RegExp}
const words=(forms:string)=>new RegExp('(?<![a-z0-9])(?:'+forms+')(?![a-z0-9])','g');
export const NUMBER_WORDS:Record<string,number>={um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,quinze:15,vinte:20,cem:100,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,twelve:12,fifteen:15,twenty:20};
const NUM='\\d{1,3}|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|quinze|vinte|cem|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty';
export const LEXICON={
 TECHNICAL:'motor(?:es)?|maquinas?|turbinas?|bombas? (?:d.agua|hidraulica)|circuitos?|computador(?:es)?|processador(?:es)?|chips?|baterias?|engrenage(?:m|ns)|valvulas?|sensor(?:es)?|avi(?:ao|oes)|foguetes?|helicopteros?|satelites?|radios?|televis(?:ao|oes)|celular(?:es)?|smartphones?|internet|wi-?fi|gps|pocos?|pontes?|barrage(?:m|ns)|represas?|usinas?|reator(?:es)?|elevador(?:es)?|freios?|impressoras?|geladeiras?|refrigerador(?:es)?|ar.condicionado|paineis solares|painel solar|hidreletricas?|hidraulic[oa]s?|eletric[oa]s?|mecanic[oa]s?|dispositivos?|aparelhos?|equipamentos?|ferramentas?|microondas|lampadas?|encanamentos?|tubulac(?:ao|oes)|caixa d.agua|engines?|machines?|turbines?|pumps?|circuits?|computers?|batter(?:y|ies)|valves?|sensors?|airplanes?|aircraft|rockets?|satellites?|wells?|bridges?|dams?|elevators?|devices?|refrigerators?',
 SCIENTIFIC:'ceu|luz|luzes|cor|cores|atmosfera|gravidade|planetas?|luas?|sol|estrelas?|galaxias?|universo|buracos? negros?|atomos?|moleculas?|energia|calor|temperatura|ondas?|radiac(?:ao|oes)|eletricidade|magnetismo|ima|fisica|quimica|reac(?:ao|oes) quimicas?|oxigenio|agua|gelo|vapor|pressao|som|eclipses?|mares|terremotos?|vulc(?:ao|oes)|raios?|trov(?:ao|oes)|arco-iris|nuvens?|chuva|ventos?|orbitas?|cometas?|asteroides?|marte|jupiter|saturno|venus|mercurio|netuno|urano|espaco|espacial|ciencia|cientific[oa]s?|sky|light|colou?rs?|atmosphere|gravity|planets?|moons?|sun|stars?|galax(?:y|ies)|black holes?|atoms?|molecules?|energy|heat|waves?|radiation|physics|chemistry|water|ice|pressure|sound|tides?|volcano(?:es)?|earthquakes?|orbits?|mars|space',
 BIOLOGICAL:'animal|animais|bichos?|especies?|plantas?|arvores?|flor(?:es)?|fungos?|bacterias?|virus|celulas?|organismos?|corpo humano|pele|sangue|cora(?:cao|coes)|cerebros?|musculos?|ossos?|dna|genes?|genetica|evoluc(?:ao)|fotossintese|digestao|respirac(?:ao)|reproduc(?:ao)|predador(?:es)?|mamiferos?|aves?|passaros?|peixes?|insetos?|repteis|reptil|anfibios?|moluscos?|cefalopodes?|polvos?|lulas?|camale(?:ao|oes)|abelhas?|formigas?|borboletas?|aranhas?|baleias?|golfinhos?|tubar(?:ao|oes)|le(?:ao|oes)|tigres?|elefantes?|girafas?|cobras?|sapos?|cachorros?|c(?:ao|aes)|gatos?|cavalos?|vacas?|morcegos?|vagalumes?|corujas?|pinguins?|ursos?|lobos?|macacos?|crocodilos?|tartarugas?|caracois|caracol|minhocas?|mosquitos?|animals?|species|plants?|trees?|cells?|organisms?|blood|hearts?|brains?|evolution|photosynthesis|octopus(?:es)?|squids?|chameleons?|bees?|ants?|whales?|dolphins?|sharks?|birds?|fish(?:es)?|insects?|dogs?|cats?|bats?|fireflies',
 GEOGRAPHIC:'lugar(?:es)?|locais|cidades?|vilas?|aldeias?|pais(?:es)?|regi(?:ao|oes)|continentes?|montanhas?|rios?|lagos?|desertos?|ilhas?|oceanos?|florestas?|polos?|territorios?|capitais|capital|habitantes|populac(?:ao|oes)|povoados?|assentamentos?|do mundo|no mundo|da terra|places?|city|cities|countr(?:y|ies)|regions?|continents?|mountains?|rivers?|deserts?|islands?|oceans?|towns?|villages?|inhabitants|population|in the world|on earth',
};
export const SIGNAL_RULES:SignalRule[]=[
 {id:'explain.how-works',intent:'EXPLANATION',feature:'functioning',pattern:words('como (?:e que )?funcion(?:a|am)|funcionamento|how (?:does|do) .{1,60}? work|how .{1,40}? works')},
 {id:'explain.definition',intent:'EXPLANATION',feature:'definition',pattern:words('o que (?:e|sao|significa)|what (?:is|are)|definic(?:ao)|significado')},
 {id:'explain.imperative',intent:'EXPLANATION',feature:'imperative-explain',pattern:words('expli(?:que|ca|car)|entenda|descreva|mostre como|explain|describe')},
 {id:'explain.why',intent:'EXPLANATION',feature:'why',pattern:words('por ?que|por qual motivo|por qual razao|why')},
 {id:'process.mechanism',intent:'PROCESS',feature:'process',pattern:words('processo|etapas?|passo a passo|mecanismo|funcion(?:a|am)|funcionamento|process|steps|mechanism|works?')},
 {id:'process.ability',intent:'PROCESS',feature:'manner-change',pattern:words('como (?:(?:um|uma|o|a|os|as) )?(?:[a-z]+ ){1,5}consegue(?:m)? [a-z]+|how (?:can|does|do) (?:[a-z]+ ){1,5}(?:cool|heat|move|compress|rotate|filter|lift)')},
 {id:'process.manner-change',intent:'PROCESS',feature:'manner-change',pattern:words('(?:como|how) (?:(?:e que|que|os|as|o|a|um|uma|the|do|does) )*(?:[a-z]+ ){0,3}(?:mud(?:a|am)|alter(?:a|am)|transform(?:a|am)|vir(?:a|am)|convert(?:e|em)|produz(?:em)?|ger(?:a|am)|form(?:a|am)|cri(?:a|am)|cresc(?:e|em)|vo(?:a|am)|respir(?:a|am)|enxerg(?:a|am)|se formam?|change|changes|turn|turns|produce|produces|form|forms|grow|grows|fly|flies)')},
 {id:'cause.markers',intent:'CAUSE_EFFECT',feature:'causal',pattern:words('por ?que|causas?|causam|efeitos?|consequencias?|leva a|provoca|resulta em|why|causes?|effects?|consequences?|leads? to')},
 {id:'cause.state-change',intent:'CAUSE_EFFECT',feature:'state-change',pattern:words('mud(?:a|am) de|alter(?:a|am)|transform(?:a|am)|change(?:s)? (?:its |their )?colou?r|change(?:s)?')},
 {id:'hypothetical.what-would',intent:'HYPOTHETICAL',feature:'counterfactual',pattern:words('o que aconteceria|o que seria|e se|what would happen|what if|imagine se|suponha que|supondo que')},
 {id:'hypothetical.conditional',intent:null,feature:'conditional',pattern:words('[a-z]{2,}(?:aria|eria|iria)m?|would')},
 {id:'hypothetical.subjunctive',intent:null,feature:'subjunctive',pattern:words('se (?:[a-z]+ ){0,4}[a-z]{3,}(?:asse|esse|isse)m?|if .{1,60}? (?:disappeared|vanished|stopped|were)')},
 {id:'ranking.superlative-count',intent:'RANKING',feature:'superlative',pattern:words('(?:'+NUM+') (?:[a-z]+ ){0,4}(?:mais|menos) [a-z]+|(?:'+NUM+') (?:[a-z]+ ){0,3}[a-z]+est|top (?:'+NUM+')')},
 {id:'ranking.superlative-world',intent:'RANKING',feature:'superlative',pattern:words('(?:o|a|os|as) (?:[a-z]+ ){0,2}(?:mais|menos) [a-z]+ (?:do|da|de todo o) (?:mundo|planeta|pais|brasil)|(?:maiores|menores|melhores|piores) (?:[a-z]+ ){0,3}(?:do|da) (?:mundo|planeta)|ranking|the (?:[a-z]+ )?(?:most|least) [a-z]+|the [a-z]+est [a-z]+ (?:in|on) (?:the world|earth)')},
 {id:'comparison.markers',intent:'COMPARISON',feature:'pairwise',pattern:words('versus|vs\\.?|compar(?:e|ar|acao|ado|ada)|diferencas? entre|qual (?:e )?(?:melhor|pior|maior|menor)|mais [a-z]+ (?:do )?que|menos [a-z]+ (?:do )?que|difference between|compared? (?:to|with)|better than|worse than')},
 {id:'list.enumeration',intent:'LIST',feature:'list',pattern:words('(?:'+NUM+') (?:curiosidades|fatos|coisas|exemplos|tipos|motivos|razoes|dicas|formas|maneiras|facts|things|examples|types|reasons|ways)|lista de|tipos de|exemplos de|list of|types of')},
 {id:'myth.check',intent:'MYTH_CHECK',feature:'myth',pattern:words('mitos?|e verdade|verdade que|fato ou (?:mito|fake)|lenda urbana|myths?|is it true|true or false')},
 {id:'history.origin',intent:'HISTORICAL',feature:'past-origin',pattern:words('como (?:(?:foi que|que) )?(?:comecou|surgiu|nasceu|terminou|acabou|aconteceu|ocorreu)|comecou|surgiu|terminou|foi (?:criad|inventad|descobert|construid|fundad)[oa]s?|inventou|descobriu|fundou|origem d[oa]s?|inicio d[oa]s?|historia d[oa]s?|how did|began|started|was (?:invented|discovered|founded|built)|history of|origin of')},
 {id:'history.period',intent:'HISTORICAL',feature:'period',pattern:words('seculos?|decadas?|antig(?:o|a|os|as)|medieval|imperios?|guerras?|revoluc(?:ao|oes)|batalhas?|tratados?|independencia|dinastias?|civilizac(?:ao|oes)|century|war|revolution|empire|ancient|medieval')},
 {id:'history.year',intent:null,feature:'year',pattern:/(?<![0-9])(?:1[0-9]{3}|20[0-9]{2})(?![0-9])/g},
 {id:'bio.person',intent:'BIOGRAPHICAL',feature:'person',pattern:words('quem (?:foi|era|e)|vida de|biografia|who (?:was|is)|life of|biography')},
 {id:'geo.residence',intent:'GEOGRAPHIC',feature:'residence',pattern:words('vivem|vive|moram|mora|habitam|residem|live|lives|inhabited')},
 {id:'geo.permanent',intent:null,feature:'permanent',pattern:words('permanentemente|permanentes?|o ano (?:todo|inteiro)|permanently|year-round|all year')},
 {id:'quantity.count',intent:null,feature:'quantity',pattern:words('numero de|quantidade de|total de|quantos|quantas|number of|how many|amount of')},
 {id:'quantity.population',intent:null,feature:'population',pattern:words('populac(?:ao|oes)|habitantes|censos?|recenseamentos?|recensead[oa]s?|population|census|inhabitants')},
 {id:'temporal.current',intent:null,feature:'current',pattern:words('atualmente|hoje(?: em dia)?|atuais?|currently|today|nowadays')},
 {id:'fiction.marker',intent:'FICTION',feature:'fiction-marker',pattern:words('era uma vez|conto|historia (?:sobre|de) (?:um|uma)|crie uma historia|conte uma historia|escreva uma historia|personage(?:m|ns)|ficc(?:ao)|ficticio|ficticia|once upon a time|fictional|story about|write a story|tell a story')},
 {id:'fiction.premise-verb',intent:null,feature:'narrative-verb',pattern:words('acorda|desperta|encontra|descobre|chega|decide|recebe|perde|viaja|entra|foge|sonha|aparece|percebe|enfrenta|tenta|wakes(?: up)?|finds|discovers|arrives|decides|receives|travels|escapes')},
 {id:'fiction.indefinite-protagonist',intent:null,feature:'indefinite-start',pattern:/^(?:um|uma|certo|certa|an) [a-z]+/g},
 {id:'question.interrogative',intent:null,feature:'interrogative',pattern:/^(?:como|por ?que|o que|qual|quais|quem|quando|onde|quanto|quantos|quantas|e se|how|why|what|which|who|when|where|is|are|does|do|can)(?![a-z])/g},
 {id:'negation',intent:null,feature:'negation',pattern:words('nao|nunca|jamais|nem|not|never')},
 {id:'domain.technical',intent:'TECHNICAL',feature:'domain',pattern:words(LEXICON.TECHNICAL)},
 {id:'domain.scientific',intent:'SCIENTIFIC',feature:'domain',pattern:words(LEXICON.SCIENTIFIC)},
 {id:'domain.biological',intent:'BIOLOGICAL',feature:'domain',pattern:words(LEXICON.BIOLOGICAL)},
 {id:'domain.geographic',intent:'GEOGRAPHIC',feature:'domain',pattern:words(LEXICON.GEOGRAPHIC)},
];
/** Superlative dimension → Research metric. Only metrics Research already
 * models are mapped; others stay null and block the ranking route explicitly. */
export const SUPERLATIVE_DIMENSIONS:{id:string;pattern:RegExp;metric:'TEMPERATURE'|'POPULATION'|null;qualifier:string|null;direction:'MOST'|'LEAST'}[]=[
 {id:'COLDNESS',pattern:words('(?:mais|most) (?:fri[oa]s?|gelad[oa]s?|cold)|coldest|frigid'),metric:'TEMPERATURE',qualifier:'MINIMUM_RECORDED',direction:'LEAST'},
 {id:'HEAT',pattern:words('(?:mais|most) (?:quentes?|calorent[oa]s?|hot)|hottest'),metric:'TEMPERATURE',qualifier:'MAXIMUM_RECORDED',direction:'MOST'},
 {id:'POPULATION',pattern:words('(?:mais|most) (?:populos[oa]s?|habitad[oa]s?|populous)|most populated'),metric:'POPULATION',qualifier:null,direction:'MOST'},
 {id:'SIZE',pattern:words('maiores|menores|(?:mais|most) (?:alt[oa]s?|grandes?|extens[oa]s?|tall|large)|tallest|largest|biggest|smallest'),metric:null,qualifier:null,direction:'MOST'},
 {id:'QUALITY',pattern:words('melhores|piores|best|worst'),metric:null,qualifier:null,direction:'MOST'},
];
export const countOf=(text:string):number|null=>{const m=text.match(new RegExp('(?<![a-z0-9])(?:top )?('+NUM+')(?![a-z0-9])'));if(!m)return null;const v=/^\d+$/.test(m[1])?Number(m[1]):NUMBER_WORDS[m[1]];return Number.isInteger(v)&&v>0&&v<=20?v:null;};
export const PT_FUNCTION=words('o|a|os|as|um|uma|de|do|da|dos|das|em|no|na|que|como|por|para|se|e|com');
export const EN_FUNCTION=words('the|an|of|in|on|how|why|what|if|and|with|does|is|are|to|that|has|have|up|was|for|his|her|its|it');
