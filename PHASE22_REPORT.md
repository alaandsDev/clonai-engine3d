# Phase 22 — Research v3 — Final report

Data: 2026-10-28. Continuação do checkpoint oficial; resultado final da fase.

## Objective

Concluir a implementação e a validação da Research v3 a partir do checkpoint oficial, preservando factual safety e compatibilidade. **PHASE22 COMPLETE: YES — implementation gate PASS.** Isso não significa pesquisa pronta: Cold está **REAL_RESEARCH_PARTIAL**, ranking **RANKING_INCOMPLETE**, **0/5** elegíveis. Nenhum MP4 foi produzido. Os gates reais são reportados separadamente abaixo.

## Starting State

Branch `main`, HEAD `686d08d69889b291f31b12fde117977d85c0b291`, árvore inicialmente limpa e checkpoint confirmado em `origin/main`. Base Phase21 `838bc9c`. A v3 existia como implementação parcial, sem suíte própria nem benchmark real validado. Autonomia inicial LEVEL4C. O HEAD permanece no checkpoint: sem commit/push nesta continuação.

## Checkpoint Handoff

Lidos `PHASE22_HANDOFF_INCOMPLETE.md`, `CLONAI_HANDOFF.md`, `PHASE21_REPORT.md`, o diff completo entre a base Phase21 e o checkpoint e os helpers originais em `tools/phase22-checkpoint`. A continuação aproveitou os módulos existentes. O handoff incompleto foi preservado como histórico; este documento registra o resultado final.

Foi criada a suíte antes das correções e dos benchmarks. Falhas incrementais expuseram ambiguidade de subjects, deduplicação indevida de evidence em empate, provenance JSON-LD apontando para o bloco errado, conteúdo HTML ignorado interpretado como registro, fingerprint de grafo dependente da ordem, tarefas de corroboração sem limite individual e replay que não validava o conteúdo armazenado da pool. As correções têm regressões fictícias.

## Architecture

Fluxo de produção preservado: Codex → DirectorPlan.json → Engine3D → Three/R3F → Remotion → edge-tts → MP4. A camada anterior recebe ResearchRequest → descoberta/fetch seguro → snapshots → EvidencePack → GROUNDED_ONLY → preflight. Esta fase altera pesquisa, revisão e auditoria, sem expandir Engine3D, Writer, render ou assets.

## Research v3

Opt-in explícito `sourcePolicy.researchVersion: 3`. Módulos reaproveitados: `context.ts`, `records.ts`, `entities.ts`, `authority.ts`, `v3-extract.ts`, `v3.ts`, `similarity.ts` e `web/v3.ts`. Novos: suíte v3, output v3, auditoria offline, inputs portáveis e helpers de reprodução.

Correções finais adicionais: médias de extremos abstêm em vez de virar mínimo registrado; snapshots com o mesmo final URL+hash são admitidos uma vez, mantendo todas as tentativas. A deduplicação só muda a admissão v3 e não cria origens. O parser antigo permanece compatível nas observações históricas, inclusive após a guarda estatística compartilhada.

## Independent Discovery

MediaWiki, Wikidata, OpenAlex e Crossref usam endpoints públicos gratuitos. Links de publisher e referências passam pelo mesmo cliente seguro. A independência da descoberta é registrada separadamente da independência da evidência. Um artigo descoberto via corpus independente pode continuar derivado da fonte citada.

[review/independent-discovery.md](out/engine3d/phase22/review/independent-discovery.md); estratégias, falhas e métricas em [analysis/metrics.json](out/engine3d/phase22/analysis/metrics.json).

## Candidate Entity Pool

Cold: **7 candidatos relevantes com evidência de fonte**, 9 place candidates brutos, 4 observation sites e 11 títulos apenas de busca. Candidatos relevantes: Liawenee, Australia, Grise Fiord, Oymyakon, Pevek, Caçador, Eureka. Candidato não significa settlement comprovado nem elegibilidade. A pool bruta ainda contém ruído de rótulos/documentos, registrado na revisão e excluído dos itens finais.

Pool determinística, com proveniência, cobertura, aliases e prioridade: [review/candidate-entity-pool.md](out/engine3d/phase22/review/candidate-entity-pool.md).

## Query Planning v3

Queries têm `purpose`, `derivedFrom`, `targetGap`, entidade/fato e origens excluídas quando aplicável. Lacunas de métrica, população, fonte oficial, alias e corroboração recebem propósitos distintos. Os inputs finais não contêm entidades, temperaturas, publishers, URLs de fontes nem ranking esperado. O benchmark mantém o tópico integral e as constraints da Phase21.

## Document Context

O resolvedor lê headings de dados, label/value e metadados com spans exatos antes da herança para tabelas. URL pode ser pista, nunca fato. O benchmark produziu **6 EVs oficiais/institucionais com contexto herdado**; os IDs, trechos e offsets estão em [analysis/mandatory-answers.json](out/engine3d/phase22/analysis/mandatory-answers.json) e [review/document-context.md](out/engine3d/phase22/review/document-context.md).

## Subject Resolution

Subjects ausentes ou concorrentes resultam em abstention, sem escolher o primeiro nome. Vários campos de localização preservam a ambiguidade. Descritor parentético de estação não destrói o nome. O kind STATION é mantido quando sustentado pelo contexto; spans de label, valor e contexto permanecem separados.

## Context-aware Tables

TH amplo pode ser section label em vez de segundo header. Labels em TD são interpretados; coluna anual e janela de observação não se confundem com valor mensal ou data do evento. Lowest maximum, day-count, time-of-day mean e médias de extremos não viram MINIMUM_RECORDED. Average daily minimum permanece qualificador separado.

## Station/Location Resolution

Stations e settlements continuam nós e fatos distintos. `SAME_ENTITY_ONLY` não transfere medição. O input v3 permite `SOURCED_OBSERVATION_SITE`, exigindo relação explícita source-backed. NEAR não é equivalência. Quando uma relação permitida abastece um item, o label é o settlement e `measurementFactId` mantém o fato da estação. População permanente continua sendo uma exigência independente.

[review/station-resolution.md](out/engine3d/phase22/review/station-resolution.md); política preservada em [analysis/policy-preservation.json](out/engine3d/phase22/analysis/policy-preservation.json).

## Entity Graph

IDs, ordenação e fingerprint independem da ordem de entrada, inclusive variantes de caixa nos nomes. Arestas guardam fonte, motivo e span quando aplicável. Relações desconhecidas não provam independência. Review: [review/entity-graph.md](out/engine3d/phase22/review/entity-graph.md).

## Alias/Transliteration

AlternateName de JSON-LD gera SUPPORTED_ALIAS; similaridade de transliteração gera CANDIDATE_ALIAS. Nenhum deles funde entidades. Apenas CONFIRMED com linguagem explícita e suporte permitido pode participar da resolução; rejeições de identidade permanecem veto.

## Semi-Structured Records

Registros de campos TD, div e parágrafos rotulados preservam heading, campo, valor, data, semântica e provenance. Blocos script/style/nav/aside/iframe/noscript e comentários são mascarados sem deslocar offsets. Record extraction não usa snippets ou conhecimento interno. Review: [review/primary-records.md](out/engine3d/phase22/review/primary-records.md).

## Multi-Subject Records

Subjects alternativos/ambíguos, inclusive separados por line breaks, não recebem fatos individuais. Empates explicitamente compartilhados podem gerar um fato por subject, com evidence ID distinto e sharedRecordId. Ausência de separador não autoriza inventar uma entidade conjunta.

## Publisher Identity

Identidade vem de sinais explícitos no snapshot, como organização declarada em JSON-LD, meta e copyright. Cada sinal mantém o bloco/span que realmente o declara. Meta em comentário não estabelece publisher. Review: [review/publisher-authority.md](out/engine3d/phase22/review/publisher-authority.md).

## Authority Assessment

TLD isolado não confere autoridade. HIGH exige identidade e compatibilidade com o domínio factual. PublisherIdentity, authority, SourceQuality e independência são objetos distintos. A avaliação é heurística sobre declarações públicas, não autenticação universal nem garantia de verdade.

## Primary Source Classification

Cold aceitou 6 fontes primárias e 8 institucionais/acadêmicas pela classificação efetiva. A classe originalmente declarada continua em `pack.sources`; a classe derivada v3 é usada na avaliação/grounding e fica auditável. REFERENCE não é promovida a oficial. As exceções de origem única com autoridade HIGH são exatamente as da Phase21; quorum padrão continua 2.

## Corroboration Tasks

Tarefas registram factKey, entidade, métrica, qualifier, origens conhecidas/excluídas, queries por provider, prioridade, budget e status. Uma tentativa REFERENCE_DERIVED não esgota tarefa de descoberta independente. O limite por tarefa é aplicado a fetches efetivos. Review: [review/corroboration.md](out/engine3d/phase22/review/corroboration.md).

## Independence v3

SourceGraph, grupos de origem e raízes por fato continuam controlando o quorum. Corpos idênticos, domínio comum, arquivos do mesmo original, near-copy e dependência declarada não criam origens extras. Cold terminou com **0 CORROBORATED**, apesar da diversidade de caminhos de descoberta. Publisher following não é corroboração independente.

## Near-Copy Detection

Jaccard de shingles de quatro palavras, threshold 0,6 e tamanho mínimo, aplicado a prose. Tabelas estruturadas ficam fora dessa comparação. É uma aproximação conservadora; textos curtos e paráfrases podem escapar e documentos parecidos podem ser agrupados em excesso.

## Large Source Handling

CSV/TSV pode ser baixado até o teto transitório configurado (8 MiB nos inputs), sempre dentro do total. Só header + linhas com termos de candidatos são retidos. fullBytes/fullSha256, regra, termos e contagem de linhas ficam em metadata.partial. Offsets de evidence referem-se ao snapshot parcial retido, não ao payload completo. Fórmulas não são executadas nem tratadas como números. Mock CSV e TSV verificam o fluxo, hash e limites. Não há truncamento genérico de HTML grande nem alegação de êxito real de large ingestion sem partial source registrado.

## Language/JS/PDF Diagnostics

EN/PT são os idiomas de extração suportados. Snapshot com idioma explicitamente não suportado pode permanecer REJECT no grafo, sem facts. HTML estático compacto com dados é aceito; empty HTML, necessidade de JS e anti-bot recebem diagnósticos separados. PDF é referência não ingerida: os diagnósticos TEXT_REQUIRED/TABLE_REQUIRED/SCANNED_UNKNOWN são pistas do contexto do link, não inspeção do PDF. Nenhum bypass ou execução de JS.

## Research Loop v3

R0 broad discovery; R1 expansão; R2 verificação; R3 referências e links de publisher; R4 corroboração independente; R5 repetição limitada das lacunas. R5 não é um enum de provider separado. Mock testa caminho com ranking válido e caminho bloqueado sem quinto inventado. Limites globais, estágios, domínios, timeout, bytes e tarefas permanecem ativos. Os dois benchmarks foram executados via CLI live, sem fixture providers.

## Task Priority

Value of information favorece entidade próxima do quorum, depois lacunas acionáveis de métrica/presença e descoberta. Empates têm ordenação determinística. A priorização melhora a ordem de trabalho; não prova disponibilidade de fontes independentes.

## Cold Places Benchmark

Tópico: “Os cinco lugares mais frios onde pessoas vivem permanentemente.” TEMPERATURE + MINIMUM_RECORDED + PERMANENT_POPULATION, quorum 2 e exceções HIGH preservadas. Scope SESSION_CANDIDATES; nenhum superlativo mundial exaustivo estabelecido.

Live final: 12 queries, 34 resultados, 32 fontes aceitas, 5 SUPPORTED, 0 CORROBORATED e 4 CONFLICTED. Apenas 1 dos fatos admitidos é MINIMUM_RECORDED; os demais qualificadores não contam para o ranking. Writer: RESEARCH_INCOMPLETE.

| Gate | Resultado | Evidência |
|---|---|---|
| R1 | PASS | 7 source-backed place candidates relevant to measurement/presence; 9 raw place candidates |
| R2 | PASS | 6 official/institutional evidence items with inherited document context |
| R3 | FAIL | 0 identical canonical facts changed from INSUFFICIENT to admitted; new station identities do not count |
| R4 | FAIL | 0 eligible |
| R5 | FAIL | 0 eligible |
| R6 | FAIL | 0 eligible |

R3 é estrito: compara o mesmo ID de fato canônico com Phase21 e v2 sobre os snapshots atuais. Novas identidades de estação não são apresentadas como transição do antigo fato do settlement. O runtime R3_ADMITTED_FACT indica apenas existência de fato admitido; o resultado oficial desta fase usa a auditoria estrita.

Tentativas anteriores foram preservadas em `attempts/`: a primeira continha uma média de extremos classificada como mínimo e seu replay corretamente falhou após a correção. Uma nova coleta expôs duplicação de final URL/hash e falhou antes de salvar sessão final. Regressões foram adicionadas, guards corrigidos e ambas as coletas refeitas. Somente os logs finais abaixo sustentam os números deste relatório.

## Cold Entity Eligibility

**0/5; RANKING_INCOMPLETE**. Não foram inventados itens nem substituídos mínimos por médias. O principal bloqueio do candidato próximo da elegibilidade é o suporte independente para população permanente; outros candidatos ainda carecem de medição/presença compatíveis. Estações isoladas não são assentamentos.

| Entidade | Elegível | Diagnóstico |
|---|---|---|
| Australia | False | TEMPERATURE_AUTHORITY: INSUFFICIENT 1/2 independent origin roots \| TEMPERATURE_CORROBORATION: 1 independent origin root(s) \| RESIDENCY_CURRENTNESS: RESIDENCY_HISTORICAL past-tense presence \| RESIDENCY_CORROBORATION: INSUFFICIENT 1/2 independent origin roots \| METRIC_COMPARABILITY: Missing temporal anchor |
| Caçador | False | TEMPERATURE_AUTHORITY: INSUFFICIENT 1/2 independent origin roots \| TEMPERATURE_CORROBORATION: 1 independent origin root(s) \| RESIDENCY: No presence evidence \| RESIDENCY_CURRENTNESS: n/a \| RESIDENCY_CORROBORATION: n/a |
| Chapecó | False | TEMPERATURE: Only incompatible measurement contexts \| TEMPERATURE_AUTHORITY: n/a \| TEMPERATURE_CORROBORATION: n/a \| RESIDENCY: No presence evidence \| RESIDENCY_CURRENTNESS: n/a \| RESIDENCY_CORROBORATION: n/a \| METRIC_COMPARABILITY: n/a |
| Eureka | False | TEMPERATURE_AUTHORITY: INSUFFICIENT 1/2 independent origin roots \| TEMPERATURE_CORROBORATION: 1 independent origin root(s) \| RESIDENCY: Only incompatible presence: RESEARCH_STAFF \| RESIDENCY_CURRENTNESS: n/a \| RESIDENCY_CORROBORATION: n/a |
| Grise Fiord | False | TEMPERATURE_AUTHORITY: INSUFFICIENT 1/2 independent origin roots \| TEMPERATURE_CORROBORATION: 1 independent origin root(s) \| RESIDENCY_CORROBORATION: INSUFFICIENT 1/2 independent origin roots |
| Highest heat index | False | TEMPERATURE: Only incompatible measurement contexts \| TEMPERATURE_AUTHORITY: n/a \| TEMPERATURE_CORROBORATION: n/a \| RESIDENCY: No presence evidence \| RESIDENCY_CURRENTNESS: n/a \| RESIDENCY_CORROBORATION: n/a \| METRIC_COMPARABILITY: n/a |
| Liawenee | False | RESIDENCY_CORROBORATION: INSUFFICIENT 1/2 independent origin roots |
| Oymyakon | False | TEMPERATURE_AUTHORITY: INSUFFICIENT 1/2 independent origin roots \| TEMPERATURE_CORROBORATION: 1 independent origin root(s) \| RESIDENCY_CORROBORATION: INSUFFICIENT 1/2 independent origin roots |
| Pevek | False | TEMPERATURE_AUTHORITY: INSUFFICIENT 1/2 independent origin roots \| TEMPERATURE_CORROBORATION: 1 independent origin root(s) \| RESIDENCY_CURRENTNESS: RESIDENCY_HISTORICAL past-tense presence \| RESIDENCY_CORROBORATION: INSUFFICIENT 1/2 independent origin roots \| METRIC_COMPARABILITY: Missing temporal anchor |

Checklist por entidade: [review/cold-eligibility.md](out/engine3d/phase22/review/cold-eligibility.md).

## Phase20/21/22 Comparison

| Fase | Fontes | Domínios fetched | Primárias | SUPPORTED | CORROBORATED | Elegíveis | Resultado |
|---|---|---|---|---|---|---|---|
| phase20 | 5 | 1 | 0 | 0 | 0 | 0 | REAL_RESEARCH_BLOCKED |
| phase21 | 16 | 12 | 0 | 0 | 0 | 0 | REAL_RESEARCH_BLOCKED |
| phase22 | 32 | 10 | 6 | 5 | 0 | 0 | REAL_RESEARCH_PARTIAL |

São observações live distintas, com orçamento, tempo e disponibilidade de rede próprios. Não é um teste A/B de corpus idêntico. O contrafactual v2 sobre snapshots v3 está identificado como análise offline separada e não como benchmark real. Dados: [analysis/benchmark-comparison.json](out/engine3d/phase22/analysis/benchmark-comparison.json).

## Second Real Benchmark

Reutilizado o tópico de população recenseada da Phase21. Live final: 10 queries, 11 fontes, 256 GroundedFacts candidatos, 0 SUPPORTED, 0 CORROBORATED; **REAL_RESEARCH_BLOCKED**, Writer RESEARCH_INCOMPLETE. Quantidades de população não implicam população permanente. Uma única origem e lacunas de fontes/formatos continuam insuficientes para admissão. A generalização do parser foi exercitada, mas a readiness real não foi demonstrada. Writer v2 não foi implementado; QUANTITY realization permanece limitação posterior e não foi contornada.

## Source Gaps

Contagens finais por benchmark:

| Benchmark | Código | Quantidade |
|---|---|---|
| Cold | CORROBORATION_GAP | 24 |
| Cold | EMPTY_STATIC_HTML | 2 |
| Cold | PDF_SCANNED_UNKNOWN | 2 |
| Cold | PDF_TEXT_REQUIRED | 1 |
| Cold | PRIMARY_SOURCE_DISCOVERED_BUT_PDF_UNSUPPORTED | 1 |
| Cold | SOURCE_DISCOVERY_GAP | 1 |
| Cold | SOURCE_FETCH_GAP | 5 |
| Cold | SOURCE_FORMAT_GAP | 2 |
| Cold | UNSUPPORTED_LANGUAGE | 1 |
| Population | CORROBORATION_GAP | 256 |
| Population | JS_RENDER_REQUIRED | 1 |
| Population | SOURCE_DISCOVERY_GAP | 4 |
| Population | SOURCE_FETCH_GAP | 4 |
| Population | UNSUPPORTED_LANGUAGE | 2 |

Disponibilidade, robots, HTTP, idioma, formato e descoberta são lacunas diferentes de falta de corroboração. Os diagnósticos originais permanecem nas sessões e JSONs `source-gaps/`. Não houve scraping de Google/Bing nem bypass de challenge.

## Extraction Gaps

Documentos baixados podem falhar por contexto ambíguo, subject coletivo, qualifier/estrutura não suportada ou ausência de relação estação/local. Falsos candidatos de labels ainda aparecem como ruído na pool bruta. Não houve parser universal ou imputação. JSONs `extraction-gaps/` e reviews preservam cada caso; fatos conflicted permanecem não utilizáveis.

## Replay

**PASS, ZERO NETWORK (0 chamadas).** As duas sessões v3 finais reconstroem pool/tasks, contextos, records, EntityGraph, publishers/authority, SourceGraph, EVs, GroundedFacts, ranking e writer, com fingerprints iguais. Script/plano são N/A quando o writer não os produz; não se alega replay de um MP4 inexistente. Também foram rederivados nove packs históricos e replayadas quatro sessões Phase20/21.

HTTP/request/get, HTTPS/request/get, fetch, DNS e transport foram substituídos por falha contadora na auditoria. Mismatch de sessão, conteúdo da pool e fingerprints gera erro. Prova: [analysis/replay-verification.json](out/engine3d/phase22/analysis/replay-verification.json).

## Security

PASS nos testes e na auditoria. Preservados SSRF público-only, todas as respostas DNS públicas, socket pinning, redirects revalidados, robots, MIME/charset, limites de streaming/tamanho/tempo/query/fetch e budgets individuais. Publisher links usam a mesma fronteira. Nenhum PDF, fórmula, HTML ativo ou JS é executado. Conteúdo externo em reviews é escapado. Segurança de transporte não certifica autenticidade do publisher nem a verdade de uma afirmação. [analysis/security.json](out/engine3d/phase22/analysis/security.json).

## Anti-hardcode

**PASS**, 273 arquivos examinados e zero BLOCKER. Scan cobre subjects, valores, URLs/domínios finais e referências, publisher names, station names e ordem do ranking. Regras/endpoints genéricos de providers, coincidências pré-checkpoint, documentação e quantidades fictícias de testes são classificados explicitamente, com todos os achados preservados. Snapshots/cache/sessões são outputs adquiridos, nunca seeds. [analysis/anti-hardcode.json](out/engine3d/phase22/analysis/anti-hardcode.json).

## Determinism

Mesmo snapshot/policy gera os mesmos fingerprints; ordenação reversa e variantes de caixa têm regressões. Relógio/rede só pertencem à aquisição, não ao render. Replays comparam conteúdo reconstruído e fingerprints, sem copiar conclusões como fallback. Nenhum relógio ou aleatoriedade foi adicionado ao pipeline de render.

## Performance

| Benchmark | Wall live ms | Bytes rede | Replay CPU/wall ms |
|---|---|---|---|
| Cold | 215516 | 13760248 | 28708 |
| Population | 60319 | 7165774 | 7241 |

Network/fetch/search têm tempos próprios e parcialmente sobrepostos; não são somados ao wall total. Replays foram medidos isoladamente sem rede. Rebuilds de packs e comparação de prose têm custo relevante nos budgets máximos; não houve otimização que alterasse factual safety. Métricas e tempos por comando em [analysis/metrics.json](out/engine3d/phase22/analysis/metrics.json) e [analysis/checks.json](out/engine3d/phase22/analysis/checks.json).

## Tests

**76/76 v3 PASS; 764 testes únicos na suíte completa; 16/16 comandos obrigatórios PASS.** 688 testes anteriores + 76 v3. Research v1/web/v2/v3 totalizam 278 testes; as execuções individuais abaixo repetem testes da suíte completa, não aumentam a contagem única. Fixtures v3 usam identidades fictícias e providers mockados, sem rede.

| Comando | Exit | Testes | Segundos |
|---|---|---|---|
| npm run typecheck | 0 | — | 10.583 |
| npm run check:engine3d | 0 | 764 | 51.536 |
| npm run check:editorial | 0 | 46 | 1.628 |
| npm run check:sound | 0 | 35 | 3.152 |
| npm run check:visual | 0 | 37 | 25.829 |
| npm run check:motion | 0 | 30 | 3.122 |
| npm run check:demonstration | 0 | 30 | 3.06 |
| npm run check:autodirector | 0 | 23 | 3.194 |
| npm run check:semantics | 0 | 40 | 2.392 |
| npm run check:narrative | 0 | 35 | 9.036 |
| npm run check:writer | 0 | 32 | 30.229 |
| npm run check:research | 0 | 50 | 12.101 |
| npm run check:web-research | 0 | 115 | 3.165 |
| npm run check:research-v2 | 0 | 39 | 3.013 |
| npm run check:research-v3 | 0 | 76 | 3.094 |
| npm run engine3d:catalog | 0 | — | 1.622 |

Coverage inclui as 47 capacidades solicitadas, bugs do handoff, scripts/comments ignorados, provenance do bloco correto, guardas estatísticas e duplicação de snapshot via redirect. Testes históricos não foram editados. Helpers originais preservados.

## Registry

Engine3D **50** / SFX **8** / VISUAL **5**. Catálogo regenerado/validado pelo comando obrigatório. Nenhum asset ou capability novo. Os 12 MP4s históricos conservam seus SHA-256. package-lock e render engine não mudaram. [analysis/integrity.json](out/engine3d/phase22/analysis/integrity.json).

## Compatibility

V1/v2 continuam opt-out da v3. Nove packs e quatro sessões históricas rederivam/replayam de forma idêntica; schemas e writer/render legados mantidos. A alteração compartilhada de vocabulário rejeita uma classe estatística inválida sem alterar os artefatos históricos verificados. Dependências e versões intactas. Nenhum commit/push, remote novo, reset, clean ou force push nesta fase.

## Limitations

Sem descoberta exaustiva da web, confirmação universal de identidade, parser de PDF, renderer JS, tradução ampla, full-text de qualquer paper ou large-HTML truncation. Domínio registrável e near-copy são heurísticas. Records/semântica se limitam a padrões literais testados. A pool pode reter ruído. Os benchmarks não demonstraram corroboração independente suficiente nem readiness de roteiro; Writer QUANTITY realization é uma limitação posterior. Dados volumosos de `out/` permanecem locais/ignorados pelo Git e devem ser copiados separadamente se necessários em outro PC.

## Honest Assessment

A Phase22 está concluída como implementação, hardening, testes, duas execuções reais e auditoria. R1/R2 demonstram candidatos e extração oficial por contexto; R3/R4/R5/R6 seguem conforme os resultados estritos acima. O objetivo STRONG (um Cold item elegível) **não foi atingido** com 0/5. Cinco SUPPORTED não significam cinco locais elegíveis, e médias não são substitutos para mínimos. Não foi gerado roteiro ou vídeo para preencher lacunas.

## Autonomy Level

**LEVEL4C mantido.** Há capacidade nova demonstrada de extração por contexto e publisher assessment, mas os benchmarks ainda exigem fontes independentes e não chegam à readiness. Não houve promoção automática para LEVEL4C+ ou LEVEL5.

## Next Recommendation

Uma única recomendação para Phase23: melhorar a aquisição e a corroboração independente orientada às lacunas de população permanente e mínimo registrado, com provenance por fato e o mesmo quorum. Não iniciar Writer v2, assets ou render para contornar research incompleta. **Phase23 não iniciada. PARAR aqui.**

Artefatos principais: [analysis/final-status.json](out/engine3d/phase22/analysis/final-status.json), [analysis/mandatory-answers.json](out/engine3d/phase22/analysis/mandatory-answers.json), [analysis/replay-verification.json](out/engine3d/phase22/analysis/replay-verification.json), [analysis/checks.json](out/engine3d/phase22/analysis/checks.json). As nove reviews consolidadas ficam em `out/engine3d/phase22/review/`; snapshots, fontes, EvidencePack, source/entity graphs, contexts, records, publishers, authority, pools, tasks, eligibility e fingerprints permanecem nos diretórios correspondentes.
