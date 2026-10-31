# Contratos de produção e evidências — CLONAI_PRODUCTION_V1

Extensão de direção híbrida: `HYBRID_3D_V1`, consumido pelo mesmo profile e preflight. Contratos, decisões, primitivas observáveis e limites em [HYBRID_EDITORIAL_GRAMMAR.md](HYBRID_EDITORIAL_GRAMMAR.md). A camada editorial não conta como prova física nem contorna os blockers existentes.

Normativo. Complementa PRODUCTION_STANDARD.md sem alterar os contratos de Research, Writer, Director ou Engine3D. Implementação: src/production/profile.ts, preflight.ts e render-gate.ts. Entrada: PlannerInput + VisualCausalPlan + DirectedSequence + QA especializado. Saída: objeto JSON versionado, fingerprints de script/plano/sequência/perfil, findings BLOCKER/WARNING/INFO, decisão e resumo textual. Nenhum relógio, rede, escrita de fatos ou replan no núcleo. maxReplans=0: falha encerra a tentativa e conserva artefatos.

## Matriz normativa

| Seção | Contrato observável / evidência reutilizada | Decisão atual |
|---|---|---|
| Story | ledger das sentenças preserva fatos, perguntas e editorial; resposta/callback referenciam relações já existentes | INFO de revisão. Força do hook, repetição inútil, transições escolares e compreensão são humanas |
| World/context | plan.context registra seleção e fallback; CONTEXT_COHERENCE verifica cenário versus sistema | contradição detectada BLOCKER; fallback explícito WARNING; apoio físico exato não certificado |
| System identity | MAIN_SYSTEM ou spatialMap.object deve referenciar entidade real; MAIN_SYSTEM_RECOGNIZABILITY mede features e visibilidade | ausente/insuficiente BLOCKER; é proxy geométrico, não reconhecimento humano |
| Spatial model | validateDirected, validateVisualPlan, spatialViolations, continuityIssues: IDs e coordenadas persistem, inside/behind/above/below respeitados | contradição ou continuidade impossível BLOCKER |
| Demonstration | participants, mechanism carriers/gaps, suporte DIRECT/PARTIAL/SYMBOLIC e execução factual | participante/carrier necessário ausente BLOCKER; suporte simbólico honesto preservado, nunca promovido a fato |
| Before/action/after | causalReadability mede estado anterior, magnitude, visibilidade e hold posterior | limitação geométrica WARNING; participantes e resultado essencial invisíveis BLOCKER pela câmera |
| Containment | Demonstration QA: containment, nested continuity, rotation content, crossing com boundary/opening, source/actuator/destination | FAIL aplicável BLOCKER; N/A é preservado; enum só não prova capacidade |
| Material/heat transfer | carriers do mechanism bridge declaram source/path/destination e suporte; heat não vira entidade factual | carrier necessário ausente BLOCKER; rota física desconhecida vira gap, jamais componente inventado |
| Camera | causalCamera mede LOS aproximada, enquadramento e colisões; route framing e parent context vêm do planner/readability | participante essencial invisível/colisão BLOCKER; composição e occupancy menor mas legível WARNING |
| Progression/pacing | meaningfulStasis mede estado físico; câmera/labels/highlight não contam; direção descreve framing/poses | >8 s WARNING com evidência, pois pergunta pode justificar hold. Repetição/framing/ritmo exigem revisão |
| Question→reveal | perguntas do ledger e beats de resposta são auditáveis; planner já programa holds/reveal | INFO; ausência de mapeamento semântico robusto não é declarada PASS automática |
| Sync | semanticSync reporta offset de onset relativo ao anchor estimado do predicado | p90 >500ms WARNING; não é forced alignment ou sincronismo fonético certificado |
| Presenter | continuidade de identidade; regras de presença/offstage existentes; não substituir a explicação | continuidade impossível BLOCKER; obstrução essencial detectável pela câmera BLOCKER; roupa/gesto/colisão fina humanos |
| Ending/payoff | spatial.endingStaticSeconds, resultado persistente, retorno e recap sustentado | estase final >2s WARNING; qualidade do callback é humana |
| TTS/audio | síntese medida + pacing existente, arquivos presentes e janela PCM preservada | arquivo necessário ausente BLOCKER; decode/mix real pós-render |
| SFX | uso somente quando planejado/aprovado pelos contratos de mídia existentes; ausência de SFX não planejado não falha | presença/masking devem ser avaliados na cadeia existente; não fingir verificação por este preflight |
| Captions | cues limitadas à timeline, blocos curtos; renderer existente aplica estilo/posição | timeline impossível BLOCKER; >6 palavras WARNING; colisão real/legibilidade ainda revisão |
| Mastering | validateMp4 e audioQa fazem decode, duração A/V, pico, LUFS e true peak | pós-render obrigatório para entrega; INFO pendente no preflight |
| Output | CLONAI_PRODUCTION_V1: 1080×1920, 30fps, H.264/AAC, MP4, 48kHz estéreo | plano de geometria/fps incompatível BLOCKER; codec real e frame inicial/final pós-render |
| Truth/support | validateVisualPlan e membership de relações/transições; USER_SCRIPT com spans, Evidence com IDs existentes | relação inventada, previewOnly, ação necessária unsupported BLOCKER |
| Quality gates | regra por categoria; nenhum score médio remove blocker | blocker impede productionReady; warnings permitem candidato e revisão |

## Semântica dos thresholds

O profile executável é a fonte única da classificação dos gates, target de saída e heurísticas novas. Gates de Demonstration QA mantêm seus próprios thresholds e detalhes; o preflight não recalcula a métrica nem substitui seus valores. 0.8 de participantes, 0.35 de dependência da narração e outros limites históricos são aproximações calibradas durante Phase29, não medição de compreensão. Qualquer participante obrigatório ausente bloqueia independentemente da média de cobertura. Os limites 500ms/8s/2s/6 palavras são tolerâncias editoriais documentadas e warnings; não foram ajustados a um benchmark.

PASS técnico, PASS de câmera e PASS de demonstração são resultados distintos. ProductionReady significa ausência de blockers detectáveis com evidências disponíveis para iniciar um candidato. Não significa POSTABLE nem VIEWER_UNDERSTANDS_MECHANISM. O warning HUMAN_REVIEW_REQUIRED permanece visível.

## Fronteira de render e versionamento

Script Mode compila a sequência no alvo do profile, calcula QA, grava production-preflight.json e .md e só entra no branch de render se productionReady. productionRenderGate persiste novamente a decisão e verifica blockers e fingerprint da sequência antes de invocar o renderer. Uma sequência alterada invalida a autorização. Erro de persistência impede a chamada. Falhas anteriores à obtenção de uma sequência também gravam um relatório PREPARATION / PREPARATION_FAILED antes de propagar o erro, quando o filesystem permite. CLI retorna código 1 quando uma produção solicitada é bloqueada; --no-render continua inspeção de planejamento.

Relatórios não são tokens de segurança contra chamadas diretas ao low-level renderer. Scripts de desenvolvimento/harnesses históricos continuam capazes de executar seus testes. Para nova produção fora do Script Mode, chamar productionPreflight e productionRenderGate; não chamar renderMp4 diretamente e chamar isso de produção aprovada. A fase não reclassifica os renderers legados de Research/vertical/editorial como produção certificada por este perfil.

Interfaces JSON permitem UI futura: stage, decision, findings, severity, category, code, evidence, fingerprints, version e resultado do render. O relatório é independente da CLI. Novas revisões devem conservar entradas e perfis e produzir novos fingerprints; não sobrescrever histórico nem executar replan infinito. Studio/editor não implementados.

## Limites que precisam aparecer no relatório

A engine não prova por este gate: veracidade universal do roteiro, peças omitidas pelo parser, plausibilidade científica de um asset, oclusão pixel a pixel, compreensão muda, naturalidade auditiva, masking real de SFX ou clipping antes de decodificar o mix. QA usa pontos/bounds e amostras; uma abertura minúscula pode escapar. Uma referência de evidência não prova automaticamente suporte de todos os detalhes. Main-system e recognizability são proxies sujeitos a falso positivo/negativo. Não ocultar esses limites em uma média.
