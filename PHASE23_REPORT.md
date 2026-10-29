# Phase 23 — Research v4 — Final report

Data: 2026-10-28. Checkpoint Phase22 preservado.

## Objective

**PHASE23 COMPLETE: YES — implementation gate PASS.** Research v4 implementada e validada com aquisição orientada a requisitos factuais, dois benchmarks live, replay offline e auditoria. Readiness real é um resultado separado: Cold **REAL_RESEARCH_PARTIAL**, **0/5**, **RANKING_INCOMPLETE**; população **REAL_RESEARCH_BLOCKED**. Factual safety prevaleceu sobre score.

## Starting State

`main`, HEAD esperado e preservado `d1b8d003432a376002cea45391b42420ab345334`, inicialmente CLEAN, igual a origin/main. Lidos integralmente CLONAI_HANDOFF, PHASE21_REPORT, PHASE22_REPORT e handoff incompleto como histórico; revisados código, testes, helpers e artefatos locais. Os relatórios e artefatos Phase22 não foram reescritos. Sem reset, commit/push ou Phase24.

## Phase22 Baseline

Baseline fresca: typecheck e 764 testes únicos PASS antes da implementação. Registry 50/8/5. Revisadas as falhas de cada candidato em `analysis/phase22-candidate-failures.json`: origem insuficiente, presença ausente/histórica/incompatível, contexto temporal e ruído de tipo. O candidato mais próximo da elegibilidade tinha medição admitida e presença com uma origem.

Nota aritmética: o relatório histórico registra 278 testes research. A execução atual das quatro suítes legadas confirmou **280 = 50 + 115 + 39 + 76**, sem modificar testes históricos. O número histórico foi preservado no documento original; não se apresenta 278 como uma soma correta.

## Research v4 Architecture

Opt-in `researchVersion: 4`, `web.v4`. Request → bootstrap de candidatos → FactGap → EvidenceRequirementPlan → QueryFamily/SourceStrategy/ProviderCapability → aquisição segura → snapshots → núcleo EvidencePack/SourceGraph → reavaliação do mesmo fato → stop/exhaustion. Reutilizados core, writer, ranking e transporte existentes. Novos módulos `src/research/v4/{contracts,semantics,planning,session}.ts`, `web/{v4,v4-providers,output-v4}.ts`, testes e auditoria. V1/v2/v3 não recebem o novo comportamento.

## Fact Gaps

Cold: 27 criados, 0 CLOSED, 3 EXHAUSTED. O modelo guarda factKey, entidade, métrica/qualifier, evidências, raízes/ecossistemas existentes, locators/citações excluídos, requisito ausente, classes/estratégias preferidas, gain estimate, prioridade, histórico, budget e status. Lacunas de formato/idioma/fetch são diagnósticos distintos; EXHAUSTED não significa falso. [review/gap-analysis.md](out/engine3d/phase23/review/gap-analysis.md).

## Evidence Requirements

Cada gap explicita o que poderia fechá-lo: tipo de evidência, identidade, semântica, requisito temporal, origem nova e regra de admissão. Exemplos genéricos: presença atual de residentes usuais/civis permanentes; mínimo de ar registrado com data/janela de observação. Snippets, abstracts, memória interna, staff, números de população isolados e data de publicação como data do evento são substitutos proibidos. Autoridade e quorum originais não foram relaxados.

## Source Ecosystems

Taxonomia genérica de estatística nacional, governo local/regional, município, meteorologia, academia/repositório, catálogo de dados, registro geográfico, arquivo, referência, notícias e OTHER. Classificação usa sinais do snapshot/publisher. Categoria de descoberta não é autoridade nem independência. Distribuições reais estão em metrics.json e [review/source-ecosystems.md](out/engine3d/phase23/review/source-ecosystems.md).

## Strategy Planner

Estratégias ordenadas registram ecossistema, provider, família, propósito, por que podem ampliar independência, origens excluídas, evidência esperada, custo/valor e budget. Ecossistema diferente recebe preferência; mesmo publisher/domínio fica diagnosticado/depriorizado e nunca conta automaticamente como segunda origem. A resolução final continua no SourceGraph e nas raízes do fato.

## Query Families

Famílias distintas para dataset, censo, registro de localidade, registro histórico, observação, origem citada e citação reversa. Derivadas de entidade, métrica, qualifier, gap e ecossistema; nenhuma entidade/temperatura do benchmark foi incluída como seed. Falha registrada esgota a família conforme budget, permitindo rotação. Não há benefício por reformulações cosméticas da mesma query.

## Provider Capabilities

Cada provider declara ecossistemas, query types, metadados, limite/custo, disponibilidade e expectativa de independência. DataCite Public API e CKAN textual foram integrados e testados por fixtures generalizáveis de datasets. Referências da auditoria: [DataCite API](https://support.datacite.org/docs/api), [DataCite queries](https://support.datacite.org/docs/api-queries), [CKAN](https://docs.ckan.org/en/2.11/api/index.html), [catálogo público UK](https://guidance.data.gov.uk/get_data/api_documentation/).

OpenAlex foi desativado na v4: a [política atual](https://blog.openalex.org/openalex-api-new-features-and-usage-based-pricing/) exige chave e uso tarifado, e esta fase não usa chaves, quotas de demonstração como dependência ou fallback pago. O caminho histórico v3 foi preservado. MediaWiki, Wikidata e Crossref continuam disponíveis dentro de suas capacidades declaradas.

## Independent Acquisition

Cold realizou 16 estratégias, 16 famílias e 16 tentativas ligadas a gaps. Houve 0 incrementos positivos de raízes para fatos-alvo e 9 descobertas de origem já conhecida diagnosticadas. Uma fonte adquirida sem evidência do fato não fecha gap. [review/independent-acquisition.md](out/engine3d/phase23/review/independent-acquisition.md).

## Citation Pursuit

Citações anexadas a EVs geram pursuit explícito do original. Relações DataCite de derivação/versão/citação são registradas; paper e dataset citado não viram automaticamente duas origens. Identidade explícita de publisher em domínios diferentes e lineage declarado podem reduzir independência. Reverse-citation usa metadados públicos e permanece diagnóstico UNPROVEN; sem valor factual proveniente de metadados.

## Dataset Discovery

Cold descobriu 8 identidades de datasets e produziu 0 EVs de dataset; população: 6 / 0. Identidade preserva publisher, versão/data, formato/schema informado, URL e lineage. CSV/TSV usam o parser limitado existente e offsets de linha/célula. Na v4, nome igual ou parecido sozinho permanece CANDIDATE: ID ou contexto administrativo precisa de prova com span validado em snapshot já adquirido. Contexto ausente/forjado/incompatível recusa a linha. Isso é conservador e limita o yield real; não há lookup universal de identificadores.

## Temporal Evidence

TemporalEvidenceRequirement distingue CURRENT, HISTORICAL, OBSERVATION_PERIOD, EVENT_DATE, CENSUS_DATE e PUBLICATION_DATE. O planejador seleciona o requisito pertinente. `evaluationDate` é input explícito; replay não consulta relógio. Passado ou presença antiga não prova residência atual. Publicação não preenche janela/data de medição ausente.

## Residency Semantics

ResidencyEvidenceAssessment registra presence type, currentness, semântica de população, autoridade, origem, match e motivos. Residentes usuais e civis explicitamente permanentes têm suporte literal próprio. Staff de pesquisa/militar, turistas, trabalhadores temporários, presença sazonal, habitantes históricos e assentamento abandonado ficam separados. Quantidade censitária sozinha nunca se transforma em população permanente. Vocabulário limitado EN/PT; sem tradução interna como Evidence. [review/residency-evidence.md](out/engine3d/phase23/review/residency-evidence.md).

## Measurement Semantics

Preservados os guards de mínimo registrado versus médias, menor máxima, wind chill e superfície/satélite. Modelled minima, feels-like e heat index não viram mínimo do ar. MeasurementContextAssessment separa qualifier, scope e datas/janela/publicação. Não foi criado parser térmico universal. [review/measurement-context.md](out/engine3d/phase23/review/measurement-context.md).

## Station/Settlement

Identidades distintas, inclusive nomes iguais. Transferência exige policy SOURCED_OBSERVATION_SITE e relação explícita source-backed; não usa proximidade/similaridade como identidade. A revisão registra estação, settlement, aresta, fonte e contexto literal. Distância só é apresentada se estiver no snapshot. Presença permanente continua requisito separado.

## Conflict Resolution

ConflictResolutionTask investiga definição, qualifier, janela, estação/localidade, revisão, método e lineage. Não escolhe maior autoridade para resolver contradição. Janelas explicitamente diferentes permanecem fatos separados; quando o mesmo valor tem múltiplas janelas, os novos IDs são identificados como novos, sem simular promoção do antigo. Contexto ausente não resolve conflito. [review/conflict-resolution.md](out/engine3d/phase23/review/conflict-resolution.md).

## Eligibility Gain

Estimativa determinística favorece um requisito de distância da elegibilidade e fatos 1/2 antes de 0/2, incorporando custo, fetchability, autoridade provável, diversidade e falhas. É heurística, sem ML. Na prática, providers disponíveis e identificadores faltantes continuam limitando a aquisição útil.

## Failure Memory

A primeira execução real de população expôs repetição da mesma URL bloqueada entre facts; foi preservada em development-attempts. Uma regressão e memória global provider+query foram adicionadas antes das coletas finais.

AcquisitionIntent guarda inputs observados: gap/strategy/family/provider, query/result URLs, fetch IDs, source subsets antes/depois, diagnóstico e timestamp de aquisição. AcquisitionAttempt deriva acceptedSources, EVs novos, raízes novas, fechamento e falha. O replay rederiva os estados correspondentes dos snapshots; não reutiliza contadores como conclusão.

## Exhaustion

OPEN/PARTIAL/CLOSED/EXHAUSTED/BUDGET_EXHAUSTED/CONFLICTED e BLOCKED_FORMAT/LANGUAGE/FETCH são estados separados. Limites por gap, estratégia, família, domínio, queries, fetches, bytes, timeout e rodadas permanecem ativos. Sem estratégias executáveis termina capabilities-exhausted; isso não afirma falsidade do fato.

## Stop Early

Um gap fechado não continua recebendo estratégia; readiness interrompe o loop. O teste integrado comprova duas origens e ranking válido em uma única tentativa de aquisição, com fixtures fictícias. O live mantém as falhas e para por readiness/capability/budget, sem coletar fontes apenas para elevar contagem.

## Candidate Quality

Pool distingue source-backed, search-only, observation sites e fitness. Tipos de locality vêm de texto explícito/EntityGraph; não são inferidos de um número. Países, seções, labels métricos e pronomes deíticos são rejeitados genericamente, sem lista de nomes Cold. UNCONFIRMED pode permanecer como candidato de descoberta, mas não entra como settlement comprovado no ranking. Cold terminou com 2 candidatos relevantes; distribuição de fitness {'FIT': 3, 'UNFIT': 3}. [review/candidate-quality.md](out/engine3d/phase23/review/candidate-quality.md).

## Cold Benchmark

Executado live após 65/65 testes v4 PASS e preflight histórico. Tema integral e mesma policy da Phase22: TEMPERATURE, MINIMUM_RECORDED, PERMANENT_POPULATION, quorum 2 e exceções de autoridade HIGH preservadas. Sem fontes preparadas ou snapshots antigos como inputs da execução real.

13 queries; 26 resultados; 25 fetches; 15 fontes aceitas; 4 SUPPORTED; 0 CORROBORATED. Estado **REAL_RESEARCH_PARTIAL**, writer **RESEARCH_INCOMPLETE**. Scope SESSION_CANDIDATES e guard global preservados.

| Gate | Resultado | Evidência |
|---|---|---|
| R1 | PASS | 16 acquisition attempts tied to real FactGap/EvidenceRequirementPlan |
| R2 | PASS | 5 attempts acquired a source in a different classified ecosystem; UNKNOWN/OTHER excluded |
| R3 | FAIL | 0 positive independent-origin increments for acquisition target facts |
| R4 | FAIL | 0 identical Phase22 canonical IDs went from 1 to >=2 roots |
| R5 | FAIL | 0 real CORROBORATED Cold facts |
| R6 | FAIL | 0 eligible |
| R7 | FAIL | 0 eligible |
| R8 | FAIL | 0 eligible |

## Canonical Fact Transitions

**0 fatos Cold da Phase22 com o mesmo ID passaram de uma para pelo menos duas raízes.** Cada linha guarda ID, tuple, status/origens antes/depois e motivo. Ausência no novo corpus e novos IDs não contam como transição. Bootstrap→final é outra métrica e não substitui esta comparação. [analysis/canonical-transitions.json](out/engine3d/phase23/analysis/canonical-transitions.json).

## Cold Eligibility

**0/5**, **RANKING_INCOMPLETE**. Cada checklist e exclusão permanece em [review/cold-eligibility.md](out/engine3d/phase23/review/cold-eligibility.md). Nenhum mínimo foi trocado por média, nenhum research staff virou população permanente e nenhum item ausente foi inventado. Mesmo cinco itens de sessão não autorizariam “top 5 do mundo”.

## Population Benchmark

Reutilizado o benchmark real de população recenseada da Phase22. 9 queries, 13 resultados, 12 fetches, 6 fontes; 256 fatos candidatos, 0 admitidos, 0 CORROBORATED; **REAL_RESEARCH_BLOCKED**. Isso exercita generalização, não demonstra automaticamente readiness. Writer v2/QUANTITY realization não foi implementado para contornar pesquisa incompleta.

## Corroboration Yield

| Métrica | Cold | Population |
|---|---|---|
| queriesPerNewIndependentOrigin | None | None |
| fetchesPerNewIndependentOrigin | None | None |
| newIndependentOrigins | 0 | 0 |
| newOriginsPerEcosystem | {'METEOROLOGICAL_AGENCY': 0, 'NATIONAL_STATISTICS': 0, 'DATA_CATALOG': 0, 'GEOGRAPHIC_REGISTRY': 0, 'ACADEMIC': 0} | {'NATIONAL_STATISTICS': 0, 'DATA_CATALOG': 0, 'GEOGRAPHIC_REGISTRY': 0} |
| factsZeroToOne | 4 | 0 |
| factsOneToTwo | 0 | 0 |
| insufficientToSupported | 0 | 0 |
| supportedToCorroborated | 0 | 0 |
| eligibleItemsGained | 0 | 0 |
| wastedSameOriginDiscoveries | 9 | 3 |
| nearCopiesRejected | 0 | 0 |
| nearCopyRejectionRate | 0 | 0 |
| independentOriginYield | 0 | 0 |
| gapClosureRate | 0 | 0 |
| usefulEvidenceRate | 0 | 0 |

New independent origins conta incrementos positivos dos fatos-alvo após resolução de origem. Uma nova origem que só contém informação alheia não melhora esse yield. Denominadores queries/fetches são da aquisição orientada a gaps; bootstrap é explicitado nos totais gerais. Divisão por zero é null, não infinito. Near-copy rejeitada conta source IDs adquiridos distintos envolvidos em relação, não pares repetidos por fato. [review/corroboration-yield.md](out/engine3d/phase23/review/corroboration-yield.md).

## Phase22/23 Comparison

Comparação de observações live distintas, não A/B de corpus fixo. O número de fontes não é critério de vitória. Phase22/23, métricas completas e caveats: [analysis/phase22-23-comparison.json](out/engine3d/phase23/analysis/phase22-23-comparison.json).

| Benchmark | Queries | Fontes | Publishers | Grupos | Candidatos | Admitidos | Elegíveis |
|---|---|---|---|---|---|---|---|
| real-cold-places-v4 | 13 | 15 | 8 | 7 | 2 | 4 | 0 |
| real-population-census-v4 | 9 | 6 | 2 | 2 | 149 | 0 | 0 |

## Source Gaps

| Benchmark | Tipo | Quantidade |
|---|---|---|
| real-cold-places-v4 | SOURCE_FETCH_BLOCKED | 2 |
| real-cold-places-v4 | SOURCE_FORMAT_BLOCKED | 3 |
| real-cold-places-v4 | SOURCE_LANGUAGE_BLOCKED | 3 |
| real-population-census-v4 | SOURCE_FORMAT_BLOCKED | 1 |
| real-population-census-v4 | SOURCE_FETCH_BLOCKED | 2 |

Falhas de provider, HTTP, robots, formato, idioma, dataset identity e budget permanecem nos logs/attempts. Não houve retry sem limite, bypass ou fallback pago. PDF e idioma bloqueados de alta prioridade são recomendações futuras, não EVs gerados pelo modelo.

## Extraction Gaps

A melhoria central foi aquisição orientada a fatos, com alterações de extração limitadas às semânticas solicitadas. Permanecem gramáticas fechadas, records/tabelas não suportados, ausência de identificadores/contexto administrativo, idiomas além de EN/PT, páginas JS e PDFs. Uma linha nome-only pode ser guardada como fonte/diagnóstico, mas não admitida como nova evidência identificada. Casos originais permanecem em source/structured diagnostics, datasets e reviews.

## Replay

**PASS / ZERO NETWORK.** Duas sessões v4 reconstruídas desde bootstrap e cada subset de fontes das tentativas, com comparação de model/attempts/pool/tasks/citations/datasets/yield, SourceGraph, EVs, fatos, eligibility, ranking, writer e processing fingerprints. HTTP/HTTPS request/get, fetch, DNS e transport foram substituídos por falha contadora. Nove packs e seis sessões históricas também passaram no preflight. Roteiro/plano são N/A quando o writer permanece bloqueado; não se alega reprodução de MP4 inexistente. [analysis/replay.json](out/engine3d/phase23/analysis/replay.json).

## Security

**PASS.** SecureHttpClient continua a fronteira dos providers e fontes: SSRF, todas as respostas DNS públicas, socket pinning, redirects, robots, MIME/charset e limites de streaming/bytes/tempo. Sem scraping Google/Bing, CAPTCHA/JS/paywall bypass, PDF parser/OCR ou execução de fórmulas. Reviews escapam conteúdo externo. Identidade declarada do publisher é heurística, não autenticação universal. [analysis/security.json](out/engine3d/phase23/analysis/security.json).

## Anti-hardcode

**PASS**, 292 arquivos examinados, zero BLOCKER. Alvos derivados das sessões Phase22/23 incluem entidades, valores, publishers, domínios/URLs finais e citados, estações e ranking. Providers genéricos, documentação e coincidências em fixtures fictícios/arquivos anteriores são classificados explicitamente. Outputs adquiridos ficam fora dos seeds e do Git. [analysis/anti-hardcode.json](out/engine3d/phase23/analysis/anti-hardcode.json).

## Determinism

Mesmo request/snapshot/trace produz os mesmos fingerprints. Ordenação de fontes invertida, tampering externo re-assinado, cadeia de source subsets e conteúdo do model são testados. Timestamp é metadado adquirido; o replay não consulta relógio. A web live muda; determinismo aqui significa reconstrução de observações registradas, não resultados iguais entre coletas independentes.

## Performance

| Benchmark | Live ms | Bytes | Queries | Fetches |
|---|---|---|---|---|
| real-cold-places-v4 | 123820 | 6043392 | 13 | 25 |
| real-population-census-v4 | 175313 | 8598772 | 9 | 12 |

Replays reconstroem subsets e têm custo de CPU/memória maior que apenas ler o pack final. Cache por conjunto de source IDs evita rebuilds repetidos dentro de uma sessão. Tempos isolados do replay estão em replay.json e tempos por comando em checks.json; não se somam esses valores ao tempo live.

## Tests

**65/65 v4 PASS. 829 testes únicos na suíte completa. 17/17 comandos obrigatórios PASS.** Fixtures fictícios, providers/DNS/transport mockados, sem internet nos testes. Testes históricos não foram alterados. A suíte cobre todos os grupos solicitados: gap/requirements/ecosystems/strategies/families/capabilities, citation/reverse/dataset identity, temporal/residency/measurement/stations, conflicts, priority/failure/budgets/exhaustion/stop, yield/candidate noise/superlative, replay/tamper, snippets e ausência de conhecimento interno.

| Comando | Exit | Testes | s |
|---|---|---|---|
| npm run typecheck | 0 | — | 10.821 |
| npm run check:engine3d | 0 | 829 | 59.043 |
| npm run check:editorial | 0 | 46 | 1.492 |
| npm run check:sound | 0 | 35 | 3.429 |
| npm run check:visual | 0 | 37 | 28.079 |
| npm run check:motion | 0 | 30 | 4.475 |
| npm run check:demonstration | 0 | 30 | 5.397 |
| npm run check:autodirector | 0 | 23 | 4.434 |
| npm run check:semantics | 0 | 40 | 2.785 |
| npm run check:narrative | 0 | 35 | 9.708 |
| npm run check:writer | 0 | 32 | 20.855 |
| npm run check:research | 0 | 50 | 11.142 |
| npm run check:web-research | 0 | 115 | 3.95 |
| npm run check:research-v2 | 0 | 39 | 5.204 |
| npm run check:research-v3 | 0 | 76 | 5.483 |
| npm run check:research-v4 | 0 | 65 | 6.376 |
| npm run engine3d:catalog | 0 | — | 2.526 |

## Registry

Engine3D **50** / SFX **8** / VISUAL **5**. Sem assets, dependências/versões, Writer, Engine3D ou MP4 novos. Os 12 vídeos históricos mantêm SHA-256. Catálogo validado. [analysis/integrity.json](out/engine3d/phase23/analysis/integrity.json).

## Compatibility

V1/v2/v3 continuam opt-out e com rederivação/replay históricos idênticos. Novos campos e comportamento são v4; guards de transporte não foram enfraquecidos. Canonical IDs existentes são preservados quando a semântica continua igual; splits por janela explicitamente distinta são novos fatos e nunca contados como promoção. package-lock, testes antigos, relatórios Phase21/22 e render estão intactos.

## Limitations

Sem busca web genérica keyless, cobertura exaustiva, autenticação universal de publisher, parser universal de datasets/identificadores, PDF/OCR, JS ou tradução geral. Os providers novos demonstram descoberta/lineage por fixtures e resultados live, mas metadados não garantem full text ou evidência útil. Os pesos de custo/fetchability são heurísticos fixos, sem calibração estatística. Snapshot lineage só cobre relações observáveis. Scope por sessão, corpus e budget limitam conclusões. Dados volumosos continuam locais/ignorados, não são transportados por um commit do código.

## Honest Assessment

| Dimensão | Avaliação |
|---|---|
| GAP MODELING | GOOD |
| STRATEGY PLANNING | GOOD |
| QUERY DIVERSITY | GOOD |
| SOURCE ECOSYSTEM DIVERSITY | ACCEPTABLE |
| INDEPENDENT ACQUISITION | WEAK |
| ORIGIN RESOLUTION | GOOD |
| DATASET DISCOVERY | ACCEPTABLE |
| TEMPORAL REASONING | ACCEPTABLE |
| RESIDENCY SEMANTICS | GOOD |
| MEASUREMENT SEMANTICS | GOOD |
| CONFLICT RESOLUTION | ACCEPTABLE |
| BUDGET EFFICIENCY | WEAK |
| CANDIDATE QUALITY | GOOD |
| CORROBORATION | WEAK |
| RANKING SAFETY | STRONG |
| REPLAYABILITY | STRONG |
| SECURITY | STRONG |
| GENERALIZATION | ACCEPTABLE |
| OVERALL AUTONOMY | ACCEPTABLE |

O target principal (um gap real 1→2 e um fato real CORROBORATED) não foi demonstrado pelos critérios estritos. Implementation PASS não implica real-world PASS. Os gates reais acima permanecem explícitos. Não houve roteiro/MP4 para preencher lacunas, nem ajuste do quorum para elevar resultado.

## Autonomy Level

**LEVEL4C**. LEVEL4C mantido: não houve ganho estrito suficiente para promoção. Não LEVEL5.

## Next Recommendation

Uma recomendação: melhorar aquisição de evidência identificável de presença atual em registros oficiais/localidades, com ganho de origem por fato demonstrado antes de ampliar formatos ou writer. **Phase24 não iniciada; sem commit/push automático. PARAR.**

Artefatos finais: [analysis/final-status.json](out/engine3d/phase23/analysis/final-status.json), [analysis/metrics.json](out/engine3d/phase23/analysis/metrics.json), [analysis/canonical-transitions.json](out/engine3d/phase23/analysis/canonical-transitions.json), [analysis/real-world-gates.json](out/engine3d/phase23/analysis/real-world-gates.json), [analysis/checks.json](out/engine3d/phase23/analysis/checks.json). Nove reviews consolidadas em `out/engine3d/phase23/review/`; snapshots e todos os outputs ficam locais.
