# Contratos e extensão

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
