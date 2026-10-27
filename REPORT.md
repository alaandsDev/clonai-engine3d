# Relatório de entrega · Engine3D

Implementação local criada do zero em `C:\Users\aland\Desktop\projects\clonai`, em 27/10/2026. O fluxo JSON → compilador → renderer genérico → MP4 foi executado com a demonstração solicitada, inclusive narração real. Nenhum renderer específico para o roteiro foi criado.

## A–B · Stack e estrutura

- TypeScript 5.7.3, React/React DOM 18.3.1, Three.js 0.170.0, R3F 8.18.0.
- Remotion, CLI, renderer, bundler e @remotion/three 4.0.539, todos na mesma versão.
- tsx 4.23.15, edge-tts 7.3.1, Python 3.14.4 e Node 24.15.0 neste PC.
- ffprobe/ffmpeg distribuídos com o compositor do Remotion. Nenhuma instalação global de ffprobe é necessária no Windows.
- Dependências fixadas em package.json e package-lock.json; override Zod 4.6.6 corrige o advisory transitivo encontrado na auditoria. `npm audit`: **zero vulnerabilidades** na verificação final. Não foi executado npm audit fix.
- Código em `src/engine3d`, entry Remotion em `src/index.tsx`, CLI em `cli`, testes em `tests`, planos em `examples`, mídia em `out/engine3d`, cache em `public/audio`.
- Git inicializado, checkpoints locais; nenhum remote configurado e nada publicado.

## C–H · Biblioteca

| Tipo | Contagem | Recursos |
|---|---:|---|
| Character | 6 | CHAR_ROBOT_001, CHAR_BLOB_001, CHAR_SCOUT_001, CHAR_CAIO_001, CHAR_LIA_001, CHAR_ZOMBIE_001 |
| Environment | 9 | ENV_SPACE_001, ENV_LAB_001, ENV_FOREST_001, ENV_OCEAN_001, ENV_CITY_001, ENV_RUINED_STREET_001, ENV_SHELTER_001, ENV_DEAD_FOREST_001, ENV_WINTER_001 |
| Prop | 14 | PROP_PHONE_001, PROP_FLASHLIGHT_001, PROP_MICROPHONE_001, PROP_CAMERA_001, PROP_RADIO_001, PROP_BACKPACK_001, PROP_MEDKIT_001, PROP_BOTTLE_001, PROP_MAP_001, PROP_CROWBAR_001, PROP_HATCHET_001, PROP_LANTERN_001, PROP_DOOR_001, PROP_THERMOMETER_001 |
| Action | 10 | ACTION_IDLE_001, ACTION_WAVE_001, ACTION_JUMP_001, ACTION_DANCE_001, ACTION_THINK_001, ACTION_WALK_001, ACTION_OPEN_DOOR_001, ACTION_POINT_001, ACTION_LOOK_001, ACTION_RUN_001 |
| Camera | 7 | CAM_PUSH_IN_001, CAM_PULL_OUT_001, CAM_ORBIT_001, CAM_PAN_LEFT_001, CAM_PAN_RIGHT_001, CAM_SHAKE_001, CAM_STATIC_001 |
| VFX | 3 | VFX_SNOW_001, VFX_COLD_BREATH_001, VFX_FROST_001 |
| ScenePreset | 0 | Não foram necessários presets para a demonstração |

**Total: 49 recursos.** Caio/Lia/Zombie compartilham o humano procedural. Lia tem roupa turquesa, detalhe amarelo e cabelo distinguível; Caio mantém cabeça escura, casaco vermelho, calça azul e botas/luvas escuras. Door abre pelo pivot da dobradiça e aceita progresso intermediário. Thermometer aceita valores negativos. Run tem cadência, amplitude e inclinação diferentes de Walk. Snow limita-se a 80 partículas por binding; ColdBreath/Frost usam bindings de alvo.

## I–K · Anchors, Registry e catálogo

Head, face, leftHand, rightHand e chest de Caio/Lia derivam do mesmo rig usado para construir a geometria e acompanham pose e transforms. A mão que abre a porta é escolhida pelo lado do alvo; há teste numérico de contato com a maçaneta transformada. `supportsAnchor` consulta metadata. Blob não anuncia mãos nem os gestos Wave/Think.

API: getById, listByType, searchByTags, has e resolve. Resultados de resolução são explícitos (ok/NOT_FOUND/UNSUPPORTED/DEPRECATED). Catálogo serializável em `out/engine3d/catalog.json`, sem funções ou caminhos absolutos. REUSE BEFORE CREATE documentado em AGENTS.md e guia da engine.

## L–P · ShotSpec, Builder, DirectorPlan, Compiler e Sequence Renderer

ShotSpec separa resourceId de instanceId, aceita várias instâncias do mesmo recurso e rejeita IDs de instância duplicados. Valida transforms, duração, parâmetros fechados, bindings, anchors, compatibilidade e janelas normalizadas. Defaults explícitos de transform. Erros são emitidos antes de empacotar/renderizar.

DirectorPlan resolve cast, ordena cenas/shots, herda environment da Scene, verifica continuidade declarada de props e compila intervalos de frames contíguos. Somente CUT é suportado; troca silenciosa de cast e transição não suportada falham. visualIntent não executa comportamento. Uma Scene pode ter múltiplos Shots.

ProceduralShot monta qualquer ShotSpec. SequenceRenderer usa Remotion Sequence para os shots e uma faixa de áudio por Scene. Os mesmos componentes atendem todos os planos e as galerias do Studio. Nenhum arquivo ColdOpeningScene.tsx ou equivalente existe.

## Q–T · Narração, cache, captions e storyboard

- EdgeTtsNarrationProvider executado de verdade com voz pt-BR-AntonioNeural.
- Texto editorial preservado no manifest e tags removidas do spokenText.
- Uma síntese para a Scene: **5,784 s reais**, medidos com ffprobe; 174 frames de timeline a 30 fps.
- Cache SHA-256 com texto falado, voz, rate, pitch, provider e versão. CACHE MISS e CACHE HIT foram observados. Arquivo temporário é medido antes de ser promovido ao cache.
- FakeNarrationProvider produz WAV silencioso determinístico para testes offline. Nunca substitui edge-tts automaticamente.
- Timing por segmentos com origem declarada **estimated_proportional**. A duração total vem do áudio, não de estimativa por palavras. Não há alegação de alinhamento real por palavra.
- Captions em até três palavras por cue, pill escura, texto grande e margem inferior segura.
- `out/engine3d/storyboard.json`: cenas, shots, narração, intenção, recursos, frames, áudio e cues. `audio-manifest.json`: texto editorial/falado, provider, voz, duração, caminho relativo, chave e origem do timing.
- Na compilação narrada final, shots ocupam `[0,52)` e `[52,174)`, sem gaps ou overlaps. Visual fixo: `[0,90)` e `[90,240)`.

## U · Testes

**124 testes aprovados, zero falhas, zero skips.** Não se declara a contagem de 300 testes do outro computador.

Cobertura inclui os 49 IDs, categorias/tags/resolução, catálogo serializável, anchors de Caio/Lia, parâmetros Door/Thermometer/Snow, determinismo, câmeras, diferenças de Run/Walk, contato mão/maçaneta, defaults/transforms, bindings, planos, continuidade, timeline, múltiplas Scenes, cache, WAV fake, ffprobe real, captions e manifest. Há regressão para evitar shots de zero frames em áudio curto e segmentos desiguais.

Fixtures de falha cobrem recursos desconhecidos em todas as categorias, instância duplicada, timing/duração/transform inválidos, ação incompatível, ator/alvo ausente, anchor desconhecido, parâmetro desconhecido, troca de cast, continuidade incompatível, transição não suportada, narração vazia e duração de áudio inválida. Campos inesperados e nomes herdados do prototype são rejeitados.

`npm run typecheck` aprovado. As galerias character/environment/prop compilam todos os recursos. Testes unitários não chamam internet. Integração edge-tts foi executada separadamente e com sucesso.

## V–X · Previews e MP4s

Seis PNGs gerados e inspecionados em `out/engine3d/previews`: opening-start/middle/end e frozen-start/middle/end. Ajustados enquadramento, lado de contato da mão, posição da porta e intensidade do push-in após inspeção. Personagem não corta a borda no fim do primeiro shot; captions permanecem dentro da área segura.

Metadados **medidos com ffprobe**, não inferidos da configuração:

| Arquivo | Duração do contêiner | Frames de vídeo | FPS | Resolução | Vídeo | Áudio |
|---|---:|---:|---:|---|---|---|
| out/engine3d/cold-opening.mp4 | 8,000 s | 240 | 30 | 480×854 | H.264 | sem faixa |
| out/engine3d/cold-opening-narrated.mp4 | 5,803 s | 174 | 30 | 480×854 | H.264 | AAC |

Vídeo narrado tem exatamente 5,800 s de vídeo. O contêiner mede 5,803 s devido à duração da faixa AAC. MP3 de origem tem 5,784 s. A resolução segue o padrão solicitado 480×854, aproximação em pixels pares de 9:16.

## Y · Comandos

```powershell
npm run typecheck
npm run check:engine3d
npm run engine3d:catalog
npm run engine3d:search -- --type prop --tag door
npm run engine3d:studio
npm run engine3d:resolve-shot -- examples/shot.json
npm run engine3d:director -- examples/cold-opening.json
npm run engine3d:previews -- examples/cold-opening.json
npm run engine3d:render-director -- examples/cold-opening.json
npm run engine3d:render-director -- examples/cold-opening.json --narrated
```

Um novo vídeo exige outro DirectorPlan JSON e o mesmo comando de render, sem TSX novo.

## Z · Limitações atuais

Animação ainda simples: membros geométricos sem articulação de cotovelo, expressões faciais limitadas, sem IK complexo, sem física universal, sem transições além de CUT. O visual é toon procedural de baixo custo. Ambientes são minimalistas; Ocean não simula água. Frost é um conjunto de cristais estilizados próximo do anchor, não simulação física de congelamento. Render é determinístico para dados/frame/fps no mesmo ambiente; GPUs/drivers distintos podem variar pixels.

Sincronia de segmentos/captions é proporcional estimada, sem boundaries de palavra. Tags de emoção são removidas, não sintetizadas. A primeira síntese edge-tts exige rede externa; não é síntese de voz offline. Continuidade valida os estados declarados, sem transportar física automaticamente. Catálogo ainda não tem scene presets. Preview PNGs representam a timeline visual fixa; frames da timeline narrada têm a duração ajustada ao áudio.

## AA–AB · Próximos recursos e arquivos para revisão

Prioridades para ampliar narrativa: braços articulados com limite de alcance; anexar props às mãos; expressões e gestos faciais; presets genéricos de composição; boundaries de fala verificados; keyframes declarativos de movimento e iluminação.

Arquivos principais: `examples/cold-opening.json`, `src/engine3d/contracts.ts`, `schema.ts`, `registry.ts`, `validation.ts`, `director.ts`, `motion.ts`, `library.tsx`, `renderer.tsx`, `audio/narration.ts`, `cli/main.ts`, `tests/engine.test.ts`, `tests/regressions.test.ts`, `README.md` e `AGENTS.md`.
