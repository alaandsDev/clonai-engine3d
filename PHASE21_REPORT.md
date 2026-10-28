# Fase 21 — Multi-Source Research, Primary Source Discovery & Structured Evidence Extraction v2

**COMPLETE — implementação entregue e validada; 32/33 gates PASS e 1 gate PASS pela via de diagnóstico (Gate 25). Cold Places continua REAL_RESEARCH_BLOCKED (0/5 elegíveis), agora com 16 fontes de 8 publishers e diagnóstico preciso por entidade. Segundo domínio real (população recenseada): 256 fatos estruturados com proveniência de célula, 0 admitidos por falta de origem independente. Sem relaxar quórum. Sem novo MP4. LEVEL4C mantido.**

Evidências em `out/engine3d/phase21/`. Tentativas de desenvolvimento preservadas em `out/engine3d/phase21/development-attempts/` e fora dos totais finais.

## A. Objective

Sair de "achei uma página na Wikipedia" para descoberta multi-fonte, seguimento de referências, resolução de origem, extração estruturada e corroboração por origens independentes, reutilizando o núcleo das Fases 19/20. Resultado: toda a infraestrutura foi construída e exercitada em web real e em testes offline; a web real **não** sustentou nenhum item Cold com duas origens independentes — e o sistema recusou corretamente concluir o ranking.

## B. Starting State

Fase 20: LEVEL4C experimental, 29/29 gates, 649 testes rápidos (534 + 115 web), registry 50/8/5, MediaWiki como único provider, 1 domínio, 0 CORROBORATED, Cold REAL_RESEARCH_BLOCKED (5 fontes, 0 fatos utilizáveis). Auditoria inicial desta sessão: checkout `clonai-engine3d`, HEAD `71f85e3` = `origin/main`, árvore limpa, 649/649 PASS.

## C. Architecture

```text
ResearchRequest (sourcePolicy.researchVersion = 2)
  → planResearch (inalterado)
  → runWebResearchV2
      R0 BROAD_DISCOVERY      MediaWiki (corpus de referência) → snapshots
      Rn VERIFICATION         página própria da entidade para a família de fato ausente
      Rn ORIGIN_DISCOVERY     ReferenceCandidate (rodapés/links ligados à evidência) → snapshots
      Rn CORROBORATION        Wikidata (site oficial declarado) · OpenAlex (obras acadêmicas)
  → buildEvidencePack (núcleo Fase 19, ramo v2 opt-in)
      structured.ts  tabelas/listas/dl/chave-valor/CSV-TSV/JSON-LD (dados, sem execução)
      english.ts v2  contextos de temperatura, residência v2, datas, contagens, aposto
      origins.ts     SourceGraph · origin groups · aliases
      v2.ts          EvidenceQuality · conflitos v2 · corroboração por raízes de origem
      ranking.ts v2  lacunas por entidade · residência atual
  → GROUNDED_ONLY writer / FactualPreflight / Semantic Engine / Reconciliation (inalterados)
  → replayWebResearch (inalterado; reconstrói pack v2 + SourceGraph a partir dos snapshots)
```

Sem segundo núcleo: o ramo v2 vive dentro de `buildEvidencePack` e reutiliza ResearchRequest/Plan, Evidence, FactCandidate, GroundedFact, EvidencePack, ranking, writer, preflights, sessão, cache, snapshots, replay e segurança. Sem `researchVersion: 2` o caminho v1 é byte-idêntico (AL).

Arquivos novos: `src/research/structured.ts`, `src/research/origins.ts`, `src/research/v2.ts`, `src/research/web/v2.ts`, `src/research/web/review.ts`, `cli/research-v2-audit.ts`, `tests/research-v2.test.ts`, `examples/research/web-v2-cold-request.json`, `examples/research/web-v2-population-request.json`. Alterados: ver AL.

**Divergências do prompt, documentadas:** (1) a métrica Cold continua `metric: TEMPERATURE` + qualifier `MINIMUM_RECORDED` (contrato existente); "AIR_TEMPERATURE" é garantido por exclusão — superfície, satélite, wind chill, mensal, média e média de mínimas são qualifiers distintos que nunca satisfazem `MINIMUM_RECORDED`. (2) SEASONAL_POPULATION é representado pelo SEASONAL_PRESENCE existente. (3) StructuredTable/StructuredDataset são o tipo interno `StructuredGrid`; o pack guarda `StructuredSummary` + `Evidence.structured`.

## D. Multi-source discovery

Uma sessão v2 executa estratégias diferentes por estágio: R0 BROAD_DISCOVERY pelo corpus MediaWiki; em cada rodada seguinte VERIFICATION, ORIGIN_DISCOVERY e CORROBORATION. Cada estratégia registra execução, queries, resultados, candidatos e diagnósticos (`session.v2.strategies`). Falha de provider é registrada e os demais continuam (teste com Wikidata HTTP 503; live: `WIKIDATA_NO_OFFICIAL_WEBSITE`). Queries idênticas da mesma estratégia não se repetem. No Cold final as **4 estratégias foram executadas**.

## E. Search providers

`SearchProvider` continua a interface de descoberta; `DiscoveryStrategy` nomeia: `MEDIAWIKI_REFERENCE_SEARCH`, `REFERENCE_FOLLOWING` (sem busca: gera candidatos a partir dos snapshots), `WIKIDATA_ENTITY_DISCOVERY` (wbsearchentities + wbgetentities; só P856 "site oficial") e `OPENALEX_ACADEMIC_SEARCH` (works search; landing page/DOI). Todos gratuitos, sem chave, pelo mesmo `SecureHttpClient`. Nenhuma busca web genérica paga ou scraping de buscador. **Provider não é SourceType:** a classe é decidida depois do fetch (dica de domínio explícita, corpus de referência, original arquivado, meta tags acadêmicas, publisher em JSON-LD; senão OTHER). Exemplo real: o site oficial do hamlet de Grise Fiord foi descoberto via Wikidata e classificado OTHER, porque nada no snapshot o declara oficial.

## F. MediaWiki role

Mantido como REFERENCE DISCOVERY: descobre entidades, páginas de entidades, tabelas climáticas e, principalmente, os rodapés que apontam para agências, datasets e notícias. Wikipedia é classe REFERENCE e um único grupo de origem (domínio registrável `wikipedia.org`). Não é mais o único corpus: 12 de 16 fontes aceitas no Cold vêm de outros domínios.

## G. Reference following

`ReferenceCandidate` = sourceId, targetUrl, anchorText, contextSpan (evidência apoiada), referenceType (FOOTNOTE_CITATION / INLINE_LINK / DATASET_LINK / ARCHIVED_COPY / PDF_DOCUMENT / INSTITUTION_LINK), researchQuestionIds, confidence, reason, evidenceIds, subject, gap, archiveUrl, priority, status, fetchAttemptIds. Só são seguidas referências **anexadas à evidência** de fatos ainda não CORROBORATED de entidades com lacuna — nunca um crawl — no máximo 6 por fonte. Citações vêm de rodapés dentro/logo após o span, links inline do span e, para tabelas, da atribuição de dados na seção que introduz a tabela (somente se o texto declara censo/fonte/dados). PDF não é baixado. Original morto ou que **mudou** (não contém mais o sujeito citado) é substituído pela cópia arquivada listada na própria referência: é MIRROR do mesmo original. Caso real: `wmo.asu.edu/asia-lowest-temperature` hoje redireciona para uma página genérica do `wmo.int`; a cópia de 2010 listada no rodapé foi buscada e agrupada como a mesma origem.

Cold final: 17 referências descobertas, 10 buscadas, 3 falharam, 4 cortadas pelo teto por fonte.

## H. SourceOriginResolver

`buildSourceGraph` + `groundFactsV2`: relações simétricas por snapshot (MIRRORS, NEAR_COPY, SAME_PUBLISHER, origem declarada) e direcionais (CITES de página; DERIVED_FROM/REPORTS por evidência). Evidência que cita ou atribui o valor a outra fonte da sessão que apoia o mesmo fato é derivada e não conta como origem; ciclo de citação mútua vira uma raiz única. PRIMARY_ORIGIN marca a origem mais antiga **detectável na sessão**, não o publicador original real. Exemplo real: as duas frases de residência de Oymyakon na Wikipedia citam a Condé Nast Traveler → DERIVED_FROM → 1 raiz, não 2.

## I. SourceGraph

Nós = SourceDocument (locator, domínio registrável aproximado, publisher, classe, originGroupId); arestas = OriginRelation com factId/evidenceIds/razão. Fingerprint canônico, invariante à ordem das fontes (teste), reproduzido no replay. Cold final: 16 nós, 7 grupos, 49 relações. UNKNOWN_RELATION registra explicitamente que nenhuma relação foi detectável — não é certificado de independência. Review: `review/source-graph.md`.

## J. Origin groups

Cada Evidence v2 recebe `originGroupId`. Grupos = componentes das relações simétricas; links de citação nunca fundem grupos. `independentOriginCount` = raízes após remover evidência derivada e fundir raízes que compartilham grupo ou URL citada. Cold: 7 grupos (Wikipedia; 6 páginas BOM; WMO original + arquivo; ECCC; site do hamlet; InspireMore; Condé Nast).

## K. Primary source discovery

Origens primárias/oficiais **foram alcançadas** via rodapés: Bureau of Meteorology (6 páginas de estatísticas de estações), Environment and Climate Change Canada (página de normais), arquivo WMO de extremos (cópia 2010), NOAA (CSV de normais — timeout), teses da University of Tasmania (PDF — não suportado). Nenhuma recebeu classe PRIMARY_*: a classe exige declaração explícita (dica de domínio) e nenhuma heurística de TLD promove classe. `primaryEvidenceId` prefere PRIMARY > ACADEMIC/INSTITUTIONAL > REFERENCE/NEWS > OTHER e depois EvidenceQuality.

**Proveniência das fontes primárias/oficiais (Cold):** BOM ← rodapés das tabelas climáticas da Wikipedia "Liawenee" (REFERENCE_LINK) e link no próprio BOM; ECCC ← rodapé da tabela "Grise Fiord"; WMO ← rodapé da tabela "Oymyakon" (+ ARCHIVED_COPY); site do hamlet ← Wikidata P856 (INSTITUTION_LINK); teses UTAS ← OpenAlex (PDF, não buscado).

## L. Source selection

Orçamento por estágio; prioridade de referências: rodapé de frase > célula de tabela; + hostname institucional (vocabulário genérico: gov/edu/meteo/climate/stat/census…), + dataset, + arquivo; PDF fora. Cota por domínio e limites globais continuam valendo. Entidades prontas não recebem orçamento.

## M. Alias resolution

`AliasCandidate` com sourceId + span: CONFIRMED só por redação explícita (also known as / spelled / nome em outra língua), LIKELY por JSON-LD alternateName, AMBIGUOUS por similaridade (Levenshtein ≤ 2), REJECTED por "not to be confused with". Só CONFIRMED funde sujeitos; contradição desativa a fusão e gera ENTITY_CONFLICT. Live: CONFIRMED_ALIAS para nomes locais (cirílico/inuktitut) de Oymyakon e Grise Fiord. A grafia "Oimaykon" do registro WMO **não** foi fundida (nenhuma fonte a declara alias).

## N. Structured extraction

Tokenizador HTML sensível a aspas (atributos podem conter `>`), sem executar script/estilo; nav/aside/iframe ignorados. Estruturas: tabelas, listas, listas de definição, chave/valor tipo infobox, CSV/TSV e JSON-LD (só apoio). Cada valor guarda span bruto da célula; cabeçalhos, caption e sujeito têm spans próprios validados por `validateEvidencePack`. Limites: 64 tabelas/fonte, 400 linhas, 40 colunas, span ≤ 40, 2000 caracteres/célula, 128 listas, 300 itens, 5000 linhas e 64 colunas por dataset, JSON-LD ≤ 64 KiB e profundidade ≤ 8, 12 citações/evidência. Review: `review/structured-extraction.md`.

## O. HTML tables

Sujeito vem de cabeçalho explícito de lugar/nome, de título "… data for X" ou do sujeito do documento (h1 + lead); **nunca da posição da primeira coluna**. Cabeçalho de dois níveis vira "Pai / Filho"; colspan/rowspan sem sobreposição normalizados; sobreposição, aninhamento ou > 2 níveis → `STRUCTURED_TABLE_UNSUPPORTED`. Cabeçalho vago → `TABLE_SUBJECT_AMBIGUOUS` / `TABLE_METRIC_AMBIGUOUS`; unidade só explícita (célula, cabeçalho ou caption). Tabelas climáticas transpostas: só a coluna anual explícita, nunca os meses; o período de extremos do título vira `observationPeriod`. Colunas derivadas (rank, variação, densidade, área) não são contagens. Cold live: 42 estruturas, 11 interpretadas, 31 recusadas com motivo; recordes extraídos de Oymyakon (−67.7 °C, extremos 1891–presente), Grise Fiord (−47.0 °C, extremos 1984–presente) e Liawenee (−14.2 °C).

## P. Lists / definition structures

Itens "Entidade — valor" / "Entidade: valor" e pares dt/dd; a métrica precisa estar no item ou no heading imediato; posição numa lista nunca implica ranking. Chave/valor suporta linhas de seção ("Population (2020 Census) / • Total"). Testados offline; nenhuma evidência de lista no live final.

## Q. CSV/TSV

Subset RFC 4180 (aspas, aspas duplicadas, CRLF, BOM) com spans por célula. Dados apenas: nada é avaliado, nenhum link aberto, nenhum HTML interpretado; `= + @` (e `-` que não seja número estrito) permanecem texto e nunca viram número. Aspas não fechadas rejeitam o dataset. No live, o único CSV primário descoberto (normais NOAA) deu TIMEOUT de 30 s → SOURCE_FETCH_GAP; o subset foi validado apenas offline.

## R. English extraction v2

Opt-in v2: "… recorded in X", "The population of X …", aposto "X, <frase>, is …"; datas "6 February 1933" e "February 6, 1933"; valores por extenso ("minus 41.5 degrees Celsius", "40 degrees below zero Fahrenheit"); "degrees" sem escala não é medida; limiares nunca são medidas; negações/modais/"unofficial/disputed" descartam a frase. Live: a frase da Condé Nast "Oymyakon, north of …, is the coldest permanently inhabited place on earth" agora é extraída (aposto). PT-BR v1 preservado; cabeçalhos PT reconhecidos nas tabelas.

## S. Temperature semantics

Qualifiers distintos: MINIMUM_RECORDED, SURFACE_TEMPERATURE_MINIMUM, SATELLITE_ESTIMATE, WIND_CHILL, MONTHLY_MINIMUM, AVERAGE_DAILY_MINIMUM, AVERAGE. Só MINIMUM_RECORDED satisfaz o ranking Cold; mesmo valor com contextos incompatíveis = QUALIFIER_CONFLICT. Quantity preserva original/normalizado/precisão/aproximação/regra °F→°C. Data do evento (`temporalContext`) e janela de observação (`observationPeriod`) separadas. Live: Oymyakon −67.7 (recorde), −14.9 (média) e −21.5 (média das mínimas) ficaram três fatos separados.

## T. Residency semantics

PERMANENT_POPULATION, PERMANENT_SETTLEMENT, SEASONAL_PRESENCE, TEMPORARY_RESEARCH_STAFF, TEMPORARY_STAFF, RESEARCH_STAFF, UNINHABITED. Estação de pesquisa nunca é assentamento. "No permanent population" → UNINHABITED — guarda também aplicada ao v1 (era um bug real do v1: "has no permanent residents" seria lido como permanente; nenhuma saída histórica muda, verificado). Passado sem presente → HISTORICAL; residência datada mais antiga que `residencyMaxAgeYears` (15) relativo à `evaluationDate` explícita (2026-10-28) não é atual. Contagem de população não implica residência permanente.

## U. Evidence quality

`EvidenceQualityAssessment` separado de SourceQuality (directness, subjectClarity, metricClarity, qualifierClarity, temporalClarity, structuredContext, extractability; STRONG/ADEQUATE/WEAK). Só ordena a preferência de evidência primária e o `supportScore`; o status do fato é por policy. Cold: 14 STRONG, 2 ADEQUATE.

## V. Conflicts

VALUE_CONFLICT, SOURCE_ORIGIN_CONFLICT, QUALIFIER_CONFLICT, TEMPORAL_CONFLICT (anos diferentes; datas do mesmo ano se fundem), RESIDENCY_CONFLICT e ENTITY_CONFLICT. Conflito não derruba a pesquisa: o fato fica CONFLICTED e não pode ser PRIMARY. Cold live: 3 conflitos, todos SOURCE_ORIGIN_CONFLICT dentro da Wikipedia (duas tabelas climáticas de Liawenee, com médias diferentes para o mesmo período). Nenhum valor escolhido por conveniência. Observação: o registro WMO (−67.8 °C) diverge do valor da Wikipedia (−67.7 °C), mas não virou conflito porque não pôde ser extraído como fato de entidade única (Z).

## W. Corroboration v2

Corroboração conta **raízes de origem independentes**, não páginas. Policy Cold (`factTypeQuorum`): MEASUREMENT ≥ 2 raízes, ou uma origem PRIMARY_OFFICIAL/PRIMARY_DATASET com grade HIGH; RESIDENCY ≥ 2 raízes, ou PRIMARY_OFFICIAL/INSTITUTIONAL HIGH. O validador recusa autoridade única para REFERENCE/NEWS/OTHER. **O quórum 2 da Fase 20 não foi reduzido.** REPORTED não separa corroboração (o fato fundido só fica REPORTED se toda evidência for relatada). Review: `review/corroboration.md`.

## X. Research loop v2

Broad → entity pool → verification → reference following/origin → corroboration → cobertura → follow-up só para lacunas restantes. Prioridade por entidade (§63): mais perto da elegibilidade primeiro; residência ausente com medição presente busca residência; medição ausente busca medição; ambas presentes buscam origem independente. Entidades prontas não gastam orçamento. Para em ranking VALID, orçamento esgotado ou rodada sem ação (Cold: `NO_ACTIONABLE_GAP_FOLLOWUP round 2`).

## Y. Budgets

Orçamentos de fetch separados: broadDiscovery 6, originDiscovery 14, verification 8, corroboration 8 (soma ≤ 36 = maxFetchedSources). Estágio sem ação repassa o restante adiante; corroboração sem ação devolve o restante a ORIGIN quando há referências na fila; tudo registrado em `BUDGET_REALLOCATED`. Cold final: BROAD 5/5; VERIFICATION 0 (sem página própria nova; 9 repassados); ORIGIN 14/14; CORROBORATION 5 de 17. Pulos por orçamento voltam à fila; o teto por fonte é definitivo.

## Z. Cold Places benchmark

Tema idêntico: "Os cinco lugares mais frios onde pessoas vivem permanentemente." Input sem entidades, URLs, valores, claims, roteiro ou direção (`examples/research/web-v2-cold-request.json`).

| Medida | Fase 21 (final) |
|---|---|
| Queries / resultados | 8 / 15 |
| Domínios descobertos / buscados | 14 / 12 |
| Fetches / aceitas / rejeitadas | 24 / 16 / 8 |
| Publishers aceitos / origin groups | 8 / 7 |
| Classes aceitas | REFERENCE 4, OTHER 11, NEWS 1 |
| Fatos | 13: 9 INSUFFICIENT, 4 CONFLICTED, 0 SUPPORTED, 0 CORROBORATED |
| Ranking | RANKING_INCOMPLETE, 0 elegíveis, escopo SESSION_CANDIDATES |
| Writer | RESEARCH_INCOMPLETE (sem roteiro) |
| Tempo / bytes | 109,8 s / 4,5 MB |

Exclusão por entidade: Grise Fiord, Liawenee e Oymyakon → `MEASUREMENT_INSUFFICIENT_CORROBORATION; RESIDENCY_INSUFFICIENT_CORROBORATION`.

**Respostas obrigatórias:**

1. Candidatos descobertos: **3** com fatos extraídos de fonte (+2 títulos só de busca, não elegíveis). Meta de pool 10–20 não atingida (Y/AM).
2. Com temperature Evidence: **3** (recordes de Oymyakon, Grise Fiord e Liawenee em tabelas).
3. Com permanent residency Evidence: **3**.
4. Com ambos: **3**.
5. Com origem primária (classe PRIMARY_*/INSTITUTIONAL/ACADEMIC como raiz): **0**. Páginas oficiais foram alcançadas, mas nenhuma rendeu evidência de entidade (Z, gaps).
6. Com ≥ 2 origin groups independentes: **0**.
7. GroundedFacts SUPPORTED: **0**.
8. CORROBORATED: **0**.
9. Itens elegíveis: **0**.
10. Houve ranking? **NÃO** (RANKING_INCOMPLETE).
11. Escopo: **SESSION_CANDIDATES** (nunca GLOBAL).
12. Algum item inventado? **NÃO**.
13. Algum valor de snippet? **NÃO** (0; snippets nunca entram no extractor).
14. Algum fato de conhecimento interno? **NÃO** (todo fato tem Evidence com span de snapshot).
15. Alguma entidade hardcoded? **NÃO** (anti-hardcode v2 PASS).
16. Primária encontrada mas não processável por formato? **SIM**: 2 teses da University of Tasmania em PDF (`PRIMARY_SOURCE_DISCOVERED_BUT_PDF_UNSUPPORTED`); 2 páginas russas de monitoramento meteorológico (idioma não suportado); 2 páginas acadêmicas atrás de desafio JavaScript. O CSV de normais NOAA deu timeout.
17. Maior source gap: **falta de uma segunda origem independente não citada pela própria Wikipedia**. As notícias que poderiam corroborar são exatamente as que a Wikipedia cita (logo, derivadas), e não existe busca web gratuita/genérica no runtime para achar outras. No nível de fetch: 6 gaps de formato (2 PDF, 2 idioma, 2 desafio JS) contra 4 de fetch (timeout, robots, HTTP 410, tamanho).
18. Maior extraction gap: **tabelas oficiais sem sujeito declarado e registro primário multi-entidade.** As 6 páginas do BOM têm "Lowest temperature" com coluna anual, mas o lugar só aparece fora da tabela, então o extractor abstém (TABLE_SUBJECT_AMBIGUOUS). O registro WMO arquivado traz −67.8 °C para "(a) Verkhoyansk (b) Oimaykon", em campos não tabulares, com grafia diferente — não é fato de entidade única. No total, 31 de 42 estruturas foram recusadas.

## AA. Benchmark comparison 19/20/21

| Metric | Phase19 | Phase20 | Phase21 |
|---|---|---|---|
| Autonomous discovery | NÃO (sem source pack) | SIM (1 provider) | SIM (4 estratégias executadas) |
| Domains | 0 | 1 | 14 descobertos / 12 buscados |
| Accepted sources | 0 | 5 | 16 (8 publishers) |
| Primary sources (classe PRIMARY_*) | 0 | 0 | 0 (oficiais alcançados: BOM, ECCC, WMO arquivado; classe OTHER) |
| Independent origin groups | 0 | 1 | 7 |
| Grounded facts (utilizáveis) | 0 | 0 | 0 |
| Corroborated facts | 0 | 0 | 0 |
| Cold eligible items | 0 | 0 | 0 |
| Cold ranking | — | RANKING_INCOMPLETE | RANKING_INCOMPLETE |
| Writer | RESEARCH_INCOMPLETE | RESEARCH_INCOMPLETE | RESEARCH_INCOMPLETE |
| Research status | REAL_PILOT_BLOCKED_NO_SOURCE_PACK | REAL_RESEARCH_BLOCKED | REAL_RESEARCH_BLOCKED |
| Medições Cold extraídas (MINIMUM_RECORDED) | 0 | 0 | 3 entidades |

Ganho real: diversidade de origem, medições extraídas de tabelas e diagnóstico por entidade. Sem ganho em fatos admitidos.

## AB. Second real domain

Tema: "População recenseada de municípios listados por população." (FACTS, QUANTITY, metric POPULATION, quórum 2 por origem ou autoridade institucional/primária HIGH). Escolha: tipos e extração não-temperatura, sem expandir o universo semântico (QUANTITY já existia).

Sessão final: 8 queries, 13 resultados, 11 fetches, 5 aceitas (4 listas da Wikipedia + 1 repositório acadêmico), 6 domínios buscados. **256 fatos de contagem de população** (limite de evidência do pack; tabelas de 200 linhas interpretadas) com proveniência de célula, ano do censo e qualifier CENSUS/ESTIMATED_VALUE. Todos INSUFFICIENT: 1 raiz cada. A única referência de dataset descoberta (tabela da Statistics Canada, via atribuição da lista) foi SIZE_BLOCKED (> 2 MiB). Writer: RESEARCH_INCOMPLETE; mesmo com fatos admitidos, o writer atual não tem realização licenciada para QUANTITY (registrado como WRITER_REALIZATION_GAP), e Writer v2 não foi feito.

A tentativa de desenvolvimento 3 (preservada) mostrou o resolver funcionando de ponta a ponta: a atribuição "as enumerated by the 2020 United States census" levou à agência estadual do Colorado (`dola.colorado.gov`, aceita, conteúdo JSF sem tabela extraível), ao `census.gov` (HTTP 403) e ao TIGERweb (MIME). Ela também expôs um bug real, corrigido antes da sessão final: colunas "Population / 2025 rank" eram lidas como contagem, gerando 34 conflitos falsos. A busca MediaWiki devolveu outro conjunto de listas na sessão final; a web não é determinista.

Conclusão: resolver e extractor não são específicos de temperatura (cabeçalhos de população, ano do censo, estimativa vs censo, colunas derivadas excluídas); a corroboração continua bloqueada pelo mesmo gargalo de descoberta independente.

## AC. Source gaps

| Código | Cold | População | Exemplo |
|---|---|---|---|
| SOURCE_DISCOVERY_GAP | 0 | 176 | entidades sem nenhuma referência para seguir |
| SOURCE_FETCH_GAP | 4 | 1 | NOAA CSV timeout; DOI 410; robots; 2 MiB |
| SOURCE_FORMAT_GAP | 4 | 5 | idioma russo/espanhol; desafio JS; MIME de editora |
| PRIMARY_SOURCE_DISCOVERED_BUT_PDF_UNSUPPORTED | 2 | 1 | teses UTAS em PDF |
| EVIDENCE_EXTRACTION_GAP | 42 | 25 | estruturas recusadas; fontes oficiais sem evidência da entidade |
| CORROBORATION_GAP | 9 | 256 | 1 raiz independente |
| FACT_CONFLICT | 4 | 0 | médias de Liawenee na mesma origem |
| VISUAL_GAP / WRITER_REALIZATION_GAP | 0 | 0 | nenhum pack chegou a RESEARCH_READY |

A falha não é "MISSING_EVIDENCE" genérico: descobrimos e baixamos fontes oficiais, extraímos medições, e falhamos por (a) independência — o único segundo lado são fontes que a própria referência cita — e (b) sujeito/forma das tabelas oficiais e do registro WMO.

## AD. Factual/visual matrix

Nenhum pack v2 chegou a RESEARCH_READY; não houve roteiro, matriz visual nem render (§102 não exige MP4). O fluxo writer/visual é o mesmo da Fase 20 e foi exercitado nos testes v2 com dados fictícios (ranking VALID de um item → writer executado).

## AE. Replay

`analysis/replay-verification.json`: replay offline das duas sessões com `http.request`, `https.request`, `get` e `fetch` substituídos por falha contadora → **0 chamadas de rede**. Iguais: EvidencePack, SourceGraph, Evidence, GroundedFacts, ranking, writer e processing fingerprint (script/plano N/A, sem roteiro). Compatibilidade: os 4 packs da Fase 19 e os 5 da Fase 20 rederivam idênticos com o código atual, e as duas sessões da Fase 20 reproduzem o processing fingerprint.

## AF. Security

Todos os guards da Fase 20 continuam ativos; os 115 testes web estão inalterados e PASS. Links de referência passam pela mesma canonicalização: `169.254.169.254`, credenciais em URL e hosts com DNS privado são descartados ou bloqueados (testes e live). CSV/TSV é só dado; JSON-LD tem limites. Endpoints de busca/API não consultam robots.txt (como na Fase 20); páginas de fonte sempre consultam (live: 1 ROBOTS_BLOCKED respeitado).

**Correção de segurança documentada:** a regra IPv4 da Fase 20 bloqueava `192.0.0.0/16` e `192.2.0.0/16` inteiros, mas os blocos reservados são só `192.0.0.0/24` e `192.0.2.0/24`. Isso rejeitou um endereço público real (192.0.66.112) como `SSRF_BLOCKED DNS/private` na tentativa 1. A regra foi estreitada aos /24 reservados; `192.0.2.1`, `192.0.0.8`, `192.168/16` e `192.88.99/24` continuam bloqueados (testes antigos e novos).

## AG. Anti-hardcode

`analysis/anti-hardcode.json` — **PASS**, 251 arquivos (src, cli, tests, examples, inputs da fase). Alvos lidos dos artefatos: sujeitos finais, valores admitidos, domínios registráveis finais (fontes + referências), URLs finais, títulos de fontes não-referência e ordem de ranking. Achados: 8 domínios de provider/corpus permitidos (`wikipedia.org`, `archive.org` em config/regras de classificação) e 1 `PRE_PHASE21_UNCHANGED` ("Delta" num fixture fictício da Fase 19, arquivo inalterado desde o commit anterior; coincide com um município real da lista de população). Zero BLOCKER. O fixture fictício "Delta" do meu próprio teste novo foi renomeado para evitar a colisão. Nomes próprios são comparados com distinção de maiúsculas ("Delta" lugar ≠ identificador `delta`).

## AH. Determinism

Mesma tabela → mesmas células, evidências e fatos (teste). Mesmo conjunto de snapshots → mesmo fingerprint de SourceGraph, independente da ordem das fontes (teste + replay). Queries v2 derivadas do plano e de vocabulário genérico. Aliases, conflitos e raízes de origem ordenados canonicamente; orçamentos e realocações determinísticos. Relógio só na borda web; `evaluationDate` é entrada explícita. Sessões live dependem da web e variam (AB); o replay não varia.

## AI. Performance

`analysis/performance.json` (ms, uma execução, máquina local):

| Sessão | Live total | Bytes | Fontes | Pack v2 | Pack v1 mesmas fontes | Rederivação | Replay offline |
|---|---|---|---|---|---|---|---|
| Cold | 109 779 | 4,5 MB | 16 | 2 792 | 2 390 | 2 679 | 5 605 |
| População | 41 538 | 6,0 MB | 5 | 1 615 | 710 | 2 068 | 4 762 |

O custo dominante continua sendo a rede (atraso por domínio, robots, timeouts de 30 s). A extração estruturada acrescenta ~17 % no Cold e ~2,3× no pack de população (centenas de linhas). O pack é reconstruído uma vez por estágio, não por fetch; a admissão v2 valida só a fonte nova. `validateEvidencePack` memoiza objetos já validados com o mesmo fingerprint.

## AJ. Tests

| Comando | Estado | Testes | ms |
|---|---|---|---|
| npm run typecheck | PASS | — | 6 291 |
| npm run check:engine3d | PASS | 688 (649 anteriores + 39 v2) | 38 635 |
| npm run check:editorial | PASS | 46 | 1 905 |
| npm run check:sound | PASS | 35 | 3 450 |
| npm run check:visual | PASS | 37 | 17 161 |
| npm run check:motion | PASS | 30 | 2 144 |
| npm run check:demonstration | PASS | 30 | 2 079 |
| npm run check:autodirector | PASS | 23 | 2 332 |
| npm run check:semantics | PASS | 40 | 2 003 |
| npm run check:narrative | PASS | 35 | 5 116 |
| npm run check:writer | PASS | 32 | 15 536 |
| npm run check:research | PASS | 50 | 7 774 |
| npm run check:web-research | PASS | 115 | 2 606 |
| npm run check:research-v2 (NOVO) | PASS | 39 | 3 165 |
| npm run engine3d:catalog | PASS | — | 1 590 |

15/15 PASS (`out/engine3d/phase21/analysis/checks.tsv`, logs em `logs/check-*.txt`). Não somar suítes especializadas: a suíte rápida já inclui todas.

Nova suíte `npm run check:research-v2`: 39 testes offline, fixtures fictícios e DNS/HTTP injetados. Cobre multi-provider, falha de provider, reference following com proveniência, SSRF em links, PDF, original mudado → cópia arquivada, SourceGraph/origin groups/MIRRORS/NEAR_COPY/SAME_PUBLISHER/arquivo, independência (§108/§109), aliases (§110), tabelas (§104–107), hierarquia de cabeçalho/spans, transpostas, chave/valor, listas/dl, atribuição de tabela, CSV/TSV/fórmulas/limites, EN v2, contextos de temperatura, residência v2/negação/estação/temporal (§111), currentness, conflitos v2, EvidenceQuality, autoridade de origem única, orçamentos/realocação, prioridade de lacunas, provider ≠ classe, detecção de idioma, faixa SSRF 192.0.x, replay sem rede, anti-hardcode e compatibilidade v1. **Nenhum teste antigo foi editado.**

## AK. Registry

Engine3D = 50, SFX = 8, VISUAL = 5. Zero recursos, assets, câmeras ou primitivas novos. `engine3d:catalog` regenerou o catálogo idêntico.

## AL. Compatibility

Arquivos existentes alterados (todos em research/web, docs e package): `package.json` (scripts `check:research-v2`, `research:v2:audit`), `src/research/{contracts,english,grounding,pack,qa,ranking,request,source}.ts`, `src/research/README.md`, `src/research/web/{config,contracts,fetcher,index,output,provider,security}.ts`, `src/research/web/README.md`. Todas as mudanças de comportamento são opt-in (`researchVersion: 2` / `web.v2`), exceto três correções que não alteram saídas históricas (verificado por rederivação):

1. **Negação de residência no v1:** "no/without permanent" não vira presença permanente.
2. **Faixa SSRF 192.0.x** (AF).
3. **`realizeGroundedFact`:** devolve null para tipos de residência sem frase licenciada, em vez de "undefined".

Também: limites ampliados (maxTotalSourceBytes e maxTotalBytes 32 MiB, maxFetchedSources 48, maxQueries 48, maxSourcesPerDomain 16, maxDurationMs 900 s) e memoização segura da validação de pack. `package-lock.json` inalterado; nenhum teste antigo alterado; 12 MP4 históricos com SHA-256 inalterado (`analysis/integrity.json`). Nada foi commitado nem publicado.

## AM. Limitations

- **Descoberta:** não há busca web genérica gratuita e keyless no runtime; sem ela, a segunda origem independente quase só aparece se uma fonte não citada pela referência for encontrada por outro corpus. OpenAlex trouxe obras pouco relevantes; Wikidata quase nunca declara site oficial para vilarejos.
- **Pool de candidatos:** 3 entidades com evidência no Cold, abaixo do alvo 10–20; tabelas de listas como "Extremes on Earth" foram recusadas (aninhamento/sem cabeçalho).
- **Tabelas oficiais:** quando o sujeito está fora da tabela, o extractor abstém. Não existe resolução de sujeito a partir do contexto da página oficial (nome da estação, código).
- **Campos não tabulares:** registros em campos `div` (o WMO), multi-entidade e com grafias variantes não são extraídos.
- **Formatos:** sem PDF, JavaScript, idiomas além de EN/PT, nem respostas grandes (> 2 MiB por fonte).
- **Classes de fonte:** a classe PRIMARY só vem de declaração explícita. Agências oficiais reais ficaram OTHER (honesto, porém limita a admissão por autoridade).
- **Aproximações:** domínio registrável aproximado sem public-suffix list. Detecção de derivação só vê citação/atribuição presentes no snapshot; cópias não declaradas de notícias passam como independentes (UNKNOWN_RELATION).
- **Contagem de população** não comprova residência permanente; ficou como opção de policy para fase futura.
- **Ranking:** a regra SAME_CONTEXT entre entidades continua bloqueando ranking de recordes de anos diferentes; não foi relaxada.

## AN. Honest Assessment

| Dimensão | Nota | Evidência / limite |
|---|---|---|
| MULTI-SOURCE DISCOVERY | ACCEPTABLE | 4 estratégias executadas, 14 domínios; sem busca genérica |
| PRIMARY SOURCE DISCOVERY | ACCEPTABLE | BOM, ECCC, WMO (arquivo) e NOAA alcançados por rodapé; nenhuma evidência primária extraída |
| REFERENCE FOLLOWING | GOOD | ligado à evidência, com orçamento, seguro, arquivo como MIRROR; 10/17 buscadas no Cold |
| SOURCE GRAPH | GOOD | relações simétricas/direcionais, determinístico, replay idêntico |
| ORIGIN RESOLUTION | GOOD | derivação real detectada (Wikipedia → Condé Nast); limitada ao que o snapshot declara |
| SOURCE DIVERSITY | ACCEPTABLE | 8 publishers aceitos (Fase 20: 1); 4 da Wikipedia, 6 do BOM |
| STRUCTURED EXTRACTION | GOOD | tabelas/chave-valor/listas/CSV com spans; 256 fatos de população; abstenção correta |
| TABLE EXTRACTION | GOOD | transpostas, hierarquia, unidades, colunas derivadas; 31/42 recusadas no Cold |
| ENGLISH EXTRACTION | ACCEPTABLE | aposto, valores por extenso, contextos; gramática ainda pequena |
| ENTITY RESOLUTION | ACCEPTABLE | aliases com proveniência; grafias variantes do registro WMO não resolvidas |
| CORROBORATION | WEAK | modelo correto; 0 CORROBORATED real |
| CONFLICT HANDLING | GOOD | 6 tipos; conflitos reais na mesma origem detectados; conflitos falsos de rank corrigidos |
| RANKING SAFETY | STRONG | 0/5, nenhum item inventado, escopo de sessão, lacunas por entidade |
| GROUNDING | GOOD | proveniência evidência → snapshot preservada; nenhum roteiro sem pack pronto |
| REPLAYABILITY | STRONG | 0 chamadas; todos os fingerprints iguais; legado idêntico |
| FACTUAL SAFETY | STRONG | quórum mantido; cópias e citações não contam como independentes |
| GENERALIZATION | ACCEPTABLE | segundo domínio não-temperatura extraído em escala; admissão ainda bloqueada |
| OVERALL AUTONOMY | ACCEPTABLE | LEVEL4C mantido; infraestrutura mais forte sem novo fato admitido |

## AO. Autonomy Level

**LEVEL4C (mantido).** Não LEVEL4C+: a pesquisa ficou estruturalmente mais forte (multi-origem, rastreamento de origem, extração estruturada, diagnóstico preciso), mas nenhum fato novo atingiu admissão e nenhum item Cold ficou elegível. Nível representa capacidade demonstrada, não número da fase. Não LEVEL5.

### Fase 21 gates

| Gate | Requisito | Resultado | Evidência |
|---|---|---|---|
| 1 | Testes Fase 20 PASS | PASS | check:web-research 115/115 |
| 2 | MediaWiki funciona | PASS | 4 queries MediaWiki no Cold, 5 páginas |
| 3 | 2ª estratégia executada | PASS | REFERENCE_FOLLOWING, WIKIDATA e OPENALEX executados |
| 4 | > 1 domínio | PASS | 14 descobertos / 12 buscados |
| 5 | ReferenceCandidate com proveniência | PASS | `references/real-cold-places-v2.json` + teste |
| 6 | SourceGraph determinístico | PASS | teste de ordem + replay |
| 7 | OriginRelation testado | PASS | MIRRORS/NEAR_COPY/SAME_PUBLISHER/CITES/DERIVED_FROM/REPORTS/PRIMARY_ORIGIN/UNKNOWN |
| 8 | Mesma origem não é independente | PASS | teste §108; live Wikipedia DERIVED_FROM Condé Nast |
| 9 | Origens independentes corroboram | PASS | teste §109 + loop mock CORROBORATED (live: 0) |
| 10 | Tabela com proveniência de célula | PASS | Evidence.structured + spans validados |
| 11 | Headers de métrica preservados | PASS | teste §105; live columnHeader |
| 12 | Ambiguidade → abstenção | PASS | teste §107; 31 recusas live com motivo |
| 13 | CSV/TSV seguro e só dado | PASS | testes de fórmulas/limites (live: CSV NOAA timeout) |
| 14 | Alias não por similaridade | PASS | teste §110 |
| 15 | Contextos de temperatura separados | PASS | teste; live recorde/média/média das mínimas separados |
| 16 | Permanente ≠ staff temporário | PASS | testes de residência v2 |
| 17 | Residência temporal preservada | PASS | teste §111 (HISTORICAL / NOT_CURRENT) |
| 18 | EvidenceQuality separada | PASS | `evidence-quality/` + teste |
| 19 | Loop prioriza lacunas | PASS | entity pool + teste |
| 20 | Origin discovery com orçamento próprio | PASS | stageBudgets + teste |
| 21 | Cold sem hardcode | PASS | input + anti-hardcode |
| 22 | Cold com discovery real | PASS | 24 fetches públicos |
| 23 | Nenhum snippet vira Evidence | PASS | 0; teste com snippet malicioso |
| 24 | Nenhum conhecimento interno | PASS | todo fato com Evidence e span |
| 25 | ≥ 1 item Cold grounded OU diagnóstico preciso | PASS (diagnóstico) | Z itens 17–18, AC |
| 26 | Não inventa quinto item | PASS | 0 itens |
| 27 | Guard de superlativo global | PASS | SESSION_CANDIDATES + SUPERLATIVE_SCOPE_ADJUSTMENT; preflight inalterado |
| 28 | Replay reproduz SourceGraph/pack/fatos | PASS | 0 chamadas, fingerprints iguais |
| 29 | Segurança Fase 20 PASS | PASS | 115 testes + novos de links |
| 30 | Nenhuma API paga | PASS | só endpoints públicos sem chave |
| 31 | Registry 50/8/5 | PASS | integrity.json |
| 32 | Anti-hardcode v2 PASS | PASS | 0 BLOCKER |
| 33 | Testes históricos PASS | PASS | AJ |

**SUCCESS STRONG:** NÃO (nenhum item Cold com corroboração independente ou autoridade primária). **IDEAL (5 itens):** NÃO.

## AP. Next Recommendation

**B) Research v3.** Research ainda impede fatos (§125). As métricas apontam três gargalos, todos de pesquisa:

1. **Descoberta independente:** sem busca genérica keyless, a única "segunda fonte" são as citadas pela referência.
2. **Resolução de sujeito em tabelas oficiais:** BOM/ECCC trazem o recorde, mas o lugar fica fora da tabela.
3. **Registros primários não tabulares e multi-entidade**, com grafias variantes (WMO).

PDF (C) apareceu só 2–3 vezes e não é o gargalo principal. Writer e Engine3D não são o limite enquanto nenhum fato é admitido. Recomendação apenas: Fase 22 **não iniciada**.
