# HYBRID_3D_V1 — gramática editorial sobre mundo 3D persistente

Identidade: **3D explanatory storytelling with a persistent protagonist**. Caio permanece no rig e no mundo existentes. Esta camada não escolhe fotos, documentário ou mídia externa. Não há novo Writer, Knowledge Graph, parser, renderer nem mecanismos factuais.

## Integração e contratos

`PlannerInput → Director existente + buildHybridEditorial → VisualCausalPlan.hybridEditorial → compileVisualPlan → DirectedSequence.hybridEditorial → QA especializado → ProductionPreflight → productionRenderGate → DirectedRenderer`.

Script Mode habilita `hybridEditorial: {enabled:true}` em `generateFromScript`. Chamadores legados preservam seus planos e fingerprints sem opt-in; operadores novos podem habilitar o mesmo contrato no PlannerInput. A engine não modifica automaticamente artefatos históricos. Contratos/versionamento em `src/editorial/hybrid-contracts.ts`; política executável única `HYBRID_EDITORIAL_PROFILE`, também consumida pelo profile de produção.

O compositor reutiliza `SequenceRenderer.editorialLayers` e `COMPOSITION_Z.TEXT`, abaixo das legendas. É SVG genérico sobre o mesmo `ProceduralShot`, não uma cena ou TSX por tema. São reutilizados Caio, ações, câmeras, assemblies, geometria e transforms já existentes. Nenhum novo resource ID, asset ou dependência; o catálogo de recursos continua tendo 53 entradas.

O Script Mode salva `hybrid-editorial.json` e `hybrid-editorial-qa.json`, além de input, plano, sequência e preflight. Os objetos contêm somente dados JSON, IDs, frames, proveniência e decisões; podem ser versionados/inspecionados por um futuro Studio. Não dependem de relógio, rede ou estado de sessão.

## Escolha de representação

O Director registra por beat `representation`, `scale`, razão, disponibilidade de ação física e IDs focais. `physicalAvailable` consome o seletor de demonstrações existente; `physicalExecuted` registra as operações reais do beat. Não são a mesma evidência. As alternativas são PHYSICAL_3D_DEMONSTRATION, MICRO_DIAGRAM, ANNOTATED_3D, WORLD_CONTEXT, CHARACTER_ACTION e RESULT_SHOT. Ações físicas suportadas são executadas por padrão. A variedade não é aleatória.

Mundo → sistema → componente → ação → resultado → mundo continua disponível pela câmera e pelos beats existentes. A escala ABSTRACT corresponde ao painel temporário; sua ausência devolve a imagem ao mesmo 3D, sem reconstruir mundo ou desfazer estado. O contexto é mostrado antes da primeira abstração. Escalas físicas continuam dirigidas pelo enquadramento causal existente, não por uma câmera paralela. Não há alternância forçada quando não melhora uma relação suportada.

Uma solicitação editorial opcional de diagrama fornece apenas relationIds e uma justificativa. Ela não fornece participantes, respostas, peças, valores ou ligações. Quando existe ação física, o diagrama suplementar só usa uma janela livre anterior à operação. Sem janela, registra NO_NONPHYSICAL_WINDOW. A escolha de outra representação com ação disponível é registrada; a disponibilidade isolada não é blocker.

## MICRO_DIAGRAM

Máximo normal de 1,2 s, pelo menos 0,4 s de janela útil e retorno explícito ao mesmo worldId. O painel e o escurecimento são temporários; operações e estado 3D continuam intactos. A versão inicial usa projeções de:

- source/path/destination do mecanismo admitido;
- ABOVE/BELOW explicitamente afirmados (comparação espacial, sem inventar fluxo);
- INPUTS/OUTPUTS com argumento compartilhado exato;
- before/after explicitamente presentes;
- CAUSES/CAUSED_BY, preservando direção;
- origem INSIDE, path e destino OUTSIDE explicitamente presentes;
- outras relações semânticas genéricas suportadas, sem transitividade causal inventada.

Labels, arestas e participantes vêm desses argumentos. Estados não viram novas peças físicas. Negação e modalidade não assertiva recusam a projeção automática; não se removem condições para conseguir uma demonstração. Uma recapitulação pode reunir relações já introduzidas, sem antecipar uma afirmação futura. Fonte de autoridade continua sendo USER_SCRIPT ou Evidence conforme o pipeline original; USER_SCRIPT não se transforma em evidência externa verificada.

Todos os eventos desta camada carregam `proof: EDITORIAL_ONLY`. Não promovem SYMBOLIC/PARTIAL a DIRECT, não removem gaps de mecanismo e não mudam métricas de progresso físico/readability. Um diagrama correto não autoriza produção de um mecanismo central unsupported.

## Palavra causal e pergunta/reveal

Palavra causal deriva de um participante de CAUSES/CAUSED_BY ou do predicado do mecanismo admitido; precisa estar na narração da sentença e ser curta. Não existe dicionário temático de palavras a exibir. Duração normal máxima de 1 s. É reforço editorial.

Reset só é permitido para uma pergunta real terminada em `?`, com binding explícito para uma resposta física suportada, ou correspondência única de predicado e participante da pergunta semântica. Binding explícito também precisa de participante compartilhado. O reset ocupa até 0,35 s da janela da pergunta; o reveal aponta ao beat físico posterior já planejado. Pergunta ambígua, sem resposta ou sem parsing suficiente gera QUESTION_UNRESOLVED. Nunca se inventa pergunta ou resposta para satisfazer uma estrutura.

## Anotações e simplificação

ARROW, CIRCLE, PATH, FLOW, HIGHLIGHT, SHORT_LABEL, SOURCE_MARKER e DESTINATION_MARKER são primitivas temporárias observáveis. Âncoras referenciam a geometria real, seus IDs semânticos e poses avaliadas; incluem movimento/rotação/escala e hierarquia já compostos pelo runtime. PATH/FLOW exigem um PATH real, não uma curva editorial inventada. O tracejado em movimento é anotação, não prova de simulação física.

O compositor usa os mesmos `evaluateDirected`, matrices e projeção da engine. Não mantém coordenada fixa para simular acompanhamento de peça móvel. A simplificação atenua temporariamente o contexto, sem apagar participantes, reinicializar o sistema ou inserir novas entidades factuais. A anotação não substitui a operação suportada. A verificação de linha de visão usa o QA geométrico existente; não é inspeção por pixels.

## Problema/solução, Caio e evolução

Capítulos consomem pares REPAIR do grounded progression existente; suas recusas e escopos são preservados. Somente na ausência dessa progressão pode-se indexar um SOLVES com alvo FAILS_BECAUSE explícito e único. Alvos ambíguos são recusados. PREVENTS não é automaticamente reparo; adjacência ou discurso “problema/solução” isolados não estabelecem causalidade.

Cada capítulo registra versões físicas acumuladas e verifica mudança no problema e na solução separadamente. Highlights, hide/reveal e transições editoriais não contam. Sem mudança em uma etapa, o capítulo permanece PARTIAL com warning; a engine não inventa transformação para completar a estrutura. Os blockers de mecanismo obrigatório continuam independentes.

Caio preserva resourceId/instanceId e os tracks do rig existentes: entrada, observação, apontar, reação e retorno. Um gesto não prova causalidade física. Esta fase não adiciona grasp, contato, ferramenta ou construção que o rig/roteiro não sustentem; nesses casos registra limites do mecanismo, em vez de fingir operação manual. Componentes construídos ou transformados pelo programa existente persistem nos beats seguintes; a camada editorial não executa resets.

Payoff conserva a sequência existente de sistema/resultado/contexto, com estado final persistente. Nunca o substitui por cartão documental ou texto final. Qualidade cinematográfica e clareza do payoff permanecem revisão humana.

## QA e decisão de produção

O QA verifica bindings, topologia/direção do diagrama, duração, retorno, igualdade plano/compilação, IDs de mundo/protagonista, janela física protegida e âncoras projetadas/linha de visão em três amostras por anotação. O preflight agrega esses findings separadamente dos QA de câmera, demonstração, técnica e suporte.

BLOCKER: participante central inventado, diagrama contraditório, objeto de anotação errado, path inexistente, texto causal sem suporte, troca de mundo/protagonista, serialização inválida, track removido/alterado, abstração sobre ação física obrigatória ou predominância de abstração. Âncora causal totalmente invisível nas amostras também bloqueia. Uma parte periférica de trajeto fora de quadro gera warning e preserva o QA causal especializado.

WARNING: composição apertada de diagrama correto, diagrama longo, capítulo sem evolução demonstrada ou ausência de justificativa para preferir abstração. INFO: decisão justificada, pergunta sem binding suficiente e solicitações recusadas por falta de janela. Não se usa score médio para remover blocker.

## Validação e limites

`npm run check:hybrid-editorial`, `npm run typecheck`, `npm run check:engine3d`, `git diff --check`. Testes novos usam participantes e relações sintéticos; não usam temas reais ou código/material de experimentos externos. SSR inspeciona SVG efetivamente desenhado e avaliação por frame inspeciona geometria/estado; isso não equivale a revisão perceptiva de um vídeo.

A disponibilidade depende da riqueza do grafo/parser e da capacidade física anterior. A camada não recupera conhecimento ausente nem garante reconhecimento, compreensão muda, legibilidade final, tempo fonético exato, manipulação manual genérica ou aprovação para publicar. Readiness para um futuro zero-shot significa que a bateria técnica permite iniciar um teste autorizado, não garantia de sucesso visual ou autorização para executá-lo. Nenhum zero-shot ou vídeo real novo pertence a esta fase.
