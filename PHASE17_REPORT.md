# PHASE17 — Natural Script Understanding & Multi-Domain Planning

## A. Objective

Receber roteiros naturais script-only, construir um grafo narrativo verificável e executar as partes suportadas sem perder as janelas difíceis. A Fase17 foi concluída com 18/18 gates PASS, 11 comandos PASS e qualificação **LEVEL 3B no domínio delimitado testado**. C termina PARTIAL e seu vídeo é somente preview técnico. A termina FULL e foi renderizado. Não foi implementado Topic → Script.

Data da execução: 28/10/2026. A conclusão é técnica e amostral; não representa aprovação estética humana nem demonstra compreensão universal de português.

## B. Starting state

Base: Fase16, Semantic Engine v1, Auto Director, demonstrações procedurais, motion/câmera, compositor editorial, Remotion e edge-tts. Havia alterações locais das fases anteriores; foram preservadas. O baseline desta fase contém 149 arquivos. Só dois arquivos já existentes no baseline mudaram: package.json (dois scripts) e src/autodirector/templates.ts (janela FLOW multi-unidade). Oito MP4s históricos das Fases12–16 tiveram SHA-256 revalidado, sem alteração. Os 417 testes da suíte rápida anterior permanecem entre os 452 atuais.

Evidência: [integrity.json](out/engine3d/phase17/analysis/integrity.json)

## C. Architecture

`script-only → analyzeNaturalScript → SemanticNarrativeGraph → segmentos/dependências → Narrative Director → PartialExecutionPlan → Auto Director por ilha → compilador de fronteiras → DirectedSequence/VisualDemonstration → Three/R3F/Remotion → edge-tts + captions → MP4`.

Módulos novos: `src/semantics/{narrative-contracts,natural-lexicon,clauses,references-v2,narrative-graph,narrative-claims,narrative-segments,narrative-qa}.ts`; `src/narrative/{contracts,timing,projection,director,compiler,index}.ts`; CLI `cli/narrative.ts`; 11 entradas em `examples/narrative`; `tests/narrative.test.ts`. Documentação de uso: [src/narrative/README.md](src/narrative/README.md).

Não há novo renderer, TSX de piloto, LLM, modelo, backend ou serviço de planejamento. Parsing/planejamento/compilação são funções puras; filesystem, cronômetro e render ficam nos harnesses/CLI. A placa de diagnóstico é composta somente na montagem de REVIEW, fora do registry e fora de DIRECT.

## D. Semantic Narrative Graph

Versões: semantic-engine/1.1.0, narrative-graph/1.0.0, narrative-director/1.0.0, partial-execution-plan/1.0.0, narrative-compiler/1.0.0. O grafo possui source original, cláusulas, entidades/menções, referências tipadas, aliases, eventos, estados, relações, claims, segmentos, transições e dependências, além de fingerprints do conteúdo e das regras. SourceSpan usa offsets UTF-16 e texto exato. A análise v1 aninhada continua validável pelo QA legado; IDs de contexto agora apontam para eventos/referências presentes no próprio grafo.

O QA detecta fingerprint inválido, IDs repetidos, spans alterados, lacunas na partição de cláusulas, referências do tipo errado e dependências pendentes. [natural-mixed.json](out/engine3d/phase17/graphs/natural-mixed.json)

## E. Event model

SemanticEvent separa predicado e participantes: sujeito, objeto, origem, destino, caminho, local, quantities, antes/depois, negação, modalidade, pergunta, confiança e evidências. “Quando a água entra..., o nível aumenta e o recipiente começa a armazená-la” mantém três eventos ENTER/INCREASE/STORE e três papéis distintos. Eventos assertivos de fluxo do mesmo sujeito podem compartilhar processIdentity; o verbo individual permanece no grafo. CONTINUE só herda um processo quando a referência de evento possui antecedente textual válido. Não há simulação física inferida nem causa externa acrescentada.

## F. Reference resolution v2

Cada referência exporta candidatos ordenados, compatibilidade, score, semanticScore, breakdown, escolhido ou null, confiança, razão e margem. Pesos: base20; tipo30; gênero/número12 cada; predicado50; recência até10; domínio16/fronteira−18; descritor36; papel de destino40/origem conflitante−24; sujeito recente12; continuidade8; competição−8. Score mínimo64; margem total mínima24 e margem semântica mínima24. Recência sozinha não desempata dois carros equivalentes. IDs servem à ordenação diagnóstica, não autorizam escolha em empate semântico.

A busca considera candidatos anteriores no texto e limita a avaliação a 32 entidades/12 eventos elegíveis. Não se limita às duas frases anteriores. Os pesos são heurísticos explícitos, sem calibração estatística; confiança não é probabilidade. [same-type.json](out/engine3d/phase17/graphs/same-type.json)

## G. Aliases

LEXICAL_ALIAS cobre formas do léxico compatíveis com a identidade, como carro/veículo. CONTEXTUAL_ALIAS exige evidência local, por exemplo recipiente associado ao destino da água. Cada alias inclui source, entidade, menção, razão e confiança. “Esse veículo” e “esse objeto” preservam a entidade anterior quando descritor/predicado e margem sustentam a escolha; não criam automaticamente outra identidade. Mudança para pronome incompatível faz abstention. Identidade entre dois objetos da mesma classe continua conservadora.

## H. Clause segmentation

A partição cobre integralmente o source sem reescrever pontuação. Conectores são considerados junto aos predicados: coordenação, temporal, causa, condição, relativa e finalidade. Dois-pontos e ponto-e-vírgula preservam escopos úteis. O hook interrogativo e “isso não significa que...” mantêm escopo não assertivo inclusive nos complementos. A finalidade “para ser usada depois” é contexto, não um acontecimento novo. Trata-se de gramática delimitada; não de parser sintático universal.

## I. Subject/object propagation

Coordenação pode compartilhar sujeito único anterior; clíticos de objeto possuem resolução separada. Em “A água entra no reservatório e o preenche”, água segue como sujeito e “o” aponta para o reservatório. Em “o recipiente começa a armazená-la”, recipiente é sujeito e água é objeto. O papel não é transferido só pela última entidade mencionada. As três cláusulas e a coordenação são verificadas por testes de identidade e predicado, não apenas snapshots.

## J. Narrative segments

Cada segmento registra domínio, tipo discursivo, unidades/cláusulas/claims, entidades/eventos, sujeitos dominantes, locais, confiança e motivo da fronteira. Contextos editoriais adjacentes acompanham o domínio físico relevante. Os tipos estão no contrato; o classificador atual emite principalmente HOOK/QUESTION/PROCESS/EXAMPLE/EXPLANATION/UNKNOWN. A enumeração de tipos não equivale a suporte discursivo pleno a todos eles.

## K. Domain shifts

C possui LIQUID_PROCESS → SCIENTIFIC_ACTIVITY → VEHICLE_STATE, preservando a ordem. “Em outra parte...” introduz a mudança; “Voltando...” produz EXPLICIT_RETURN. Troca inequívoca de sujeito de veículo também separa segmentos. B intercala domínio MEASUREMENT, sem transformar o número do termômetro em causa automática do gelo. Marcadores e papéis sustentam as fronteiras; remover um marcador altera o diagnóstico em teste de mutação.

## L. Claim dependencies

INDEPENDENT e CONTINUES não bloqueiam por si. Referência explícita a evento, causalidade textual e manutenção de estado anterior geram dependências bloqueantes DEPENDS_ON/CAUSES. O contrato também prevê SUPPORTS/CONTRASTS/ELABORATES/RESOLVES; não se declara extração completa desses casos. “Efeito porque causa” preserva direção causa→efeito mesmo quando o source está na ordem inversa. Compartilhar entidade não contamina automaticamente um trecho independente.

## M. Execution islands

Uma ilha contém apenas intervalo contíguo de cláusulas válidas, plano Auto Director existente, source global e local, dependências satisfeitas e fronteiras de estado. O Narrative Director faz preflight pelas capabilities e seleções existentes. Se um agrupamento falha, a divisão é delimitada por cláusulas para localizar o problema; não existe outro planner visual ou fallback genérico apresentando claims físicos. Uma ilha só de contexto pode exibir texto/ambiente com NONE: contagem de ilhas não é contagem de demonstrações DIRECT.

## N. Localized gaps

Cada gap traz claim/cláusula/segmento, source, motivo, capabilities/sujeitos ausentes, prova disponível, resolução recomendada, frames, dependentes, recoverable e próximo segmento executável. C possui três gaps de claims dentro de uma janela técnica contínua: NC9/MISSING_SUBJECT (scientific_crowd), NC10/LOW_CLAIM_CONFIDENCE, NC11/BLOCKED_BY_DEPENDENCY. Uma lista vazia de missingCapabilities não significa suporte: pode faltar sujeito ou semântica antes da seleção de template.

[localized-gaps.md](out/engine3d/phase17/review/localized-gaps.md); [localized-gaps.json](out/engine3d/phase17/analysis/localized-gaps.json)

## O. Gap propagation

A propagação segue apenas arestas bloqueantes e registra blockedByClaimIds. NC11 depende do evento científico anterior; a água anterior e o carro posterior não dependem dele. Na fixture dependency-gap, root gap e sua continuação ficam indisponíveis, enquanto o novo carro executa. Testes retiram arestas/antecedentes e verificam as mudanças, incluindo gaps no começo, meio, fim e dois consecutivos.

## P. Partial execution

FULL significa que toda a timeline tem ilhas compiláveis e não há janela pendente; não significa que todo texto editorial é HIGH ou tem DIRECT. PARTIAL mantém simultaneamente ilhas válidas e janelas não resolvidas; NONE não possui intervalo executável. PLAN_ONLY permite diagnóstico, STRICT_ISLANDS aceita ilhas válidas e mantém gaps explícitos, STRICT_FULL rejeita gaps PRIMARY. O STRICT legado do Auto Director foi preservado. Compilação PRODUCTION rejeita qualquer plano parcial, mesmo quando o modo de planejamento permite ilhas.

Manifesto solicitado: [phase17-natural-mixed-production-plan.json](out/engine3d/phase17/phase17-natural-mixed-production-plan.json), com placeholderAllowed=false, masterRenderAllowed=false. Não existe master final de C.

## Q. State boundaries

Ilhas exportam initialSemanticState, requiredIncomingState, finalSemanticState e exportedState com sourceClaim/sourceIsland/proveniência. O compilador registra estado físico inicial/final. RESET é usado em contexto independente; TRANSFER só aceita estado realmente exportado por uma ilha executada da mesma entidade. A legenda ou o gap não estabelece estado físico. C começa o carro em frost=0 e termina coberto; não herda estado da água nem do bloco científico.

## R. Recovery after gaps

C: uma recuperação depois do gap, dois RESETs e nenhuma transferência entre domínios. A fixture gap-recovery prova outro caso: carro coberto → gap científico → mesmo veículo continua coberto. A retomada recebe frost=1 e termina frost=1, sem steps de congelamento repetidos, com RESET_CAMERA e RESET_FOCUS. Cobertura após gap é manutenção de estado executado, não reencenação. A fixture long-guards registra uma failedRecoveryCount quando há um segmento PRIMARY posterior ainda não executável; o contador não é fixado em zero.

## S. Timeline assembly

Todos os intervalos são [startFrame,endFrame), sem cortes de texto, reordenação ou compressão oculta. Unidades narradas têm duração medida e arredondada a frames; a distribuição entre cláusulas é proporcional às palavras. C:

| Item | Conteúdo | Frames | Segundos | Prova |
| --- | --- | --- | --- | --- |
| TL1 | Ilha água | 0–477 | 0–15,900 | DIRECT nos claims físicos |
| TL2 | Gap técnico | 477–953 | 15,900–31,767 | NONE / REVIEW ONLY |
| TL3 | Ilha carro | 953–1752 | 31,767–58,400 | DIRECT nos claims físicos |

Os 476 frames do gap permanecem no MP4 e no denominador. O áudio mantém todas as unidades do roteiro. Clips nativos e técnicos usam time_base=1/90000 antes da concatenação. O QA visual detectou uma primeira montagem com legenda presa no fim do gap; ela foi corrigida e os limites 476/477 e 952/953 foram revalidados por correspondência de pixels/text masks. O resultado entregue é a montagem corrigida.

## T. Camera/focus transitions

Fronteiras declaram câmera, foco e estado. Retorno após gap reconstrói contexto com RESET_CAMERA/RESET_FOCUS; continuidade compatível sem gap admite REFRAME. C muda de diagrama para quadro técnico e depois para carro, com corte explícito de revisão. Não se mascara o gap com movimentos, vfx ou fades. O conjunto atual de enquadramentos é pequeno e a variedade visual permanece limitada.

## U. Natural Script A

Entrada: `examples/narrative/natural-process.json`, somente version/id/language/script. **123 palavras, 44.367s, FULL; 1 ilha(s), 0 gap(s).**

Uma ilha actorless mostra origem, tubulação ascendente, destino enchendo e retenção. Nove claims PRIMARY/DIRECT entre treze claims totais. Uma cláusula editorial final possui confiança LOW e prova NONE; não foi promovida a fato. O processo é esquemático, não explica pressão, bomba ou mecanismo não citado. Render FULL disponível.

Roteiro integral:

> Você já olhou para uma caixa d'água e imaginou o caminho que a água faz até chegar lá?
> Ela sai de um reservatório inferior, entra por uma tubulação e sobe até a caixa superior, seguindo um trajeto que podemos acompanhar passo a passo.
> Esse processo continua pelo tubo até o reservatório, enquanto a água percorre a ligação entre a parte de baixo e a parte de cima.
> Quando a água entra na caixa, o nível aumenta pouco a pouco e o recipiente começa a armazená-la.
> Depois, a água fica armazenada no reservatório e permanece ali para ser usada mais tarde.
> Assim, o caminho fica claro: a tubulação, a subida e o nível dentro da caixa fazem parte desta explicação, do começo ao fim.

[natural-process.json](out/engine3d/phase17/graphs/natural-process.json); [natural-process-plan.json](out/engine3d/phase17/autodirector/natural-process-plan.json)

## V. Natural Script B

Entrada: `examples/narrative/natural-cold.json`, somente version/id/language/script. **127 palavras, 51.967s, PARTIAL; 5 ilha(s), 3 gap(s).**

Carro/Ele/veículo permanecem coerentes; temperatura −20 é exclusivamente o número informado pelo roteiro. Três gaps são preservados no escopo epistemológico/modal. Os demais trechos fornecem cinco ilhas, incluindo contexto e termômetro; isso não equivale a cinco demonstrações ricas. Cinco de oito PRIMARY são executáveis. Foi analisado/narrado/compilado, sem render adicional exigido. Não se declara FULL.

Roteiro integral:

> O que acontece com um carro nessa cena de frio extremo? Acompanhe o veículo do início ao fim, sem imaginar efeitos que não aparecem nesta história.
> O carro estava normal e ficou estacionado do lado de fora, exposto ao frio.
> Na cena, a temperatura marca -20 graus no termômetro, um número que acompanha esta demonstração.
> Ele começou a acumular gelo lentamente, e o acúmulo aumenta pouco a pouco na superfície do veículo.
> Depois, o carro ficou completamente coberto de gelo, enquanto o veículo permanece no mesmo local.
> Isso não significa que o carro sempre vai congelar: ele poderia ficar coberto nesta situação, mas a possibilidade não é uma certeza.
> Por fim, a imagem mostra a progressão descrita, do carro normal até o estado coberto apresentado na cena.

[natural-cold.json](out/engine3d/phase17/graphs/natural-cold.json); [natural-cold-plan.json](out/engine3d/phase17/autodirector/natural-cold-plan.json)

## W. Natural Script C

Entrada: `examples/narrative/natural-mixed.json`, somente version/id/language/script. **142 palavras, 58.400s, PARTIAL; 2 ilha(s), 3 gap(s).**

Teste central: duas ilhas reais ao redor de uma janela impossível, sem claims ou direção manuais. Oito de onze PRIMARY executáveis; dois gaps de origem e um bloqueio dependente; 1276/1752 frames executáveis. A multidão de cientistas não foi substituída por ator genérico nem mostrada como DIRECT. O preview conserva toda a fala, com aviso VISUAL GAP / REVIEW ONLY / NAO E MASTER FINAL. Retoma o carro e o acúmulo de gelo depois do diagnóstico.

Roteiro integral:

> Como a água chega à parte de cima desta cena? Ela sai de um reservatório inferior, percorre o tubo e sobe até a caixa superior.
> Quando a água entra na caixa, o nível aumenta e o recipiente começa a armazená-la para ser usada depois.
> Em outra parte da história, uma multidão de pesquisadores opera equipamentos científicos complexos dentro de uma estação. Os pesquisadores analisam vários resultados e controlam instrumentos durante esse trabalho, cercados por outras equipes e máquinas.
> Voltando ao lado de fora, um carro estava normal e ficou exposto ao frio. Ele começou a acumular gelo lentamente na superfície, enquanto o veículo permaneceu estacionado.
> Depois de algum tempo, o carro ficou completamente coberto de gelo e o veículo continua visível no mesmo local.
> Por fim, essa progressão fica clara nesta explicação, que acompanha o carro antes e depois do acúmulo descrito.

[natural-mixed.json](out/engine3d/phase17/graphs/natural-mixed.json); [natural-mixed-plan.json](out/engine3d/phase17/autodirector/natural-mixed-plan.json)

## X. Long-distance coreference

A fixture long-reference retoma veículo depois de várias unidades intermediárias, com descritor/predicado compatível e recência menor que o máximo. A referência resolve além das duas unidades, com breakdown exportado. O texto intermediário não precisa ser executável: há um gap honesto para operação não suportada. A capacidade demonstrada é referência delimitada com evidência, não memória discursiva arbitrária ou ligação entre nomes próprios desconhecidos.

## Y. Ambiguous same-type entities

Dois carros concorrentes e referências “ele/veículo” produzem AMBIGUOUS/null, mesmo com recência diferente. Nenhum claim derivado do referente indefinido recebe HIGH. A fixture termina NONE, corretamente. Um sistema que sempre escolhe o último carro renderizaria mais, porém erraria identidade; aqui a ausência de execução é o resultado correto. Candidatos, scores e margem ficam no grafo.

## Z. Clause fixture

A fixture clauses mantém ENTER(água), INCREASE(nível), STORE(recipiente, objeto=água), com SourceSpans que concatenam exatamente o original. A fixture object-reference mantém ENTER/FILL com água sujeito e reservatório objeto. Ambas FULL; não foram renderizadas separadamente. A/C usam a mesma família de demonstração em roteiros maiores.

## AA. Event references

“Esse processo continua...” usa EVENT_REFERENCE e selectedEventId, mantendo selectedEntityId=null. O processo de fluxo possui identidade estável entre seus verbos. A continuação gera dependência bloqueante no evento anterior. “O acúmulo” e “isso” possuem tratamento tipado; um “isso” epistemológico sem evento inequívoco abstém, em vez de escolher carro como entidade. Event-reference termina FULL; dependency-gap comprova que evento sem suporte também bloqueia sua continuação.

## AB. Gap recovery

Na fixture gap-recovery: PARTIAL, duas ilhas, um gap, uma recuperação, uma transferência de continuidade. O estado exportado coberto sobrevive, e o compilador executa hold com zero steps novos. A referência continua apontando para o mesmo veículo, sem teletransporte ou ciclo frost=0→1 repetido. O caso foi verificado por estado/contrato e testes; não há MP4 separado desse auxiliar.

## AC. Dependency gaps

Na fixture dependency-gap: PARTIAL, root gap + blocked dependent e uma ilha de veículo independente. Arestas não bloqueantes de continuidade não derrubam a ilha seguinte. Também foram exercitados remoção de antecedente, causa sem marcador, mudança de fronteira, pronome incompatível e dois gaps adjacentes. O algoritmo é conservador: inferências implícitas não representadas no grafo ainda podem exigir direção humana.

## AD. Semantic coverage

| Roteiro | Unidades | Cláusulas | Claims cobertos | HIGH | Ambiguidade | Abstenção | Span não suportado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | 83.33% | 92.31% | 92.31% | 92.31% | 7.69% | 7.69% | 7.69% |
| B | 100.00% | 92.86% | 92.86% | 92.86% | 7.14% | 7.14% | 7.14% |
| C | 88.89% | 88.24% | 88.89% | 83.33% | 5.56% | 11.11% | 11.76% |

Denominadores: unidades com pelo menos um claim de confiança diferente de LOW / todas as unidades; cláusulas com claim diferente de LOW / todas as cláusulas; claims diferentes de LOW / todos os claims. HIGH, status AMBIGUOUS e confiança LOW (abstenção) são contados sobre todos os claims. unsupportedSpanRate conta cláusulas com pelo menos um claim LOW / todas as cláusulas; não mede quantidade de caracteres. São taxas heurísticas internas, não precisão/recall anotada de um benchmark externo. Cobertura semântica não implica capacidade visual. [coverage.json](out/engine3d/phase17/analysis/coverage.json)

## AE. Execution coverage

| Roteiro | PRIMARY | Claims executáveis | DIRECT | Gap | Blocked | Frames executáveis | Ilhas | Recuperações |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 9 | 100.00% | 100.00% | 0.00% | 0.00% | 1331/1331 (100.00%) | 1 | 0 |
| B | 8 | 62.50% | 62.50% | 37.50% | 0.00% | 1300/1559 (83.39%) | 5 | 0 |
| C | 11 | 72.73% | 72.73% | 18.18% | 9.09% | 1276/1752 (72.83%) | 2 | 1 |

O denominador de claims PRIMARY é requiresVisualProof=true; contextos não inflam DIRECT. Gap + blocked + executable = 100% desse denominador. partialProofRate=0 nos três casos. Frames executáveis incluem contextos contidos em ilhas válidas; a taxa por tempo não equivale à taxa de prova física. avgClaimsPerIsland inclui todos os claims da ilha, inclusive editoriais: A13, B2,2, C7,5; maior ilha A13/B4/C8.

## AF. Visual proof

Trilha completa: source → cláusula → entidade/evento/referência → claim → dependência → segmento → ilha/gap → seleção Auto Director → prova compilada → janela na timeline. JSON por claim: [source-trace.json](out/engine3d/phase17/analysis/source-trace.json). Tabela legível: [narrative-review.md](out/engine3d/phase17/review/narrative-review.md). Provas: [visual-proof.json](out/engine3d/phase17/analysis/visual-proof.json).

DIRECT deriva de demonstração/estado suportado pelo compilador existente; pergunta, propósito e contexto ficam NONE. As janelas de fluxo/congelamento podem cobrir processo multi-unidade, em vez de um novo ciclo por frase; a janela da cláusula e a janela de execução são exportadas separadamente. Primitive stateSamples registram flowProgress/fillLevel/frost em cinco pontos por ilha. Amostras codificadas confirmam o caminho de água, enchimento, retenção, carro normal e cobertura progressiva. A correspondência é qualitativa e contratual, sem modelo automático de qualidade perceptual. Pilotos auxiliares apenas compilados não são marcados como renderizados.

## AG. Repetition

| Roteiro | Escopo | s | Cortes/min | Mudanças/min | Maior pausa s | Warnings |
| --- | --- | --- | --- | --- | --- | --- |
| A | island-1 | 44.367 | 0.00 | 16.23 | 21.733 | 3 |
| A | GLOBAL | 44.367 | 0.00 | 16.23 | 21.733 | 3 |
| B | island-1 | 10.000 | 0.00 | 0.00 | 10.000 | 1 |
| B | island-2 | 5.500 | 0.00 | 0.00 | 5.500 | 1 |
| B | island-3 | 6.967 | 0.00 | 0.00 | 6.967 | 1 |
| B | island-4 | 13.633 | 0.00 | 66.01 | 3.800 | 3 |
| B | island-5 | 7.233 | 0.00 | 0.00 | 7.233 | 1 |
| B | GLOBAL | 51.967 | 5.77 | 23.09 | 10.000 | 8 |
| C | island-1 | 15.900 | 0.00 | 45.28 | 8.767 | 3 |
| C | island-2 | 26.633 | 0.00 | 33.79 | 12.133 | 3 |
| C | GLOBAL | 58.400 | 2.05 | 29.79 | 15.767 | 7 |

Métricas originais da Fase13, sem maquiar câmeras ou thresholds: [repetition.json](out/engine3d/phase17/analysis/repetition.json). São transformações semânticas; captions e neve decorativa não contam como eventos. O metricador legado não inclui fillLevel/flowProgress/frost no canal de movimento de prop; por isso pode registrar pouca atividade apesar do processo visível. Os stateSamples e as tiras demonstram a progressão adicional. O global contém tempo do gap e cortes técnicos; não atribui a ele prova ou criatividade editorial. Continuous sequence length global usa a maior ilha real. Actor variety zero significa ausência de ator, não centralização perfeita. Há repetição visual real, especialmente nos holds e nas famílias de cenário; não se alcançou a variedade de um editor humano.

## AH. Pilot renders

A: [phase17-natural-process.mp4](out/engine3d/phase17/renders/phase17-natural-process.mp4), 1331 frames, 44,367s, FULL, sem placeholder.

C: [phase17-natural-mixed-preview.mp4](out/engine3d/phase17/renders/phase17-natural-mixed-preview.mp4), 1752 frames, 58,400s, PARTIAL, REVIEW ONLY. A placa cobre 476 frames e possui prova NONE. O manifesto de produção recusa master.

Ambos: H264, 480×854, 30fps; AAC estéreo 48kHz, voz pt-BR-AntonioNeural, rate+0%, pitch+0Hz, cache existente, sem música/SFX/novos assets. Narração integral source-exact por unidades, padding somente até orçamento medido de frames. Captions de até três palavras, ESTIMATED proporcional, sem alegar word alignment. MP4 hashes: [render-manifest.json](out/engine3d/phase17/analysis/render-manifest.json). Artefatos em review/natural-process e review/natural-mixed incluem cópia do vídeo, frames nativos/codificados, contact sheets paginadas e motion/boundary strips.

## AI. QA

QA de graph/plan PASS nos 11 inputs; source e partição íntegros; source concatenado das narrações idêntico ao roteiro A/B/C; duração 40–60s para os três sem alterar voz/rate/pitch. Decode completo sem erro, frame count exato, dimensões/fps/canais/sample rate e diferença A/V abaixo de 55ms. Áudio A: −20,6 LUFS; C: −20,9 LUFS; true peak de ambos −6,2dB. Não se aplicou normalização nova.

Inspeção visual: 11 contact pages contendo A20/C24 frames codificados, incluindo primeiro/último frame e limites do gap. Treze comparações de pixels/text masks verificaram paridade nativo→montagem e cue esperado→caption codificado. Os frames não estão vazios; são reconhecíveis diagrama, fluxo, enchimento, carro e cobertura. O gap é obviamente técnico e as captions avançam corretamente. A correção de timebase foi seguida de nova montagem, decode e QA A/V, reusando clips nativos somente após hash de DirectedSequence idêntico ao contrato final. Não há alegação de revisão humana de cada frame ou avaliação auditiva humana.

[render-qa.json](out/engine3d/phase17/analysis/render-qa.json); [pixel-timing-qa.json](out/engine3d/phase17/analysis/pixel-timing-qa.json); [qa-plan.json](out/engine3d/phase17/analysis/qa-plan.json)

## AJ. Determinism

Repetição e enumeração invertida de capabilities produzem JSON/fingerprints idênticos em todos os inputs. Testes cobrem interleaving, alteração de ID de fixture, substituição de nomes próprios, arrays de saída próprios e recompilação. Alterar source, estado, evento ou timeline invalida fingerprint. Nenhum ID de fixture escolhe template/ilha. O cache de vídeo é vinculado a fingerprint de sequência e frames globais. Determinismo aqui é de grafo/plano/contrato/frame; não é promessa de MP4 byte a byte entre máquinas, versões de driver ou novas sínteses TTS. [fingerprints.json](out/engine3d/phase17/analysis/fingerprints.json)

## AK. Performance

| Roteiro | Parse ms | Graph ms | Ref replay ms | Segment replay ms | Deps replay ms | Islands ms | AD replay ms | Compile ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 30.759 | 64.121 | 1.490 | 0.323 | 0.633 | 282.345 | 188.987 | 238.940 |
| B | 3.572 | 28.261 | 0.372 | 0.205 | 0.259 | 167.570 | 70.508 | 108.992 |
| C | 6.023 | 30.222 | 0.435 | 0.137 | 0.429 | 164.539 | 142.292 | 177.623 |

Medições individuais de workloads, com sobreposição explícita: graph inclui parse/referências/segmentação/dependências; islands inclui Auto Director; replays medem funções isoladas e não alimentam os outputs. **Não somar as colunas como fases exclusivas**, nem tratá-las como benchmark estatístico. Há aquecimento de JIT e I/O fora do núcleo. [stage-performance.json](out/engine3d/phase17/analysis/stage-performance.json).

Render nativo: água A47,070s; C água18,128s e carro27,530s. Wall inicial por roteiro (inclui stills e primeira montagem): A63,110s/C76,448s. Remontagem final corrigida e novo QA: A11,475s/C24,179s adicionais. São medidas distintas; o primeiro wall não inclui a correção posterior. Bundling/TTS e trabalho de inspeção não são apresentados como tempo puro de render. [render-performance.json](out/engine3d/phase17/analysis/render-performance.json).

Referências avaliam no máximo 32 entidades ou 12 eventos por menção, sem busca combinatória de todas as atribuições. Scans de spans, joins e dependências no código atual podem ser quadráticos no tamanho do roteiro. Divisão de run é finita por cláusulas, mas replanning pode repetir trabalho; é apropriado aos roteiros curtos medidos, sem garantia de escala para livros.

## AL. Tests

| Comando | Resultado | Testes |
| --- | --- | --- |
| npm run typecheck | PASS | typecheck/catalog |
| npm run check:engine3d | PASS | tests 452; pass 452; fail 0 |
| npm run check:editorial | PASS | tests 46; pass 46; fail 0 |
| npm run check:sound | PASS | tests 35; pass 35; fail 0 |
| npm run check:visual | PASS | tests 37; pass 37; fail 0 |
| npm run check:motion | PASS | tests 30; pass 30; fail 0 |
| npm run check:demonstration | PASS | tests 30; pass 30; fail 0 |
| npm run check:autodirector | PASS | tests 23; pass 23; fail 0 |
| npm run check:semantics | PASS | tests 40; pass 40; fail 0 |
| npm run engine3d:catalog | PASS | typecheck/catalog |
| npm run check:narrative | PASS | tests 35; pass 35; fail 0 |

35 testes novos, incluídos nos 452 do check:engine3d; as suítes focalizadas repetem subconjuntos e não devem ser somadas como total único. Cobrem source-only, referências, aliases, clíticos, cláusulas, eventos, domínios, guards, deps, gaps, policies, estado, câmera/foco, ordem/duração, métricas, tampering, determinismo, mutações e adversários. Testes de unidade não dependem de rede. CLI smoke também produziu C PARTIAL. [checks.json](out/engine3d/phase17/analysis/checks.json); logs em out/engine3d/phase17/logs/.

## AM. Registry

**Engine3D=50; SFX=8; VISUAL=5. Nenhum ID novo.** Registry, catálogos de mídia e bytes de recursos anteriores permanecem iguais ao baseline. A placa de revisão é diagnóstico temporário no output, não recurso do motor, asset de composição aprovado ou prova visual. Não houve instalação/upgrade de dependências; package-lock.json preservado.

## AN. Compatibility

APIs e comportamento v1 de analyzeScript/toAutoDirectorInput seguem intactos; analyzeNaturalScript é opt-in. STRICT e contracts antigos permanecem. A única fábrica antiga alterada, FLOW, respeita executionWindow.lastUnitId quando já informado; input de unidade única conserva o comportamento anterior. Oito MP4s históricos mantêm SHA original. Demais 147 arquivos do baseline, inclusive renderer, Engine3D, TTS, semântica v1, áudio e visual, estão iguais.

Limitação herdada: a projeção EditorialPlan/DirectorPlan usa PROP_BOTTLE_001 como foco simbólico para interoperabilidade com schemas antigos. Isso não constitui um objeto físico mostrado/prova de água. DirectedSequence/VisualDemonstration é a fonte executável autoritativa, com recipientes/tubulação procedurais reais. O relatório mantém essa distinção.

## AO. Limitations

Vocabulário/gramática finitos e heurísticos; não há conhecimento externo. Ambiguidade genuína abstém. Source desconhecido pode produzir raiz MISSING_SUBJECT ou LOW, sem análise científica detalhada. Dependências implícitas, elipses distantes sem descritor e diálogos continuam limitados. Segmentos discursivos não possuem classificação completa. Semântica coberta não garante visual executável; C exige resolução humana/externa antes de master. B preserva três janelas epistemológicas em vez de inventar demonstração física de possibilidade.

Timing interno e captions continuam estimados. Variedade visual é modesta; recursos low-poly e holds repetem composições. Métrica Fase13 ignora parâmetros internos de demonstração; os samples suplementares não a substituem como julgamento estético. Cobertura é interna, não benchmark anotado independente. Fixtures são testes sintéticos naturais do vocabulário suportado, não amostra cega de todos os roteiros reais. Não há avaliação auditiva humana declarada, síntese de tópicos ou autonomia factual geral.

## AP. Honest assessment

| Dimensão | Nota | Fundamento |
| --- | --- | --- |
| NATURAL SCRIPT UNDERSTANDING | GOOD | A FULL; C separa o impossível; B conserva guards. Gramática delimitada. |
| MULTI-ENTITY TRACKING | GOOD | Água/origem/tubo/destino/nível e carro mantêm papéis; equivalentes abstêm. |
| COREFERENCE | GOOD | Descritores distantes, aliases e clíticos; pesos sem calibração externa. |
| CLAUSE UNDERSTANDING | GOOD | Partição exata, três papéis/eventos e escopos; sintaxe aberta limitada. |
| EVENT MODELING | GOOD | Identidade distinta de entidade e referência bloqueante ao processo. |
| DOMAIN SEGMENTATION | GOOD | Água → ciência → carro; tipos discursivos ainda parciais. |
| CLAIM DEPENDENCIES | GOOD | Causalidade e estado explícitos; implícitos limitados. |
| EXECUTION ISLANDS | STRONG | Duas ilhas C sobrevivem e compilam/renderizam com source preservado. |
| GAP LOCALIZATION | STRONG | Motivos, spans, deps e frames exportados sem fallback físico falso. |
| GAP RECOVERY | GOOD | RESET independente e TRANSFER do mesmo estado demonstrados. |
| TIMELINE ASSEMBLY | GOOD | Frames/voz completos; bug de timebase corrigido e verificado por pixels. |
| AUTODIRECTOR INTEGRATION | STRONG | Reuse por ilha; apenas extensão pequena em janela FLOW. |
| VISUAL PROOF | GOOD | DIRECT apoiado em demonstração/estado e amostras; ciência NONE. |
| CONTINUITY | GOOD | Estado coberto preservado sem replay; câmera/foco explícitos. |
| REPETITION | ACCEPTABLE | Métrica e inspeção expõem holds e poucos layouts; falta variedade. |
| GENERALIZATION | ACCEPTABLE | Mutações/adversários e nomes/IDs; somente domínios/gramática delimitados. |
| OVERALL AUTONOMY | GOOD | LEVEL3B demonstrado em script; master de C segue bloqueado. |

As notas são avaliação de engenharia desta execução, sem certificação externa nem média numérica artificial.

## AQ. Autonomy level

**LEVEL3B: SIM**, qualificado para roteiro natural multi-segmento com execução parcial honesta. Não é LEVEL4, nem topic-to-finished-video universal. Os 18 gates passaram:

| Gate | Condição | Resultado | Evidência |
| --- | --- | --- | --- |
| 1 | A executable | PASS | qa-plan natural-process |
| 2 | A rendered script-only | PASS | render-qa / source-trace |
| 3 | B vehicle coreference | PASS | graphs natural-cold references |
| 4 | B modality guarded | PASS | narrative test / natural-cold claimStatus |
| 5 | C domain segmentation | PASS | segments natural-mixed |
| 6 | C localized impossible block | PASS | localized-gaps |
| 7 | Prior island survives | PASS | compiled C TL1 |
| 8 | Later independent island survives | PASS | compiled C TL3 |
| 9 | C PARTIAL | PASS | production-plan |
| 10 | Recovery after gap | PASS | gap-recovery physical-state tests |
| 11 | Only dependents blocked | PASS | dependency-gap and mutation tests |
| 12 | Equivalent candidates abstain | PASS | same-type reference candidates + test |
| 13 | Event reference | PASS | event-reference + test |
| 14 | Legacy guards | PASS | 40 semantics and 35 narrative tests |
| 15 | No manual pilot claims | PASS | inputs 4 keys / automatic extraction tests |
| 16 | No new resources | PASS | baseline registry files unchanged |
| 17 | Determinism | PASS | fingerprints / interleaving, ID, name mutation tests |
| 18 | All previous checks | PASS | checks.json + integrity.json |

Respostas obrigatórias:

1. Roteiro natural de 40–60s sem claims manuais? **SIM**, A44,367s FULL, B51,967s PARTIAL, C58,400s PARTIAL, todos script-only.
2. Separa partes executáveis e impossíveis? **SIM**, nos domínios e fixtures medidos; C preserva dois mundos ao redor da ciência sem suporte.
3. Gap no meio deixa de destruir o resto? **SIM**, TL1 e TL3 sobreviveram e aparecem no MP4.
4. Retoma depois de gap? **SIM**, C com RESET e auxiliar com TRANSFER de estado coberto.
5. Referência melhorou? **SIM**, nos testes delimitados de longa distância, aliases, clíticos e referência a evento, com abstention em empate.
6. Houve invenção de conhecimento externo? **NÃO**. Sem busca ou modelo factual; −20 só veio do roteiro B. Informação desconhecida não foi completada.
7. C terminou PARTIAL? **SIM**, com masterRenderAllowed=false.
8. Atingiu LEVEL3B? **SIM**, no escopo delimitado, com todos os gates críticos PASS.
9. Único maior gargalo para TOPIC → FINISHED VIDEO? **Ausência da camada Topic → Script fundamentada e restringida às capacidades atuais.** O motor já recebe scripts e localiza gaps; não recebe tema nem produz roteiro. Isso não elimina as lacunas visuais de temas arbitrários.

## AR. Next recommendation

**Escolha única: A) Topic → Script Writer.** A recomendação vem dos 18 gates, do A FULL e do C preservado com recuperação, em vez de supor que roteiro natural exigirá sempre um plano monolítico perfeito. A etapa futura deve começar pelos domínios/capabilities já suportados, gerar source verificável e respeitar o mesmo diagnóstico de gaps; não deve ocultar ciência sem recurso, inventar fatos ou prometer master para qualquer tema.

O C ainda exige resolução explícita do bloco científico para chegar a master; esta entrega não a automatiza. Essa limitação não derruba mais as ilhas suportadas. A recomendação não é uma implementação ou declaração de LEVEL4. **Fase17 encerrada; Fase18 não iniciada.**
