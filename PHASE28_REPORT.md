# PHASE28_REPORT — Grounded Progressive Curiosity Story Engine

## Executive Summary

**PHASE28 IMPLEMENTATION: PARTIAL.** A camada genérica de investigação narrativa, proveniência, seleção e handoff foi implementada e validada. O alvo de produto não foi atingido: **0/3 ganhos de conhecimento conectado; 0/3 histórias PROGRESSIVE; 0 pares problema/solução**. A seção 104 do pedido exige honest PARTIAL nesse resultado. P20/P21 usam a alternativa de blocker comprovado, não são declarados ganhos.

Foram executadas seis consultas adicionais reais, adquiridas quatro fontes novas e admitidas zero relações novas. Há uma explicação reproduzível das perdas, incluindo nove passagens úteis/recusadas revisadas por span. Não há Evidence manual. O poço foi renderizado, os três planos visuais foram produzidos e o terceiro é um preview impossível de compilar para produção. Phase29 **NOT STARTED / NOT_READY**. Git **UNCOMMITTED**.

## Starting Checkpoint

HEAD local e origin/main: `3290fb2756013d0dfc9d69f6dbff701634bba31d`, branch `main`, início **CLEAN**, confirmado antes de criar os operadores/alterar comportamento. HEAD final e SHA remoto continuam iguais. Nenhum commit, push, reset, clean, descarte ou tag.

CLONAI_HANDOFF.md e relatórios 25/26/27/27B foram lidos. Phase27 permanece COMPLETE; Phase27B PARTIAL; Visual Foundation ACCEPTED. Seus bytes, o lockfile e os vídeos históricos foram preservados e conferidos no replay. Manifesto: `baseline/integrity.json`.

## Motivation

As fontes já admitidas permitem explicações curtas, mas não sustentam a construção problema → intervenção → mudança → novo problema em múltiplos domínios. Necessidade narrativa gera uma pergunta, nunca uma resposta. O trabalho mede essa fronteira em vez de alongar o roteiro ou preencher slots fictícios.

## Phase26/27 Lessons

A recuperação contextual anterior aumentou recall conservador, mas cadeia física/causal, identidade de estado e vínculo problema/solução continuaram limitados. A fundação visual aceita pode exibir movimento/cutaway, mas isso não cria conhecimento. Nesta fase não foram reimplementadas 27/27B nem alterados seus resultados. O novo relatório distingue contagem legada de CAUSAL (inclui USED_FOR) de causa factual efetiva.

## Architecture Audit

| Camada | Decisão |
| --- | --- |
| Research v4 / secure HTTP / normalization / EvidencePack / quorum/origins | REUSE |
| processQueries / bounded PROCESS loop / verified historical acquisition | EXTEND |
| MechanismKnowledge / CausalConstructionGraph / SemanticNarrativeGraph | REUSE; zero novo grafo factual |
| buildCuriosityStoryPlan / writeCausalCuriosity | EXTEND; zero segundo Writer |
| VisualCausalPlanner / compile / media / QA | EXTEND somente handoff, verdade de props e preview gate |
| StoryNeed / groundedProgression | CREATE helper puro: índices sobre IDs admitidos |
| KnowledgeLossTrace / replay | EXTEND joins, recusas e rederivação |

Auditoria anterior ao comportamento: `baseline/architecture-audit.md`. Opt-in: `sourcePolicy.progressiveStory: true`; exige PROCESS factual, Research v4, mecanismo 2 e contexto. Sem opt-in, o comportamento e os replays históricos permanecem. Não há Research v5, modelo/LLM, SaaS novo, backend, scraper paralelo ou atualização de dependências.

## Reuse Before Create

Catálogo existente consultado: `out/engine3d/catalog.json`, 50 recursos. Reutilizados o apresentador CHAR_CAIO_001, ambientes, assemblies, DirectedSequence, Three/R3F, Remotion, narração edge-tts e validação ffmpeg existentes. Nenhum recurso foi criado ou aprovado. Vídeo continua sendo JSON; nenhum componente TSX por vídeo. Materiais, câmeras e geometria da fundação aceita não receberam polish.

## Baseline

Congelado offline antes das alterações de comportamento a partir de aquisições históricas verificadas e dos packs oficiais da 26B. Não foi rotulado como nova pesquisa. `baseline/{well,elevator,turbine}/` contém pack, knowledge/story, Writer, plano e métricas.

Baseline: 4/9/4 relações, 64/138/97 palavras. Poço/elevador tinham plano válido; a turbina já apresentava `FACTUAL_ENTITY_WITHOUT_RELATION:system_body`. Estase estimada: 4,567/11,167/N/A s. Esse defeito histórico não foi apagado: no opt-in atual um prop sem relação é editorial e não pode servir de prova.

As comparações de conectividade abaixo projetam o **mesmo índice Phase28** sobre o knowledge congelado e o final. Um evento isolado conta como cadeia de comprimento 1, com 0 relações conectadas; não significa progressão. Métricas históricas com outra definição permanecem intactas.

## StoryNeed / Gap Model

Doze necessidades por input: role, pergunta, consulta, sujeito, predicados desejados, dependências, prioridade, status, relações/evidências de suporte e relações de contexto. Estados: SUPPORTED, UNSUPPORTED, SKIPPED e EDITORIAL_ONLY. O helper não conhece fontes de benchmark nem produz fatos. Seus retornos alimentam exclusivamente a investigação e os índices de planejamento.

## Story Roles

| Role | Poço | Elevador | Turbina |
| --- | --- | --- | --- |
| GOAL | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED |
| INITIAL_STATE | SUPPORTED | SUPPORTED | SUPPORTED |
| EXPLANATION | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED |
| CAUSE | SUPPORTED | UNSUPPORTED | UNSUPPORTED |
| PROBLEM | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED |
| SOLUTION | SKIPPED | SKIPPED | SKIPPED |
| STATE_CHANGE | SUPPORTED | SUPPORTED | SUPPORTED |
| ATTEMPT | SKIPPED | SKIPPED | SKIPPED |
| NEW_PROBLEM | SKIPPED | SKIPPED | SKIPPED |
| NEXT_SOLUTION | SKIPPED | SKIPPED | SKIPPED |
| FINAL_STATE | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED |
| PAYOFF | EDITORIAL_ONLY | EDITORIAL_ONLY | EDITORIAL_ONLY |

INITIAL_STATE aqui permite setup descritivo; não prova um estado histórico ou uma configuração física inicial. ATTEMPT e etapas adicionais permanecem opcionais. NEW_PROBLEM/NEXT_SOLUTION só podem usar a construção existente SOLVES/CAUSES/SOLVES com participantes literais e prova; não são preenchidas por palavra negativa ou por ritmo.

## Question vs Claim

StoryNeed tem classe RESEARCH_QUESTION ou EDITORIAL_INTENT. Pergunta/hook não possui fact/relation/evidence IDs. Frases factuais do Writer apontam somente para relações admitidas ASSERTED. Modalidade incerta/hipotética não é elevada a fato. A saída da pergunta entra no provedor de busca; só Source → Evidence → admissão pode produzir knowledge.

## Gap Detection

A falta de cadeia ≥3, de causa efetiva, de função/estado ou de vínculo explícito de reparo cria uma lacuna. Não é um template universal: ausência de falha não autoriza inventar uma, e uma solução sem problema suportado pode ser pulada. Contagem de frases ou relações isoladas não satisfaz continuidade.

## Gap Prioritization

Mecanismo conectado precede causa efetiva e problemas/soluções dependentes. Filtra-se consulta já executada, inclusive na aquisição histórica. Por isso, por exemplo, a consulta causal genérica do elevador já existente não foi repetida; o próximo gap disponível foi investigado. Não se atribuiu StoryNeed retroativamente às consultas antigas.

## Query Generation

| Input | Need | Texto emitido | Query ID | Resultados | Diagnóstico |
| --- | --- | --- | --- | --- | --- |
| Poço artesiano | EXPLANATION | `poço artesiano funcionamento etapas` | Q_990261090f5002f3 | 4 | SUCCESS |
| Poço artesiano | PROBLEM | `poço artesiano falhas causas` | Q_a201b286d61b72a6 | 4 | SUCCESS |
| Elevador | EXPLANATION | `elevador funcionamento etapas` | Q_bfaf0fd184a129ec | 4 | SUCCESS |
| Elevador | PROBLEM | `elevador falhas causas` | Q_0c99f828701e4b6e | 4 | SUCCESS |
| Turbina hidráulica | EXPLANATION | `turbina hidráulica funcionamento etapas` | Q_ddf33c8b21337d60 | 4 | SUCCESS |
| Turbina hidráulica | CAUSE | `turbina hidráulica funcionamento causas` | Q_71df26404570cddf | 4 | SUCCESS |

Cada query nova foi registrada antes da chamada com o need completo, priorPackFingerprint, priorKnowledgeFingerprint e priorSourceIds. A verificação reconstrói esse contexto; re-signing de pergunta, trace ou ganho de iteração não passa. As consultas ainda são vocabulário de tópico + família de lacuna, uma limitação de relevância demonstrada nos resultados.

## Research Budget

Por input: até 2 rounds e 2 novas perguntas por round; maxQueries 16, maxFetchedSources 24, maxCandidateSources 64, maxSearchResults 120, maxSourcesPerDomain 16, maxDurationMs 180000, bytes globais 16 MiB e por fonte 2 MiB. Registros históricos contam nos limites cumulativos de consultas/fetches; client.bytes e elapsedMs medem o trabalho novo. Robots, MIME, DNS, redirects e SSRF mantêm o contrato anterior. Para em 403/429/timeout, limite, conhecimento suficiente, pergunta repetida ou ausência de novas relações. Todos pararam após um round por NO_KNOWLEDGE_GAIN.

## Gap-Directed Research

| Input | Queries iniciais históricas | Gap queries novas | Novos resultados | Fetches novos | Fontes novas | Novas relações |
| --- | --- | --- | --- | --- | --- | --- |
| Poço artesiano | 6 | 2 | 8 | 1 | 1 | 0 |
| Elevador | 8 | 2 | 8 | 2 | 2 | 0 |
| Turbina hidráulica | 6 | 2 | 8 | 1 | 1 | 0 |

Total: **20 consultas iniciais históricas + 6 novas**, 24 resultados novos, **25 fetches históricos + 4 novos = 29**, 24 snapshots iniciais + 4 novos = 28. Fontes efetivamente contribuintes: **1/1/1**. Uma única aquisição nova por input foi feita; os demais runs foram processamento/replay offline, sem refazer benchmarks live.

## Evidence

| Input | Fonte nova | Caracteres normalizados | Evidence de mecanismo | Relações admitidas | Recusas observadas |
| --- | --- | --- | --- | --- | --- |
| Poço artesiano | [Thomas Sankara – Wikipédia, a enciclopédia livre](https://pt.wikipedia.org/wiki/Thomas_Sankara) | 36666 | 0 | 0 | SUBJECT_IDENTITY_FAILURE: 12 |
| Elevador | [Otis Worldwide – Wikipédia, a enciclopédia livre](https://pt.wikipedia.org/wiki/Otis_Worldwide) | 25339 | 0 | 0 | SUBJECT_IDENTITY_FAILURE: 5 |
| Elevador | [Método científico – Wikipédia, a enciclopédia livre](https://pt.wikipedia.org/wiki/M%C3%A9todo_cient%C3%ADfico) | 250076 | 0 | 0 | SUBJECT_IDENTITY_FAILURE: 49, CAPTION_OR_NAVIGATION: 6 |
| Turbina hidráulica | [Falha de motor de turbina em aeronaves – Wikipédia, a enciclopédia livre](https://pt.wikipedia.org/wiki/Falha_de_motor_de_turbina_em_aeronaves) | 23913 | 0 | 0 | SUBJECT_IDENTITY_FAILURE: 20 |

As quatro páginas são snapshots reais; nenhuma foi transformada em fonte on-topic por título semelhante ou por necessidade narrativa. Não houve adjudicação/entrada manual de fatos. Packs e snapshots preservam suas cadeias de hash/span/origem.

## Extraction

A gramática/contextualização existente foi preservada; não foi adicionada uma coleção de regex por benchmark. O resultado evidencia uma limitação real da implementação, não prova inexistência do conhecimento.

No poço, uma passagem sobre aquífero/pressão passa contexto mas não emite candidato; a ausência de bombeamento aciona proteção de negação. No elevador, o cabo/limitador/freio é um caso de sujeito appositivo e predicados coordenados sem emissão. Na turbina, entrada/saída, nível/energia e duto de sucção falham em construções locativas, relativas/appositivas e comparativas. O parser acopla sujeito e relação: não se inventa um diagnóstico de correferência isolado. Prova finita: `review/knowledge-loss-finite.json`.

## Relation Admission

Relações finais: 4/9/4, idênticas em quantidade ao baseline; zero novas relações. Política, quorum e origem não foram relaxados. Fonte aceita no transporte não significa Evidence ou relação admitida. O replay rederiva o pack a partir dos snapshots. Os 17 fatos/relações não são uma estimativa de precisão populacional; a revisão finita cobre os 9 selecionados pelo Writer.

## Problem Detection

Zero problemas factuais admitidos nos três inputs. Palavras de falha nas novas fontes de aviação/empresa não se tornam falhas do sistema solicitado. Negação/possibilidade não viram um estado factual negativo. Casos sintéticos testam relações explícitas e rejeições, sem alimentar os benchmarks.

## Cause Detection

Causas efetivas: 1/0/0. O poço conserva a atribuição explícita à diferença de pressão, com a comparação completa. USED_FOR/DESIGNED_FOR são finalidade/projeto, não evidência de um efeito físico ocorrido. Por isso os contadores legados de CAUSAL não são usados para declarar causal progression.

## Solution Detection

Zero SOLVES factuais e zero pares de reparo nos inputs. Um par exige alvo explícito que coincide com o problema admitido e contexto compatível. Resolver uma causa não garante resolver o sistema inteiro. PREVENTS permanece prevenção, sem promoção a SOLVES. A construção funcional SOLVES/CAUSES/SOLVES pode marcar roles adicionais quando de fato estiver presente, sem inventar cronologia/sucesso final.

## State Changes

Eventos físicos funcionais no knowledge: 2/1/1; no subconjunto selecionado: 2/1/0. Descrição before é UNKNOWN e after é a proposição suportada, com evidence IDs. Não há pressão calculada, vazão simulada ou estado histórico deduzido. No poço, as duas descrições de água não são unificadas por pronome presumido, então dois eventos não viram automaticamente uma cadeia.

## Connectivity

Somente argumentos explícitos compatíveis permitem continuidade de planejamento. A normalização limitada de uma preposição de rota não é um alias factual. Sujeito compartilhado, proximidade textual, propósito ou semelhança de subtipo não conectam mecanismos por si. A busca de caminho tem limite e searchComplete; classificação rica é recusada quando incompleta. Não se cria a aresta A→C de A→B→C.

## Grounded Story Graph

O CausalConstructionGraph existente continua sendo a projeção factual única. Story/progression armazenam IDs, ordem discursiva, estados descritos, pares e lacunas. `factualEdgesAdded = 0`. O Writer recebe esse mesmo modelo e o SemanticNarrativeGraph existente permanece no handoff. Campos editoriais não são fatos, e nenhuma necessidade narrativa injeta um nó factual.

## Story Compression

Poço 64→64, elevador 138→35, turbina 97→45 palavras. Não se aumentou texto para atingir faixa de duração. Uma definição curta e não qualificada pode usar S/P/O explícitos; os demais casos mantêm a superfície completa ou são omitidos. Definição genérica vazia, modalidade não afirmada e unidade longa sem compressão segura são registradas em omissions. No terceiro candidato isso retira seu único movimento, portanto sua produção continua bloqueada. Contagem de relações por frase é aproximação de densidade, não medida humana de ideias independentes.

## Curiosity Writer

| Input | Palavras | Relações selecionadas | Eligible | Classificação | Beats | Direct/partial | Estase estimada s |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Poço artesiano | 64 | 4 | True | EXPLANATORY | 9 | 2 | 4.567 |
| Elevador | 35 | 3 | True | EXPLANATORY | 7 | 1 | 2.733 |
| Turbina hidráulica | 45 | 2 | False | LIST_LIKE | 5 | 0 | PREVIEW_ONLY / N/A |

Mesmo `writeCausalCuriosity`, sem segundo Writer. Setup explícito do sistema antecede o caminho quando disponível. O subconjunto publicado é reavaliado: knowledge rico omitido não sustenta uma classificação do roteiro. O controle positivo de teste usa um mecanismo fictício realmente admitido com três ações em ordem; isso demonstra a capacidade, não é apresentado como resultado real.

## Visualizability

Três planos válidos, **dois elegíveis para produção e um PREVIEW_ONLY**. Poço: 2 beats DIRECT/PARTIAL; elevador: 1; turbina: 0. Atribuição de pressão é SYMBOLIC, não uma demonstração da física da pressão. Props sem relação são editoriais e não podem ser prova. Nenhum material/câmera/geometria foi polido para esconder falta de mecanismo.

## Visual Handoff

O adaptador/planner existente transporta story roles, stateDescriptionIds e problem/solution relation IDs até beats, com evidência e sentença. Não cria FAILURE_STATE ou SOLUTION_INSTALLATION porque um slot pede. Quando não há affordance factual, permanece um gap/NONE/símbolo. A inspeção explícita de candidato limitado cria previewOnly; `compileVisualPlan` falha antes de produzir DirectedSequence. O terceiro plano não autoriza render nem declara elegibilidade do Writer.

## Primary Well Benchmark

Como funciona um poço artesiano? Seis consultas iniciais históricas, duas novas, uma fonte nova sem mecanismo admitido. Permanecem quatro relações e uma cadeia isolada. O roteiro é uma explicação do fluxo/pressão e captação condicionada ao uso residencial, não uma construção problema/solução. Plano de nove beats válido; MP4 real validado. Não se inventou bomba, válvula, falha, reparo ou novo estado.

## Elevator Benchmark

Como funciona um elevador? Oito consultas históricas, duas novas, duas fontes novas e zero relações novas. O Writer conserva movimento da cabine no enclosure e uma definição inferior de contexto; três relações selecionadas, 35 palavras. O material sobre contrapeso/espelho já carrega modalidade conservadora no pack; não foi silenciosamente convertido em ASSERTED. A passagem útil cabo→limitador/freio é identificada no trace, sem virar Evidence manual. Plano de sete beats válido; nenhum MP4 secundário foi produzido.

## Third Benchmark

Como funciona uma turbina hidráulica? Escolha registrada antes do comportamento: domínio físico de conversão de energia, com aquisição histórica verificável e distinto de circulação subterrânea e transporte vertical. Seis consultas iniciais, duas novas, uma página de falhas de turbina em aeronaves recusada para este tema. Permanecem quatro relações. O candidato de 45 palavras seleciona definição/finalidade; seu único movimento é omitido conservadoramente. Plano de cinco beats é PREVIEW_ONLY, zero prova física; compilação para produção recusada. Não se apresentou como história progressiva.

## Before/After

| Input | Fontes adquiridas | Relações | Conectadas | Maior cadeia | Causa efetiva | Físicas | Estados/eventos | Pares P/S |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Poço artesiano | 9→10 | 4→4 | 0→0 | 1→1 | 1→1 | 2→2 | 2→2 | 0→0 |
| Elevador | 5→7 | 9→9 | 0→0 | 1→1 | 0→0 | 1→1 | 1→1 | 0→0 |
| Turbina hidráulica | 10→11 | 4→4 | 0→0 | 1→1 | 0→0 | 1→1 | 1→1 | 0→0 |

Fontes contribuintes: 1→1 em cada input. Problemas e soluções: 0→0 em todos. Roles suportadas finais: 3/2/2; unsupported: 4/5/5; 12 necessidades por input. As palavras/classificações/beats estão na tabela do Writer; não se confundem quantidade de fonte adquirida com conhecimento recuperado.

## Precision Review

Revisão finita manual por Codex de nove tuplas selecionadas e seus spans/qualificadores: **9 CORRECT, 0 QUESTIONABLE, 0 WRONG**. Quatro do poço, três do elevador, duas do candidato não elegível da turbina. Zero relações novas selecionadas, portanto não há ganho de precisão estimado sobre novas relações. Nenhuma classificação manual entrou no pipeline. Não é uma afirmação de precisão global ou validação científica independente das fontes.

## Writer-Used Relations Review

| Input | CORRECT | QUESTIONABLE | WRONG | Escopo |
| --- | --- | --- | --- | --- |
| Poço artesiano | 4 | 0 | 0 | Roteiro elegível |
| Elevador | 3 | 0 | 0 | Roteiro elegível |
| Turbina hidráulica | 2 | 0 | 0 | Candidato parcial |

`review/*-precision.json` guarda decisão por ID, URL, hash e span. A condição residencial do poço, o contexto do termo Poço no elevador e a finalidade projetada da turbina foram conferidos explicitamente. Frases com várias relações agora citam todas as respectivas evidências; o replay detectou e ajudou a corrigir uma inconsistência anterior de seleção de primeiro nó.

## Causal Chain Coverage

Knowledge e Writer: **0/0/0** de cobertura de cadeia causal com mais de uma relação. Causa efetiva isolada no poço não basta. LongestGroundedChain do knowledge = 1/1/1; do Writer = 1/1/0. Zero história real é promovida a PROGRESSIVE com base em finalidade ou quantidade de definições.

## Problem/Solution Coverage

Zero problemas, soluções e pares de reparo nos três inputs, antes e depois. Meta ≥1 par em pelo menos 2/3: **NÃO ATINGIDA**. Conforme seção 104, resultado de produto **PARTIAL**. P20/P21 não são usados para transformar essa ausência em sucesso narrativo.

## State Change Coverage

No knowledge 2/1/1 descrições/eventos físicos funcionais; no Writer 2/1/0. Meta ≥2 em 2/3 não atingida. Contar esses eventos não implica identidade de fluido ou continuidade temporal; estado desconhecido permanece desconhecido. Nenhuma função futura da turbina foi contada como transformação ocorrida.

## Story Classification

Poço **EXPLANATORY**; elevador **EXPLANATORY**; turbina **LIST_LIKE**. Zero PROGRESSIVE e zero PROGRESSIVE_CAUSAL real. O elevador reduz lista/duração, mas isso não basta para criar causalidade. Resultados de fixtures positivas não foram usados como benchmark live.

## Primary MP4

`out/engine3d/phase28/final/phase28-well-final.mp4`

SHA256 `fa3105147a3e8fd9945980fa91468c5b4476cd8363bc3e5ea16ace012f2c49a7`. H.264, AAC estéreo 48 kHz, 480×854, 30 fps, **25.333333 s, 760 frames**. Decode completo PASS; áudio RMS 0.06079, pico 0.42991, -21.1 LUFS, true peak -7.3 dB. Sem nova avaliação auditiva humana completa; QA técnico aprovado.

Render real pelo mesmo Three/R3F → Remotion, voz/configuração existentes e sentenças exatas. Depois de completar o ledger de evidence IDs, o comentário de proveniência foi atualizado por stream copy. Todos os 760 pacotes de vídeo e 1189 de áudio, inclusive timestamps, foram comparados e permanecem idênticos. O render inicial está preservado em attempts/initial-render; o SHA acima é do arquivo final. `final/packet-identity.json` e `final/summary.json` comprovam isso.

## Visual Progression Review

Inspeção visual dos frames reais por midpoint de beat e da contact sheet: mundo/apresentador → sistema → cutaway → fluxo → atribuição simbólica de pressão → captação/retorno. Não existe nova falha/solução ou nova ideia física comparada ao piloto aceito. Nenhuma revisão de polish foi feita.

Phase27B: 25.267 s, 758 frames, 9 beats, 4 factuais, estase 4.433 s. Phase28: 25.333 s, 760 frames, 9 beats, 4 factuais, estase **4.367 s**. A diferença de dois frames vem de pausas de 9 em vez de 8 frames; não adiciona conhecimento.

Resposta: **não há progressão de ideias/estados mais rica**. O produto permanece **MECHANISM EXPLANATION**. A métrica de estase inclui mudanças editoriais significativas já definidas no QA; não é prova de uma nova cadeia causal. `frames/contact-sheet-beats.png` e `frames/contact-sheet-percent.png`.

## Replay

PASS nos três inputs, zero chamadas DNS/transport/fetch. Reconstroem-se acquisition/pack, need/queries anteriores, traces e ganhos, knowledge, graph, story, Writer e plano visual. Hash do KnowledgeLossTrace também coincide. O terceiro preview continua bloqueado no compiler. `replay/final.json` registra os resultados e os hashes históricos. Não houve novo benchmark live durante replay.

## Provenance

Cada frase aponta para story node/relação/fato/Evidence, snapshot hash, span/contexto/origem. O plano aponta para sentença/relação/evidence/state IDs. Queries são verificadas contra o pack anterior, não contra uma resposta posterior. Re-signing de Writer, contexto, searchTrace ou ganho de iteração não basta; há rederivação. Render final coincide com o Writer atual e seus pacotes/timing foram verificados. Todos os relatórios/vídeos históricos incluídos no manifesto permanecem byte a byte iguais.

## Security

PASS. Guardas existentes de rede e admissão preservadas; nada executa texto externo como instrução. Sem .env, tokens, credenciais, node_modules, caches, temporários ou outputs grandes nos caminhos Git alterados. .gitignore e package-lock intactos; nenhum audit fix/update de versão. Cache histórico só entra como aquisição integral verificada, no mesmo tópico, e não como seed factual. O novo teste de 403 de fonte cobre também a interrupção do bootstrap. Preview não passa para render. `analysis/security.json`.

## Anti-hardcode

PASS: **201 arquivos runtime, 0 BLOCKER**. Reutilizado o scanner existente, com controle negativo e alvos dinâmicos de URLs/sentenças. Nomes de benchmarks e decisões finitas ficam em testes/operadores/relatório, não no runtime. Vocabulário genérico legado e recusa legada foram preservados. `analysis/anti-hardcode.json`.

## Performance

| Input | Queries novas | Fetches novos | Bytes de rede novos | Aquisição s | Stop |
| --- | --- | --- | --- | --- | --- |
| Poço artesiano | 2 | 1 | 368984 | 29.425 | NO_KNOWLEDGE_GAIN |
| Elevador | 2 | 2 | 1856132 | 33.598 | NO_KNOWLEDGE_GAIN |
| Turbina hidráulica | 2 | 1 | 193273 | 11.409 | NO_KNOWLEDGE_GAIN |

| Replay offline | Research/validation ms | Story ms | Writer ms | Total ms |
| --- | --- | --- | --- | --- |
| well | 55917.2 | 1006.1 | 2052.1 | 69370.1 |
| elevator | 41197.6 | 1154.4 | 1808.7 | 52666.6 |
| turbine | 10718.0 | 200.2 | 440.8 | 13447.5 |

Render nativo 29.416 s; pipeline do render 47.920 s, mais stream-copy de metadados 3.177 s. Extração não foi cronometrada isoladamente: está acoplada à validação/replay de modelos. Não se inventou esse número. `analysis/performance.json`.

## Regression

**23/23 comandos PASS, 1030 testes distintos na união executada**; 43 novos. A suíte raiz check:engine3d tem 1028 testes (985 anteriores + 43); os comandos sound/visual executam ainda dois casos de integração em subdiretórios que não entram no glob raiz. São os 22 comandos obrigatórios anteriores mais check:progressive-curiosity. Não se somaram novamente os testes repetidos por scripts focados. A contagem histórica permanece intacta; o método desta contagem está em analysis/test-count.json.

| Comando npm run | Exit | Tests | Failures | ms |
| --- | --- | --- | --- | --- |
| typecheck | 0 | — | — | 7749 |
| check:engine3d | 0 | 1028 | 0 | 41157 |
| check:editorial | 0 | 46 | 0 | 970 |
| check:sound | 0 | 35 | 0 | 2172 |
| check:visual | 0 | 37 | 0 | 14463 |
| check:motion | 0 | 30 | 0 | 1781 |
| check:demonstration | 0 | 30 | 0 | 1803 |
| check:autodirector | 0 | 23 | 0 | 1940 |
| check:semantics | 0 | 40 | 0 | 1533 |
| check:narrative | 0 | 35 | 0 | 4971 |
| check:writer | 0 | 32 | 0 | 14933 |
| check:research | 0 | 50 | 0 | 7617 |
| check:web-research | 0 | 115 | 0 | 2449 |
| check:research-v2 | 0 | 39 | 0 | 2733 |
| check:research-v3 | 0 | 76 | 0 | 2918 |
| check:research-v4 | 0 | 65 | 0 | 4175 |
| check:topic-intelligence | 0 | 28 | 0 | 2672 |
| check:vertical-slice | 0 | 15 | 0 | 6495 |
| check:causal-curiosity | 0 | 69 | 0 | 1736 |
| check:contextual-mechanism | 0 | 20 | 0 | 1478 |
| check:visual-causal | 0 | 24 | 0 | 2168 |
| engine3d:catalog | 0 | — | — | 1158 |
| check:progressive-curiosity | 0 | 43 | 0 | 1813 |

`git diff --check` PASS; índice Git vazio; sem commit/push. Os testes usam dados fictícios e rede injetada/recusada. Não dependem da internet.

## Registry

**Engine3D 50 / SFX 8 / VISUAL 5**, sem adição/remoção/aprovação. Autonomia **LEVEL4C+**, preservada; nenhuma promoção de nível. O catálogo foi regenerado pelo comando obrigatório existente, mantendo contagem e recursos. Nenhum novo SFX/visual de mídia foi inserido no master.

## Limitations

O produto não ganhou conhecimento conectado nos três temas. A descoberta por família de palavras ainda retorna páginas de outro assunto; selecionar/refazer queries genéricas não resolve a gramática acoplada das fontes úteis. Há passagens relevantes no corpus inicial, portanto o resultado não permite afirmar que faltam fontes no mundo.

O Writer é conservador: pode excluir material útil, inclusive modalidade herdada ambígua e movimento não comprimível. A turbina fica em preview não renderizável. Contagem de predicados é uma aproximação de densidade, podendo sobrepor definição/finalidade na mesma proposição. Estado semântico não é simulador; rótulo de pressão não é prova visual de pressão. Não há recall populacional, validação científica independente, general coreference, novo motor semântico ou nova gramática de mecanismo nesta fase.

## KnowledgeLossTrace

Cada need liga role desejado → pergunta/contexto pré-query → resultados → fetch/parse → passagens → Evidence emitida/admissão → Writer → beats/prova visual. Campos desconhecidos permanecem null/UNKNOWN. Necessidade não consultada aparece QUESTION_NOT_ISSUED; o trace completo da aquisição histórica continua acessível para dedup/cache, sem alegar provenance retroativa.

Quatro fontes novas não produziram mecanismo: identidade/escopo recusados (Sankara, Otis/método científico e turbina de aeronave). Nas fontes contribuintes, nove passagens foram auditadas por span: aquifer/pressão, negação de bombeamento, comparação qualificada, transporte histórico, dimensionamento numérico, cabo/freio, contraste entrada/saída, comparação pressão/velocidade e duto de sucção. São diagnósticos de perdas, nunca Evidence manual nem denominador de recall.

O conhecimento útil pode passar por parse/contexto e morrer antes da emissão; o pipeline não observa separadamente sujeito e relação quando não há candidato. No elevador, parte do knowledge admitido também morre na seleção por modalidade/compacidade; na turbina o movimento morre na compressão, bloqueando produção. `review/knowledge-loss-finite.json`, `analysis/*-need-summary.json` e `{input}/loss-trace.json`.

## Phase29 Readiness

**NOT_READY. Phase29 NOT STARTED.** Não existe história conectada grounded explorada pelo Writer em múltiplos domínios. A fundação visual aceita continua disponível, mas não supera a limitação do conhecimento. Próxima recomendação única: ampliar o parser contextual existente para construções appositivas/coordenadas e argumentos de entrada/saída, com spans e testes adversariais cruzando estes domínios, antes de ampliar a fase visual.

## Honest Assessment

KNOWLEDGE CONNECTIVITY **WEAK**; STORY PROGRESSION **WEAK**; FACTUAL PRECISION **GOOD**, limitada às nove relações selecionadas; VISUALIZABILITY **ACCEPTABLE** no piloto primário, limitada em múltiplos domínios.

Os contratos genéricos e o diagnóstico reproduzível estão prontos para continuação. O alvo de produto permanece **PARTIAL**, apesar dos gates de infraestrutura/segurança passarem e P20/P21 permitirem blockers comprovados. Não se declarou avanço de conhecimento, história rica, solução factual, precisão global ou readiness visual futuro sem prova.

**Maior gargalo específico:** resolução acoplada de sujeito/relação não emite candidatos em passagens on-topic com apposições, coordenação e rotas/estados de entrada-saída. Pesquisa fraca e compressão conservadora somam perdas, mas simplesmente aumentar queries ou alongar o vídeo não corrige esse gargalo.

## Attempt Log

| Attempt | Falha observada | Causa / correção geral | Antes → depois / precisão / decisão |
| --- | --- | --- | --- |
| Baseline | Contrato compile requer timing; terceiro plano histórico inválido | Operador corrigido; invalidade real registrada sem alterar histórico | Três baselines congelados, nenhum resultado histórico reescrito |
| Aquisição real única | Mais fontes, zero relação nova | Scope mantém páginas de assunto diferente fora; parser acoplado não recupera passagens úteis | 4/9/4→4/9/4; parar NO_KNOWLEDGE_GAIN; não repetir live |
| Writer/order replay | Frase multirrelação citava só Evidence do primeiro nó | Ledger passou a citar todas as evidências selecionadas do mesmo span | Texto/prova não inventados; replay e novo teste de múltiplos IDs PASS |
| Source stop | Bootstrap precisava respeitar bloqueio de fonte | Guard progressivo antes de todo fetch, com teste HTTP 403 | Uma tentativa, zero retries/fetches seguintes; regressão PASS |
| Visual probe terceiro | Writer conservador não elegível | Mesmo planner em previewOnly explícito; compilador recusa produção | Três planos, zero falsa física/elegibilidade; não renderizar terceiro |
| Final render provenance | Comentário do MP4 referia ledger anterior | Stream copy após prova de texto/direção/pacotes/timestamps iguais | Frames/áudio idênticos; SHA final atualizado e inicial preservado |
| Final | Targets de produto não atingidos | Não preencher gaps nem promover classificação | PARTIAL / Phase29 NOT_READY; sem commit/push |

## Phase28 Gates

| Gate | Estado | Evidência / escopo |
| --- | --- | --- |
| P1 | PASS | Checkpoint exato, main, origin/main e início CLEAN; ver integrity.json. |
| P2 | PASS | Research v4, EvidencePack, knowledge graph, Writer e visual planner existentes. |
| P3 | PASS | StoryNeed e índices determinísticos, com controles positivos e negativos offline. |
| P4 | PASS | Perguntas/editorial sem fact/evidence IDs; hipóteses fora do backbone factual. |
| P5 | PASS | Seis consultas novas com need completo e fingerprints anteriores; rederivação. |
| P6 | PASS | Dois rounds, dois gaps/round, limites globais; stop 403/429/timeout/no-gain. |
| P7 | PASS | Texto externo tratado como dados; controle de instrução maliciosa. |
| P8 | PASS | Admissão não relaxada; nove relações selecionadas revisadas, Wrong=0. |
| P9 | PASS | Negação, modalidade e condições preservadas ou omitidas conservadoramente. |
| P10 | PASS | Problema exige relação admitida; nenhum problema inventado nos três inputs. |
| P11 | PASS | Par exige alvo literal explícito; PREVENTS e causa resolvida não viram reparo total. |
| P12 | PASS | Descrições semânticas com antes UNKNOWN e prova da proposição; staging editorial separado. |
| P13 | PASS | Índices de continuidade não geram fatos transitivos; purpose não é causa. |
| P14 | PASS | Três CausalConstructionGraph/story plans, derivados do mesmo knowledge. |
| P15 | PASS | Mesmo Writer ordena setup e caminho; controle positivo end-to-end com três eventos. |
| P16 | PASS | Sem padding: 64/35/45 palavras; omissão ou definição curta sem perder qualificadores. |
| P17 | PASS | Handoff tipado com roles/state/pair IDs; sem instalação/falha física sem suporte. |
| P18 | PASS | Três benchmarks e três planos: terceiro PREVIEW_ONLY, compilação recusada. |
| P19 | PASS | Revisão finita de 9 tuplas selecionadas: 9 CORRECT, 0 QUESTIONABLE, 0 WRONG. |
| P20 | PASS | PASS pelo caminho de blocker comprovado: 0/3 ganhos, seis queries e diagnóstico por span. |
| P21 | PASS | PASS pelo caminho de blocker comprovado: 0/3 PROGRESSIVE, sem inflar classificação. |
| P22 | PASS | Plano primário válido; ligação Writer/relations/evidence/frames conferida. |
| P23 | PASS | MP4 primário real produzido, decodificado e ligado ao Writer atual. |
| P24 | PASS | Estase final 4.367 s ≤8 s. |
| P25 | PASS | Zero relações factuais inventadas; revisões não entram no EvidencePack. |
| P26 | PASS | Replay dos três inputs PASS, DNS/transport/fetch bloqueados, zero chamadas. |
| P27 | PASS | Packs, needs/queries/iterations, graphs, Writer, visual e render verificados; históricos intactos. |
| P28 | PASS | Suítes de segurança existentes + novas recusas de pesquisa/preview PASS. |
| P29 | PASS | 201 arquivos runtime, zero BLOCKER; controle negativo detectado. |
| P30 | PASS | 1030 testes únicos; 23/23 comandos PASS, incluindo os 22 anteriores. |

P20/P21 passam pela alternativa de blocker reproduzível prevista no pedido. Isso não converte a ausência de pares/cadeias em produto completo: seção 104 e a avaliação final permanecem **PARTIAL**.

## Git / Final State

HEAD e origin/main `3290fb2756013d0dfc9d69f6dbff701634bba31d`; branch main; índice vazio; working tree **UNCOMMITTED**. Nenhum commit, push, tag, reset ou clean. Relatórios históricos intactos. Phase29 NOT STARTED.
