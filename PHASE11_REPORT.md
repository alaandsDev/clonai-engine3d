# Fase 11 — Editorial Visual Layers + Media Compositor

Concluída em 27/10/2026. **Cinco visuais TESTED, um uso visual aprovado pelo usuário, master real com seta + sound design preservado.**

## A. Objective

Implementada a primeira camada editorial visual externa real, controlada por dados e aprovação contextual. O piloto do frio agora pode exibir uma seta aprovada sobre o mundo procedural e manter o sound design aprovado. Sem expansão para geração, B-roll, música, transições ou pack completo.

## B. Architecture

EditorialEventMap VISUAL_LAYER → MediaAssetRegistry estendido → seleção/contextual approval → VisualCompositionPlan → derivatives verificados → composição Remotion genérica → mux com AAC aprovado da Fase 10. Renderer não escolhe narrativa, arquivo ou modo de blend. Relatórios/contratos anteriores foram revisados antes da implementação. Código novo em src/visual, CLIs visual-inspect/review/pilot e fixtures/testes próprios.

## C. Registry extension

MediaAssetRegistry recebeu extensão genérica aditiva, preservando o default AUDIO/SFX e sua validação anterior. Aceita instâncias visuais/mistas explicitamente tipadas, sem inserir recursos no registry procedural. Source JSON de áudio continua byte-idêntico. Tipos visuais: DUST/LIGHT_LEAK/OVERLAY/GRAPHIC_ELEMENT; subtipo gráfico ARROW/LINE/ICON/STICKER/EMOJI. Caps validados: 4/4/6/12, soma máxima visual 26.

## D. Candidate selection

Cinco candidatos selecionados somente dos catálogos da Fase 7: 1 dust, 1 light leak, 1 overlay e 2 gráficos. Depois foram abertos apenas esses cinco visuais. Critério: amostra pequena, referências já catalogadas, arquivos curtos/leves e função potencial revisável. Não houve scan dos 5,69 GB. Inspeção revelou que o elemento LINE é um anel oval rabiscado: foi classificado como EMPHASIS, sem inventar conexão entre objetos. Setas/ícones não ganham significado específico só pelo filename.

| ID | Fonte relativa | Classificação | Modo proposto |
|---|---|---|---|
| GRAPHIC_ARROW_001 | SETAS/Arrow_001.png | TRUE_ALPHA | ALPHA |
| GRAPHIC_LINE_001 | LINHAS/scribble-freeject.net_0000s_0000_Layer-42.png | TRUE_ALPHA | ALPHA |
| DUST_001 | DUSTS OVERLAYS/7.mp4 | BLACK_BACKGROUND | SCREEN |
| LIGHTLEAK_001 | LIGHT LEAKS/FilmStripBurns_1.mp4 | BLEND_REQUIRED | SCREEN |
| OVERLAY_001 | OVERLAYS/7d3c4b1f0949702e74a2c2d0a00026bd.jpg | BLEND_REQUIRED | SCREEN |

## E. Technical validation

5/5 TESTED: containment lexical/canônico, existência/tamanho/hash, ffprobe, formato/codec/dimensões/fps/duração quando vídeo e decode integral FFmpeg. Imagens também foram decodificadas pelo Pillow. SHA-256 e mtime dos originais ficaram iguais antes/depois da inspeção; pack check final revalidou hashes/decode dos cinco. Metadata, evidências e testes estão nos JSONs. Também foi revalidado o SFX já aprovado usado no master antigo, sem importar outros sons.

## F. Alpha classification

Classificação medida: {'TRUE_ALPHA': 2, 'OPAQUE': 0, 'BLACK_BACKGROUND': 1, 'WHITE_BACKGROUND': 0, 'CHROMA_REQUIRED': 0, 'BLEND_REQUIRED': 2, 'UNKNOWN': 0}. As duas imagens gráficas têm alpha real medido em todos os pixels nativos. Nos vídeos, alpha foi medido sobre todos os frames reduzidos espacialmente a 96×96, com cinco amostras coloridas representativas; não se alegou inspeção nativa pixel a pixel de todo o vídeo. Dust: BLACK_BACKGROUND; light leak/overlay: BLEND_REQUIRED. Extensão/pasta não foram tratadas como prova de transparência.

## G. Composition modes

Enum explícito ALPHA/SCREEN/ADD/MULTIPLY/NORMAL/CHROMA. ALPHA exige TRUE_ALPHA medido. SCREEN/ADD/MULTIPLY/NORMAL possuem executores CSS sobre PNGs verificados; o modo vem da seleção/approval e deve coincidir com o asset, sem escolha automática. CHROMA é reconhecido, mas fica pendente em PLAN_ONLY e falha em STRICT/render por falta de executor seguro. No piloto somente ALPHA é executado; propostas SCREEN dos outros candidatos não significam aprovação.

## H. Stable IDs

GRAPHIC_ARROW_001, GRAPHIC_LINE_001, DUST_001, LIGHTLEAK_001 e OVERLAY_001. IDs são atribuídos, não derivados de path/hash. Registry preserva sourceCatalog/sourceAuditId/contentHash e metadata semântica/técnica. Mudança futura de arquivo/localização é explícita e não renomeia o ID automaticamente. Identidade nunca contém raiz absoluta.

## I. Lifecycle

As cinco entradas continuam TESTED; somente um uso contextual tem approval separado. DISCOVERED/CURATED/TESTED/APPROVED/REJECTED preservados, sem promoção pelo registry. Rejected/unapproved/contexto/role/mode/hash divergentes bloqueiam preparação/render. Licença fica DECLARED como antes: teste e aprovação criativa não certificam direitos.

## J. Review workflow

visual-review contém previews de imagem sobre azul, contact sheets e MP4s em movimento completos dos dois clipes selecionados (15,08 s dust e 1,16 s light leak), reduzidos para review e sem áudio externo. Cada preview registra sourceHash, previewHash, settings e versão FFmpeg. CLI approve/reject exige todos os campos e valida containment/hash do preview. Para vídeo exige movingPreviewAvailable e reviewedMotion=true; contact sheet sozinho não aprova movimento. Nenhum vídeo externo foi aprovado nesta fase.

## K. Human approvals

Aprovação real recebida: **“Aprovo a seta para esse contexto”**, em resposta à proposta GRAPHIC_ARROW_001 / event_thermometer_focus / DIRECTION / ALPHA. Registro HUMAN_thermometer_arrow_001 com reviewer current-user, reason/evidence e hashes exatos do source/preview. Os outros quatro candidatos seguem sem aprovação de uso. Registros locais validam consistência e campos, sem autenticação de identidade ou proteção contra falsificação deliberada por quem edite arquivos. Fixtures HUMAN sintéticas são só testes de dados controlados.

## L. Visual events

VISUAL_LAYER foi adicionado à união editorial existente, com beatId/purpose/anchor e role/durationHint/intensity/placement normalizado. Roles pequenos: ATMOSPHERE, REVEAL, EMPHASIS, DIRECTION, CONNECTION, ENERGY e DISTORTION. O evento não contém filename. compileEditorial mantém VISUAL_LAYER como PLAN_ONLY para o sidecar, sem fallback 3D. Seus outros comportamentos continuam compatíveis e testados.

## M. VisualCompositionPlan

Versão 1, visual-compositor/1.0.0, editorialFingerprint/fps/canvas/totalFrames/safeZone/captionZone/layers/unresolved. Layer inclui eventId/assetId/sourceHash/role/assetType/kind/sourceDuration, start/end exclusivos, timingConfidence, compositionMode/opacity/transform/crop opcional, loop/fades, zOrder/order, overrides explícitos, approvalRef e purpose. Schema fechado, finito e fail-fast em todos os boundaries relevantes.

## N. Resolver

Seleção explícita event → review → asset, sem filesystem implícito, IA, random ou lookup pelo texto da narração. Valida source/role/mode/contexto/lifecycle e gera a mesma composição lógica para os mesmos dados. PLAN_ONLY retém pendências; STRICT_RENDER bloqueia resolução incompleta/CHROMA. Preparação on-demand revalida approvals e hashes antes/depois de usar a raiz externa configurada por CLONAI_MEDIA_ROOT.

## O. Transforms

x/y são canto superior esquerdo normalizado; width/height definem caixa de saída, scale/rotation atuam pelo centro. Bounds rotacionados consideram a proporção do canvas; crop é um rect normalizado na fonte, validado, não uma edição gerada. O piloto usa x=.70/y=.39/w=.18/h=.0542/scale=1/rotation=0. A seta é estática em screen space; não há seguimento automático de anchors 3D/câmera.

## P. Timing

Mesma timeline real da Fase 10: 377 frames / 30fps = 12,566667 s. A seta entra no frame 305 (10.166667 s) e sai no 359 (11.966667 s), intervalo exclusivo de 54 frames/1,8 s. Fade de quatro frames em cada ponta; opacity .9. Âncora WORD ‘sessenta’ continua ESTIMATED, sem novo word boundary no TTS. Não foi criado sistema de keyframes.

## Q. Safe zones

Usada a safe zone normalizada da Fase 9 e canvas 480×854; nenhum limite 1080×1920 foi copiado. Graphics importantes têm bounds escala/rotação dentro da zona, salvo allowUnsafePlacement explícito. Região reservada de caption x=.07/y=.72/w=.86/h=.20 não pode ser ocupada por gráfico sem allowCaptionOverlap explícito. Atmosferas podem ocupar todo o canvas, mas sempre abaixo de caption/texto. É guardrail geométrico conservador, não análise de glifos ou estética.

## R. Z-order

Stack explícito: Engine3D 0 → ATMOSPHERE 10 → GRAPHIC 20 → TEXT 30 → CAPTION 40. Não depende de array/import; ordem dentro do stack é explícita e não pode empatar. Acima de três layers simultâneos é erro. O piloto tem exatamente um layer externo, sem mudar os VFX procedurais.

## S. Captions

SequenceRenderer ganhou slot editorial opcional e z-index explícito para textos/caption; sistema de legenda, fontes, padding, textos e timing ficaram preservados. Captions ficam acima de todas as camadas externas por política. A região foi comparada contra controle sem layer; diferença máxima de 1/255 por canal (arredondamento de composição GPU), abaixo da tolerância documentada 2/255. Não houve diferença significativa/oclusão de caption.

## T. Image compositor

Componente React genérico orientado ao VisualCompositionPlan e bindings verificados. Remotion Img recebe PNG RGBA normalizado, respeitando alpha, crop, transform, opacity/fades e blend explícito. Não existe componente por asset ou imagem externa dentro de Engine3D. PNG/JPG e AVIF são candidatos somente se a ferramenta instalada conseguir decodificá-los; o piloto testou PNG/JPG, sem certificar AVIF neste computador.

## U. Video compositor

Vídeos aprovados/selecionados são normalizados on-demand para sequência PNG RGBA a 480px de largura/fps da composição. Compositor escolhe frame determinístico, sem depender de browser codec arbitrário. NONE exige frames suficientes; LOOP usa módulo; HOLD_LAST exige congelamento explícito. Áudio externo é descartado. Integração controlada gerou H.264 curto e validou 12 PNGs/frame selection/cache. Os vídeos do pack ficaram apenas em review, sem runtime derivative de produção.

## V. Derivatives

Originais intactos. Previews autorizados são review-only, com source/derivative hashes/settings/tool version. Runtime derivatives somente para o asset aprovado usado no plano (seta) e fixtures geradas de testes. PNG RGBA máximo 768px para imagens; sequência 480px para vídeo. Manifest por key contém hash/tamanho de cada frame; fontes são revalidadas. Sem conversão de pastas inteiras, cópia de originais para src/public, geração de mídia ou processamento de outros grupos.

## W. Cache

Fingerprint inclui sourceHash, settings/tool version, camada completa (blend/transform/opacity/crop/timing/loop), approval e visual-compositor/1.0.0; final fingerprint inclui plano e bindings derivados. Valor do piloto: `4213970bd035a36260a14358933d5e1c1be85d5596f5052cf1677491f472c279`. Repeat HIT verificado; integração corrompeu derivado controlado e verificou regeneração. Não inclui raiz absoluta/mtime/nome da máquina. Bindings são por evento, permitindo reutilizar o mesmo asset em contextos diferentes sem ambiguidade. Sem lock concorrente/certificação pixel a pixel entre máquinas.

## X. QA

Antes do render: existência/hash/decode/metadata/alpha-mode, aprovação, timeline/opacity/transform/fades/crop/loop, bounds/z-order/caption zone e integridade dos derivados. Frame QA com controles Remotion resolvidos separadamente: antes frame304 = 0 pixels alterados; durante frame332 = 1164 pixels alterados acima de 2/255; após frame359 = 0. Na caption nenhum pixel excedeu tolerância. Potencial black/empty é flag de brilho médio <1/255, não reprovação de uma cena naturalmente escura; nenhum flag no piloto. Não se alegou julgamento estético.

## Y. Pilot

Mesmo vídeo do frio, sem nova história: mundo procedural/porta/termômetro, narração real edge-tts e SFX_IMPACT_001 já aprovados. Som da Fase 10 foi reutilizado com hashes e aprovação revalidados, sem novos SFX ou síntese. A seta preta aponta à esquerda para o termômetro no beat do valor extremo. O oval é só candidato EMPHASIS; dust/light leak/overlay continuam pendentes. BROLL_REQUEST permanece PLAN_ONLY e é explicitamente excluído.

## Z. Render comparison

Três MP4s: baseline-voice e sound-design são cópias byte-idênticas dos masters da Fase 10; visual-sound-design renderiza a composição nova e copia os pacotes AAC aprovados. ffprobe: H.264/AAC, 480×854, 30/1, 377 frames, áudio 48k/stereo. A/V delta 0.667 ms dentro da tolerância de um frame + um frame AAC. MD5 dos pacotes de áudio igual ao sound-design antigo; não se chamou isso de comparação PCM. Hashes/tamanhos estão em master-files.json. Frame durante o layer foi inspecionado: seta/termômetro, título e caption visíveis.

## AA. Tests

typecheck PASS; check:engine3d 293 PASS = 257 anteriores + 36 novos rápidos visuais. check:editorial 46 PASS; check:sound 35 PASS (34 rápidos + 1 integração controlada); check:visual 37 PASS (36 rápidos + 1 integração controlada). Não somar os subconjuntos como testes distintos: 295 casos distintos nessas suítes principais. Integração gera PNG transparente/opaco e vídeo H.264 sem pack; mede alpha do derivative, cache HIT/corrupção e renderStill real antes/durante/após. check:visual:pack 5/5 PASS e check:visual:render master real PASS. Suítes históricas de render não foram reexecutadas; seus arquivos permanecem inalterados. Checklist React aplicado à integração Remotion, sem migração de stack.

## AB. Registry counts

**Engine3D = 49**: 6 Characters + 9 Environments + 14 Props + 10 Actions + 7 Cameras + 3 VFX + 0 Presets. **MediaAssetRegistry AUDIO/SFX = 8; VISUAL = 5** (DUST1, LIGHT_LEAK1, OVERLAY1, GRAPHIC_ELEMENT2). Contagens separadas, não somadas como se fossem recursos 3D. Caps respeitados.

## AC. Compatibility

Baseline SHA-256 de 59 arquivos preexistentes: mudanças limitadas a sete arquivos autorizados para extensão (contrato/schema/compiler editorial, registry genérico, slot/z-order do renderer, nova composição no entrypoint, scripts package). DirectorPlan/ShotSpec/ProceduralSequence, TTS/provider/config/cache, sound plan/mixer, oito SFX/dados anteriores, registry/biblioteca/executores 3D, testes anteriores e lockfile preservados. Nenhuma dependência instalada/atualizada, commit/push/publicação ou arquivo do usuário avulso alterado. Sem copiar código/prompts/assets do Edit Labs.

## AD. Limitations

Alinhamento de palavras estimado; static screen-space transform não segue objeto/câmera automaticamente. Sem keyframes complexos, chroma executor, estética automática, autenticação de reviewers, masterização nova ou garantia cross-GPU. Alpha de vídeo foi medido com redução espacial, não exaustivamente em resolução nativa. Outros modos/blends são dados explícitos, sem aprovação presumida. Derivatives em sequência PNG podem custar espaço/tempo e cache não tem lock. Caption zone é conservadora, não uma prova para textos arbitrários. Checks de path não eliminam TOCTOU adversarial externo. Apenas cinco visuais foram auditados, não o pack inteiro.

## AE. Next recommendation

Encerrar a Fase 11 e revisar as três versões, placement/timing da seta e legibilidade no tamanho final. Uma fase futura depende de novo pedido. Não foram iniciados Higgsfield, B-roll, música, transições, vídeo de 40–60 s, registry completo ou automatic aesthetic scoring.
