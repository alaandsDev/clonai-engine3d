# Clonai · Engine3D local

Engine procedural para vídeos verticais. **Codex → DirectorPlan JSON → validação/compilação → Three/R3F → Remotion → edge-tts → MP4 H.264.** O aplicativo executa direção estruturada e não chama LLMs.

## Executar

Requisitos: Node 22 ou superior, Python 3.10 ou superior e acesso à internet para instalar dependências, baixar o navegador de render e sintetizar a primeira narração. Os visuais são locais; `edge-tts` usa o serviço online de voz da Microsoft, sem chave de API. Áudio em cache pode ser reutilizado offline.

```powershell
npm ci
python -m pip install -r requirements.txt
npm run typecheck
npm run check:engine3d
npm run engine3d:catalog
npm run engine3d:studio
```

O Studio possui DirectorSequence, CharacterPreview, ResourcePlayground, EnvironmentPreview e ShotBuilder. As galerias percorrem todos os recursos da categoria. Para editar direção, altere JSON e execute o CLI; não escreva cenas React para cada vídeo.

```powershell
# Inspeção e compilação sem render
npm run engine3d:search -- --type prop --tag door
npm run engine3d:director -- examples/cold-opening.json
npm run engine3d:resolve-shot -- examples/shot.json

# Seis PNGs: início, meio e fim de cada shot
npm run engine3d:previews -- examples/cold-opening.json

# Vídeo visual, duração fixa de 8 segundos
npm run engine3d:render-director -- examples/cold-opening.json

# Uma faixa de voz por Scene, duração guiada pelo áudio e captions
npm run engine3d:render-director -- examples/cold-opening.json --narrated
```

Saídas: `out/engine3d/cold-opening.mp4`, `cold-opening-narrated.mp4`, `previews/`, `catalog.json`, `storyboard.json` e `audio-manifest.json`. Storyboard e manifest representam a última compilação. O CLI não altera o plano de entrada.

Para outro vídeo, copie o JSON de exemplo, troque ID/título/narração, consulte catálogo e ajuste shots. `format` aceita largura/altura pares e fps inteiro positivo; padrão do exemplo: 480×854, 30 fps. `timingMode: narration` sintetiza áudio automaticamente; `fixed` usa `durationSeconds`. `--narrated` muda a execução para narration. `--fake` junto de `--narrated` gera WAV silencioso apenas para diagnóstico, nunca voz simulada.

## Biblioteca

| Categoria | Quantidade | Recursos |
|---|---:|---|
| Characters | 6 | Robot, Blob, Scout, Caio, Lia, Zombie |
| Environments | 9 | Space, Lab, Forest, Ocean, City, Ruined Street, Shelter, Dead Forest, Winter |
| Props | 15 | Phone, Flashlight, Microphone, Camera, Radio, Backpack, Medkit, Bottle, Map, Crowbar, Hatchet, Lantern, Door, Thermometer, Car |
| Actions | 10 | Idle, Wave, Jump, Dance, Think, Walk, Open Door, Point, Look, Run |
| Cameras | 7 | Push In, Pull Out, Orbit, Pan Left, Pan Right, Shake, Static |
| VFX | 3 | Snow, Cold Breath, Frost |
| Scene presets | 0 | A composição inicial usa recursos diretamente |

Total: **50**. A Fase 14 acrescentou somente `PROP_CAR_001`; os 49 IDs anteriores permanecem. Não corresponde a uma cópia byte a byte do projeto de outro computador. O código e a contagem real de testes desta implementação estão neste repositório.

Direção contínua e demonstrações procedurais usam a composição `DirectedSequence`: consulte [DIRECTED.md](src/engine3d/DIRECTED.md) e [DEMONSTRATION.md](src/engine3d/DEMONSTRATION.md). Exemplos JSON estão em `examples/demonstration/`; `npm run check:demonstration` verifica o novo contrato. O runtime não chama LLMs nem atualiza o master completo automaticamente.

## Arquitetura e revisão

`src/engine3d/contracts.ts` define contratos serializáveis; `schema.ts` verifica estrutura e campos; `registry.ts` descreve a biblioteca e compatibilidade; `validation.ts` valida bindings, parâmetros e transforms; `director.ts` compila cast, cenas, continuidade, frames e captions; `motion.ts` calcula poses/anchors/câmeras; `library.tsx` contém as geometrias compartilhadas; `renderer.tsx` monta qualquer ShotSpec/Sequence; `audio/narration.ts` fornece voz/cache/ffprobe; `cli/main.ts` orquestra arquivos e render.

Consulte [guia da engine](src/engine3d/README.md) e [regras para agentes](AGENTS.md).

## Limites desta versão

Hardening da Fase 6B: consulte [PHASE6B_REPORT.md](PHASE6B_REPORT.md). A composição genérica agora usa uma galeria da biblioteca como default e não importa exemplos. `engine3d:director` e `render-director` continuam aceitando o JSON de demonstração explicitamente ou como default da CLI.

Testes rápidos: `npm run check:engine3d`. Integração/render (mais lento, provider WAV fake por padrão): `npm run check:engine3d:render`. Para executar a mesma integração com o edge-tts real em PowerShell:

```powershell
$env:ENGINE3D_REAL_TTS = '1'
npm run check:engine3d:render
Remove-Item Env:ENGINE3D_REAL_TTS
```

Os novos testes independentes da demo verificam regressões H01–H04, paths, tipos/bindings, transforms analíticos, executores e mídia real. Os resultados da fase ficam em `out/engine3d/phase6b/`. `npx tsx cli/phase6b-evidence.ts` recompõe os JSONs de evidência a partir dos logs e das sondagens matemáticas.

Paths de saída passam por `safeArtifactName`/`resolveSafeOutputPath`. IDs lógicos não são caminhos; para escrever artefatos, a política exige nomes ASCII alfanuméricos com `_`, `-` ou ponto interno, sem separadores, segmentos de escape ou nomes reservados do Windows. Inputs hostis falham com UNSAFE_OUTPUT_PATH.

Limites por shot, definidos em `src/engine3d/limits.ts`: 8 personagens, 32 props, 32 actions, 12 VFX e 160 partículas de neve somadas (80 por binding). Exceder os limites produz PERFORMANCE_LIMIT. Captions exigem ao menos um frame por cue e falham explicitamente com CAPTION_DURATION_TOO_SHORT em vez de descartar palavras.

- Animação cartoon simples, sem IK complexo ou física. Não há transições além de CUT.
- Cenários são minimalistas; Ocean é um plano estilizado, sem simulação de água. Não há modelos ou texturas baixados.
- Segmentação de shots e captions é **estimated_proportional**, usando o áudio real para a duração total; não é alinhamento palavra a palavra.
- Tags editoriais e `(PAUSA)` são removidas antes de falar; não sintetizam emoções ou silêncio de duração específica.
- Continuidade exige declarar estado inicial compatível com o estado final anterior. O motor não inventa nem transporta física entre shots.
- O cache usa texto falado, voz, rate, pitch, provider e versão do contrato. A primeira síntese exige rede; falhas não substituem voz por fake silenciosamente.
- Snow tem até 80 partículas por binding. O determinismo é por dados/frame; diferenças de GPU/driver podem alterar pixels entre computadores.
- O caminho padrão do ffprobe atende Windows. Em outra plataforma, defina `FFPROBE_PATH`; `PYTHON` permite escolher o executável Python.
- Ferramentas opcionais de terceiros podem aparecer como dependências transitivas do Studio; a engine não as invoca.

Próximas extensões úteis: cotovelos articulados com alcance limitado, expressões faciais, anexar props às mãos, presets de composição e boundaries de fala verificados.

## Pesquisa web — Fase 20

`npm run research:web -- <request.json>` executa discovery e downloads públicos com limites, proteção SSRF, robots e snapshots imutáveis. `npm run research:web:replay -- <session.json>` reprocessa esses snapshots offline pelo núcleo factual da Fase 19 e pelo Writer `GROUNDED_ONLY`. A busca MediaWiki é o primeiro provider gratuito; snippets servem somente para descoberta.

Veja [o contrato e as limitações](src/research/web/README.md) e [o relatório da Fase 20](PHASE20_REPORT.md). `npm run check:web-research` executa os testes sem internet. Pesquisa READY, roteiro grounded, prova visual e produção com duração medida são estados distintos; os comandos de pesquisa não renderizam um master automaticamente.
