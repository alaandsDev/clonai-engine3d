# Fase 6B — Engine hardening e regressão

Concluída em 27/10/2026. AUDIT.md foi lido integralmente antes das alterações. Escopo restrito a H01–H04, contratos/executores, desacoplamento da demo, guardrails e regressões. **Os mesmos 49 IDs foram preservados.** Nenhum personagem, prop, ambiente, ação, câmera, VFX, preset, música, SFX, overlay, UI, IA ou integração de assets foi acrescentado. O pack externo não foi acessado ou integrado.

## A–D. H01–H04: antes, reprodução e correção

Os testes de `tests/hardening.test.ts` foram escritos e executados antes de corrigir a produção. `out/engine3d/phase6b/red.tap` registra **4 testes, 0 PASS e 4 FAIL**:

| Falha | Reprodução antes | Comportamento após |
|---|---|---|
| H01 | `../../escape` escapava do root ao derivar nome de preview | Nome bloqueado com UNSAFE_OUTPUT_PATH; resolução exige containment lexical e canônico |
| H02 | Texto objeto e binding Frost semanticamente impossível eram aceitos | EngineError explícito na validação; nenhum fallback de attachment para origem |
| H03 | Ator com rotação [0.3,0.7,0.4] não mantinha contato da mão com a maçaneta | Inversa Matrix4 do corpo, incluindo escala e lean; contato passa com tolerância numérica |
| H04 | initialOpen=0,8 e progresso parcial produziam mão/porta em posições diferentes | Geometria, posição da maçaneta e mão usam o mesmo effectiveDoorOpenProgress |

`green.tap`: **os mesmos quatro asserts comportamentais passam**. Na rodada RED de H01, como o helper central ainda não existia, a ponte de teste usava a derivação legada exata da CLI; a primeira travessia fazia o assert de containment falhar. Depois da implementação, o teste importa diretamente o helper real, sem fallback. As outras três regressões usam desde o início os executores/validador reais. Novas fixtures não importam cold-opening.json.

## E. Contenção de paths

Implementação central em `src/engine3d/paths.ts`:

- `safeArtifactName`: política fechada para nomes ASCII iniciados por alfanumérico, com alfanuméricos, `_`, `-` e pontos internos; máximo160 caracteres. Não é um sanitizador que silenciosamente cria nomes ambíguos.
- Rejeita separadores, ../, ..\\, misturas, paths Windows/Unix absolutos, drive letters/ADS, UNC, segmentos `.`/`..`, espaços finais, pontos finais, caracteres hostis, nome vazio e nomes reservados CON/PRN/AUX/NUL/COM1–9/LPT1–9, inclusive com extensão.
- `resolveSafeOutputPath`: valida ID e sufixo, aplica path.resolve e exige descendência estrita com path.relative. Faz segunda verificação com realpath dos componentes existentes; junction/symlink apontando para fora é rejeitado. Link não resolvível também é erro.
- IDs lógicos continuam separados dos nomes de arquivo. Um shot com ID lógico `logical/segment` compila como dado, mas é recusado se usado para escrever um preview. Nenhum ID é concatenado diretamente como caminho de escrita dos previews/MP4s.
- CLI valida os caminhos derivados antes do bundle/síntese correspondente. Nomes fixos de catalog/storyboard/manifest não vêm do plano.

Regressões incluem todos os exemplos solicitados e casos adicionais. Um teste escreve somente um arquivo seguro no sandbox temporário e cria um junction para uma pasta irmã **dentro do mesmo sandbox**; a saída para esse link é bloqueada. Nenhuma sondagem escreve fora do sandbox. Evidência: `path-security-results.json`.

Limite: containment não é um sandbox de sistema operacional contra outro processo alterando links entre check e escrita. O root é configuração confiável da CLI. Essa fase não acrescenta isolamento de processos.

## F. Validação de contratos

`schema.ts` valida campos conhecidos por tipo, shape, enum e faixa pertinente; nomes desconhecidos continuam sendo erro. Duração é positiva/finita; vetores têm três números finitos; escala é positiva; timing obedece 0≤start<end≤1; força de câmera/intensidade/temperatura/progresso respeitam seus parâmetros registrados. NaN/±Infinity são rejeitados.

onScreenText, narrationSegment e visualIntent são strings. Tipos errados não chegam a React/spokenText para produzir TypeError. Directions são vetores não nulos. Campos opcionais presentes com null são rejeitados. Cast IDs e IDs de instância são strings não vazias. Orders são números finitos e mantêm a semântica anterior; formato exige inteiros positivos e dimensões pares.

`sequence-validation.ts` protege também o boundary de inputProps do Remotion/Studio: formato, campos, shots contíguos, cenas, tracks e captions. Composição não depende da suposição de que a CLI validou tudo. Transformações não inversíveis ou cujo determinante transborde são rejeitadas. Executores numéricos possuem guardas adicionais de tempo/vetores/parâmetros.

Point/Look aceitam exatamente um alvo entre target, targetPosition e direction. Walk/Run só aceitam targetPosition opcional. Ações sem semântica de alvo não aceitam um binding ignorado. Anchors em action são rejeitados nesta versão: são contrato de attachment VFX, não um recurso de seleção de ponto do target. finalState declarado incompatível com a execução do prop produz CONTINUITY_MISMATCH.

## G. Bindings de VFX

| VFX | Contrato executável |
|---|---|
| Snow | Sem actor, target ou anchor; intensidade opcional |
| ColdBreath | actor obrigatoriamente character + anchor face; sem target |
| Frost | character actor + anchor suportado **OU** target de prop, exclusivamente |

Frost target de personagem, prop como actor, actor sem anchor, alvo ausente e mistura dos modos são rejeitados antes do render. `vfxAttachmentMatrix` revalida chamadas diretas e nunca usa `[0,0,0]` como fallback para binding obrigatório. Origem permanece uma posição válida apenas quando é de fato o transform de um prop ou o mundo de Snow.

## H. Estado do termômetro

Fonte visual canônica: `parameters` normalizados pelo resolver. `initialState` é explicitamente mapeado para parameters. Se ambos declararem o mesmo campo, precisam concordar; conflito gera INVALID_PARAMETER. O termômetro, incluindo coluna geométrica e número do compositor, recebe o valor normalizado. A nova prova de render usa **initialState.value=-63**, sem parameters.value, e o PNG mostra −63 °C.

Regressão compara os dados da geometria produzida com o estado inicial à geometria do parâmetro canônico equivalente, além de rejeitar conflito. Um finalState que declare mudança de temperatura sem execução correspondente é rejeitado. Não foi introduzida animação de temperatura.

## I–J. Matemática e anchors analíticos

`transforms.ts` define WORLD = T × R(XYZ) × S × LOCAL, usando Matrix4.compose, Quaternion e Vector3. Inversa WORLD→LOCAL usa Matrix4.invert, sem negação de Euler. `bodyMatrix` inclui a inclinação do corpo; `anchorMatrix` acrescenta a orientação local da cabeça/mão.

Os anchors são **analíticos**, baseados nas dimensões do rig. Não são anunciados como extraídos de meshes ou bones. Face continua sendo um offset aproximado do modelo. A transformação desse offset agora é coerente com os groups desenhados.

Foram verificadas para Caio e Lia as cinco posições head/face/leftHand/rightHand/chest nas dez configurações pedidas: translation, uniform scale, X, Y, Z, XYZ, translation+rotation, translation+scale, rotation+scale e todas combinadas. São **100 comparações numéricas**, agrupadas em20 testes parametrizados por personagem/transform. Há escala não uniforme adicional nos casos combinados. Evidência: `transform-results.json`.

## K–L. Point e Look

Point transforma o alvo mundial para espaço local do corpo e calcula o vetor a partir do shoulder, preservando o alcance simples existente de0,8. Target de instância usa sua origem transformada; targetPosition e direction são mundiais. Testes verificam colinearidade e sentido do braço contra o alvo, com rotação XYZ [0.3,0.7,0.4], escala e transforms combinados.

Look calcula yaw após transformar alvo/direção para o espaço do ator. Ator girado π/2 olhando para +Z mundial agora recebe yaw local −π/2. **Pitch continua não suportado:** o componente vertical local não produz inclinação da cabeça. Isso está explícito no contrato e no guia. Não há nova expressão facial ou IK.

## M. Orientação dos attachments

ColdBreath e Frost usam groups com a matriz do anchor e matrixAutoUpdate=false; seus offsets permanecem locais. Se o ator vira90° em Y, o eixo frontal da respiração vira para +X mundial, em vez de permanecer em +Z. O teste verifica a direção calculada e a matriz usada pelo elemento React real. Frost em target de prop usa a matriz do prop, incluindo orientação/escala.

## N. Progresso efetivo da porta

`door.ts` centraliza:

- `effectiveDoorOpenProgress`: máximo do estado inicial/parâmetro canônico e smoothstep do binding OpenDoor, mantendo a semântica anterior de abertura até1.
- `doorHandleWorld`: pivot da dobradiça + rotação pelo progresso efetivo + transform da instância.

Prop usa o progresso para a folha da porta; poseAt usa a posição efetiva da maçaneta e a inversa da matriz do corpo para calcular a mão. Valores iniciais0/0,25/0,8/1 foram verificados em start/middle/end, com transforms do ator e porta, totalizando **120 casos numéricos**. Os testes também leem a rotação da folha produzida pelo componente Prop, não somente o retorno do helper.

Maior erro mão–maçaneta medido nessas combinações: **4,965068306494546e−16 unidade**, abaixo da tolerância1e−8. Incluem porta e ator traduzidos, porta e ator rotacionados e combinações com escala. Continua sendo reach geométrico simples, sem limites anatômicos ou IK.

## O–Q. Dispatch exato, Idle/Static e vínculo Registry→executor

`executors.ts` contém uma tabela explícita e independente das listas que geram metadata. `requireExecutor` exige ID exato e categoria. `verifyExecutors`, executado no construtor do Registry, rejeita recursos available sem executor conhecido. Adicionar só metadata não é suficiente.

Character, Environment, Prop, Vfx, poseAt e cameraAt verificam a identidade nas chamadas diretas. Não existe unknown→Caio, unknown→Radio, unknown→Frost, unknown→Static ou unknown→pose base. IDs desconhecidos geram EXECUTOR_NOT_FOUND, inclusive em bindings inativos.

Idle tem case intencional que conserva a pose base. Static tem case explícito que conserva posição/alvo. Radio e Frost possuem branches próprios. Flashlight/Lantern permanecem compartilhados intencionalmente. Os 49 IDs foram chamados nas suas implementações reais em teste/evidência; não se tratou apenas de testar metadata. `executor-results.json` registra todos eles.

## R. Desacoplamento da demo

`src/index.tsx` não importa nem compila cold-opening.json. Default de desenvolvimento é uma galeria produzida pela biblioteca existente; não é preset novo registrado. `calculateMetadata` recebe a sequence validada por inputProps. A CLI mantém o exemplo apenas como default explícito quando nenhum arquivo é informado.

Teste percorre recursivamente o grafo de imports relativos do entrypoint e confirma ausência de dependências de examples/cold-opening. O bundle real dos testes de integração usa o mesmo entrypoint. Nenhum arquivo de demo precisou ser movido ou removido. Os testes antigos ainda usam a fixture histórica; os novos testes H01–H04 e de render usam fixtures próprias. A regressão antiga de áudio com dois frames foi ajustada para uma narração curta válida, preservando o seu objetivo e respeitando o novo erro explícito para captions insuficientes.

## S. Testes reais de render e mídia

Comando separado: `npm run check:engine3d:render`. Não participa do check rápido.

| Teste | Verificação |
|---|---|
| A | renderStill E2E com JSON independente: Lia, Winter, Thermometer, Point/Look, Snow e Orbit |
| B | Mesmo frame duas vezes, comparação SHA-256 dos PNGs |
| C | MP4 com track de narração e timing guiado pela duração medida; provider fake offline por default, edge-tts por opt-in |
| D | ffprobe verifica H.264/AAC, 480×854, 30fps, frames/duração e diferença A/V dentro da tolerância |

As quatro integrações passaram com provider fake e foram executadas também com **edge-tts real** via ENGINE3D_REAL_TTS=1. A última rodada registrada usa edge-tts; a primeira execução real gerou o áudio e a repetição reutilizou o cache.

Configuração preservada: pt-BR-AntonioNeural, +0%, +0Hz. Chaves e conteúdo do cache antigo permanecem válidos. Não foi acrescentado retry, lock, troca de provider ou novo TTS. A única guarda nova no adapter rejeita fps inválido antes de sintetizar.

Artefatos principais:

- `out/engine3d/phase6b/lia-thermometer.png`, gerado e inspecionado visualmente: personagem, termômetro −63 e caption visíveis.
- `narration-integration.mp4`, última rodada:78 frames, vídeo2,600s, AAC2,603s, contêiner2,603s; origem edge-tts2,568s. H.264/AAC, 480×854, 30fps.
- `determinism-1.png` e `determinism-2.png`, frame30. Ambos SHA-256: `9e10fc836203227755a3184b3f94656d17b40b66b0ff31fbb792ab7879bddeec`.

Hashes iguais valem para a mesma instalação/GPU/configuração testada, não prometem equivalência entre máquinas. A narração da prova é curta e independente: “Lia observa o termômetro.”

## T. Caption hardening

Mantidos estilo, margens e grupos de até3 palavras. Se número de frames for menor que número de cues, agora ocorre **CAPTION_DURATION_TOO_SHORT**. Nenhuma palavra desaparece silenciosamente por filtragem de cue com zero frames. A divisão segue determinística, sem boundaries de palavra. O preflight estrutural da CLI não aplica a duração fixa provisória às captions de um plano que será sincronizado pelo áudio; a compilação final valida a duração real.

## U. Guardrails de performance

Configuração versionada em `limits.ts`:

| Limite por shot | Valor |
|---|---:|
| Characters | 8 |
| Props | 32 |
| Action bindings | 32 |
| VFX bindings | 12 |
| Snow particles somadas | 160 |

Snow mantém teto80 por binding; intensidade é convertida em round(80×intensity), e a soma considera todos os bindings de forma conservadora, mesmo se suas janelas não coincidirem. Excesso produz PERFORMANCE_LIMIT antes do render. Testes cobrem limite exato e overflow. Esses limites protegem contra JSON acidentalmente explosivo; não representam benchmark nem capacidade garantida de GPU. Não houve otimização de malhas.

## V. Registry preservado

| Categoria | Antes | Depois |
|---|---:|---:|
| Characters | 6 | 6 |
| Environments | 9 | 9 |
| Props | 14 | 14 |
| Actions | 10 | 10 |
| Cameras | 7 | 7 |
| VFX | 3 | 3 |
| Scene Presets | 0 | 0 |
| **TOTAL** | **49** | **49** |

O diff do registry preserva as definições/identidades; acrescenta apenas a verificação de executores. Não foi necessário parar por mudança de contagem.

## W–X. Contagem de testes e checks

- Antes:124 testes rápidos, zero testes de render.
- Depois: **177 testes rápidos + 4 testes de integração/render =181 testes distintos**, todos aprovados. São53 novos testes rápidos; os loops internos de transforms não são inflados como testes separados.
- RED:4/4 falhando antes das correções. GREEN:4/4 passando após as correções.
- `npm run typecheck`: PASS.
- `npm run check:engine3d`:177 PASS, zero falhas/skips.
- `npm run check:engine3d:render`:4 PASS, zero falhas/skips, incluindo rodada opt-in real.
- `npm run engine3d:catalog`:49 recursos.
- `npm run engine3d:director -- examples/cold-opening.json`: compatibilidade do comando verificada.
- `npm audit`:zero vulnerabilidades. Não foi executado npm audit fix. Nenhuma dependência/versionamento foi alterado; package-lock permanece igual.

Evidências obrigatórias, todas em `out/engine3d/phase6b/`:

1. regression-results.json
2. path-security-results.json
3. transform-results.json
4. executor-results.json
5. render-test-results.json
6. determinism.json

Também existem red.tap, green.tap, fast.log, render.log, render-real.log, typecheck.log, npm-audit.json/log, render-plan.json, media-metadata.json e integration-audio-manifest.json. Paths de artefatos persistidos nos JSONs são relativos; amostras de ataque são strings de teste, não caminhos usados para escrita.

## Y. Limitações restantes

- Anchors continuam analíticos; face é offset aproximado. Não existem bones, IK, pitch, expressões faciais novas ou limites anatômicos do reach.
- Timing de fala/cues continua estimated_proportional; não há word boundaries reais. Fonte/padding de captions continuam em pixels fixos e palavras longas ainda exigem cuidado editorial.
- Actions de locomoção ainda retornam à pose base fora da janela; esta fase não criou transporte de estado ou física universal. finalState agora precisa concordar com o prop executado, mas não é um motor genérico de simulação.
- Cache não possui lock/retry/checksum de conteúdo; preservado conforme escopo. Primeiro uso real de edge-tts depende de rede. O check rápido e integração fake não dependem desse serviço.
- Containment de nomes/links não substitui isolamento do sistema operacional contra alterações concorrentes externas do filesystem.
- Galerias e geometria permanecem simples; Flashlight/Lantern compartilham visual e não ganharam emissão luminosa; Ocean continua plano estilizado. Nenhum recurso narrativo foi ampliado.
- Limites são estáticos por shot e não benchmark de throughput ou garantia de memória. Determinismo entre GPUs/PCs não foi certificado.
- Os relatórios anteriores permanecem históricos. Arquivos avulsos do usuário e o pack externo foram mantidos fora do trabalho.

## Z. Recomendação para próxima fase

Revisar as evidências e estabilizar estes contratos antes de qualquer expansão. Uma fase posterior pode tratar cache concorrente e qualidade editorial/responsividade das captions, com requisitos próprios; integração de assets deve continuar separada. **Nenhuma próxima fase foi implementada.**
