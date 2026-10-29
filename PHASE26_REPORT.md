# ClonAI — Phase26 consolidated after Phase26B

**PHASE26B COMPLETE — PHASE26 COMPLETE — Phase27 NOT STARTED.**

Checkpoint `19d55834c38d0fdf3dea86c4708cdf0db637dd63`; branch `main`; LEVEL4C+.

## Phase26 Initial Result

Resultado histórico preservado: 2/8 com mecanismo útil, 2/8 ADEQUATE/RICH, 2/8 Writer eligible; 941 testes únicos e 20/20 comandos. Phase26 estava INCOMPLETE; P14/P15/P16 reprovados. O relatório original aparece integralmente ao final e permanece congelado em `out/engine3d/phase26/phase26b-baseline/files/PHASE26_REPORT.md`.

## Why Incomplete

Havia apenas 9 relações nos oito casos; A/B positivos e C somente taxonomia. D/H falhavam no escopo de documento, F no contexto de seção/lista, C/G em anotações e estruturas de oração. E não possuía bytes adquiridos: oito buscas responderam HTTP 429. Essas perdas precediam a admissão; não era justificável baixar seus critérios.

## Phase26B Objective

Diagnosticar perdas antes de corrigir, recuperar construções locais generalizáveis, auditar precisão e medir conectividade. Resultado: 6/8 → 6/8 → 6/8 (mecanismo útil → ADEQUATE/RICH → Writer eligible), 27 relações finais, 18 novas. Writer-used Wrong = 0 na revisão manual finita. Os mínimos P14 ≥6, P15 ≥5 e Writer ≥4 foram atingidos. Isso não equivale a roteiro causal rico ou prontidão visual geral.

## Baseline

Checkpoint oficial `19d55834c38d0fdf3dea86c4708cdf0db637dd63`, branch `main`, mantidos. Phase26B começou sobre a árvore DIRTY legítima de Phase26, congelada antes de mudar comportamento; nenhum reset, commit, push ou remote. Manifesto, código inicial, oito métricas/knowledge/graphs/stories/Writer foram preservados em `phase26b-baseline/`. A bateria usa as oito aquisições reais já gravadas: **0 novas queries e 0 novos fetches na 26B**. Não são oito novas pesquisas live.

## KnowledgeLossTrace

Diagnóstico anterior às correções: `out/engine3d/phase26/review/phase26b-failure-analysis.md`. Há traces completos por source/hash/locator, offsets brutos, parágrafo, sentença, heading/ancestry, limpeza, contexto, Evidence, Fact, Knowledge, Story e Writer.

Estágios: DISCOVERED → FETCHED → PARSED → CONTEXTUALIZED → CANDIDATE_EXTRACTED → SUBJECT_RESOLVED → RELATION_PARSED → EVIDENCE_ADMITTED → KNOWLEDGE_ADMITTED → STORY_USED → WRITER_USED. Fontes ausentes possuem diagnóstico de discovery/fetch, sem passagem fabricada.

**Granularidade:** um passage join positivo significa pelo menos uma relação, não todas as orações. O parser acopla candidato/sujeito/relação; sem emissão, os dois últimos ficam UNKNOWN, não uma causa interna inventada. Dez janelas revisadas com bytes/hash fixos dão a análise causal de perdas; não são Evidence nem uma amostra de recall populacional. Quatro falhas-alvo recuperadas, uma parcialmente e cinco não recuperadas. Em G, a oração principal alcança Writer, mas os atores da relativa e do gerúndio continuam recusados.

Implementação: `src/curiosity/knowledge-loss.ts`; traces finais `out/engine3d/phase26/phase26b/attempts/final/loss/*.json`; avaliação e ressalvas em `review/phase26b-loss-trace-review.md` e `phase26b/analysis/reviewed-loss-assessment.json`. O CLI também salva `knowledge/loss-trace.json`. Os oito fingerprints do trace foram reconstruídos sob bloqueio de rede.

## Failure Taxonomy

Contagens da mesma coleção fixa de dez diagnósticos; não comparar contagens amplas de cues automáticas como se fossem ground truth. “After” conta a categoria ainda não resolvida integralmente.

|Category|Before|After|Partial|
|---|---|---|---|
|AMBIGUITY_REFUSAL|1|1|0|
|COREFERENCE_FAILURE|2|2|1|
|DISCOVERY_MISS|1|1|0|
|DOCUMENT_CONTEXT_LOST|1|0|0|
|PASSIVE_VOICE_MISS|1|1|0|
|SECTION_CONTEXT_LOST|2|0|0|
|SENTENCE_FRAGMENTATION|1|0|0|
|SUBJECT_IDENTITY_FAILURE|1|1|0|

A coreferência de G permanece parcial; a hipótese inicial de antecedente único foi revisada e não virou prova de identidade.

## Root Causes

1. Anotações AO/citações confundidas com quantidades e limites de frase.
2. Título de instalação para processo e seção de componentes fora do contexto permitido.
3. Funções com sujeito repetido, definições de lista, relativas equativas e grupos de etapas sem parsing local.
4. Identidade de subtipo não comprovada em D.
5. Discovery indisponível em E.
6. Voz passiva, sujeitos omitidos e referência ambígua continuam perdas deliberadas em A/B/G.

## Attempt Log

|Attempt|Observed failure|General fix|Measured result|Precision / decision|Tests|
|---|---|---|---|---|---|
|01|C/H: AO/citação tratados como número|Máscara com offsets|C1→1, H0→0|Nenhum ganho fingido; próxima perda era contexto/gramática|2PASS: metadados/offsets|
|02|F/H: contexto de lista/instalação perdido|Contexto limitado por heading e título exato|F0→2, H0→4|F ainda sem física; duplicação e complemento depois questionados|4PASS: wrapper/seção|
|03|C/F/G/H: estruturas locais não reconhecidas|Equativa, função explícita, label espacial, grupo PRECEDES, oração operacional|C4/F9/G4/H6|Gerúndio G depois QUESTIONABLE; não congelar contagem intermediária|10PASS: construções locais PT/EN|
|04|H: mesmo movimento contado duas vezes|Deduplicação de FLOW/PASSES_THROUGH e ator sem advérbio|H6→5|Preservar rotas diferentes; uma ocorrência não vira duas etapas|11PASS: movimento não duplicado|
|05|H: complemento truncado; popularidade fora do mecanismo|Recusar complemento; realizar só ordem nominal explícita|H5→3; C4|1 QUESTIONABLE excluída; ranking não narrado|12PASS: alias/complemento/ranking|
|06|G: gerúndio com dois atores plausíveis|Recusar atribuição e narrar oração principal assertiva|G4→3; Writer50 palavras|1 QUESTIONABLE excluída; relativa e fronted clause recusadas|18PASS: ambiguidade e métricas/trace|
|07|Controle adversarial: condição poderia sumir|Conservar superfície completa/modalidade; recusar conector como ator|8 resultados reais inalterados; 19 testes novos|Expectativa inicial do teste corrigida para enum HYPOTHETICAL já existente|19PASS: condições preservadas|
|08|Medição: predicados causais inversos em paths|Normalizar direção só para medir cadeia; excluir propósito|Bateria real inalterada; fixture de cadeia1→2|Nenhuma relação factual nova|20PASS: direção causal; regressão integral e replay|

Snapshots por tentativa em `phase26b/attempts/`. A primeira execução da classe02 ficou lenta por recalcular escopo a cada janela; foi parada, log preservado e cache por documento aplicado sem mudança semântica. O teste adversarial da classe07 inicialmente esperava o nome CONDITIONAL; o contrato existente representa a condição como HYPOTHETICAL. Nenhuma mudança do enum ou relaxamento. Ganhos e reversões intermediários permanecem registrados; log estruturado em `phase26b/analysis/attempt-log.json`.

## Contextual Understanding

Novo opt-in `sourcePolicy.contextualMechanisms: true`, somente com mechanismVersion2 PROCESS. Reaproveita estruturas HTML, headings, SourceSpan, FactCandidate, Evidence e validação. Wrapper instalação/processo requer o nome literal solicitado e ocorrência no documento; não cria SAME_ENTITY/HAS_COMPONENT. Seções históricas, captions e navegação continuam excluídas; subtipo não vira o todo.

## Coreference

Resolução limitada a equativa com antecedente local inequívoco, appositive “também conhecido como/also known as”, sujeito nominal repetido e label da lista para movimento local. Não há coreferência geral entre sentenças. Pronomes isolados, sujeitos omitidos, múltiplos candidatos, a relativa de G e seu gerúndio continuam recusados. Escopo compartilhado não é identidade.

## Multi-sentence Support

O trace conserva sentença/parágrafo; Evidence conserva a sentença e os spans de contexto de documento/headings com hashes do snapshot. Esses spans contextualizam o fato explícito; não autorizam completar sujeito ausente, ligar causas transitivas nem fabricar texto científico. Não houve combinação factual de várias frases para obter conclusões novas. DERIVED_PLANNING é a camada de métricas/intents; não entra como Evidence.

## Language Parsing

PT/EN com gramática fechada: referências bibliográficas e AO mascaradas mantendo offsets UTF-16; números científicos continuam recusados pela rota de prosa. Novas construções são locais e testadas em contextos distintos. Negação, incerteza, hipótese e condições não se tornam assertivas. Realização nominal preserva a frase inteira quando a modalidade não é ASSERTED.

## Relation Recovery

EXPEL, MOVE_WITHIN e OPERATE_BY são relações físicas locais; USED_FOR permanece propósito e não causa efetiva. PRECEDES liga dois grupos explicitamente ordenados, sem criar ordem dentro de enumerações. Gerúndio só usa o sujeito principal quando não existe relativa interveniente ambígua. Relações e texto derivam exclusivamente dos snapshots verificados; nenhuma janela anotada é carregada pelo extrator.

## Precision Audit

Todas as 27 relações finais e superfícies factuais foram lidas contra os snapshots. São 18 novas, 24 usadas pelo Writer. CORRECT significa entailment do texto, não corroboração científica independente; não há segunda origem útil. Dois QUESTIONABLE intermediários (H complemento, G gerúndio) foram excluídos por regra geral. A duplicação de movimento e o enunciado de popularidade foram corrigidos separadamente.


|Benchmark|Admitted|CORRECT|QUESTIONABLE|WRONG|Writer-used Wrong|
|---|---|---|---|---|---|
|A|4|4|0|0|0|
|B|4|4|0|0|0|
|C|4|4|0|0|0|
|D|0|0|0|0|0|
|E|0|0|0|0|0|
|F|9|9|0|0|0|
|G|3|3|0|0|0|
|H|3|3|0|0|0|

Revisão completa, inclusive relações omitidas pelo limite de palavras: `review/phase26b-precision-review.md`; provas e superfícies em `phase26b/analysis/precision.json`. É uma auditoria pequena, não uma taxa de erro universal.

## Causal Graph

Arestas provêm somente de relações admitidas. Participantes literais preservados; sem fusão por sinônimo presumido, contexto de documento ou proximidade. Links editoriais não são arestas factuais. O contador legado causalRelations inclui USED_FOR: a tabela não deve ser lida como seis causas físicas descobertas; a cadeia causal medida exclui propósito e normaliza a direção inversa de CAUSED_BY/FAILS_BECAUSE. Essas relações normalizadas servem somente à medição, não geram novos fatos.

## Graph Connectivity

|ID|Nodes|Edges|Weak components|Largest component nodes|Largest physical component nodes|Physical edges in largest component|Longest all/physical/causal/sequence|
|---|---|---|---|---|---|---|---|
|A|8|4|4|2|2|1|1/1/1/0|
|B|7|4|3|3|2|1|1/1/0/0|
|C|6|4|2|4|2|1|1/1/0/0|
|D|0|0|0|0|0|0|0/0/0/0|
|E|0|0|0|0|0|0|0/0/0/0|
|F|16|9|7|3|2|1|2/1/0/0|
|G|5|3|2|3|2|1|1/1/0/0|
|H|6|3|3|2|2|1|1/1/0/1|

Os paths são simples dirigidos, com limite explícito de exploração e searchComplete. Nos oito casos todas as buscas terminaram. A maior cadeia total de F tem duas arestas incluindo definição; não são duas transformações físicas.

## Mechanism Chains

Maior cadeia física dirigida: **1 aresta** em cada caso útil. MechanismChainCoverage = 0 em todos: não há duas arestas físicas consecutivas com participante literal compartilhado. Uma estrela não é progressão. RICH contextual exige caminho físico de ≥2 arestas, ≥3 relações físicas no componente e coverage ≥0,5, além dos critérios antigos de diversidade/quantidade. Dez fatos isolados não recebem RICH. Nenhum caso real é RICH.

## Problem/Solution Chains

Zero problemas FAILS_BECAUSE, zero SOLVES e zero pares reais ligados pelo mesmo problema; ProblemSolutionChainCoverage = 0. Finalidades de contrapeso e motor não foram convertidas em solução de um problema inventado. Não há naive attempt, história da invenção ou encadeamento transitivo sintetizado. O mecanismo é testado com fixtures fictícias; recuperação real continua ausente.

## Story

Seis ADEQUATE, zero RICH; dois INSUFFICIENT. Mantido o piso factual anterior de ADEQUATE, sem baixar gates; reforçado RICH por conexão física útil. ADEQUATE permite explicação curta e gaps explícitos, não certifica construção problema/solução. World/presenter/cutaway intents são planejamento, sem objeto visual novo.

## Writer

Seis SCRIPT_GROUNDED elegíveis e dois BLOCKED. A/B/C/G ficam abaixo de110 palavras por conhecimento disponível; não houve filler para cumprir duração. F/H estão entre110–160, mas F ainda tem forma de lista. Bounded realization só gramaticaliza a ordem nominal explícita ou usa oração operacional assertiva completa, sem atribuir a subordinada. Condições conservam texto integral/modalidade. Nenhum render, áudio, voz ou aprovação de mídia novo.

## Benchmark Results

Mesmos oito tópicos, fontes reais gravadas, nenhum benchmark substituído. Potential Passages são cues não revisadas, não conhecimento validado. Causal inclui propósitos; State Changes só conta estados explicitamente tipados.

|Benchmark|Sources|Contributing|Potential passages|Extracted|Admitted|Causal|Spatial|State changes|Problem/Solution|Largest physical chain|Story|Writer|Words|Remaining gap|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|A|9|1|419|4|4|1|0|0|0/0|1|ADEQUATE|SCRIPT_GROUNDED|64|Sujeito plural omitido; causa como evento textual não conecta entidades|
|B|10|1|239|4|4|1|0|0|0/0|1|ADEQUATE|SCRIPT_GROUNDED|97|Suporte passivo e componente→estado sem parsing|
|C|10|1|214|4|4|1|0|0|0/0|1|ADEQUATE|SCRIPT_GROUNDED|63|Uma ação física; taxonomia isolada, sem cadeia|
|D|6|0|233|0|0|0|0|0|0/0|0|INSUFFICIENT|BLOCKED|0|Identidade do tópico versus subtipo não comprovada|
|E|0|0|0|0|0|0|0|0|0/0|0|INSUFFICIENT|BLOCKED|0|HTTP429; zero fonte adquirida|
|F|5|1|83|9|9|2|1|0|0/0|1|ADEQUATE|SCRIPT_GROUNDED|138|Componentes desconectados; sem falha/solução/estado final|
|G|10|1|479|3|3|1|0|0|0/0|1|ADEQUATE|SCRIPT_GROUNDED|50|Relativa e gerúndio ambíguos; sem transformação admitida|
|H|4|1|387|3|3|0|0|0|0/0|1|ADEQUATE|SCRIPT_GROUNDED|117|Ordem entre grupos, sem cadeia física conectada|

## Before/After

|ID|Facts26|Facts26B|Delta|Relations26|Relations26B|Delta|Story26 →26B|Writer26 →26B|
|---|---|---|---|---|---|---|---|---|
|A|4|4|0|4|4|0|ADEQUATE → ADEQUATE|SCRIPT_GROUNDED → SCRIPT_GROUNDED|
|B|4|4|0|4|4|0|ADEQUATE → ADEQUATE|SCRIPT_GROUNDED → SCRIPT_GROUNDED|
|C|1|4|3|1|4|3|THIN → ADEQUATE|KNOWLEDGE_LIMITED → SCRIPT_GROUNDED|
|D|0|0|0|0|0|0|INSUFFICIENT → INSUFFICIENT|BLOCKED → BLOCKED|
|E|0|0|0|0|0|0|INSUFFICIENT → INSUFFICIENT|BLOCKED → BLOCKED|
|F|0|9|9|0|9|9|INSUFFICIENT → ADEQUATE|BLOCKED → SCRIPT_GROUNDED|
|G|0|3|3|0|3|3|INSUFFICIENT → ADEQUATE|BLOCKED → SCRIPT_GROUNDED|
|H|0|3|3|0|3|3|INSUFFICIENT → ADEQUATE|BLOCKED → SCRIPT_GROUNDED|

## Poço

A preservado: 4 fatos/relações, 2 físicos, 1 causal explícito, ADEQUATE, SCRIPT_GROUNDED,64 palavras. Pressão/fluxo sustentados; nova resolução para “Geralmente são abertos” não foi adivinhada. A fragmentação literal de participantes continua visível no grafo.

## Turbina

B preservado: 4 fatos/relações, 1 físico,1 propósito e1 restrição, ADEQUATE, SCRIPT_GROUNDED,97 palavras. “Rotor é suportado” continua perda observada de voz passiva; não criar regra só para subir B. Referência Phase25 continua seu trace final reprocessado (2 definições/0 física), não o snapshot anterior ao conserto de truncagem.

## Other Six Benchmarks

C recupera definição/expulsão/propósito; D permanece bloqueado por identidade; E permanece sem dados; F recupera lista de componentes, função e cabine dentro da caixa; G somente definição/finalidade/operação principal; H recupera fluxo, primeiro estágio e ordem explícita entre grupos. São quatro domínios reais adicionais úteis, sem forçar os dois negativos.

## Generalization

PASS limitado à bateria definida e às verificações genéricas. Ganho real em quatro domínios distintos além de A/B; regras PT/EN verificadas em mais de um contexto quando aplicável. Fixtures incluem equipamento/câmara, circulação/mistura, guias/suportes e estágios distintos; são declaradas fictícias, nunca entram nos resultados reais. Testes negativos cobrem ambiguidade, metáfora, histórico inventado, condições, números, enumeração não temporal e contextos incompatíveis. Nenhum if por tópico ou expected relation no runtime. Não é validação de recall universal nem held-out em escala.

## Phase27Readiness

**PARTIAL** global; seis PARTIAL e dois NOT_READY, zero READY. Dimensões: mechanismDensity, connectedness, stateChanges, spatial, problemSolution, visualizable e persistentSystemPotential. Falta progressão conectada, mudança de estado e problema/solução reais. Metadata somente; visualExecution NOT_IMPLEMENTED. O atingimento dos mínimos da26B permite discutir um piloto restrito, não demonstra prontidão para composição visual generalista. **Phase27 NOT STARTED.**

## Replay

PASS com **0 chamadas de rede tentadas**. Fetch, HTTP/HTTPS e DNS bloqueados por interceptores que lançam erro. Foram verificados16 processamentos (8 Phase26 e8 Phase26B), quatro referências históricas,12 estágios puros da vertical Phase25, hashes de relatórios/lock/handoff,12 vídeos anteriores e o MP4 final Phase25. Nos8 casos26B, fingerprint completo do KnowledgeLossTrace também coincide. Arquivo: `phase26b/replay/final.json`. CLI gravado A confirmou a rota comum e o arquivo de trace sem nova aquisição.

## Provenance

Cada relação remonta a Fact/Evidence/source/hash/origin/locator/span e contexto exato. EXPLICIT_RELATION e CONTEXT_RESOLVED_RELATION mantêm suporte completo; métricas e intents não são fatos admitidos. Reassinatura de contexto, script, relação ou artefato adulterado é detectada por rederivação. Baseline Phase26 e resultados antigos conferidos por bytes; relatório histórico não reinterpretado como sucesso antigo.

## Security

PASS. HTTP/fetch/robots/cache/segurança/origins e lock/.gitignore não foram alterados pela26B; nenhum endpoint/modelo/dependência/serviço pago novo. Capacidades, quorum, fonte independente e separação de risco mantidos. Os deltas de v3/v4 pertencem à Phase26 já presente e mantêm cliente seguro/orçamentos, com PROCESS isolado. Nenhum segredo detectado nos arquivos de entrega; .env, caches, snapshots e outputs grandes ficam fora do Git. Nenhum stage/publicação.

## Anti-hardcode

PASS: 190 arquivos de runtime, 0 BLOCKER, controle negativo detectado. Scanner cobre tópicos, locators e superfícies finais adquiridas; lexicon/refusal antigos comparados ao checkpoint. O diagnóstico, fixtures e operadores podem conter exemplos, sem injetá-los na engine. Resultado: `phase26b/analysis/anti-hardcode.json`.

## Performance

Reprocessamento offline sequencial; budgets de aquisição não aumentados. Cache de escopo evita recalcular documento a cada sentença. Paths têm busca limitada e expõem incompletude; nos reais foi completa. Tempos de execução abaixo são observações locais, não benchmark comparável de velocidade.

|ID|Processing ms|
|---|---|
|A|14911.0|
|B|4113.27|
|C|7841.71|
|D|3083.85|
|E|11.45|
|F|9140.63|
|G|7922.13|
|H|2789.06|

## Tests

**961 testes únicos; 20 novos nesta26B; 21/21 comandos PASS**. Baseline Phase26 tinha941/69novos; checkpoint anterior872. As suítes específicas repetem testes, não somar seus counts ao total único. Unidades com fixtures/mocks, sem internet. Regressão repetida após proteção adicional da condição nominal e medição da direção causal; nenhum resultado histórico alterado.

|Command|Exit|Tests|Seconds|
|---|---|---|---|
|typecheck|0|—|10.446|
|check:engine3d|0|961|62.908|
|check:editorial|0|46|1.267|
|check:sound|0|35|3.088|
|check:visual|0|37|21.775|
|check:motion|0|30|2.51|
|check:demonstration|0|30|3.387|
|check:autodirector|0|23|4.76|
|check:semantics|0|40|2.342|
|check:narrative|0|35|5.951|
|check:writer|0|32|16.166|
|check:research|0|50|7.787|
|check:web-research|0|115|2.595|
|check:research-v2|0|39|2.835|
|check:research-v3|0|76|3.072|
|check:research-v4|0|65|4.131|
|check:topic-intelligence|0|28|3.829|
|check:vertical-slice|0|15|7.545|
|check:causal-curiosity|0|69|1.949|
|check:contextual-mechanism|0|20|1.491|
|engine3d:catalog|0|—|1.51|

## Registry

Engine3D **50**, SFX **8**, VISUAL **5**, verificados nos catálogos/registries. Catálogo consultado; nenhum asset, TSX por vídeo, render ou visual novo. Nenhuma mudança de engine determinística, resolução/fps/voz ou aprovação de mídia.

## Compatibility

Sem contextualMechanisms, mechanismVersion2 e extração/Writer históricos permanecem reproduzíveis. Campos novos de proof/story aparecem apenas no opt-in, evitando null/defaults que mudariam goldens. CLI factual PROCESS usa o novo opt-in; ficção/hipótese preservam rotas anteriores. Cold, população e Phase25 replays coincidem. package-lock, dependências e contratos antigos preservados.

## Limitations

Zero cadeia real problema/solução, zero estado final explicitamente tipado, nenhuma cadeia física de duas arestas e uma origem útil por caso. Quatro roteiros curtos e F ainda enciclopédico. Discovery de E e identidade de D continuam bloqueios. Não há tradução, parser universal, correferência geral, equivalência automática de entidades nem inferência científica transitiva. Traces automáticos são grosseiros por passagem e não localizam todo conhecimento omitido dentro de uma frase parcialmente recuperada; a revisão fixa torna isso explícito. Snapshots/goldens locais ignorados precisam de transporte separado. Precisão manual finita não certifica todas as fontes do mundo.

## Honest Assessment

Recall útil da bateria melhorou de2 para6; houve recuperação com menos fatos após excluir ambiguidades, não relaxamento de gates. Extração contextual e rastreabilidade melhoraram; densidade conectada e narrativa problema/solução continuam WEAK. ADEQUATE/SCRIPT_GROUNDED qualificam conhecimento para roteiro curto, sem provar qualidade falada, história rica ou execução visual. Não chamar source-supported de independentemente corroborado.

## Autonomy

**LEVEL4C+ mantido.** Nenhuma promoção automática por testes/contagens. Nenhum passo visual, commit ou publicação foi executado.

## Final Phase26 Gates

|Gate|Result|Evidence|
|---|---|---|
|P1|PASS|Checkpoint/branch preservados; baseline da árvore legítima congelada|
|P2|PASS|Phase26 inicial2/8 preservado; hashes e aquisições intactos|
|P3|PASS|Parsing PT/EN genérico e snapshots reais|
|P4|PASS|Negação/modalidade/condições preservadas|
|P5|PASS|Escopo/alias/heading limitados; ambiguidade recusada|
|P6|PASS|Grafo determinístico e métricas conectadas com provas|
|P7|PASS|Modelagem problema/solução sem inventar cadeia real|
|P8|PASS|Potencial determinístico; RICH conectado, gaps explícitos|
|P9|PASS|Sem tentativa ingênua ou história fabricada|
|P10|PASS|6 roteiros grounded; gate visual separado|
|P11|PASS|24 relações Writer-used; contagens por frases/palavras|
|P12|PASS|A preservado4relações/2físicas|
|P13|PASS|B preservado4relações/1física|
|P14|PASS|6/8 útil; mínimo6|
|P15|PASS|6/8 ADEQUATE/RICH; mínimo5, nenhum RICH|
|P16|PASS|Verificações genéricas e quatro domínios reais adicionais; limites declarados|
|P17|PASS|Cold/ficção/hipótese/histórico mantidos|
|P18|PASS|Replay0rede; contexto/script re-assinados detectados;8traces|
|P19|PASS|190 arquivos,0BLOCKER, controle negativo|
|P20|PASS|961 únicos;21/21comandos|

**PHASE26B IMPLEMENTATION COMPLETE; PHASE26 FINAL STATUS COMPLETE** pelos mínimos definidos nesta continuação. O resultado histórico INCOMPLETE continua preservado; não foi alterado retroativamente. Completion não promove autonomia nem fase visual.

## Next Recommendation

Planejar um piloto visual restrito às relações sustentadas, com gate próprio de conectividade/estado e sem inventar problema/solução. Prontidão geral continua PARTIAL. **Phase27 NOT STARTED.** Parar aqui; deixar Phase26+26B no working tree para revisão, sem commit/push.

---

## Finalização autorizada do checkpoint — 2026-10-29

Registro pré-commit: a revisão da Phase26 + Phase26B foi aprovada e a orientação de finalização autorizou commit único e push normal em origin/main. As menções anteriores a deixar a árvore sem commit/publicação descrevem a entrega de implementação para revisão. O checkpoint `19d55834c38d0fdf3dea86c4708cdf0db637dd63` é o pai oficial Phase25; o SHA do novo commit deve ser obtido pelo Git, sem autorreferência neste documento.

Foram reexecutados os 21 checks finais: PASS, 961 testes únicos; replay final PASS, 16 processamentos, oito fingerprints de KnowledgeLossTrace, quatro referências históricas e 12 estágios puros Phase25, com zero chamadas de rede. Anti-hardcode PASS, 190 arquivos, zero BLOCKER. Os artifacts confirmam os mesmos 6/8 useful, 6/8 ADEQUATE/RICH, 6/8 Writer eligible, 27 relações/18 novas/24 Writer-used e Writer-used Wrong = 0 na revisão manual finita. Nenhuma pesquisa live, fonte substituída, melhoria de código ou arquitetura nova nesta finalização.

As limitações continuam: zero RICH, zero cadeias reais Problem/Solution, cadeia física máxima de uma aresta, MechanismChainCoverage = 0, D/E bloqueados e Phase27Readiness PARTIAL (6 PARTIAL, 2 NOT_READY, 0 READY). Process knowledge e mechanism extraction permanecem PARTIAL; generalização limitada, PASS nos gates definidos. LEVEL4C+ e registry 50/8/5 preservados. Phase27 NOT STARTED.

Após o replay, CLONAI_HANDOFF.md recebeu a atualização documental do checkpoint lógico, preservando integralmente o texto antigo. O checksum histórico desse handoff pertence à versão Phase25 recuperável no checkpoint anterior; nenhum checksum congelado foi substituído para acomodar a revisão documental. As únicas mudanças da finalização são essa atualização e esta nota, sem alterar os resultados históricos ou os arquivos aprovados de runtime/tests/tools.

Logs e verificações desta finalização ficam em out/engine3d/phase26/finalization/, fora do Git. Código e documentação pertencem ao commit; snapshots, mídia, caches, secrets e outputs grandes permanecem excluídos. Não criar tag nem iniciar a fase seguinte.

---

# Historical initial Phase26 report — preserved verbatim

The following is the INITIAL result, not the current consolidated status. Frozen hash: `c17111b63c61dcea7c0632d8730bb80da113685b57fbdbcf847a173a107dd268`.

# Phase 26 — Causal Curiosity Storytelling — Partial final report

Data: 2026-10-29. Base imutável: `19d55834c38d0fdf3dea86c4708cdf0db637dd63`. Branch: `main`.

## Objective

**PHASE26 COMPLETE: NO — resultado parcial.** Implementação e regressão passam; os gates reais P14/P15/P16 não passam. Foram entregues extração de mecanismo v2, conhecimento causal, plano editorial e Writer específico de curiosidade. A bateria real alcançou 2/8 com mecanismo útil, 2/8 ADEQUATE/RICH e 2/8 Writer eligible. Nenhum resultado foi completado com conhecimento interno.

## Starting State

Em 2026-10-29: `main`, HEAD exatamente `19d55834c38d0fdf3dea86c4708cdf0db637dd63`, working tree CLEAN antes da primeira edição. Lidos integralmente CLONAI_HANDOFF e PHASE23/24/25_REPORT; auditados Topic, Research, Writer, Semantics, Narrative, Auto Director, Vertical, DirectedSequence, demonstração, catálogo e replay. A captura `baseline/baseline.json` foi escrita após adicionar a ferramenta de instrumentação; seu status Git inclui essa ferramenta, não substitui a verificação inicial. Não houve reset/clean/commit/push/tag/remote.

## Phase25 Lessons

Baseline fresca: 872 testes. Poço: 3 fatos, 1 claim física, 5 editoriais, 111 palavras; turbina bloqueada no processamento final por ausência de mecanismo admissível. O arquivo de aquisição secundária contém uma versão anterior ao conserto de truncagem (3 tuplas, incluindo uma inválida); o trace `probe-turbine-final` e a reconstrução com o código legado são a referência correta. Essa distinção está em `baseline/secondary-checkpoint-rebuild.json`; nenhum artefato histórico foi editado.

## Architecture

Opt-in `sourcePolicy.mechanismVersion: 2`, apenas PROCESS e researchVersion >=2; não existe Research v5. Contratos FactType/Modality/SourceSpan, admissibilidade, origens, snapshots e transporte foram reutilizados. `mechanism-language.ts` centraliza gramática; `mechanism-v2.ts` extrai; `process-planning.ts` define lacunas/queries; `src/curiosity/{knowledge,story,replay}.ts` constrói e verifica; `src/writer/curiosity.ts` escreve. `cli/curiosity.ts` aceita tópico factual como única entrada necessária. `npm run curiosity:run -- "<topic>" [outputDirectory] [recordedSession.json]`.

## Mechanism Extraction v2

Regras fechadas para voz ativa/passiva, causa explícita, função, prevenção, permissão, composição, fluxo, transformação, ação mecânica, localização e antes/depois com dois eventos explícitos. Sem inferência de causalidade por coocorrência. Negações, contrações negativas, prevenção falha, fórmulas/quantidades numéricas e referências não resolvidas abstêm. Conjunção “e” não é cópula “é”; tempo decorrido não vira etapa. A auditoria real removeu notas de navegação, sujeitos relativos e definições de instâncias alheias que os primeiros fixtures não cobriam. Resultados preliminares não são resultados finais.

## Language Coverage

PT-BR e EN cobertos por fixtures e integração EvidencePack→Story→Writer. Corrigida a extração do assunto de “How does … work?”, que apagava toda a pergunta. Modalidade e seus marcadores literais são preservados. Não há tradução interna; o roteiro em inglês usa superfícies inglesas. A bateria live A–H é PT-BR. O Semantic Engine visual legado continua pt-BR; não se afirma produção visual inglesa.

## Evidence Semantics

Cada relação contém fact IDs, evidências, sourceId, locator, SHA-256 do snapshot, span exato, contexto de heading/alias, originGroupId, status, modalidade, qualifiers e contexto temporal ou null. A evidência usa a frase completa para preservar escopo e condições. Só facts policy-admitted entram em conhecimento. Source title/alias delimita escopo, nunca cria automaticamente HAS_COMPONENT. Alias exige conector literal e os dois nomes; nome parecido não basta.

## Causal Knowledge

MechanismKnowledge deriva métricas e cobertura qualitativa. CausalConstructionGraph contém exclusivamente arestas literais com provas. Requer mecanismo físico e uma dimensão complementar para PROCESS READY; três frases de fluxo redundante ficam THIN. Nem toda categoria é obrigatória. Os nós conservam sujeitos distintos; contexto do sistema não equivale a identidade de entidade.

## Problem/Solution Modeling

SOLVES/PREVENTS/FAILS_BECAUSE têm prova literal. Uma condicional de ausência não prova necessidade nem problema; prevenção isolada também não recebe papel SOLUTION. Cadeia SOLVES→CAUSES→SOLVES pode marcar NEW_PROBLEM/NEXT_SOLUTION quando participantes coincidem. Ligações de participante são navegação editorial, não novas conclusões factuais ou cronologia. Isso passa em fixtures fictícias. Nenhuma cadeia real problema/solução foi demonstrada em A–H; ausência permanece GAP.

## Story Potential

RICH/ADEQUATE/THIN/INSUFFICIENT são heurísticas determinísticas de suporte. Propósito explícito com operação física e conhecimento complementar pode sustentar ADEQUATE sem problema artificial. RICH exige mais relações e dimensões. O rating não certifica naturalidade, progressão ou qualidade final; a review mede essas dimensões separadamente.

## Curiosity Story Planning

GOAL, SETUP, ATTEMPT, PROBLEM, EXPLANATION, SOLUTION, STATE_CHANGE, NEW_PROBLEM, NEXT_SOLUTION e PAYOFF somente quando relações permitem. Nenhuma naive attempt é sintetizada; história da invenção fica vazia. Ordem de discurso é explicitamente EDITORIAL_DISCOURSE_ONLY. Fonte próxima, mesmo artigo ou sequência de frases não prova causa ou ordem física.

## Writer Integration

Rota exportada CAUSAL_CURIOSITY_PROCESS; um hook não assertivo e frases completas source-exact. Não há preenchimento para 110 palavras. SCRIPT_GROUNDED indica elegibilidade narrativa; visual/MP4 são gates separados. O status KNOWLEDGE_LIMITED indica conteúdo/rota insuficiente; lengthStatus=KNOWLEDGE_LIMITED marca comprimento abaixo do alvo mesmo quando o status é SCRIPT_GROUNDED. Preview parcial não é elegibilidade. Surface realization segura ainda soa documental; não é um paraphrase engine geral. Teste de integração da CLI com sessão gravada: PASS, SCRIPT_GROUNDED, 4 unidades, 64 palavras; artefatos em `cli-smoke/`. Nenhuma nova aquisição nesse teste.

## Semantic Handoff

Cada relação selecionada acompanha sentence IDs, story node IDs e prova no handoff, junto do grafo legado real. Nenhuma claim oculta é injetada no compilador. Relações não suportadas pelo legado ficam listadas e visualExecution=NOT_EVALUATED. A representação preserva o que foi extraído; não demonstra que toda a sintaxe da frase original foi compreendida. Cobertura semântica geral permanece parcial.

## Presenter Intent

PRESENTER_CONTEXT/OBSERVES/POINTS/REACTS/REVEALS/PAYOFF são intenções semânticas. Não houve personagem, rigging ou animação novos.

## World Context Intent

ESTABLISH_WORLD, SHOW_SYSTEM_IN_CONTEXT, SHOW_INTERNAL_STRUCTURE, CUTAWAY_REQUIRED, RETURN_TO_WORLD e SHOW_FINAL_SYSTEM quando pertinentes. Sem coordenadas, assets, cenário ou renderer novos.

## Persistent System Intent

O plano indica continuidade de contexto em vários nós; CONTEXT_NOT_IDENTITY impede assumir conexões físicas não provadas. Este é apenas o contrato de entrada para direção futura. Não foi implementado mundo persistente.

## Benchmark Battery

Oito temas permanentes em `tools/phase26/benchmarks.ts`, exclusivamente inputs de operador. Primeira coleta A–H preservada em `research/live-*.json`. A/B tiveram coleta final após hardening (`live-final-*`). C–H usam snapshots live originais e processamento final offline. Não se alega que a antiga decisão de aquisição foi recalculada com a gramática nova. Coletas e falhas de desenvolvimento ficam preservadas. Nenhuma coleta Cold foi refeita.

## Per-Benchmark Results

| ID / Topic | Intent / Route | Research | Sources / useful | Facts / relations / physical | Causal / problem / solution | Potential | Writer / reason |
|---|---|---|---|---|---|---|---|
| A — Como funciona um poço artesiano? | EXPLANATION / STANDARD | RESEARCH_READY | 9 / 1 | 4 / 4 / 2 | 1 / 0 / 0 | ADEQUATE | SCRIPT_GROUNDED / — |
| B — Como funciona uma turbina hidráulica? | EXPLANATION / STANDARD | RESEARCH_READY | 10 / 1 | 4 / 4 / 1 | 1 / 0 / 0 | ADEQUATE | SCRIPT_GROUNDED / — |
| C — Como funciona um motor a jato? | EXPLANATION / STANDARD | RESEARCH_INCOMPLETE | 10 / 1 | 1 / 1 / 0 | 0 / 0 / 0 | THIN | KNOWLEDGE_LIMITED / RESEARCH_INCOMPLETE |
| D — Como funciona uma bomba d'água? | EXPLANATION / STANDARD | RESEARCH_INCOMPLETE | 6 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | INSUFFICIENT | BLOCKED / RESEARCH_INCOMPLETE |
| E — Como funciona uma geladeira? | EXPLANATION / STANDARD | RESEARCH_INCOMPLETE | 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | INSUFFICIENT | BLOCKED / RESEARCH_INCOMPLETE; provider HTTP 429 |
| F — Como funciona um elevador? | EXPLANATION / STANDARD | RESEARCH_INCOMPLETE | 5 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | INSUFFICIENT | BLOCKED / RESEARCH_INCOMPLETE |
| G — Como funciona uma usina hidrelétrica? | EXPLANATION / STANDARD | RESEARCH_INCOMPLETE | 10 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | INSUFFICIENT | BLOCKED / RESEARCH_INCOMPLETE |
| H — Como funciona o tratamento de água? | EXPLANATION / STANDARD | RESEARCH_INCOMPLETE | 4 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | INSUFFICIENT | BLOCKED / RESEARCH_INCOMPLETE |

Critério “mecanismo útil”: ao menos uma relação física explícita e duas relações únicas. Facts desta tabela são unidades de mecanismo admitidas, não todo ruído estrutural do EvidencePack. Fontes aceitas não são automaticamente fontes que contribuem fatos.

## Phase25 Comparison

| Metric — poço | Phase25 | Phase26 | Delta |
|---|---|---|---|
| accepted sources | 5 | 9 | 4 |
| contributing sources | 1 | 1 | 0 |
| grounded knowledge units | 3 | 4 | 1 |
| unique relations | not measured historically | 4 | N/A |
| physical claims | 1 | 2 | 1 |
| causal claims | 1 | 1 | 0 |
| grounded sentence units | 3 | 2 | -1 |
| editorial filler units | 5 | 1 | -4 |
| grounded sentence ratio | 37.5% | 66.67% | +29.17 pp |
| knowledge-unit ratio | 37.5% | 80.00% | different denominator; explicitly shown |
| words | 111 | 64 | -47 |
| facts/source | 0.6 | 0.4444 | -0.1556 |
| Writer / visual gate | PRODUCTION_ELIGIBLE / measured MP4 | SCRIPT_GROUNDED / not evaluated | different production scope |

Comparações live envolvem observações distintas. `recorded-A/B` isola a gramática sobre snapshots Phase25. Não se inventa baseline para C–H nem para métricas que Phase25 não mediu. O yield por fonte do poço caiu apesar do pequeno ganho de conhecimento: mais aquisição não resolveu o gargalo.

## Poço Result

4 unidades, 2 físicas, 1 causal, 1 fonte útil. 64 palavras, 1 editorial, grounded sentence ratio 0.6667. Ganho modesto e honesto; não atingiu 6–15 unidades, progressão rica ou payoff funcional. O script curto não foi inflado e não houve TTS/render novo. Duração apresentada é estimativa, não áudio medido.

## Turbine Result

4 relações, 1 física, 1 funcional, 1 restrição. Writer SCRIPT_GROUNDED, 97 palavras; supera o bloqueio específico da Phase25. Continua com uma origem, sem sequência ou cadeia problema/solução. Não demonstra vídeo mecânico DIRECT.

## Cross-Domain Generalization

**WEAK no mundo real.** 2/8 mecanismos úteis e 2/8 Writer eligible. Fixtures de diferentes sistemas e verbos passam; isso não substitui os benchmarks reais. C tem alias/escopo e sintaxe de mecanismo limitados; D não tem identidade suficiente para os documentos encontrados; F/G/H não produziram mecanismos admissíveis com a gramática e escopo finais. Não se ampliou um whitelist de nomes nem se promoveu uma frase ambígua para elevar contagens. No caso C, a relação admitida é de inclusão em uma definição/classificação; ela não demonstra componente físico nem mecanismo e não liberou o Writer.

## Paraphrase Generalization

PASS para os pares de turbina e refrigeração: requisitos, risco e rota equivalentes. Queries e conteúdo descoberto podem diferir; não se exige fingerprint igual. Testes em `causal-curiosity.test.ts`.

## Cold Regression

PASS: STRICT, ranking route, quorum, residency, eligibility e superlativo global preservados; replay da sessão Phase23. Nenhum Cold live. O campo mechanismVersion é recusado em RANKING.

## Fiction Regression

PASS: eventos ficcionais não se tornam EvidenceRequirement factual. A CLI de curiosidade exige processo factual; roteamento criativo existente permanece indisponível e isolado.

## Hypothetical Regression

PASS: premissa hipotética preservada e não afirmada; consequências não viram observações. Modality HYPOTHETICAL e condicionais permanecem explícitas.

## Historical Safety

PASS em fixtures e auditoria: função não vira motivo histórico. Não há história inventada, tentativa popular presumida ou invenção inferida de engenharia.

## Replay

PASS: 0 tentativas de rede. Reconstituídos pack, knowledge, graph, story, Writer, script e trace dos oito resultados finais. A/B também passam pelo replay completo do processamento da aquisição final; C–H têm aquisição pré-hardening validada e seu processamento final reexecutado, não equivalência com o antigo pack de desenvolvimento. Sessões históricas e 12 stages puros Phase25 conferidos. `replay/final.json`.

## Provenance

PASS: cadeia de hashes e IDs liga roteiro→story→knowledge→facts→evidence→snapshot. `verifyProcessAcquisition` exige correspondência exata com snapshot adquirido. Re-signing de relação, nó, link, Writer ou pack não basta: rederivação é comparada. Hashes dos relatórios 23/24/25, handoff, package-lock e vídeos históricos conferidos no replay; nenhum histórico reescrito.

## Security

Transporte seguro existente preservado: SSRF, DNS/pinning, redirects, robots, MIME, charset, bytes e timeouts. Nada de OCR/PDF/JS universal, bypass ou APIs pagas. Texto externo é dado. HTTP 429 observado em E; foi introduzida parada conservadora de provider na sessão opt-in, comprovada por mock sem rede. A coleta E antiga preserva a falha; não houve tentativa de contornar o limite. Quorum/Claim Risk não foram reduzidos. Quantidades numéricas/fórmulas são recusadas pelo novo caminho e dependem das políticas já existentes.

## Anti-hardcode

PASS: 186 arquivos runtime, 0 BLOCKER, controle negativo detectado. O scanner cobre os oito temas, frases finais e URLs efetivamente adquiridas. Ocorrências pré-existentes em léxico genérico e recusa legada são classificadas e comparadas ao checkpoint; não há exceção para código novo específico de benchmark. Fixtures, harness e relatórios podem conter tópicos.

## Performance

| ID | queries | results | fetches | bytes | sources | useful | facts/source | facts/1000 chars | measured processing ms |
|---|---|---|---|---|---|---|---|---|---|
| A | 6 | 24 | 10 | 4272717 | 9 | 1 | 0.4444 | 0.0085 | 34386.6 |
| B | 6 | 24 | 10 | 1521941 | 10 | 1 | 0.4 | 0.0337 | 40498.4 |
| C | 8 | 32 | 10 | 3313441 | 10 | 1 | 0.1 | 0.0029 | 161732.2 |
| D | 8 | 8 | 6 | 1107793 | 6 | 0 | 0 | 0 | 69731.7 |
| E | 8 | 0 | 0 | 2192 | 0 | 0 | 0 | 0 | 424.9 |
| F | 8 | 12 | 5 | 2954407 | 5 | 0 | 0 | 0 | 7727.9 |
| G | 6 | 24 | 10 | 2375613 | 10 | 0 | 0 | 0 | 5846.8 |
| H | 7 | 4 | 4 | 1330461 | 4 | 0 | 0 | 0 | 3360.7 |



| ID | evidence extracted | all candidates | mechanism candidates | mechanism admitted |
|---|---|---|---|---|
| A | 4 | 4 | 4 | 4 |
| B | 4 | 4 | 4 | 4 |
| C | 1 | 1 | 1 | 1 |
| D | 0 | 0 | 0 | 0 |
| E | 0 | 0 | 0 | 0 |
| F | 0 | 0 | 0 | 0 |
| G | 0 | 0 | 0 | 0 |
| H | 0 | 0 | 0 | 0 |

Tempos de processamento ocorreram sob pressão de memória e concorrência inicial; não são um benchmark comparável de velocidade com Phase25. A análise auxiliar foi interrompida, snapshots preservados e processamento restante separado em processos sequenciais com heap limitado. Large outputs continuam ignorados. Nenhum custo pago novo.

## Tests

**941 testes únicos; 69 novos; 20/20 comandos PASS.** Fixtures fictícias e providers mockados; unidades sem internet. Houve repetição da suíte e dos checks relacionados após corrigir o assunto inglês. 

| Command | Exit | Tests | Seconds |
|---|---|---|---|
| check:editorial | 0 | 46 | 1.781 |
| check:sound | 0 | 35 | 5.655 |
| check:visual | 0 | 37 | 43.31 |
| check:motion | 0 | 30 | 5.859 |
| check:demonstration | 0 | 30 | 28.658 |
| check:autodirector | 0 | 23 | 60.21 |
| check:semantics | 0 | 40 | 24.124 |
| check:narrative | 0 | 35 | 159.858 |
| check:writer | 0 | 32 | 371.733 |
| check:research | 0 | 50 | 98.32 |
| check:web-research | 0 | 115 | 31.829 |
| check:research-v2 | 0 | 39 | 4.395 |
| check:research-v3 | 0 | 76 | 4.661 |
| check:research-v4 | 0 | 65 | 5.862 |
| engine3d:catalog | 0 | — | 14.228 |
| typecheck | 0 | — | 12.036 |
| check:engine3d | 0 | 941 | 51.242 |
| check:topic-intelligence | 0 | 28 | 3.468 |
| check:vertical-slice | 0 | 15 | 8.012 |
| check:causal-curiosity | 0 | 69 | 2.571 |



| Gate | Result | Evidence |
|---|---|---|
| P1 | PASS | Checkpoint e branch conferidos; árvore inicialmente limpa antes de editar |
| P2 | PASS | Baseline histórica + 872 testes; snapshots A/B preservados |
| P3 | PASS | Extração PT/EN em fixtures fictícias |
| P4 | PASS | Negação, modalidade, condicionais e contrações |
| P5 | PASS | Identidade, alias explícito, seções, captions e sujeitos não resolvidos |
| P6 | PASS | Grafo reconstruído e fingerprints comparados |
| P7 | PASS | Problema/causa/solução com provas em fixtures; sem cadeia real inventada |
| P8 | PASS | StoryPotential determinístico; ausências como GAP |
| P9 | PASS | Plano sem naive attempt ou história sintetizados |
| P10 | PASS | Rota CAUSAL_CURIOSITY_PROCESS libera roteiro em A/B |
| P11 | PASS | Razão por frases e unidades de conhecimento medidas |
| P12 | PASS | Poço: 3→4 unidades; 1→2 relações físicas |
| P13 | PASS | Turbina: mecanismo útil e Writer; referência correta é o replay final Phase25 |
| P14 | FAIL | 2/8 com mecanismo útil; mínimo 5/8 |
| P15 | FAIL | 2/8 ADEQUATE/RICH; mínimo 4/8 |
| P16 | FAIL | Fixtures/paráfrases PASS; generalização real continua fraca |
| P17 | PASS | Cold gravado, ficção e hipótese sem relaxamento |
| P18 | PASS | Replay zero rede, prova e adulteração re-assinada |
| P19 | PASS | Scanner ampliado + controle negativo |
| P20 | PASS | 941 testes únicos; 20/20 comandos |

## Registry

Engine3D 50 / SFX 8 / VISUAL 5 — inalterados. Catálogo consultado, nenhuma necessidade de asset novo; nenhum vídeo novo ou visual polish.

## Compatibility

Ausência de mechanismVersion mantém extração/query/Writer históricos. A mudança geral adicional é o conserto da noun phrase em perguntas inglesas; Cold e requests PT antigos continuam iguais. Sem dependências/lock/versões novas; sem alteração de Engine3D/Three/R3F/Remotion, voz ou aprovações de mídia.

## Limitations

Gramática fechada e baixo recall; identidade por título/alias explícito recusa fontes potencialmente pertinentes com nomes diferentes. Sem coreferência geral, tradução, síntese abstrativa, entendimento universal de cláusulas ou parser universal de componentes. Zero cadeias reais problema/solução e zero segunda origem útil. Rating de potencial pode ser ADEQUATE com pouca progressão; o review deixa essa falta explícita. O Writer source-exact ainda não entrega a qualidade falada desejada. Goldens/snapshots grandes são locais e precisam ser transportados separadamente do Git. Não se conclui Phase26 integralmente.

## Honest Assessment

| Dimension | Assessment |
|---|---|
| PROCESS RESEARCH | WEAK |
| MECHANISM EXTRACTION | ACCEPTABLE |
| KNOWLEDGE DENSITY | WEAK |
| SUBJECT IDENTITY | ACCEPTABLE |
| CAUSAL REASONING | ACCEPTABLE |
| PROBLEM/SOLUTION MODELING | ACCEPTABLE |
| SEQUENCE UNDERSTANDING | WEAK |
| SPATIAL UNDERSTANDING | ACCEPTABLE |
| STORY POTENTIAL | ACCEPTABLE |
| CURIOSITY STORYTELLING | WEAK |
| WRITER | ACCEPTABLE |
| TRACEABILITY | STRONG |
| GENERALIZATION | WEAK |
| DETERMINISM | STRONG |
| REPLAY | STRONG |
| PROVENANCE | STRONG |
| SAFETY | GOOD |
| ANTI-HARDCODE | STRONG |
| LEGACY COMPATIBILITY | STRONG |
| OVERALL AUTONOMY | ACCEPTABLE |

A arquitetura demonstrou relações grounded e preservação de evidência; a generalização real e a história causal rica continuam fracas. Os gates reprovados não foram renomeados como sucesso de implementação.

## Autonomy

**LEVEL4C+ mantido.** Nenhuma promoção automática. Dois roteiros admissíveis e gramática determinística não provam autonomia superior.

## Biggest Remaining Bottleneck

Baixo recall contextual de mecanismos na prosa real, principalmente identidade de sistema e relações entre orações sem truncagem ou referências adivinhadas.

## Phase27 Recommendation

Priorizar o fechamento dos gaps de conhecimento da bateria antes de ampliar os visuais. O handoff de intents existe, mas a cobertura atual não sustenta uma implementação visual generalista. **Phase27 NOT STARTED.** Working tree deixado para revisão, sem commit/push.
