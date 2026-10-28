# Auditoria técnica do bootstrap Engine3D

Data: 27/10/2026. Base auditada: commit e610b82, com três commits locais e nenhum remote. Escopo: auditoria, provas de render e relatório. **Nenhum arquivo de produção, dependência ou teste foi alterado; nenhuma feature foi implementada.** Harnesses e evidências estão em out/engine3d/audit, ignorado pelo Git.

**Veredito:** pipeline JSON → vídeo comprovado com segundo roteiro, narração real e cache real. Bootstrap funcional, mas não aprovado sem ressalvas como engine genérica robusta. Há falhas de validação/execução e fallbacks internos que os 124 testes não detectam. O relatório anterior superestimou a generalidade de anchors e estados. Não foram encontradas evidências de mock substituindo edge-tts na produção.

## A–B. Registry real, contagens e metadata-only

6 characters + 9 environments + 14 props + 10 actions + 7 cameras + 3 VFX + 0 scene presets = **49 entradas de registry**, contagem confirmada. Todos têm status available, mas esse status é atribuído em lote; não representa certificação visual individual.

Há geometria real para os 29 recursos de personagem/ambiente/prop, três VFX reais e sete câmeras com saídas reais (Static é a configuração base). Nove ações têm branches executores. **ACTION_IDLE_001 é somente metadata para comportamento próprio, com NO-OP e pose base do personagem:** não existe implementação de animação Idle dedicada. Pela classificação conservadora desta auditoria, são **48 entradas com implementação executável identificável + 1 entrada de ação implícita/NO-OP**; não são 49 animações ou visuais independentes. Chamar Idle de estado estático é possível, mas isso não deve ocultar a ausência de executor. Radio usa o else do Prop, Flashlight/Lantern compartilham exatamente o visual; há reutilização real, não 49 componentes independentes.

A inspeção avaliou todos os ramos de biblioteca e expandiu a árvore React dos componentes puros para contar meshes/geometrias, sem adicionar recursos. Isso prova execução estrutural; não equivale a renderizar uma imagem de cada recurso. Evidência: resource-evidence.json.

### character — 6

| ID | Arquivo de implementação | Status | Tags exatas | Implementação real / metadata | Compatibilidade relevante |
|---|---|---|---|---|---|
| CHAR_ROBOT_001 | src/engine3d/library.tsx:73 (Character) | available | character, robot | REAL: corpo comum, cabeça box e antena | head, face, leftHand, rightHand, chest |
| CHAR_BLOB_001 | src/engine3d/library.tsx:73 (Character) | available | character, blob | REAL: volume blob e cabeça/olhos; sem membros | head, face, chest |
| CHAR_SCOUT_001 | src/engine3d/library.tsx:73 (Character) | available | character, scout | REAL: humano comum com chapéu e casaco amarelo | head, face, leftHand, rightHand, chest |
| CHAR_CAIO_001 | src/engine3d/library.tsx:73 (Character) | available | character, caio | REAL: humano comum vermelho/azul, cabeça escura | head, face, leftHand, rightHand, chest |
| CHAR_LIA_001 | src/engine3d/library.tsx:73 (Character) | available | character, lia | REAL: humano comum turquesa, cabelo e detalhe amarelo | head, face, leftHand, rightHand, chest |
| CHAR_ZOMBIE_001 | src/engine3d/library.tsx:73 (Character) | available | character, zombie | REAL: humano comum com pele/roupa verde | head, face, leftHand, rightHand, chest |

### environment — 9

| ID | Arquivo de implementação | Status | Tags exatas | Implementação real / metadata | Compatibilidade relevante |
|---|---|---|---|---|---|
| ENV_SPACE_001 | src/engine3d/library.tsx:421 (Environment) | available | environment, space | REAL: chão, fundo e 30 estrelas esféricas | sem matriz específica |
| ENV_LAB_001 | src/engine3d/library.tsx:421 (Environment) | available | environment, lab | REAL: chão, parede e bancada | sem matriz específica |
| ENV_FOREST_001 | src/engine3d/library.tsx:421 (Environment) | available | environment, forest | REAL: chão e 12 árvores com 3 cones cada | sem matriz específica |
| ENV_OCEAN_001 | src/engine3d/library.tsx:421 (Environment) | available | environment, ocean | REAL MÍNIMO: plano azul; não simula água | sem matriz específica |
| ENV_CITY_001 | src/engine3d/library.tsx:421 (Environment) | available | environment, city | REAL: chão e 10 blocos de prédios | sem matriz específica |
| ENV_RUINED_STREET_001 | src/engine3d/library.tsx:421 (Environment) | available | environment, ruined, street | REAL MÍNIMO: mesmos blocos, menores; sem destroços | sem matriz específica |
| ENV_SHELTER_001 | src/engine3d/library.tsx:421 (Environment) | available | environment, shelter | REAL MÍNIMO: mesma estrutura do Lab, outra paleta | sem matriz específica |
| ENV_DEAD_FOREST_001 | src/engine3d/library.tsx:421 (Environment) | available | environment, dead, forest | REAL: chão e 12 troncos sem copas | sem matriz específica |
| ENV_WINTER_001 | src/engine3d/library.tsx:421 (Environment) | available | environment, winter | REAL: chão claro, 12 árvores nevadas e luz fria | sem matriz específica |

### prop — 14

| ID | Arquivo de implementação | Status | Tags exatas | Implementação real / metadata | Compatibilidade relevante |
|---|---|---|---|---|---|
| PROP_PHONE_001 | src/engine3d/library.tsx:258 (Prop) | available | prop, phone | REAL: caixa e tela | sem matriz específica |
| PROP_FLASHLIGHT_001 | src/engine3d/library.tsx:258 (Prop) | available | prop, flashlight | REAL COMPARTILHADO: igual Lantern; sem feixe/luz | sem matriz específica |
| PROP_MICROPHONE_001 | src/engine3d/library.tsx:258 (Prop) | available | prop, microphone | REAL: haste e volume superior | sem matriz específica |
| PROP_CAMERA_001 | src/engine3d/library.tsx:258 (Prop) | available | prop, camera | REAL: corpo e lente | sem matriz específica |
| PROP_RADIO_001 | src/engine3d/library.tsx:258 (Prop) | available | prop, radio | REAL VIA FALLBACK: caixas e antena; sem branch RADIO | sem matriz específica |
| PROP_BACKPACK_001 | src/engine3d/library.tsx:258 (Prop) | available | prop, backpack | REAL: corpo oval e bolso | sem matriz específica |
| PROP_MEDKIT_001 | src/engine3d/library.tsx:258 (Prop) | available | prop, medkit | REAL: caixa e cruz | sem matriz específica |
| PROP_BOTTLE_001 | src/engine3d/library.tsx:258 (Prop) | available | prop, bottle | REAL: cilindro e tampa | sem matriz específica |
| PROP_MAP_001 | src/engine3d/library.tsx:258 (Prop) | available | prop, map | REAL: placa e linhas | sem matriz específica |
| PROP_CROWBAR_001 | src/engine3d/library.tsx:258 (Prop) | available | prop, crowbar | REAL MÍNIMO: haste e barra perpendicular | sem matriz específica |
| PROP_HATCHET_001 | src/engine3d/library.tsx:258 (Prop) | available | prop, hatchet | REAL: haste e lâmina; compartilha branch Crowbar | sem matriz específica |
| PROP_LANTERN_001 | src/engine3d/library.tsx:258 (Prop) | available | prop, lantern | REAL COMPARTILHADO: igual Flashlight; sem luz emitida | sem matriz específica |
| PROP_DOOR_001 | src/engine3d/library.tsx:258 (Prop) | available | prop, door | REAL: batente + folha com pivot e maçaneta | openProgress [0,1]; OpenDoor Caio/Lia |
| PROP_THERMOMETER_001 | src/engine3d/library.tsx:258 (Prop) + renderer.tsx:69 | available | prop, thermometer | REAL: corpo/coluna/bulbo + número em overlay | value [-150,150] |

### action — 10

| ID | Arquivo de implementação | Status | Tags exatas | Implementação real / metadata | Compatibilidade relevante |
|---|---|---|---|---|---|
| ACTION_IDLE_001 | src/engine3d/motion.ts:32 (poseAt) | available | action, idle | METADATA + NO-OP: sem branch executor; pose base estática | ROBOT, BLOB, SCOUT, CAIO, LIA, ZOMBIE |
| ACTION_WAVE_001 | src/engine3d/motion.ts:32 (poseAt) | available | action, wave | REAL: rotação oscilante do braço direito | ROBOT, SCOUT, CAIO, LIA, ZOMBIE |
| ACTION_JUMP_001 | src/engine3d/motion.ts:32 (poseAt) | available | action, jump | REAL: deslocamento vertical senoidal | ROBOT, BLOB, SCOUT, CAIO, LIA, ZOMBIE |
| ACTION_DANCE_001 | src/engine3d/motion.ts:32 (poseAt) | available | action, dance | REAL: oscilação lateral, braços e inclinação | ROBOT, BLOB, SCOUT, CAIO, LIA, ZOMBIE |
| ACTION_THINK_001 | src/engine3d/motion.ts:32 (poseAt) | available | action, think | REAL MÍNIMO: braço direito em ângulo fixo | ROBOT, SCOUT, CAIO, LIA, ZOMBIE |
| ACTION_WALK_001 | src/engine3d/motion.ts:32 (poseAt) | available | action, walk | REAL: membros/bob e translação opcional | ROBOT, BLOB, SCOUT, CAIO, LIA, ZOMBIE |
| ACTION_OPEN_DOOR_001 | src/engine3d/motion.ts:32 (poseAt) + library.tsx:269 | available | action, open, door | REAL: mão em maçaneta e progresso da porta; defeitos H03/H04 | CAIO, LIA |
| ACTION_POINT_001 | src/engine3d/motion.ts:32 (poseAt) | available | action, point | REAL: braço aponta com comprimento 0,8 | CAIO, LIA |
| ACTION_LOOK_001 | src/engine3d/motion.ts:32 (poseAt) | available | action, look | REAL MÍNIMO: yaw da cabeça; sem pitch | CAIO, LIA |
| ACTION_RUN_001 | src/engine3d/motion.ts:32 (poseAt) | available | action, run | REAL: cadência/amplitude/bob/lean diferentes de Walk | CAIO, LIA |

### camera — 7

| ID | Arquivo de implementação | Status | Tags exatas | Implementação real / metadata | Compatibilidade relevante |
|---|---|---|---|---|---|
| CAM_PUSH_IN_001 | src/engine3d/motion.ts:168 (cameraAt) | available | camera, push, in | REAL: Z diminui | strength [0,3] |
| CAM_PULL_OUT_001 | src/engine3d/motion.ts:168 (cameraAt) | available | camera, pull, out | REAL: Z aumenta | strength [0,3] |
| CAM_ORBIT_001 | src/engine3d/motion.ts:168 (cameraAt) | available | camera, orbit | REAL: X senoidal/Z cossenoidal | strength [0,3] |
| CAM_PAN_LEFT_001 | src/engine3d/motion.ts:168 (cameraAt) | available | camera, pan, left | REAL: X de câmera/alvo diminui | strength [0,3] |
| CAM_PAN_RIGHT_001 | src/engine3d/motion.ts:168 (cameraAt) | available | camera, pan, right | REAL: X de câmera/alvo aumenta | strength [0,3] |
| CAM_SHAKE_001 | src/engine3d/motion.ts:168 (cameraAt) | available | camera, shake | REAL: senoides determinísticas em X/Y | strength [0,3] |
| CAM_STATIC_001 | src/engine3d/motion.ts:168 (cameraAt) | available | camera, static | REAL ESTÁTICO: posição/alvo base; sem branch dedicado | strength [0,3] |

### vfx — 3

| ID | Arquivo de implementação | Status | Tags exatas | Implementação real / metadata | Compatibilidade relevante |
|---|---|---|---|---|---|
| VFX_SNOW_001 | src/engine3d/library.tsx:495 (Vfx) | available | vfx, snow | REAL: até 80 esferas por binding | intensity [0,1] |
| VFX_COLD_BREATH_001 | src/engine3d/library.tsx:495 (Vfx) | available | vfx, cold, breath | REAL: 5 volumes translúcidos por binding | actor + face |
| VFX_FROST_001 | src/engine3d/library.tsx:495 (Vfx) | available | vfx, frost | REAL: 10 cristais, 20 caixas por binding; default do Vfx | actor/anchor ou target prop; validação permissiva |

### scenePreset — 0

Nenhum recurso registrado.

## C. Prova data-driven e procura por hardcodes

Foi criado somente `out/engine3d/audit/proof-plan.json`, com Lia, Winter, Thermometer(value=-63), Point, Look, Snow e Orbit. Narração: “Naquele lugar, o termômetro marcava sessenta e três graus negativos.” O harness `.ts` chama o bundle/renderer existentes; não define componente React/TSX nem novo recurso.

Resultado: `out/engine3d/audit/lia-thermometer.mp4`, 152 frames, 480×854, 30 fps, H.264/AAC, vídeo 5,066667 s, contêiner 5,077 s, áudio de origem 5,064 s. Os frames caption-20.png e caption-60.png foram gerados e inspecionados: Lia/termômetro/número/legendas visíveis.

A busca por cold-opening, coldOpening, ColdOpening, cold places e coldPlaces abrangeu fontes, exemplos, testes, docs e saídas geradas, excluindo binários, `.git` e dependências de terceiros. Resultado integral em `demo-references.txt`.

- `examples/cold-opening.json`: fixture/direção, legítimo.
- `tests/*.test.ts`: fixture compartilhada. Testes estão fortemente acoplados ao exemplo.
- README.md/REPORT.md e arquivos em out: documentação e artefatos, sem lógica de cena.
- `cli/main.ts:25`: plano default quando nenhum argumento é dado, não um renderer específico.
- **`src/index.tsx:3–8`: import e compilação obrigatórios da demo no módulo de entrada.** Embora `inputProps.sequence` substitua os dados da composição, todo bundle ainda precisa que a demo exista e compile. Portanto, não é correto afirmar que o fluxo não tem nenhuma dependência de cold-opening.json. Não há branch visual específico para a frase, mas há acoplamento de bootstrap ao exemplo.
- Não existem ColdOpeningScene.tsx, ColdOpening.tsx ou ColdPlacesScene.tsx. `library.tsx`, `motion.ts` e `renderer.tsx` não contêm a frase ou o nome da demo.

**Conclusão:** render visual realmente data-driven, com prova independente bem-sucedida. Falha parcial de isolamento: o entrypoint ainda depende do JSON default da demo.

## D. Contratos e pipeline reais

Contratos definidos em `src/engine3d/contracts.ts`:

| Contrato | Estrutura real |
|---|---|
| DirectorPlan | id, title, format{width,height,fps}, style:string, cast, timingMode:fixed/narration, scenes[] |
| Cast | `Record<string,string>`, nome de cast → resourceId de character |
| DirectorScene | id, order:number, narration:string, environment{resourceId}, shots[] |
| DirectorShot | ShotSpec sem environment/characters obrigatórios; adiciona order, environment opcional, characters com castId e resourceId opcional, transition opcional |
| ShotSpec | id, durationSeconds, environment, characters[], props[], actions[], vfx[], camera; onScreenText/visualIntent/narrationSegment opcionais |
| Instance | instanceId, resourceId, position/rotation/scale opcionais, parameters, continuityKey, initialState/finalState escalares |
| Binding | resourceId, start/end, actor/target/anchor, targetPosition/direction, parameters |
| SequenceShot | ShotSpec + sceneId, startFrame, endFrame, durationFrames |
| ProceduralSequence | id/title/fps/width/height/totalDuration/totalFrames, scenes com áudio opcional, shots, captions[] |

Não existe tipo chamado ProceduralShotSpec nem ResolvedProceduralShot: os equivalentes reais são `ShotSpec` e o próprio `ShotSpec` retornado por `resolveShot`, com defaults. Não existe objeto resolvido contendo componentes React ou referências verificadas às implementações. IDs continuam sendo despachados por nome no renderer/biblioteca. `style` e `visualIntent` são dados documentais, sem efeito visual executado.

Fluxo efetivamente executado pelo CLI:

```text
JSON.parse(readFile(...))
→ compileDirectorPlan({...plan,timingMode:'fixed'}) [preflight]
  → planShape → registry via resource → cast/order/continuity
  → resolveShot → shotShape/resource/parameters/compatibility/defaultTransform
→ se narration/--narrated:
  narration(scene) → spokenText → cacheKey → provider.synthesize
  → probeDuration → NarrationTrack[]
→ compileDirectorPlan(plan,tracks)
  → ShotSpec[] normalizados → SequenceShot[] → ProceduralSequence
→ bundle(src/index.tsx) → selectComposition(DirectorSequence,inputProps)
→ renderMedia
→ SequenceRenderer → Remotion Sequence → ProceduralShot
→ ThreeCanvas → Camera/Environment/Character/Prop/Vfx
→ Remotion Audio por Scene + captions HTML → MP4
```

Scenes/shots são ordenados por order; IDs de cenas e shots compartilham o mesmo Set global, mais restritivo que IDs apenas por Scene. Orders precisam ser finitos e únicos dentro de cada lista, mas podem ser negativos/fracionários. Formato exige dimensões pares/fps inteiro positivo, sem impor 9:16. Continuity compara estado declarado, não mede o estado visual no final das ações.

## E. Validation confirmada e lacunas

Sondagens executadas diretamente em `resolveShot`, evidência `probes.json`:

| Entrada inválida | Resultado observado |
|---|---|
| character/environment/prop/action/VFX desconhecido | RESOURCE_NOT_FOUND |
| camera desconhecida | UNSUPPORTED_CAMERA |
| instanceId repetido | DUPLICATE_INSTANCE_ID |
| end > 1 ou start >= end | INVALID_TIMING |
| duração <= 0 | INVALID_DURATION |
| OpenDoor em Robot | INCOMPATIBLE_ACTION |
| anchor desconhecido | UNSUPPORTED_ANCHOR |
| parâmetro não registrado | INVALID_PARAMETER |
| ator/alvo ausente | MISSING_ACTOR / MISSING_TARGET nos caminhos correspondentes; cobertos na suíte |

O fechamento de nomes de campos e parâmetros existe, e nomes herdados do prototype em parameters são rejeitados. Isso não significa validação completa dos valores JSON:

- `onScreenText:{bad:true}` **passa** por resolveShot; React não aceita esse objeto como filho e falhará durante render. Não houve render desse caso; aceitação foi medida e consequência é deduzida do uso como child em renderer.tsx.
- `direction:[0,0,0]` **passa**, embora não defina direção útil.
- Frost com `target` de personagem **passa**; o renderer procura target apenas em props e usa origem. Frost com `actor` de prop sem anchor também passa e termina na origem. Confirmado por validação + leitura do caminho executado.
- Alguns campos conhecidos não têm checagem de tipo: narrationSegment numérico pode causar TypeError no preprocessing, em vez de EngineError; onScreenText e flags vazias também são permissivos.
- `anchor` em ações pode ser aceito e ignorado; o LOOK do teste aceitou leftHand, mas só usa alvo/direção para yaw.
- Não há validação global de conflitos entre ações simultâneas, limites de instâncias/VFX ou schema completo de NarrationTrack no compilador.

## F. Matriz de compatibilidade real

Lida de `registry.ts:99` e serializada em probes.json; sem inferência por aparência:

| Action | Caio | Lia | Robot | Blob | Scout | Zombie |
|---|---|---|---|---|---|---|
| ACTION_OPEN_DOOR_001 | sim | sim | não | não | não | não |
| ACTION_POINT_001 | sim | sim | não | não | não | não |
| ACTION_LOOK_001 | sim | sim | não | não | não | não |
| ACTION_RUN_001 | sim | sim | não | não | não | não |

OpenDoor adicionalmente exige target PROP_DOOR_001. Point/Look exigem target, targetPosition ou direction. Wave/Think excluem Blob; demais ações básicas o incluem. A matriz de metadata é checada antes do render no CLI; o renderer não repete a checagem.

## G. Anchors: o que é real e o que foi superestimado

`motion.ts:16` define rig compartilhado; `Character` e `anchorAt` usam essas dimensões. Não há consulta a refs Three, bounding boxes, geometria avaliada ou matrixWorld de ossos. São fórmulas analíticas com constantes de modelagem.

| Anchor Caio/Lia | Relação com geometria |
|---|---|
| head | [0,2.05,0], centro do mesmo group que contém a cabeça |
| chest | [0,1.25,0], usado diretamente para posicionar o torso |
| face | [0,2.07,0.49], offset aproximado a partir do head; acompanha yaw. Cabeça elipsoidal tem raio Z 0,48, olhos/pupilas avançam além disso. Não é ponto extraído da superfície real |
| leftHand/rightHand em repouso/gesto | Recalculados com shoulder ±0,44 / Y1,48, comprimento 0,57 e rotação Z ±0,3, iguais aos usados na geometria |
| mãos em Point/OpenDoor | Usam handReach/leftHandReach de poseAt, também usados na geometria |

As constantes leftHand/rightHand inicialmente presentes no rig não determinam o resultado final: são sobrescritas pelas fórmulas. O vínculo analítico é real para Caio/Lia, mas afirmar “derivado da geometria real” sem qualificar é forte demais: há coordenadas duplicadas e aproximação do face.

Problemas reproduzidos:

1. Rotação do ator [0.3,0.7,0.4]: mão fica **0,3718996879 unidade** distante da maçaneta. Negar cada Euler na mesma ordem não calcula a inversa geral da rotação XYZ. Mesmo erro aparece no Point com transforms combinados.
2. Porta inicialmente aberta em 0,8: Prop usa max(initial,progresso), mas poseAt usa só progresso. No t=0,25, a mão usa 0,055393586 enquanto porta fica em 0,8; distância **0,7973602804 unidade**.
3. LOOK com ator já girado π/2 e direção mundial +Z mantém headYaw=0, quando o yaw local precisaria compensar −π/2. Y do alvo não produz pitch.
4. ColdBreath/Frost seguem posição do anchor, mas offsets dos efeitos são aplicados em eixos globais; não acompanham orientação da face como um attachment completo.

## H. Determinismo

Busca em src/ e cli/: **zero ocorrências** de Math.random, Date.now, performance.now, setTimeout e requestAnimationFrame no código autoral de render/orquestração. A mesma busca em tests também não encontrou chamadas. As palavras aparecem na documentação como proibições. Dependências React/R3F/Chromium têm infraestrutura própria de scheduling, que não foi classificada como direção procedural autoral. Isso não constitui garantia de determinismo de todo o código de terceiros.

`seeded(n)` usa seno/fracionário; poses e câmera recebem t derivado de frame/(durationFrames−1). Sem relógio real autoral. A distribuição da neve depende de t normalizado do shot, não da duração física em segundos; reproduzível, mas velocidade efetiva varia com a duração do shot.

Render duplo independente com o mesmo bundle/spec, frame **40**, fps **30**, resolução **480×854**, GL angle no mesmo PC:

```text
determinism-1.png SHA-256
8492ba9a859ee1733efb4c74dd46190f11d70aed0ba257e7651fab9b856e544d
determinism-2.png SHA-256
8492ba9a859ee1733efb4c74dd46190f11d70aed0ba257e7651fab9b856e544d
Resultado: IGUAIS
```

Essa prova cobre o frame do segundo roteiro, com neve, gesto, câmera e legenda; não prova todos os frames/recursos nem igualdade entre GPUs, drivers ou máquinas.

## I–K. Edge-TTS, cache e tags de emoção

Fluxo real em `audio/narration.ts`: texto editorial → spokenText → SHA-256 → public/audio → EdgeTtsNarrationProvider → execFile(python,-m edge_tts, argumentos) → MP3 temporário → ffprobe → rename → ffprobe novamente → NarrationTrack. Remotion Audio referencia staticFile(relativeAudioPath) na Scene, sem duplicar voz por Shot.

Configuração preservada: **pt-BR-AntonioNeural, rate +0%, pitch +0Hz**. Cache normal em `public/audio`. Cache key inclui JSON com texto **falado**, voice/rate/pitch, provider e version:1. A chave da demo é `5abdfabac2d40b76dbf4591292d33671db24483f0dcde420e35ae73949588c56`. Não inclui versão instalada do edge-tts nem revisão do serviço online. Arquivo existente é validado em duração, mas conteúdo não tem checksum.

Prova real, em raiz nova de cache somente da auditoria, sem remover o cache da produção:

| Execução | Texto editorial | Resultado | Chave |
|---|---|---|---|
| 1 | [intenso] Você abre a porta. (PAUSA) | MISS, gerado; 2,136 s | add0465e15dfa5887b0d7cacd58cbc2643e1b63f85f2f75387a3ad119346ef5a |
| 2 | mesmo texto/config | HIT, reutilizado; 2,136 s | mesma chave |
| 3 | Você fecha a porta. | MISS, gerado; 2,088 s | 48b3d3b36a838d1682dceb72eb31c213f5e697d3fb12bed9dd90b3d11901ebc7 |

O wrapper de observação delegou ao EdgeTtsNarrationProvider real; foram registradas **duas chamadas reais de síntese para três pedidos**. Evidências: cache-evidence.json e probes.log. Cache de teste em `out/engine3d/audit/cache-real/public/audio`; a configuração de voz não mudou.

O provider recebeu literalmente “Você abre a porta.”, sem “intenso” ou “PAUSA”. Logo, essas palavras editoriais não são enviadas para fala. `(PAUSA)` sozinho gera spokenText vazio e seria rejeitado por narration como NARRATION_EMPTY; não produz silêncio temporizado. Tags reconhecidas são as nove do regex; tags desconhecidas permanecem no texto e podem ser faladas. Não existe síntese emocional.

Não há fallback automático para FakeNarrationProvider. Ele só é selecionado explicitamente por --fake no CLI e por testes. A engine de voz usa o serviço online do edge-tts, não TTS offline. Falhas do processo viram TTS_FAILED; arquivo ausente, duração inválida e erro de ffprobe têm códigos próprios. Riscos não corrigidos: mesmo arquivo temporário por chave em chamadas concorrentes, cache sem lock e timeout de 90 s sem retry.

## L. Algoritmo exato de sincronização

`compileDirectorPlan` usa **comprimento em unidades de string JavaScript** do narrationSegment após spokenText, isto é, caracteres UTF-16, incluindo espaços/pontuação remanescentes; não conta palavras nem boundaries TTS.

Para N shots:

```text
w[i] = max(1, spokenText(narrationSegment[i] ?? '').length)
W = soma(w)
F = ceil(duração real do áudio * fps)
R = F - N
durationFrames[i] = 1
  + round(soma(w[0..i])/W * R)
  - round(soma(w[0..i-1])/W * R)
```

Se F<N, falha. Cada shot recebe ao menos um frame; soma exata = F. A timeline acumula startFrame/endFrame contíguos. Sem segmento, peso=1; segmentos não precisam cobrir a narração integral nem estar na ordem correta: a validação só verifica substring por segmento. Duplicações/inversões podem ser aceitas. Na demo, a compilação narrada produz 52 + 122 = 174 frames.

`NarrationTrack.timingSource` é sempre **estimated_proportional** neste provider. A união de tipos aceita tts_boundary, mas não há implementação desse alinhamento. A duração total é medida; divisões de shots/cues são estimadas. Os próprios CaptionCue não têm campo timingSource; o contexto fica no áudio da Scene/manifest, ou fica ausente no modo sem áudio.

## M. Captions e resolução

`captions` limpa tags, separa palavras por whitespace, agrupa até **três palavras por cue** e divide a duração da Scene igualmente pelo número de grupos, usando floor nos limites cumulativos. Não utiliza os pesos dos narrationSegments nem o comprimento de cada cue. Cue de uma palavra recebe aproximadamente a mesma duração que cue de três. Se houver menos frames que cues, grupos de duração zero são filtrados e palavras podem desaparecer; não há teste para isso.

`SequenceRenderer` escolhe cue por startFrame <= frame < endFrame. Posição: bottom 13%, left/right 7%; fundo rgba escuro e borda arredondada. Fonte Trebuchet MS, 32 px, lineHeight 1,2; padding 14×20 px e radius18. Nos dois PNGs da prova, a legenda ficou dentro da tela, incluindo wrap em duas linhas.

**Independência de resolução é parcial:** margens são percentuais, fonte/padding/raio são pixels fixos. Em 1080×1920 o texto fica proporcionalmente menor; em resoluções pequenas ou com palavras longas não há garantia de safe zone. 480×854 é aproximação em pixels pares de 9:16 (DAR 240:427), não 9:16 exato. Não há restrição de aspecto na validação. Overlays de múltiplos termômetros usam a mesma posição e se sobrepõem. Não houve alteração nem novo sistema de captions.

## N–O. FFprobe e diferença entre as timelines

Medição repetida no arquivo original `out/engine3d/cold-opening-narrated.mp4`:

| Campo | Valor |
|---|---|
| Container / format_name | MP4, mov,mp4,m4a,3gp,3g2,mj2 |
| Video codec | h264 / avc1 |
| Audio codec | aac / mp4a, estéreo, 48 kHz |
| Width / height | 480 / 854 |
| FPS / frames de vídeo | 30/1 / 174 |
| Video duration | 5,800000 s |
| Audio duration | 5,803000 s |
| Container duration | 5,803000 s |
| Áudio menos vídeo | **+0,003000 s = 3 ms**, menor que um frame (33,333 ms) |

Esse desvio é consistente com empacotamento/quadros AAC; não é evidência de dessíncronia perceptível. O dado medido é 3 ms; a causa específica não foi rastreada no encoder. O MP3 de entrada mede 5,784 s. Há pequena extensão até a grade de vídeo de 174/30=5,8 s.

Visual: DirectorPlan usa fixed e shots de 3+5 segundos, total 240 frames/8 s. Narrado: --narrated altera o modo de execução para narration, e ceil(5,784×30)=174 frames; o JSON original não é modificado. Logo, a diferença de 8 s para 5,8 s **é esperada pelo código**, não truncamento acidental. Manifests originais foram preservados e copiados para audit/original-*.json. Storyboard e audio-manifest padrão representam a última execução, não um histórico por vídeo.

## P. Auditoria dos 124 testes existentes

Reexecutados sem mudanças: **124 PASS, 0 FAIL, 0 SKIP**. Classificação exclusiva por domínio principal (testes mistos contados uma única vez):

| Domínio | Testes |
|---|---:|
| registry | 51 |
| resources | 21 |
| validation | 25 |
| builder | 3 |
| director | 7 |
| timeline | 3 |
| continuity | 2 |
| audio | 3 |
| captions | 1 |
| determinism | 8 |
| render | **0** |
| **Total** | **124** |

Lista completa de nomes por categoria em test-domains.json e saída bruta em tests.tap. Nenhum teste novo foi adicionado para esta auditoria. Os harnesses de evidência não integram a suíte nem alteram sua contagem.

Limites reais da cobertura:

- 49 dos 51 testes de registry repetem resolução/tags/categoria, não verificam aparência ou execução dos 49 recursos.
- Dez testes com nome “supports geometry anchor” consultam apenas supportsAnchor/metadata; não verificam coordenadas da geometria.
- Três testes das galerias chamam resolveShot; não renderizam PNG nem verificam se cada geometria está no frustum.
- O teste “door hand reaches transformed handle and face anchor follows scale” só verifica finitude da mão direita e aumento de Y da face. O contato numérico real está no teste de regressão da mão esquerda, para o exemplo com transform simples.
- O teste de múltiplas Scenes menciona “independent audio ownership”, mas usa plano sem tracks de áudio; não testa sobreposição/duplicação real de áudio.
- O teste offline de áudio reúne WAV, cache, ffprobe, duração inválida, captions indiretas e timeline em um único caso; não significa cobertura independente de todas as falhas do adapter.
- O teste RUN/Walk comprova poses diferentes e lean, sem assert separado da cadência e amplitude prometidas no título.
- Zero testes automatizados chamam renderMedia/renderStill ou medem pixels/codec/duração do MP4. As provas desta auditoria cobrem parte dessa lacuna manualmente.

## Q. Cobertura faltante, priorizada — não implementada

| Prioridade | Lacuna real |
|---|---|
| CRITICAL | Nenhuma lacuna foi classificada como bloqueio crítico para execução local com planos confiáveis; isso não prova ausência de falhas críticas desconhecidas |
| HIGH | Contenção de caminhos de preview para shot.id com ../ e separadores; tipos de todos os campos aceitos antes de render; validação de tipos de ator/alvo para VFX |
| HIGH | Consistência entre initialState/finalState/parameters e estado visual; anchors/mãos sob rotações XYZ e escala; porta parcialmente aberta |
| HIGH | Testes de rejeição/execução que impeçam fallback de recurso não implementado; ao menos um render E2E com plano independente da demo |
| MEDIUM | Cache concorrente, arquivo corrompido, falha do Python, timeout TTS, falha/malformed output do ffprobe, pitch/voice na chave, duplicidade de tracks |
| MEDIUM | Captions em resoluções diferentes, palavras longas e número de cues maior que frames; segmentos duplicados/fora de ordem; áudio por múltiplas Scenes |
| MEDIUM | Behavior real de cada ação e câmera em limites start/end, orientação dos VFX, força zero de Orbit, repetição de binds e retomada de posição |
| LOW | Catálogo/manifest/storyboard em snapshots de schema, coerência de metadata/capabilities, mesh budgets e identificação visual de props semelhantes |

## R. Fallbacks silenciosos

**Boundary do CLI:** IDs desconhecidos e ações incompatíveis falham explicitamente, confirmado nas sondagens. Não foi encontrado unknown → Robot, incompatible → Idle ou erro TTS → Fake no caminho validado.

**Dentro dos executores existem fallbacks**, relevantes ao usar componentes diretamente ou ao adicionar metadata sem executor:

| Local | Fallback real | Impacto |
|---|---|---|
| Character, library.tsx:84 | IDs sem flags Lia/Zombie/Robot/Blob/Scout usam humano/cor do Caio | Novo descritor pode parecer implementado sem visual próprio |
| Prop, library.tsx:391 | else desenha Radio | Radio real depende desse else; qualquer ID não tratado vira mesmo objeto |
| Vfx, library.tsx:554 | qualquer ID que não contenha SNOW/COLD_BREATH desenha Frost | Falta de despacho exato/checagem de executor |
| cameraAt | ID não reconhecido retorna posição/alvo base | Equivale a Static se chamada sem validação |
| poseAt | ID sem branch mantém pose base | Idle é implementado por esse no-op; desconhecidos também seriam ignorados |
| Vfx, library.tsx:508 | actor não resolvido/target não encontrado usa [0,0,0] | Já alcançável por bindings que passam na validação; não é só risco futuro |
| Vfx com actor sem anchor | default face | Default não documentado no contrato de cada VFX; pode esconder binding incompleto |

Environment desconhecido falha ao desestruturar envColors[name], não faz fallback. Registry descriptors não carregam implementações React e não verificam que um branch executor exista. `capabilities` são strings genéricas, não um contrato executável. Default transforms e intensidade padrão da neve são defaults explícitos úteis, distintos desses fallbacks de identidade.

## S. Paths persistidos e contenção de saída

Varredura estrutural de strings em **18 JSONs existentes no momento da varredura**, sob out/engine3d, incluindo catálogo, storyboard, manifests, evidências e relatórios antigos de audit: **zero valores de path absoluto**. URLs de advisories e package registry são URLs, não paths locais. Paths do cache são relativos a public. Evidência em path-scan.json. Report-data e demais documentos de auditoria posteriores também usam paths relativos.

O ffprobe recebeu caminhos absolutos internamente; seus campos format.filename foram normalizados para relativos ao persistir a evidência de auditoria. Isso não é correção na engine nem mudança de manifests de produção. README/REPORT preexistentes incluem o diretório deste PC em texto documental, sem serem dependência de artefato executável. ffprobePath é absoluto em runtime e específico de Windows; outra plataforma exige FFPROBE_PATH.

**Falha HIGH H01:** só plan.id tem regex filename-safe. Shot.id aceita `../../../../audit-escape`. `cli/main.ts:121` faz path.join(directory,shot.id + sufixo). A sondagem, sem escrever arquivo, calculou saída relativa `../audit-escape-start.png`, fora do projeto e do diretório previews. Portanto, path relativo no JSON não implica contenção segura. Não houve tentativa de escrita fora da pasta nem correção desse problema.

## T. Performance e custo real

- Snow: máximo **80 meshes/partículas por binding**, default48; não há teto global para bindings ou shots. Dois bindings máximos =160 partículas; o renderer não agrega nem instancia.
- ColdBreath: cinco esferas transparentes por binding. Frost: dez cristais, cada um com duas caixas, total20 meshes por binding.
- Ball usa esfera 20×14 segmentos; breath usa10×8. Cylinder de membros tem10 segmentos; cones de árvores7. Sem modelos externos, mapas de textura autorais ou post-processing. Não há pipeline dedicado de outline ou sombras projetadas.
- Geometrias e materiais são declarados por mesh, sem instancing/pooling explícito. Antialias e preserveDrawingBuffer ativos. Camera é atualizada por mutação durante render do componente, não por um controlador de estado separado.
- Uma cena Winter contém **49 meshes de ambiente** e três luzes. Caio16, Lia18, Robot18, Blob7, Scout17, Zombie16 meshes na pose avaliada. Radio3; Door7; Thermometer4.
- Na abertura real, t=0,5: **129 meshes** =49 Winter +16 Caio +7 Door +52 Snow +5 breath; 23 boxes,36 cones,66 spheres,4 cylinders e21 groups. Contagem derivada da árvore React, não medição de draw calls ou objetos internos Three. Com Snow80, o mesmo shot teria157 meshes.
- O orçamento global de instâncias, partículas e complexidade não é validado. Muitas instâncias multiplicam geometria, materiais e custo linear de lookup; arrays de personagem/prop são percorridos repetidamente por bindings. A análise não mediu FPS, GPU memory ou tempo de render com cargas máximas, portanto não declara capacidade de throughput.

## U. Checks finais e preservação do projeto

Executados novamente após as provas:

- npm run typecheck: PASS.
- npm run check:engine3d: 124 PASS, zero falhas/skips.
- npm run engine3d:catalog: 49 recursos, mesmo conteúdo do registry.
- npm audit: zero vulnerabilidades na consulta atual; nenhum audit fix/upgrade executado.
- Segundo plano renderizado com MP4 real e duas imagens de captions; repetição de frame com hash idêntico.
- Cache real: MISS/HIT/MISS e dois processos de síntese efetivos.
- git diff: nenhuma mudança em src/, cli/, tests/, package.json/package-lock ou exemplos originais. Nenhum commit novo/remote/publicação foi feito nesta auditoria. AUDIT.md é o documento novo rastreável; provas e scripts ficam em out/ ignorado.

Na inspeção final apareceram também os itens não rastreados `LEIA, IMPORTANTE!.txt` e `PACK DE EDIÇÃO DO SHADOW!/`. Não foram criados, modificados ou executados por esta auditoria e não fazem parte do código original/import graph analisado. O relatório cobre a Engine3D e os artefatos identificados acima, não o conteúdo desses itens adicionais.

## V. Problemas CRITICAL

**Nenhum confirmado dentro do escopo auditado.** Isso não é certificação de segurança geral. A falha de contenção H01 é HIGH no uso local por JSON e deve ser resolvida antes de aceitar planos de terceiros ou automatizar ingestão externa.

## W. Problemas HIGH confirmados

| ID | Problema | Evidência / referência |
|---|---|---|
| H01 | Shot.id permite escape de pasta na escrita dos previews | preview-path-probe.json; cli/main.ts:121; schema.ts:47 só exige texto |
| H02 | Contratos aceitos não garantem execução: texto objeto passa; VFX com tipo de binding errado cai na origem; initialState.value de Thermometer é ignorado | probes.json; validation.ts:38; library.tsx:300 e508; renderer.tsx:69 |
| H03 | Transformações gerais não preservam orientação/alvo: inversa Euler incorreta e Look sem compensar rotação do ator | erro numérico0,3718996879; motion.ts:76–114; probes.json |
| H04 | Porta parcialmente aberta usa um progresso para a geometria e outro para a mão | distância0,7973602804; motion.ts:98 versus library.tsx:269 |

## X. Problemas MEDIUM

1. Entry Remotion importa/compila a demo obrigatoriamente; dificulta remover/substituir fixture, embora a sequência fornecida por props seja usada corretamente.
2. Registry não associa descritor a executor; dispatch por substring e defaults permissivos permitem recursos aparentes sem implementação adequada. Radio está ligado a else, não a ID exato.
3. Estados declarados de continuidade não são verificados contra a execução das ações; finalState pode declarar qualquer número válido, mesmo que a animação termine em outro valor.
4. Anchors são analíticos com constantes duplicadas, face aproximado e VFX sem orientação de attachment. Não sustentam a generalidade afirmada no bootstrap.
5. Legendas não escalam fonte/padding com resolução; não têm proteção contra palavras longas nem contra grupos com zero frames. Overlays de vários termômetros se sobrepõem.
6. Timing de segmentos aceita sobreposição/ordem invertida e não é alinhamento de fala. Metadata de origem existe no track, não em cada cue.
7. Cache compartilha nome temporário entre solicitações simultâneas da mesma chave, sem coordenação. Corrupção dá falha explícita, sem recuperação; não foi reproduzida concorrência nesta auditoria.
8. Ações de movimento retornam à pose/posição base fora da janela ativa; não há estado final persistente para locomoção. Orbit com strength0 ainda altera Z, pois o fator só afeta X. São comportamentos do código, não novas features solicitadas.
9. Suite muito concentrada em metadata/compilação e sem testes de render. Os defeitos confirmados passaram pelos124 testes.

## Y. Problemas LOW / limitações documentais

- ACTION_IDLE_001 não possui animação dedicada; contagem original não distinguia metadata/no-op de implementação de ação.
- Ocean é um plano; Lab/Shelter e Flashlight/Lantern são muito semelhantes. Lantern/Flashlight não emitem luz; Ruined Street não contém destroços. São geometrias reais mínimas, não metadata-only.
- Não há outline dedicado, rig articulado, olhar vertical ou expressão facial dinâmica. Nenhuma dessas capacidades deve ser presumida apenas pelo nome/cartoon.
- Fonte de sistema sem empacotamento/versionamento pode variar entre PCs; hash idêntico neste PC não garante portabilidade pixel a pixel.
- Storyboard/manifest globais são sobrescritos por novos comandos, sem namespace por plano. O harness desta auditoria isolou as provas para preservar os originais.
- source:procedural e status:available são genéricos; o catálogo não informa arquivo/branch real nem granularidade de implementação.

## Z. Recomendação para a próxima fase

Fazer uma fase de **correções de contratos e confiabilidade**, começando por H01–H04 e testes de regressão que reproduzam as falhas; depois remover o acoplamento obrigatório à demo e tornar explícito o vínculo registry→executor. Só então ampliar recursos narrativos. Manter os49 IDs estáveis e revisar as afirmações sobre Idle, anchors e continuidade. Nenhuma dessas correções foi implementada nesta auditoria.

Evidências principais: `out/engine3d/audit/proof-plan.json`, `lia-thermometer.mp4`, `caption-20.png`, `caption-60.png`, `determinism-1.png`, `determinism-2.png`, `render-evidence.json`, `cache-evidence.json`, `probes.json`, `preview-path-probe.json`, `resource-evidence.json`, `test-domains.json`, `tests.tap`, `final-tests.log`, `typecheck.log`, `npm-audit.json`, `path-scan.json` e `demo-references.txt`.

