# Phase 27 — Persistent 3D World & Causal Visual Direction Pilot — Report

Data: 2026-10-29 · branch `main` · base `7de502dc34a92bd18467e310095fadb5018889e9` · **sem commit/push** (working tree para revisão).

## Executive Summary

**PHASE27 IMPLEMENTATION: COMPLETE** (P1–P25 PASS) — o que significa um piloto visual causal tecnicamente bem-sucedido, **não** um produto final.

A partir do roteiro grounded congelado da Phase26 ("Como funciona um poço artesiano?", 64 palavras, 4 relações), um planejador genérico novo (`src/visual-causal/`) constrói um mundo 3D persistente: chão com céu e árvore, casa editorial, o sistema, um presenter reutilizado (CHAR_CAIO_001) e um corte do terreno. Ele agenda **9 beats** (4 factuais, 5 editoriais) e compila tudo para a DirectedSequence/VisualDemonstration existentes (mesmo renderer Remotion).

O MP4 real tem 25,27 s. Maior estase significativa: **4,43 s** (Phase25: 33,8 s). Prova visual: DIRECT 1, PARTIAL 1, SYMBOLIC 2, NONE 0. Relações factuais inventadas: 0. Replay com 0 chamadas de rede.

Qualidade de produto: **ACCEPTABLE**. Supera claramente a Phase25 em contexto, progressão, escala, câmera, continuidade e coerência de mundo, mas a geometria ainda é primitiva e o vídeo é curto porque o conhecimento é curto.

## Starting Checkpoint

`git status` limpo; branch `main`; HEAD exatamente `7de502d…`; local = remoto. Lidos CLONAI_HANDOFF.md (seção Phase26/26B), PHASE25_REPORT.md e PHASE26_REPORT.md.

## Phase26 Constraints

Poço (A): 4 relações (IS_A, FLOW, CAUSED_BY, COLLECT), 2 físicas, 1 causal explícita, ADEQUATE, SCRIPT_GROUNDED, 64 palavras. Zero cadeias problema/solução reais; maior cadeia física de 1 aresta. Nada disso foi alterado: o planejador lê o Writer da Phase26 (com verificação de fingerprint) e não acrescenta relações, componentes, falhas, soluções, números nem geometria técnica.

## Architecture Audit

Auditados: registry (50 recursos), `library.tsx` (personagens/ambientes), `directed.ts` (DirectedSequence, blocking, ações, câmera, QA de continuidade com limite de 0,22/frame e cortes), `demonstration-*` (subjects BOX/CYLINDER/PATH/LAYER, operações, `groundCutaway`, `presenterMode`), `director.ts` (legendas), `curiosity/story.ts` (visualHints/intents), `writer/curiosity.ts` (handoff), mídia Phase25.

Achados que moldaram o desenho:
- O personagem padrão **CAIO** já é o estilo-alvo: cabeça grande, lisa e escura, olhos brancos grandes, corpo fino, casaco vermelho.
- `LAYER` + `groundCutaway` já desenham subsolo e trincheira (o código de render é genérico; só a capability estava declarada apenas no LAB).
- `PATH` já desenha tubo com fluxo interno; `HIDE` remove uma tampa.
- Nada precisava de renderer, asset ou motor novo.

## Visual Baseline

`out/engine3d/phase27/baseline/baseline.json`: MP4 Phase25 (SHA-256 `c901c5a8…` confere), 1 shot, 2 segmentos de câmera, 33,8 s sem mudança visual, prova DIRECT 1/NONE 2, sem mundo, presenter ou cutaway; status de entrada da Phase26; snapshot do registry e das capabilities.

## Persistent World

`PersistentWorld` (`src/visual-causal/contracts.ts`) contém:
- `worldId` derivado de tópico + story;
- template (TERRAIN_SUBSURFACE / ENCLOSURE / OPEN_STAGE), ambiente, presenter, cutaway e zonas de câmera;
- entidades com `entityId`/`worldId`/papel/grounding/abstração.

O template é escolhido por pistas espaciais genéricas (subsolo, contenção, conduto), nunca por tópico. Todas as entidades compartilham o `worldId`, e o mundo é determinístico (testes + replay).

## Presenter

**Reuso, sem recurso novo:** CHAR_CAIO_001, escala 0,82, um único personagem em toda a sequência. Aparece entrando no mundo, apontando para o sistema (ACTION_POINT), na identificação do sistema e no payoff. Sai do quadro durante o mecanismo interno (`presenterMode` DEMONSTRATION). Toda ação dele é rotulada "editorial; not visual proof". Não há rig facial; só gestos existentes.

## Persistent System

O sistema é uma representação abstrata marcada `ABSTRACT_SYSTEM_REPRESENTATION`: cabeça cilíndrica na superfície + conduto vertical, presentes do início ao fim. O cutaway muda a visualização, não a identidade: os mesmos `entityId`s existem antes e depois (teste).

## State Model

`VisualStateTransition` com `stateVersion` por entidade: REVEAL do subsolo, groundCutaway 0→0,4→0, fluxo 0→1, enchimento 0→0,8, conexão do cano 0→1, fluxo do cano. São 8 transições na versão final; GROUNDED cita a relação e EDITORIAL cita o motivo. Regressão só é aceita pela operação inversa explícita (DECREASE/HIDE/SEPARATE); o validador recusa o resto.

## Causal Visual Beats

`CausalVisualBeat` liga frase, story nodes, relação, evidências, classe de grounding, intent visual, intent do presenter, zona/motivação de câmera, entidade foco, rótulo, operações, transições e prova. Mapeamento por predicado:
- IS_A do sistema → SYSTEM SYMBOLIC;
- IS_A de componente → slot rotulado SYMBOLIC;
- FLOW de meio subterrâneo → transição de cutaway + foco + FLOW DIRECT;
- CAUSED_BY → destaque + rótulo SYMBOLIC;
- conduto (COLLECT/PASSES_THROUGH) → CONNECT + FLOW PARTIAL;
- MOVE_WITHIN → corte da carcaça + MOVE DIRECT;
- propósito/restrição → NONE com gap explícito.

## Grounded vs Editorial Visuals

Somente FACTUAL_DEMONSTRATION pode ter prova; beats editoriais (EDITORIAL_CONTEXT/TRANSITION, PRESENTER_ACTION) não carregam relação, evidência nem prova. O validador recusa:
- beat factual sem relação ou com relação inventada;
- prova em beat editorial;
- beat editorial citando relação (regra adicionada após teste);
- entidade editorial reivindicando relação;
- entidade factual sem relação;
- DIRECT/PARTIAL sem ação real sobre entidade factual da própria relação (câmera ou presenter não provam nada).

A casa é contexto editorial derivado da frase ("uso residencial").

## Cutaway

Dois tipos genéricos: **GROUND_TRENCH** (INCREASE de `groundCutaway` no ENVIRONMENT + REVEAL das camadas) e **HOUSING_SECTION** (HIDE da tampa editorial). Ambos não destrutivos e cobertos por testes.

## Terrain/Subsurface

Camada de solo (editorial) e camada do meio (factual, participante da relação FLOW) como parede de fundo larga, com o conduto à frente. A capability `groundCutaway` (já desenhada genericamente pelo Environment) foi **declarada** para LAB, FOREST, DEAD_FOREST, CITY e RUINED_STREET, mantendo o contrato "somente onde declarado". O teste histórico que exige recusa no WINTER continua válido.

## Camera Direction

Zonas WORLD/SYSTEM/CUTAWAY/COMPONENT/ACTION/RESULT por template, dimensionadas pelo FOV de 44° em 9:16.
- **Foco no quadro:** se a pose da zona não enquadra bem o foco do beat, a câmera reenquadra pelo tamanho real da entidade (bug genérico achado no probe do elevador).
- **Movimento:** suave quando cabe no limite de continuidade; senão, CUT motivado.
- **Ação:** no FLOW a câmera acompanha o meio subindo.

Todo segmento declara a zona e a motivação.

## DirectedSequence Integration

`compileVisualPlan` produz DirectedSequence válida via `validateDirected` (incluindo o QA de continuidade do Engine3D): baseShot com ambiente e presenter, demonstração com 7 subjects, blocking, ações, câmera, foco, 9 shots (2 CUT) com rótulos e legendas pelo `captions()` existente.

## Engine3D Integration

Sem motor, renderer, asset ou recurso novo. Única mudança no Engine3D: a lista declarada de ambientes com `groundCutaway` (`src/engine3d/demonstration-runtime.ts`).

## Visual Demonstration

Operações usadas: REVEAL, HIGHLIGHT, INCREASE (ambiente e enchimento), FLOW (×2), CONNECT, DECREASE (fechar o corte). Nenhuma operação nova.

## Visual Proof

| Beat | Relação | Prova | Porquê |
|---|---|---|---|
| Identidade | IS_A | SYMBOLIC | rótulo sobre representação abstrata; categoria não é visualmente provável |
| Fluxo | FLOW | DIRECT | meio, movimento e destino (superfície) mostrados ao longo do conduto |
| Causa | CAUSED_BY | SYMBOLIC | causa nomeada e participante destacado; pressão não desenhada |
| Canos | COLLECT | PARTIAL | transferência pelo cano mostrada; geometria/destino abstratos/editoriais |

## Motion

Todas as operações mudam estado (verificado por avaliação antes e depois de cada step). Há 1 caminhada e 3 ações do presenter (POINT, LOOK, POINT), 8 segmentos de câmera e 8 transições de estado. O verificador inicialmente acusou os REVEAL instantâneos como "sem mudança"; foi corrigido para comparar com o frame anterior ao step.

## Continuity

0 problemas: nenhum objeto some, aparece, teleporta ou muda de escala sem operação; nenhuma regressão de estado; mesmo mundo, ambiente e presenter. Adversariais testados: troca de presenter, desaparecimento sem HIDE, `worldId` divergente.

## Screen Occupancy

Medida por projeção dos bounds pela câmera avaliada, no frame central de cada beat. Componente/ação/resultado: extensão focal 0,46–1,0 (PASS). Nos 2 beats SYSTEM a cabeça do poço fica em 0,26 porque o quadro inclui o presenter inteiro: **PARTIAL**, registrado, sem polish adicional.

## Meaningful Visual Change

`MeaningfulVisualChange` conta mudança de zona de câmera, câmera acompanhando, início de operação, cutaway, ação ou entrada do presenter e rótulo novo. Final: 9/9 beats com mudança significativa; maior estase 4,43 s (meta ≤ 8 s; ideal ≤ 6 s).

## Primary Pilot — Artesian Well

`out/engine3d/phase27/final/phase27-well-final.mp4` · 25,27 s · 480×854 · 30 fps · 758 frames · H.264 · AAC 48 kHz estéreo · 1.215.534 bytes · SHA-256 `51823d2f6788df9fc9473de290829f128faf83327c2931a2898a787ae050ec6a` · áudio QA PASS (−21,1 LUFS). Voz pt-BR-AntonioNeural (edge-tts) nas frases exatas do Writer da Phase26, sem reescrita. Plano: `plans/well-visual-causal-plan.json`.

## Secondary Probe

**Elevador (F)**, escolhido porque testa outro template (invólucro vertical em vez de subsolo), outra operação física (MOVE_WITHIN), outro cutaway (seção da carcaça) e vários componentes. A turbina repetiria "fluxo por conduto".

VisualCausalPlan **válido**, sem código por tópico: ENCLOSURE em ENV_CITY, HOUSING_SECTION, MOVE DIRECT da cabine, componentes em slots rotulados (posição real não está na evidência, então não é desenhada) e gaps explícitos (IS_A da caixa, USED_FOR do contrapeso).

QA após a correção de enquadramento: ocupação, presenter e continuidade PASS; **MEANINGFUL_CHANGE FAIL** (10,9 s), porque o roteiro F tem frases de ~12 s sobre um único componente. Sem MP4 (stills para inspeção).

## Phase25 Comparison

| Eixo | Phase25 | Phase27 |
|---|---|---|
| Shots | 1 | 9 (2 cortes motivados) |
| Mudanças significativas | ~3 s de ação | 9/9 beats com mudança; 30 eventos |
| Maior estase | 33,8 s | 4,43 s |
| Mundo | nenhum | chão/céu/árvore + casa editorial |
| Ocupação do sistema | pequena após recuo | 0,46–1,0 nos beats explicativos; 0,26 nos SYSTEM |
| Cutaway | nenhum | trincheira no terreno |
| Presenter | nenhum | CAIO em 3 momentos |
| Continuidade de estado | n/a | versionada, 0 problemas |
| Prova | DIRECT 1 / NONE 2 | DIRECT 1 / PARTIAL 1 / SYMBOLIC 2 / NONE 0 |

Os instrumentos de mudança diferem: Phase25 usa directed-metrics e Phase27 usa eventos significativos do plano. A duração difere porque os roteiros diferem (111 contra 64 palavras). Detalhes em `analysis/phase25-comparison.json`.

## Visual QA

Medido (`qa/visual-qa.json/.md`): WORLD_CONTEXT, SYSTEM_LEGIBILITY, PRESENTER_CONTINUITY, OBJECT_PERSISTENCE, STATE_CONTINUITY, CAMERA_MOTIVATION, CUTAWAY_CLARITY, ACTION_VISIBILITY, RESULT_VISIBILITY, MEANINGFUL_CHANGE, VISUAL_PROOF, CAPTION_COLLISION e GENERAL_COMPOSITION em PASS; SCREEN_OCCUPANCY em **PARTIAL**. Resultado: **PARTIAL**.

O QA foi corrigido duas vezes quando a inspeção dos frames o contradisse (altura do presenter; REVEAL instantâneo). Ele não substitui a revisão dos frames codificados, feita em todas as tentativas.

## Motion QA

PASS (`qa/motion-qa.json/.md`).

## Human-visible Review

Sem áudio, um observador entende aproximadamente o sistema e percebe ação física? **YES**, com o rótulo na tela e o corte (tubo de uma camada de água subterrânea até a cabeça na superfície, água subindo, cano até a casa). Sem o rótulo, a identidade do sistema seria PARTIAL. Revisão visual explícita dos frames; não é teste com humanos.

## Product-quality Review

Mini documentário 3D em vez de diagrama abstrato? **PARTIAL**: há lugar, apresentador, revelação e payoff, mas geometria primitiva, 25 s, sem sound design e host quase estático. Product Quality **ACCEPTABLE** (`review/final-review.md`).

## Replay

PASS (`replay/replay.json`): fetch, HTTP/HTTPS e DNS bloqueados; **0 chamadas**. Entrada, plano e sequência reconstruídos a partir do Writer da Phase26 e das durações de voz gravadas, iguais para o poço e o elevador; replay do plano verificado; SHA-256 do MP4 conferido. TTS e render não são refeitos.

## Provenance

PASS (`provenance/final-provenance.json`): cadeia topic → script/story (Phase26) → relações → plano → sequência → SHA-256 do MP4. 100% dos beats factuais com IDs de relação e de evidência existentes; beats editoriais classificados; `manualInputs: []`; adulteração re-assinada falha.

## Security

PASS. Nenhuma pesquisa, aquisição ou fonte nova (0 queries/fetches na fase). Nenhum arquivo de transporte/segurança da Research alterado, `package-lock` intacto, nenhum asset baixado. edge-tts como antes.

## Anti-hardcode

PASS (`analysis/anti-hardcode.json`): 199 arquivos de runtime, **0 BLOCKER**. Alvos: tópicos dos 8 benchmarks, frases FACT dos roteiros Phase26, rótulos exibidos e ramos por tópico. Ocorrências classificadas:
- léxicos pré-existentes da Phase24/26;
- regex legada de recusa da Phase18;
- 1 membro do léxico genérico de condutos ("canos").

Um controle negativo injetado foi detectado. O teste de runtime também bane nomes de benchmark em `src/visual-causal/`.

## Performance

Render final: plano + compilação 0,2 s; render nativo 29,9 s; parede 39,2 s; total 52,4 s com bundle/mux/validação (voz em cache). Geometria leve (7 subjects, ~35 meshes).

## Tests

`tests/visual-causal.test.ts`: **18/18**. Cobre mundo persistente, identidade, persistência de objeto, transições e recusa de regressão, continuidade e classificação editorial do presenter, zonas e motivação de câmera, cutaway genérico e persistente, solo/subsolo, factual × editorial, mapeamento de affordances, prova visual, ocupação, mudança/estase, generalização secundária, determinismo, replay/tamper, proveniência, anti-hardcode e compatibilidade legada. Adversariais: relação inventada, componente falso, prop editorial como fato, mundo trocado, presenter trocado, desaparecimento sem transição, câmera reivindicando prova e prova editorial.

**22/22 comandos PASS; 979 testes únicos (961 + 18).** [analysis/checks-final.tsv](out/engine3d/phase27/analysis/checks-final.tsv). Uma primeira execução encontrou 1 falha real: o teste histórico `demonstration: environment state/cutaway supported only where declared` exige recusa no WINTER. A declaração foi reduzida ao conjunto mínimo de terreno/urbano, sem alterar o teste histórico, e a regressão inteira foi reexecutada.

| Comando | Exit | Testes | s |
|---|---|---|---|
| typecheck | 0 | — | 11,3 |
| check:engine3d | 0 | 979 | 55,0 |
| check:editorial | 0 | 46 | 1,4 |
| check:sound | 0 | 35 | 2,8 |
| check:visual | 0 | 37 | 19,6 |
| check:motion | 0 | 30 | 2,3 |
| check:demonstration | 0 | 30 | 2,3 |
| check:autodirector | 0 | 23 | 2,6 |
| check:semantics | 0 | 40 | 2,1 |
| check:narrative | 0 | 35 | 6,0 |
| check:writer | 0 | 32 | 18,0 |
| check:research | 0 | 50 | 8,8 |
| check:web-research | 0 | 115 | 3,3 |
| check:research-v2 | 0 | 39 | 5,0 |
| check:research-v3 | 0 | 76 | 5,0 |
| check:research-v4 | 0 | 65 | 5,4 |
| check:topic-intelligence | 0 | 28 | 5,0 |
| check:vertical-slice | 0 | 15 | 11,0 |
| check:causal-curiosity | 0 | 69 | 2,2 |
| check:contextual-mechanism | 0 | 20 | 1,8 |
| check:visual-causal | 0 | 18 | 2,5 |
| engine3d:catalog | 0 | — | 2,2 |

## Registry

Engine3D **50** / SFX **8** / VISUAL **5**. Nenhum recurso criado, aprovado ou removido; só uma declaração de capability (`groundCutaway`) ampliada.

## Compatibility

Phase25/26 intocadas: Writer, Research, semântica, narrativa, AutoDirector, VisualDemonstration e DirectedSequence sem mudança de comportamento. O exemplo `directed-door.json` e o LAB com cutaway seguem válidos, e todas as suítes históricas passam. 13 vídeos históricos com SHA-256 inalterado (12 da Phase23 + o final da Phase25).

## Limitations

- O conhecimento manda: 64 palavras geram 25 s; nada de problema/solução, cadeia física de 1 aresta, causa só nomeada.
- Geometria abstrata e crua: cilindro translúcido, caixas e placas inclinadas do corte.
- Presenter com 1 caminhada e 3 gestos (apontar, olhar, apontar), sem reação ao evento; sem rig facial.
- Sem SFX (sem aprovação aplicável).
- Templates de mundo são três layouts editoriais fixos; domínios fora deles caem em OPEN_STAGE.
- Componentes sem posição na evidência ficam em slots rotulados, o que é honesto mas pouco ilustrativo.
- Frases longas de um só componente (elevador) estouram a meta de estase.
- Legendas estimadas uniformemente dentro de cada frase; tempos de beat dentro da frase são estimados pela posição textual.

## Honest Assessment

| Dimensão | Avaliação |
|---|---|
| WORLD CONTEXT | GOOD |
| PERSISTENT SYSTEM | GOOD |
| PRESENTER | ACCEPTABLE |
| CUTAWAY | ACCEPTABLE |
| CAMERA DIRECTION | GOOD |
| STATE / OBJECT CONTINUITY | STRONG |
| VISUAL PROOF HONESTY | STRONG |
| ACTION VISIBILITY | GOOD |
| SCREEN OCCUPANCY | ACCEPTABLE |
| VISUAL CRAFT | WEAK |
| GENERALIZATION | ACCEPTABLE |
| REPLAY / PROVENANCE | STRONG |
| PRODUCT QUALITY | ACCEPTABLE |

## Autonomy

**LEVEL4C+ mantido.** O piloto prova composição visual causal a partir de conhecimento grounded num tópico, com generalização de plano em um segundo; não justifica promoção.

## Phase27 Gates

| Gate | Resultado | Evidência |
|---|---|---|
| P1 checkpoint exato + início limpo | PASS | HEAD `7de502d…`, `main`, árvore limpa, local = remoto |
| P2 baseline visual Phase25 preservado | PASS | `baseline/baseline.json`; SHA-256 do MP4 Phase25 inalterado |
| P3 arquitetura reutilizada antes de criar | PASS | CAIO, FOREST/CITY, LAYER/PATH/CYLINDER/BOX, DirectedSequence, `captions()`; só capability declarada |
| P4 PersistentWorld determinístico | PASS | teste de determinismo; replay plano/sequência iguais |
| P5 identidade persistente do sistema | PASS | mesmos `entityId`s antes/depois do corte; continuidade 0 problemas |
| P6 continuidade do presenter | PASS | 1 personagem CAIO, 100% visível em 3 beats; troca detectada |
| P7 separação grounded/editorial | PASS | validador + 8 adversariais |
| P8 proveniência dos beats | PASS | 100% factuais com relação + evidência |
| P9 transições determinísticas | PASS | 8 transições versionadas; regressão recusada |
| P10 cutaway/reveal genérico | PASS | GROUND_TRENCH e HOUSING_SECTION |
| P11 zonas e motivação de câmera | PASS | 6 zonas; todo segmento motivado; reenquadramento por foco |
| P12 integração DirectedSequence | PASS | `validateDirected` + QA de continuidade do Engine3D |
| P13 integração Engine3D | PASS | mesmo renderer/composição Remotion |
| P14 MP4 real | PASS | `final/phase27-well-final.mp4`, decode completo, A/V OK |
| P15 ≥ 6 beats significativos | PASS | 9 |
| P16 maior estase ≤ 8 s | PASS | 4,43 s |
| P17 continuidade de objeto/estado | PASS | 0 problemas |
| P18 ≥ 1 relação DIRECT/PARTIAL | PASS | FLOW DIRECT, COLLECT PARTIAL |
| P19 VisualCausalPlan do domínio secundário | PASS | elevador válido e genérico (estase 10,9 s registrada como limite) |
| P20 0 relação factual inventada | PASS | 0 |
| P21 0 hardcode de benchmark em runtime | PASS | 199 arquivos, 0 BLOCKER, controle negativo detectado |
| P22 replay sem rede | PASS | 0 chamadas |
| P23 proveniência | PASS | cadeia verificada até o SHA-256 do MP4 |
| P24 segurança | PASS | nenhum arquivo de segurança/lock/asset alterado; 0 aquisições |
| P25 regressão completa | PASS | 22/22 comandos, 979 testes únicos |

## Next Recommendation

Elevar o artesanato visual do vocabulário genérico de sistemas: seção de terreno com espessura real, condutos e cabeças sólidos, reação do presenter ao evento e um ou dois SFX aprovados. Medir pelo mesmo QA, no poço e no elevador, antes de expandir templates ou conhecimento. **Phase28 NOT STARTED.**
