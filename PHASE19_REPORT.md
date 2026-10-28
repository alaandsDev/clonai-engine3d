# PHASE19 — Research, Source Grounding & Evidence Pack

## A. Objective

Construir research/grounding rastreável antes do writer factual, sem usar conhecimento do modelo como fonte. Resultado: **26/26 gates e 13 comandos PASS**, com snapshots, EvidencePack, corroboration, conflitos, ranking, GROUNDED_ONLY, reconciliação e matriz factual/visual.

Qualificação: **LEVEL4B limitado a snapshots explícitos e extração offline delimitada**. Não é discovery autônomo nem verificação universal de verdade. Os datasets e o vídeo de demonstração são **DEMO_FIXTURE / NOT_REAL_WORLD_FACTS**. Cold Places real terminou **REAL_PILOT_BLOCKED_NO_SOURCE_PACK**. Data28/10/2026; Fase20 não iniciada.

## B. Starting state

Base Fase18: LEVEL4A, writer determinístico capability-aware, SOURCE_ONLY/STRUCTURAL_ONLY, preflight real e produção local existente. Registry50/8/5. Baseline202 arquivos; somente package.json e quatro arquivos antigos do writer mudaram: contracts.ts/request.ts para admitir o nome GROUNDED_ONLY, index.ts para exportar a nova API/recusar ausência de pack, preflight.ts para impedir uso da rota legada sem EvidencePack. Demais arquivos do baseline e lockfile iguais. Onze vídeos históricos das Fases12–18 conservaram SHA-256; resultados canônicos do writer da Fase18 foram regenerados sem mudança. [integrity.json](out/engine3d/phase19/analysis/integrity.json)

## C. Architecture

`ResearchRequest → ResearchPlan → StaticSourcePackProvider → normalized SourceDocument + quality → Evidence/FactCandidate → conflicts/origin grouping/GroundedFact → comparable RankingResult → immutable EvidencePack → grounded writer → factual preflight → Semantic Engine → GroundingReconciliation → Narrative Director/Auto Director → factual-visual matrix → measured finalization → existing renderer`.

Novos módulos em src/research: contracts, request, planner, source, extractor, facts, ranking, pack, qa, grounding e index; integração em src/writer/grounded.ts. CLI cli/research.ts; testes tests/research.test.ts; guia [src/research/README.md](src/research/README.md). Core puro, sem rede/filesystem/clock/random. Harnesses em out medem/escrevem/narram/renderizam. Não há novo parser de claims de vídeo, Auto Director ou renderer: research extrai fatos documentais e writer realiza texto, depois o motor antigo extrai todos os SemanticClaims.

## D. ResearchRequest

v1 inclui id/topic/language, researchGoal(RANKING/PROCESS/FACTS), desiredFactTypes, constraints de critério/métrica/qualifier/contexto/count, sourcePolicy e budgets. Campos desconhecidos ou facts/sources escondidos no request são rejeitados. Critério é escopo de pergunta, não resposta factual. maxSources≤32 e maxEvidenceItems≤256; defaults16/128. Fonte chega em SourcePack separado, com conteúdo explícito/hash. O request não fornece valores para preencher ranking.

## E. ResearchPlan

Criado antes de ler o SourcePack pelo harness/CLI. Exporta request, policy versionada, perguntas, essentialResearchQuestionIds, ambiguidades e fingerprint. Não contém respostas, citação inventada ou valor adivinhado. Ranking pede elegibilidade humana, medições documentadas, comparabilidade e evidência independente suficiente para o count. Processo pede operações/participantes e contexto claros. Ausência de fonte mantém perguntas pendentes; não aciona fallback estrutural de outro assunto.

## F. Research questions

Ranking usa quatro famílias essenciais: RQ1 presença humana/critério; RQ2 valores/qualifiers documentados; RQ3 métrica/unidades/períodos comparáveis; RQ4 quantidade suficiente de entidades com quorum. Processo/FACTS usa RQ1 fatos/operações documentadas e RQ2 participantes/qualifiers/origens claros. Cobertura de perguntas é conservadora: uma família crítica permanece pendente enquanto a policy global correspondente não estiver satisfeita. Não é compreensão semântica aberta de cada pergunta.

## G. Source providers

STATIC_SOURCE_PACK é o único provider implementado: recebe um snapshot fornecido e devolve cópia própria, sem buscar locators. LOCAL_DOCUMENTS/WEB_SEARCH/OFFICIAL_API/CURATED_DATASET são contratos futuros, sem implementação ativa. Nenhum serviço de busca/scraping/LLM pago, chave ou dependência nova. Todos os gates funcionam offline. A narração edge-tts já existente foi usada no vídeo extra; ela fica fora dos gates de research/testes. Não se afirmou indisponibilidade geral de internet: optou-se pelo provider obrigatório offline e pelo bloqueio real permitido no pedido.

## H. SourceDocument

Conserva id/provider/sourceType/title/publisher, campos opcionais author/publishedAt/retrievedAt/license, locator, idioma, MIME, raw content, SHA-256, metadata, fixture e provenance. Datas vêm do manifest; não do relógio do core. Snapshot permanece imutável quando a página original muda. Fonte/título/URL sem trecho extraível não constitui Evidence.

Defaults:64KiB/source,512KiB total,64Ki caracteres normalizados; MIME text/plain/text/html/text/tab-separated-values; NUL/MIME inesperado/oversize/hash divergente falham antes da extração. HTML é tokenizado sem execução, com exclusão de script/style/nav/aside/iframe e preservação de title/headings/parágrafos/tabelas. Mapping por code unit mantém offsets UTF-16 para o raw original. Markup malformado é uma limitação; não há crawler, ZIP/PDF parser ou browser automation.

## I. Source quality

SourceQualityAssessment contém authority/directness/specificity/recencyRelevance/methodTransparency/independence/extractability com scores inteiros e razões. Authority3 para primary,2 academic/institutional,1 reference/news,0 other; directness até2, specificity até2, demais até1. HIGH≥9, MEDIUM≥6, demais LOW; idioma não suportado/sem texto é REJECT.

É avaliação de metadata e conteúdo extraível, sem autenticar publisher/metodologia ou produzir truth probability. Recência não é inferida automaticamente; datas/qualifiers factuais controlam comparabilidade. Dois documentos fictícios com origens declaradas distintas exercitam a policy, não comprovam pesquisa ou independência real.

## J. Source policy

research-policy/1.0.0: quorum de origens default1, qualidade mínima PRIMARY MEDIUM, conversão°F desabilitada por default, comparação temporal SAME_CONTEXT. O ranking demo exige2 origens; processo demo usa1 fonte HIGH declarada. LOW isolada não admite PRIMARY. REJECT não entra na extração. Conflitos e insuficiência impedem uso; EvidenceReviewDecision e fila NEEDS_REVIEW são preparados sem exigir aprovação por item nos testes. Nenhuma aprovação automática resolve conflito.

## K. Evidence model

Evidence v1 liga sourceId/sourceSpan/exactText/normalizedText/contentHash a evidenceType, supports estruturado, extractionMethod/confidence e truthStatus=EXTRACTED. ExactText é substring exata do snapshot, incluindo markup se a citação atravessar células HTML. Tabela adiciona row/column/headerContext/headerSpan. SourceHash, span e derivação são revalidados; URL ou resumo sozinho não passa. HIGH na extração significa correspondência literal clara, não “VERIFIED”.

## L. Evidence extraction

Subset pt-BR explícito: registros de temperatura com qualifier, valor/unidade e contexto; população/assentamento/presença temporária/sazonal em formas limitadas; tabelas de processo e tabelas Local/Métrica/Valor/Unidade/Contexto/Presença. Linhas instrucionais, negativas, modais ou interrogativas não são promovidas a afirmações positivas. Inglês recebe LANGUAGE_UNSUPPORTED_FOR_EXTRACTION. Demais enumerações de tipos são contratos reservados; não se inventa extração genérica.

Tabelas climáticas podem fornecer medição e residência separadas, ambas com contexto de cabeçalho/linha rastreável. Processo vem de tuplas textuais do dataset e vira fatos EXIT/FLOW/ENTER/INCREASE ou OPERATE quando explicitamente descrito. Não se transforma uma figura parecida em explicação de conceito científico.

## M. Fact candidates

FactCandidate é EXTRACTED: sujeito/predicado/objeto, quantity/métrica/contexto/qualifiers/residency e Evidence IDs, com confiança de extração e fingerprint. Só existem candidatos derivados de citações válidas. Lista de tipos desejados sem dado correspondente deixa research incompleto, mesmo havendo outros fatos úteis na fonte. Candidate não injeta SemanticClaims no planner de vídeo.

## N. Grounded facts

GroundedFact agrupa candidatos semanticamente compatíveis e guarda sources/evidence/candidates, status, origens, sharedOrigin, conflitos, qualifiers, usableForScript/Primary e groundingFingerprint. Status possíveis: SUPPORTED/CORROBORATED/CONFLICTED/INSUFFICIENT/REJECTED; EXTRACTED não vira “verdade verificada”. SUPPORTED com quorum1 é distinto de CORROBORATED com≥2 origens admitidas. Pack só fica RESEARCH_READY quando os requisitos essenciais passam. Usabilidade deriva da policy e nunca é promovida pelo writer.

## O. Qualifiers

MINIMUM_RECORDED, AVERAGE, DAILY_MINIMUM, OFFICIAL_RECORD, REPORTED_VALUE/REPORTED, ESTIMATED_VALUE, APPROXIMATE, presença humana e contexto do processo são preservados. Relatou não vira confirmação oficial; temporário não vira permanente. Uma medição média é fato diferente de mínima e não pode entrar no ranking desta. O writer usa paráfrases curtas de tuplas e conserva termos críticos/contexto. Isso é um idioma controlado de realização, não entailment de paráfrases arbitrárias.

## P. Units and precision

Quantity mantém originalValue como string, originalUnit, normalizedValue/Unit, conversionRule, precision e approximation. −67.8 não ganha zero decimal; −68 aproximado não vira exato. °F→°C usa regra determinística somente se autorizada; os originais continuam nas evidências/candidatos. Writer conserva unidade/precisão original em sua realização; o parser de vídeo ainda pode não suportar Fahrenheit, causando bloqueio de reconciliação/visual. A conversão numérica não autoriza nova precisão verbal.

## Q. Corroboration

Agrupamento de origens usa hash raw/normalizado, locator, publisher normalizado e origin/sharedOrigin declarados. Contam apenas origens com qualidade suficiente para PRIMARY. Duas URLs não são duas fontes independentes automaticamente. É corroboration estrutural limitada ao snapshot/metadata; não há investigação forense ou confirmação externa de independência.

Ranking demo:10 fatos, cada um com2 citações e2 origens fictícias declaradas, CORROBORATED. Processo demo:4 fatos de1 origem HIGH, SUPPORTED. Não se chama processo demo de corroborado.

## R. Duplicate sources

Cópia com ID/URL/publisher alterados continua uma origem se conteúdo raw ou normalizado coincidir. sharedOrigin explícito também une docs com redação diferente. Mesmo publisher é tratado conservadoramente como origem compartilhada. Tests/casos cobrem duplicação exata, whitespace-only e republicação. O pack registra sharedOrigin e pode tornar fatos insuficientes se o quorum exigido era2.

## S. Conflicts

Conflito simples exige mesma entidade, predicado, métrica, unidade normalizada, qualifiers e contexto, com valores diferentes. Conserva evidenceA/B, candidates, factKey, reason e UNRESOLVED. Nenhum maior/menor é escolhido por conveniência. No caso Alfa−40 versus−42, ambos ficam CONFLICTED e não são PRIMARY. Average−20 em2025 e minimum−40 em1980 são fatos distintos, não conflito direto. Resolver conflitos por decisão humana/automação futura não foi implementado.

## T. Ranking

Ranking deriva somente do universo do SourcePack e da policy. Exige facts admitidos, mesma métrica/qualifier, unidades/períodos comparáveis e critério de residência declarado. Quatro de cinco é RANKING_INCOMPLETE, com zero ranking final e diagnóstico de4 itens elegíveis. Métrica média não preenche lugar de mínima. Períodos/unidades múltiplos sem critério explícito não ganham seleção silenciosa por ID.

Ties usam competition rank(1,1,3), incluem todos no cutoff e mantêm rank igual; ordenação de apresentação entre empatados não é ordem factual. Aproximações permanecem grounded, mas ranking de valores aproximados é recusado sem policy de incerteza, ainda inexistente. A ordem realizada no roteiro deve respeitar os ranks derivados; inversão causa RANKING_ORDER_DRIFT. Cada item aponta a Fact IDs de medição e residência; não há posição afirmada por memória ou inserção de quinto item.

## U. Research ambiguity

“Onde alguém vive” sem definição de permanente/temporário/sazonal gera AMBIGUOUS_RESEARCH_CRITERION quando relevante ao ranking. Métrica/qualifier ausentes geram ambiguidade de comparação. A fixture/piloto declara PERMANENT_POPULATION; nenhuma equivalência automática com equipe científica temporária. Temporal context também é explícito ou deve ser comparável por policy; remover critério não produz um ranking mais conveniente.

## V. EvidencePack

EvidencePack v1 serializa topic/plan/sources/quality/evidence/candidates/groundedFacts/conflicts/unresolved/ranking/essential IDs/coverage/fingerprint. Ordem de sources/evidence/facts é canônica; mesma entrada/policy/snapshot gera mesmo pack. validateEvidencePack também reconstrói o pack a partir dos snapshots: re-assinar fato adulterado sem suporte não basta. Mutação de source ID/content/span/evidence/fact/qualifier, exclusão de source e fingerprint stale são detectados.

Coverage separa researchQuestionCoverage, sourceCoverage, evidenceCoverage, criticalFactCoverage, corroboratedFactRate, conflictRate e unresolvedQuestionRate. EvidenceCoverage mede candidatos com evidência, não percentagem de toda a prosa compreendida. Critical coverage de ranking usa itens elegíveis/count; quatro de cinco pode ser80% enquanto perguntas críticas seguem conservadoramente pendentes. [ranking.json](out/engine3d/phase19/packs/ranking.json)

## W. Writer integration

writeGroundedTopic(request,pack) valida snapshot read-only e exige topic compatível. Fontes/metadata/fatos não são alterados, promovidos ou resolvidos pelo writer. Todos os essenciais permanecem; não se melhora executability removendo a informação central. Três candidatos usam paráfrases curtas, sem copiar grandes trechos ou injetar claims/recursos/câmera. Processos conservam ordem documental; ranking conserva ordem derivada.

Scoring grounded após hard gates: grounding30, qualifiers15, clareza15, execução15, prova10, continuidade5, baixa ambiguidade3, baixos gaps3, naturalness2, repetição2. Factualidade não pode ser compensada por estilo. Plano parcial pode continuar SCRIPT_GROUNDED para revisão; não autoriza master. Naturalidade fraca e contextos repetidos foram conservados; não houve Writer v2 editorial.

## X. GROUNDED_ONLY

FactPolicy foi estendida opt-in. A rota antiga writeTopic/preflightCandidate recusa GROUNDED_ONLY sem EvidencePack; a nova rota rejeita sourceMaterial lateral. SOURCE_ONLY legado continua significando fonte direta autorizada, sem mudar contratos históricos. Para todo piloto factual desta fase usa-se GROUNDED_ONLY e apenas facts usáveis do pack.

Factual master exige critical facts grounded, ranking válido quando usado, essenciais cobertos, reconciliação sem drift/ungrounded, conflitos críticos ausentes e visual aprovado. CompiledNarrative.productionReady continua sendo propriedade visual do compilador antigo; somente o envelope grounded/finalização autoriza master factual. Fixture nunca tem realWorldProductionEligible=true.

## Y. Claim-evidence links

Ledger: sentença/SourceSpan do script → SemanticClaim real → GroundedFact IDs → Evidence IDs/spans → Source ID/hash/locator/origin → status visual. O processo final tem4 links; ranking piloto tem6; todos os PRIMARY estão ligados. Cada citação exata pode ser localizada sem depender de URL viva. Tabela/contexto estão preservados.

[citation-ledger.json](out/engine3d/phase19/analysis/citation-ledger.json); [evidence-review.md](out/engine3d/phase19/review/evidence-review.md); [research-review.md](out/engine3d/phase19/review/research-review.md).

## Z. Factual preflight

Antes do Semantic Engine: factualPreflight verifica ledger completo, spans, frases licenciadas pelo pack, usabilidade dos facts, essenciais e ordem do ranking. Depois: reconcileGrounding compara claims efetivamente extraídos a fatos compatíveis, incluindo predicado, quantity, subject textual/qualifiers e contexto da sentença. Sentença factual que desaparece como contexto/pergunta também bloqueia.

Os roteiros aprovados têm ungroundedClaimCount=0, semanticDriftCount=0 e qualifierPreservationRate=100%. O parser e o Auto Director continuam produzindo os próprios claims/direção. A validação é delimitada ao idioma de realização e aos tipos suportados, não um fact checker universal.

## AA. Semantic drift

Mutações de número, entidade, minimum→average, permanência, aproximação→exatidão, relato→oficial e causalidade não fornecida são rejeitadas. Source negada/modal/pergunta não vira afirmação. Source/pack/script fingerprints impedem edição stale; reconciliação impede confiar apenas no ledger declarado. Ranking invertido é drift mesmo se cada número isolado existe na fonte. Casos exportados em [script-mutations.json](out/engine3d/phase19/analysis/script-mutations.json) e logs dos50 testes. O mecanismo não valida paráfrase literária aberta; ele recusa realização fora da linguagem licenciada.

## AB. Factual/visual matrix

| Piloto | Fact coverage essenciais | Visual por PRIMARY | Renderability | Master state |
| --- | --- | --- | --- | --- |
| Processo demo | 100.00% | 100.00% | FULL | PRODUCTION_ELIGIBLE |
| Ranking demo top3 | 100.00% | 50.00% | PARTIAL | SCRIPT_GROUNDED |
| Crowd demo | 100% | 0% | gaps honestos | SCRIPT_GROUNDED |
| Cold real | 0% | não avaliado | bloqueado | RESEARCH_INCOMPLETE |

Ranking possui3 valores representáveis em display numérico e3 claims de população permanente sem prova. Isso dá50% por PRIMARY, distinto da cobertura por frames. Display passa por guard adicional de valor e identidade textual: um termômetro exibindo outro número não vira DIRECT. Não se afirma mostrar a cidade/população real por exibir número. Caso crowd possui fato CORROBORATED e visual NONE, sem Caio/rádio como substituto.

## AC. Offline fixtures

Fixtures explícitas em examples/research, com fixture=true e labels DEMO_FIXTURE/NOT_REAL_WORLD_FACTS. Cases exportados: conflito, métrica diferente, quatro-de-cinco, tie, duplicate, critério ambíguo, source injection, approximation, temporal e grounded crowd. Inglês, HTML/table, unidades, precision, negation/modality e mutações são exercitados em testes locais. Todos os gates rodam sem rede. Valores sintéticos não aparecem como pesquisa real; source pack real é vazio.

## AD. Ranking fixture

Dataset demo possui5 entidades fictícias, mínimas−40/−35/−30/−25/−20°C, contexto1980 e população permanente afirmada em duas origens fictícias declaradas.20 evidências dão10 facts corroborados estruturalmente. Ranking de cinco é VALID; piloto pede os três primeiros e utiliza6 facts essenciais, mantendo os outros4 no pack como opcionais, sem apagá-los.

O writer top3 tem116 palavras,6 claims,100% de grounding/qualifiers e0 drift. Visual é PARTIAL,50% por claims; master não foi renderizado. Não se chamou esse ranking de Cold Places real. [ranking-pilot-script.txt](out/engine3d/phase19/writer/ranking-pilot-script.txt)

## AE. Real cold-places pilot

**REAL_PILOT_BLOCKED_NO_SOURCE_PACK.** Nenhuma fonte real foi recebida/pesquisada; nenhum ranking, roteiro ou vídeo real foi produzido. O runtime não possui provider web nesta entrega. O roteiro/ranking histórico nunca entrou como source.

Respostas obrigatórias do piloto real:

1. Encontrou/recebeu fontes reais? **NÃO**.
2. Ranking derivado dessas fontes? **NÃO**, não houve ranking real.
3. Itens com evidência suficiente? **0**.
4. Houve conflito? **NÃO detectado; não avaliável sem corpus**, não é confirmação de ausência de conflito no mundo.
5. Distinguiu população permanente de presença temporária? **SIM na policy**, com PERMANENT_POPULATION explícito; nenhum local real foi validado.
6. Algum número factual real foi inventado? **NÃO**. Valores do Dataset Demo são sintéticos, rotulados e separados.
7. Claim real do roteiro sem evidence? **NÃO/NÃO APLICÁVEL**: não foi gerado roteiro real. Nos pilotos fictícios aprovados todos os claims têm links.
8. Roteiro antigo foi source? **NÃO**.
9. Factual-ready real? **NÃO**.
10. Visual-ready real? **NÃO**, bloqueado antes dessa etapa.

Para destravar: snapshots meteorológicos primários com tipo/unidade/data/método/escopo comparável; documentos de residência permanente ou staff temporário; corroboration com origens independentes declaradas; título/publisher/provenance/license/hash/retrieval; critério de ranking e período explícitos. Não basta fornecer URLs. [real-cold-places-status.json](out/engine3d/phase19/analysis/real-cold-places-status.json)

## AF. Source injection safety

Fontes são DATA. Não há execução de script, instrução textual, URL, arquivo arbitrário ou comando contido em documento. Source com “ignore regras...” permanece no snapshot, mas a linha instrucional não gera fato nem altera quorum/policy. HTML script/style/nav é removido apenas da visão extraída, preservando raw content e offsets. NUL, MIME/size/hash inválidos falham. Não existe tradutor/crawler/modelo de pesquisa para seguir instruções externas.

## AG. Determinism

Repetição e reversão de sources/evidence/facts preservam pack canônico; shared-origin/duplicate grouping é estável. Inverter capabilities preserva writer/plan; topic ID de transporte não muda texto/direção. Fingerprints cobrem source/metadata, evidence, candidate, grounded fact, policy/plan, pack, writer, script, reconciliação e finalização. QA rederiva fatos/qualifiers/ranking dos snapshots. Discovery reproduzível é outra questão: não foi implementado web discovery.

Código final regenerou os quatro packs, ambos os writers e a finalização medida identicamente aos artefatos salvos. Compatibilidade legada também foi verificada por resultados canônicos da Fase18. [current-output-verification.json](out/engine3d/phase19/analysis/current-output-verification.json)

## AH. Performance

| Workload | Processo ms | Ranking-piloto ms |
| --- | --- | --- |
| researchPlanningMilliseconds | 0.641 | 0.285 |
| sourceNormalizationMilliseconds | 0.999 | 5.492 |
| sourceAssessmentMilliseconds | 2.439 | 0.121 |
| evidenceExtractionAndFactCandidateConstructionMilliseconds | 10.916 | 3.748 |
| conflictDetectionMilliseconds | 0.135 | 1.251 |
| corroborationOriginClusteringReplayMilliseconds | 0.164 | 0.163 |
| groundedFactConstructionIncludingCorroborationMilliseconds | 0.651 | 0.775 |
| completePackConstructionMilliseconds | 6.008 | 11.582 |
| writerGroundingIncludingAllPreflightsMilliseconds | 1625.845 | 530.152 |
| semanticPreflightReplayMilliseconds | 9.004 | 8.630 |
| factualReconciliationReplayMilliseconds | 2.053 | 10.058 |
| visualNarrativeAndCompileReplayMilliseconds | 372.000 | 57.607 |

Medições de workloads, **não fases exclusivas somáveis**. Extraction inclui FactCandidate; GroundedFact construction inclui corroboration; pack inclui source/evidence/conflict work; writer inclui todos os preflights; replays duplicam trabalho. [stage-performance.json](out/engine3d/phase19/analysis/stage-performance.json). Scans/mapping são limitados por source size; conflitos são O(F²), agrupamento de origens faz joins limitados a32 sources; até256 evidências. QA reprocessa snapshots e é repetido pelo writer; compile depende dos frames/eventos. Não se afirma escala de crawler ou corpus longo.

Vídeo final: renderMedia52,636s; wall90,448s, incluindo bundle/stills/mux/decode/samples, excluindo TTS/inspeção e tentativas anteriores interrompidas pelo guard de áudio. São medidas do passe bem-sucedido. [render-performance.json](out/engine3d/phase19/analysis/render-performance.json).

## AI. Tests

| Comando | Resultado | Contagem |
| --- | --- | --- |
| npm run typecheck | PASS | typecheck/catalog |
| npm run check:engine3d | PASS | tests 534, pass 534, fail 0 |
| npm run check:editorial | PASS | tests 46, pass 46, fail 0 |
| npm run check:sound | PASS | tests 35, pass 35, fail 0 |
| npm run check:visual | PASS | tests 37, pass 37, fail 0 |
| npm run check:motion | PASS | tests 30, pass 30, fail 0 |
| npm run check:demonstration | PASS | tests 30, pass 30, fail 0 |
| npm run check:autodirector | PASS | tests 23, pass 23, fail 0 |
| npm run check:semantics | PASS | tests 40, pass 40, fail 0 |
| npm run check:narrative | PASS | tests 35, pass 35, fail 0 |
| npm run check:writer | PASS | tests 32, pass 32, fail 0 |
| npm run check:research | PASS | tests 50, pass 50, fail 0 |
| npm run engine3d:catalog | PASS | typecheck/catalog |

50 testes novos,534 na suíte rápida incluindo os484 anteriores; suítes focalizadas repetem subconjuntos e não são somadas como total único. Cobrem contratos, snapshots/hashes/spans, HTML/tabelas, idioma, qualidade, units/precision/approximation, conflitos/dups/corrob/rank/ties/criteria, source instructions, negation/modality, mutações, ordem do ranking, essenciais, grounding, drift, independência visual, finalização e E2E offline. CLI plan/build-pack/inspect/ground-script passou no smoke. [checks.json](out/engine3d/phase19/analysis/checks.json).

## AJ. Registry

Engine3D=50, SFX=8, VISUAL=5. Zero novos IDs, assets, primitivas, câmeras ou personagens. Nenhuma música/SFX/serviço pago/dependência nova. Lockfile e catálogos de mídia preservados. Campos Fact/Evidence IDs são identificadores documentais, não recursos Engine3D.

## AK. Compatibility

Sem mudanças em Semantic Engine, Narrative Director, Auto Director, renderer, TTS ou media runtimes. As extensões de writer são opt-in; contracts e políticas anteriores continuam funcionando. Onze vídeos históricos têm hash original; os hashes foram lidos somente para auditoria de integridade, não como evidence factual.

TTS mantém AntonioNeural,+0%,+0Hz. Demo:120 palavras,1593 frames/53,1s,H264480×854/30fps,AAC48kHz estéreo,−21,2LUFS/true peak−6,6dB, decode completo PASS. Orçamento dos tracks soma1592 frames; ceil da timeline aloca1 frame adicional. O mux usa amostras inteiras pelo orçamento de cada unidade, com padding e sem cortar fala. A/V final coincide, source do áudio é igual ao script e captions estimadas≤3 palavras.

[render-qa.json](out/engine3d/phase19/analysis/render-qa.json); vídeo [phase19-grounded-process-demo.mp4](out/engine3d/phase19/renders/phase19-grounded-process-demo.mp4). Metadata inclui DEMO_FIXTURE/NOT_REAL_WORLD_FACTS e pack hash.29 pares de frames nativos/codificados e oito contact pages foram inspecionados; estado de fluxo/nível confirmou progressão. Não é avaliação auditiva humana nem demonstração científica real. Hold/repetição e limitações do metricador Fase13 permanecem; não houve polish editorial ou visual.

## AL. Limitations

Extração pt-BR e formatos/realização fechados; inglês e construções fora do subset não produzem facts por conhecimento interno. Normalização HTML é limitada. Classes/métodos/origens são declarados no pack, sem autenticação ou verificação externa. Corroboration é estrutural, não prova de verdade; matching restrito não substitui entailment universal. Tipo enumerado não significa extractor implementado para toda definição/relação/causa.

Ranking é somente do universo e contexto fornecidos. Aproximações e conflitos sem resolução podem impedir produção. Cobertura de perguntas é conservadora e não avalia a prosa inteira. Não há web research, provider pago, modelo local, tradutor ou resolução de conflitos/capabilities automática. Visual factual continua limitado: população/cientistas não ganham geometria equivalente fictícia. Naturalidade segue WEAK, contextos repetidos e holds longos; captions sem word alignment. Nenhum desses limites foi escondido por status de produção real.

## AM. Honest assessment

| Dimensão | Nota | Razão |
| --- | --- | --- |
| RESEARCH PLANNING | GOOD | Questões/critério antes de fontes; conjunto de templates delimitado. |
| SOURCE MODEL | GOOD | Snapshot/hash/mapping/metadata e limites claros. |
| SOURCE QUALITY ASSESSMENT | ACCEPTABLE | Breakdown transparente, mas metadata não autenticada. |
| EVIDENCE EXTRACTION | ACCEPTABLE | Literal/tables pt-BR; subset pequeno, fail closed. |
| PROVENANCE | STRONG | Source→span→fact→claim; rederivação e mutations. |
| FACT GROUNDING | GOOD | Quorum/quality/conflict/essenciais controlam uso; sem garantia externa. |
| QUALIFIER PRESERVATION | GOOD | Métrica, período, aproximação, relato e residência protegidos. |
| CONFLICT HANDLING | GOOD | Conflitos simples bloqueiam; não há resolução automática. |
| CORROBORATION | ACCEPTABLE | Origem estrutural/duplicates; independência real depende do manifest. |
| RANKING SAFETY | GOOD | Comparabilidade, incompletude, ties e ordem realizados com bloqueios. |
| WRITER GROUNDING | GOOD | Tuplas→paráfrase→motor real; sourceMaterial lateral recusado. |
| SEMANTIC DRIFT DETECTION | GOOD | Hard gates no idioma controlado; não linguagem aberta. |
| FACTUAL SAFETY | GOOD | Zero additions/drift nos aprovados; não fact checker universal. |
| VISUAL INTEGRATION | GOOD | Fact e visual separados; CORROBORATED pode ser NONE. |
| DETERMINISM | STRONG | Snapshots/order/hash/rederivação e outputs atuais idênticos. |
| GENERALIZATION | WEAK | Corpus/gramática pequenos; sem descoberta/entailment geral. |
| OVERALL AUTONOMY | ACCEPTABLE | LEVEL4B de snapshots; Cold real corretamente bloqueado. |

Notas de engenharia desta execução, não certificação externa. Naturalidade do writer continua WEAK conforme a Fase18; não foi tratada nesta fase.

## AN. Autonomy level

**LEVEL4B: SIM, no escopo de snapshots explícitos/offline e realização delimitada.** Não se declarou LEVEL5 nem redefiniu o histórico:3B era script natural parcial honesto;4A adicionou tema estrutural;4B adiciona evidence/grounding/preflight factual.

| Gate | Condição | Resultado | Evidência |
| --- | --- | --- | --- |
| 1 | Plan without hidden answers | PASS | source-free typed questions; request guard tests |
| 2 | Evidence valid source/span | PASS | snapshot span/hash revalidation + mutation tests |
| 3 | GroundedFact real evidence links | PASS | pack rederivation and source ledger |
| 4 | Number mutation rejected | PASS | script-mutations.json |
| 5 | Entity mutation rejected | PASS | script-mutations.json |
| 6 | Qualifier mutation rejected | PASS | script-mutations.json |
| 7 | New cause rejected | PASS | script-mutations.json |
| 8 | Duplicate not independent | PASS | content/normalized hash, publisher and shared-origin tests |
| 9 | Conflicts unresolved | PASS | CONFLICTED facts not usable |
| 10 | Incompatible metrics excluded | PASS | minimum vs average / temporal / unit tests |
| 11 | Incomplete ranking no invention | PASS | four-of-five diagnostic |
| 12 | Tie no arbitrary factual order | PASS | competition rank + boundary inclusion |
| 13 | Residency ambiguity | PASS | explicit criterion test |
| 14 | Source instructions do not alter policy | PASS | raw snapshot retained, instruction lines excluded; unit tests |
| 15 | Pack deterministic | PASS | reverse source/evidence/fact order, source QA and current-output-verification |
| 16 | GROUNDED_ONLY no additions | PASS | closed paraphrases and no sourceMaterial bypass |
| 17 | Every final factual claim linked | PASS | citation-ledger.json |
| 18 | Approved pilot drift zero | PASS | post-engine reconciliation |
| 19 | Ungrounded claims zero | PASS | both approved script pilots |
| 20 | Factual and visual separate | PASS | CORROBORATED crowd/NONE; ranking100% facts/50% visual |
| 21 | Offline fixture E2E | PASS | offline source→pack→writer→semantic→direction; TTS/render extra, not gate dependency |
| 22 | Real Cold sourced or blocked | PASS | zero real sources; no invented research |
| 23 | Old Cold Places not source | PASS | pure core only receives explicit pack; old videos read solely for integrity hashes |
| 24 | No new Engine resources | PASS | baseline registries unchanged |
| 25 | No paid API | PASS | STATIC_SOURCE_PACK only; no new dependency/key/research network |
| 26 | Previous tests PASS | PASS | 13 commands; fast suite534; research50 |

Respostas obrigatórias:

1. Distingue source de evidence? **SIM**: documento/snapshot versus citação com span.
2. Evidence de fact? **SIM**: trecho extraído versus interpretação estruturada/policy.
3. Supported de corroborated? **SIM**: quorum/origens, sem chamar de verdade verificada.
4. Preserva qualifiers? **SIM no subset implementado**; alterações geram blocker.
5. Detecta conflitos simples? **SIM**, sem escolher valor conveniente.
6. Recusa ranking inválido? **SIM**, inclusive incompleto, métrica/período/unidade e approximation.
7. Impede drift no writer? **SIM no idioma controlado**; não é entailment geral.
8. Todo claim factual final é rastreável? **SIM**,4 do processo e6 do ranking, com links completos.
9. Research e visual separados? **SIM**: ranking100% factual/50% visual e crowd CORROBORATED/NONE.
10. Atingiu LEVEL4B? **SIM, qualificado como snapshot-grounded**, sem discovery ou produção factual universal.

O gate offline E2E não depende de TTS/internet: valida até direção/compile. O MP4 demonstrativo é evidência adicional e usa o provider de voz existente fora dos testes.

## AO. Next recommendation

**Escolha única: A) Web research provider.** O bloqueio concreto do piloto real é ausência de SourcePack real; a próxima etapa deve poder obter/pinar documentos autorizados com limites/cache/provenance, mantendo a policy e a recusa por falta de comparabilidade. Deve ser opcional e gratuito, sem comprometer os gates offline. Isso não promete resolver qualidade das fontes, idiomas, extração aberta ou representação visual de qualquer assunto.

Recomendação somente. Nenhum web provider, Fase20, paid API, expansão de Engine3D, música ou integração Higgsfield/HeyGen foi iniciado. Fase19 encerrada com os resultados e bloqueios reais registrados.
