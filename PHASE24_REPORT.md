# Phase 24 — Topic Intelligence, Content Intent, Claim Risk & Adaptive Research Routing — Final report

Data: 2026-10-28. Base `main` @ `a76e0c19ddf79b7a4025c2450474a77f585b3a7e` (Phase23), sem commit/push; alterações no working tree.

## Objective

**PHASE24 COMPLETE: YES — implementation gate PASS.** Camada determinística, auditável e opt-in (`topicPlanningVersion: 1`) entre o tópico do usuário e Research/Writer: classifica intenção, modo de conteúdo, perfil epistêmico, famílias de claims e risco; roteia Research e Writer sem relaxar nenhuma salvaguarda. Nenhuma pesquisa live foi executada; Research v4 e os resultados da Phase23 não foram alterados.

## Starting State

HEAD verificado igual a `a76e0c1`, árvore limpa. Lidos CLONAI_HANDOFF, PHASE21/22/23_REPORT. Auditados `src/writer/{contracts,request,topic,fact-policy,index,grounded,strategies}`, `src/semantics/{normalize,predicates,contracts,narrative-contracts}`, `src/research/{request,planner,pack,contracts}`, `src/research/v4/*`, `web/{provider,output}`, ferramentas anti-hardcode Phase23. Baseline fresca: **17/17 comandos PASS, 829 testes únicos** ([checks-baseline.tsv](out/engine3d/phase24/analysis/checks-baseline.tsv)).

Achados da auditoria que moldaram o desenho: o Writer Phase18 conhece apenas famílias TRANSFER/ACCUMULATION e marca demais tópicos como `SOURCE_REQUIRED`; `UNVERIFIED_CREATIVE` está reservado/recusado; `ResearchRequest` rejeita campos desconhecidos (portanto a integração deve ser por adaptador); `modalityOf` da Phase16 já trata `poderia`/`se` inicial.

## Architecture

Novo módulo `src/topic/` (8 arquivos, sem dependências novas):

| Arquivo | Papel |
|---|---|
| `contracts.ts` | Tipos: ContentIntent, ContentMode, EpistemicMode, ClaimRisk, ResearchRequirementLevel, ClaimFamily, TopicAnalysis, ClaimRequirementProfile, ResearchRoute, WriterRoute, VisualPlanningHint, TopicPlan |
| `signals.ts` | Tabelas fechadas PT/EN de sinais linguísticos + léxicos genéricos de domínio + dimensões de superlativo |
| `analyze.ts` | `topicView` (fold com offsets), sinais com spans, intents, modo, perfis factual/comparação/temporal/criativo |
| `claims.ts` | Famílias esperadas e tabela de requisitos/risco; nível de pesquisa |
| `routing.ts` | ResearchRouter, WriterRouter, dicas visuais (arcs existentes) |
| `plan.ts` | Validação, overrides seguros, `structuralSignature`, fingerprint, replay/verify |
| `integration.ts` | Adaptadores opt-in: request de Research, comparação de política, gate do Writer, derivação de request do Writer, metadados de Semantic Claim |

Fluxo: `TopicPlanningRequest` → `buildTopicPlan` → (opcional) `buildRoutedResearchRequest` → Research existente → `topicWriterGate` → `deriveWriterRequest` → Writer existente.

## Topic Analysis

`TopicAnalysis` contém topic, normalizedTopic, language, primaryIntent, secondaryIntents, contentMode, factualityProfile, comparisonProfile, temporalProfile, creativeProfile, expectedClaimFamilies, researchRequirement, writerRequirement, riskFlags, reasonCodes, interpretations e `signals` (id, feature, span exato no texto bruto). Normalização: NFD sem marcas, minúsculas, pontuação colapsada, offsets preservados. Topic nunca é Evidence (`topicIsEvidence: false`). [review/topic-intelligence.md](out/engine3d/phase24/review/topic-intelligence.md).

## Content Intent

17 intents, todas alcançáveis por frases genéricas (teste dedicado). Primary por prioridade fixa; todas as intents detectadas ficam em `secondaryIntents`. Tópicos nus ambíguos ("Marte", "Napoleão", "Buracos negros", "Água") → UNKNOWN com `interpretations`. [review/content-intents.md](out/engine3d/phase24/review/content-intents.md).

## Content Mode & Epistemic Mode

Oito modos (FACTUAL … UNKNOWN), todos testados. EpistemicMode por plano e por claim: FACTUAL, STRUCTURAL, SUPPORTED_INFERENCE, HYPOTHETICAL, CREATIVE, UNKNOWN. HYBRID mantém separação explícita (`epistemicSeparation: true`).

## Claim Requirements & Risk

Tabela única `REQUIREMENT_TABLE`: RANKING_ORDER CRITICAL; MEASUREMENT/RESIDENCY/QUANTITY/COMPARISON/MYTH/PERSON HIGH (corroboração 2); mecanismos/definições/história MEDIUM (grounded 1); STRUCTURAL_STEP, HYPOTHETICAL_PREMISE, SETTING_FACT, FICTIONAL_EVENT LOW sem evidência obrigatória e sem FactGap. Nível = máximo de risco com evidência obrigatória (CRITICAL→STRICT, HIGH→HEAVY, MEDIUM→STANDARD, opcional→LIGHT, nada→NONE); UNKNOWN nunca abaixo de STANDARD. [review/claim-risk.md](out/engine3d/phase24/review/claim-risk.md).

## Research Routing

Roteador puro; níveis só adicionam quorum (HEAVY/STRICT = 2 origens; factTypeQuorum 2 para medidas/residência/quantidades). Nunca emite `singleOriginAuthority`. Falha explícita antes da pesquisa: ranking sem métrica modelada, residência sem critério. Ficção, premissas e passos estruturais vão para `excludedFamilies`. [review/research-routing.md](out/engine3d/phase24/review/research-routing.md).

## Writer Routing

`topicWriterGate`: STRICT exige ranking VALID + RESEARCH_READY + estado READY; HEAVY/STANDARD exigem pesquisa READY; CREATIVE/HYBRID → CREATIVE_UNAVAILABLE (ficção dispensa Evidence, mas não há Writer criativo); UNKNOWN → CLARIFY. `deriveWriterRequest` impõe tópico e factPolicy do plano. Writer não modificado. [review/writer-routing.md](out/engine3d/phase24/review/writer-routing.md).

## Hypothetical & Fiction

Premissa hipotética preservada literalmente e nunca afirmada (`asserted: false`), excluída da pesquisa; consequências como SUPPORTED_INFERENCE sobre premissas grounded. Eventos ficcionais nunca viram FactGap, EvidenceRequirement ou STRICT; âncoras reais em ficção viram SETTING_FACT opcional (LIGHT). [review/hypothetical-fiction-boundary.md](out/engine3d/phase24/review/hypothetical-fiction-boundary.md).

## Visual Planning Hints

Dicas (RANKED_ORDER, PROCESS_DIAGRAM, CAUSE_CHAIN, TIMELINE, COUNTERFACTUAL_BEFORE_AFTER, SCENE, …) apontam apenas para arcs já existentes do Writer e expectativas de prova. Nenhum asset, capability Engine3D ou render novo; catálogo 50 entradas inalterado.

## Overrides

Validados, registrados (`OverrideRecord` com requested/computed/applied/reason) e exigem `reason`. Só podem apertar: nível de pesquisa não pode baixar; FACTUAL→CREATIVE rejeitado; UNKNOWN→modo factual (clarificação) e CREATIVE→HYBRID permitidos; rota do Writer só para mais estrita ou CLARIFICATION. Inseguros → `TOPIC_OVERRIDE_UNSAFE`.

## TopicPlan, Fingerprint & Replay

Plano serializável com `structuralSignature` (equivalência estrutural) e `fingerprint` (SHA-256 canônico). `verifyTopicPlan` reconstrói o plano a partir do próprio request: 24/24 planos de benchmark válidos após round-trip JSON; adulteração sem re-assinar → FINGERPRINT_MISMATCH; adulteração re-assinada → REPLAY_MISMATCH:researchRoute. Adaptadores recusam plano inválido. [replay/replay.json](out/engine3d/phase24/replay/replay.json).

## Integration

Somente `package.json` alterado fora de arquivos novos. Integrações reais **offline** (nenhuma pesquisa live):
1. **Cold (Phase23)**: request roteado vs request operador da Phase23 → `notRelaxed: true`, 0 diffs; gate sobre o resultado registrado (REAL_RESEARCH_PARTIAL / RANKING_INCOMPLETE / RESEARCH_INCOMPLETE) → **BLOCKED**. Research v4 não re-executada.
2. **População (Phase23)**: inicialmente roteada como LOCATION (relaxaria quorum) — defeito real encontrado e corrigido com pistas genéricas de quantidade/censo; após correção HEAVY/QUANTITY/POPULATION, `notRelaxed: true`.
3. **Fixture de processo**: tópico → request roteado → `buildEvidencePack` RESEARCH_READY → gate PROCEED_GROUNDED → `writeGroundedTopic` PRODUCTION_ELIGIBLE (fixture fictício, não fatos reais).

Semantic Claim stage: `annotateSemanticClaims` reutiliza modality/negation/role da Phase16. [review/integration.md](out/engine3d/phase24/review/integration.md).

## Benchmarks

| # | Tópico | Primary | Secondary | Modo | Pesquisa | Writer | Goal | Esperado | Resultado |
|---|---|---|---|---|---|---|---|---|---|
| A | Os cinco lugares mais frios onde pessoas vivem permanentemente. | RANKING | GEOGRAPHIC | FACTUAL_RANKING | STRICT (v4, 2 origens) | GROUNDED_ONLY, BLOCKED no estado Phase23 | RANKING | FACTUAL_RANKING/RANKING/GEOGRAPHIC/STRICT/v4 | PASS |
| B | Como funciona um poço artesiano? | EXPLANATION | PROCESS, TECHNICAL | FACTUAL_EXPLANATORY | STANDARD | GROUNDED_ONLY | PROCESS | EXPLANATION/PROCESS/TECHNICAL, STANDARD | PASS |
| C | Por que o céu é azul? | EXPLANATION | SCIENTIFIC, CAUSE_EFFECT | FACTUAL_EXPLANATORY | STANDARD | GROUNDED_ONLY | PROCESS | EXPLANATION/SCIENTIFIC/CAUSE_EFFECT | PASS |
| D | Como começou a corrida espacial? | HISTORICAL | SCIENTIFIC (contexto; sem família) | FACTUAL | STANDARD | GROUNDED_ONLY | FACTS | HISTORICAL | PASS |
| E | Como os polvos mudam de cor? | PROCESS | SCIENTIFIC, BIOLOGICAL, CAUSE_EFFECT | FACTUAL_EXPLANATORY | STANDARD | GROUNDED_ONLY | PROCESS | BIOLOGICAL/SCIENTIFIC/PROCESS/CAUSE_EFFECT | PASS |
| F | Como funciona um motor a jato? | EXPLANATION | PROCESS, TECHNICAL | FACTUAL_EXPLANATORY | STANDARD | GROUNDED_ONLY | PROCESS | TECHNICAL/PROCESS/EXPLANATION | PASS |
| G | O que aconteceria se a Lua desaparecesse? | HYPOTHETICAL | SCIENTIFIC, CAUSE_EFFECT | FACTUAL_HYPOTHETICAL | STANDARD (premissa excluída) | GROUNDED_ONLY + separação | PROCESS | HYPOTHETICAL/SCIENTIFIC/CAUSE_EFFECT, FACTUAL_HYPOTHETICAL | PASS |
| H | Um astronauta acorda sozinho em Marte e encontra uma estrutura misteriosa. | NARRATIVE | FICTION, SCIENTIFIC (cenário) | CREATIVE | LIGHT (SETTING_FACT opcional) | CREATIVE_ISOLATED → CREATIVE_UNAVAILABLE | opcional | NARRATIVE/FICTION, CREATIVE, NONE/LIGHT | PASS |

Todos os benchmarks são classificação/roteamento; nenhuma pesquisa live nem roteiro/MP4 novo foi produzido para A–H.

Paráfrases/cross-topic/extras/ambíguos: **24/24** conforme expectativa; 7/7 pares de equivalência estrutural iguais. [analysis/benchmarks.json](out/engine3d/phase24/analysis/benchmarks.json), [review/multi-domain-generalization.md](out/engine3d/phase24/review/multi-domain-generalization.md).

## Anti-hardcode

**PASS — 288 arquivos, 0 BLOCKER.** Alvos: 10 tópicos de benchmark/paráfrase, 13 frases distintivas, acoplamento termo→rota na mesma linha em `src/`. Classificação: 30 TEST_OR_FIXTURE_ALLOWED, 22 BENCHMARK_HARNESS_ALLOWED (`tools/phase24/benchmarks.ts`), 14 PRE_PHASE24_UNCHANGED (requests de exemplo Cold anteriores e um regex legado em `src/writer/topic.ts` da Phase18 que *bloqueia* "poço artesiano" como mecanismo não fornecido — não é rota de suporte e não é usado pelo módulo novo), 7 GENERIC_DOMAIN_LEXICON_MEMBER (poço, céu, espacial, polvo(s), lua, marte como membros de léxicos com 43–98 alternativas). Controle negativo (arquivo injetado com frase de benchmark → rota) foi detectado como BLOCKER e removido. [analysis/anti-hardcode.json](out/engine3d/phase24/analysis/anti-hardcode.json), [analysis/anti-hardcode-negative-control.json](out/engine3d/phase24/analysis/anti-hardcode-negative-control.json).

## Determinism & Security

Construção do plano com `Date.now`, `Math.random`, `fetch`, `http(s).request` substituídos por funções que lançam erro: PASS. Topic Intelligence não busca URLs, não executa conteúdo, não interpreta o tópico como instrução (teste com instrução embutida), não contorna políticas de Research.

## Tests

`tests/topic-intelligence.test.ts`: **28/28 PASS**, sem internet; fixture `tests/fixtures/phase24/cold-phase23-reference.json` (request + resumo de estado, sem snapshots). Script `npm run check:topic-intelligence`.

**18/18 comandos PASS; 857 testes únicos (829 + 28).** [analysis/checks-final.tsv](out/engine3d/phase24/analysis/checks-final.tsv). Typecheck repetido após os scripts finais de auditoria: PASS.

| Comando | Exit | Testes | s |
|---|---|---|---|
| npm run typecheck | 0 | — | 17.5 |
| npm run check:engine3d | 0 | 857 | 63.3 |
| npm run check:editorial | 0 | 46 | 1.8 |
| npm run check:sound | 0 | 35 | 5.6 |
| npm run check:visual | 0 | 37 | 27.5 |
| npm run check:motion | 0 | 30 | 3.5 |
| npm run check:demonstration | 0 | 30 | 3.7 |
| npm run check:autodirector | 0 | 23 | 3.4 |
| npm run check:semantics | 0 | 40 | 2.9 |
| npm run check:narrative | 0 | 35 | 8.0 |
| npm run check:writer | 0 | 32 | 23.0 |
| npm run check:research | 0 | 50 | 12.6 |
| npm run check:web-research | 0 | 115 | 7.0 |
| npm run check:research-v2 | 0 | 39 | 5.9 |
| npm run check:research-v3 | 0 | 76 | 7.8 |
| npm run check:research-v4 | 0 | 65 | 6.4 |
| npm run check:topic-intelligence | 0 | 28 | 4.5 |
| npm run engine3d:catalog | 0 | — | 2.6 |

Implementation gates: **40/40 PASS**, cada um calculado a partir de um teste ou artefato ([analysis/implementation-gates.json](out/engine3d/phase24/analysis/implementation-gates.json)).

## Registry & Integrity

Engine3D **50** / SFX **8** / VISUAL **5** (catálogo validado). Nenhum módulo de Research/Writer/Semantics/Narrative/Engine3D/assets/package-lock tocado. Hashes da Phase23 (relatório, final-status, metrics, gates, logs) registrados e iguais aos anteriores. [analysis/integrity.json](out/engine3d/phase24/analysis/integrity.json).

## Compatibility

Opt-in estrito: sem `topicPlanningVersion: 1` o builder falha; `ResearchRequest` continua rejeitando campos ocultos; Writer, Research v1–v4 e Semantic sem alteração de comportamento. Testes históricos inalterados.

## Limitations

- Classificador léxico fechado, não compreensão semântica geral; domínio reconhecido apenas para membros dos léxicos; apenas PT/EN.
- Temporalidade aproximada (ex.: extinção sai TIMELESS).
- Criaturas fantásticas em perguntas "e se" são tratadas como hipótese factual (erro conservador).
- `MINIMUM_RECORDED` para "mais frios" é default de tabela (sinalizado).
- Writer criativo/híbrido não existe: rotas CREATIVE/HYBRID terminam em CREATIVE_UNAVAILABLE.
- Research atual extrai principalmente processos estruturais, medidas e residência; rotas STANDARD de ciência/biologia/tecnologia estão corretas, mas é provável que a pesquisa web real não consiga ground de mecanismos — o Writer ficaria bloqueado (seguro, porém sem produção).
- Request roteado cobre o núcleo de segurança, não os knobs operacionais (bytes, idioma, idade de residência, observation site).

## Honest Assessment

| Dimensão | Avaliação |
|---|---|
| INTENT CLASSIFICATION | GOOD |
| CONTENT MODE | GOOD |
| CLAIM RISK MODELING | GOOD |
| RESEARCH ROUTING SAFETY | STRONG |
| WRITER ROUTING | ACCEPTABLE |
| HYPOTHETICAL HANDLING | GOOD |
| FICTION ISOLATION | STRONG |
| MULTI-DOMAIN GENERALIZATION | ACCEPTABLE |
| PARAPHRASE ROBUSTNESS | ACCEPTABLE |
| DETERMINISM / REPLAY | STRONG |
| INTEGRATION DEPTH | ACCEPTABLE |
| END-TO-END PRODUCTION FOR NEW DOMAINS | WEAK |
| OVERALL AUTONOMY | ACCEPTABLE |

O sistema agora sabe *o que* um tópico pede e *quanto* rigor ele exige, e falha fechado. Ele não aumenta a capacidade de produzir vídeos factuais em novos domínios: isso depende de extração de Research e de um Writer além do escopo desta fase.

## Autonomy Level

**LEVEL4C** mantido. Topic Intelligence funciona, mas não houve ganho de produção real (Cold continua 0/5, RANKING_INCOMPLETE; nenhum novo domínio chegou a roteiro real). Não LEVEL5.

## Next Recommendation

Uma recomendação: extração grounded de mecanismos/causalidade (PROCESS/RELATION) em fontes reais para as rotas STANDARD que o roteador já identifica, medindo quantas chegam a RESEARCH_READY sem relaxar quorum. **Phase25 não iniciada; sem commit/push. PARAR.**

Artefatos: `out/engine3d/phase24/{inputs,topic-analysis,topic-plans,claim-requirements,routes,benchmarks,integration,replay,analysis,review,logs}` (locais, ignorados pelo Git).
