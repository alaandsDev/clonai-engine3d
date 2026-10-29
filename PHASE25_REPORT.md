# Phase 25 — Autonomous Generalist Vertical Slice — Final report

Data: 2026-10-29. Base `main` @ `14bf67b5616cae7862f3eaa63415b954f6343346` (Phase24). Sem commit/push; alterações no working tree.

## Objective

Executar o pipeline real de ponta a ponta com um tópico novo (não Cold), registrar onde parava, corrigir só o primeiro gargalo observado de forma generalizável e repetir. **Resultado: VERTICAL SLICE FINISHED.** "Como funciona um poço artesiano?" atravessou os 17 stages a partir apenas do tópico, com pesquisa web live, Writer grounded, Semantic Engine, Auto Director, Engine3D, edge-tts e render Remotion, produzindo um MP4 validado de 48,03 s. Qualidade: honesta e compreensível, porém rasa e abstrata (ver Honest Assessment).

## Starting State

HEAD verificado `14bf67b`, árvore limpa. Lidos CLONAI_HANDOFF e os relatórios 22/23/24; consultados 17–20 (paths de render script-only, topic→script e grounded). Auditados `src/topic`, Writer grounded, Research v1–v4 (`queries`, `extractor`, `v2`, `pack`, `grounding`), Semantic Engine (`rules`, `narrative-claims`), Narrative/Auto Director (`templates`, `qa`), Engine3D directed, áudio (`narration`, mixer) e os harnesses de render das Fases 18/19 (que viviam só em `out/`, fora do Git).

## Phase24 Baseline

Regressão herdada: 18/18 comandos, 857 testes, registro 50/8/5, Topic Intelligence 28/28.

## Vertical Slice Method

`src/vertical/trace.ts` define `VerticalSliceTrace` com 17 stages (TOPIC_ANALYSIS … MP4_VALIDATION), estados NOT_STARTED/RUNNING/PASS/PARTIAL/BLOCKED/FAILED/SKIPPED, fingerprints de entrada/saída, motivo de bloqueio obrigatório, diagnósticos e artefatos. Timestamps são metadado e não entram no fingerprint. Ordem estrita: um stage só começa após os anteriores passarem; após BLOCKED/FAILED os seguintes ficam SKIPPED. `src/vertical/run.ts` só chama stages existentes; pesquisa e mídia são injetadas. `cli/vertical-slice.ts` (npm `vertical:run`) recebe **apenas o tópico**; `VS_FROM_SESSION` reprocessa uma sessão live gravada (integridade verificada, zero rede) para iterar a jusante sem nova coleta.

## Baseline Run

Antes de qualquer correção (só instrumentação adicionada): TOPIC_ANALYSIS PASS (EXPLANATION + PROCESS + TECHNICAL, FACTUAL_EXPLANATORY, STANDARD — sem ajuste), RESEARCH_ROUTING PASS (PROCESS, v4), **RESEARCH BLOCKED**. [out/engine3d/phase25/baseline/](out/engine3d/phase25/baseline/), [review/baseline.md](out/engine3d/phase25/review/baseline.md).

## First Blocker

**RESEARCH / discovery**: 2 queries e 0 resultados. A pergunta inteira em português foi enviada à busca da Wikipedia em inglês, e o planner legado anexou "minimum recorded temperature" a um tópico não-ranking.

## Attempts

| Attempt | First Blocking Stage | Reason | Generalizable Change | Tests Added | New Stage Reached | Result |
|---|---|---|---|---|---|---|
| 1 baseline (live) | RESEARCH | 0 resultados (pergunta PT em corpus EN + termos de temperatura) | assunto do tópico via spans de Topic Intelligence; queries de rota PROCESS; corpus no idioma do tópico | queries PROCESS/Cold/FACTS | RESEARCH (fetch) | 8 resultados |
| 2 attempt-1 (live) | RESEARCH | 0 fontes aceitas (limite default 64 KB) | knobs de capacidade no request roteado | e2e fixture | RESEARCH PASS | 5 fontes |
| 3 attempt-2 (live) | EVIDENCE | 0 evidências: sem extração de mecanismo em prosa | `src/research/mechanism.ts` (gramática fechada pt-BR, só PROCESS, tópico por título, spans exatos) | grammar, readiness, route-aware | EVIDENCE PASS | 3 SUPPORTED, READY |
| 4 attempt-3 (live) | WRITER | tuplas de mecanismo não realizáveis | realização com superfície da fonte, editorial de processo, plurais, ordem estável | writer process route, plural | WRITER PASS | 111 palavras |
| 5 attempt-4 (live) | SCRIPT | bug do runner (contagem de palavras) | runner versionado + reprocessamento | trace | SCRIPT PASS | — |
| 6 attempt-4 reprocess | NARRATIVE | definição/causa AMBIGUOUS → gaps | explicações não-físicas grounded, prova NONE declarada | semantics | ENGINE3D | plano FULL |
| 7 attempt-5 (QA pré-render) | VISUAL_DEMONSTRATION | fluxo desenhado para baixo vs "para a superfície" | tag `upward` por destino espacial | semantics upward | ENGINE3D | caminho ascendente |
| 8 attempt-7 (mídia) | — (QA: origem cortada) | reframe cortava a origem por ~34 s | mídia versionada (`src/vertical/media.ts`); reframe recuado | e2e camera | MP4_VALIDATION | 17/17 |
| 9 final (live, nova coleta) | — | — | — | — | MP4_VALIDATION | 17/17, MP4 final |

Detalhes: [attempts/attempts.json](out/engine3d/phase25/attempts/attempts.json), [review/vertical-slice-attempts.md](out/engine3d/phase25/review/vertical-slice-attempts.md).

## Pipeline (execução final live)

| Stage | Status | Input | Output | Fingerprint | Blocking Reason |
|---|---|---|---|---|---|
| TOPIC_ANALYSIS | PASS | tópico | TopicPlan | `a6f8224c72b0474c` | — |
| RESEARCH_ROUTING | PASS | TopicPlan | ResearchRequest PROCESS v4 | `cee6f463ff7ca6f0` | — |
| RESEARCH | PASS | ResearchRequest | sessão live (5 fontes) | `df04bf1a1f910a2f` | — |
| EVIDENCE | PASS | sessão | EvidencePack READY (3 fatos) | `5ed03d408c3177bd` | — |
| WRITER | PASS | EvidencePack | writer PRODUCTION_ELIGIBLE | `3adf034abef0734f` | — |
| SCRIPT | PASS | writer | roteiro 111 palavras | `70c4023ef0253cdf` | — |
| SEMANTICS | PASS | roteiro | grafo (8 claims) | `8816def9d6b3cd86` | — |
| NARRATIVE | PASS | grafo | plano FULL | `af0fbd2e4976f262` | — |
| AUTO_DIRECTION | PASS | plano | compilado (1 item) | `2c1e4fd47b5e3d8d` | — |
| VISUAL_DEMONSTRATION | PASS | compilado | matriz 1 DIRECT / 2 NONE | `482f523ddf960970` | — |
| DIRECTED_SEQUENCE | PASS | compilado | 1 DirectedSequence | `56a9a7f25f34f669` | — |
| ENGINE3D | PASS | sequência | estados avaliados | `62537be8283828f5` | — |
| VOICE | PASS | writer | 8 faixas edge-tts + finalização | `445f9ec138265f63` | — |
| EDITORIAL | PASS | finalização | 40 legendas, sem SFX | `c75612fd804640ed` | — |
| COMPOSITION | PASS | sequência final | PCM de voz | `bf8b8a339d89567e` | — |
| RENDER | PASS | sequência + PCM | final.mp4 | `c61a07ec441ac713` | — |
| MP4_VALIDATION | PASS | final.mp4 | manifesto + SHA-256 | `c61a07ec441ac713` | — |

A coluna Fingerprint é o hash canônico da saída de cada stage (por isso RENDER/MP4_VALIDATION mostram o hash do SHA-256 do MP4, não o SHA-256 em si). Trace fingerprint `6ddda91a738af92df4155b098f1eb1c4186693bbf3b35fddf9d226e9f5183d24`. [final/trace.json](out/engine3d/phase25/final/trace.json).

## Changes Introduced

| Arquivo | Mudança |
|---|---|
| `src/vertical/{trace,run,config,media,provenance}.ts`, `cli/vertical-slice.ts` | trace, orquestrador, orçamento web genérico, stages de mídia (portados do harness Phase19), proveniência |
| `src/topic/subject.ts`, `src/topic/integration.ts`, `src/topic/signals.ts` | assunto do tópico; capacidade no request roteado; léxico `barragem` corrigido |
| `src/research/web/queries.ts` | queries de rota PROCESS (ranking/FACTS intocados) |
| `src/research/mechanism.ts`, `src/research/v2.ts`, `src/research/contracts.ts` | extrator de mecanismo; relevância de fatos de mecanismo em rota PROCESS; método `MECHANISM_PT_V1` |
| `src/research/grounding.ts`, `src/writer/grounded.ts` | realização de mecanismo, editorial de processo, reconciliação de explicação não-física, linhas NONE na matriz, ordem por fim de span |
| `src/semantics/rules.ts`, `src/semantics/narrative-claims.ts` | plurais; explicação não-física; `upward` por destino |
| `src/autodirector/templates.ts` | reframe de consequência recuado (alvo inalterado) |
| `tests/vertical-slice.test.ts`, `package.json` | 15 testes; `check:vertical-slice`, `vertical:run` |
| `tools/phase25/*` | replay, anti-hardcode, integridade, probes de desenvolvimento |

Nenhuma mudança em SecureHttpClient/fetcher/robots/cache, package-lock, assets, registro, Research v4 de ranking ou Topic Intelligence além do léxico.

## Research

Execução final live: 2 queries, 8 resultados, 6 fetches, 5 fontes aceitas, 1 bloqueada por tamanho, 1,25 MB, 12,1 s, `REAL_RESEARCH_READY` (`COVERAGE_STOP`). Provider MediaWiki REST público (pt.wikipedia), sem busca paga, scraping ou bypass. [review/research-readiness.md](out/engine3d/phase25/review/research-readiness.md).

## Evidence

3 fatos SUPPORTED de uma origem (quorum STANDARD = 1): DEFINITION ("Um poço artesiano é uma categoria de poço tubular"), PROCESS FLOW ("águas subterrâneas fluem espontaneamente para a superfície"), RELATION CAUSED_BY ("…devido à diferença de pressão"). 0 CORROBORATED. Spans exatos do snapshot (com marcação HTML do próprio snapshot). Quatro fontes fora do assunto não contribuíram.

## Writer

`PRODUCTION_ELIGIBLE`; 3 FACT + 5 editoriais fixos; 0 claims sem grounding, 0 drift. Nenhum texto específico de poço no Writer. [review/writer-readiness.md](out/engine3d/phase25/review/writer-readiness.md).

## Script

111 palavras, 8 frases, hook em segunda pessoa, causa/efeito, pergunta final. Sem número, profundidade, pressão quantificada, geologia, "sempre/nunca/maior/mais profundo". Texto em [final/script/script.txt](out/engine3d/phase25/final/script/script.txt).

## Semantics

Roteiro real em `analyzeNaturalScript`: 8 claims; 1 FACT físico (FLOW, RESOLVED, prova exigida); definição e causa como contexto não-físico; editoriais e perguntas sem prova. [review/semantic-coverage.md](out/engine3d/phase25/review/semantic-coverage.md).

## Narrative

Plano `FULL`, 1 ilha, 0 gaps localizados, timeline executável 100%, 1441 frames medidos.

## Auto Director

Plano produzido pelo Auto Director a partir das claims (nenhum DirectorPlan ou shot list manual); `productionReady` true.

## Visual Demonstration

Template existente de transferência de líquido; operações CONNECT, FLOW, INCREASE, DECREASE; layout ascendente derivado da frase. Prova: 1 DIRECT, 2 NONE (não-físicas). Nenhuma primitiva nova. [review/visual-demonstration.md](out/engine3d/phase25/review/visual-demonstration.md).

## DirectedSequence

1 sequência, 1 shot contínuo, 40 legendas, câmera push-in → reframe recuado; continuidade de objetos (origem, caminho e destino visíveis do início ao fim — teste).

## Engine3D

Avaliação de estados sem erro; nenhuma capability, recurso ou render engine novo.

## Voice

edge-tts `pt-BR-AntonioNeural`, +0%, +0 Hz; 8 unidades source-exact; duração medida 48,03 s (meta 40–60).

## Editorial

Legendas ≤3 palavras no terço inferior. **Sem SFX**: nenhuma aprovação existente cobre estes eventos; voz prioritária.

## Composition

Camadas: cena 3D DirectedSequence, legendas, voz; PCM inteiro por unidade narrativa, 0 frames de padding de arredondamento.

## Render

Remotion `DirectedSequence`, H.264 crf 20, mux AAC 192k; native render 57,5 s, wall 82,9 s.

## MP4

| Campo | Valor |
|---|---|
| Path | `out/engine3d/phase25/final/render/final.mp4` |
| SHA-256 | `c901c5a8c6b742fffe4f2d0d203920caa3454fb11a97d0393f853355f999e926` |
| Duração | 48,033 s |
| Resolução / fps | 480×854 / 30 (1441 frames) |
| Vídeo / áudio | H.264 / AAC 48 kHz estéreo |
| Tamanho | 1.413.357 bytes |
| Palavras do roteiro | 111 |
| Claims semânticas | 8 (1 física) |
| Shots | 1 |
| Prova visual | DIRECT 1, NONE 2 |
| Render | 57,5 s nativo / 82,9 s wall |
| Áudio QA | PASS (−21 LUFS integrado, true peak −6,8 dB) |

Decodificação completa sem erro; A/V dentro de 55 ms; metadados com EvidencePack e Writer fingerprints.

## Visual QA

ACCEPTABLE: nada cortado (após a correção), legendas legíveis, estado visível mudando; cena abstrata sem solo/superfície/pressão e sem rótulos, objetos pequenos, vazio no topo. [review/visual-qa.md](out/engine3d/phase25/review/visual-qa.md).

## Motion QA

CONNECT/FLOW/INCREASE/DECREASE mudam de estado (verificado por estado e por frames). Maior trecho sem mudança visual: **33,8 s**. [review/motion-qa.md](out/engine3d/phase25/review/motion-qa.md).

## Narrative QA

O fluxo acontece na frase do fluxo; definição e causa não puxam ações; nenhuma demonstração atrasada ou de claim anterior. Fraqueza: 34 s finais de narração editorial sobre cena estática.

## Secondary Generalization Probe

"Como funciona uma turbina hidráulica?" (live): Topic PASS, route PASS, Research PASS (6 fontes), Evidence com 2 definições de componentes e **nenhum mecanismo admissível** → bloqueio honesto. **PARTIAL.** O probe revelou um corte de frase que invertia o sentido e originou a regra de rejeição. [review/generalization.md](out/engine3d/phase25/review/generalization.md). Terceiro probe opcional não executado.

## Cold Regression

Sem nova coleta. Topic → STRICT, Research v4, quorum 2/2, writer BLOCKED sobre o resultado Phase23 registrado; queries Cold inalteradas; extração de mecanismo não roda em ranking (testes). PASS.

## Fiction Regression

Tópico de ficção para em TOPIC_ANALYSIS (sem rota factual); a pesquisa nunca é chamada (teste). PASS.

## Hypothetical Regression

Premissa "se a Lua desaparecesse" preservada, não afirmada, fora das EvidenceRequirements. PASS.

## Replay

PASS — 0 chamadas de rede; 12/12 stages puros idênticos; finalização pós-voz idêntica a partir das durações gravadas; SHA-256 do MP4 conferido. As correções do extrator feitas após a execução final não alteraram nenhum fingerprint. [replay/final-replay.json](out/engine3d/phase25/replay/final-replay.json).

## Provenance

PASS — cadeia de 12 elos do tópico ao SHA-256 do MP4, `manualInputs: []`, verificada contra os artefatos recomputados; adulteração detectada em teste. [review/provenance.md](out/engine3d/phase25/review/provenance.md).

## Security

PASS. Nenhum arquivo de transporte/segurança alterado; SSRF/DNS/pinning/redirects/robots/MIME/limites intactos; Topic Intelligence e Writer sem rede; TTS edge-tts existente; nenhuma dependência ou serviço pago.

## Anti-hardcode

PASS — 297 arquivos, 0 BLOCKER. Alvos: tópicos (poço artesiano, artesian well, turbina hidráulica, hydraulic turbine, bomba d'água, water pump, Cold), frases factuais do roteiro final, URLs das fontes e valores de evidência. Ocorrências: 15 testes/fixtures, 4 exemplos de entrada, 1 regex legado pré-Phase24 em `src/writer/topic.ts` que **recusa** o tópico (inalterado). Coordenadas da demonstração vêm do template genérico de líquidos. Controle negativo injetado detectado. Teste de runtime dedicado em `tests/vertical-slice.test.ts`.

## Tests

`tests/vertical-slice.test.ts`: **15/15 PASS**, sem rede, fixtures sintéticas rotuladas `DEMO_FIXTURE`/`NOT_REAL_WORLD_FACTS`. Cobrem trace e transições, bloqueio, histórico de tentativas, gramática de mecanismo (incluindo rejeição de negação e de truncagem), prontidão PROCESS, rota da extração, Writer de processo, relações semânticas, seleção de operações visuais, continuidade de objetos e câmera, proveniência e adulteração, replay, generalização secundária, regressões Cold/ficção/hipótese, anti-hardcode de runtime e compatibilidade legada.

**19/19 comandos PASS; 872 testes únicos (857 + 15).** Typecheck repetido após os últimos scripts de auditoria: PASS. [analysis/checks-final.tsv](out/engine3d/phase25/analysis/checks-final.tsv).

| Comando | Exit | Testes | s |
|---|---|---|---|
| typecheck | 0 | — | 17,9 |
| check:engine3d | 0 | 872 | 93,9 |
| check:editorial | 0 | 46 | 2,6 |
| check:sound | 0 | 35 | 5,2 |
| check:visual | 0 | 37 | 38,9 |
| check:motion | 0 | 30 | 4,7 |
| check:demonstration | 0 | 30 | 4,1 |
| check:autodirector | 0 | 23 | 4,9 |
| check:semantics | 0 | 40 | 4,0 |
| check:narrative | 0 | 35 | 10,7 |
| check:writer | 0 | 32 | 34,7 |
| check:research | 0 | 50 | 15,7 |
| check:web-research | 0 | 115 | 5,7 |
| check:research-v2 | 0 | 39 | 5,6 |
| check:research-v3 | 0 | 76 | 6,7 |
| check:research-v4 | 0 | 65 | 8,7 |
| check:topic-intelligence | 0 | 28 | 6,2 |
| check:vertical-slice | 0 | 15 | 19,1 |
| engine3d:catalog | 0 | — | 3,4 |

## Registry

Engine3D **50** / SFX **8** / VISUAL **5** — inalterado. 12 vídeos históricos com SHA-256 iguais ao registrado. [analysis/integrity.json](out/engine3d/phase25/analysis/integrity.json).

## Performance

| Stage | Tempo |
|---|---|
| Research (live) | 13,5 s (2 queries + 6 fetches, 1,25 MB) |
| Evidence | 0,3 s |
| Writer (3 candidatos + preflights) | 5,5 s |
| Semântica/narrativa/direção/sequência | ~0,3 s |
| Voz (cache edge-tts; 1ª síntese na tentativa 7: 49,7 s) | 1,7 s |
| Composição de áudio | 1,3 s |
| Render (bundle + stills + nativo + mux) | 82,9 s (nativo 57,5 s) |
| Validação MP4 | 5,8 s |
| Total da execução final | ~111 s |

## Compatibility

Rotas não-PROCESS inalteradas (queries, extração, editorial, realização legada de demo, `allowedGroundedEditorial` não-processo). Mudanças semânticas são aditivas (plurais, explicação não-física por padrão estreito, `upward` por destino); todas as suítes históricas passam.

## Limitations

- Extrator fechado em pt-BR; 3 padrões (movimento com destino, causa explícita, definição taxonômica); voz passiva, gerúndios, "porque", relações espaciais e frases longas não são lidas.
- Fonte única (Wikipedia, REFERENCE), sem corroboração; tópico por título do documento.
- Roteiro raso: 3 fatos + 5 frases editoriais genéricas para cumprir 110–160 palavras.
- Visual reaproveita só o template de transferência de líquido; sem solo, aquífero ou pressão; sem rótulos; 34 s finais estáticos.
- Explicações não-físicas aceitas em produção com prova NONE declarada (política nova e explícita, restrita a DEFINITION e RELATION CAUSED_BY exatos).
- Turbina: sem mecanismo admissível; processos mecânicos não têm template visual DIRECT.

## Real-World Gates

| Gate | Resultado | Evidência |
|---|---|---|
| V1 tópico classificado | PASS | EXPLANATION/PROCESS/TECHNICAL, FACTUAL_EXPLANATORY sem ajuste |
| V2 rota STANDARD | PASS | level STANDARD, PROCESS, v4 |
| V3 pesquisa live útil | PASS | 5 fontes, 3 evidências de mecanismo na execução final |
| V4 evidência libera Writer | PASS | RESEARCH_READY; gate PROCEED_GROUNDED |
| V5 Writer sem hardcode | PASS | PRODUCTION_ELIGIBLE; anti-hardcode 0 BLOCKER |
| V6 semântica aceita o script | PASS | 8 claims, fato físico RESOLVED, 0 gaps |
| V7 Auto Director sem shot list manual | PASS | plano FULL, compilado productionReady |
| V8 demonstração cobre claims processuais | PASS | a claim física (fluxo) DIRECT; definição/causa NONE declaradas |
| V9 sequence/Engine3D sem blocker | PASS | 1 sequência, avaliação sem erro |
| V10 voz/editorial/composição | PASS | 48,03 s, legendas ≤3 palavras, PCM exato |
| V11 MP4 real validado | PASS | decode completo, A/V, SHA-256 acima |
| V12 probe secundário demonstra generalização | **FAIL (PARTIAL)** | turbina chega a Research/Evidence com fatos extraídos, mas não ao Writer |

**V1–V11 PASS → STRONG.** Não VERY STRONG: V12 parcial.

## Honest Assessment

| Dimensão | Avaliação |
|---|---|
| TOPIC ROUTING | STRONG |
| REAL RESEARCH | ACCEPTABLE |
| EVIDENCE QUALITY | WEAK |
| PROCESS UNDERSTANDING | WEAK |
| WRITER | ACCEPTABLE |
| SEMANTIC UNDERSTANDING | ACCEPTABLE |
| NARRATIVE PLANNING | ACCEPTABLE |
| AUTO DIRECTION | ACCEPTABLE |
| VISUAL DEMONSTRATION | WEAK |
| OBJECT CONTINUITY | GOOD |
| CAMERA DIRECTION | ACCEPTABLE |
| ENGINE3D | GOOD |
| VOICE | GOOD |
| EDITORIAL | ACCEPTABLE |
| RENDER | GOOD |
| VISUAL QUALITY | WEAK |
| GENERALIZATION | WEAK |
| REPLAYABILITY | STRONG |
| PROVENANCE | STRONG |
| SECURITY | STRONG |
| ANTI-HARDCODE | STRONG |
| OVERALL AUTONOMY | ACCEPTABLE |

A cadeia autônoma existe e é auditável de ponta a ponta. O vídeo diz pouco, mas não diz nada falso. O gargalo deixou de ser o "encanamento" e passou a ser a **densidade de conhecimento**: poucas frases de mecanismo extraíveis e um vocabulário visual restrito a líquidos.

## Autonomy

Recomendação: **LEVEL4C+** (intermediário). Evidência: tópico apenas → pesquisa live → Writer grounded → semântica → direção autônoma → render → MP4 num domínio novo, sem hardcode, com replay e proveniência. Não LEVEL5: um benchmark, uma fonte, roteiro raso e probe secundário parcial.

## Biggest Remaining Bottleneck

Extração de mecanismo: só 3 fatos grounded por artigo e nenhum no probe da turbina. O roteiro fica raso e processos sem frase "X flui para Y" não chegam ao Writer.

## Next Recommendation

Ampliar a extração grounded de mecanismo (sequências de etapas, voz passiva, relações espaciais, causalidade com "porque") e a aquisição de uma segunda fonte por assunto, medindo fatos admitidos por tópico em vários processos, antes de investir em novos visuais. **Phase26 não iniciada; sem commit/push. PARAR.**
