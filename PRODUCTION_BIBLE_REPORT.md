# Production Bible + Autonomous Preflight — relatório de fechamento

## Status e base

Implementação consolidada para revisão humana. Worktree: C:/Users/aland/.codex/worktrees/production-bible/clonai. Base: 21fe8b593ae914a11e4a4d7eb76c79ba638d0793. Nenhum commit/push/reset/clean/restore; nenhum novo zero-shot, TTS ou render de vídeo. Snapshot engine-pre-zero-shot-2 consultado somente para manifesto de hashes, preservado na pasta de origem. Não se alteraram benchmarks, assets, parser, Writer, Research, geometria, câmera ou seus thresholds.

## Arquivos

Criados: AGENT_PRODUCTION_RULES.md; docs/production/PRODUCTION_STANDARD.md; docs/production/CONTRACTS_AND_GATES.md; docs/production/AUDIT_AND_BENCHMARK_LESSONS.md; src/production/profile.ts; src/production/preflight.ts; src/production/render-gate.ts; tests/production-preflight.test.ts; tools/production-bible/historical-audit.ts; este relatório.

Modificados: AGENTS.md (entrada normativa); package.json (check:production, sem dependências novas); cli/script-mode.ts (readiness e saída de erro quando produção bloqueada); src/script-mode/generate.ts (alvo de saída do perfil, relatórios e gate antes do renderer).

Artefatos locais ignorados: out/production-bible com logs, relatórios históricos e manifesto do snapshot. Permanecem disponíveis nesta worktree para revisão. Os caminhos de origem dos benchmarks são argumentos do harness; nenhum nome deles entra no runtime.

## Production Bible e profile

PRODUCTION_STANDARD apresenta a política permanente; CONTRACTS_AND_GATES vincula cada padrão a medição, severity ou limite humano; AUDIT_AND_BENCHMARK_LESSONS registra fontes arquiteturais e princípios de regressão. CLONAI_PRODUCTION_V1 é objeto serializável versionado com policy, saída, categorias, decisões de gates, thresholds e justificativas, revisão humana e checks pós-render. O preflight usa esse profile; não é apenas Markdown ou constantes não consumidas.

## Pipeline e autorização

Director → QA especializado → productionPreflight → relatório → productionRenderGate → Renderer. Script Mode persiste production-preflight.json e .md antes de qualquer produção. BLOCKER define productionReady=false, mantém MP4 nulo e pula render/extract/contact-sheet; CLI imprime PRODUCTION_READY: NO / RENDER BLOCKED e retorna exit code 1 para produção solicitada. WARNING/INFO ficam registrados e permitem candidato quando não há blocker. A fronteira de render persiste a decisão e valida o hash da sequência antes de chamar callback; mudança invalida autorização. Falha de persistência também impede renderer. Sem replans automáticos: maxReplans=0, logo sem loop.

Escopo: caminho de produção de Script Mode. Low-level renderMp4 e harnesses de desenvolvimento/históricos continuam disponíveis; não representam produção certificada pelo novo perfil. Novas integrações devem usar a mesma fronteira. Não se anuncia migração dos pipelines legados de Research/vertical/editorial para um contrato que eles ainda não fornecem.

## Hard blockers e warnings

Blockers: sistema principal não resolvido, proxy de identidade insuficiente, participantes/carrier necessários ausentes, relações sem spans/evidências ou inventadas, preview-only, mecanismo requerido unsupported, contradição espacial, continuidade impossível, rota/boundary/abertura falhando nos gates aplicáveis, fonte/actuator/destino ausentes, contexto incoerente detectável, dependência excessiva da narração, câmera que não vê participante essencial/colide, arquivos de voz/FFmpeg/ffprobe ausentes, sequência inválida, saída incompatível com o profile e timing impossível de legendas.

Warnings: composição/ocupação/repetição e qualidade de direção não críticas; proxy agregado de readability; fallback contextual registrado; desvio estimado de onset; estase com possível intenção editorial; final estático; caption longa; revisão humana pendente. Não existe média que remova blocker. Cada finding preserva category/code/evidence, distinto dos valores brutos do QA. NO_BLOCKER_DETECTED em uma categoria não significa compreensão humana medida.

## Padrões cobertos

Story: preservar script/fatos, pergunta-resposta, causal bridges, hook/payoff/callback e ausência de repetição inútil; limites humanos explícitos. World: contexto coerente, suporte e espaço de câmera; fallback não vira contexto PASS. System identity: objeto persistente, features e relação espacial exterior/interior, conteúdo/propriedade não substituem sistema. Spatial: inside/outside, fronteira/abertura, fonte/rota/destino, pai/partes e coordenadas persistentes.

Demonstration: antes→ação→depois, causa/participantes→resultado, travessia de fronteira e actuator transfer; estado posterior e rotas; highlight/tint não substituem prova física. Camera: localizar componente antes do close, parent context, LOS/occupancy/colisão; câmera boa com mecanismo errado bloqueia. Pacing: mudança física e estase, sem inflar por labels/câmera; pergunta pode justificar hold. Sync: onset versus predicado estimado com warning, nunca forced alignment alegado. Presenter: identidade, contexto e evitar obstrução; gesto direciona atenção. Ending: resultado, recap sustentado, callback/retorno e movimento final intencional.

Audio/TTS: cadeia existente com medição, trim de bordas e guards preservada. SFX: contratos de plano/aprovação permanecem e masking real exige pós-render. Captions: timeline e densidade verificadas, área segura/colisão perceptiva permanecem limitadas. Mastering: validateMp4/audioQa existentes, sem cadeia inventada. Output: profile vertical 1080×1920/30fps, H264/AAC/MP4, 48kHz estéreo; confirmação real após decode. Truth: USER_SCRIPT não é evidência externa; DIRECT/PARTIAL/SYMBOLIC/UNSUPPORTED não são promovidos pelo gate; gap crítico bloqueia.

## Regressão e end-to-end sem vídeo

25 testes novos verificam pureza/serialização, sistema de severity, output, preview-only, participantes, suporte, câmera boa com demonstração ausente, dependência técnica, gates especializados e spies na mesma productionRenderGate usada pelo Script Mode. Os testes da fronteira usam relatórios controlados como test doubles: PASS e somente warning chamam renderer, blocker não chama; relatório existe antes da chamada; nenhuma saída do renderer é criada ao bloquear; persistência falha e sequência alterada impedem execução. Não se renderizou vídeo real para isso.

A suíte existente verifica princípios de exterior/cutaway, componente antes de close, LOS, rota, antes/ação/depois, question/reveal, state persistence, payoff, meaningful stasis, contexto, sync e containment/nested/pass-through/actuator. Reutilizada, sem alterar fixtures para obter PASS. O teste novo de anti-hardcode inspeciona os três módulos runtime e recusa nomes dos benchmarks. Não constitui prova universal contra toda forma possível de hardcode.

## Benchmarks antigos contra perfil novo

Ver out/production-bible/historical-results.json e relatórios por caso. Avaliação lê artefatos e recalcula QA, sem replanejar/renderizar ou reescrever o histórico.

- Avião zero-shot: BLOCKED; proxy de identidade e resolução legada.
- Geladeira FROZEN: BLOCKED; gap de mecanismo e resolução legada; ver relatório para lista completa.
- Lavadora congelada: BLOCKED; gaps de mecanismo, proxy de identidade, contexto, dependência de narração e resolução.
- Containment sintético salvo: BLOCKED; contradição espacial/ledger de carrier e resolução; não substituir esse resultado pelo resultado dos testes sintéticos atuais, que verificam outras entradas.
- Phase27B/final e Phase28B/well: NOT_EVALUATED pelo harness porque não há planner-input.json nesses diretórios. Não reconstruir entrada histórica por adivinhação. As regressões de código correspondentes continuam na suíte.

## O que continua humano ou fora de alcance

Reconhecimento real, hook, clareza muda, naturalidade da fala, masking de mix, legibilidade perceptiva, qualidade do payoff e publicação exigem revisão humana. Oclusão é aproximada por pontos/bounds e amostragem; preflight não garante pixels visíveis a cada frame. Não detecta mecanismo que o parser omitiu por inteiro nem verdade universal de um roteiro. Spans/referências não provam suficiência científica de cada detalhe. Mastering real e codec/container só são medidos depois do render. A política tenta obter candidato final no primeiro render; não garante que ele será publicável.

## Validação

Resultado consolidado registrado nos logs de out/production-bible. Primeira execução falhou por ausência de out/ necessária a testes antigos; após criar o diretório, execução completa anterior passou 1258/1258. A execução consolidada final passou 1271/1271 (1247 originais + 24 novos carregados nessa execução). O último teste acrescentado cobre falha de preparação antes do render: a suíte direcionada final passou 25/25, incluindo os 24 anteriores. Total único verificado: 1272 testes (1247 existentes + 25 novos); não somar 1271 e 25, pois há sobreposição. Typecheck final PASS e git diff --check PASS. Logs: full-final.log, production-release.log e typecheck-complete.log. A última alteração do tratamento de preparação foi validada pela suíte direcionada; não se afirma uma execução monolítica 1272/1272.

## Git e readiness

Tudo UNCOMMITTED sobre a base; snapshot preservado; sem novo vídeo/zero-shot. ProductionReady é por candidato; benchmarks congelados bloqueados não foram adaptados para passar. A fase instala a decisão automática no Script Mode e prepara revisão, mas não certifica toda a engine para publicação autônoma universal.

PRODUCTION BIBLE INSTALLED: YES
AUTONOMOUS PREFLIGHT ACTIVE: YES (Script Mode)
FIRST-RENDER FINAL-CANDIDATE POLICY ACTIVE: YES (Script Mode)
READY TO FREEZE ENGINE FOR NEXT ZERO-SHOT: NO — aguarda revisão humana dos blockers e limitações reportados; próximo zero-shot não executado.
