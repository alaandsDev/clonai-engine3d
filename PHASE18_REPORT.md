# PHASE18 — Capability-aware Topic → Script Writer

## A. Objective

Implementar exclusivamente a camada CAPABILITY-AWARE TOPIC → SCRIPT. Resultado: **22/22 gates e 12 comandos PASS**, com piloto topic-only water em MP4, 135 palavras e 59,5s. O pipeline atingiu **LEVEL4A, capability-constrained topic → script → direction**, no subconjunto estrutural implementado. Não é geração universal de vídeos factuais nem evidência de qualidade editorial publicável.

Data: 28/10/2026. Não há research, provider LLM, API paga, assets novos ou música. Fase19 não foi iniciada.

## B. Starting state

Fase17: LEVEL3B, Semantic Engine/Narrative Graph, execution islands, localized gaps e retomada, acima do Auto Director e renderer existentes. Registry50/8/5. A entrada antes exigia script; agora um pedido de tema pode produzir texto antes do mesmo pipeline. O baseline desta fase possui 178 arquivos. Só package.json mudou entre os arquivos existentes, adicionando check:writer e writer:write; renderer, TTS, semântica, Narrative Director, Auto Director, media e lockfile permanecem byte a byte iguais. Dez MP4s históricos das Fases12–17 conservaram SHA-256. [integrity.json](out/engine3d/phase18/analysis/integrity.json)

## C. Architecture

`TopicScriptRequest → TopicAnalysis → WriterCapabilityProfile / TopicCapabilityMatch → VisualNarrativeStrategy → ScriptOutline → ScriptCandidate (texto) → analyzeNaturalScript → directNarrative → compileNarrative → facts/quality/scoring → selection → final preflight medido → Engine3D/Remotion + edge-tts/captions → MP4`.

Código em src/writer: contracts, request, topic, capability-profile, visual-vocabulary, strategies, outline, realizer, fact-policy, preflight, revision, duration, qa, finalize e index. CLI: cli/writer.ts. Testes: tests/writer.test.ts. Guia: [src/writer/README.md](src/writer/README.md). Writer é puro, sem filesystem/rede/relógio/random; I/O, TTS, render e cronômetros ficam em CLI/harnesses. ScriptWriterProvider prepara os nomes LOCAL_MODEL/EXTERNAL_LLM, porém apenas DETERMINISTIC_LOCAL existe nesta fase. Não se implementou segundo Semantic Engine nem segundo Auto Director.

## D. TopicScriptRequest

v1 exige id, topic não vazio e language=pt-BR. Aceita format vertical_short, targetWords, targetDurationSeconds, factPolicy, sourceMaterial, constraints e style. Defaults110–160 palavras,40–60s, STRUCTURAL_ONLY. Campos desconhecidos, script/claims/direção escondidos, intervalos inválidos e budgets fora dos limites falham antes da geração. style.tone é metadata reservada, sem mudança efetiva de tom nesta versão. maxRevisions≤2 e maxDomains≤2 são limites de implementação. ID não participa da escolha de conteúdo, candidato ou IDs semânticos; hashes de conteúdo incluem tema/policy/configuração. Entradas em examples/writer e out/engine3d/phase18/inputs.

## E. Fact policies

SOURCE_ONLY: cada fato físico extraído precisa de texto fornecido/autorizado e sourceMaterialId+sourceSpan. STRUCTURAL_ONLY: admite organização narrativa e convenções visuais do processo solicitado, sem acrescentar números, nomes, causas, medidas ou mecanismos concretos externos. Uma convenção de diagrama é identificada como tal, não como descoberta factual. UNVERIFIED_CREATIVE é reservado e recusado; não aparece nos gates.

Topic é assunto/intenção; não é fonte de quantidade, causalidade ou pesquisa. A permissão estrutural para água/container/path não autoriza dizer como uma instalação real bombeia água. As fontes fornecidas são autorizadas para uso, não verificadas externamente. Não há fact checker geral.

## F. Source material

Cada item possui id único, text, provenance e allowedForClaims booleano. Somente true autoriza uso factual. SOURCE_ONLY sem fonte autorizada retorna SOURCE_REQUIRED e zero candidatos. Texto de fonte não é tratado como instrução de execução. No modo source-aware, fatos vêm das unidades da fonte; material negado é excluído. Omissão é proibida por default, com span e razão exportados se a policy permitir.

O realizer usa texto da fonte com ajustes gramaticais limitados: explicita líquido único já introduzido em cadeia de transferência inequívoca; introduz com artigo indefinido os recipientes inferior/superior já nomeados; divide “onde o nível aumenta” em frase própria. Não acrescenta entidade, quantity, mecanismo ou evento. Outros sujeitos/operações desconhecidos desabilitam a clarificação de pronome. Duas entidades concorrentes conservam ambiguidade. Essas regras são transparentes, não uma promessa de entailment para português irrestrito.

## G. Topic analysis

Registra raw/normalizedTopic, entidades, relação/processo/transformação pedidos, questionType, knownFromInput com spans, unknownRequirements, candidateDomains, confiança e fingerprints dos grafos da fonte. Reutiliza analyzeNaturalScript para ler tema e fonte; uma camada pequena de admissibilidade identifica as famílias TRANSFER/ACCUMULATION/SOURCE/UNKNOWN. Resíduos fora do vocabulário fechado recusam o tema. A palavra água junto a um conceito adicional desconhecido não autoriza ignorar esse conceito. Divergência de sujeito entre tema e fonte também recusa. Não há busca factual.

## H. Capability profile

Derivado do CapabilityGraph real e ordenado de forma canônica, read-only. Bundles exigem tags semânticas e capabilities completas: LIQUID_TRANSFER, LIQUID_UPWARD, STORAGE, VEHICLE_ACCUMULATION, DOOR, NUMBER_DISPLAY quando disponíveis. Subjects, operations, relations e proofTypes são abstrações úteis ao writer. IDs concretos constam somente na evidência/snapshot do profile; outlines/texto não os escolhem. Remover FLOW do grafo bloqueia de fato o tema da água. Um cilindro isolado não habilita reator, coração, motor ou bomba. [water.json](out/engine3d/phase18/capabilities/water.json)

## I. Visual vocabulary

Pequena gramática composicional, filtrada pelas operações do profile. Exemplos de formas: sai de, percorre/passa pelo, entra em, aumenta, começa a acumular/acumula, fica/permanece coberto. As frases físicas combinam participantes, operação, destino e enquadramento esquemático; não há roteiro completo por fixture ou lookup por topic ID. Contextos neutros são um conjunto pequeno de blocos de atenção. Eles preservam segurança e causam repetição editorial real; não se apresentam como escrita aberta ou modelo de linguagem.

## J. Strategy library

Nove arcos declarados: PROCESS_EXPLAINER, STATE_TRANSFORMATION, BEFORE_AFTER, PATH_JOURNEY, QUANTITY_PROGRESSION, RANKING, COMPARISON, OBJECT_EXPLAINER, QUESTION_REVEAL. Declaração não equivale a geração habilitada: os casos atuais de transferência elegem PROCESS_EXPLAINER/PATH_JOURNEY/QUESTION_REVEAL; carro elege STATE_TRANSFORMATION/BEFORE_AFTER/QUESTION_REVEAL. Os demais arcos conservam requisitos ausentes, sem inventar números/explicações para torná-los elegíveis.

## K. Strategy eligibility

Cada arco registra requirements, missingRequirements, motivo, hook, centralSubject, visualGoal, supportedProcesses/stateChanges/quantities, narrativeArc e estimatedCapabilityCoverage. PROCESS exige processo+sujeito; PATH exige source/path/destination; transformação exige state_change+sujeito; ranking/comparison exigem dados licenciados. Estimated coverage descreve apenas requisitos abstratos; somente o preflight real decide se o texto é executável. [water.json](out/engine3d/phase18/strategies/water.json)

## L. Outline generation

Cada bloco registra purpose, targetClaims como intenções textuais abstratas, requiredCapabilities, estimatedWords, risk, visualIntent e permissão/proveniência. targetClaims não contém SemanticClaim executável, offsets de direção ou assets. Source/caminho/destino/nível e onset/progress/result/hold são operações/sujeitos abstratos. O outline responde o que se pretende mostrar sem configurar câmera, environment ou VFX. A ordem dos acontecimentos físicos não é invertida para fabricar diversidade.

## M. Candidate generation

Três candidatos por tema suportado, sem randomness. A ordem vem da biblioteca de arcos elegíveis. A diversidade compara estratégia, hook type, conclusion type, sequência de purposes e sequência de operações físicas, cinco features de peso igual; similarity≥0,8 gera warning. Na água, todas as comparações deram0,2. Os verbos físicos mantêm ordem causal; as diferenças são arco, início na origem versus pergunta/objetivo, pausa e encerramento. Não se alega que os três geram famílias visuais completamente distintas.

## N. Script realization

O realizer transforma o outline em texto pt-BR, preferindo sujeito explícito e construções reconhecidas pelo parser. Não produz claims, nem injeta seus tipos/participantes diretamente no planner. Um bloco FILL pode ser lido pelo Semantic Engine como INCREASE; a interpretação final pertence ao motor. Perguntas continuam sem prova física. Contexto neutro expande/encurta palavras sem criar facts.

A escrita resultante contém instruções repetidas de observar/acompanhar e menções à representação. É segura no escopo, mas a naturalidade é um ponto fraco para publicação. Não se confunde score heurístico próximo de100 com nota de um editor humano.

## O. Claim/entity/domain budgets

Policy writer-policy/1.0.0: preferir4–8 PRIMARY, máximo8, até4 entidades centrais e2 domínios; default minExecutableTimelineRate0,85 e maxPrimaryGapRate0,15, até2 revisões. Menos de4 PRIMARY gera warning; o writer não preenche o orçamento com facts novos. EntityCount considera papéis centrais do outline e entidades físicas efetivamente extraídas, usando o maior valor; não equivale a todas as menções editoriais. GapRate soma gap e bloqueio dependente. Os quatro casos gerados têm4 PRIMARY e um domínio físico, sem gaps. FULL é ideal; PARTIAL só é candidato aceitável dentro dos thresholds e nunca autoriza master automaticamente.

## P. Preflight loop

Cada candidato chama analyzeNaturalScript → grafo real → directNarrative(policy STRICT_ISLANDS, snapshot real) → compileNarrative → facts/quality/scoring. O preflight mantém resultado completo de cada tentativa, inclusive rejeições; nenhum julgamento próprio do writer substitui o motor. Teste independente reproduz grafo e plano a partir do texto puro. O preflight final é uma chamada nova após seleção e medição, com fingerprint próprio; preserva todas as durações por unidade e compila a sequência de produção apenas se elegível.

## Q. Revision system

Revisão determinística consulta localizedGaps reais. Pode restaurar realização canônica licenciada para referência falha ou remover apenas contexto editorial que o motor classificou como fato sem suporte. Não elimina fato SOURCE_ONLY nem troca cientistas por carro. Máximo2 por candidato. Cada registro possui before/after, motivo, affectedGapIds, semanticImpact, provenance e fingerprints.

Os pilotos gerados passaram sem revisão semântica; water também passou na duração sem alteração. Para provar o mecanismo, revisions/diagnostic-case.json contém mutação adversarial separada: um FLOW gerado recebe “Ele...” incompatível com água, produz gap real e é restaurado à forma licenciada. Antes/depois têm grafos distintos; depois é FULL/admissível. Não é roteiro manual do piloto. Duration revision, exercitada em teste, reduz/expande somente contexto neutro após medição, mantendo todos os fatos e voice/rate/pitch.

## R. Candidate scoring

Factual safety é hard gate, sem peso compensável. Rejeições: unsupportedFactCount>0, factPolicy violada, ambiguidade crítica, NONE, falta de fato visual, excesso de gap ou baixa timeline executável, budgets excedidos e word count fora da faixa.

Somente entre admissíveis: clareza semântica24, frames executáveis24, DIRECT18, continuidade8, baixa ambiguidade8, baixo gap8, naturalidade/pacing5, coerência3, baixa repetição2; máximo100. Rejeitado tem score−1 e nunca ganha por estilo. Empate exato usa candidate ID estável. Breakdown completo nos preflights. A estimativa de naturalidade detecta começos/sentenças/conectores repetidos, tamanhos extremos e perguntas excessivas; não avalia interesse narrativo ou estética.

## S. Candidate selection

| Tema | Vencedor | Arco | Score | Renderability | Palavras |
| --- | --- | --- | --- | --- | --- |
| water | candidate-2 | PATH_JOURNEY | 99.575 | FULL | 135 |
| cold-car | candidate-3 | QUESTION_REVEAL | 100 | FULL | 122 |
| structural-process | candidate-2 | PATH_JOURNEY | 99.575 | FULL | 135 |
| researchers | None | — | None | — | 0 |
| reactor | None | — | None | — | 0 |
| source-only | candidate-2 | PATH_JOURNEY | 99.75 | FULL | 127 |

SelectionResult exporta alternativas, rejeitados, reason e revisionHistory. A água escolheu candidate-2/PATH_JOURNEY, score99,575; alternativas94,8611 e99,5278. Todos os três eram admissíveis. Temas recusados exportam zero candidatos e diagnóstico, sem esconder um fallback. O finalizador valida novamente o selecionado com durações medidas.

## T. Fact guards

O fact audit valida a linguagem fechada de realização contra pedido/estratégia/fontes originais, além de conferir ledger/spans. Não aceita apenas a provenance que um candidato declara sobre si. Adição não licenciada a hook ou sentença física é hard rejected, mesmo com texto aparentemente polido. Quantidade factual exige sourceMaterial; nomes/locais e mecanismos/causas específicos novos são recusados. A whitelist de superfície autorizada é a proteção principal; os detectores de números/termos sensíveis complementam o diagnóstico.

Testes cobrem números no tema/candidato, localização, bateria/motor/causalidade não fornecida, direção numérica oposta, source contraditória, entidade ambígua, fonte negada e assunto incompatível. O guard de contradição usa eventos INCREASE/DECREASE e quantities do Semantic Engine existente, sem criar parser factual independente. Não prova a veracidade externa da fonte.

## U. Source grounding

SOURCE_ONLY final: unsupportedFactCount=0, sourceGroundingRate=1, omissions=[]; cada PRIMARY aponta a provided-process e ao span original da unidade fornecida. As clarificações gramaticais são reproduzíveis e não acrescentam mecanismo/quantidade. Fonte com informação insuficiente/ambígua não é resolvida por palpite.

Em STRUCTURAL_ONLY, sourceGroundingRate=1 significa permissão de representar o processo solicitado e suas convenções declaradas, não um grounding bibliográfico. untraceableSpecificClaimCount=0 nos pilotos, porém isso não transforma convenção de diagrama em explicação científica. Toda trilha está em [topic-to-script-trace.json](out/engine3d/phase18/analysis/topic-to-script-trace.json).

## V. Unsupported topics

Status de match são SUPPORTED/PARTIALLY_SUPPORTED/UNSUPPORTED/AMBIGUOUS. Resultado pode ser READY, UNSUPPORTED_TOPIC, SOURCE_REQUIRED ou NO_ACCEPTABLE_CANDIDATE. Researchers: match PARTIALLY_SUPPORTED, resultado SOURCE_REQUIRED, zero candidatos; reactor: match UNSUPPORTED, SOURCE_REQUIRED, zero candidatos. A exigência de fonte e a ausência de capacidade são problemas separados: fornecer fonte não promete que o conceito será renderizável.

missingConcepts/capabilities, reason e possibleSupportedAngles ficam exportados. Ângulos alternativos são explicitamente pedidos separados; não mudam automaticamente o assunto. Tópico vago, história factual e combinação com conceitos desconhecidos também abstêm.

## W. Water topic

Input principal contém somente version/id/topic/language/duração/palavras/format/factPolicy. Topic: “Como a água chega até uma caixa d'água?”. Nenhum script, claim, fonte ou direção. O writer cria um exemplo esquemático de transferência para recipiente de destino, sem afirmar mecanismo real de abastecimento. Tubo e disposição espacial são convenções visuais; não foram inferidos pressão, bomba, altura ou gravidade.

Final: **135 palavras,10 sentenças,4 PRIMARY,4 entidades centrais,1 domínio; HIGH100%, timeline100%, claims executáveis100%, DIRECT100%, gaps0; 59,5s reais.** Uma ilha nativa ocupa1785 frames. Roteiro integral gerado:

> A água sai de um recipiente nesta representação.
> Acompanhe esta representação esquemática com atenção ao mesmo objeto, sem imaginar detalhes além do que o exemplo apresenta.
> Como acompanhar o caminho entre o início e o destino deste exemplo visual?
> A água passa pelo tubo até o recipiente de destino.
> Observe cada parte com calma, mantendo a atenção no mesmo exemplo visual durante esta explicação.
> A água entra no recipiente de destino.
> O nível aumenta dentro do recipiente de destino.
> Qual parte do caminho merece mais atenção nesta representação: o início, a ligação entre as partes ou o destino?
> Nesta explicação, observe somente a representação, sem supor medidas, duração ou mecanismos reais a partir deste exemplo esquemático.
> Por fim, acompanhe o exemplo por inteiro e compare as partes descritas, sem imaginar acontecimentos fora desta representação visual.

## X. Cold car topic

“Mostre um carro acumulando gelo no frio.” produz três candidatos de transformação/before-after/question-reveal. Selecionado: QUESTION_REVEAL,122 palavras,4 PRIMARY, FULL. A progressão representa acúmulo e cobertura ilustrativos, não previsão universal de congelamento. Não há temperatura, horas, bateria, motor, combustível ou mecanismo inventado. Duração estimada46,923s; TTS e segundo render opcionais não foram executados. Não se declara duração real desse caso.

## Y. Structural process topic

“Mostre um líquido saindo de um recipiente, percorrendo um caminho e enchendo outro recipiente.” usa as mesmas capabilities reais e a mesma gramática composicional, com sujeito líquido, sem lookup por ID. PATH_JOURNEY selecionado,135 palavras,4 PRIMARY, FULL e timeline100%. Duração51,923s apenas estimada. Não foi renderizado separadamente.

## Z. Partial topic

“Explique uma estação cheia de pesquisadores operando equipamentos científicos.” não é substituído por Caio, rádio ou carro. Match PARTIALLY_SUPPORTED, resultado SOURCE_REQUIRED, nenhum candidato/roteiro final/plano ou MP4. A falta de scientific_crowd/scientific_equipment como explicação executável aparece em missingConcepts. possibleSupportedAngles só apresenta sugestões para outro pedido.

## AA. Unsupported reactor topic

“Explique em detalhes como funciona um reator nuclear.”: match UNSUPPORTED, resultado SOURCE_REQUIRED, zero candidatos. Nenhum cilindro é rotulado como reator e nenhuma explicação factual interna é produzida. O resultado conservador satisfaz a recusa solicitada; não se promete que fonte, por si só, resolveria a ausência de contratos visuais do conceito.

## AB. Source-only fixture

Fonte autorizada: “A água sai do recipiente inferior. Ela percorre o tubo. Depois entra no recipiente superior, onde o nível aumenta.” Resultado FULL,127 palavras,4 PRIMARY, grounding100%, nenhum fato específico novo. “Ela” vira sujeito explícito único; recipientes já nomeados são introduzidos; entrada e aumento de nível tornam-se frases separadas. Essa divisão resolve uma restrição de timing/prova do motor existente, preservando significado. Não se alterou Semantic Engine ou Auto Director para passar esse exemplo.

Não foram adicionados pressão, bomba, gravidade, volume, temperatura ou duração factual.127/2,6=48,846s é estimativa, não medição edge-tts. Textos, spans e preflights ficam em scripts/source-only.txt, graphs/source-only.json e preflight/source-only.json.

## AC. Duration

Estimativa wordCount/2,6 palavras/s; água135 palavras estima51,923s. Narração real com AntonioNeural,+0%,+0Hz mediu59,5s incluindo arredondamento/padding por unidade. Não foi alterada voz, rate, pitch ou texto após essa medição; duraçãoRevisionHistory=[] no piloto. O erro da estimativa foi7,577s, aproximadamente14,6% acima do estimado; medir TTS continua obrigatório.

O finalizador exige todas as unidades medidas, IDs únicos e intervalo40–60s, além do novo preflight. Testes exercitam duração longa/curta, redução de contexto sem perder fatos, budget de palavras/revisões e rejeição de timing incompleto. Captions≤3 palavras continuam ESTIMATED/proporcionais dentro das unidades; não há word alignment.

## AD. Semantic quality

| Tema | HIGH | PRIMARY | Entidades centrais | Domínios | Referências ambíguas | Unsupported facts | Specific não rastreável |
| --- | --- | --- | --- | --- | --- | --- | --- |
| water | 100.00% | 4 | 4 | 1 | 0 | 0 | 0 |
| cold-car | 100.00% | 4 | 2 | 1 | 0 | 0 | 0 |
| structural-process | 100.00% | 4 | 4 | 1 | 0 | 0 | 0 |
| source-only | 100.00% | 4 | 4 | 1 | 0 | 0 | 0 |

HIGH é confiança interna do parser, não probabilidade de verdade nem precisão anotada externamente. Facts específicos não rastreáveis e ambiguidades críticas são hard gates. Contexto/pergunta não é promovido a fato para aumentar cobertura.

## AE. Execution coverage

| Tema | Claims executáveis | DIRECT | Gap+blocked | Timeline | Ilhas | Ready medido para produção |
| --- | --- | --- | --- | --- | --- | --- |
| water | 100.00% | 100.00% | 0.00% | 100.00% | 1 | SIM |
| cold-car | 100.00% | 100.00% | 0.00% | 100.00% | 1 | não medido |
| structural-process | 100.00% | 100.00% | 0.00% | 100.00% | 1 | não medido |
| source-only | 100.00% | 100.00% | 0.00% | 100.00% | 1 | não medido |

Claims executáveis/DIRECT/gap usam apenas requiresVisualProof=true; timeline inclui todos os frames, inclusive contexto.100% de frames executáveis não significa uma mudança visual por frame. Só water possui finalização com TTS real e vídeo. Nenhum resultado parcial seria promovido automaticamente a master.

## AF. Visual proof

O Auto Director existente escolhe recursos e cria a demonstração. Cada PRIMARY liga outline/utterance/source → SemanticClaim → island/seleção → checks de prova → sequence/timing. O compilador confirma estados e registra DIRECT; contextos/perguntas têm NONE. As amostras codificadas mostram conexão, fluxo pelo tubo, nível do destino aumentando e estado final estável. Source/flow/nível são representação esquemática, não simulação de conservação/pressão com validade científica.

Inspeção de todos os29 pares de frames nativos/codificados, oito contact sheets e boundary/state frames passou; pixel MAE<8 nos29 pares. Key state samples confirmam flowProgress→1 e destination.fillLevel0→0,85. [pixel-state-qa.json](out/engine3d/phase18/analysis/pixel-state-qa.json); [key-states.json](out/engine3d/phase18/analysis/key-states.json).

Repetição Fase13: 8.067 mudanças/min; maior intervalo sem mudança semântica 29.833s; 3 warnings de assinatura. O metricador legado ignora flowProgress/fillLevel no canal prop; state samples complementam esse limite. Global=ilha única. Não se adicionou câmera/vfx artificial para melhorar score. O hold final é longo e a variedade visual limitada.

## AG. Pilot render

[phase18-topic-water.mp4](out/engine3d/phase18/renders/phase18-topic-water.mp4):1785 frames,59,5s,H264480×854/30fps,AAC48kHz estéreo. Narração edge-tts existente, voz AntonioNeural,+0%,+0Hz, sem música/SFX. Escrita/planejamento não usam rede; a síntese TTS solicitada usa o provider edge-tts já existente.

QA: decode completo PASS, duração de vídeo/áudio59,5s, source do áudio concatenado idêntico ao script, captionsmáximo3 palavras, áudio−21,4LUFS/true peak−5,7dB. Sem avaliação auditiva humana declarada. ProductionReady significa contrato/duração/prova aprovados, não aprovação estética ou publicação.

[render-qa.json](out/engine3d/phase18/analysis/render-qa.json); [render-manifest.json](out/engine3d/phase18/analysis/render-manifest.json). Review em review/water contém os16 arquivos solicitados, vídeo, frames, oito contact sheets e motion strips por claim. Documento humano: [topic-to-video-review.md](out/engine3d/phase18/review/topic-to-video-review.md).

## AH. Determinism

Testes confirmam mesma entrada/snapshot/regras → mesmos candidatos, scores, vencedor, texto e fingerprints. Inversão do snapshot e interleaving com tema recusado preservam resultado. Alterar topic ID não muda texto/plano; alterar topic text para outro processo muda resultado relevante. Saídas possuem arrays próprios e não alteram o registry ou futuras chamadas. Fingerprints de resultado/profile/candidato/preflight/grafo/plano são validados; mutação é rejeitada.

Writer1.0.0 e policy1.0.0 são versionados. TTS/MP4 não prometem bytes iguais entre máquinas/providers; manifesto registra os bytes desta execução. Nova geração completa de todos os resultados com o código final foi comparada aos artefatos salvos. Não se usa clock/random no writer.

## AI. Performance

| Workload de diagnóstico | ms |
| --- | --- |
| capabilityProfileMilliseconds | 45.857 |
| topicAnalysisMilliseconds | 71.135 |
| capabilityMatchingMilliseconds | 0.314 |
| strategyGenerationMilliseconds | 2.244 |
| outlineGenerationMilliseconds | 1.284 |
| scriptRealizationMilliseconds | 4.429 |
| semanticPreflightReplayMilliseconds | 134.090 |
| narrativePreflightReplayMilliseconds | 1708.503 |
| fullCandidatePreflightMilliseconds | 4018.258 |
| selectionMilliseconds | 0.214 |
| finalCompileReplayMilliseconds | 581.149 |
| revisionMilliseconds | 0.457 |

Workloads da água: estágios de candidatos operam sobre três candidatos; revisão sobre um caso adversarial. Preflight completo inclui graph/narrative/facts/compile; narrative inclui Auto Director; replays e finalCompile duplicam trabalho. **Não somar como fases exclusivas**. [stage-performance.json](out/engine3d/phase18/analysis/stage-performance.json). Writer wall inicial por tema: água2.311,5ms; carro1.822,0ms; estrutural2.330,9ms; fonte2.067,8ms; recusas6–9ms, medidas antes dos workloads diagnósticos. São amostras de uma execução, com aquecimento/carga do PC.

RenderMedia nativo97,122s; wall completo172,701s, incluindo bundle/stills/mux/decode/extração de samples, sem TTS ou inspeção humana. [render-performance.json](out/engine3d/phase18/analysis/render-performance.json). O writer recompõe no máximo3 candidatos e2 revisões por candidato; leitura de fontes e joins semânticos repetem scans e podem ser quadráticos. Compilação avalia frames; não é benchmark de escala para textos longos.

## AJ. Tests

| Comando | Resultado | Contagem |
| --- | --- | --- |
| npm run typecheck | PASS | typecheck/catalog |
| npm run check:engine3d | PASS | tests 484, pass 484, fail 0 |
| npm run check:editorial | PASS | tests 46, pass 46, fail 0 |
| npm run check:sound | PASS | tests 35, pass 35, fail 0 |
| npm run check:visual | PASS | tests 37, pass 37, fail 0 |
| npm run check:motion | PASS | tests 30, pass 30, fail 0 |
| npm run check:demonstration | PASS | tests 30, pass 30, fail 0 |
| npm run check:autodirector | PASS | tests 23, pass 23, fail 0 |
| npm run check:semantics | PASS | tests 40, pass 40, fail 0 |
| npm run check:narrative | PASS | tests 35, pass 35, fail 0 |
| npm run check:writer | PASS | tests 32, pass 32, fail 0 |
| npm run engine3d:catalog | PASS | typecheck/catalog |

As suítes focalizadas repetem subconjuntos; não somar todos os números como testes únicos. check:writer cobre contrato/policies/fontes/contradição/admissibilidade/capabilities/arcos/outlines/diversidade/preflight/revisão/scoring/duração/finalização/guards/fingerprints. A suíte rápida inclui os452 testes anteriores. Testes sem rede. CLI smoke produziu READY/candidate-2 e script exportado. [checks.json](out/engine3d/phase18/analysis/checks.json).

## AK. Registry

Engine3D50, SFX8, VISUAL5. ZERO novos IDs. Nenhum asset, música, environment, personagem, câmera ou demonstração foi adicionado. Nenhuma instalação/atualização de dependência ou npm audit fix; package-lock íntegro. Writer lê capabilities e aceita lacuna/recusa quando ausentes.

## AL. Compatibility

Todos os módulos anteriores de runtime, semântica, direção, compositor, áudio e visual ficaram intactos em relação ao baseline da fase. APIs/STRICT/policies e o comportamento de ilhas/gaps continuam os mesmos. Dez vídeos anteriores conservaram SHA. O novo módulo é opt-in e suas únicas entradas de package são writer:write/check:writer.

Limitação herdada permanece: projeções legadas EditorialPlan/DirectorPlan podem usar PROP_BOTTLE_001 como foco simbólico de interoperabilidade. Isso não é escolha do writer nem prova da água; DirectedSequence/VisualDemonstration é a fonte executável do diagrama.

## AM. Limitations

Somente duas famílias estruturais de geração, com vocabulário de tema fechado e fontes de construção limitada. Novos termos legítimos podem ser recusados. Tema arbitrary, dados históricos, ciência e pesquisa continuam fora da autonomia factual. Fonte autorizada não é verdade verificada; contradição/grounding são checks limitados. style.tone não altera estilo. Enumeração de nove arcos não significa nove geradores completos.

O realizer usa gramática e blocos editoriais fixos, não geração linguística aberta. A diversidade conserva a ordem das operações físicas. Há preenchimento neutro para atingir palavras/duração, com repetição e alto teor de metanarração. Isso enfraquece naturalidade e interesse, apesar de score interno alto. A água mostra transferência genérica para container; não ensina o mecanismo real de abastecimento de uma caixa. Primitivas/câmera/props herdados limitam qualidade visual.

Não há word alignment, fact checker universal, auto-gap-resolution científica, pesquisa, provider LLM, custo pago ou publicação. Native/encoded parity e contratos DIRECT não são avaliação estética humana. TTS só foi medido na água; demais durações são estimativas.

## AN. Honest assessment

| Dimensão | Nota | Base |
| --- | --- | --- |
| TOPIC UNDERSTANDING | ACCEPTABLE | Duas famílias e admissibilidade conservadora; termos extras desconhecidos recusam. |
| FACT SAFETY | GOOD | Linguagem fechada, fontes/spans e hard guards; não verifica verdade externa. |
| CAPABILITY AWARENESS | GOOD | Profile real, exclusão de FLOW bloqueia tema e shapes não habilitam conceitos. |
| STRATEGY SELECTION | GOOD | Elegibilidade e scoring explícitos; somente arcos implementados elegem. |
| OUTLINE QUALITY | ACCEPTABLE | Progressão e visual intents claros; bastante contexto genérico. |
| SCRIPT NATURALNESS | WEAK | Repetição de observar/representação e preenchimento neutro; ainda pouco editorial. |
| SCRIPT VISUALITY | ACCEPTABLE | Quatro claims mostrados, com excesso relativo de metanarração. |
| SEMANTIC COMPATIBILITY | GOOD | Motor real lê os textos; FULL sem alterar motor. |
| EXECUTABILITY | STRONG | Quatro casos FULL; piloto59,5s com100% de timeline. |
| REVISION QUALITY | ACCEPTABLE | Gap real restaurado com escopo estreito; não revisão semântica geral. |
| CANDIDATE SELECTION | GOOD | Hard safety precede score; todos os resultados preservados. |
| SOURCE GROUNDING | GOOD | Spans e gramática limitada reproduzível; fonte não é validada externamente. |
| UNSUPPORTED TOPIC HANDLING | STRONG | Reator/cientistas recusados sem scene falsa/troca de assunto. |
| DURATION CONTROL | GOOD | TTS real59,5s e finalização; estimador erra14,6% neste caso. |
| VISUAL PROOF | GOOD | Estado e frames codificados confirmam diagrama delimitado. |
| GENERALIZATION | WEAK | Vocab/grammar fechados e domínios pequenos; não teste cego de linguagem aberta. |
| OVERALL AUTONOMY | ACCEPTABLE | LEVEL4A técnico e limitado; publicação factual/estética ainda exige trabalho. |

Notas de engenharia desta execução, sem certificação externa; scores internos não substituem esta avaliação qualitativa.

## AO. Autonomy level

**LEVEL4A: SIM**, capability-constrained topic → script → claims → direction. Somente o assunto/configuração genérica entrou no piloto; as operações/frases vieram de profile/outline/gramática; o Semantic Engine produziu os claims e o Auto Director a direção. A medição/render final foi real. Todos os gates críticos passaram:

| Gate | Condição | Resultado | Evidência |
| --- | --- | --- | --- |
| 1 | Water generates script from topic | PASS | input has no script/source/claims |
| 2 | Water word budget | PASS | quality-report / 135 words |
| 3 | Water real TTS duration | PASS | audio / 59.5s at fixed voice |
| 4 | Water executable frames | PASS | final-plan FULL / 1785 frames |
| 5 | Topic-only MP4 | PASS | render QA + native parity |
| 6 | Car factual guard | PASS | car final text / number-name-cause tests |
| 7 | Structural process FULL | PASS | real preflight |
| 8 | Researchers no false scene | PASS | PARTIALLY_SUPPORTED, no candidate |
| 9 | Reactor refused | PASS | UNSUPPORTED match / SOURCE_REQUIRED |
| 10 | SOURCE_ONLY grounding | PASS | source spans and omission tests |
| 11 | Number guard | PASS | adversarial number in topic/generated hook tests |
| 12 | Named entity guard | PASS | adversarial location/source mismatch tests |
| 13 | Causality guard | PASS | unprovided cause hard rejection test |
| 14 | Structural diversity | PASS | three outlines, similarity 0.2 |
| 15 | Real semantic preflight | PASS | independent script-only graph/plan reproduction test |
| 16 | Revision actual gaps | PASS | diagnostic-case.json + bounded revision test |
| 17 | Fresh final preflight | PASS | measured finalization + compile |
| 18 | No hidden manual claims | PASS | input rejection + extractionSource test |
| 19 | No manual water script | PASS | topic-only request + compositional grammar |
| 20 | No new resources | PASS | baseline / registry hashes |
| 21 | Determinism | PASS | repeat / interleave / ID / reverse snapshot tests |
| 22 | Regression | PASS | 12 required commands; tests 484, pass 484, fail 0 |

Isso não é universal topic → finished video. “História da Segunda Guerra” exige SOURCE_REQUIRED; conhecimento interno não vira pesquisa autorizada. Um fato científico também pode continuar visualmente unsupported mesmo depois de fornecido. Autonomia técnica da cadeia não significa vídeo automaticamente publicável ou factualidade irrestrita.

## AP. Next recommendation

**Escolha única: A) Research / Source Grounding.** A maior barreira para TEMA ARBITRÁRIO → VÍDEO FINAL PUBLICÁVEL é a ausência de conteúdo factual autorizado/verificável: hoje o sistema recusa adequadamente temas históricos/científicos ou só produz uma estrutura esquemática. Uma camada futura de fontes precisa tornar claims rastreáveis antes de ampliar o assunto. Isso não promete resolver capacidades visuais ou qualidade da escrita; a naturalidade fraca registrada neste relatório continua uma limitação real.

Esta recomendação não foi implementada. Não foi iniciada Fase19, pesquisa, API paga, modelo local, mídia externa, expansão de registry ou música. Fase18 encerrada com os resultados reais apresentados.
