# Semantic Claim Engine v1

Parser determinístico e limitado de pt-BR para afirmações visuais. Não usa modelo, rede, pesquisa, fatos externos, relógio ou estado global. Recebe **somente roteiro pronto**; não escreve roteiro. A saída pode conter incerteza e abstenção. `SemanticAnalysis` é análise textual, não fact checking nem garantia de capacidade visual.

```powershell
npm run semantics:analyze -- examples/semantics/quantity.json --out out/engine3d/semantics
npm run semantics:plan -- examples/semantics/water.json --out out/engine3d/semantics
npm run semantics:plan -- examples/semantics/researchers.json --strict
npm run check:semantics
```

O terceiro comando falha intencionalmente em STRICT: entender o grupo/processo não cria uma representação 3D adequada.

## Fronteiras

`sentences → predicates/quantities → entities/mentions/references/context → relations → claims/confidence/dedup/chaining → SemanticAnalysis`.

`compiler.ts` adapta para `AutoDirectorInput`; o Auto Director continua escolhendo recursos, templates, câmera e demonstrações. Engine3D/Remotion executam os contratos existentes. O parser não conhece IDs de recursos. A evidência neutra `ClaimExtraction` permite à direção respeitar confiança, negação, modalidade, ambiguidades e janelas temporais sem importar internals do parser.

Versões: `semantic-engine/1.0.0` e `semantic-claim-adapter/1.0.0`. Fingerprints incluem source, estruturas, versões e snapshot das regras/pesos. CLI faz I/O; core não lê arquivos. Ordenação é estável e os contextos pertencem a cada chamada.

## Evidência e escopo

Offsets são UTF-16 half-open, compatíveis com a Fase 15. A normalização de acentos tem mapa de volta ao texto original, inclusive formas Unicode decompostas. Todo elemento possui `sourceSpan`; claims/relations têm `sourceEvidence[]`. Texto não é reescrito para parecer mais explícito. Semântica normalizada (ex.: DECREASE, Celsius, COVERED) fica em campos separados.

O vocabulário de substantivos/predicados é fechado em `rules.ts`. Entidade e menção são distintas; aliases curtos como carro/veículo e caixa d'água/reservatório usam regras declaradas. Objetos com modificadores diferentes não são automaticamente fundidos. Nomes próprios vêm da estrutura local; não há tabela de Vostok/Aurora nem geografia. Gênero desconhecido em nome próprio reduz confiança em referências.

Pronomes e descritores consultam uma janela de duas unidades. Múltiplos candidatos compatíveis produzem AMBIGUOUS. Há restrições lexicais explícitas para fluxo líquido em tubo/contexto de processo e descritores de objeto/veículo/recipiente/local; isso não é resolução geral de anáfora. Sujeito omitido pode herdar o único sujeito recente. `Por isso` é conector discursivo, sem fingir que “isso” é uma entidade física.

## Quantidades e relações

Suporte: inteiros/decimais numéricos, sinal negativo, palavras de zero a cem (combinações de dezenas/unidades limitadas), menos, graus negativos, porcentagem, distância, tempo, velocidade e rankings até décimo ou numéricos. “Graus” usa a convenção Celsius deste projeto; não há conversão de unidades nem dedução de valores absolutos. `-20 → -60` é DECREASE; contradição entre número/predicado gera ambiguidade, sem corrigir o roteiro.

Relações mantêm sujeito/objeto, caminho/origem/destino, estado, quantidade, comparação e causas marcadas. Comparação com diferença preserva operands e diferença; não inventa temperaturas absolutas. Causa requer marcador e dois eventos textuais; mera proximidade não basta. Antes/depois/em seguida/então podem vincular ordem; “enquanto”, início e “até” espacial não viram AFTER por aproximação. Cobertura de sintaxe verbal/preposicional continua restrita.

## Confiança e abstenção

Pesos comuns: evidência textual +0,20; predicado +0,30; sujeito claro +0,25; objeto +0,10; quantity +0,15; referência HIGH +0,12; MEDIUM −0,12; sujeito ausente −0,35; referência/estrutura ambígua −0,60; predicado desconhecido −0,35. Soma limitada a [0,1]; HIGH ≥0,75, MEDIUM ≥0,50, LOW abaixo disso. Ambiguidade crítica força LOW. Confiança na classificação de contexto retórico é uma exceção editorial explícita; não representa prova de evento físico. Claims causais têm breakdown próprio: texto +0,20, marcador +0,35 e dois eventos +0,30 (ou +0,05 incompletos); ambiguidade −0,60.

Confiança de extração não é certeza factual. Negação simples fica em `negated`; múltiplas negações têm escopo não resolvido. Pode/poderia/talvez/provavelmente/possivelmente/parece ficam em modality. Perguntas continuam QUESTION, sem afirmar o processo. A policy de execução é separada: SAFE, ABSTAIN ou EDITORIAL. Uma interpretação HIGH de uma possibilidade não permite executá-la como fato.

Dedup usa identidade semântica, relações, valores, estados e modalidade; conserva evidências combinadas e mudanças distintas. Fingerprint canônico final inclui as evidências. Chaining liga claims por entidade compartilhada, incluindo nível PART_OF recipiente. Acúmulo + cobertura do mesmo sujeito podem compartilhar uma janela de demonstração. Sem palavra gelo não se inventa gelo; sem cobertura textual não se inventa estado final completamente congelado.

## Integração e limites visuais

SEMANTIC_PLAN_ONLY preserva diagnósticos. SEMANTIC_STRICT rejeita incerteza crítica PRIMARY. Auto Director STRICT continua rejeitando gaps de prova. Nenhum desses modos apaga os gaps ou autoriza resolver mídia externa.

Água e carro com cobertura explícita usam padrões existentes. A variação numérica de temperatura pode ser entendida corretamente e ainda produzir gap visual: o template atual de instrumento não demonstra essa transição. Congelar água, causalidade física geral, processos parciais e múltiplos sujeitos não são substituídos por um carro genérico. Researchers gera MISSING_SUBJECT. Scripts com domínios mistos/gaps não viram montagem parcial silenciosa, conforme Auto Director v1.

A limitação de interoperabilidade da Fase 15 permanece: `DirectedSequence` é autoritativo. O `EditorialPlan`/`DirectorPlan` antigo exportado é uma projeção simbólica, com placeholder de foco; não é prova visual equivalente às primitivas. Não foi criado renderer alternativo.

## Métricas e avaliação

`scriptClaimCoverage` mede unidades com algum claim resolvido não LOW, incluindo contextos. Não é recall de todas as proposições nem prova de interpretação integral da frase. `unsupportedSpanRate` mede unidades com claims não resolvidos/LOW; `ambiguityRate` é fração de claims dependentes de ambiguidades; `abstentionRate` é fração de claims não resolvidos/LOW. Modalidades/negações compreendidas podem ser HIGH e ainda ABSTAIN visualmente.

14 fixtures script-only com golds separados, mutações, adversariais e integração alimentam a avaliação. Gold não é input do parser. Não há estimativa de precisão populacional nem suporte a todo português. `PRECISION > RECALL`: registrar UNKNOWN/AMBIGUOUS/gap vale mais que preencher a cena incorretamente.
