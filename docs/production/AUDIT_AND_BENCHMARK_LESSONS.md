# Auditoria e lições reutilizáveis

Base: 21fe8b593ae914a11e4a4d7eb76c79ba638d0793. Trabalhar somente nesta worktree. Snapshot engine-pre-zero-shot-2 permanece na pasta de origem, fora do Git; nenhuma escrita nele.

| Conhecimento histórico | Fonte primária e contrato atual | Uso na consolidação |
|---|---|---|
| DirectedSequence, VisualDemonstration, NarrativeClaim, VisualProof | engine3d/directed, demonstration*, Phase13/14 | validação executável e continuidade; prova declarada não equivale a percepção |
| Auto Director, semântica e script natural | autodirector/, semantics/, script-mode/, Phase15–17/29 | relações e ledger antes da direção, sem novo parser |
| Topic writer, pesquisa, multisource e Topic Intelligence | writer/, research/, vertical/, Phase18–26, READMEs/handoff | preservar policy factual e separação de script/evidência; nenhum segundo Writer/Graph |
| Persistent world e cutaway | visual-causal/contracts, compile, qa, Phase27/27B | identidade, coordenadas e contexto do exterior ao interior |
| Progressive curiosity, retention e execution | curiosity/progression, writer/progressive/retention, demonstrations/execution, Phase28/28B/29 | não fabricar story step para preencher arco |
| Contexto, causal camera, Camera Space | script-world, camera-space, readability, qa e testes correspondentes | localizar parte antes do close, LOS/collision, enquadramento de rota e resultado |
| Formas funcionais e spatial identity | functional-form, functional-parts, spatialMap, testes de readability | forma derivada de papel sustentado, nome do benchmark não é trigger |
| Containment e generalização da lavadora | script-mode mechanism/containment, visual-causal/containment, containment-assemblies e testes sintéticos | mostrar conteúdo, fronteira, abertura, travessia e destino; não inferir comportamento não afirmado |
| Narração e pacing | audio/pacing, visual-causal/media, PRODUCT_PASS_REPORT | não cortar palavras; só bordas silenciosas com guards; metragem real guia timeline |
| Sound/visual approval e mastering | sound/README, visual/README, media.validateMp4 | aprovação por contexto e QA pós-render continuam existentes |

## Lições

Avião: ação sustentada e consequência precisam permanecer visíveis; um símbolo de força não comprova movimento físico. Geladeira: contexto incoerente e close sem localização prejudicam a explicação; navegação e LOS importam. Lavadora congelada: cobertura de script e boa câmera não garantem boundary crossing, nested containment ou reconhecimento. Containment sintético: transferência precisa mostrar origem, actuator/abertura, rota e destino; conteúdo só acompanha rotação quando isso é afirmado. Phase27B/28B: corte/continuidade e presenter não corrigem falta de conhecimento causal. Nenhuma lição acima autoriza regra que reconheça palavras de tema.

## Avaliação histórica

O harness tools/production-bible/historical-audit.ts lê JSONs existentes, recalcula QA na versão atual e grava resultados apenas em out/production-bible. Não faz parse de roteiro novo, TTS ou render; não ajusta plans/benchmarks. Resultado contra perfil novo não reescreve o relatório histórico. Se faltar contrato ou artefato, registrar NOT_EVALUATED; nunca promover a PASS.

## Testes de regressão existentes a preservar

Os testes de camera-space, causal-readability, script-context, demonstration-execution, mechanism-bridge, containment e product-pass verificam exterior/corte, localização antes de close, LOS, rota, antes/ação/depois, pergunta/reveal, state persistence, payoff, meaningful change, contexto, sync, containment aninhado, crossing e actuator. Os novos testes de production-preflight verificam classificação/decisão e persistência antes do renderer com spies, incluindo câmera boa e mecanismo incompleto. Rodar npm run typecheck e npm run check:engine3d. Testes de integração com render só quando indispensáveis e autorizados: esta consolidação não necessita novos vídeos.
