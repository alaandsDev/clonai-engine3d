# PHASE28B REPORT — Contextual Mechanism Parser & Retrieval Precision

Base 3290fb2756013d0dfc9d69f6dbff701634bba31d · main · UNCOMMITTED

## Executive Summary

**PHASE28B IMPLEMENTATION: COMPLETE**, no escopo finito dos três benchmarks e dos gates abaixo. **Retrieval WEAK / Parser ACCEPTABLE / Connectivity ACCEPTABLE.**

O parser recuperou **0/2/7 relações novas** de fontes antigas; relações totais **4/11/10**, cadeia máxima **1/1/3**, níveis **L1/L2/L4**. A turbina passa a PROGRESSIVE no Writer, com 131 palavras. O elevador ganha uma bifurcação de duas relações pelo mesmo cabo, mas continua EXPLANATORY e cadeia dirigida 1. Não há ganho no poço.

O ganho não veio de novas fontes: seis consultas adicionais produziram somente um resultado já adquirido. O ranking ainda admite um falso positivo no corpus offline; sua precisão pós-fetch não foi medida nesta passagem. Isso impede qualificar o retrieval como bom, mas não anula as nove recuperações grounded usadas pelo Writer. Zero Wrong na revisão finita. Sem novo MP4. Phase29 **READY pelos critérios pedidos**, porém **NOT STARTED**; não é uma certificação de qualidade visual ou de pesquisa irrestrita.

## Starting State

Branch **main**, HEAD e referência local origin/main **3290fb2756013d0dfc9d69f6dbff701634bba31d**. Entrada **DIRTY — Phase28 UNCOMMITTED**, não presumida CLEAN. Evidência em preservation/manifest.json. Lidos handoff, reports 25/26/27/27B/28, contratos, código e testes. O estado histórico Phase27 COMPLETE / Phase27B PARTIAL / Visual Foundation ACCEPTED permanece inalterado. Nenhum processo/sessão do agente anterior foi retomado.

## Phase28 Preservation

Backup pré-edição de 31 arquivos dirty; manifest com **146 hashes** dos reports, handoff, AGENTS, lockfile e árvore inteira out/engine3d/phase28. Todos conferidos após o replay. Os packs, Writer, planos, sequências elegíveis e loss traces históricos dos três benchmarks foram rederivados sem escrita na árvore Phase28. Sem alteração de resultados históricos. [replay/final.json](C:/Users/aland/Desktop/projects/clonai/out/engine3d/phase28b/replay/final.json)

## Architecture Audit

REUSE BEFORE CREATE: catálogo de 50 recursos consultado. Reutilizados Research v4 e seus providers/HTTP, normalization mapping, mechanismWindows, contextual scopes, EvidencePack/admission, Knowledge Graph, StoryNeed, Writer, Visual Planner e compilador determinístico. Extensão opt-in `sourcePolicy.contextualParser: 1`, mantendo versões anteriores e caminhos sem flag. CLI: `npm run curiosity:run -- "<tema>" <saída> --contextual-parser`. Nenhum Research v5, segundo Writer/graph/planner, modelo, LLM, SaaS, backend, dependência ou recurso de mídia novo.

Arquivos novos de runtime: src/research/mechanism-parser.ts e src/research/web/relevance.ts. Integrações pequenas nos contratos, extração contextual, query planning, v4, fetcher, replay e loss trace. No planner visual, apenas uma precondição lógica CONNECT editorial antes de FLOW em caminhos ainda desconectados; nenhum ajuste de geometria, materiais, iluminação, câmera estética ou assemblies. Os replays antigos idênticos verificam a compatibilidade.

## Root Cause Decomposition

**Busca:** consultas genéricas anteriores retornavam menções incidentais, biografias e sistemas errados. **Seleção:** classe declarada/HTTPS/posição não mediam identidade, e o corte ocorria antes de eliminar URLs já tentadas. **Parsing:** sujeito, trigger e argumentos estavam acoplados; apposition, coordenação e rotas ficavam presas em frases maiores. **Contexto/correferência:** sujeito elíptico e tipos não equivalentes continuam sem resolução segura. **Admissão:** não é o gargalo das nove recuperações; as mesmas regras existentes as admitem. **Writer:** agora recebe o conhecimento recuperado, sem mudança de thresholds ou prose para disfarçar lacunas.

## Retrieval Pipeline Before

ResearchNeed → query → MediaWiki result → ranking por classe/posição → slice → skip cache → fetch seguro → normalização/qualidade → contexto/extraction/admission. O novo ranking considera termos de identidade e qualificadores; a remoção de tentativas/cache antecede o corte. Existe uma segunda verificação do corpo após fetch, que não substitui o scope do extrator. Metadata permanece dados não confiáveis.

## Offline Search Result Audit

| Benchmark | Resultados antigos | Fetches antigos novos | Rerank retém | Rerank recusa |
| --- | --- | --- | --- | --- |
| well | 8 | 1 | 0 | 8 |
| elevator | 8 | 2 | 2 | 6 |
| turbine | 8 | 1 | 1 | 7 |

24 resultados: **3 retidos / 21 recusados**. Revisão dos três: Elevador ON_TOPIC; Golpe de aríete BORDERLINE de contexto hidráulico; Evil Dead Rise OFF_TOPIC, falso positivo lexical. **Retido não significa relevante confirmado.** Os quatro fetches novos ruins da Phase28 não são aprovados pelo novo ranking; ainda há o falso positivo acima. O corpus foi auditado antes de qualquer nova busca. Arquivos baseline/*-search.json e review/*-retrieval.json preservam título, snippet, score, sinais, decisão e revisão.

## SearchResultRelevance

Função determinística e genérica por tokens completos de tópico, título, snippet, URL, intenção mecânica e penalidades por qualificador ausente/menção incidental. Não usa dicionário de benchmarks, expected facts, snippets como Evidence ou autoridade declarada como relevância. Uma intenção mecânica em snippet pode gerar probe de contexto; o filme falso positivo demonstra o limite de coocorrência lexical. Após fetch, o corpo deve confirmar o assunto; título sozinho não basta. Casos positivos/negativos, URL malformada e re-assinatura de score/scope são testados.

## Topic Identity

Mantém todos os termos de identidades compostas, com normalização de acentos e plurais comuns. Testes com electric actuator/steam actuator, prensa hidráulica/elétrica e centrifugal/gravity separator. Scope contextual de documento continua exigindo identidade documental ou wrapper de instalação previamente permitido. CONTEXT_ONLY_NOT_IDENTITY no fetch não inventa equivalência nem alias para o extrator.

## Qualifier Preservation

Qualificadores de tipo no retrieval, apposition, modo, condição, locativo, alternativas OR e relativas no parser permanecem rastreáveis. Atores qualificados, como água que sai de um sistema, não viram água genérica. Não remover números, negação ou comparação para fabricar fatos. O objeto de destino da entrada da turbina mantém palhetas/bocais OU injectores e a relativa completa; não vira movimento de água até o rotor.

## Query Generation

Perguntas continuam derivadas de StoryNeeds e do pack anterior. A nova flag permite citar a identidade completa e um participante literal de uma relação mecânica já admitida (limite 7 palavras/70 caracteres); a relação de contexto e os fingerprints pré-query são registrados. Não há resposta, componente ou causa inventados na query. Esta passagem mostrou baixo rendimento de consultas muito restritivas; não houve relaxamento oculto nem nova rodada para melhorar o resultado.

## Live Acquisition

| Benchmark | Queries novas | Resultados novos | Fetches novos | Fontes novas | Stop |
| --- | --- | --- | --- | --- | --- |
| well | 2 | 0 | 0 | 0 | BUDGET_EXHAUSTED |
| elevator | 2 | 1 | 0 | 0 | BUDGET_EXHAUSTED |
| turbine | 2 | 0 | 0 | 0 | BUDGET_EXHAUSTED |

Uma passagem por benchmark, maxResearchRounds=1, maxQueries=queries iniciais+2, maxFetchedSources=24, maxSourcesPerDomain=16 e maxDurationMs=150000. Robots e transportes seguros existentes mantidos. Todos os novos searchTrace têm diagnostic null; o limite de consultas encerrou a passagem. Não confundir zero resultado com ausência do mecanismo. Aquisição ao vivo salva uma única vez; analyze/replay usam snapshots.

## Retrieval Precision Review

| Benchmark | Live prefetch FETCH | Live prefetch rejeitados | Pós-fetch on-topic | Pós-fetch rejeitados | Off-topic fetches | Fontes com mecanismo |
| --- | --- | --- | --- | --- | --- | --- |
| well | 0 | 0 | 0 | 0 | 0 | 1 |
| elevator | 1 | 0 | 0 | 0 | 0 | 1 |
| turbine | 0 | 0 | 0 | 0 | 0 | 1 |

O único resultado novo é Elevador, já adquirido e não refetched. **Pós-fetch: denominador zero; precisão não medida**, não 100%. As três fontes com mecanismo são históricas, uma por tema. Testes sintéticos exercitam aceitação/refutação de corpo e replay do scope; não contam como sucesso real. Retrieval verdict WEAK: melhor filtragem genérica, baixa descoberta e falso positivo offline conhecido.

## Parser Pipeline Before

Texto normalizado com mapping UTF16 → parágrafo/sentença/heading → guardas de scope → mechanismFactsV2/localMechanismClauses → addContextFact → Evidence/candidate → admissão. A nova camada tokeniza e liga sujeitos, triggers, argumentos e qualificadores localmente, reutilizando o léxico existente e o mesmo emissor. Frases simples continuam delegadas à gramática existente. A prova de parsing é adicionada à Evidence, não aceita como verdade antes da admissão.

## Diagnostic Span Corpus

| Benchmark | Trace | Resultado | Diagnóstico |
| --- | --- | --- | --- |
| well | KLT_d0a9616e4341f8bc78f6 | UNRESOLVED | SUBJECT_NOT_FOUND |
| well | KLT_177c4949c65bb866854f | UNRESOLVED | NEGATION_REFUSAL |
| well | KLT_f0de7ab4f83e2d2bc391 | UNRESOLVED | QUALIFIER_UNBOUND |
| elevator | KLT_5116e2124140542d075c | UNRESOLVED | RELATION_NOT_FOUND |
| elevator | KLT_15654e56ea219c1da09b | UNRESOLVED | QUALIFIER_UNBOUND |
| elevator | KLT_1e069322853604214f3b | RECOVERED | Explicit local mechanical relations recovered |
| turbine | KLT_3bd99124e0cc74ac4a29 | PARTIAL | Explicit entry/discharge recovered; energy qualifiers retained as text, not separately modeled comparative states |
| turbine | KLT_ff032a4c0ab11766900f | UNRESOLVED | RELATION_NOT_FOUND |
| turbine | KLT_dcbc241c56e7cd4ed263 | RECOVERED | Explicit local mechanical relations recovered |

**9 spans comparáveis: 2 recuperados integralmente, 1 parcial, 6 não resolvidos.** O parcial recupera entrada/descarga mantendo energia em qualificadores textuais, sem modelar um estado comparativo de energia. Duas relações de entrada via duto, fora desses nove spans históricos, também foram recuperadas e revisadas no conjunto de nove relações novas. O corpus finito não mede recall populacional. As recusas de história/negação/números não são automaticamente erros de recall.

## Subject Detection

Ator nominal explícito, singular e delimitado localmente; sujeito omitido/pronome livre não é preenchido. No poço, o trecho “Geralmente são abertos…” passa a diagnosticar SUBJECT_NOT_FOUND, sem inventar que a frase necessariamente descreve o mesmo tipo de poço. Estados não observados continuam null; tokens e spans observados ficam em parserObservation e no CLI genérico diagnose.ts.

## Apposition

Modificador descritivo ou participial limitado ao ator local. O cabo vinculado ao carro continua sujeito dos dois predicados. Modificador não vira SAME_ENTITY global; apposition nominal ambígua recusa. Testes externos: compressor, conveyor, trocador e door.

## Coordination

Coordenação de predicados exige and/e imediatamente antes do trigger seguinte, sem um segundo ator interveniente. Atores diferentes não herdam o primeiro sujeito. Coordenação de objetos gera X→A e X→B com o existente CONNECTED_TO; não A→B. OR preservado como alternativa única, sem afirmar ambos os objetos.

## Route Semantics

SOURCE/PATH/DESTINATION são papéis na prova, mapeados aos predicados existentes MOVE/FLOW/PASSES_THROUGH/EXIT quando fiéis. From/vindo de, through/através de e to/até são separados; de/of dentro de um nome não vira origem. Por em passiva só pode ser caminho com cabeça física genérica; agente versus caminho ambíguo não gera PATH. Papéis repetidos com direção incerta recusam. Não atravessar a relativa do objeto para transformar o rotor em destino da água.

## Locatives

Prefixo locativo vira qualificador contextual; ator seguinte permanece distinto. Sem ator nominal separado, SUBJECT_NOT_FOUND. Nenhum novo LOCATED_IN causal ou alias de sistema é inventado a partir de uma preposição.

## Relative Clauses

Relativa restritiva local com oração principal delimitada mantém o ator qualificado inteiro. A água que sai da turbina continua entidade literal qualificada em EXIT/PASSES_THROUGH/MOVE, no mesmo snapshot e sentença. Antecedente ambíguo ou relativa sem fronteira principal recusa. Não há resolução geral de it/ele/they nem ligação automática entre águas de parágrafos diferentes.

## Comparisons

Comparação de pressão/velocidade/energia não implica causa. Quando o schema atual não tem predicado comparativo fiel ou há dimensão numérica fora da gramática, recusa com RELATION_NOT_FOUND/QUALIFIER_UNBOUND, mantendo o texto bruto. Valores e condições não são removidos. O trecho de saída com pressão e/ou velocidade menores permanece não extraído.

## Negation

Negação tem recusa explícita; não transformar “não precisa de bombeamento” em uso afirmativo ou ausência física generalizada de bomba. O schema afirmativo existente não expressa com segurança todas essas proposições. Zero promoção indevida na revisão e nos controles negativos.

## Modality

May/can/usually/typically e equivalentes mantêm MODALITY e span. Eventos não ASSERTED não criam cadeia progressiva efetiva. A asserção continua funcional e limitada ao texto, não uma lei universal nem prova de comportamento em todos os modelos do sistema.

## Conditions

If/when/quando/se/under/sob preservados na fonte/prova/qualificadores ou recebem recusa. Condição precedente de excesso de velocidade no parágrafo do elevador permanece disponível na prova. A revisão não interpreta o cabo como aplicação constante do freio, nem transforma segurança em problema/solução inventados.

## Candidate Emission

| Benchmark | Novos candidates do parser | Novas relações admitidas | Origem |
| --- | --- | --- | --- |
| well | 0 | 0 | Fontes já adquiridas |
| elevator | 2 | 2 | Fontes já adquiridas |
| turbine | 7 | 7 | Fontes já adquiridas |

Os nove candidates novos passam pelo mesmo addContextFact e método MECHANISM_V2. Subject/trigger/argument/qualifier são convertidos para spans brutos exatos; HTML, citações, anotação AO e acentos decompostos têm teste. Em turbina, uma relação antiga de fluxo com objeto não dividido é substituída pelas provas de rota do mesmo ator/span: 4 antigas − 1 + 7 novas = 10; não há contagem duplicada da versão unsplit.

## Admission

Quorum, quality, origem independente, Evidence hash, source hash e validateEvidencePack mantidos. Nenhum manual Evidence. Teste com minIndependentSources=2 confirma que os candidates não entram com apenas uma origem. Re-assinar pack/parse ou alterar spans não evita rederivação. As novas relações são SUPPORTED por uma origem histórica por tema; não foram promovidas a CORROBORATED por metadados ou snippets.

## Knowledge Gain

| Benchmark | Relações antes→depois | Novas | Physical antes→depois | Causas efetivas |
| --- | --- | --- | --- | --- |
| well | 4→4 | 0 | 2→2 | 1→1 |
| elevator | 9→11 | 2 | 1→3 | 0→0 |
| turbine | 4→10 | 7 | 1→7 | 0→0 |

Ganho real: cabo→governador e cabo→freio; rotas de entrada, duto e saída da turbina. Sem causa nova, conhecimento numérico de dimensionamento ou relação de problema/solução. Sem progresso no poço.

## Connectivity

| Benchmark | Connected antes→depois | Cadeia antes→depois | Maior componente físico nós/edges | Nível |
| --- | --- | --- | --- | --- |
| well | 0→0 | 1→1 | 2/1 | L1→L1 |
| elevator | 0→0 | 1→1 | 3/2 | L1→L2 |
| turbine | 0→7 | 1→3 | 4/3 | L1→L4 |

Duas medidas distintas: componente físico fracamente conectado inclui bifurcação pelo mesmo ator; connectedRelationCount e longestGroundedChain usam continuidade dirigida. **Elevador L2 tem 2 edges na bifurcação, mas connectedRelationCount=0 e cadeia dirigida=1.** Não foi promovido a PROGRESSIVE. A turbina tem três grupos locais de rota (2, 2 e 3 edges), sete relações conectadas e máximo três; não uma cadeia única de sete. Não se unem grupos pelo nome água.

## Mechanism Chains

Links EXPLICIT_LOCAL_ROUTE exigem mesmo sourceId, snapshotHash, span de sentença, grupo, ator literal qualificado e passos adjacentes. Links existentes por argumento compartilhado permanecem. Remover o passo central não liga o primeiro ao terceiro. Não há novo Knowledge Graph: índices de planejamento sobre relações admitidas, factualEdgesAdded=0. Turbina L4 significa progressão descritiva de rota/estado grounded; não física simulada ou nova sequência causal inferida. Coverage da maior cadeia: poço 0, elevador 0, turbina 3/7. Causal-chain coverage continua 0.

## State Changes

| Benchmark | States/events antes→depois | Writer states | Significado |
| --- | --- | --- | --- |
| well | 2→2 | 2 | Semantic description, não simulação |
| elevator | 1→3 | 3 | Semantic description, não simulação |
| turbine | 1→7 | 7 | Semantic description, não simulação |

Estados preservam before UNKNOWN quando não observado; after é a proposição admitida. Não se fabricam estado inicial, velocidade, quantidade, sucesso final ou cronologia entre frases independentes.

## Problem/Solution

Grounded problems **0/0/0**, grounded solutions **0/0/0**, pares **0/0/0**, antes e depois. Um freio, um propósito, uma falha mencionada em query ou um adjetivo indesejado não demonstram problema e reparo. Queries podem perguntar pela lacuna; nunca a preenchem com resposta inventada.

## StoryNeed Re-evaluation

| Benchmark | Supported antes→depois | Unsupported agora | Writer progression |
| --- | --- | --- | --- |
| well | 3→3 | 4 | EXPLANATORY |
| elevator | 2→2 | 5 | EXPLANATORY |
| turbine | 2→3 | 4 | PROGRESSIVE |

A necessidade EXPLANATION da turbina recebe a cadeia literal; necessidades de problema/solução continuam abertas/opcionais. Goals e conectivos editoriais não viram fatos. O loss trace acompanha query, scope/parser, admissão, omissão de Writer e beats visuais por necessidade.

## Writer

| Benchmark | Words antes→depois | Relações selecionadas | Novas usadas | Elegível |
| --- | --- | --- | --- | --- |
| well | 64→64 | 4 | 0 | True |
| elevator | 35→56 | 5 | 2 | True |
| turbine | 45→131 | 9 | 7 | True |

Writer reconstruído somente após extração, admissão, conectividade e revisão das nove relações. O módulo Writer permaneceu exatamente como na Phase28 dirty preservada. As nove relações novas entram nos scripts. Frases completas podem manter coordenação/relativas; não se compressam qualificadores para ganhar duração. Scripts em well/elevator/turbine/script.txt.

## Story Classification

**EXPLANATORY / EXPLANATORY / PROGRESSIVE**. Poço mantém 64 palavras; elevador 56, com branch mecânico e sem cadeia dirigida; turbina 131, com três passos locais e sete relações conectadas usadas pelo Writer. Não é PROGRESSIVE_CAUSAL. Thresholds e critérios não foram reduzidos. Uma relação de baixa densidade da turbina é omitida, com razão no Writer.

## Visual Handoff

| Benchmark | Visualizáveis selecionadas | Beats antes→depois | Schema/rederivação | Compile |
| --- | --- | --- | --- | --- |
| well | 2 | 9→9 | PASS | PASS |
| elevator | 1 | 7→9 | PASS | PASS |
| turbine | 3 | 5→13 | PASS | PASS |

Fundação visual existente; nenhum recurso ou polish. Uma falha FLOW requires connected path no caminho genérico recém-alcançável foi corrigida com setup CONNECT explicitamente **editorial**, sem novo fato. Contrato, validação e sequência compilada passam nos três casos. QA estimada do elevador passa; na turbina WORLD_CONTEXT e PRESENTER_CONTINUITY falham, embora state continuity/visual proof passem. Isso é limitação visual conhecida, não resolvida por tuning nesta fase. Stasis estimada (não medida em novo MP4): well 4.567s, elevator 2.867s, turbine 6.367s.

## Render Decision

**NO_NEW_RENDER — NO_GROUNDED_VISUAL_GAIN** para o piloto primário poço: cadeia 1→1, estados 2→2, classificação inalterada e nenhuma relação nova selecionada. Não houve MP4, TTS ou loop de render durante parser/retrieval. Os outros dois temas receberam planos/compilação, sem produção de master. Não usar o ganho da turbina para justificar um novo render do poço.

## Primary MP4 if any

**NOT PRODUCED / SHA256 N/A.** O MP4 histórico Phase28 permanece somente como artifact histórico, com SHA256 `fa3105147a3e8fd9945980fa91468c5b4476cd8363bc3e5ea16ace012f2c49a7`, conferido no manifest. Não foi copiado, rebatizado, renderizado ou apresentado como resultado novo.

## Three-Domain Comparison

| Métrica | well | elevator | hydraulic turbine |
| --- | --- | --- | --- |
| Relations | 4→4 | 9→11 | 4→10 |
| Connected | 0→0 | 0→0 | 0→7 |
| Longest chain | 1→1 | 1→1 | 1→3 |
| Level | L1→L1 | L1→L2 branch | L1→L4 route |
| Effective causes | 1→1 | 0→0 | 0→0 |
| Physical | 2→2 | 1→3 | 1→7 |
| States | 2→2 | 1→3 | 1→7 |
| Problem/solution pairs | 0→0 | 0→0 | 0→0 |
| Words | 64→64 | 35→56 | 45→131 |
| Story | EXPLANATORY→EXPLANATORY | EXPLANATORY→EXPLANATORY | LIST_LIKE→PROGRESSIVE |
| Beats | 9→9 | 7→9 | 5→13 |

## Precision Review

| Benchmark | Relação nova | Tupla resumida | Veredito |
| --- | --- | --- | --- |
| elevator | KR_306eb11216d88841e019 | O cabo do limitador de velocidade → DRIVES → o freio de segurança | CORRECT |
| elevator | KR_bb7677043194508219b7 | O cabo do limitador de velocidade → MOVE → o limitador de velocidade | CORRECT |
| turbine | KR_19bb3974c98fbc2416ab | A água que sai da turbina → PASSES_THROUGH → por um duto, o tubo de sucção, | CORRECT |
| turbine | KR_27bd53f8944b24d7a3ec | a água → MOVE → vindo de um reservatório ou canal de nível mais elevado (e portanto com maior energia) | CORRECT |
| turbine | KR_2ae8f38e1f8aa3cc9949 | A água que sai da turbina → EXIT → da turbina | CORRECT |
| turbine | KR_6451e4087d23318f9a3f | a água → MOVE → para um canal de nível mais baixo (e portanto com menor energia) | CORRECT |
| turbine | KR_a641ec202ea0e5ebe334 | A água que sai da turbina → MOVE → até o reservatório ou canal inferior | CORRECT |
| turbine | KR_b7439b1439337e0fb1ba | A água de entrada → FLOW → até um conjunto de lâminas curvas (palhetas), bocais ou injectores que transferem a energia da água para um rotor | CORRECT |
| turbine | KR_e63a67c8549d43b12ae3 | A água de entrada → PASSES_THROUGH → através de um duto fechado | CORRECT |

**Novas: CORRECT 9 / QUESTIONABLE 0 / WRONG 0. Writer: 18 relações selecionadas, todas revisadas, Wrong 0.** Escopo: fidelidade aos snapshots e contexto; não comprova verdade universal, independência adicional ou recall total. As nove novas foram revisadas antes do rebuild; as nove selecionadas históricas mantêm decisões anteriores e provas rederivadas. QUESTIONABLE não entra no backbone. Arquivos review/new-relations.json e review/writer-relations.json guardam todos os spans UTF16, hashes, qualificadores e razões; review/diagnostic-spans.json distingue recuperação parcial.

## KnowledgeLossTrace

Extensão integrada ao trace existente, sem outro pipeline: parserObservation em cada passagem permitida sob a nova flag inclui tokens, spans, diagnóstico, candidatos, sujeito/trigger observados e motivo específico de recusa. Os estágios legados nullable permanecem honestos; null não é false nem um sujeito inventado. Reason agora distingue SUBJECT_NOT_FOUND, RELATION_NOT_FOUND, ARGUMENT_NOT_FOUND, QUALIFIER_UNBOUND, CLAUSE_BOUNDARY_REFUSAL, AMBIGUITY_REFUSAL e NEGATION_REFUSAL quando realmente observados. Scope, Evidence, Knowledge, Writer e visual continuam ligados por IDs.

No poço, perda por sujeito omitido, negação e dimensão/comparação; no elevador, o span de cabo passa, enquanto história/40% não entram; na turbina, rotas passam e comparação permanece não representável. Não se chama recusa de comparação de falha de busca. `tools/phase28b/diagnose.ts <pack.json> <sourceId>` valida o pack e inspeciona janelas de qualquer domínio, sem criar Evidence.

## Replay

| Phase | Tema | Pack/Knowledge/Writer/Plan/Loss | Compile | Rede | ms |
| --- | --- | --- | --- | --- | --- |
| Phase28 | well | PASS | PASS | 0 | 59836 |
| Phase28 | elevator | PASS | PASS | 0 | 75710 |
| Phase28 | turbine | PASS | PREVIEW_ONLY | 0 | 12349 |
| Phase28B | well | PASS | PASS | 0 | 40217 |
| Phase28B | elevator | PASS | PASS | 0 | 53620 |
| Phase28B | turbine | PASS | PASS | 0 | 13669 |

**PASS, ZERO NETWORK.** DNS, node transport e global fetch substituídos por funções que incrementariam contador e lançariam erro. Os seis casos completos coincidem; previews históricos permanecem previews. Os 146 hashes históricos coincidem. Não foram invocados os operators antigos que gravam em Phase28.

## Provenance

PASS. Source/snapshot hash e raw content, origin groups, fonte/heading/parágrafo/sentença, spans UTF16, parse, candidates/admission, query/prior-pack/context-relation, Writer e visual rederivados. Re-sign de spans/score/scope não aprova mutação; testes negativos específicos. Igualdade de índices não substitui proveniência: rotas também exigem source/hash/span/actor comuns. As novas relações procedem exclusivamente de arquivos já adquiridos e verificados; nenhuma descoberta recente foi fabricada.

## Security

PASS no escopo dos testes e desta execução. Reutilizados pinagem DNS/socket, bloqueio SSRF, redirects, MIME/tamanho, robots, tempo, fonte/origem, budgets e parada por 403/429/timeout. Não houve bypass de provider nem busca recursiva ilimitada. Prompt injection em texto/metadata permanece dado estático; não há LLM no runtime. Conteúdo de snippet não cria Evidence. Sem leitura/publicação de .env, credenciais, tokens, alteração de .gitignore, dependências ou remote. A aprovação factual não foi relaxada para resolver lacunas narrativas.

## Anti-hardcode

**PASS, 203 arquivos src/cli, 0 blockers.** Negativo artificial detectado; léxico e recusa legados conferidos contra Git. Alvos incluem tópicos, URLs e sentenças adquiridas, limitador/governor/draft tube e antigos off-topic. Corpus, benchmarks e tabelas de review ficam somente em tests/tools/artifacts. Nenhuma URL, sentença ou entidade de benchmark foi adicionada às regras runtime. [analysis/anti-hardcode.json](C:/Users/aland/Desktop/projects/clonai/out/engine3d/phase28b/analysis/anti-hardcode.json)

## Performance

| Tema | Pack build ms | Story+diagnóstico ms | Replay Phase28B ms |
| --- | --- | --- | --- |
| well | 4641 | 5353 | 40217 |
| elevator | 4612 | 6610 | 53620 |
| turbine | 1246 | 1229 | 13669 |

Medições locais, não benchmark de velocidade: packMs inclui a construção validada; storyMs no operator inclui planejamento, corpus diagnóstico e componentes; replay inclui validações/rederivações e compilação. Jobs independentes de regressão/replay concorreram por CPU. Não foi medido ganho de performance versus Phase28 em condições isoladas. Parsing é limitado a sentenças, gramática determinística e budgets existentes; sem modelo externo.

## Regression

**PASS — 1077 testes distintos, 47 novos, 24/24 comandos.** Raiz 1075, mais dois casos nested sound/visual não cobertos pelo glob raiz. Não somar execuções focadas repetidas.

| npm run | Exit | Tests | Failures |
| --- | --- | --- | --- |
| typecheck | 0 | — | — |
| check:engine3d | 0 | 1075 | 0 |
| check:editorial | 0 | 46 | 0 |
| check:sound | 0 | 35 | 0 |
| check:visual | 0 | 37 | 0 |
| check:motion | 0 | 30 | 0 |
| check:demonstration | 0 | 30 | 0 |
| check:autodirector | 0 | 23 | 0 |
| check:semantics | 0 | 40 | 0 |
| check:narrative | 0 | 35 | 0 |
| check:writer | 0 | 32 | 0 |
| check:research | 0 | 50 | 0 |
| check:web-research | 0 | 115 | 0 |
| check:research-v2 | 0 | 39 | 0 |
| check:research-v3 | 0 | 76 | 0 |
| check:research-v4 | 0 | 65 | 0 |
| check:topic-intelligence | 0 | 28 | 0 |
| check:vertical-slice | 0 | 15 | 0 |
| check:causal-curiosity | 0 | 69 | 0 |
| check:contextual-mechanism | 0 | 20 | 0 |
| check:visual-causal | 0 | 24 | 0 |
| engine3d:catalog | 0 | — | — |
| check:progressive-curiosity | 0 | 43 | 0 |
| check:contextual-parser | 0 | 47 | 0 |

Typecheck e diff --check PASS. A suíte nova é offline, com quatro domínios sintéticos externos ao benchmark e HTTP/DNS injetados; controles de negativa, modalidade, condições, limites, direção, NFD/HTML, prova adulterada e precondição de integração. Não foram executados testes de render não solicitados.

## Registry

**Engine3D 50 / SFX 8 / VISUAL 5.** Sem criação, remoção ou aprovação de recurso. Autonomia **LEVEL4C+** preservada, sem promoção. Catálogo regenerado pelo comando obrigatório; nenhuma mudança de versão/dependência/lockfile. Sem mídia nova.

## Limitations

Retrieval continua WEAK: 0/1/0 resultados na nova passagem; o único já estava adquirido; zero evidência empírica de post-fetch precision nesta passagem. O corpus offline ainda contém Evil Dead Rise como falso positivo de coocorrência mecânica. Consultas citando participante e tópico podem ser restritivas demais. Sources com título vago podem passar como contexto e ainda falhar na identidade documental do extrator.

Não há correferência geral, recuperação fiel de toda comparação/negação/medida, causas novas ou reparos. O elevador tem branch, não cadeia dirigida. A turbina tem rota descritiva local, não uma cadeia de sete, nem causalidade quantitativa. Qualidade visual estimada tem falhas de mundo/apresentador na turbina e não foi certificada por novo MP4. Resultados finitos não autorizam alegar recall/precision universais ou pesquisa independente autônoma completa.

## Phase29 Readiness

**READY pelos critérios explícitos desta solicitação**: 2/3 L2+ (elevador branch L2 e turbina L4), 1/3 L3+, Writer usa cadeia conectada de três relações da turbina, Writer-used Wrong=0 na revisão finita e handoffs válidos/compiláveis. Isso permite avaliar a próxima fase; não promove retrieval a GOOD, não corrige Phase27B PARTIAL e não garante master visual pronto. **Phase29 NOT STARTED.**

## Honest Assessment

O conhecimento antes perdido na extração de estrutura local foi recuperado de fontes já presentes, chegou ao Writer e aos planos. O poço não melhorou; suas perdas agora são mais explicáveis. A busca nova quase não acrescentou material, portanto descoberta externa continua sendo o maior gargalo. Os ganhos justificam COMPLETE no conjunto de gates e na meta grounded finita, sem chamar o sistema de solucionador geral. **Próxima recomendação única:** tornar a próxima revisão de retrieval sensível ao papel mecânico local no snippet e a consultas excessivamente restritivas, verificando o ganho em fontes novas antes de ampliar a autonomia; não executar Phase29 nesta entrega.

## Attempt Log

| Ciclo significativo | Trabalho | Resultado |
| --- | --- | --- |
| 1 | Preservação, arquitetura, auditoria/rerank offline | 24 resultados antigos; seleção e perda de parsing separados |
| 2 | Parser local, apposition/coordenação e provas raw | Recuperação de cabo e rotas, sem ator inventado |
| 3 | Qualificadores, direção, route continuity, guards e integração | Emissão/admissão existentes; diagnóstico e testes sintéticos |
| 4 | Única aquisição limitada/tema e reprocessamento final | 6 queries, 1 resultado cached, 0 fetches; 0/2/7 novas relações |
| 5 | Revisão das nove novas → rebuild Writer/visual; precondição lógica | Turbina PROGRESSIVE; CONNECT editorial antes de FLOW; sem polish/render |
| 6 | Regressão, replay, precisão completa, integridade e relatório | 24 comandos, 1077 testes únicos, 6 replays zero rede, 146 hashes iguais |

Seis ciclos significativos; correções locais de sintaxe/testes não foram novas passagens live. Sem microtuning por benchmark, busca repetida ou tentativa de salvar a nota trocando tema. Nenhum commit/push/stage/reset/clean/stash/tag.

## PHASE28B Gates

| Gate | Status | Evidência |
| --- | --- | --- |
| B1 | PASS | Base/main confirmados; índice vazio; dirty Phase28 preservado antes de editar. |
| B2 | PASS | 146 arquivos históricos com SHA256 idêntico; três replays Phase28 idênticos. |
| B3 | PASS | Ranking, escopo, parser, admissão e Writer têm medidas separadas. |
| B4 | PASS | Auditoria dos 24 resultados antigos salva antes da aquisição live. |
| B5 | PASS | Score genérico por identidade, qualificadores e intenção; não é classificador perfeito. |
| B6 | PASS | Testes de identidades compostas em três domínios externos ao benchmark. |
| B7 | PASS | Qualificadores discriminantes mantidos; tipos de turbina incompatíveis recusados. |
| B8 | PASS | Snippet/score nunca criam Evidence ou alias; guardas de documento continuam independentes. |
| B9 | PASS | Uma aquisição/tema, duas novas consultas/tema, zero novos fetches; nenhum retry live. |
| B10 | PASS | Anti-hardcode: 203 arquivos runtime/CLI; zero bloqueadores; negativos detectados. |
| B11 | PASS | Tokens, spans, sujeito, trigger, argumentos, qualificadores, refusals e emissões observáveis. |
| B12 | PASS | Apposition local ligada por prova; sem alias global. |
| B13 | PASS | Predicados coordenados compartilham ator apenas com coordenador explícito e sem ator interveniente. |
| B14 | PASS | Argumentos coordenados preservam X→A/X→B; nunca inferem A→B. |
| B15 | PASS | SOURCE/PATH/DESTINATION locais e direção explícita; de/of nominal não vira origem. |
| B16 | PASS | Locativo é qualificador; não substitui o ator. |
| B17 | PASS | Relativa restritiva mantém o ator qualificado completo; ambiguidade recusa. |
| B18 | PASS | Negação recusa; modalidade e condições são preservadas ou recusadas. |
| B19 | PASS | Comparação não gera causa ou estado não representável. |
| B20 | PASS | Nenhuma correferência geral, alias de água ou identidade entre parágrafos. |
| B21 | PASS | Quorum, origens, hashes, método MECHANISM_V2 e admissão existentes; teste de duas origens. |
| B22 | PASS | Nove relações novas CORRECT; todas 18 selecionadas revisadas; Wrong=0 na amostra finita. |
| B23 | PASS | Continuidade exige argumento literal ou passos adjacentes de uma rota local comprovada. |
| B24 | PASS | Poço, elevador e turbina hidráulica reprocessados; nenhum benchmark trocado. |
| B25 | PASS | Elevador L2 ramificado, turbina L4; dois de três L2+; sem usar blocker path. |
| B26 | PASS | Turbina: três relações conectadas na mesma rota; L4; sem usar blocker path. |
| B27 | PASS | Thresholds Writer intactos: EXPLANATORY/EXPLANATORY/PROGRESSIVE. |
| B28 | PASS | Zero relações factuais inventadas na revisão finita; factualEdgesAdded=0. |
| B29 | PASS | Poço inalterado: NO_NEW_RENDER — NO_GROUNDED_VISUAL_GAIN. |
| B30 | PASS | Seis replays Phase28/28B PASS; DNS, transporte e fetch bloqueados; zero rede. |
| B31 | PASS | Spans UTF16, source/snapshot hashes, queries/prior packs, admission e Writer rederivados. |
| B32 | PASS | Testes HTTP/DNS/SSRF/robots/budgets e injeção; metadados não têm autoridade factual. |
| B33 | PASS | Anti-hardcode PASS, 203 arquivos, zero bloqueadores; Writer/lexicon anteriores intactos. |
| B34 | PASS | 1077 testes distintos; 24/24 comandos PASS; diff --check PASS. |
