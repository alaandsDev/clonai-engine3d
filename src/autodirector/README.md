# Auto Director v1

Direção visual determinística a partir de roteiro pronto e claims opcionais. O core não escreve roteiro, pesquisa fatos ou chama modelos. `planner.ts` resolve capacidades, escolhe padrões e gera contratos existentes; `compiler.ts` valida e exporta. I/O fica em `cli/autodirector.ts`.

```powershell
npm run autodirector:plan -- examples/autodirector/water.json --out out/engine3d/autodirector
npm run autodirector:compile -- out/engine3d/autodirector/water-autodirector-plan.json --out out/engine3d/autodirector
npm run check:autodirector
```

`script` é obrigatório; `topic` é rejeitado. Fixtures fornecem somente texto, claims com offsets UTF-16 e configurações gerais. Não fornecem câmera, recursos, operações ou cenas. `measuredDurations` aceita duração por NarrativeUnit; sem áudio medido, o orçamento é ESTIMATED. O roteiro é preservado com offsets e cobertura integral, inclusive separadores. `targetDuration` é uma preferência, não autoriza acelerar ou cortar texto. `styleProfile` é metadata reservada; não há otimizador de estilo neste v1.

## Semântica e capacidades

`claims.ts` contém um vocabulário português finito. Claims explícitos recebem source EXPLICIT/confidence HIGH (confiança na entrada, não verificação factual). Heurísticas reconhecem formas simples de estado, quantidade, número, temperatura, ranking, comparação, localização, pergunta e causa. Reconhecer um tipo não garante poder demonstrá-lo. Relações geográficas/causais desconhecidas, negações físicas e processos sem padrão adequado produzem gaps.

`capabilities.ts` centraliza declarações por ID estável e consulta status/parâmetros do registry. Não há busca de recursos por substring do nome. Os nós `primitive:*` e `contract:*` descrevem contratos existentes; não são novos IDs Engine3D. As declarações semânticas cobrem apenas parte do acervo. O carro é um exemplar compatível de objeto congelável, não uma dedução de que o roteiro necessariamente fala de carro.

## Padrões e resolução

Nove variantes limitadas: STATE_CHANGE, QUANTITY, FLOW, REVEAL de armazenamento, REVEAL_DOOR, TEMPERATURE, RANKING/NUMBER, COMPARISON e QUESTION. Comparação usa texto numérico; não demonstra relações arbitrárias. Pergunta pode usar apresentador, mas nunca substitui prova PRIMARY ausente. Água e congelamento geram VisualDemonstration; porta/instrumento/texto reutilizam DirectedSequence nativo.

Score explícito: capacidade +100, semântica +24, prova +40, adequação sem apresentador +12; repetição de template −12, modo −8, recurso −8, enquadramento −8 e zona −4; continuidade de processo líquido +16. Enquadramento/zona são proxies da repetição de template, não avaliação geométrica do frame. Cada soma aparece no trace. Desempate por score decrescente, prioridade decrescente e template ID crescente; recursos são ordenados por ID. Não há aleatoriedade.

Uma sequência contínua compartilha estado, processo e foco. Domínios PRIMARY incompatíveis neste v1 produzem RESOURCE_CONFLICT; ainda não há montagem geral de vários domínios. Os guardrails da demonstração e da direção existentes validam câmera, timeline, endpoints e operações simultâneas. `qa.ts` verifica cada claim no intervalo da unidade: sujeito, operação/processo, consequência visível e foco. Isso é evidência estrutural dentro dos padrões reconhecidos, não compreensão geral de linguagem.

## Gaps e execução

PLAN_ONLY conserva gaps. STRICT rejeita gaps PRIMARY que exigem prova e não estão em `allowedGapIds`. Autorizar um gap não inventa footage nem torna o plano renderizável. Gaps têm os oito motivos e as seis recomendações tipadas em `contracts.ts`; recomendações são apenas diagnósticos, sem resolver mídia externa.

**Contrato autoritativo do render: `DirectedSequence`.** A engine EditorialPlan antiga exige foco em um personagem/prop registrado e CUT por beat, sem foco em primitivas locais. O compiler exporta uma projeção de interoperabilidade explicitamente SYMBOLIC com `interop-container`/PROP_BOTTLE_001 e boundaries. Esse placeholder não aparece no vídeo da água e não é prova DIRECT. Não renderizar essa projeção como equivalente ao sidecar contínuo. A limitação também consta em `renderPlan.legacyProjection`. Essa exportação atende schemas/QA antigos, mas ainda não é uma representação editorial completa das primitivas.

Versões: `autodirector-planner/1.0.0` e `autodirector-compiler/1.0.0`. Fingerprints incluem entrada, claims, constraints, snapshot, templates, pesos e versões, sem caminho absoluto/mtime/clock. O compiler rejeita alterações no plano sem atualização do fingerprint; o hash é integridade determinística, não assinatura de segurança.

## Evidência da Fase 15

`out/engine3d/phase15/` contém inputs, planos, compilados, métricas, logs, frames, tiras e piloto de 23,7 s. A shell de produção mede o edge-tts existente e renderiza apenas o JSON compilado com o renderer atual. Voz/rate/pitch/cache preservados; legendas até três palavras com timing ESTIMATED. Sem SFX, overlays, música, novos recursos, provider externo ou mudança no pipeline de execução.

Limites perceptuais: diagrama esquemático, sem simulação hidráulica, sem pressão/bomba inferida, hold final longo e direção de câmera simples. Métricas da Fase 13 têm adaptação para ausência de ator; não contabilizam os estados internos de primitivas como movimento de props. Revisão de frames e checagem por claim complementam essas métricas.
