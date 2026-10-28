# PHASE 14 — Visual Demonstration System

Concluída em 28/10/2026 (America/Sao_Paulo). Pilotos técnicos validados; revisão humana estética não presumida.

## A. Objective

Implementar SHOW THE CLAIM em dois pilotos curtos. Estado: pipeline técnico validado; inspeção visual das amostras/strips realizada. Avaliação estética humana não presumida. Nenhum vídeo de 81s foi rerenderizado ou publicado.

## B. Structural gap

Fase13 corrigiu continuidade, mas mostrava apresentador/props simbólicos enquanto narrava acontecimentos ausentes. A Fase14 passa a representar o objeto mudando de estado e um processo com consequência visível. Os relatórios AUDIT e Fases6B/9/10/11/12/13, contratos de direção, biblioteca e evidências da referência foram consultados.

## C. Reference lesson

A lição genérica é contexto → transformação → consequência, com câmera orientada pela explicação. A referência local foi previamente amostrada a 1fps na Fase13; a auditoria atual usa oito janelas dessa amostra. Não copiamos poço, modelos, identidade, geometria específica, conteúdo narrado ou composição. Reservatórios ligados acima da superfície são um diagrama novo de transferência.

## D. NarrativeClaim

Contrato explícito com id/text/type/requiresVisualProof. Tipos: OBJECT_STATE, PROCESS, QUANTITY_CHANGE, SPATIAL_RELATION, CAUSE_EFFECT e COMPARISON. CAUSE_EFFECT exige cause/transition/effect. O runtime não extrai claims de texto e não verifica sua verdade factual.

## E. VisualDemonstration

Contrato v1: id, purpose, claim, subjects, initialState, steps, finalState, presenterModes e direção-base. Não escolhe componentes React por frase. Exemplos portáveis em examples/demonstration/. Asset, estado, operação e fenômeno ficam separados: carro é um ID; congelamento é uma composição de operações/estados.

## F. Operations

APPEAR, DISAPPEAR, MOVE, ROTATE, SCALE, CHANGE_STATE, REVEAL, HIDE, ACCUMULATE, DECREASE, INCREASE, FLOW, CONNECT, SEPARATE e HIGHLIGHT. Targets e parâmetros têm validação específica; operações desconhecidas ou não suportadas falham. MOVE/ROTATE/SCALE mantêm endpoints, visibilidade persiste, início de valor/transform deve concordar com estado anterior. Não existem FREEZE_CAR/DRILL_GROUND.

## G. Prop states

PropStateDefinition contém stateId, parameters, visualModifiers e allowedTransitions. NORMAL/FROSTED/FROZEN são estados do mesmo PROP_CAR_001. Valor contínuo frost dirige a aparência durante a transição; CHANGE_STATE confirma o estágio e aplica seus defaults. Uma tag ainda NORMAL durante ACCUMULATE não significa que sua superfície continue intocada.

## H. State transitions

NORMAL→FROSTED→FROZEN. Transição reversa só passa com overrideReason explícito. Sobreposição incompatível no mesmo canal/target, ou CHANGE_STATE concorrendo com outra mudança, gera erro. Estados iniciais/finais são explícitos, comparados à evolução determinística e não guardados em singleton.

## I. Environment states

visibility, tint, fogIntensity, groundCutaway e backgroundEmphasis. Visibilidade controla geometria do contexto preservando luz/background; tint multiplica cor; fogIntensity modifica near/far; backgroundEmphasis escurece o fundo. Cutaway é capability-gated no LAB; outros ambientes rejeitam. O processo abre o piso, revela três camadas e depois oculta o contexto, retirando a bancada que competia com a conexão. Nenhum environment novo.

## J. Demonstration compiler

demonstration-compiler/1.0.0. Função pura compileDemonstration em src/engine3d/demonstration.ts: sem filesystem, network, LLM, relógio ou random. Canonical JSON/SHA-256 reutilizam fingerprint existente. O compilador valida e empacota uma trilha demonstrativa opcional em DirectedSequence; a evolução é avaliada pelo runtime dessa mesma direção, sem outro renderer.

## K. DirectedSequence integration

O schema DirectorPlan/ShotSpec permanece intacto. DirectedSequence/SequenceState recebem campos opcionais de demonstração; paths legados continuam sem eles. Mesmo ThreeCanvas, câmera, props, VFX e overlays existentes. Props sob ownership da demonstração não podem concorrer com PropMotion/action target. O compilador deriva e valida o endpoint global da direção; finalState da demonstração é obrigatório e verificado.

## L. VisualProof

NONE/SYMBOLIC/PARTIAL/DIRECT, evidências e demonstrationId opcional. proofQa valida cobertura de claims e presença de evidências; a adequação semântica é anotação assistida, não inferência estética ou factual automática. Taxa DIRECT e coverage têm denominadores distintos e não são score universal.

## M. Phase12 proof audit

18 beats auditados: {'DIRECT': 8, 'PARTIAL': 1, 'SYMBOLIC': 5, 'NONE': 4}. Quatro perguntas/promessas são excluídas da necessidade de prova; 8/14 claims principais possuem representação DIRECT (57.1%). Ranking DIRECT refere-se ao nome/posição mostrados, não à geografia. Auditoria de uma claim principal/agregada por beat, não de todos os subfatos. O relato de carros congelados era SYMBOLIC.

## N. Reference proof sample

Oito janelas selecionadas de propósito: 7 DIRECT e 1 PARTIAL (87,5% nessa amostra). São observações visuais genéricas, não transcrição nem fact checking. Seleção não aleatória e resolução temporal ±1s; não extrapolar para os 86s inteiros nem comparar essa taxa como uma classificação de qualidade dos sistemas.

## O. Car prop

Único novo ID autorizado: PROP_CAR_001. Inventário anterior não tinha veículo: Map, Door, Bottle etc. não representam carro sem fingir outra coisa. Malha local sem marca/logo/modelo real, sem download externo. Boxes, quatro rodas cilíndricas e janelas simples; nenhum outro novo prop, environment, action, camera ou VFX.

## P. Car states

NORMAL é vermelho, FROSTED recebe coloração azul clara e placas parciais, FROZEN recebe cobertura forte e rodas/vidros gelados. VisualModifiers são consumidos pela paleta; frost aplica tint e geometria, não apenas metadata. Três snapshots com câmera/frame idênticos foram comparados; são visualmente distintos nos testes de pixel.

## Q. Frost accumulation

frost 0→.45 em frames45–120 e .45→1 em121–210; estágios confirmados em120–121 e210–211. Até 12 patches fixos de superfície, sem emitter adicional ou milhares de partículas. Neve ambiente já existente é contexto, não a prova principal. Não há simulação de temperatura, transferência térmica ou gelo físico.

## R. Car demonstration

car-freezing-before.mp4 e car-freezing-after.mp4 têm 10s/300frames e a mesma afirmação curta na tela, sem voz/som. Antes: Caio+neve/frost simbólicos. Depois: carro normal → acúmulo → congelado → hold. Causa estilizada em0–45, transição45–211, efeito211–300. Antes SYMBOLIC; depois DIRECT para a representação visual do carro coberto, sem certificar física real.

## S. Process demonstration

process-demonstration.mp4: 11s/330frames. Fonte e destino são cilindros matemáticos declarados no JSON; conexão é PATH; três caixas são LAYER surface/subsurface/deep. Não há asset Pipe/Reservoir disfarçado com identidade/modelo próprio: são primitives dimensionáveis, sem resourceId e sem novo registry. O diagrama mostra uma transferência genérica, não um poço.

## T. Flow

FLOW usa path, progress, direction, speed e amount. Frente/comprimento azul avança em90–180; direction pode inverter o caminho, speed escala avanço normalizado, amount regula espessura. A conexão deve estar pronta antes de FLOW. QA avaliou 0/.25/.5/.75/1 e monotonicidade de comprimento acumulado. Zero partículas novas, sem fluido/pressão/simulação.

## U. Connect

CONNECT em60–90 desenha a relação entre fonte e destino; SEPARATE oferece o inverso. Caminho é uma lista limitada de pontos com segmentos não degenerados, e FLOW deve usar o mesmo path. No close final a fonte fica parcialmente fora de quadro, após ter sido apresentada durante o contexto/fluxo; o destino é o foco da consequência.

## V. Fill

INCREASE fillLevel do destino 0→.85 em180–270 produz altura líquida visível. Fonte de mesma dimensão decresce .85→0 no mesmo intervalo. Monotonicidade testada em todos os frames. O tubo não faz balanço volumétrico: é um diagrama qualitativo, não solver conservativo de massa.

## W. Camera integration

As duas demonstrações usam a direção contínua da Fase13: push/reframe/orbit, foco no objeto e consequência. Não voltamos a uma coleção de shots estáticos isolados. Carro é alvo explícito da câmera; no processo, câmera migra da relação entre recipientes para o destino enchendo. Nenhum Camera ID novo.

## X. Presenter reduction

| Versão | Duração | Presenter | Subject focus | Coverage |
|---|---:|---:|---:|---:|
| before | 10s | 10s | 0s | 0% |
| car | 10s | 2s | 10s | 100% |
| process | 11s | 0s | 11s | 100% |

PresenterScreenTime mede visibilidade executada pelo modo; subject focus é o foco declarado projetado dentro do canvas, não eye-tracking ou prova de ausência de oclusão. Coverage inclui objeto visível durante hold: não significa fenômeno mudando em todos os frames. Operações ativas cobrem 81,7% do carro e 90,9% do processo.

## Y. QA

Estados/câmera/targets/frames/valores finitos, limites, conflitos, transições, ownership e finais foram validados antes de render. Frost e fill monotônicos; FLOW com cinco progressos; 32 PNGs não vazios. Diferenças de pixels acima de 2/255: NORMAL→FROSTED 55396, FROSTED→FROZEN 63022; threshold1000. Mesma câmera/frame nos controles. Isso não é estética. Os três MP4s decodificam integralmente: H264, 480×854,30fps; silenciosos por design, portanto A/V delta não se aplica. Contatos paginados e strips de frost/flow/fill disponíveis.

## Z. Determinism

Fingerprints canônicos repetidos iguais para carro e processo. Incluem demonstration, compiler version, resource IDs e parâmetros; sem path absoluto, mtime ou machine name. Hash carro: 02667ba8d913085c3ace6c6b5af2d2c2c11bc1e575c55cbf3779127e2d9328b9; processo: 6dc508a0ccad9f215136b4e606f21e6e3e8758fdfd7cd9cdd5eb2abe8f45cc1e. Leituras fora de ordem e estado por frame testados. Módulos browser não importam o compiler Node de hash.

## AA. Performance

Avaliação local de1200 consultas: média 90.12µs, p95 214.60µs. Vídeos: car-freezing-before 22.438s; car-freezing-after 18.249s; process-demonstration 20.746s. Valores de uma máquina com trabalho concorrente, sem promessa de benchmark. Limites: 8 subjects,32steps,8pontos/path,4operações simultâneas,80meshes estimados,12patches,0partículas de fluxo. Carro até24meshes/432triângulos; processo até15meshes/≈596triângulos, excluindo ambiente/ator/VFX. Estimador de orçamento conservador:25meshes carro e23processo. Compile time e tempos de stills constam em performance.json. Sem cache de evolução mutável, sem TTS/asset novo.

## AB. Tests

npm run typecheck PASS (); npm run check:engine3d PASS (tests 354, pass 354, fail 0); npm run check:editorial PASS (tests 46, pass 46, fail 0); npm run check:sound PASS (tests 35, pass 35, fail 0); npm run check:visual PASS (tests 37, pass 37, fail 0); npm run check:motion PASS (tests 30, pass 30, fail 0); npm run engine3d:catalog PASS (); npm run check:demonstration PASS (tests 30, pass 30, fail 0). Novo check: check:demonstration,30 casos. Suítes se sobrepõem; não somar como casos únicos. Casos anteriores mantidos; quatro arquivos só tiveram contagens/labels de registry ajustados para o acréscimo autorizado. Nenhum teste foi removido para acomodar falha.

## AC. Registry

Characters6 + Environments9 + Props15 + Actions10 + Cameras7 + VFX3 + Presets0 =50. Acréscimo exato: PROP_CAR_001. MediaAssetRegistry SFX8 e VISUAL5 preservados por hash. Primitivas de demonstração não são entradas extras no catálogo. Catálogo atualizado e validado.

## AD. Compatibility

Lockfile e versões de dependências preservados. Contratos antigos, captions, edge-tts/provider/rate/pitch/cache, editorial, SoundDesign e VisualComposition não mudaram. Integração React revisada: hooks incondicionais, validação memoizada, estado puro por frame, sem effects/relógios novos. source-integrity.json lista todas as mudanças preexistentes permitidas. Frame legado da Fase13 comparado em QA; master81s preservado por SHA-256. Sem install/update, rede generativa, publish, commit ou push.

## AE. Limitations

1. Malha do carro muito simples; gelo é tint/patches, não simulação.
2. Causa fria usa contexto estilizado, não termodinâmica.
3. Fluxo/fill são timelines autoradas e não conservação física.
4. Foco/coverage usam proxies, não oclusão visual.
5. Geometria LAYER é fixture simples, não subsolo real.
6. A fonte fica parcial no close final.
7. Ambientes permanecem simples e o branco do gelo tem contraste limitado com neve.
8. Não há planejamento automático de claims arbitrárias.
9. Auditorias de proof são assistidas e dependem do denominador.
10. Pilotos silenciosos não avaliam sound design ou sincronismo de voz; captions antigas continuam estimadas.

## AF. A/B assessment

Avaliação autoral baseada nos frames sequenciais, estados e amostras exportadas; não é aprovação humana estética.

| Dimensão | Resultado | Evidência/limite |
|---|---|---|
| CLAIM CLARITY | BETTER | O carro citado finalmente aparece |
| VISUAL PROOF | MUCH_BETTER | Acúmulo/frozen visíveis; antes apenas neve/Caio |
| CAUSALITY | BETTER | Contexto→transição→resultado; causa ainda estilizada |
| MOTION | BETTER | Mudança progressiva da superfície, não só gesto |
| CAMERA | SLIGHTLY_BETTER | Cobre objeto e resultado com continuidade |
| VARIETY | BETTER | Estados e modos de apresentação distintos |
| DEPENDENCE ON PRESENTER | MUCH_BETTER | 10s→2s de visibilidade do apresentador |
| OVERALL | BETTER | Demonstra fenômeno, com arte ainda simples |

**Reduziu significativamente a diferença da Fase13? SIM, no escopo dos dois pilotos.** Os2claims novos têm representação DIRECT; isso não altera a taxa do vídeo inteiro de81s, que não foi refeito. Sucesso técnico e conclusão perceptual limitada são distintos.

## AG. Reference gap

**Maior diferença estrutural, única:** cobertura encadeada de uma narrativa inteira por demonstrações coerentes. A referência mantém a explicação visual ao longo do vídeo; aqui foram provados dois planos autorados isolados. Não demonstramos conversão de um roteiro longo completo nem equivalência estética à referência.

## AH. Next recommendation

**E) automated editorial→demonstration planning**, uma única prioridade: mapear claims editoriais para demonstrações suportadas, exigir evidência de prova e deixar os gaps explícitos. A evidência é a auditoria antiga com claims simbólicas versus os dois pilotos onde há representação direta. Isso pode continuar com autoria externa/Codex ou regras/templates; não significa colocar LLM no runtime. Apenas recomendação: nenhuma Fase15, Higgsfield, música, pack, props extras ou atualização do master de81s foi iniciada.
