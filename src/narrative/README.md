# Narrative Director / Partial Execution v1

Camada pura acima do Auto Director existente. Recebe script-only através de `analyzeNaturalScript`, constrói Semantic Narrative Graph e planeja ilhas independentes. Um gap local não apaga os outros trechos. Não usa filesystem, rede, relógio, random ou modelos; I/O e medição ficam na CLI/shell.

```powershell
npm run narrative:plan -- examples/narrative/natural-mixed.json --policy STRICT_ISLANDS
npm run narrative:plan -- examples/narrative/natural-process.json --policy STRICT_FULL
npm run check:narrative
```

## Arquitetura e compatibilidade

`script → semantic-engine/1.1.0 → narrative-graph/1.0.0 → segments/dependencies → narrative-director/1.0.0 → partial-execution-plan/1.0.0 → Auto Director por ilha → DirectedSequence/VisualDemonstration → compiler de fronteiras → renderer existente`.

Os APIs `analyzeScript`/`toAutoDirectorInput` e as políticas legadas permanecem disponíveis. O novo grafo é opt-in. A estrutura SemanticAnalysis v1 continua válida, com engineVersion 1.1.0; cláusulas, referências de evento e candidatos detalhados ficam no grafo. A única extensão na fábrica visual existente permite que FLOW respeite a janela multi-unidade já declarada em ClaimExtraction. Nenhum recurso novo/renderer/LLM/provider foi adicionado.

## Cláusulas, eventos e referências

Cláusulas particionam exatamente o source UTF-16, com MAIN/COORDINATED/TEMPORAL/CAUSAL/CONDITIONAL/RELATIVE/PURPOSE/UNKNOWN. Fronteiras se apoiam em predicados e conectores; não é parser sintático universal. Sujeito compartilhado em coordenação e objeto/clítico usam papéis distintos. Predicados e entidades reutilizam o léxico v1 com pequenas extensões separadas das estruturas.

SemanticEvent mantém sujeitos/objetos, origem/caminho/destino/local, quantities, estado, negação/modalidade/pergunta e evidência. Eventos de fluxo do mesmo sujeito podem ter processIdentity comum, sem colapsar seus verbos individuais. “Esse processo” seleciona evento/processo; “esse veículo” seleciona entidade. Aliases distinguem LEXICAL_ALIAS de CONTEXTUAL_ALIAS, com origem/confiança/razão.

Resolver v2 consulta candidatos anteriores no roteiro, limitados aos últimos 32 registros de entidades e 12 eventos elegíveis. Não usa uma janela fixa de duas frases. Scoring explícito: base 20; tipo 30; gênero/número 12 cada; compatibilidade de predicado 50; recência até 10; mesmo domínio 16/fronteira −18; descritor 36; papel de destino 40/origem conflitante −24; sujeito recente 12; continuidade 8; competição −8. Incompatibilidades eliminam candidatos. Score mínimo 64; margin mínima 24 **e** diferença semântica mínima 24 entre primeiro/segundo: recência/saliência sozinhas não resolvem equivalentes. IDs ordenados desempatem diagnóstico, nunca escolhem um referente semanticamente empatado. Longa retomada só resolve com evidência suficiente.

Perguntas e escopos como “isso não significa que...” não viram acontecimentos assertivos. Ledger de estados e herança usam apenas eventos assertivos, não negados e suficientemente resolvidos. Contexto editorial pode ser exibido como texto sem prova física; FULL não significa que toda menção foi desambiguada nem que toda cláusula tem DIRECT.

## Dependências e ilhas

Narrative segments usam entidade/processo/domínio e marcadores de retorno. Mudança explícita de veículo também separa sujeitos do mesmo tipo. Dependências distinguem INDEPENDENT, CONTINUES e ligações bloqueantes DEPENDS_ON/CAUSES. Compartilhar uma entidade não basta para propagar falha. Referência explícita de evento e persistência de estado podem bloquear dependentes.

Pré-validação consulta o resolver de templates existente. O Narrative Director particiona trechos bloqueados, chama Auto Director para cada grupo e isola falhas de geração restantes; não decide uma segunda geometria/câmera. Se um grupo falha, separação limitada por cláusulas preserva os vizinhos. Não há busca combinatória de cenas. O plano final contém proveniência global e projeções locais com offsets/frames próprios.

Cada ilha declara estados iniciais/requeridos/finais/exportados e policy RESET/TRANSFER. Transferência exige export executado e vínculo semântico; contexto do gap não altera estados físicos. Snapshot coberto/armazenado pode compilar como hold de estado existente, sem repetir acúmulo inexistente. Câmera e foco são explicitamente reinicializados/reframed; herança arbitrária não ocorre. Suporte de transferência física é limitado aos contratos procedurais presentes, não serialização genérica de qualquer mundo.

## Políticas e produção

- PLAN_ONLY conserva ilhas e diagnósticos.
- STRICT_ISLANDS exige validade interna das ilhas e mantém gaps localizados.
- STRICT_FULL recusa gaps PRIMARY.

`compileNarrative(...,{purpose:'PRODUCTION'})` recusa plano PARTIAL/NONE. `productionPlan` marca janelas não resolvidas, `placeholderAllowed=false` e `masterRenderAllowed=false` quando incompleto. REVIEW pode conter VISUAL_GAP_PLACEHOLDER: sequence=null, proof=NONE, sem apresentador ou cena falsa. O quadro técnico é gerado somente pela shell de revisão e não é asset do registry nem prova visual.

Todos os frames do roteiro, inclusive gaps/blocked, permanecem na timeline. Duração de unidade pode ser medida por edge-tts; divisão por cláusula e captions continua ESTIMATED. Source não é reordenado nem resumido. Métricas mostram denominadores de claims PRIMARY e total de frames, separados do contexto sem prova.

## Limites e auditoria

Vocabulário/papéis/escopos limitados, aliases conservadores, possibilidade de abstenção excessiva e cortes extras na recuperação de falha. HOLD de estado e reconstrução de contexto são limitados aos sujeitos existentes. Prova estrutural é complementada por frames; não é fact checker ou score estético. A projeção EditorialPlan/DirectorPlan legada permanece simbólica, com DirectedSequence autoritativo.

`out/engine3d/phase17/` contém os três roteiros naturais (somente script), oito fixtures auxiliares, grafos, dependências, ilhas, gaps, compilados, traces, métricas e review. Pilotos: processo FULL 44,37 s e misto PARTIAL 58,40 s com quadro técnico no gap. Frio mede 51,97 s e tem modalidade localizada sem virar fato. Runtime de render/captions/TTS e registries 50/8/5 preservados.

Performance em `stage-performance.json` mede workloads puros separadamente: graph inclui parse/resolução/segmentação/dependências; island planning inclui Auto Director. Replays isolados são diagnósticos sobrepostos e não podem ser somados como fases exclusivas.
