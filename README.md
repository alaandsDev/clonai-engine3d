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
| Props | 14 | Phone, Flashlight, Microphone, Camera, Radio, Backpack, Medkit, Bottle, Map, Crowbar, Hatchet, Lantern, Door, Thermometer |
| Actions | 10 | Idle, Wave, Jump, Dance, Think, Walk, Open Door, Point, Look, Run |
| Cameras | 7 | Push In, Pull Out, Orbit, Pan Left, Pan Right, Shake, Static |
| VFX | 3 | Snow, Cold Breath, Frost |
| Scene presets | 0 | A composição inicial usa recursos diretamente |

Total: **49**. Não corresponde a uma cópia byte a byte do projeto de outro computador. O código e a contagem real de testes desta implementação estão neste repositório.

## Arquitetura e revisão

`src/engine3d/contracts.ts` define contratos serializáveis; `schema.ts` verifica estrutura e campos; `registry.ts` descreve a biblioteca e compatibilidade; `validation.ts` valida bindings, parâmetros e transforms; `director.ts` compila cast, cenas, continuidade, frames e captions; `motion.ts` calcula poses/anchors/câmeras; `library.tsx` contém as geometrias compartilhadas; `renderer.tsx` monta qualquer ShotSpec/Sequence; `audio/narration.ts` fornece voz/cache/ffprobe; `cli/main.ts` orquestra arquivos e render.

Consulte [guia da engine](src/engine3d/README.md) e [regras para agentes](AGENTS.md).

## Limites desta versão

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
