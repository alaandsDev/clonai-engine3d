# PRODUCT PASS — Short-form pacing + cinematic direction

**PRODUCT PASS: COMPLETE — metas técnicas e visuais desta rodada.** Qualidade visual **GOOD**, não certificada como POSTABLE. A pergunta sobre uma narração gravada em sessão única permanece **PARTIAL**, com a ressalva auditiva abaixo.

## Resultado

Mesmo `roteiro-panela.txt`, 180 palavras, 20 segmentos. **77,00 → 59,10 s**, sem cortar fatos ou palavras. O ideal 50–58 s foi preterido por uma cadência um pouco mais calma após feedback do usuário; o alvo obrigatório 45–60 s passa.

MP4: `C:/Users/aland/Desktop/projects/clonai/out/engine3d/script-mode/roteiro-panela-product-pass/video.mp4`

SHA256: `4001d949f7b5023e192c7319d9ee543b2a92971da0d5d07731f6cf44c9c14305`

H.264, 480×854, 30 fps, 1773 frames; AAC 48 kHz estéreo. Decode completo, A/V e audio QA PASS. Três renders completos, versões preservadas em attempts/01–03. Não foi feito um quarto render.

## Imutabilidade e escopo

SCRIPT SHA BEFORE: `acee87904af16839fbd7297178db9551b9aaa0babe9756d27c9ad91c1775e340`  
SCRIPT SHA AFTER: `acee87904af16839fbd7297178db9551b9aaa0babe9756d27c9ad91c1775e340`  
SCRIPT UNCHANGED: **YES**. UNDERSTANDING CHANGED: **NO**, inclusive JSON semantic-claims idêntico ao baseline. Coverage 95%, 8 segmentos DIRECT, 0 gaps, sem promover cobertura.

Research, Evidence, StoryNeed, Retrieval, parser, understand.ts, lexicon, pronomes e verbos: **NONE**. Os **2095 arquivos protegidos** (incluindo históricos Phase27/27B/28/28B/29, o vídeo anterior e Research/understanding) mantêm seus hashes. Não foram adicionados domínio, roteiro, LLM, modelo, SaaS, backend, dependência, lipsync, música, SFX ou UI. Catálogo consultado: recursos/assemblies existentes reutilizados, sem novo ID de recurso.

## Auditoria dos 77 segundos, antes de implementar

O baseline tem 20 clipes. A soma do PCM decodificado é **71,52 s**; os windows totalizam 77,00 s. A diferença **5,48 s** é padding/quantização do sistema: 19 pausas de 8 frames (5,067 s) mais arredondamento dos clipes. Não havia mínimo de 4–5 s por frase. O mínimo de 12 frames por draft visual divide o window de fala, não aumenta sua duração. Captions também repartem o window, com guard de validade de um frame; não adicionam padding. Transições ocupam a mesma timeline.

Além do padding, os próprios clipes contêm **20,67 s** de silêncio nas bordas. A soma de conteúdo entre as bordas silenciosas é **50,85 s**, incluindo suas pausas internas. Portanto, o problema não exigia acelerar a voz.

Diagnóstico linha a linha: `baseline/timeline.json` registra script segment, semantic beat, visual beat, shot, caption, TTS clip e camera transition, com start/end/duration, frases associadas, fala, mínimos, padding e duração de transição. `baseline/audio-clips.json` contém os 20 clipes. `timeline-after.json` mantém essas camadas separadas e também inclui semantic claims.

## Áudio — BEFORE vs AFTER

| Métrica | BEFORE | AFTER |
| --- | --- | --- |
| TOTAL VIDEO DURATION | 77.000s | 59.100s |
| RAW TTS CONTENT DURATION | 71.520s | 73.776s |
| Conteúdo entre bordas quietas, com pausas internas | 50.850s | 52.230s |
| Trimmed clips duration | Não aplicado | 55.830s |
| TOTAL DETECTED SILENCE | 30.530s | 11.420s |
| SEGMENT_BOUNDARY_SILENCE | 20.670s | 3.430s |
| NATURAL_SPEECH_PAUSE — quiet interno | 4.340s | 4.660s |
| SYSTEM_PADDING | 5.480s | 3.270s |
| NON-SPEECH PADDING — bordas + sistema | 26.150s | 6.700s |
| SPEECH OCCUPANCY | 60.36% | 80.68% |
| MEAN INTER-SEGMENT PAUSE | 1.319s | 0.338s |
| MEDIAN INTER-SEGMENT PAUSE | 1.327s | 0.287s |
| MAX INTER-SEGMENT PAUSE | 1.367s | 0.433s |
| INITIAL SILENCE | 0.190s | 0.080s |
| FINAL SILENCE | 0.923s | 0.205s |
| VOICE RATE | +0% | −3% na síntese; nenhum atempo/time stretch |

Medição de quiet acústico: RMS em 10 ms, abaixo de −45 dBFS, duração mínima 60 ms. Não é alinhamento de fonemas nem reconhecimento de respiração. Pequenas diferenças de soma vêm das janelas de análise, AAC e arredondamento. RAW TTS CONTENT inclui silêncio técnico: seu valor acima de 60 s não significa mais de 60 s de fala natural. Aumento de conteúdo entre bordas na versão final vem da voz ligeiramente mais lenta, sem remoção de palavras.

## Trim e pausas automáticos, para futuros roteiros

O Script Mode agora executa automaticamente TTS → boundary trim → controlled pause → narration windows → visual synchronization → mix. `src/engine3d/audio/pacing.ts` conserva 90 ms de margem nas bordas e não remove nada entre a primeira e a última atividade detectada. Os WAVs ficam em cache separado; MP3s TTS originais são preservados. Clipes silenciosos falham antes do render.

Pausas acústicas desejadas calibradas: NORMAL_CONTINUATION 220 ms, SHORT_PAUSE 290 ms, PARAGRAPH_PAUSE 420 ms, DRAMATIC_PAUSE 600 ms. Os guards retidos e o arredondamento são descontados antes de inserir a pausa: não somar trailing + leading + padding cegamente. A seleção usa parágrafo e ações/participantes já extraídos; não adiciona entendimento. Pontuação e pausas internas permanecem. A taxa −3% foi aplicada à síntese após feedback; o default de outros modos continua +0%.

Cada um dos 20 segmentos entra **uma vez**, na mesma ordem, sem overlap. A timeline inteira (ações, captions e câmeras) foi recompilada das durações medidas. Não houve multiplicação global de timestamps por 0,7 nem aceleração cega de animações.

## Revisão auditiva — limite e correção da amostra

A primeira amostra de auditoria foi mal montada: concatenou excertos sobrepostos e produziu repetição/cortes no próprio montage. Ela não representava o mix integral. O usuário identificou isso; a amostra foi substituída por trecho contínuo sem recortes. O usuário chamou a segunda amostra de quase perfeita, mas rápida. A síntese final foi reduzida para −3%, e o master possui 59,10 s.

**Pareceria narração contínua gravada em uma única sessão? PARTIAL.** Há feedback humano sobre a amostra contínua anterior, mas não foi recebida confirmação auditiva do master final −3%. Este agente não dispõe de entrada de áudio e não afirma ter escutado a versão final. A inspeção acústica confirma ausência de overlap/duplicação de clipes e preservação do conteúdo interno; não substitui percepção humana da prosódia. `narration-final.wav` é o áudio do MP4 final; `continuous-audition.wav` é um excerto contínuo. A antiga boundary-audition.wav é somente diagnóstico inválido, não áudio final.

## Continuidade e parent-child

`parentId` no contrato de mundo/programa define transform local. O evaluator compõe **parent × local** e entrega poses mundiais a render, câmera e QA. Movimento do pai não exige MOVE duplicado no filho. Parentes ausentes e ciclos falham explicitamente. Há testes de translação, rotação, escala, hierarquia e visibilidade.

Os controles do closure são anexados a ele pela composição de assembly já existente. O emissor usa o participante da ação de escape já identificado, em vez do primeiro objeto encontrado. Movimento vertical próprio do stem continua local, com curso de staging limitado pela dimensão do componente. STEM e CONTROL usam proporções/silhuetas distintas. Apoios genéricos do queimador conectam visualmente base e recipiente; foram mantidos os budgets, reduzindo a quantidade de pequenos meshes de chama, sem aumentar limites.

ATTACHED COMPONENTS: **2**, mais **1 emissor**. Parent-child discontinuities **0**. Foram comparadas matrizes esperadas e observadas em **1774 frames**, com erro máximo zero neste vídeo. Floating attached components: **0**, também conferido nos frames de fechamento, movimento do stem e abertura.

## Direção visual e métricas

| Métrica | AFTER |
| --- | --- |
| SHOTS | 5 |
| HARD CUTS | 4 |
| CONTINUOUS CAMERA TRANSITIONS | 34 |
| COMPONENT CLOSEUPS | 5 |
| ACTION FOLLOWS | 6 |
| CUTAWAYS — beats em section view existente | 3 |
| PRESENTER VISIBLE BEATS | 3 |
| MECHANISM ONLY BEATS | 22 |
| MEAN SHOT DURATION | 11.820s |
| MEDIAN SHOT DURATION | 12.433s |
| LONGEST SHOT | 18.500s |
| LONGEST MEANINGFUL STASIS | 4.200s |

20 frases/clipes e 25 beats não obrigam 25 shots: a sequência agora tem cinco planos que podem conter vários beats/frases. O shot mais longo contém câmera/ações contínuas, não 18,5 s de imagem estática. Os 34 segmentos contínuos incluem reframes e pushes discretos, não 34 cortes. Closeups seguem foco/ação/região, e FOLLOW reutiliza o executor existente. Movimentos físicos demasiado rápidos para follow seguro recebem um enquadramento mais amplo da ação completa, sem câmera violenta. Nenhuma órbita infinita.

Presenter aparece na abertura e no payoff; fica ausente dos 22 beats de mecanismo. A câmera aproxima o componente mencionado. O efeito de gás usa seu emissor como contexto e reserva a parte inferior para captions. Os três CUTAWAY beats são tomadas da seção já existente no assembly, não três novas aberturas animadas do objeto. A pressão não foi materializada como objeto móvel.

## Antes/depois visual e inspeção

CURRENT 77,0 s → PRODUCT PASS 59,1 s. CURRENT cortes: briefing informa 9; o directed-sequence baseline declara 2 CUTs e 25 blocos de shot. A divergência foi registrada, sem alterar o histórico nem tratar definições diferentes como uma medição idêntica. PRODUCT PASS: 4 CUTs declarados, 5 shots contínuos.

CURRENT floating lid children: YES informado no briefing; código mantinha trackers independentes. PRODUCT PASS: **NO**, transform local comprovado e conferido visualmente. Câmera repetitiva: **PARTIAL/ACCEPTABLE** agora; repetição do close do stem acompanha o ciclo narrado, sem voltar ao mesmo medium entre cada frase. Presenter competition: **GOOD/ausente durante mecanismo**.

Inspecionados contact sheet, event sheet e frames 480×854 de stem, saída de gás, chama desligando e closure em movimento. FOCUS_OCCUPANCY GOOD; BACKGROUND_WASTE ACCEPTABLE; PRESENTER_COMPETITION GOOD; COMPONENT_READABILITY GOOD. As avaliações são manuais/estimadas e não percentuais de pixels inventados. QA estrutural final: WORLD_CONTEXT=PASS, SYSTEM_LEGIBILITY=PASS, PRESENTER_CONTINUITY=PASS, OBJECT_PERSISTENCE=PASS, STATE_CONTINUITY=PASS, CAMERA_MOTIVATION=PASS, CUTAWAY_CLARITY=NOT_APPLICABLE, ACTION_VISIBILITY=PASS, RESULT_VISIBILITY=PASS, SCREEN_OCCUPANCY=PASS, MEANINGFUL_CHANGE=PASS, VISUAL_PROOF=PASS, CAPTION_COLLISION=PASS, GENERAL_COMPOSITION=PASS.

## Três renders, sem exceder o limite

1. 56,10 s, voz +0%: confirmou closeups/parenting e revelou emissor incorreto, contraste do efeito e falta de apoios visuais no queimador.
2. 59,10 s, voz −3%: corrigiu essas questões e respondeu ao feedback de cadência; revelou caption cobrindo o emissor.
3. 59,10 s: enquadrou o gás com o emissor acima da região de captions, sem mudar áudio, roteiro ou entendimento. **Final selecionado; parar após este render.**

O silêncio/câmera foram diagnosticados antes de implementar. Testes sintéticos também expuseram um follow demasiado rápido e fixtures antigas que esperavam trackers independentes; foram corrigidos sem alterar o roteiro/entendimento do benchmark. Nenhuma renderização extra foi usada para esses casos sintéticos.

## Perguntas de sucesso e limites

A. Mais Short e menos slides? **YES** — duração menor, ações sobrepostas à fala, múltiplas frases por plano.

B. Mecanismo protagonista? **YES** — 22/25 beats sem presenter.

C. Câmera mostra o narrado? **YES** para as ações representadas; 95% de coverage preservada, sem alegar 100%.

D. Peças continuam anexadas? **YES** — parenting local e comparação frame a frame.

E. Até 60 s sem mutilar roteiro? **YES** — 59,10 s, SHA e 180 palavras iguais; voz desacelerada, não acelerada.

F. Sem áudio, sequência física principal compreensível? **YES**, por sequência de eventos/frames e continuidade; isso não garante compreender pressão/temperatura somente pela imagem.

PIN READABILITY GOOD; STEAM READABILITY GOOD; CAMERA MOTIVATION GOOD; CAMERA REPETITION ACCEPTABLE; PRESENTER HIERARCHY GOOD; MECHANISM FOCUS GOOD; SHORT-FORM FEEL YES; VISUAL QUALITY **GOOD**, não POSTABLE certificada.

Maior defeito visível restante: o gás ainda tem aspecto de esferas translúcidas empilhadas. A estética permanece de ilustração/maquete. Próxima ação única: ouvir o master integral para fechar a avaliação da cadência final. Nenhuma nova fase será iniciada nesta entrega.

## Verificação e Git

FOCUSED TESTS: **PASS, 45 casos** (10 Product Pass + 35 Script Mode), incluídos no último conjunto relevante.

REGRESSION: **PASS**, suíte raiz 1119 casos; após o último ajuste de câmera, **199 casos relevantes** passaram (Product Pass, Script Mode, visual causal, motion/directed, demonstration, sound e visual). Há sobreposição entre execuções: não somar as contagens. Typecheck e git diff --check PASS. Testes são offline; o único serviço da geração é o edge-tts existente. A etapa de render/mux não fez chamadas externas em processo.

ANTI-HARDCODE: PASS — 194 arquivos src examinados; zero nova condição por panela, pressure cooker, roteiro ou pinOnLid. Novos helpers e linhas alteradas comparados ao backup pré-edição; Research/understanding protegidos por hashes. Não se alega que o código legado não possua vocabulário de objetos.

Base main: `3290fb2756013d0dfc9d69f6dbff701634bba31d`. GIT **UNCOMMITTED**, índice vazio; COMMIT **NO**, PUSH **NO**. Sem reset/clean/stash, alteração de remote, publicação ou mudança de históricos. Artefatos preservados em attempts/01, attempts/02 e attempts/03. O produto usa JSON e o renderer Three/R3F/Remotion existente.
