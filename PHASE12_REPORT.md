# PHASE 12 — Cold Places production pilot

COMPLETE: master técnico validado. Revisão perceptual humana não foi presumida.

## A. Objective

Produzir o piloto integral do ranking. Estado: MASTER VALIDADO. A duração foi explicitamente flexibilizada pelo usuário; não alegamos cumprir 40–60 s.

## B. Final architecture used

Script → EditorialPlan/EventMap v1 → DirectorPlan → Engine3D/Three/R3F → Remotion; edge-tts → voz; SoundDesign e VisualComposition existentes → mux H264/AAC. Adapter autoral em out/engine3d/phase12/build.ts refina um beat em múltiplos shots. O compilador editorial atual continua um staging por beat: não passou a decidir cortes internos automaticamente. Caches de áudio/visual reutilizam as raízes das fases 10/11; nenhum novo framework.

## C. Script

Texto integral em script.txt; 171 palavras faladas. Fonte exclusiva: roteiro do usuário. Sem pesquisa ou alteração de fatos. Tags são metadata, não narração; (PAUSA) é removido do texto falado. sourceCoverageExact=true. Emotion tags não tornam a voz expressiva por si mesmas.

## D. Duration

Medição integral em uma síntese: 77,640 s. Dezoito sínteses por beat: 80,136 s falados; quantização e dois trechos de 0,7 s produzem 2455 frames / 81,833333 s. Usuário: “Preservar roteiro e voz; aceitar cerca de 80 s”. Não houve aceleração nem mudança de rate/pitch. A discrepância com 40–60 s é exceção aprovada, não sucesso dentro da faixa original.

## E. Narrative beats

18 beats, 11 intents existentes. Ranking estruturado 5 Yakutsk → 4 Snag → 3 Verkhoyansk → 2 Oymyakon → 1 Vostok em ranking.json, storyboard e títulos no DirectorPlan. O sidecar evita ampliar o schema fechado da camada editorial; posições também aparecem no texto essencial das respectivas cenas.

## F. Shot plan

43 shots, média 1.903s, mediana 2s, faixa 1,3–2,467s. Cortes explícitos entre beats; cortes internos são autorados no DirectorPlan, sem novos enums. Distribuir shots por duração não demonstra adequação estética.

## G. Storyboard

storyboard.json e storyboard.md completos; 43 PNGs com hashes, 11 contact sheets de quatro frames, último com três. Todas as 11 páginas inspecionadas. Gate estrutural cobre recursos, contiguidade, beats, texto fonte e ranking; safe zones de camadas são verificadas pelo resolver. Frames representativos não substituem revisão humana do movimento.

## H. Engine3D usage

27 recursos distintos usados; 49 IDs preservados. Sem nova geometria, personagem, prop, VFX ou preset. Catálogo e compatibilidade existentes validam o DirectorPlan.

## I. Character continuity

CHAR_CAIO_001 em todas as cenas, mesma geometria e roupa. Bloqueios variam, mas corpo central e rosto neutro repetem. Estados explícitos por shot impedem vazamento entre cidades. OpenDoor reinicia dentro da montagem de porta; isso é limitação de continuidade, não um plano de ação contínua.

## J. Environments

WINTER 29 shots, CITY 5, DEAD_FOREST 2, SHELTER 2, LAB 5. Representações estilizadas; não reconstruções geográficas. Nas tomadas escolhidas as diferenças ambientais podem ser pouco perceptíveis: muitos frames reduzem o fundo a planos de cor.

## K. Props

Door, Thermometer, Map, Backpack, Bottle e Radio existentes, conforme resource-usage.json. Termômetro reutilizado com −63, −68 e −89; aproximação ≈−68 aparece no texto editorial. Não há carro congelado nem equipamento científico detalhado; narrativa visual só sugere esses trechos.

## L. Actions

Ações existentes de abrir porta, apontar, olhar e gestos. Sem nova animação. Não há lip sync, atuação facial convincente ou atividade coletiva de pesquisadores. A montagem alterna intenções simbólicas, com repetição perceptível.

## M. Cameras

Todas as sete: PUSH 5, STATIC 12, PULL 9, PAN_LEFT 4, ORBIT 6, PAN_RIGHT 6, SHAKE 1. Shake apenas no clímax; forças moderadas. Mudança de ID de câmera não garante mudança forte de composição.

## N. VFX

Snow, ColdBreath e Frost usados seletivamente, caps mantidos. Nenhuma aura decorativa. Frost aparece em rosto em trechos de frio; ainda é símbolo discreto e não simulação de gelo sobre cílios.

## O. Editorial text

Somente ranking, lugares e temperaturas. Posição, tamanho e safe zone do render atual mantidos. Textos nos frames inspecionados legíveis. Dilema alterna Oymyakon/Vostok entre shots; são rótulos da escolha, não localização geográfica do personagem.

## P. Captions

Gerador existente preservado, até três palavras por grupo. Timing ESTIMATED/proporcional; não é word alignment. Cada beat usa duração medida. Pausa antes de Vostok fica sem caption; hold final mantém pergunta. Nenhum novo caption engine.

## Q. Sound design

10 cues contextuais: quatro impactos (hook, −63, ≈−68, −89), quatro mudanças de ranking com whoosh, riser no #1 e transição suave na pergunta. Cinco assets SFX dos oito usados. Ganhos −24 a −29 dB, janelas curtas e ducking existente; voz é prioridade. Previews normalizados apenas para review, sem normalizar automaticamente a mix. Sem música.

## R. Visual layers

GRAPHIC_ARROW_001 em três novas janelas de termômetro, ALPHA/DIRECTION, opacity .85, fade quatro frames, um asset simultâneo. Placement dentro safe zone e fora captions. Nenhum dos outros quatro visuais usado apenas por decoração. Preparação e bindings reutilizam compositor da fase 11.

## S. Approvals

Usuário aprovou expressamente “Aprovo os 10 SFX e as três setas do lote”. Cada contexto cp12_* possui registro HUMAN, hash do original, propósito e evidência da resposta; setas incluem hash do preview. Aprovações antigas de hook_sfx/event_thermometer_focus não foram reutilizadas. Escopo não é global. approval-review-package.json preserva estado PENDING no momento do convite; sfx-approvals.json e visual-approvals.json contêm a decisão posterior.

## T. Timeline

2455 frames, 30fps, uma timeline contínua. Pausa real silenciosa de 59,7 a 60,4s, pico PCM zero, depois #1. Hold final 0,7s. Voz não é esticada. Pequenos silêncios de quantização são registrados. Anchors de palavras/frases e captions continuam ESTIMATED.

## U. QA

Preview e voice-only: ffprobe e decode integral passaram, H264/AAC, 480×854, 30fps, 48k estéreo; delta A/V ≈0,000333s. Dados definitivos do master em master-verification.json; audio-qa.json separa voz, stem SFX, mix e master. Pixel QA de cada seta antes/durante/depois usa composições de baseline separadas e tolerância 2/255 no RGB, sem mudança permitida na região das captions. Isso é QA técnico, não aprovação estética.

Master PASS: 2455 frames; delta A/V 0,000333s; AAC idêntico ao sound-design. Voz −20,9 LUFS / −6,1 dBTP; stem SFX −40,3 LUFS / −24,5 dBTP; mix −20,9 LUFS / −6,1 dBTP; master AAC −20,9 LUFS / −6,1 dBTP. Nenhum alvo de loudness foi perseguido automaticamente.

Dez frames extraídos do MP4 final foram inspecionados: hook, cinco posições do ranking, pergunta e três janelas de seta. Todos não vazios, textos/captions esperados visíveis; as setas apontam o termômetro sem cobrir legendas. Evidências em master-frames/ e master-frame-manifest.json.

## V. Render

Baseline caro renderizado uma vez e reaproveitado em voice-only e sound-design. Segunda passagem acrescenta visual layers. Full-editorial/master compartilham conteúdo; AAC copiado do sound-design, não remisturado. Preview anterior continua voz/3D e está identificado como revisão sem camadas.

## W. Performance

Baseline+preview: 190,261s de parede; 2455 frames; concorrência 2. Storyboard: 43 frames em 20,827s. Master e caches em render-performance.json. Síntese de beats: 17 misses/1 hit observados nesta produção. Caches de mídia são fingerprintados e segunda chamada verifica hits. Medição só desta máquina, não benchmark universal.

Master pipeline: 243,464s (mix, derivados, pixel QA, render, mux e decode). Três derivados de seta, um simultâneo; cache inicial miss nos três, repetição hit nos três; mix miss/hit. Pico de sete recursos Engine3D por shot.

## X. Production issues

production-issues.json: conflito de duração resolvido por escolha humana; bloqueio de aprovação resolvido por lote; repetição HIGH, reinício de porta MEDIUM, caption timing MEDIUM, dois BROLL_GAP MEDIUM. Sem expansão de registry. Gaps médios são documentados e não abrem nova fase.

## Y. Repetition/rhythm

30.79 cortes/min. visual-rhythm.json registra câmera, templates consecutivos, resource sets e distribuição de duração. Todos shots na faixa preferida, porém várias tomadas mantêm quase o mesmo tamanho/posição do ator. Guardrails não atribuem nota estética automática.

## Z. B-roll gaps

BROLL_REQUEST permanece PLAN_ONLY; nenhuma mídia externa solicitada/executada. Carros congelados (yakutsk_cold) e atividade de pesquisadores (vostok_people) seriam os ganhos mais claros. Três beats adicionais se beneficiariam de vida cotidiana/ambiente/metáfora visual. Classificações são avaliação autoral dos frames, não modelo estético.

## AA. Higgsfield opportunity map

18 beats em higgsfield-opportunity-map.json: 8 ENGINE3D_GOOD, 5 ENGINE3D_ACCEPTABLE, 3 EXTERNAL_MEDIA_WOULD_HELP, 2 EXTERNAL_MEDIA_STRONGLY_RECOMMENDED. Nenhum provider integrado. As duas recomendações fortes são para representação específica ausente, não para substituir tudo por vídeo gerado.

## AB. Pack opportunity map

pack-opportunity-map.json cobre os 18 beats. Reuso contextual de whoosh/impact/riser e seta já atende marcações; overlays/transições auditados podem acrescentar acabamento, mas não resolvem atuação, blocking ou carros ausentes. Não houve rescan do pack nem importação de novos assets.

## AC. Registry counts

Engine3D 49; SFX 8; visual 5. Nenhuma expansão. source-integrity.json compara hashes de todos os arquivos da baseline do início da fase; mudanças de fases anteriores preservadas. Scripts de produção e evidências ficam em out; relatório na raiz.

## AD. Tests

Checks exigidos registrados com exit code, tempo e log em out/engine3d/phase12/checks.json. typecheck; check:engine3d; check:editorial; check:sound; check:visual; engine3d:catalog. Sem novos testes unitários porque não houve novo contrato nem mudança do core. Testes de integração existentes continuam verificando mixer e compositor reais.

Resultados registrados: typecheck PASS; engine3d 293/293; editorial 46/46; sound 35/35; visual 37/37; catálogo 49. As suítes se sobrepõem; não somar os totais como testes únicos.

## AE. Final master

cold-places-master.mp4 validado: 2455 frames, 81,833333s, H264/AAC, 480×854, 30fps, 48k estéreo; decode integral PASS. Versões voice-only, sound-design e full-editorial preservadas. Não publicado.

## AF. Honest quality assessment

Avaliação abaixo é crítica autoral baseada nas 43 imagens e dados de edição; escuta/percepção humana contínua do master permanece recomendada. Métricas de loudness não demonstram qualidade de sound design.

| Dimensão | Nota | Evidência | Limitação principal |
|---|---|---|---|
| STORYTELLING | GOOD | Ranking e valores presentes, revelação precedida de pausa | Imagens pouco específicas em trechos factuais |
| PACING | ACCEPTABLE | Shots 1,3–2,47s e pausa explícita | 81,8s e cortes visualmente similares |
| VISUAL VARIETY | WEAK | Cinco ambientes, sete câmeras, props distintos | Ator central e tamanho repetem |
| CHARACTER QUALITY | ACCEPTABLE | Caio consistente e reconhecível | Rosto/atuação limitados |
| ENVIRONMENT QUALITY | WEAK | Contextos de inverno/abrigo/lab separados | Muitos fundos planos e genéricos |
| MOTION QUALITY | WEAK | Ações existentes executam intenções | Gestos simples e ação reiniciada por shot |
| CAMERA QUALITY | ACCEPTABLE | Sete câmeras, shake restrito | Variações pequenas não criam cobertura expressiva |
| CAPTION QUALITY | ACCEPTABLE | Texto legível e agrupado | Timing estimado; sem alinhamento palavra a palavra |
| SOUND DESIGN | ACCEPTABLE (provisório) | Dez cues curtos, ganhos conservadores, ducking | Exige escuta humana do conjunto; QA não é nota perceptual |
| VISUAL POLISH | WEAK | Temperaturas e ranking legíveis; seta pontual | Pouca profundidade e atuação |
| OVERALL COHERENCE | ACCEPTABLE | Protagonista, paleta e ranking consistentes | Repetição limita atenção |

**Maior gargalo perceptível, único:** pouca variedade de atuação e blocking, mesmo quando há cortes. Não chamar o vídeo de premium apenas porque renderizou.

**Higgsfield resolveria significativamente? PARCIALMENTE.** Ajuda muito carros/pesquisadores, moderadamente três beats de contexto; os outros 13 continuam dependentes de atuação/composição. Não resolve sozinho o padrão recorrente do protagonista.

## AG. Top 10 limitations

1. Blocking central repetitivo.
2. Expressões faciais limitadas.
3. Ação da porta reinicia entre tomadas.
4. Carros congelados ausentes.
5. Pesquisadores representados genericamente.
6. Fundos pouco específicos.
7. Timing de captions estimado.
8. Cortes com variação visual pequena.
9. Tags emocionais não controlam prosódia diretamente.
10. Duração maior que a faixa original, com exceção humana explícita.

## AH. Next recommended phase

**E) motion/camera**, uma única prioridade. Melhorar blocking, continuidade das ações e cobertura expressiva antes de ampliar pack/registry ou adicionar música. Base: repetição visível em todos os contact sheets, inclusive beats que não precisam de mídia externa. Não implementar a próxima fase; parar ao concluir o master e este relatório.
