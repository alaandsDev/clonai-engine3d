# Hybrid 3D Editorial Grammar — entrega para revisão

Data: 2026-10-31, America/Sao_Paulo.

## Estado e fronteira

Worktree utilizada: `C:/Users/aland/.codex/worktrees/production-bible/clonai`.
HEAD preservado: `21fe8b593ae914a11e4a4d7eb76c79ba638d0793`, destacado. A branch main pertence à pasta principal e não foi alterada por esta fase. A worktree já continha a Production Bible/preflight e suas alterações UNCOMMITTED; foram preservadas e estendidas nos pontos de integração necessários. Não houve commit, push, amend, reset, restore, clean ou configuração de remote.

Não se executou novo tema real, zero-shot, TTS, pesquisa ao vivo ou render de vídeo. Testes visuais novos usam apenas SVG/SSR e avaliação sintética por frame. Nenhum código, asset, layout, identidade, template, vídeo ou diagrama do experimento externo foi importado. Não há dependências novas.

## Implementação

O Director atual recebe uma extensão determinística, não um segundo planejador independente. O contrato `HYBRID_3D_V1` é serializável, versionado e integra o profile de produção. `VisualCausalPlan.hybridEditorial` compila para `DirectedSequence.hybridEditorial`. O renderer atual usa o slot editorial existente sobre o mesmo mundo 3D. Caio, demonstrações, câmeras, transforms e rig permanecem os existentes.

Script Mode habilita a gramática automaticamente em `generateFromScript`. APIs e artefatos legados mantêm comportamento/fingerprints sem opt-in; operadores novos podem usar `PlannerInput.hybridEditorial.enabled`. Os JSONs editorial e de QA são salvos junto dos artefatos de produção.

Novos módulos: `src/editorial/hybrid-contracts.ts`, `src/visual-causal/editorial-grammar.ts`, `src/visual-causal/editorial-qa.ts`, `src/engine3d/hybrid-runtime.ts` e `src/engine3d/hybrid-editorial.tsx`. Integrações em planner, compiler, contratos da sequência, renderer, Script Mode e ProductionPreflight. Especificação normativa: `docs/production/HYBRID_EDITORIAL_GRAMMAR.md`.

## Cobertura dos princípios

| Princípio | Comportamento executável |
|---|---|
| 3D primário | Nenhuma seleção de foto/documentário; operações e mundo existentes preservados. Abstração não pode dominar a timeline nem cobrir ação física. |
| Microdiagramas | Projeções do grafo para rotas, comparação de altura, entrada/processo/saída, estados, causa/efeito e travessia explicitamente suportados. Painel curto e retorno ao mesmo worldId. |
| Palavra causal | Participante causal ou predicado do mecanismo presente na narração; sem lista temática. EDITORIAL_ONLY. |
| Pergunta/reset/reveal | Pergunta real com binding semântico para uma resposta física posterior; breve reset visível. Ambiguidade resulta em diagnóstico. |
| Escala | Câmeras físicas existentes mudam o enquadramento; a projeção temporária usa ABSTRACT e devolve o mesmo contexto. Teste mede posições de câmera compiladas. |
| Anotação 3D | Arrow, circle, path, flow, highlight, label e marcadores têm primitivas SVG observáveis, projetadas da geometria avaliada. Pais móveis são compostos uma vez. Fluxo anotado não antecipa o fluxo físico. |
| Problema/solução | Pares REPAIR existentes são autoridade, incluindo recusas e escopos. Sem essa progressão, SOLVES precisa de alvo FAILS_BECAUSE explícito e único. |
| Evolução | Mudanças do problema e da solução são verificadas separadamente; versões acumulam apenas transições físicas grounded. Ausência em uma etapa mantém PARTIAL. |
| Caio | Mesma identidade, entrada, observação, gesto e reação do rig existente. Não se finge grasp/construção/manipulação física não suportada. |
| Simplificação | Painel/scrim temporários sobre o mesmo 3D; nenhuma exclusão ou reinicialização de estado. |
| Payoff | Mantém sistema/resultado/contexto e estado final existentes; não troca por cartão documental. |
| Decisões | Representação, escala, razão, participantes, physicalAvailable e physicalExecuted são distintos e auditáveis. Disponibilidade sem uso não bloqueia por si só. |
| QA/preflight | Findings semânticos/geométricos agregados ao gate existente; blocker impede o callback do renderer. |

## Fronteiras de verdade

Diagrama, palavra, cor e anotação são sempre `EDITORIAL_ONLY`. Não elevam VisualProof, não contam como mudança física/readability e não resolvem gaps de mecanismo. Não se infere resposta por simples proximidade nem solução por adjacência. Negação e modalidade não assertiva não viram diagrama assertivo. Um grafo existente que recusou um par não pode ser substituído por inferência editorial.

O preflight distingue capacidade selecionada de operação executada. Um diagrama correto com mecanismo físico central unsupported continua bloqueado. Uma câmera tecnicamente válida não autoriza diagrama contraditório ou anotação no participante errado. Composição apertada de diagrama sustentado permanece warning; justificativa para usar abstração é registrada sem virar blocker automático.

## Verificação final

- `npm run check:hybrid-editorial`: **64/64 PASS**; log `out/hybrid-targeted-freeze.log`.
- `npm run check:engine3d`: **1336/1336 PASS**, sem skip; log `out/hybrid-full-suite-freeze.log`. Inclui os 1272 testes anteriores e os 64 novos; não somar novamente as suítes direcionadas.
- `npm run typecheck`: **PASS**; log `out/hybrid-typecheck-freeze.log`.
- `git diff --check`: **PASS**.
- Catálogo consultado/regenerado: **53 recursos**, sem novos IDs, assets ou alterações no registry. Composição editorial usa a camada existente, não um resource ID novo.
- Anti-hardcode: **PASS** na inspeção dos cinco módulos novos e na regressão existente. Nenhuma condição por tópico, benchmark ou fonte adquirida no runtime novo; sem relógio, aleatoriedade sem seed, rede ou dependência de plugin externo.

Os testes cobrem projeções semânticas genéricas, primitivas realmente desenhadas, persistência do mundo/Caio, movimento e parentesco, escala compilada, modalidade/negação, perguntas sem resposta/sem vínculo, composição warning, alvos falsos/ocultos, seta causal invertida, retorno errado, proteção da janela física, progresso não inflado, pares recusados/ambíguos e ausência de chamada ao renderer quando bloqueado. Fixtures novas são sintéticas; nenhum dos temas proibidos foi usado como benchmark da implementação.

## Limitações e readiness

Os testes não medem compreensão humana, estética final, reconhecimento perceptivo, timing fonético exato ou qualidade cinematográfica de um novo vídeo. Âncoras/LOS são geometria aproximada em três amostras por anotação. Diagramas dependem dos argumentos que o parser/grafo realmente fornecer; perguntas difíceis podem permanecer sem binding. A gramática não recupera conhecimento ausente nem cria geometria funcional.

Caio preserva seu arco/rig anterior; não foi instalada manipulação manual universal ou nova animação de construção. Capítulos só são SUPPORTED quando há mudanças físicas sustentadas em ambas as etapas; não é promessa de que todo roteiro terá essa estrutura. Produção continua sujeita a todos os blockers anteriores e à revisão humana.

Readiness abaixo significa prontidão técnica para iniciar um futuro teste autorizado com tema desconhecido, sem garantia de PASS ou de publicação. O teste não foi executado nesta fase.

HYBRID EDITORIAL GRAMMAR INSTALLED: YES

3D REMAINS PRIMARY: YES

MICRO DIAGRAM AVAILABLE: YES

ANNOTATED 3D AVAILABLE: YES

PROBLEM/SOLUTION CHAPTERING ACTIVE: YES — quando existem vínculos semânticos explícitos e evolução física; caso contrário PARTIAL/recusado.

PRODUCTION PREFLIGHT INTEGRATED: YES

ANTI-HARDCODE PASS: YES

READY FOR UNSEEN ZERO-SHOT: YES — prontidão técnica para teste futuro, aguardando revisão.

GIT: UNCOMMITTED.
