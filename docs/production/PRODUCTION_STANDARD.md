# ClonAI Production Bible — versão 1

FIRST_RENDER_IS_FINAL_CANDIDATE: preparar o primeiro render de produção como candidato final. O Director planeja; QA mede; ProductionPreflight decide; Renderer executa somente quando autorizado. Benchmarks são regressão, nunca templates ou gatilhos de tópico. Não inventar mecanismo, geometria funcional, causa ou evidência. USER_SCRIPT afirma texto e não constitui fonte externa verificada. Relações sem suporte devem gerar gap ou blocker conforme sua relevância.

## Story, progressão e final

Usar pergunta, reveal e payoff quando sustentados. Conectar a pergunta à resposta; não revelar cedo sem intenção. Mostrar antes → ação → depois, persistir o estado e devolver o sistema ao contexto quando fizer sentido. Troca de rótulo, highlight e câmera não prova mudança física. Callback pode recombinar fatos sustentados como edição, não criar outros. Força de hook, clareza e naturalidade requerem julgamento humano.

## Mundo, identidade e espaço

Preservar contexto explícito; escolha estrutural inferida é editorial, jamais evidência. Registrar fallback. Sistema reconhecível deve manter identidade, apoio e localização das partes nas transições exterior/corte; peças não devem flutuar. Espaço da câmera não pode atravessar sólidos. Inspecionar inside/outside, abertura, fronteira, fonte e destino quando aplicáveis. A presença de uma tag não comprova reconhecimento ou apoio.

## Demonstração e câmera

Mudança física precisa de estado anterior, operação e resultado visível. Fluxo precisa de fonte, caminho e destino; travessia precisa de fronteira e abertura; actuator deve ter conexão suportada. Uma câmera legível filmando o mecanismo errado não é demonstração válida. Localizar o componente antes do close, manter referência e verificar linha de visão, escala e ambos lados de trajetos ou fronteiras. Point/box QA é aproximação e não substitui inspeção por pixel ou revisão humana.

## Narração, sincronia, presenter e saída

Script Mode usa edge-tts pt-BR Antonio -3%, corte somente nas bordas silenciosas e pausas PACING de src/engine3d/audio/pacing.ts. Ação deve acompanhar predicado, sem antecipação ou atraso excessivo. Presenter preserva identidade, não obstrui mecanismo nem substitui ação. Legendas sincronizadas, legíveis e em área segura. Render final deve passar decode, H.264/AAC, geometria/fps do perfil, duração A/V e QA de áudio; métricas de master só existem depois do render. 1080×1920 é o alvo vertical; planos legados em outras resoluções não recebem certificação automática de entrega vertical.

## Gates e limites

ProductionPreflight agrega separadamente QA técnico, câmera, demonstração e suporte; BLOCKER impede render, WARNING é registrado e INFO informa. Falhas diretamente ligadas a mecanismo obrigatório ou integridade são blockers; pequenas falhas de composição são warnings. Sem média para esconder blocker. Qualidade de narrativa, clareza silenciosa e inteligibilidade real não são medidas determinísticas confiáveis; revisão humana continua necessária. Medições de câmera são amostradas e aproximadas. O perfil preserva thresholds existentes de Phase29, não calibração humana independente.

## Lições gerais dos benchmarks

Antes do close, localizar parte em relação ao sistema. Cenário deve corresponder ao objeto e ao roteiro. Geometria funcional e fluxo devem conectar participantes efetivos; mostrar fronteira e abertura no atravessamento. Render tecnicamente válido não comprova reconhecimento, causalidade nem qualidade de publicação. Nunca reajustar o benchmark para obter PASS.
