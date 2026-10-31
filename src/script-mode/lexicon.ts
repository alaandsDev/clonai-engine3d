import {mechanismRules} from '../research/mechanism-language';
/** Closed, generic (cross-domain) cue tables for Script Mode. They describe discourse, spatial and
 * mechanical language, never a topic: no benchmark nouns, script phrases or expected facts. */
export const DISCOURSE:{role:'GOAL'|'ATTEMPT'|'PROBLEM'|'CAUSE'|'SOLUTION'|'STATE_CHANGE'|'RESULT'|'TRANSITION';pattern:RegExp}[]=[
 {role:'GOAL',pattern:/\b(?:objetivo|meta|queremos|precisamos|goal|we want|we need)\b/},
 {role:'ATTEMPT',pattern:/\b(?:tenta|tentam|tentativa|tentar|primeira ideia|attempt|tries|try)\b/},
 {role:'PROBLEM',pattern:/\b(?:problema|problemas|porem|entretanto|problem|however|the catch)\b|\bmas existe\b/},
 {role:'CAUSE',pattern:/\b(?:porque|pois|devido a|por causa de|isso acontece|because|due to|this happens)\b/},
 {role:'SOLUTION',pattern:/\b(?:para resolver|solucao|resolve|resolver|to solve|to fix|solution|solves)\b/},
 {role:'STATE_CHANGE',pattern:/\b(?:agora|passa a|passam a|torna-se|tornam-se|from now|now|becomes|become|instalad[oa]s?|installed)\b/},
 {role:'RESULT',pattern:/^(?:assim|portanto|finalmente|no fim|resultado|so|thus|finally|in the end|as a result)\b/},
 {role:'TRANSITION',pattern:/^(?:mas|but|e entao|and then|agora veja|veja|olhe|look)\b/},
];
export const HYPOTHESIS=/^(?:e se|e quando|entao seria|seria so|sera que|e por que|what if|and if|suppose|imagine se)\b/;
export const CONDITIONAL=/\b\w{2,}(?:aria|eria|iria|ariam|eriam|iriam)\b|\b(?:would|could|might|poderia|poderiam)\b/;
export const NEGATION=/\b(?:nao|nunca|jamais|nem|not|never|no longer|nenhum|nenhuma)\b/;
export const ADDRESS=/\b(?:voce|voces|vc|you|your|imagine|veja|repare|olha)\b/;
/** Clause triggers: the shared mechanism lexicon (Phase26/28B) plus script-only state/transfer verbs. */
export const STATE_WORDS:Record<string,string>={aberto:'OPEN',aberta:'OPEN',abertos:'OPEN',abertas:'OPEN',open:'OPEN',fechado:'CLOSED',fechada:'CLOSED',fechados:'CLOSED',fechadas:'CLOSED',closed:'CLOSED',shut:'CLOSED',cheio:'FULL',cheia:'FULL',full:'FULL',vazio:'EMPTY',vazia:'EMPTY',empty:'EMPTY',ligado:'ON',ligada:'ON',on:'ON',desligado:'OFF',desligada:'OFF',off:'OFF',parado:'STOPPED',parada:'STOPPED',stopped:'STOPPED'};
const states=Object.keys(STATE_WORDS).join('|');
export const CLAUSE_RULES:{predicate:string;pattern:string}[]=[
 {predicate:'STATE',pattern:`(?:esta|estao|fica|ficam|permanece|permanecem|continua|continuam|is|are|stays?|remains?)(?: (?:agora|now|ainda|still|totalmente|fully))? (?:${states})`},
 {predicate:'TRANSFER',pattern:'(?:transfere|transferem|transmite|transmitem|transfers?|transmits?|passa a energia|passam a energia)'},
 {predicate:'ESCAPE',pattern:'(?:escaparia|escapariam|vazaria|vazariam|would escape|would leak|escapa|escapam|vaza|vazam|escapes?|leaks?)'},
 {predicate:'FILL',pattern:'(?:enche|enchem|encher|enchendo|fills?|filling)'},
 {predicate:'PULL',pattern:'(?:puxa|puxam|puxar|pulls?|suga|sugam|sucks?)'},
 {predicate:'DESCEND',pattern:'(?:despenca|despencam|cai|caem|falls?|drops?)'},
 {predicate:'ENTER',pattern:'(?:invade|invadem|invades?)'},
 {predicate:'FLOW',pattern:'(?:escorre|escorrem|jorra|jorram|drips?|trickles?|pours?)'},
 {predicate:'PASSES_THROUGH',pattern:'(?:passa pelo|passa pela|passa pelos|passa pelas|passam pelo|passam pela|passam pelos|passam pelas)'},
 {predicate:'DEFLECT',pattern:'(?:(?:e|sao|is|are) desviad[oa]s?|desvia|desviam|deflects?|is deflected|are deflected|mudar de direcao|muda de direcao|mudam de direcao|changes? direction)'},
 {predicate:'BALANCE',pattern:'(?:equilibra|equilibram|compensa|compensam|compense|compensem|balances?|counteracts?|offsets?)'},
 {predicate:'GENERATE',pattern:'(?:gera|geram|gerar|produzir|produz|produzem|generates?|produces?|creates?)'},
 {predicate:'RECEIVE',pattern:'(?:recebe|recebem|receives?|sofre|sofrem|experiences?)'},
 {predicate:'FLY',pattern:'(?:voa|voam|voar|flies|fly|flying|navega|navegam|sails?|trafega|trafegam)'},
 {predicate:'HEAT',pattern:'(?:aquece|aquecem|esquenta|esquentam|heats?|warms?)'},
 {predicate:'TURN_ON',pattern:'(?:liga|ligam|acende|acendem|turns? on|switch(?:es)? on|lights?)'},
 {predicate:'TURN_OFF',pattern:'(?:desliga|desligam|apaga|apagam|turns? off|switch(?:es)? off)'},
 {predicate:'BOIL',pattern:'(?:ferve|fervem|boils?)'},
 {predicate:'COOL',pattern:'(?:esfria|esfriam|cools? down|cools?)'},
 {predicate:'HAS',pattern:'(?:tem|possui|possuem|has|have)'},
 {predicate:'LOCATED',pattern:'(?:fica|ficam|existe|existem|sits?)'},
 {predicate:'BECOME',pattern:'(?:vira|viram|torna-se|tornam-se|se torna|se tornam|becomes?|turns into)'},
 {predicate:'OPEN',pattern:'(?:se abre|se abrem)'},
 {predicate:'CLOSE',pattern:'(?:se fecha|se fecham)'},
 {predicate:'ARRIVE',pattern:'(?:chega|chegam|arrives?|reaches?|alcanca|alcancam)'},
 {predicate:'COME',pattern:'(?:vem|vem de|comes? from|comes?)'},
 {predicate:'REMOVE',pattern:'(?:remove|removem|removesse|removessemos|removed|removing|tira|tiram|tirasse|tirassemos|retira|retiram|retirasse|retirassemos)'},
 {predicate:'EMPTY',pattern:'(?:esvazia|esvaziam|empties|drains?)'},
 {predicate:'MOVE',pattern:'(?:(?:e|sao|is|are) (?:conduzid[oa]s?|transportad[oa]s?|carried|transported|led))'},
 ...mechanismRules.filter(r=>r.predicate!=='IS_A'&&!r.reverse),
 {predicate:'IS_A',pattern:'(?:e um|e uma|sao|is a|is an|are)'},
];
export const ROUTE_MARKERS:{role:'SOURCE'|'PATH'|'DESTINATION';pattern:RegExp}[]=[
 {role:'SOURCE',pattern:/^(?:vindo de|vinda de|vindos de|vindas de|vindo do|vinda do|vindo da|vinda da|from|out of|desde)$/},
 {role:'PATH',pattern:/^(?:por|pelo|pela|pelos|pelas|atraves de|atraves do|atraves da|atraves dos|atraves das|through|via|along|ao longo de)$/},
 {role:'DESTINATION',pattern:/^(?:ate|para|into|to|toward|towards|rumo a|em direcao a|em direcao ao)$/},
];
export const CONNECTIVES=new Set(['que','which','who','quando','when','se','if','entao','then','mas','but','porque','because','pois','enquanto','while','depois','after','antes','before','e','and','onde','where','ate que','until']);
export const LEADING_FILLERS=/^(?:(?:agora|now|ainda|still|primeiro|first|at first|no inicio|inicialmente|initially|depois|then|entao|finalmente|finally|assim|so|tambem|also|ja|logo|em seguida|next)\s+)+/;
export const DETERMINERS=new Set(['o','a','os','as','um','uma','uns','umas','the','an','toda','todo','todas','todos','cada','each','every','pelos','pelas','numa','num','nuns','numas','this','that','these','those','esse','essa','este','esta','esses','essas','seu','sua','seus','suas','its','their','his','her','our','nosso','nossa','some','alguns','algumas','de','do','da','dos','das','of','no','na','nos','nas','em','in','on','at','com','with','por','pelo','pela','para','to','ate','atraves','from','vindo','vinda','into','through','via']);
export const QUANTIFIER_HEADS=/^(?:conjunto|set|serie|series|par|pair|grupo|group|tipo|type|parte|part)$/;
/** Entity role cue tables (generic mechanical/spatial vocabulary). */
export const FLUID=/^(?:agua|water|liquido|liquid|fluido|fluid|ar|air|escoamento|airflow|vento|wind|gas|oleo|oil|vapor|steam|fumaca|smoke|sangue|blood|combustivel|fuel)$/;
export const ABSTRACT=/^(?:energia|energy|pressao|pressure|forca|force|calor|heat|torque|velocidade|speed|movimento|motion|movement|potencia|power|temperatura|temperature|eletricidade|electricity|trabalho|work)$/;
export const ROTATING=/^(?:rotor|roda|wheel|engrenagem|gear|helice|propeller|eixo|shaft|axle|ventilador|fan|polia|pulley|manivela|crank)$/;
export const VANES=/^(?:lamina|blade|palheta|vane|pa|aleta|fin|bocal|nozzle|injector|injetor)$/;
export const GATE=/^(?:valvula|valve|comporta|gate|porta|door|registro|torneira|tap|faucet|tampa|lid|portao|escotilha|hatch)$/;
export const CONDUIT=/^(?:duto|tubo|cano|conduto|mangueira|tubulacao|pipe|tube|duct|hose|conduit|channel|calha)$/;
export const CONTAINER=/^(?:tanque|tank|reservatorio|reservoir|caixa|canal|lago|lake|rio|river|represa|dam|piscina|pool|balde|bucket|recipiente|container|bacia|basin|poco|well|cisterna|cistern|barragem)$/;
/** Closed-class words that can land in a noun slot (quantifiers, adverbs, negation): never a visual object. */
export const NON_NOMINAL=/^(?:tudo|nada|algo|todos|todas|junto|juntos|juntas|rapido|rapida|novo|nova|outra|outro|seguranca|segundo|segundos|minuto|minutos|hora|horas|vezes|safely|again|minute|minutes|second|seconds|hour|hours|pouco|pouca|muito|muita|completo|completa|parte|devagar|lento|lenta|dentro|fora|perto|longe|aqui|ali|la|sempre|nunca|vez|resto|nao|sim|everything|nothing|something|all|together|quickly|fast|slowly|inside|outside|here|there|always|never|rest|not|yes)$|\w{4,}mente$|\w{3,}ly$/;
/** Personal pronouns that may stand for the previous clause's subject. */
export const PRONOUN=/^(?:ele|ela|eles|elas|it|they)$/;
/** Verbs whose subject may follow them ("entra ar no cano"). */
export const INVERTIBLE=new Set(['ENTER','EXIT','FLOW','COME','ARRIVE','DESCEND','RISE','LOCATED','ESCAPE']);
/** Common physical objects (generic household/mechanical vocabulary) that have a recognizable generic shape. */
export const VESSEL=/^(?:panela|pot|chaleira|kettle|caneca|mug|copo|cup|jarra|jar|garrafa|bottle|frasco|flask|bule|teapot|caldeirao|cauldron|tigela|bowl|balde|bucket)$/;
export const HEAT=/^(?:fogo|chama|fire|flame|queimador|burner|fogao|stove|vela|candle|brasa|ember|aquecedor|heater|resistencia)$/;
export const LID=/^(?:tampa|lid|cover|tampo)$/;
export const PEG=/^(?:pino|pin|peso|weight|apito|whistle|botao|button|alavanca|lever|valvula|valve|registro)$/;
export const GAS=/^(?:vapor|steam|fumaca|smoke|gas)$/;
/** Vehicles by the medium they move through (generic transport vocabulary; drives environment and body form). */
export const VEHICLE_MEDIUM:{medium:'AIR'|'SPACE'|'WATER'|'GROUND';pattern:RegExp}[]=[
 {medium:'AIR',pattern:/^(?:aviao|airplane|plane|aeronave|aircraft|jato|jet|planador|glider|helicoptero|helicopter|drone|dirigivel|airship)$/},
 {medium:'SPACE',pattern:/^(?:foguete|rocket|nave|spaceship|spacecraft|missil|missile|onibus espacial)$/},
 {medium:'WATER',pattern:/^(?:barco|boat|navio|ship|lancha|canoa|canoe|veleiro|sailboat|submarino|submarine|jangada|raft|balsa|ferry)$/},
 {medium:'GROUND',pattern:/^(?:carro|car|caminhao|truck|onibus|bus|trem|train|moto|motorcycle|automovel|automobile|vagao|wagon)$/},
];
/** Parts of a vehicle: surfaces that work against the medium, and propulsors. */
export const LIFT_SURFACE=/^(?:asa|wing|aleta|fin|aerofolio|airfoil|hidrofolio|hydrofoil|vela|sail|leme|rudder|estabilizador|stabilizer)$/;
export const PROPULSOR=/^(?:motor|engine|propulsor|thruster|helice|propeller|reator|remo|oar)$/;
/** Named forces with their lexical direction (relative to the body: forward = direction of travel). */
export const FORCE_DIRECTION:{dir:'UP'|'DOWN'|'FORWARD'|'BACKWARD'|null;pattern:RegExp}[]=[
 {dir:'DOWN',pattern:/^(?:peso|weight|gravidade|gravity)$/},
 {dir:'UP',pattern:/^(?:sustentacao|lift|empuxo hidrostatico|flutuacao|buoyancy)$/},
 {dir:'FORWARD',pattern:/^(?:propulsao|thrust|tracao|traction|impulso|empuxo)$/},
 {dir:'BACKWARD',pattern:/^(?:arrasto|drag|atrito|friction|resistencia do ar|air resistance)$/},
 {dir:null,pattern:/^(?:forca|force)$/},
];
export const vehicleMedium=(heads:string[])=>VEHICLE_MEDIUM.find(v=>heads.some(h=>v.pattern.test(h)))?.medium??null;
export const forceDirection=(heads:string[])=>{const f=FORCE_DIRECTION.find(v=>heads.some(h=>v.pattern.test(h)));return f?{dir:f.dir}:null;};
/** Fluids that cannot be seen directly (shown through manifestations such as streamlines). */
export const INVISIBLE_FLUID=/^(?:ar|air|vento|wind|escoamento|airflow|gas)$/;
export const PERSON=/^(?:voce|voces|you|we|nos|eu|i|ele|ela|they|eles|elas|pessoa|person|alguem|someone)$/;
export const HIGH=/\b(?:elevad\w*|superior|superiores|alt[oa]s?|acima|upper|higher|high|top|topo)\b/;
export const LOW=/\b(?:inferior|inferiores|baix[oa]s?|abaixo|lower|low|bottom|fundo)\b/;
export const EXIT_CUE=/\b(?:sai|saem|saida|leaving|leaves|exiting|outlet|outgoing)\b/;
export const ENTRY_CUE=/\b(?:entrada|entering|inlet|incoming|entra|entram)\b/;
export const ROTATION_CUE=/\b(?:rotacao|rotacoes|rotation|giro|gira|giram|girar|spin|spins|rotate|rotates|turning|torque)\b/;
export const FLOW_CUE=/\b(?:fluxo|flow|corrente de|escoamento|jato|jet)\b/;
export const FLOWING=new Set(['FLOW','MOVE','ENTER','EXIT','PASSES_THROUGH','RISE','DESCEND','ESCAPE','COLLECT','FILL','EMPTY','ARRIVE','COME']);
export const PURPOSE=new Set(['USED_FOR','DESIGNED_FOR','HAS_GOAL','ENABLES','REQUIRES']);
/** Singular fold for pt/en plurals (morphology, not vocabulary). */
export function singular(w:string){
 if(w.length<=3)return w;
 if(/oes$|aes$/.test(w))return w.slice(0,-3)+'ao';
 if(/ais$/.test(w))return w.slice(0,-3)+'al';
 if(/eis$/.test(w))return w.slice(0,-3)+'el';
 if(/ns$/.test(w))return w.slice(0,-2)+'m';
 if(/(?:r|z)es$/.test(w))return w.slice(0,-2);
 if(/s$/.test(w)&&!/ss$/.test(w))return w.slice(0,-1);
 return w;
}

/** Object categories → staging context (Phase29 context planner). Data shared by all topics: a category decides where the
 * object is plausibly seen; the context is staging, never a fact. Order = priority when several match. */
/** Places a script names ("o ar da cozinha"): the strongest staging cue, ahead of object categories. */
export const PLACE_CONTEXT:{context:'KITCHEN_LIKE'|'BATHROOM_LIKE'|'DOMESTIC_INTERIOR'|'BUILDING_SHAFT'|'WORKSHOP';pattern:RegExp}[]=[
 {context:'KITCHEN_LIKE',pattern:/^(?:cozinha|kitchen)$/},{context:'BATHROOM_LIKE',pattern:/^(?:banheiro|lavabo|bathroom)$/},
 {context:'DOMESTIC_INTERIOR',pattern:/^(?:casa|sala|quarto|lar|home|room)$/},{context:'WORKSHOP',pattern:/^(?:oficina|garagem|fabrica|laboratorio|workshop|garage|factory|lab)$/},
 {context:'BUILDING_SHAFT',pattern:/^(?:predio|edificio|building)$/},
];
export const OBJECT_CONTEXT:{category:string;context:'KITCHEN_LIKE'|'BATHROOM_LIKE'|'DOMESTIC_INTERIOR'|'BUILDING_SHAFT'|'WORKSHOP'|'OUTDOOR_GROUND';pattern:RegExp}[]=[
 {category:'PLUMBING_FIXTURE',context:'BATHROOM_LIKE',pattern:/^(?:banheiro|chuveiro|banheira|bide|ralo|esgoto|bathroom|shower|bathtub|drain|sewer)$/},
 {category:'INDOOR_APPLIANCE',context:'KITCHEN_LIKE',pattern:/^(?:fogao|forno|microondas|liquidificador|batedeira|cafeteira|chaleira|panela|torradeira|lavalouca|pia|stove|oven|kettle|pot)$/},
 {category:'HOUSEHOLD_OBJECT',context:'DOMESTIC_INTERIOR',pattern:/^(?:ventilador|aspirador|lavadora|secadora|secador|aquecedor|lampada|abajur|televisao|relogio|fan|vacuum|heater|lamp)$/},
 {category:'ARCHITECTURAL_SYSTEM',context:'BUILDING_SHAFT',pattern:/^(?:cabine|predio|edificio|andar|andares|building|floor|cabin)$/},
 {category:'INDUSTRIAL_MACHINE',context:'WORKSHOP',pattern:/^(?:torno|prensa|esteira|furadeira|serra|lathe|press|conveyor)$/},
 {category:'OUTDOOR_INFRASTRUCTURE',context:'OUTDOOR_GROUND',pattern:/^(?:represa|barragem|usina|moinho|ponte|torre|rio|dam|mill|bridge|tower|river)$/},
];
/** Outdoor places: when the script names one, a housed machine is not staged indoors. */
export const OUTDOOR_PLACE=/^(?:campo|campos|rio|rios|mar|oceano|ceu|rua|ruas|estrada|jardim|quintal|fazenda|floresta|montanha|praia|deserto|lavoura|plantacao|terreno|lago|represa|poco|horta)$/;
