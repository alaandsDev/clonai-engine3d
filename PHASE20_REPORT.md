# Fase 20 — Autonomous Web Research Provider

**COMPLETE — 29/29 gates e 14/14 comandos PASS. LEVEL4C experimental no domínio suportado. Cold Places: REAL_RESEARCH_BLOCKED; segundo tema: um fato grounded e roteiro aprovado. Sem novo MP4.**

Evidências desta fase em `out/engine3d/phase20/`. Resultados de pesquisa são relativos aos snapshots e políticas registrados.

## A. Objective

Implementar topic → discovery → snapshots → Phase19 EvidencePack → GROUNDED_ONLY → direction. Implementado e validado, com Cold Places bloqueado honestamente. Não iniciar Fase21.

## B. Starting state

Fase19: LEVEL4B, 50 testes research e 534 testes rápidos. Somente STATIC_SOURCE_PACK; real Cold sem fontes. O novo trabalho parte desse core e mantém suas decisões de fatos, conflitos, ranking e grounding.

## C. Architecture

ResearchRequest → planResearch → queryPlan → SearchProvider → CandidateSource → WebSourceProvider/secure HTTP → immutable raw snapshot → SourceInput → buildEvidencePack/validateEvidencePack → writeGroundedTopic → Semantic Engine/Narrative Director/Auto Director. Rede está na borda; nenhum segundo research core. Arquivos em `src/research/web/`, `src/research/english.ts`, `cli/web-research.ts` e `tests/web-research.test.ts`.

## D. WebResearchConfig

Networking é disabled por padrão. Defaults: 2 rounds, 8 queries, 5 resultados/query, 40 resultados, 20 candidatos, 4 fetches, 2 por domínio, 1 MiB/fonte, 4 MiB total, 15 s/request, 120 s/sessão, 4 redirects, robots ativo, delay 750 ms, concurrency ceiling 1. Pilotos explícitos: 2 rounds/8 queries/3 resultados/8 fetches/6 por domínio/2 MiB por fonte/16 MiB total/180 s. Config completa nos inputs. Sem paid keys ou fallback pago.

## E. SearchProvider

`MediaWikiSearchProvider` usa a API pública REST do MediaWiki; endpoint configurável, interface desacoplada. [Referência oficial](https://www.mediawiki.org/wiki/API:REST_API/Reference). Retorna dados de descoberta e diagnóstico SEARCH_PROVIDER_UNAVAILABLE para falha/malformed JSON. Um corpus de referência, não busca universal na web. Não houve bypass de bloqueio.

## F. WebSourceProvider

`fetch` é assíncrono e baixa conteúdo; `receive(plan)` permanece síncrono e retorna apenas snapshots adquiridos. STATIC_SOURCE_PACK continua funcional. Cada fonte é validada pelo core antes da admissão; falha de contrato/budget preserva snapshot e rejeita a fonte. CSV MIME é texto; não há parser tabular CSV universal.

## G. Query planning

Queries determinísticas derivadas de goal, questions, métrica, qualifier e critério. Temperatura mínima/média e staff/presença permanente diferem. Seeds iniciais não contêm lugares nem valores. Não há LLM. Plano/query IDs são estáveis para os mesmos dados.

## H. Discovery stages

Tipos implementados: BROAD_DISCOVERY, ENTITY_DISCOVERY, FACT_VERIFICATION e CORROBORATION. Os dois primeiros vêm do tema; os últimos exigem fonte de entidade e gap de evidência, residência, comparabilidade ou quorum. A sessão para quando cobertura factual está pronta ou budgets acabam.

## I. Search results

Sessões finais: 7 queries, 21 resultados, 1 domínio. `search-trace.json` preserva estágio, query, count, erro e latência. Titles/snippets são discovery-only; não entram no extractor. Totais não incluem execuções intermediárias de desenvolvimento arquivadas.

## J. Candidate sources

Canonical URL, domínio, query IDs, research-question IDs, ranks, expected type, score, razões e fetchStatus são rastreáveis. Dedup junta provenance das queries. A classe esperada não vira SourceQuality. Candidatos irrelevantes ainda aparecem; esse é um limite real do primeiro provider.

## K. URL canonicalization

HTTP/HTTPS, normalização de host/porta, remoção de fragmentos e trackers conhecidos, resolução relativa. Query params de conteúdo são preservados. Credenciais/portas não aprovadas/protocolos não HTTP e literais privados são rejeitados. Redirects usam a mesma validação.

## L. Source selection

Prioridade de classes explícitas e preferências configuradas, HTTPS e rank da busca. Quota por domínio conta também tentativas falhas. Pilotos sem officialDomainHints. Todas as URLs do provider real pertencem ao mesmo domínio; a arquitetura de quotas não cria diversidade inexistente.

## M. HTTP fetcher

Node HTTP/HTTPS GET com timeout, headers mínimos, TLS padrão e Accept-Encoding identity. DNS é validado e fornecido ao lookup do socket, evitando fetch solto após validação. IP remoto é conferido. Nenhum browser/JS, conta, CAPTCHA ou paywall foi contornado.

## N. SSRF security

Bloqueia IPv4/IPv6 não públicos, loopback, link-local, redes privadas, CGNAT, documentação, metadata, IPv4 mapeado, hosts locais e DNS com mistura pública/privada. Inclui endpoint de plataforma/metadata com IP público conhecido. Só IPs aprovados são usados no transporte; destinos são revalidados por salto. Suite passa; não há alegação de prova universal de segurança.

## O. Redirects

301/302/303/307/308 manuais, limite rígido, relative Location normalizada e validação DNS/IP por salto. Robots é conferido também no novo domínio. Private URL, private DNS e loops têm testes próprios. Falhas são registradas em fetch-attempts, sem fallback de bypass.

## P. MIME/size safety

HTML/plain/TSV/CSV textuais UTF-8 são os únicos MIME de fonte. Node adapter recusa binário em headers antes de consumir o body; Content-Length antecipado e contador durante streaming limitam payload, mesmo se o header mentir. Orçamento total inclui busca/robots/redirects; bytes recusados antes do download não são payload baixado. Compressão não identity/charset não suportado são rejeitados. Há um SIZE_BLOCKED real neste piloto.

## Q. HTML processing

Reuso da normalização Fase19: raw preservado, remoção de script/style/nav/aside/iframe/noscript e mapa normalized UTF-16 ↔ raw. Não executa JS. UTF-8 BOM preservado no snapshot. Páginas vazias, binárias, sem linguagem suportada ou challenges legíveis falham sem gerar fatos. Não há extrator DOM universal nem deduplicação sofisticada de todo boilerplate.

## R. Cache/snapshots

Raw snapshots content-addressed, hash + fetchedAt + header subset + URL; `wx` impede overwrite silencioso. Cache discovery/sessions também usa nome SHA256 e comparação ao encontrar arquivo existente. Visões normalizadas/mapping/provenance ficam nos snapshots processados do pack e cache de sessão. Reprocessamento não depende da página viva. Hash verifica integridade local; não é assinatura de autenticidade do publisher.

## S. Research session

Contém request/config/plan/queries/results/trace/candidates/fetchAttempts/accepted/rejected/entities/EvidencePack/writer/quality/scope/diagnostics. Modo LIVE_DISCOVERY vs CACHED_REPLAY explícito. Aquisição por fetch aparece em tentativas e timestamps. Fingerprint da sessão inclui aquisição; processingFingerprint compara outputs factuais/editoriais com os mesmos snapshots.

## T. Research loop

Loop bounded de discovery → seleção → fetch → core → coverage → follow-up. Pode parar cedo: segundo piloto parou no primeiro round ao obter um fato utilizável. Cold terminou após dois rounds, sem completar cinco itens. Nenhum fato foi inserido manualmente para preencher cobertura.

## U. Budgets

Budget por rounds, queries/results, candidatos, fetches/domínio, bytes/source/total, request timeout, session deadline e redirects. RESEARCH_BUDGET_EXHAUSTED e razões de rejeição registrados. Fila serial é deliberadamente mais restritiva que o ceiling de concurrency. Essa versão não implementa pool paralelo nem retry agressivo de 429.

## V. Entity discovery

Search title pode criar DOCUMENT_SUBJECT de discovery com eligible=false. Evidence cria PLACE_CANDIDATE com SourceInput/sourceSpan/evidence IDs. H1 é assunto de documento; só lead com tipo de lugar pode habilitar follow-up sem fato de temperatura. Case/acento/whitespace dedup simples; sem fusão de aliases incertos. 10 registros source-derived nas duas sessões não representam dez cidades validadas.

## W. Follow-up queries

Cold: residência literal foi encontrada para candidatos, mas faltou medida comparável/independência. Queries seguintes apontam para esses gaps e preservam entitySourceIds. Search-only titles não geram fatos nem follow-ups elegíveis. O provider continua limitado ao corpus inicial; buscas específicas nem sempre retornam páginas relevantes.

## X. Source authority

Não há regra .gov→HIGH ou .org→INSTITUTIONAL. Domain hints são policy explícita; Wikipedia é classe REFERENCE do provider conhecido. Conteúdo, medida explícita, origem e extractability passam pelo assessment Fase19. Fontes aceitas aqui são MEDIUM; nenhuma prova primária foi descoberta. Classe/score são heurísticos e não certificam a verdade.

## Y. Shared origins

Core mantém igualdade de hash/texto, canonical URL, publisher e origin/sharedOrigin. Web acrescenta referências externas detectáveis e similaridade simples de chunks para near copies; sinais são conservadores e podem agrupar demais. Mesmo publisher não é tratado como segunda origem. Nenhum CORROBORATED real. Não foi implementada análise universal de citation chains.

## Z. English extraction

Opt-in `allowEnglishExtraction`; default PT anterior preservado. Gramática pequena de mínimo/média/recorde, aproximação, unidades e residência explícita. Citação permanece em inglês, Evidence.evidenceLanguage=en e source language/provenance rastreáveis por link; writer usa tuple PT. Contexto de sujeito exige heading/lead com spans exatos. Casos daily/monthly/highest record low/limiares/ambiguidade/unverified são rejeitados. Não há tradutor/NLP universal, leitura de toda tabela climática nem prova histórica externa.

## AA. Phase19 integration

Mesmos buildEvidencePack, assessment, extractor, conflicts, sourceOriginGroups, groundFacts, rankFacts, QA e factual preflight. Campos EN são opcionais e não mudam objetos PT antigos. Caps explícitos foram ampliados para web (2 MiB/source, 16 MiB total); defaults offline permanecem 64 KiB/source e 512 KiB total. Os quatro packs e os dois writers Fase19 foram regenerados idênticos, incluindo finalização medida.

## AB. GROUNDED_ONLY

Segundo piloto: 1 fato SUPPORTED, 1 claim factual, zero ungrounded e drift. Editorias reais não dizem Dataset Demo/ensaio fictício; editorias fixture permanecem byte-equivalentes. Nenhum sourceMaterial textual contorna EvidencePack. Roteiro final: `writer/real-temperature-records.json`. Naturalidade continua fraca e repetitiva; Writer v2 não foi implementado.

## AC. Real cold places

| Sessão | Pesquisa | Queries | Resultados | Fontes | Fatos utilizáveis | Writer |
|---|---|---|---|---|---|---|
| real-cold-places | REAL_RESEARCH_BLOCKED | 5 | 15 | 5 | 0 | RESEARCH_INCOMPLETE |
| real-temperature-records | REAL_RESEARCH_READY | 2 | 6 | 4 | 1 | PRODUCTION_ELIGIBLE |

Cold: quórum 2, PERMANENT_POPULATION, TEMPERATURE/MINIMUM_RECORDED. Foram aceitas cinco fontes, mas nenhuma medida/presença combinada atingiu o quórum e a comparabilidade para ranking. Objetos de residência INSUFFICIENT são candidatos, não itens válidos. Resultado REAL_RESEARCH_BLOCKED após discovery real, 0/5 elegíveis e sem roteiro. Segundo tema genérico de temperaturas terrestres foi escolhido para reutilizar tipos existentes; é independente do ranking de residência. Uma tentativa intermediária de estações trouxe conteúdo fora do escopo e não teve script aprovado; não é evidência de capacidade em estações. Arquivos dessa tentativa estão fora dos totais finais e são preservados como desenvolvimento.

| Sessão | Fonte | Qualidade | URL |
|---|---|---|---|
| real-cold-places | Oymyakon - Wikipedia | MEDIUM | https://en.wikipedia.org/wiki/Oymyakon |
| real-cold-places | Extremes on Earth - Wikipedia | MEDIUM | https://en.wikipedia.org/wiki/Extremes_on_Earth |
| real-cold-places | Grise Fiord - Wikipedia | MEDIUM | https://en.wikipedia.org/wiki/Grise_Fiord |
| real-cold-places | Liawenee - Wikipedia | MEDIUM | https://en.wikipedia.org/wiki/Liawenee |
| real-cold-places | Ellesmere Island - Wikipedia | MEDIUM | https://en.wikipedia.org/wiki/Ellesmere_Island |
| real-temperature-records | List of weather records - Wikipedia | MEDIUM | https://en.wikipedia.org/wiki/List_of_weather_records |
| real-temperature-records | Lowest temperature recorded on Earth - Wikipedia | MEDIUM | https://en.wikipedia.org/wiki/Lowest_temperature_recorded_on_Earth |
| real-temperature-records | List of extreme temperatures in Canada - Wikipedia | MEDIUM | https://en.wikipedia.org/wiki/List_of_extreme_temperatures_in_Canada |
| real-temperature-records | Atmospheric temperature - Wikipedia | MEDIUM | https://en.wikipedia.org/wiki/Atmospheric_temperature |

## AD. Global superlative guard

Scope é SESSION_CANDIDATES. Cold registra SUPERLATIVE_SCOPE_ADJUSTMENT; não afirma os cinco mais frios do mundo. Config de piloto permite esse escopo finito; se policy negar a alteração, retorna HUMAN_REVIEW_REQUIRED e não chama o writer. FactualPreflight em pack real também bloqueia superlativo global não estabelecido. O segundo roteiro só realiza uma medição, sem alegar recorde global/exaustividade.

## AE. Factual/visual matrix

Segundo roteiro: factualReady=True, visualReady=True. Matriz: `review/real-temperature-records.md`. Um display numérico nomeado de termômetro recebe DIRECT porque valor/rótulo foram conferidos contra o fato. Isso não representa a cidade nem a população. Cold não tem plano aprovado. PRODUCTION_ELIGIBLE é estado do preflight do writer: não foram medidos áudio/duração final nem criado MP4. Não há novo master verificado, música, SFX ou assets.

## AF. Replay

Dois replays offline reconstruídos a partir dos SourceInputs adquiridos, passando novamente por core e writer. DNS/transport substituídos por falha explícita na verificação: 0 chamadas. Igualdade de pack, ranking, writer, script, semantic graph, direction plan e compiled contract, quando aplicáveis. Cold tem script/plan N/A. Resultados em `analysis/replay-verification.json`; não é apenas retorno do pack antigo.

## AG. Security tests

115 testes web offline: queries, canonicalization, DNS/IP/protocolos, metadata, redirects, socket pinning, HTTP 403/404/429/500, timeout/abort, MIME/size/binary/charset/BOM, robots, cache, snapshots, source quality, entities, quotas, budget, early-stop, replay e anti-hardcode. Adapter Node é testado com request mockado sem abrir socket. Testes usam nomes e valores fictícios, nunca fixtures do piloto real. Não há localhost bypass para testes.

## AH. Prompt injection

HTML script não é executado nem extraído. Instruções em source/title/snippet permanecem data; não mudam request, policy, queries iniciais, writer ou licença de fatos. Extração restrita e ledger não tratam instruções como aprovação. Uma página maliciosa ainda pode publicar dados falsos: provenance/quality/quórum não equivalem a verificação universal de verdade.

## AI. Anti-hardcode

PASS: 240 arquivos; sem literal de entidade/temperatura final em runtime, fixtures e inputs. Ranking, entity list, temperatures e SourcePack manual não foram fornecidos. `anti-hardcode.json` lista sujeitos/valores obtidos dos outputs e todos os achados (vazio). Snapshots e relatórios gerados são excluídos por serem dados adquiridos, não seeds.

## AJ. Determinism

Queries determinísticas; snapshots fixos regeneram JSON/fingerprints aplicáveis. Relógio só na borda web e profiling; raw retrievedAt preservado no replay. Live sessions diferem em timestamps/headers/latência e podem receber páginas atualizadas; isso não é alegado como determinismo de rede. Core/render não recebeu clock real, randomness ou novo modelo.

## AK. Performance

| Sessão | Search ms | Fetch rede ms | Normalização | Extração | Facts/ground | Origem/corrob | Ranking | Writer incl preflights | Semantic isolado | Visual isolado |
|---|---|---|---|---|---|---|---|---|---|---|
| real-cold-places | 4573 | 2106 | 700.52 | 61.08 | 4.49 | 5.21 | 0.28 | 1336.85 | 0 | 0 |
| real-temperature-records | 1517 | 1654 | 625.74 | 18.87 | 3.15 | 3.22 | 0.01 | 10911.25 | 4.8 | 57.7 |

Valores em milissegundos. Rede inclui DNS/robots/rate-delay/HTTP; fetch falho tem wall separado no JSON. CPU aqui é tempo decorrido de funções locais sem rede, em benchmark isolado. Writer inclui preflights semânticos/visuais e revalidações do pack; grounding inclui clustering de origem. Amostras se sobrepõem e não devem ser somadas. Zero semantic/visual isolado no Cold significa ausência de script aprovado. Revalidação repetida dos snapshots domina parte do custo; não foi burlada para acelerar. `analysis/performance.json`.

## AL. Tests

| Comando | Estado | Testes | Segundos |
|---|---|---|---|
| npm run typecheck | PASS | — | 9.476 |
| npm run check:engine3d | PASS | 649 | 39.982 |
| npm run check:editorial | PASS | 46 | 2.707 |
| npm run check:sound | PASS | 35 | 4.214 |
| npm run check:visual | PASS | 37 | 33.775 |
| npm run check:motion | PASS | 30 | 3.622 |
| npm run check:demonstration | PASS | 30 | 2.481 |
| npm run check:autodirector | PASS | 23 | 2.37 |
| npm run check:semantics | PASS | 40 | 4.262 |
| npm run check:narrative | PASS | 35 | 15.69 |
| npm run check:writer | PASS | 32 | 38.158 |
| npm run check:research | PASS | 50 | 11.116 |
| npm run check:web-research | PASS | 115 | 4.937 |
| npm run engine3d:catalog | PASS | — | 1.975 |

14/14 PASS. Fast suite: 649 = 534 anteriores + 115 web. Não somar testes repetidos nos comandos especializados. Nenhum pacote foi instalado/atualizado. Replays finais e regeneração canônica das Fases18/19 também passaram.

| Gate | Requisito | Resultado | Evidência |
|---|---|---|---|
| 1 | Queries derivadas do ResearchPlan | PASS | queries/*.json; question IDs e critérios vêm do plano; testes de determinismo. |
| 2 | Nenhuma entidade final hardcoded | PASS | analysis/anti-hardcode.json; todos os nomes finais e valores foram lidos dos artefatos e procurados no código/fixtures/inputs. |
| 3 | Snippets não viram Evidence | PASS | SearchProvider separado; extractor recebe apenas SourceDocument; todas as citações batem com offsets dos snapshots. |
| 4 | Discovery real | PASS | search-trace.json: 7 queries e 21 resultados nas duas sessões finais; MEDIAWIKI_REST_SEARCH. |
| 5 | Página pública real fetchada | PASS | real-source-manifest.json: 9 snapshots aceitos de páginas públicas. |
| 6 | Snapshot hash e provenance | PASS | SHA256 de cada raw file conferido; timestamps, URL e query provenance preservados. |
| 7 | SSRF suite | PASS | 115 testes web passam; IP literal, DNS misto, metadata, socket e protocolos. |
| 8 | Redirect-to-private bloqueado | PASS | Testes para URL privada, DNS privado e loop; pinning revalidado em cada salto. |
| 9 | MIME e tamanho | PASS | Adapter Node testado sem sockets: bloqueio antes de stream por MIME/Content-Length e limite durante stream. |
| 10 | Injection não muda policy | PASS | Testes com source/script e search poisoning; GROUNDED_ONLY permanece obrigatório. |
| 11 | Loop bounded | PASS | Queries, rounds, resultados, fontes, quotas, bytes e deadline; exhaustion registrado. |
| 12 | Follow-up por coverage gap | PASS | Cold queries de round 1 seguem entidades com residência extraída mas sem medida explícita; não há seeds. |
| 13 | Entity provenance | PASS | entities/*.json: fonte/span/query IDs e distinção SEARCH vs SOURCE; título de busca não fundamenta fato. |
| 14 | Phase19 sem bypass | PASS | buildEvidencePack/validateEvidencePack usados na admissão, sessão, writer e replay. |
| 15 | GROUNDED_ONLY real | PASS | writer/real-temperature-records.json: um fato real source-backed e roteiro selecionado. |
| 16 | Zero ungrounded factual claims | PASS | Second pilot: 1 factual claim, 1 grounded, 0 ungrounded; Cold não possui roteiro aprovado. |
| 17 | Zero semantic drift aprovado | PASS | Second pilot: semanticDriftCount=0; ledger, grafo, links e qualifiers reconciliados. |
| 18 | Ranking incompleto não inventa item | PASS | Cold: eligibleItemCount=0, items=[]; five requested permanece não resolvido. |
| 19 | Staff temporário separado de população permanente | PASS | Teste inglês e regressão de ranking Fase19; nenhuma conversão de residência. |
| 20 | Métricas compatíveis | PASS | Core mantém mínimo/média, unidade, aproximação e contexto separados; record low diário rejeitado no parser EN. |
| 21 | Global superlative guard | PASS | Scope SESSION_CANDIDATES e SUPERLATIVE_SCOPE_ADJUSTMENT; preflight real rejeita superlativo global. |
| 22 | Sem Cold Places histórico | PASS | Inputs contêm somente tema/policy/budgets; nenhum source pack antigo entra no provider. |
| 23 | Cold honesto após descoberta real | PASS | REAL_RESEARCH_BLOCKED: 5 fontes aceitas; 0 fatos com quórum; nenhum ranking ou roteiro inventado. |
| 24 | Replay EvidencePack | PASS | analysis/replay-verification.json: ambos packs idênticos, rede bloqueada, 0 chamadas. |
| 25 | Replay ranking/script/plan | PASS | Fingerprints ranking/writer/script/semantic/plan/compiled conferidos; Cold N/A para script e plano. |
| 26 | Anti-hardcode PASS | PASS | analysis/anti-hardcode.json sem achados em código, fixtures e inputs dos pilotos. |
| 27 | Nenhuma API paga | PASS | Apenas Node HTTP/DNS e MediaWiki REST público; sem chaves, novos pacotes ou dependências. |
| 28 | Nenhum recurso Engine3D novo | PASS | Registry permanece 50/8/5; código de recursos e biblioteca permanece com hashes de baseline. |
| 29 | Todos testes anteriores passam | PASS | 14 comandos PASS; 649 fast tests = 534 anteriores + 115 web; 12 MP4 históricos sem alteração. |

## AM. Registry

Engine3D=50; SFX=8; VISUAL=5. Zero recursos novos, nenhuma alteração de voz/rate/pitch nem aprovação de novos usos de mídia. Catálogo regenerado com 50 recursos; registries e biblioteca preservam hashes anteriores.

## AN. Compatibility

12 MP4 históricos conferidos por SHA256 sem alteração, incluindo o demo Fase19. Package-lock inalterado. Nenhum teste/fixture anterior editado. Mudanças nos arquivos existentes limitadas a contratos/opt-in EN, caps explícitos, QA/preflight/real editorial e exports, além de package/README. `analysis/integrity.json` registra os 10 arquivos existentes alterados. Working tree anterior foi preservado; não houve commit/reset/push.

## AO. Limitations

Um provider/corpus/domínio, nenhuma origem primária/corroboration real, relevância de busca limitada, gramática EN pequena e ausência de PDF/JS/CSV universal. Alias/citation-chain detection é simples e conservadora. Cold tem 0 itens com quórum. A tentativa de estações não comprovou facts do tema e não recebeu script aprovado. Segundo piloto comprova só measurement literal. Naturalidade baixa; captions continuam estimadas. PRODUCTION_ELIGIBLE não substitui áudio/duração medida e render verificado. Não é motor universal de fact-checking nem garante que um dado publicado esteja correto hoje.

## AP. Honest assessment

| Dimensão | Nota | Limite / evidência |
|---|---|---|
| QUERY PLANNING | GOOD | Determinístico e gap-driven; vocabulário fechado de temperatura. |
| WEB DISCOVERY | ACCEPTABLE | Real, gratuito e configurável; um único corpus/domínio nesta execução. |
| SOURCE SELECTION | ACCEPTABLE | Scoring explícito, quotas e preferências; relevância ainda heurística e pode trazer documentos fora do assunto. |
| FETCH RELIABILITY | GOOD | 9 páginas aceitas; 1 rejeição por Content-Length; timeout/status/robots registrados. |
| FETCH SECURITY | STRONG | Suite offline com DNS/HTTP injetados e adapter Node testado; não é certificação universal de segurança. |
| SOURCE QUALITY | ACCEPTABLE | Notas MEDIUM por conteúdo/metadados; fontes secundárias, sem verificador universal. |
| ENTITY DISCOVERY | GOOD | Provenance por fonte/span; dedup case/acento/espaços; sem aliases universais. |
| EVIDENCE EXTRACTION | WEAK | Um measurement real e residência literal; não lê universalmente tabelas climáticas ou prosa inglesa. |
| CORROBORATION | WEAK | Nenhum CORROBORATED real; conservador contra duplicatas e referências compartilhadas. |
| CONFLICT HANDLING | GOOD | Regressão preservada; nenhum conflito real detectado no subconjunto extraível. |
| RANKING SAFETY | STRONG | Ranking de cinco bloqueado; sem itens fabricados nem escopo global falso. |
| GROUNDING | GOOD | Roteiro real passa ledger/preflight/reconciliação com citações exatas. |
| REPLAYABILITY | STRONG | Reconstrução offline e igualdade de todos fingerprints aplicáveis. |
| FACTUAL SAFETY | GOOD | Zero ungrounded no roteiro aprovado; sujeito/recorde ambíguo rejeitado; limites de parser explícitos. |
| VISUAL INTEGRATION | ACCEPTABLE | Thermometer com valor e rótulo; não representa cidade/população; nenhuma duração final medida. |
| GENERALIZATION | WEAK | Segundo tema dentro de temperatura; nenhuma prova em planetas/PDF/outros domínios. |
| OVERALL AUTONOMY | ACCEPTABLE | LEVEL4C experimental no domínio fechado demonstrado; Cold ranking continua bloqueado. |

### Respostas obrigatórias

**1. O ClonAI realizou pesquisa web real?** SIM; discovery e HTTP públicos executados pelo runtime.

**2. Qual SearchProvider?** MEDIAWIKI_REST_SEARCH; endpoint público en.wikipedia.org/w/rest.php/v1/search/page.

**3. Quantas queries?** 7 nas duas sessões finais: Cold 5; segundo 2. Tentativas de desenvolvimento estão arquivadas e excluídas destes totais.

**4. Quantos resultados?** 21: Cold 15; segundo 6.

**5. Quantos domínios únicos?** 1: en.wikipedia.org. Esta limitação impede corroboration entre publishers nesta execução.

**6. Quantas páginas realmente fetchadas?** 9 páginas integralmente preservadas; 10 tentativas de página selecionada, uma barrada por tamanho. Buscas/robots não são contadas como páginas de evidência.

**7. Quantas fontes aceitas?** 9 (5 Cold + 4 segundo), todas WEB_SEARCH e fixture=false.

**8. Quantas entidades surgiram da web?** 10 registros derivados de fonte nas duas sessões (5 + 5), incluindo assuntos de documentos; não significam dez lugares validados. Nomes só de busca permanecem discovery-only.

**9. Alguma entidade final estava hardcoded?** NÃO; anti-hardcode PASS.

**10. Quantos GroundedFacts reais?** 1 utilizável: Cold 0 com quórum 2; segundo 1 SUPPORTED com quórum 1. Objetos GroundedFact INSUFFICIENT do Cold não são contados como fatos prontos.

**11. Quantos CORROBORATED reais?** 0.

**12. Houve conflito?** NÃO detectado entre os fatos extraídos; não equivale a ausência de controvérsia no mundo real.

**13. Cold conseguiu cinco itens válidos?** NÃO.

**14. Se não, quantos?** 0 elegíveis ao ranking sob a policy declarada.

**15. Ranking global/exaustivo?** NÃO. SESSION_CANDIDATES; ranking final do Cold bloqueado.

**16. Algum fato veio de snippet?** NÃO. BLOCKER se isso ocorrer; testes e spans confirmam o caminho de snapshots.

**17. Algum fato veio de conhecimento interno?** NÃO. Nomes, valores e citações foram extraídos dos snapshots do runtime.

**18. Replay reproduziu resultado?** SIM. Dois replays reconstruídos com transport/DNS bloqueados, 0 chamadas, fingerprints idênticos.

**19. Atingiu LEVEL4C?** SIM, no máximo LEVEL4C experimental para extração literal de temperatura/presença no domínio suportado. Não é pesquisa universal nem ranking Cold concluído.

## AQ. Autonomy level

LEVEL4C experimental — autonomous grounded research for supported factual domains, demonstrado neste subconjunto literal de temperatura/presença. Discovery real, snapshots, Evidence real, GROUNDED_ONLY selecionado, zero ungrounded, replay, segurança e zero API paga foram comprovados. Não LEVEL5; não pesquisa universal; Cold Places continua bloqueado. O ganho sobre 4B é obter a fonte por runtime a partir do tema, sem SourcePack preparado por alguém.

## AR. Next recommendation

**B) Web research v2.** Investir em discovery de origens primárias e diversidade de corpus/domínios, seleção por relevância e cobertura com aliases/citação mais explícitos. O principal gargalo observado foi obter evidência independente e extraível; ampliar assets ou naturalidade não resolveria o ranking bloqueado. Recomendação apenas; Fase21 não iniciada.
