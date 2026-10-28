# Contratos e extensão

## Fase 14: demonstrações visuais

O inventário atual contém 50 IDs: os 49 anteriores e `PROP_CAR_001`. Estados e operações não criam novos IDs. [DEMONSTRATION.md](DEMONSTRATION.md) documenta o compilador puro e a integração opcional com DirectedSequence; exemplos em `examples/demonstration/`. As seções históricas abaixo descrevem seus contratos à época e continuam válidas para o caminho legado.

## Hardening 6B

Os 49 IDs permanecem iguais. `executors.ts` associa exatamente cada ID a uma chave de execução por categoria; Registry verifica todos os recursos available ao construir o catálogo. Character/Environment/Prop/Vfx/cameraAt/poseAt checam identidade também nas chamadas diretas. IDs desconhecidos produzem EXECUTOR_NOT_FOUND; Idle e Static são casos explícitos, Radio/Frost têm branches próprios. Flashlight/Lantern continuam compartilhados intencionalmente.

`schema.ts` verifica tipos de todos os campos conhecidos, shapes, enums e números finitos. `sequence-validation.ts` protege os inputProps de runtime/Studio, além da validação do DirectorPlan. onScreenText, narrationSegment e visualIntent são strings, nunca objetos. Directions precisam ser vetores não nulos. Point/Look aceitam exatamente um de target, targetPosition e direction; Walk/Run aceitam apenas targetPosition; ações sem alvo rejeitam bindings ignorados. Look suporta apenas yaw: o componente vertical local não gera pitch.

VFX: Snow não tem actor/target/anchor. ColdBreath exige actor de personagem + anchor face. Frost aceita **actor de personagem + anchor**, ou **target de prop**, sem misturar os modos. Target de personagem e actor de prop são rejeitados. Não existe fallback de binding ausente para origem. Attachments usam a matriz do anchor ou do prop: offsets locais acompanham posição, orientação e escala.

Estado inicial é normalizado em parameters na resolução. Parâmetro e initialState simultâneos precisam concordar. Thermometer usa esse valor canônico para a coluna e o número. finalState declarado precisa concordar com a execução atual do prop; divergência gera CONTINUITY_MISMATCH. Não há novos keyframes ou interpolação de temperatura.

Anchors continuam **analíticos**, não extraídos de meshes/bones. A transformação é `T * R(XYZ) * S * LOCAL`, com inversa Matrix4.invert. Matriz do corpo inclui lean e a matriz da face inclui headYaw. Point transforma alvos mundiais para o espaço do corpo; Look compensa a orientação inicial do ator. Door geometry, handle e ação usam `effectiveDoorOpenProgress`; a mão usa a matriz inversa do corpo, inclusive com XYZ/escala combinados.

Escritas derivadas de IDs usam paths.ts: política fechada de filename, containment lexical após path.resolve e containment canônico para links existentes. IDs lógicos de shots continuam podendo conter texto que não seja nome de arquivo, mas um comando que tente gerar preview com tal ID falha antes do bundle. A verificação não é um sandbox do sistema operacional contra um processo externo que altere links entre checagem e escrita.

Guardrails: characters8, props32, actions32, VFX12 e snow total160 por shot. Não há mudança de malhas ou benchmark implícito. Captions com menos frames que cues falham, preservando o limite de três palavras em vez de eliminar conteúdo. A distribuição temporal continua estimada.

## REUSE BEFORE CREATE

Gere catálogo (`npm run engine3d:catalog`), consulte ID, tags e capabilities e confira `metadata.compatibleCharacters`. Crie um novo recurso apenas quando nenhum recurso existente atender. Não escreva TSX específico para roteiro.

## Registry

`Registry.getById`, `has`, `listByType`, `searchByTags` (AND das tags) e `resolve` consultam descritores. `resolve` retorna `{ok:true,resource}` ou `{ok:false,reason}` com NOT_FOUND, UNSUPPORTED ou DEPRECATED. Catálogo contém apenas dados, sem funções ou caminhos absolutos. Instâncias usam `instanceId`; recursos usam `resourceId`.

## ShotSpec

Veja `examples/shot.json`. `resolveShot` valida estrutura, IDs/tipos, duração, parâmetros, transforms, timing normalizado, ator/alvo, anchors e matriz de compatibilidade. Retorna ShotSpec com position/rotation/scale explícitos. Defaults: `[0,0,0]`, `[0,0,0]`, `[1,1,1]`. Rotação em radianos e escala positiva por eixo. Campos desconhecidos são erros.

Parâmetros registrados: Door.openProgress [0,1], Thermometer.value [-150,150], Snow.intensity [0,1], Camera.strength [0,3]. Outros parâmetros falham. Bindings usam `0 <= start < end <= 1`. ColdBreath exige actor + anchor face; Frost aceita actor/anchor ou target de prop; Snow é independente. OpenDoor exige Caio/Lia e uma Door. Point/Look aceitam posição, objeto ou direção. OpenDoor, Point, Look e Run só são compatíveis com Caio/Lia.

## Geometria e anchors

`rig` é compartilhado entre geometria e consultas. Head/chest são centros dos volumes; face é a superfície frontal da cabeça; mãos seguem extremidades dos braços. `anchorAt` aplica pose, escala, rotação e translação. Caio/Lia usam o mesmo corpo com identidade visual configurada; Zombie reutiliza o humano. `supportsAnchor` consulta metadata. Movimentos usam frame normalizado, nunca relógio real. Snow usa seed estável e no máximo 80 partículas por instância.

## DirectorPlan e timeline

Cast mapeia nomes estáveis para personagens. Cada personagem no DirectorShot informa castId e instanceId; resourceId opcional só pode confirmar o cast. Scenes herdam environment para shots, que podem sobrescrevê-lo explicitamente. visualIntent é documentação. IDs e orders de cenas/shots devem ser únicos nos respectivos espaços de validação. Somente CUT é executável.

Compilador ordena cenas/shots por order e atribui intervalos `[startFrame,endFrame)`. Durações fixas arredondam para frames, com mínimo de um frame. Em narration, duração da Scene é `ceil(duração real * fps)`, distribuída proporcionalmente ao comprimento dos narrationSegments. Os limites cumulativos garantem soma exata, sem gaps/overlaps. Falha se áudio for curto demais para conter todos os shots.

Props podem declarar continuityKey, initialState e finalState. Repetir a chave exige resourceId idêntico e estado inicial com os valores finais anteriores. Estado é escalar e usa os mesmos parâmetros validados. Não há transporte automático de objeto, simulação ou estado global mutável durante render.

## Narração e captions

NarrationProvider é um adapter Node. EdgeTtsNarrationProvider chama `python -m edge_tts` por argumentos, sem shell. Uma faixa por Scene. Cache SHA-256 inclui configuração; escreve arquivo temporário, mede com ffprobe e promove somente arquivo válido. Mesmo em cache, duração é medida novamente. FakeNarrationProvider cria WAV determinístico e silencioso para testes offline.

Erros: TTS_FAILED, AUDIO_FILE_MISSING, AUDIO_DURATION_INVALID, FFPROBE_FAILED, NARRATION_EMPTY. Cache HIT/MISS é impresso. Áudio do manifest usa caminho relativo a public. Captions têm até três palavras e intervalos em frames absolutos da sequence. O renderer toca áudio na Scene, não nos shots.

## Adicionar recurso

1. Consulte catálogo antes de criar.
2. Adicione descritor com ID único em registry.ts e schema de parâmetros fechado.
3. Implemente geometria em library.tsx ou pose/câmera em motion.ts; mantenha componentização genérica.
4. Se for ação, declare compatibilidade explícita. Se for personagem, calcule anchors a partir do rig real.
5. Adicione testes de entradas válidas/inválidas e comportamento, gere catálogo, rode typecheck/testes e renderize preview.

## Produzir vídeo

Crie DirectorPlan JSON usando recursos existentes, compile com `engine3d:director`, inspecione storyboard, gere previews e execute `engine3d:render-director`. `--narrated` cria narração real e ajusta toda a timeline. Estude o JSON de exemplo; nenhum componente novo é necessário para mudar roteiro.
