# PHASE 13 — Motion, blocking & camera direction

## A. Objective

Evoluir capacidade de direção contínua sem expandir conteúdo. Piloto de 17 s / 510 frames e controle com exatamente os mesmos três trechos de narração. Não rerenderizamos o master de 81 s.

## B. Phase12 problem

Fase12 usou sete câmeras e 43 shots, mas manteve corpo central, gestos simples e fundos genéricos. Porta reiniciava por shot. Relatórios obrigatórios e evidências de production issues, rhythm, resource usage, storyboard e oportunidade externa foram consultados; a falha é de cobertura/estado/atuação, não falta de IDs.

## C. Reference observations

Arquivo local fornecido pelo usuário: C:/Users/aland/Downloads/como_funciona_poco.mp4. Duração 86.541s; 86 imagens a 1fps, dez páginas analisadas. Objetos entram, mudam de estado e orientam câmera/foco sem perder contexto. Nenhum asset, texto, geometria, personagem ou composição específica foi copiado; só padrões genéricos de direção.

## D. Visual change rate

Referência: 50 mudanças semânticas aproximadas, 34.67/min, intervalo médio 1.70s, maior lacuna amostrada 3.00s. Incerteza temporal ±1s. Detector scene>.18 encontrou zero candidatos; não é prova de zero cortes.

| Métrica | Controle Fase12 | Piloto Fase13 |
|---|---:|---:|
| cuts/min | 24.706 | 0.000 |
| visualChanges/min (proxy) | 84.706 | 112.941 |
| intervalo médio s (proxy) | 0.680 | 0.515 |
| maior intervalo s (proxy) | 1.767 | 1.067 |
| narrative motion density | 0.980 | 0.949 |
| camera motion density | 0.865 | 0.745 |
| ator no centro % | 63.529 | 38.039 |
| continuidade máxima s | 2.467 | 17.000 |

A/B usa o mesmo proxy determinístico de transforms/poses, com thresholds em motion-metrics.json, e refratário de .5s. Não confundir proxy com percepção humana. Referência manual e engine não têm precisão equivalente; não otimizar contagem para imitar uma nota.

Estimativas por janelas manuais na referência: cameraMotionDensity=0.500, narrativeMotionDensity=0.872. Onze entradas aparentes de objetos (7.63/min). Saídas não quantificadas: a amostra não separa remoção real de saída de enquadramento. Esses métodos não são intercambiáveis com os deltas 3D do engine.

## E. DirectedSequence

Contrato v1 separado em src/engine3d/directed.ts. baseShot, initialState, blocking, actionSegments, cameraSegments, focusSegments, propMotions, janelas de shots, captions e finalState. Composição Remotion DirectedSequence recebe {direction}; JSON de exemplo versionado em examples/directed-door.json. Integração e limites em src/engine3d/DIRECTED.md. Não há alteração do schema DirectorPlan nem conversão automática da camada editorial antiga.

## F. ActorBlocking

STAY, STEP, WALK, APPROACH, RETREAT, SIDESTEP e TURN. Posições/facing/frames/easing/purpose explícitos; oito intents de blocking. Piloto aproxima-se da porta, vira, move para o lado, contorna a folha e recua. Caminhos são autorados; nomes semânticos não implementam navegação nem avoidance automático.

## G. Locomotion

Passos proporcionais à distância, pé de apoio analítico, balanço contrário de braços, bob e lean pequenos. QA mediu 165 pares de frames de apoio; maior delta X/Z 2.48e-16 unidade/frame, threshold .035. Isso só prova o modelo analítico dentro de uma meia passada: não é IK nem avaliação perceptual. Geometria de pernas reta, sem joelhos e com limitações nas trocas de apoio.

## H. Turns

Yaw segue o arco mais curto com easing. Piloto vira para a porta e volta à explicação sem trocar facing por corte. Teste cobre passagem +π/−π; não há teleporte de rotação. Não foi adicionada atuação facial.

## I. SequenceState

Estado de atores, transforms/visibility/parameters de props e câmera é explícito. Evolução parte de initialState em cada consulta; nenhuma memória global, relógio ou random. finalState é comparado ao endpoint calculado. sequence-state.json prova consulta fora de ordem e persistência da porta. Termômetro pode conservar value no estado; não foi criada uma trilha genérica nova de parâmetros.

## J. Action continuity

ActionSegments reutilizam os IDs/compatibilidade existentes e progress explícito. OpenDoor é avaliado uma vez em frames 60–115, com progresso 0→1. Teste separado prova 0→.35→1→hold. Poses de ação recebem transição breve de entrada/saída; não reiniciam por janela de shot. Sobreposição de duas actions no mesmo ator é rejeitada neste MVP.

## K. Door continuity

A porta permanece em openProgress=1 dos frames 115 a 509, inclusive através das janelas de direção. Camera/reframe e caminhadas posteriores não a fecham. Caminho foi ajustado após a primeira inspeção para contornar a folha e evitar ocultar rosto/corpo. Não há solver de colisão de porta.

## L. Prop motion

Mapa sobe para nomear Yakutsk, permanece no lugar e desce/some antes da nova cobertura. APPEAR/SLIDE/RISE/DROP/DISAPPEAR/SLIDE_OUT/LOWER e EMPHASIS são comportamentos sobre props existentes; from/to definem o percurso. Emphasis é pulso conservador e volta ao início. Não houve novo prop. Entrada e saída do mapa são direção, não nova mídia.

## M. Camera segments

Endpoints de posição/alvo, easing e propósito explícitos. IDs existentes acrescentam curvatura conservadora do executor cameraAt preservando endpoints. Piloto usa pan, push, orbit, reframe e pull; nenhuma câmera adicionada. Quantidade de IDs não determina variedade. Trajetória e distâncias reais estão em camera-metrics.json. Camera-metrics também registra yaw/pitch e faixa XYZ dos targets; blocking-metrics inclui porcentagem central por midpoint de shot, separada da medida por frame.

## N. Follow

FOLLOW acompanha a variação do target relativa à interpolação linear de endpoints autorados, sem física/inércia. Primeira aproximação coordena ator/câmera; endpoints mantêm cobertura explícita. Não é auto-enquadramento nem detector visual.

## O. Reframe

Câmera migra do gesto da porta para a área externa e depois para a apresentação do mapa. REFRAME interpola target em coordenadas do mundo. Endpoints incompatíveis com a câmera anterior falham, salvo CUT explícito. Nenhum jump não declarado no piloto.

## P. Reveal

Revelação depende do ator abrindo espaço, do mapa entrando e de câmera cobrindo o ambiente. Não é apenas overlay ou mais partículas. O conteúdo continua estilizado: mapa genérico não mostra carros congelados nem prova um processo físico.

## Q. Composition zones

LEFT/CENTER/RIGHT normalizados, mais helpers de profundidade. Faixa central medida x=.36–.64: 63.53%→38.04% dos frames. O piloto ainda favorece a esquerda (61.96%); sair do centro não demonstra por si só variedade suficiente. Regiões são da origem torácica projetada, não segmentação de pixels.

## R. Focus targets

ACTOR/PROP com id/offset, POSITION e TEXT_TARGET compartilháveis. Foco editorial da trilha é distinto do target efetivo da câmera e deve ser ligado explicitamente. TEXT_TARGET é posição 3D autorada, não tracking de texto HTML. Referências inválidas são rejeitadas.

## S. Depth/parallax

Movimento real de câmera e mudanças de Z do ator usam o mesmo ambiente Winter, com árvores de fundo existentes. Profundidade é um ganho limitado, não cenário novo nem zoom 2D fingido. Persiste grande área de céu/fundo simples; a escala do protagonista diminui nos planos de revelação.

## T. Narrative motion

motion-classifications.json classifica blocking, actions, props e câmera como NARRATIVE por propósito. Snow é DECORATIVE; breath/frost sinalizam a narração. Snow não aumenta densidade narrativa. Eventos VFX explicativos são contados na ativação, não por cada partícula. Guardrail recomenda até dois movimentos narrativos simultâneos; piloto sem warnings de orçamento.

## U. Motion density

Controle 0.980; piloto 0.949. Não houve aumento numérico da densidade total; o controle já mexia câmera/poses quase sempre. Ganho é deslocamento com propósito, estado persistente e cobertura contínua. Camera/actor/prop/vfx são separados. Densidade alta não é meta estética nem sinônimo de explicação visual.

## V. Composition signatures

Proxy amostrado a cada .5s: região do ator, tamanho aparente aproximado, foco, ângulo de câmera em buckets, prop visível, ambiente e estado de movimento. Não usa IA estética. Tamanho é analítico, não medição de bounding box real. Um prop dominante é proxy simples; assinatura não detecta todo overlap visível.

## W. Repetition

5 alertas no controle e 4 no piloto. Três assinaturas consecutivas semelhantes geram warning, não falha automática. Há repetição residual de ator à esquerda/porta aberta/mapa; não declarar problema resolvido só pela redução do número.

## X. Pilot

phase13-motion-pilot.mp4: 17s, 510 frames, H264/AAC, 480×854, 30fps, 48k estéreo. Texto: hook da porta, #5 Yakutsk e explicação do frio/cílios/carros. Mesmas gravações cacheadas da Fase12, voice/rate/pitch preservados. Sem novas sínteses, SFX, música, visual layers ou B-roll.

## Y. A/B comparison

phase12-style-control.mp4 usa os shots originais dos mesmos beats, retimados por remoção dos beats intermediários. Piloto mantém Caio/Door/Map/Snow/ColdBreath/Frost; usa um ambiente Winter enquanto controle inclui City/Winter. O controle e piloto têm aproximadamente os mesmos recursos, com menos ambientes no piloto. A geometria/registry não cresceu. Voz e captions idênticos; captions continuam ESTIMATED. Doze páginas de contatos e oito strips de quatro frames sequenciais, além dos dois vídeos.

## Z. Reference comparison

reference-vs-phase12-vs-phase13.json inclui referência, Fase12 integral, controle e piloto. Densidades de câmera/movimento narrativo da referência são estimativas de janelas manuais a 1fps, com incerteza ±1s. Não são transforms 3D. Campos sem medição confiável, como cortes exatos e saídas inequívocas de objetos, mantêm null com motivo. A posição do ator na referência considera apenas sua breve presença inicial, com denominador diferente do A/B. Há pelo menos um trecho aparentemente contínuo de 23s nas amostras da referência. Não declaramos equivalência estética.

**Maior diferença estrutural, única:** a referência transforma objetos para demonstrar causalmente o que está sendo explicado; este piloto ainda apresenta props genéricos enquanto o narrador descreve acontecimentos que não vemos.

## AA. QA

validateDirected + directedQa: schemas fechados, compatibilidade, finite transforms, limites, câmera/ator/props, teleports, state endpoints, visibilidade, orçamento e proximidade simples. Pé de apoio passa no guardrail analítico. A/V e decode integral registrados por variante; amostras e strips inspecionados. Captions usam renderer e cues antigos. Não há física, mesh collision, IK, estética automática ou promessa de safe zone para qualquer documento arbitrário.

Os dois MP4s decodificam integralmente e têm pacotes AAC idênticos. Seis frames extraídos do piloto exportado foram inspecionados, não vazios. Compatibilidade visual adicional: o frame30 do controle coincide com o frame30 arquivado da Fase12 acima da tolerância RGB de 2/255: 0 pixels alterados. Strips são evidência de amostragem sequencial; os vídeos completos estão disponíveis para revisão humana.

## AB. Performance

Avaliação pura em 2040 consultas fora de ordem: média 145.52µs, p95 292.60µs nesta máquina. Sem cache de estado mutável. Render A/B e diferença relativa em render-performance.json; tempo de vídeo inclui mux/QA. As passagens de stills/refinamento não são um benchmark controlado. Captions/voz cacheadas; nenhum download de asset nem TTS novo.

Passagem final: controle 55.227s; motion 44.689s; diferença observada -10.537s. Não concluir speedup: stills concorrentes e cache/ordem das passagens confundem a comparação. O custo puro do evaluator está separado.

## AC. Tests

Novo check: npm run check:motion. Cobertura de schema, tipos de movimento, turns, easing, random access, estado, door persistence/progress, foco, câmera/follow/reframe, props/visibility/emphasis, bounds, teleports/cuts, foot support, métricas de braço sem cancelamento, densidade e repetição. Checks completos e logs em checks.json; resultados são sobrepostos entre suítes, não somar como casos únicos.

npm run typecheck PASS (); npm run check:engine3d PASS (tests 323, pass 323, fail 0); npm run check:editorial PASS (tests 46, pass 46, fail 0); npm run check:sound PASS (tests 35, pass 35, fail 0); npm run check:visual PASS (tests 37, pass 37, fail 0); npm run engine3d:catalog PASS (); npm run check:motion PASS (tests 30, pass 30, fail 0).

## AD. Registry counts

Characters 6 + Environments 9 + Props 14 + Actions 10 + Cameras 7 + VFX 3 + Presets 0 = 49. SFX 8; visual 5. Nenhum ID ou asset externo novo. Nenhum pack scan, Higgsfield, música, personagem ou ambiente novo.

## AE. Compatibility

DirectorPlan, ShotSpec, ProceduralSequence e schemas antigos preservados. Extensões opcionais de renderer/Pose não mudam o caminho sem direction. Registros, captions, TTS, mixer, compositor visual, exemplos e testes anteriores preservados por hash, salvo os cinco arquivos de integração aditiva autorizados. Exemplo JSON novo e teste novo são independentes. Sem dependências instaladas/atualizadas, lockfile preservado, sem publish/commit/push.

## AF. Limitations

1. Pernas sem joelhos/IK; trocas de apoio ainda estilizadas.
2. Falta expressão facial/reação convincente.
3. Não há prova visual de carros congelando.
4. Mapa/ambiente genéricos.
5. Colisão é apenas proximidade de origens.
6. Composição/safe zone do ator é proxy analítico.
7. Timing de captions continua estimado.
8. Caminhos/foco são autorados; não há planejamento automático.
9. Não há compilação automática EditorialPlan→DirectedSequence.
10. Comparação com referência tem métodos/precisões diferentes.

## AG. Honest perceptual assessment

Avaliação autoral pelas amostras, strips e evolução de transforms; não é aprovação humana nem análise contínua perceptual automatizada do vídeo.

| Dimensão | Comparação | Evidência/limite |
|---|---|---|
| BLOCKING | BETTER | Aproximação, desvio e retirada; ainda favorece esquerda |
| MOTION | SLIGHTLY_BETTER | Pés apoiados e gestos em sequência; passada rígida continua |
| CAMERA | BETTER | Segue/recompõe e muda distância; enquadramento ainda simples |
| CONTINUITY | MUCH_BETTER | Porta não reinicia e cena permanece 17s |
| VISUAL VARIETY | SLIGHTLY_BETTER | Mais estados internos; props genéricos repetem |
| DEPTH | SLIGHTLY_BETTER | Z e parallax reais, ambiente ainda raso visualmente |
| CLARITY | SAME | Narração/texto claros, mas fatos citados ainda não são mostrados |
| OVERALL | BETTER | Demonstra capacidade de direção nova sem equivalência à referência |

**Resolveu significativamente o maior gargalo? PARCIALMENTE.** A capacidade de continuidade/blocking é real; variedade de atuação e representação do conteúdo ainda limitam o resultado. A versão final favorece menos o centro que o controle, mas ainda tem quatro alertas de repetição. A melhoria não elimina a necessidade de revisão perceptual humana do movimento e do enquadramento.

## AH. Next recommendation

**B) environments/props**, uma única prioridade após este A/B: melhorar representação e estados visuais de objetos capazes de demonstrar a narração, em vez de apenas mover o mesmo apresentador. Evidência: carros e processos narrados continuam invisíveis mesmo com a continuidade corrigida. Isso é recomendação; nenhum recurso foi adicionado e nenhuma próxima fase foi iniciada. Não rerenderizar os 81s automaticamente.
