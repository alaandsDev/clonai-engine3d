# DirectedSequence v1

Camada opcional de direção contínua. Não modifica `DirectorPlan`, `ShotSpec` ou o registry. Um documento JSON contém `baseShot`, `initialState`, trilhas, janelas de shot, captions e `finalState` explícito. Exemplo completo: `examples/directed-door.json`.

```ts
import {validateDirected, evaluateDirected} from './directed';
const direction = validateDirected(json);
const frame = evaluateDirected(direction, 120);
// frame.state, frame.shot, frame.poses, frame.visibleProps, frame.focus
```

A composição Remotion `DirectedSequence` recebe `inputProps: {direction}`. O compilador/renderer antigos continuam disponíveis e não ganham estado implícito. O renderer contínuo reutiliza os mesmos personagens, props, VFX, ThreeCanvas e captions HTML.

## Tempo e estado

Frames de trilhas são absolutos dentro da sequência; intervalos de autoria `[startFrame,endFrame]` interpolam até o endpoint, que persiste depois. Visibilidade em `endFrame` usa o estado `to`. Janelas de shots/captions são end-exclusive. Estado pode ser consultado em `totalFrames` para conferir o endpoint, mas o vídeo termina em `totalFrames-1`.

Não há singleton ou cache de estado evolutivo. Cada avaliação parte do estado inicial e aplica os segmentos em ordem temporal. Leitura fora de ordem produz o mesmo resultado; `initialState` não é mutado. Campos desconhecidos, recursos incompatíveis, trilhas sobrepostas, lacunas de cobertura, finalState divergente e saltos não declarados falham antes de renderizar. `CUT` em uma janela de shot permite descontinuidade naquele frame; `CONTINUE` não reinicia ações.

## Blocking e locomoção

`ActorBlocking` tem posições/facing inicial/final, movimento, intenção, easing, frames e purpose. Tipos: STAY, STEP, WALK, APPROACH, RETREAT, SIDESTEP, TURN. TURN usa o arco angular mais curto. STAY/TURN não podem transladar; STEP é limitado a .85 unidade.

Movimentos são caminhos autorados; APPROACH/RETREAT não são planejamento de rotas nem navegação automática. `target` documenta a intenção compartilhável com câmera/ação. São quatro easings: LINEAR, EASE_IN, EASE_OUT e EASE_IN_OUT.

Locomoção usa passadas curtas controladas pela distância, pés de apoio analíticos, balanço contrário dos braços, bob e lean conservadores. O renderer usa endpoints locais dos pés sem mudar o modelo/ID. O guardrail mede X/Z do pé de apoio no mundo durante a mesma meia passada; trocas de apoio e turns ficam fora dessa medida. Isso **não é IK, captura de movimento ou prova de ausência de foot sliding perceptual**; não há joelhos articulados nem solver de terreno.

## Actions, props e foco

`actionSegments` reutilizam actions existentes com `fromProgress`/`toProgress`. OpenDoor atualiza `door.parameters.openProgress` e o mantém após o segmento. As outras actions reutilizam a pose existente, com entrada/saída breve de braços/mãos/cabeça. A compatibilidade antiga continua sendo validada. Não misture action bindings no baseShot com actionSegments.

Jump/Dance/Walk/Run preservam também offsets transitórios de corpo, inclinação e pernas. Translação persistente de raiz pertence a ActorBlocking: WALK/RUN em actionSegments não aceitam targetPosition, para não prometer um endpoint que seria perdido ao terminar a pose transitória.

`PropMotion` interpola transforms/visibility autorados: APPEAR, SLIDE, RISE, DROP, DISAPPEAR, SLIDE_OUT, LOWER. O nome expressa a intenção; `from`/`to` definem o caminho, sem trajetória física automática. EMPHASIS faz um pulso e volta ao estado inicial; deslocamento máximo .25, escala ±15%, rotação .3 rad por eixo. Valores como thermometer.value permanecem explícitos no estado, mas não existe trilha genérica nova de animação de parâmetros.

`FocusTarget` aceita ACTOR/PROP com id/offset, ou POSITION/TEXT_TARGET em coordenadas de mundo. TEXT_TARGET não cria texto nem implementa tracking de layout 2D. `focusSegments` fornece foco editorial; usar esse foco na câmera exige referência explícita no CameraSegment.

## Câmera

Cada CameraSegment tem endpoints de posição/alvo, easing, purpose e um dos sete IDs existentes. A curva existente de `cameraAt` contribui com curvatura conservadora (.18); seu componente linear é removido para preservar exatamente os endpoints autorados. Nenhum novo Camera ID.

MOVE interpola a cobertura; FOLLOW acompanha a variação do target em relação à trajetória linear dos endpoints; REFRAME interpola o alvo de início até o foco. FOLLOW não infere offsets de enquadramento desejados: os endpoints devem representar a cobertura desejada. Mudanças de alvo são determinísticas. Endpoints de câmera incompatíveis com o segmento anterior falham, exceto em CUT explícito. Não existe física, inércia acumulada ou câmera dependente da ordem dos frames.

`compositionZones` e `depthPlacement` oferecem referências normalizadas/de profundidade. Não posicionam o ator automaticamente.

## QA e limites

`directedQa` avalia todos os frames, verifica finite transforms, bounds, teleports >.18 unidade/frame, saltos de câmera/prop >.22, estado e posição projetada do ator. Colisões são warnings de proximidade de origens, não colisões de meshes/varredura da porta. Orçamento recomendado é no máximo dois movimentos narrativos simultâneos. Warnings não atribuem qualidade estética.

`directed-metrics.ts` mede deltas de transforms/poses, regiões projetadas, tamanho aparente aproximado, distância/caminho de câmera, foco e repetição. Snow não conta como direção narrativa. Taxa de mudança visual é um proxy com thresholds documentados, não uma medida automática de beleza ou equivalência à referência. Assinaturas são amostradas a cada .5s; três consecutivas iguais geram warning.

`npm run check:motion` testa o novo contrato. As suítes anteriores continuam obrigatórias. O piloto de 17s está separado do master de 81s; nada rerenderiza o vídeo completo automaticamente.
