# PHASE15 — Auto Director v1

2026-10-28. Evidência local em `out/engine3d/phase15/`.

## A. Objective

Construir roteiro → claims → requisitos → seleção → demonstração/direção executável. **Resultado: LEVEL 2**, com piloto automático dentro dos padrões suportados; limitações de semântica, montagem geral e interoperabilidade descritas abaixo. Não foi implementado tema → roteiro.

## B. Why Auto Director now

A Fase 14 já executa estados, operações e sequências. Esta fase automatiza a autoria acima desses contratos. Os três fixtures não fornecem cenas, recursos, câmera, blocking ou operações. As leituras e auditorias das fases anteriores orientaram continuidade, foco e recusa de prova falsa.

## C. Architecture

`AutoDirectorInput → segmentScript/extractClaims → CapabilityGraph → selectTemplate → generate → AutoDirectorPlan → compileAutoDirector → DirectedSequence/VisualDemonstration → renderer existente → MP4`. Core sem filesystem, rede, clock, random ou LLM; Node crypto apenas para hash determinístico. CLI e shells de evidência fazem I/O. Nenhum segundo renderer.

## D. AutoDirectorInput

v1: id, language, vertical_short, fps, canvas e script obrigatório; claims, durações medidas e constraints opcionais. Campos desconhecidos/topic são rejeitados. targetDuration não autoriza cortar/acelerar; styleProfile é metadata reservada. Cast preference tem alcance limitado ao padrão de pergunta. Contrato não equivale a um planejador universal de restrições.

## E. Script segmentation

Pontuação/quebras determinísticas com offsets UTF-16 no source original. Separadores continuam nas unidades; concatená-las reproduz o script integral. Água: cinco NarrativeUnits. Sentença não vira corte: as cinco unidades usam uma única sequência contínua.

## F. Claims

Dois caminhos: cinco claims explícitos fornecidos + contexto inicial heurístico na água; ou heurísticas locais. NUMBER, TEMPERATURE, RANKING, OBJECT_STATE, QUANTITY_CHANGE, COMPARISON, LOCATION, QUESTION e pistas causais são reconhecidos em formas restritas. Reconhecer localização/causa não implica demonstrar sua relação; casos desconhecidos viram gap. Sem NLP geral ou pesquisa factual.

## G. Claim confidence

EXPLICIT/HIGH significa confiar na anotação de entrada, não verificar fatos. HEURISTIC HIGH para formas numéricas/pergunta/ranking; MEDIUM para padrões físicos conhecidos; LOW para desconhecidos. LOW com prova exigida produz gap, inclusive em STRICT. Intro retórica e conclusão do piloto não contam como prova.

## H. Visual requirements

Cada claim registra importância, prova exigida, alvo, assunto, capacidades necessárias e fallback explícito. PRIMARY com prova não sofre downgrade silencioso para apresentador/símbolo. Orçamentos por unidade registram até oito sujeitos (ou constraint menor) e quatro movimentos narrativos simultâneos; validadores existentes impõem os limites executáveis.

## I. CapabilityGraph

Snapshot combina os 50 recursos reais com declarações explícitas, status/parâmetros e contratos de primitivas/direção/texto. `primitive:CYLINDER`, `primitive:PATH` e `contract:*` são nós de capacidade, não novos IDs do registry. Enumeração ordenada; sem busca por substring do nome do recurso.

## J. Resource metadata

Metadata semântica centralizada para carro, termômetro, porta, apresentador e contexto LAB. Disponibilidade e frost max são consultados no registry. A maioria do acervo ainda não tem declaração semântica rica. O carro é um exemplar de objeto congelável permitido pelo fixture, não uma identificação factual extraída do substantivo genérico.

## K. Demonstration templates

Nove variantes em famílias pequenas: STATE_CHANGE, QUANTITY, FLOW, REVEAL de armazenamento, REVEAL_DOOR, TEMPERATURE, RANKING/NUMBER, COMPARISON e QUESTION. Comparação é texto numérico, ranking é identificação textual; não representam automaticamente geografia, multidões ou causalidade científica. Não são vídeos prontos nem prova por si só.

## L. Resource resolver

Tags e cobertura integral das capacidades determinam elegibilidade. Os candidatos rejeitados e o escolhido ficam no decision trace, com recursos e razões. O congelamento encontra PROP_CAR_001 pelo grafo. PATH ausente impede a prova de fluxo; uma escolha de template sem execução suficiente é recusada pela checagem por claim.

## M. Scoring

Pesos executados e exportados: capacidade +100, semântica +24, prova +40, modo sem presenter +12; template −12, modo −8, sujeito −8, framing −8, zona −4; continuidade líquida +16. Soma explícita por decisão. Desempate: score desc., prioridade desc., template ID asc.; IDs de recursos ordenados. Escore é regra transparente, sem calibração estatística ou pretensão de qualidade universal.

## N. Repetition penalty

Penaliza template/modo/recurso consecutivos. Framing e zona usam **proxy de template repetido**, não geometria real de candidatos renderizados. Isso é uma limitação desta implementação: não há otimizador de enquadramento/composição completo. A continuidade pode justificar repetição; não foi forçada variedade cosmética para melhorar contadores.

## O. Continuity bonus

Claims líquidos consecutivos compartilham origem, caminho, destino e estado. Bônus +16 favorece continuidade. Claims de domínios PRIMARY misturados ainda são recusados como RESOURCE_CONFLICT, em vez de receber uma sequência semanticamente inadequada. A montagem geral de múltiplos domínios permanece limitada.

## P. Visual modes

Contrato aceita intenções de modo no arco. Nesta fase os padrões exercitados usam DEMONSTRATION, HYBRID, TEXT_FOCUS, PRESENTER e VISUAL_GAP. ENVIRONMENT isolado não tem gerador amplo. Presenter aparece apenas quando o padrão o pede; água não tem ator. TEXT_FOCUS editorial pode continuar sobre o mesmo objeto demonstrado.

## Q. Visual arc

Água: contexto editorial → demonstração contínua de trajeto/subida → nível/armazenamento → conclusão sobre resultado persistente. Arco não implica cortes nem troca de cenário por frase. Foco interno muda da relação entre origem e destino para o reservatório.

## R. Duration planning

Duração real do edge-tts por unidade, quantizada a frames: 118, 133, 134, 166 e 160; total **711 frames / 23,7 s**. Sem dados medidos, estimativa por palavras. Tempo de grupo de legenda permanece ESTIMATED; medir duração de áudio não é alinhamento por palavra. Nenhuma aceleração/corte de roteiro.

## S. Shot/sequence planning

Uma DirectedSequence e uma VisualDemonstration para toda a água. Momentos internos de conexão, fluxo, enchimento e hold; nenhum cut no contrato autoritativo. A projeção editorial antiga tem boundaries exigidas pelo schema, que não controlam o render contínuo.

## T. Blocking planning

Água é actorless. Porta usa APPROACH e ação existente; pergunta usa STAY à esquerda, com propósito explícito. Não há pathfinding; SIDESTEP/TURN/RETREAT continuam capacidades do motor, não cobertura automática completa deste v1.

## U. Camera planning

Template gera contexto/push e reframe/orbit para a consequência. Movimento tem propósito e endpoint; sem câmera aleatória ou troca de ID para satisfazer métricas. Direção ainda simples, sem busca/otimização geométrica geral. Origem pode sair parcialmente do frame após a transferência quando destino passa a ser o foco.

## V. Focus planning

Foco cobre os intervalos relevantes: conexão/trajeto antes do enchimento e reservatório durante nível/hold. Validação por claim confere cobertura temporal. Teste de mutação sem focus reprova. Isso não substitui inspeção de legibilidade/oclusão nos pixels.

## W. Demonstration generation

Água usa CYLINDER/CYLINDER/PATH locais, CONNECT/FLOW/INCREASE/DECREASE e persistência de estado. A trajetória sobe porque a semântica contém subida; não há branch por ID do piloto. Congelamento usa ACCUMULATE e CHANGE_STATE com estados NORMAL/FROSTED/FROZEN. São diagramas de processo, sem solver hidráulico ou térmico.

## X. VisualProof

`qa.ts` verifica por claim e janela: assunto, operação/processo, consequência e foco. C2 exige path ascendente; C3 exige aumento no intervalo; C4 exige água visível armazenada. Testes removem essas evidências separadamente. ExecutedProof do piloto combina estados/ops com revisão dos frames; não foi promovido só por haver um template.

## Y. VisualGap

Oito motivos e seis recomendações tipados. Fixture impossível: MISSING_SUBJECT/scientific_crowd, proof NONE, recomendação EXTERNAL_MEDIA apenas diagnóstica. Zero sequências/demos/recursos selecionados. Não se usou Caio + Radio como prova. Falhas de geração recebem BUDGET_LIMIT genérico: classificação de erro ainda é pouco detalhada.

## Z. Planning modes

PLAN_ONLY preserva diagnóstico. STRICT falha em PRIMARY com prova/gap não autorizado. allowedGapIds exige IDs exatos; IDs desconhecidos falham. Aceitar gap não cria evidência e não torna renderPlan renderable. Havendo gap, este v1 evita render parcial silencioso e limpa os artefatos de execução.

## AA. Compiler

Emite EditorialPlan, EventMap, DirectorPlan, DirectedSequences, VisualDemonstrations, proof e renderPlan, com validação de contratos e fingerprint. **Limitação importante:** o EditorialPlan antigo só aceita foco em instância registrada e CUT entre beats; não representa primitivas locais. A projeção usa PROP_BOTTLE_001/interop-container explicitamente SYMBOLIC para interoperabilidade. Ela não é o vídeo/prova da água. DirectedSequence sidecar é autoritativo. Portanto ainda não há equivalência visual completa pelo DirectorPlan legado sozinho.

## AB. Determinism

Versões autodirector-planner/1.0.0 e autodirector-compiler/1.0.0. Fingerprints incluem entrada/claims/constraints, snapshot/metadata, templates e pesos, sem caminho/mtime/máquina/clock. Repetição e ordem de enumeração invertida produzem o mesmo plano/fingerprint; compiler rejeita plano alterado. Determinismo é dos planos/frame evaluation; não foi prometida identidade byte a byte de MP4 entre PCs.

## AC. Water fixture

Script fornecido preservado literalmente. Cinco claims explícitos C1–C5; C1 tubulação, C2 subida, C3 nível e C4 armazenamento PRIMARY/prova; C5 conclusão SUPPORTING sem prova física adicional. Contexto inicial heurístico completa seis claims. Inputs não contêm autoria de cena. Plano e compilados foram gerados pelo mesmo core usado na CLI.

## AD. Freezing fixture

Segundo fixture genérico, com outro assunto: um objeto acumula gelo até ficar coberto. Seleção automática de exemplar carro/STATE_CHANGE; uma sequência estimada de 5 s, uma demo, final frost=1/FROZEN. O teste troca o ID do fixture e mantém a seleção. Evidência aqui é estrutural/estado/testes, sem novo render deste fixture na Fase 15.

## AE. Impossible fixture

Multidão de pesquisadores/equipamentos complexos dentro de estação: PRIMARY exige prova, gera MISSING_SUBJECT e nenhuma sequência. Nenhum DIRECT; nenhum presenter/radio selecionado. STRICT rejeita e allowance explícita conserva gap. Teste crítico de honestidade passou.

## AF. Render pilot

MP4 voice-only H.264/AAC, 480×854, 30 fps, 23,7 s, 48 kHz estéreo. Renderer DirectedSequence existente, consumindo JSON compilado. edge-tts pt-BR-AntonioNeural, rate +0%, pitch +0Hz e cache existentes preservados; reruns dão CACHE HIT. Sem SFX/overlays/música. Quatro páginas com 16 frames, três motion strips e quatro amostras do MP4 decodificado. Contraste dos recipientes foi corrigido no template e o plano/rerender regenerados.

## AG. Proof coverage

| Claim | Janela de frames | Planejado | Executado | Evidência |
|---|---:|---|---|---|
| C1 | 118–251 | DIRECT | DIRECT | CONNECT antes de FLOW; líquido percorre tubo |
| C2 | 118–251 | DIRECT | DIRECT | path sobe; progressão azul em trecho vertical |
| C3 | 251–385 | DIRECT | DIRECT | destino vazio → nível .85; origem diminui |
| C4 | 385–551 | DIRECT | DIRECT | nível mantido e visível até encerramento |

primaryClaimCount=4; directPlanned=4; directExecuted=4; partial=0; symbolic=0; gaps=0; directVisualProofRate=1. Estes quatro casos foram checados individualmente; 100% é resultado deste fixture escolhido por suporte, não benchmark geral. C5/contexto não entram no denominador.

## AH. Repetition

Métricas da Fase13 executadas: 0 cuts/min; 30.38 mudanças/min; maior intervalo sem mudança detectada 11.43 s; três avisos de composição repetida. Zero frames de ator/ator central. O hold final é longo. O adaptador antigo mede props registrados, não fill/flow de primitivas; density.prop=0 e dominantProp=NONE não significam ausência de processo. actorApparentSize=0/ABSENT; distâncias usam foco quando não há ator. Nenhuma comparação quantitativa nova com referência foi alegada.

## AI. QA

PASS técnico: source coverage/offsets/confiança, compatibilidade/capacidades/IDs, contratos/guardrails, câmera/foco/estados, timeline/captions, decode integral FFmpeg, A/V e determinismo. Áudio sem clipping; duração de vídeo/áudio 23,7 s. Imagens não vazias e encoded samples comparados aos stills com tolerância de compressão. Revisão visual por Codex, sem inferir aprovação humana/avaliação estética automática. Fonte: analysis/qa-results.json, visual-proof.json e logs.

## AJ. Performance

Medição separada (uma execução, sem prometer benchmark estável):

| Fixture | Plan ms | Compile ms | Claims/requirements | Avaliações de candidatos | Templates avaliados | Sequências/demos/gaps |
|---|---:|---:|---:|---:|---:|---|
| water | 126.26 | 90.02 | 6/6 | 36 | 9 | 1/1/0 |
| freezing | 22.71 | 10.01 | 1/1 | 9 | 9 | 1/1/0 |
| negative | 2.23 | 0.93 | 1/1 | 0 | 0 | 0/0/1 |

Render/stills/bundle/encode/mux/QA wall: 59.94 s, concurrency=2. Biblioteca fixa com nove variantes; O(claims × 9 × nós), sem busca combinatória explosiva. Contextos pulam scoring; crowd impossível sai antes de avaliar candidatos.

## AK. Tests

Nove comandos PASS:

- npm run typecheck: exit 0
- npm run check:engine3d: tests 377, pass 377, fail 0
- npm run check:editorial: tests 46, pass 46, fail 0
- npm run check:sound: tests 35, pass 35, fail 0
- npm run check:visual: tests 37, pass 37, fail 0
- npm run check:motion: tests 30, pass 30, fail 0
- npm run check:demonstration: tests 30, pass 30, fail 0
- npm run engine3d:catalog: exit 0
- npm run check:autodirector: tests 23, pass 23, fail 0

23 testes Auto Director (também incluídos em check:engine3d, não somar duas vezes). Cobrem contratos/offsets, heurísticas, seis padrões nativos e demos, rejeições, prova individual, orçamento, gaps/modes, hash/tamper e ordenação/determinismo. CLI plan/compile smoke PASS. Sem instalação/atualização de dependências.

## AL. Registry

Engine3D=50: 6 personagens, 9 ambientes, 15 props, 10 actions, 7 câmeras, 3 VFX, 0 presets. SFX=8; VISUAL=5. Nenhum ID novo. Nodes de capability não expandem esses registries; hashes das fontes anteriores preservados.

## AM. Compatibility

Todos os checks anteriores permanecem PASS. Baseline por SHA-256: apenas package.json (scripts) e directed-metrics.ts (ausência de ator) alterados entre arquivos preexistentes desta fase; módulos novos ficam separados. Lockfile, edge-tts, sound, visual, editorial e render runtime preservados. Master Cold Places 81,8 s e cinco pilotos das Fases13/14 têm hashes originais confirmados. Nada publicado/commitado/enviado.

## AN. Limitations

Vocabulário finito, anáfora/contexto por unidade frágeis e sem parser semântico geral; metadata esparsa; domínios mistos não montados; alguns erros de geração classificados genericamente como BUDGET_LIMIT; comparação/ranking textuais; REVEAL de armazenamento não é sistema geral de ocultação; recursos/fábricas limitados aos sujeitos conhecidos; orçamento/score não otimizam geometria global; Diretoria legada exige projeção simbólica; hold longo; sem alinhamento real de palavras, dinâmica física ou verificação factual. Plano válido e proof estrutural não garantem vídeo editorialmente excelente.

## AO. Honest assessment

| Dimensão | Nota | Evidência e limitação |
|---|---|---|
| SCRIPT COVERAGE | GOOD | texto/ordem/offsets preservados; alinhamento estimado |
| CLAIM EXTRACTION | WEAK | padrões locais e rejeições; explicitos ainda necessários |
| CAPABILITY MATCHING | GOOD | metadata/status/contratos; acervo parcialmente anotado |
| RESOURCE SELECTION | ACCEPTABLE | carro/props/primitivas resolvidos; opções restritas |
| DEMONSTRATION CHOICE | GOOD | fluxo/fill/freeze executáveis; domínio limitado |
| CAMERA DIRECTION | ACCEPTABLE | propósito/foco/endpoints; composição simples |
| VISUAL PROOF | GOOD | quatro provas individuais + frames; sem garantia geral |
| CONTINUITY | GOOD | uma sequência com estado persistente; sem montagem mista |
| REPETITION | WEAK | penalidades/avisos; proxies e hold longo |
| GAP HONESTY | GOOD | negativo sem DIRECT e sem presenter; cobertura adversarial finita |
| OVERALL AUTONOMY | ACCEPTABLE | LEVEL 2 demonstrado; sujeito/claims novos não garantidos |

**Roteiro + claims explícitos → direção executável sem autoria manual de cenas? SIM, dentro dos padrões suportados, via DirectedSequence autoritativo.** Projeção DirectorPlan antiga continua limitada.

**Somente roteiro já é confiável o suficiente? NÃO para uso geral.** Teste sem claims reconhece alguns padrões MEDIUM/HIGH e contexto; localização/causalidade/negativas desconhecidas produzem gaps. Isso não demonstra compreensão completa ou LEVEL 3 confiável.

**Recusou honestamente o fixture impossível? SIM.**

**Estágio atual: LEVEL 2 — manual claims + automatic direction.** Não LEVEL 3/4/5.

## AP. Next recommendation

**Único maior gargalo:** extração/interpretação semântica confiável de claims a partir do roteiro, com limites de prova claros.

**Único próximo investimento recomendado: A) semantic claim extraction.** Não implementado nesta fase. Nenhum topic→script, Higgsfield, música, pack scan ou expansão de engine iniciado. Fase15 encerrada após implementação, testes, piloto, QA e este relatório; Fase16 não iniciada.
