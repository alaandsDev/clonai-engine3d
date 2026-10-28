# PHASE16 — Semantic Claim Engine v1

2026-10-28. Evidência local: `out/engine3d/phase16/`. Política: **PRECISION > RECALL**.

## A. Objective

Implementar roteiro pronto → semântica rastreável → claims automáticos → Auto Director existente → vídeo. **Os 16 gates especificados passaram; LEVEL 3 nos casos suportados.** Isso não significa entendimento geral de português, resolução automática de gaps ou tema → vídeo.

## B. Starting state

Fase15: LEVEL 2, claims explícitos e direção automática; extração heurística frágil, pipeline visual já disponível. Foram preservados 50 recursos Engine3D, 8 SFX e 5 visuais. As mudanças desta fase ficam no novo módulo semântico, shell/CLI, fixtures/golds/testes e integração limitada do Auto Director.

## C. Architecture

`SemanticInput(script only) → parseSemantics → SemanticAnalysis → toAutoDirectorInput → AutoDirectorPlan → DirectedSequence/VisualDemonstration → renderer existente → MP4`. Sem LLM, fact checker, busca, serviço novo ou renderer alternativo. Core puro; arquivos, medição de desempenho, TTS e gravação de outputs ficam nas shells. Contexto pertence a cada chamada.

## D. SemanticAnalysis contract

v1 inclui script/fingerprint/language, unidades, entidades, menções, referências, predicados, quantities, relações, claims, ambiguidades, unresolvedReferences, contextos, confidenceSummary e provenance. Versões semantic-engine/1.0.0 e semantic-claim-adapter/1.0.0. Regras/pesos/versionamento entram no fingerprint. Não há IDs de fixtures como regras de interpretação.

## E. Source spans

Todos os elementos extraídos têm sourceSpan {start,end,text}; claims e relações têm sourceEvidence[]. Offsets UTF-16 half-open e texto obtido por slice do roteiro original. Normalização de acentos usa mapa de volta, testado com emoji e acento decomposto. sourceEvidence pode cobrir uma unidade inteira; não é um alinhamento sintático palavra a palavra. QA rejeita spans inválidos e links órfãos.

## F. Entity extraction

Léxico limitado de PERSON/GROUP/OBJECT/PLACE/SUBSTANCE/ENVIRONMENT/MEASUREMENT/NUMBER; UNKNOWN pode permanecer como sujeito null/unresolved. Água, tubo, reservatório, carro, gelo, equipamentos e grupos são extraídos por regras declaradas. Nomes próprios são candidatos pela construção local, sem base de conhecimento. Vostok/Aurora não têm branches; tipo PLACE decorre de construção locativa. Papéis nominais e adjuntos ainda são heurísticos.

## G. Mentions

Entidade é persistente; menções têm span, unidade, papel e tipo NOUN/PRONOUN/DESCRIPTIVE/ELLIPSIS. Carro/Ele/veículo podem apontar para a mesma entidade. Modificadores diferentes em carros preservam distinção. As arrays retornadas pertencem ao resultado, testadas contra mutação das regras por um caller.

## H. Reference resolution

Janela declarada de duas unidades; gênero/número, descritores e restrição lexical de fluxo líquido reduzem candidatos. Múltiplos candidatos não recebem escolha por mera recência. Ela no piloto liga-se à água mediante contexto explícito de fluxo/tubo; caixa/reservatório usam alias limitado. João/rádio/carro → Ele fica AMBIGUOUS, selectedEntityId=null. Nem todos os pronomes/descritores têm cobertura ampla; gênero desconhecido reduz confiança.

## I. Narrative context

Snapshots por unidade registram activeEntities, recentSubjects/recentObjects, currentPlace/currentProcess/currentMeasurement/currentComparison/currentRanking/pendingReferences. Sujeito omitido herda o único sujeito recente dentro da janela. Testes intercalam análises diferentes e repetem o input para confirmar isolamento. Contexto não resolve referências distantes ou ambiguidade arbitrariamente.

## J. Predicates

Vocabulário canônico pequeno e explícito: entrada/saída/subida/fluxo, aumentar/diminuir, acúmulo/congelar/cobertura/armazenamento, abrir/fechar, movimento/operação, comparação/medição e outros padrões declarados em rules.ts. Algumas flexões presentes/passadas comuns são reconhecidas. UNKNOWN não vira compreensão positiva; classifica abstenção. Isso não é parser universal de verbos/sintaxe.

## K. Quantities

Inteiros, decimais numéricos, negativos, palavras limitadas zero–cem, porcentagens, temperatura, distância, tempo, velocidade e rankings. -89°C, menos oitenta e nove graus, 63 graus negativos, 20%/vinte por cento, cinco quilômetros, três horas, número 1 e primeiro lugar foram testados. Sem conversão entre unidades. “Graus” usa convenção Celsius do projeto. Transição -20 → -60 é DECREASE por valor assinado; contradição textual/números gera ambiguidade sem corrigir o roteiro.

## L. Relations

Relações incluem sujeito/ação, ação/objeto, localização, origem/destino/caminho, estados, quantity, comparação, causa e ordem temporal explícita, contenção e nível PART_OF recipiente. Cada link tem evidência literal e referências de entidades/predicados. Relações são parciais: ausência de link não prova ausência no texto; não se completam relações com conhecimento de mundo.

## M. Cause/effect

Marcador explícito + dois eventos textuais podem formar CAUSE_EFFECT. No positivo, queda da temperatura e congelamento da água são ligados por “Por isso”, com entidades e sourceEvidence de ambas as unidades. Retirar o marcador remove causa/claim causal. Proximidade de frases não cria causa; “Por isso” é conector, sem fingir que “isso” nomeia objeto físico. Estruturas causais mais amplas e escopo condicional permanecem limitados.

## N. Temporal relations

Antes/depois/em seguida/então ligam ordem quando há eventos textuais. “Depois” do congelamento para cobertura tem evidência. Início, enquanto e até espacial não são promovidos indevidamente a AFTER. Não há cronologia ou duração inferida por senso comum.

## O. State transitions

ACCUMULATE gelo + COVER do mesmo sujeito podem formar cadeia com evidence/window compartilhados e final COVERED. NORMAL só aparece semanticamente quando escrito; EXPOSED só quando há “exposto”; caso contrário initial pode ser null. O estado NORMAL/FROSTED/FROZEN do carro é a representação procedural já existente, não uma nova afirmação sobre motor/bateria/combustível. Sem gelo textual ou sem final coberto, o adapter recusa usar o template de congelamento completo.

## P. Negation

Não/nunca/jamais/nem em escopo simples ficam em negated=true. Água não congelou não produz demonstração positiva; remover “não” altera a semântica. Dupla negação gera CONFLICTING_INTERPRETATIONS, sem cancelar para um positivo. Escopo com coordenação/subordinação e outras formas negativas ainda é restrito; interpretações desconhecidas não recebem execução DIRECT.

## Q. Modality

Pode → POSSIBLE; poderia/condição simples → HYPOTHETICAL; talvez/provavelmente/possivelmente/parece → UNCERTAIN. Política de execução é separada da confiança de extração: interpretar HIGH uma possibilidade não autoriza exibi-la como fato. Há escopo de modalidade por unidade, ainda grosseiro para condições/múltiplas cláusulas. O fixture “Se ... pode congelar” permanece não assertivo e com gap visual.

## R. Questions

Perguntas geram QUESTION/interrogative=true e não claims físicos assertivos. “Por que a água sobe pelo tubo?” pode manter pergunta editorial/apresentador e alvo de prova NONE. Isso não mostra subida/congelamento como acontecimento comprovado; perguntas com sintaxe desconhecida continuam perguntas, sem completar a resposta.

## S. Claim generation

Claims existentes, extractionSource=SEMANTIC_ENGINE, confidence/breakdown, entidades/relações/referências/ambiguidades e evidence. Água: contexto retórico + FLOW + RISE + INCREASE + STORE + conclusão. ENTER subordinado permanece como predicado/relação, sem duplicar um claim que contradiga a janela da consequência. Contexto factual e operações distintas não são fundidos apenas por usarem “ele”.

## T. Claim confidence

Pesos executados: texto +.20, predicado +.30, sujeito +.25, objeto +.10, quantity +.15, referência HIGH +.12/MEDIUM −.12, sujeito ausente −.35, ambiguidade −.60, predicado desconhecido −.35. Soma [0,1]; HIGH ≥.75, MEDIUM ≥.50, LOW abaixo; ambiguidade crítica força LOW. Causa exporta breakdown próprio (.20 texto +.35 marcador +.30 dois eventos ou .05 incompletos, −.60 ambiguidade). Contexto retórico tem classificação editorial explícita, sem prova física. Pesos são regras, não probabilidade calibrada.

## U. Ambiguity/abstention

AMBIGUOUS_REFERENCE/SUBJECT/OBJECT/RELATION, UNSUPPORTED_PREDICATE, INSUFFICIENT_CONTEXT, EXTERNAL_KNOWLEDGE_REQUIRED e CONFLICTING_INTERPRETATIONS são tipos disponíveis; não há promessa de detectar todos universalmente. Referências sem antecedente e ambiguidades críticas conservam diagnóstico; claims dependentes não ficam HIGH. Abstenção semântica e gap de capacidade são distinguidos. A preferência é PRECISION > RECALL, não coverage artificial.

## V. Claim deduplication

Chave semântica considera tipo, entidades, predicado, relações normalizadas, valores/unidades, estado, negação e modalidade. Fingerprint final inclui evidence combinada. Repetições idênticas carro/ele/veículo podem ser fundidas; contextos normal/exposto, derretimento intermediário e repetição temporal explícita são preservados como distintos. A deduplicação é conservadora, não equivalência geral de paráfrases.

## W. Claim chaining

previousClaimIds/nextClaimIds/sharedEntityIds ligam continuidade por entidade. Nível compartilha o recipiente com o processo anterior via PART_OF; armazenamento compartilha água/recipiente. Acúmulo e cobertura têm executionUnitIds para um único processo contínuo. IDs e evidências continuam auditáveis; não se cria causa só porque há encadeamento.

## X. Semantic→AutoDirector adapter

`toAutoDirectorInput` é a fronteira explícita. Metadata neutra ClaimExtraction conserva origem/confiança/evidence/flags/policy e janela; Auto Director não importa parser. SAFE/ABSTAIN/EDITORIAL impedem fallback positivo. Claims de contexto podem ser projetados como CONCLUSION sem prova; continuações deduplicadas recebem contexto proveniente da mesma evidence para impedir reinterpretação pelo heuristic extractor antigo. SEMANTIC_STRICT rejeita incerteza PRIMARY; Auto Director STRICT rejeita gaps. Water tem zero claims humanos.

## Y. Water script-only

Roteiro integral idêntico à source-of-truth da Fase15, com seus separadores. Input contém version/id/language/script, sem claims ou direção visual. Cinco unidades, cinco entidades, quatro referências resolvidas e seis claims; quatro PRIMARY com prova. Auto Director seleciona FLOW/QUANTITY/REVEAL e gera uma sequência contínua/uma demonstração, sem gaps.

## Z. Freezing script-only

O fixture fornecido tem carro → Ele → veículo persistente, ACCUMULATE ICE → COVERED, sem claims manuais. Metadata/capabilities do Auto Director encontram PROP_CAR_001; duas claims principais compartilham janela de processo. Sequência/demonstração/VisualProof plan válidos; endpoint frost=1/FROZEN. Teste adicional com sujeito omitido em quatro frases também executa. Não foi necessário outro MP4 do carro para esta fase.

## AA. Quantity fixture

“A temperatura caiu de menos vinte graus para menos sessenta graus.” → [-20,-60], dimensão TEMPERATURE/Celsius, direção DECREASE, claim QUANTITY_CHANGE HIGH. Os números não foram invertidos nem comparados por módulo. Há gap visual honesto porque o template existente de instrumento não anima esta mudança; compreender o texto não cria uma operação gráfica nova.

## AB. Spatial fixture

Reservatório inferior = SOURCE, tubo = PATH, caixa superior = DESTINATION; água permanece sujeito de EXIT/FLOW/RISE. O parser não atribui a subida ao tubo. Claims PROCESS/SPATIAL_RELATION saem automaticamente; sequência de processo suportada também é compilável. Não há simulação física, bomba/pressão ou mecanismo não escrito.

## AC. Causal fixture

Positivo contém queda e congelamento com CAUSE_EFFECT HIGH e evidências de ambas as frases. Controle e mutação sem marcador não geram causa. O adapter preserva interpretação e expõe gap visual para causalidade/congelamento de água; não substitui água por carro para fabricar DIRECT.

## AD. Ambiguous reference fixture

João, rádio e carro são três candidatos compatíveis para Ele. selectedEntityId=null, AMBIGUOUS_REFERENCE e claim dependente LOW. Nenhuma escolha arbitrária por proximidade; SEMANTIC_STRICT falha. Outros adversariais cobrem dois carros, referência distante, descritores e sujeito omitido.

## AE. Negation/modality/question

Os três fixtures obrigatórios e mutações mantêm negação, possibilidade/hipótese e pergunta. Negation/modality não recebem DIRECT; a pergunta tem QUESTION e proof NONE. Dupla negação desconhecida abstém. Guardas são explicitamente testados para os padrões suportados, sem alegar cobertura de todas as construções negativas/condicionais da língua.

## AF. External knowledge guard

Vostok é extraído do texto locativo como PLACE e atributo frio permanece textual. Zero quantities; ausência testada de Antártida/−89/estação científica/recorde mundial. Substituir Vostok por Aurora conserva a estrutura. Não houve consulta factual/rede, tabela geográfica ou correção de fatos. O boolean provenance não é a única evidência: source spans, golds e testes de ausência sustentam o resultado.

## AG. Researchers negative fixture

SCRIPT ONLY reconhece GROUP pesquisadores, OPERATE, OBJECT equipamentos e PLACE estação. Claim PROCESS HIGH de extração encontra MISSING_SUBJECT no Auto Director; zero sequências e nenhum DIRECT. STRICT rejeita. Não há Caio/Radio substituindo a multidão nem provider externo sendo chamado. Gate crítico passou.

## AH. Multi-claim fixture

Roteiro natural de 101 palavras, oito unidades, entidade/pronome/número/estado/processo/espacial/causa/pergunta e pesquisadores. Saída: 12 claims (8 HIGH/4 LOW), 2/4 referências resolvidas, 3 ambiguidades, 11 gaps e zero sequências completas. Coverage por unidade=0.75; abstention=0.33. Múltiplos referentes e domínios mistos expõem o limite real. Não se fabricou montagem parcial: Auto Director v1 bloqueia o plano inteiro com gaps. Esse resultado limita a recomendação de uso geral.

## AI. Auto Director integration

Integração real exercita script → análise → claims → input neutro → planner/resolver/scoring → compiler → contratos. As mudanças nos cinco arquivos Auto Director são campos/validação de origem, policy de abstenção e janela de state chain/foco. Sem novo planner, templates/recursos substitutos ou alterações no render runtime. Guardrails/compatibilidade/regressões anteriores permanecem ativos.

## AJ. Pilot render

`renders/semantic-water.mp4`: 711 frames, 23,7 s, 480×854/30 fps, H.264/AAC, 48 kHz estéreo. JSON compilado foi comparado ao fingerprint efetivamente renderizado. edge-tts pt-BR-AntonioNeural, +0%, +0Hz, cinco CACHE HIT; sistema de captions existente, até três palavras, timing ESTIMATED. Decode integral/A-V/áudio PASS, sem música/SFX/overlays novos. Render/stills/bundle/encode/mux/QA medidos em 55.85 s. Render foi executado nesta fase; a representação visual reproduz o processo suportado da Fase15.

## AK. Visual proof

| Claim automático | Janela | Planejado/Executado | Evidência |
|---|---|---|---|
| C2 FLOW | 118–251 | DIRECT/DIRECT | conexão e líquido percorrendo tubo |
| C3 RISE | 118–251 | DIRECT/DIRECT | caminho ascendente visível |
| C4 INCREASE | 251–385 | DIRECT/DIRECT | nível do destino sobe |
| C5 STORE | 385–551 e hold final | DIRECT/DIRECT | água armazenada persiste |

4 PRIMARY, 4 DIRECT planejados/executados, 0 PARTIAL/SYMBOLIC/gaps: resultado deste piloto suportado, não taxa universal de precisão. Contexto e conclusão não entram no denominador. Evidência individual por operação/estado/foco/time e revisão Codex de 16 frames, 3 tiras e 4 decoded samples, sem inferir aprovação humana. Métricas da Fase13 mantêm zero ator/cuts, três avisos de repetição e hold final longo; não medem fill/flow como movimento de prop registrado.

## AL. Determinism

Mesmo roteiro/versão/regras produz análise, claims e fingerprints idênticos em todos os 14 fixtures; análise intercalada não deixa contexto global. Inverter enumeração de capabilities conserva os planos. Trocar ID, nome próprio e carro→veículo não altera a decisão estrutural pertinente. Compiler/adapter rejeitam adulteração de fingerprints; hashes são integridade determinística, não assinatura de segurança. Caminho/mtime/clock não entram nos planos.

## AM. Performance

Medição separada em uma execução local, não distribuição de benchmark:

| Fixture | Parse ms | Claims ms | Adapter ms | AutoDirector ms | Compile ms |
|---|---:|---:|---:|---:|---:|
| water | 2.20 | 3.81 | 1.22 | 481.40 | 206.83 |
| freezing | 1.05 | 6.14 | 1.28 | 170.46 | 58.39 |
| quantity | 0.93 | 1.37 | 0.27 | 1.76 | 1.06 |
| multi-claim | 5.92 | 4.87 | 1.81 | 8.13 | 4.05 |
| researchers | 0.71 | 0.99 | 0.35 | 2.53 | 2.47 |

Claims inclui fingerprint/QA semântico. Há varreduras por regras/unidades e trechos quadráticos em binding/dedup/chaining, sem busca combinatória exponencial. Script tem limite de 20.000 caracteres e o input de direção preserva guardrails. Não se sacrificou clareza por micro-otimização.

## AN. Tests

**Dez comandos PASS; 40 testes semânticos**, incluindo 14 gold fixtures independentes, source spans, entities/mentions, coreference, quantity, causalidade, state chains, negação/modalidade/pergunta, dedup, mutações, ausência de conhecimento externo, pureza e adapter. O check engine3d inclui a suíte semântica; não somar duplicadamente.

- npm run typecheck: exit 0
- npm run check:engine3d: tests 417, pass 417, fail 0
- npm run check:editorial: tests 46, pass 46, fail 0
- npm run check:sound: tests 35, pass 35, fail 0
- npm run check:visual: tests 37, pass 37, fail 0
- npm run check:motion: tests 30, pass 30, fail 0
- npm run check:demonstration: tests 30, pass 30, fail 0
- npm run check:autodirector: tests 23, pass 23, fail 0
- npm run engine3d:catalog: exit 0
- npm run check:semantics: tests 40, pass 40, fail 0

CLI analyze/plan smoke PASS. O piloto real tem QA de decode/proveniência/frames separado dos testes unitários, sem depender de internet nos testes. Nenhuma dependência foi instalada/atualizada.

## AO. Registry

Engine3D=50 (6 personagens, 9 ambientes, 15 props, 10 actions, 7 câmeras, 3 VFX); SFX=8, VISUAL=5. Zero IDs novos e nenhum scan/expansão de pack. Resolver existente continua selecionando os recursos. Metadados semânticos não são novos assets.

## AP. Compatibility

SHA-256 de baseline confirma apenas os cinco arquivos de integração do Auto Director e package.json entre arquivos preexistentes. Engine3D/render, edge-tts/cache, sound/visual/editorial e lockfile preservados. Master de 81,8 s e pilotos das Fases13/14/15 têm hashes originais confirmados. Limitação editorial da Fase15 permanece: DirectorPlan/EditorialPlan exportados são projeção simbólica de interoperabilidade; DirectedSequence é autoritativo para primitivas/prova DIRECT. Nenhum commit/push/publicação.

## AQ. Limitations

Léxico/gramática fechados, cobertura parcial de flexões, anáforas/aliases e papéis nominais; modalidade e alguns bloqueios por unidade são grosseiros; referência distante/duas entidades podem exigir abstenção. Dedup e confidence não são modelos calibrados. Relações temporais/causais incompletas, sem compreensão universal de negação ou elipse. Sem simulação física, sem alinhamento real de palavras e sem novos templates para temperature transitions/múltiplos sujeitos/causas gerais. Auto Director misto com gaps continua sem montagem parcial. Projeção legada e câmera simples/hold longo permanecem. Source coverage não é fact checking ou recall semântico completo.

## AR. Honest assessment

| Dimensão | Nota | Evidência / limite |
|---|---|---|
| SCRIPT SEGMENTATION | GOOD | cobertura literal UTF-16; sintaxe complexa não segmentada integralmente |
| ENTITY EXTRACTION | ACCEPTABLE | léxico/estrutura e nomes sem lookup; categorias limitadas |
| COREFERENCE | ACCEPTABLE | simples/omitido/alias e abstenção; dois candidatos dificultam texto natural |
| PREDICATE EXTRACTION | ACCEPTABLE | padrões canônicos úteis; flexões/sintaxe não universais |
| QUANTITY EXTRACTION | GOOD | sinais/palavras/dimensões/transição; léxico numérico limitado |
| RELATION EXTRACTION | ACCEPTABLE | caminho/estado/nível e operands; relações parciais |
| CAUSE/EFFECT | ACCEPTABLE | positivo/controle/mutação; escopo complexo limitado |
| NEGATION | GOOD | simples/double abstention testadas; não toda construção |
| MODALITY | ACCEPTABLE | policy não assertiva; escopo por unidade |
| CLAIM PRECISION | ACCEPTABLE | golds/ausências/guardas; sem estimativa populacional |
| CLAIM COVERAGE | ACCEPTABLE | piloto suportado completo; multi tem 4 claims LOW |
| AMBIGUITY HANDLING | GOOD | candidatos/nulidade explícitos; pode abster em excesso |
| EXTERNAL KNOWLEDGE GUARD | GOOD | Vostok/Aurora/ausências/spans; conjunto finito |
| AUTODIRECTOR INTEGRATION | GOOD | script-only até execução; projeção legada ainda simbólica |
| VISUAL PROOF | GOOD | quatro evidências revisadas; qualidade editorial não universal |
| GENERALIZATION | ACCEPTABLE | IDs/nomes/sinônimo; vocabulário controlado |
| OVERALL AUTONOMY | ACCEPTABLE | LEVEL 3 nos gates; roteiro geral ainda não confiável |

| Fixture | Units | Claims H/M/L | Reference resolved/total | Coverage units | Abstention | Visual gaps |
|---|---:|---|---|---:|---:|---:|
| ambiguous | 2 | 1/0/1 | 0/1 | 0.50 | 0.50 | 2 |
| causal | 2 | 3/0/0 | 0/0 | 1.00 | 0.00 | 3 |
| causal-negative | 2 | 1/0/1 | 0/1 | 0.50 | 0.50 | 2 |
| coreference | 4 | 4/0/0 | 3/3 | 1.00 | 0.00 | 0 |
| external-knowledge | 1 | 1/0/0 | 0/0 | 1.00 | 0.00 | 1 |
| freezing | 3 | 3/0/0 | 2/2 | 1.00 | 0.00 | 0 |
| modality | 1 | 2/0/0 | 0/0 | 1.00 | 0.00 | 2 |
| multi-claim | 8 | 8/0/4 | 2/4 | 0.75 | 0.33 | 11 |
| negation | 1 | 1/0/0 | 0/0 | 1.00 | 0.00 | 1 |
| quantity | 1 | 1/0/0 | 0/0 | 1.00 | 0.00 | 1 |
| question | 1 | 1/0/0 | 0/0 | 1.00 | 0.00 | 0 |
| researchers | 1 | 1/0/0 | 0/0 | 1.00 | 0.00 | 1 |
| spatial | 1 | 3/0/0 | 0/0 | 1.00 | 0.00 | 0 |
| water | 5 | 6/0/0 | 4/4 | 1.00 | 0.00 | 0 |

Coverage é fração de unidades com algum claim resolvido não LOW, incluindo contexto; não é recall de todas as proposições. unsupportedSpanRate usa unidades com claims LOW/unresolved; ambiguityRate e abstentionRate usam claims. Negação/modalidade compreendidas podem ser HIGH e ainda ABSTAIN visualmente. Não se declarou “100% de precisão” com base nesses números.

## AS. Autonomy level

**LEVEL 3 — script → automatic claims/direction, restrito aos casos suportados e aos 16 gates aprovados.**

- Gate 1: water SCRIPT ONLY executable — PASS (autodirector/water-plan.json).
- Gate 2: freezing SCRIPT ONLY executable — PASS (autodirector/freezing-plan.json).
- Gate 3: car/ele/omitted/vehicle coreference — PASS (semantic/coreference.json).
- Gate 4: -20 to -60 is decrease — PASS (semantic/quantity.json).
- Gate 5: explicit causal relation — PASS (semantic/causal.json).
- Gate 6: causal control has no invented cause — PASS (semantic/causal-negative.json).
- Gate 7: ambiguous pronoun abstains — PASS (semantic/ambiguous.json).
- Gate 8: negation has no positive DIRECT — PASS (semantic/negation.json).
- Gate 9: modality has no asserted DIRECT — PASS (semantic/modality.json).
- Gate 10: question remains interrogative — PASS (semantic/question.json).
- Gate 11: no external Vostok knowledge — PASS (semantic/external-knowledge.json).
- Gate 12: researchers gap and STRICT refusal — PASS (analysis/researchers-visual-gaps.json).
- Gate 13: automatic claims retain provenance — PASS (autodirector/water-input.json).
- Gate 14: water MP4 from automatic JSON — PASS (analysis/render-qa.json).
- Gate 15: determinism across all fixtures — PASS (analysis/fingerprints.json).
- Gate 16: all previous checks and semantic suite PASS — PASS (analysis/checks.json).

Respostas obrigatórias:

1. SOMENTE roteiro extrai claims suficientes para dirigir vídeo suportado sem claims manuais? **SIM**, água renderizada e congelamento compilado.
2. Prefere abstenção a inventar relações? **SIM nos casos testados**, com bloqueios e diagnósticos explícitos; não é garantia universal.
3. Resolve referências simples entre frases? **SIM**, incluindo sujeito omitido/veículo; casos ambíguos abstêm.
4. Negação/modalidade/pergunta são protegidas contra positivo indevido? **SIM nos padrões cobertos**.
5. Adicionou conhecimento não escrito? **NÃO**, sem lookup factual e com testes de ausência/evidência.
6. Recusou o impossível honestamente? **SIM**, MISSING_SUBJECT e STRICT.
7. Atingiu LEVEL 3? **SIM nos gates definidos**, sem alegar confiabilidade geral.
8. ÚNICO maior gargalo agora: **compreensão conservadora de roteiros naturais com múltiplos referentes e cláusulas**, exposta pelo multi-claim.

## AT. Next recommendation

**Único investimento recomendado: B) Expand semantic understanding.** O multi-claim de 101 palavras ainda tem referências ambíguas, claims LOW e plano não renderizável; adicionar um writer agora ampliaria a variedade de construções que o parser não suporta. Esta é recomendação por evidência, não implementação. Fase16 termina aqui com implementação, fixtures, testes, integração, piloto, QA e relatório. Nenhuma Fase17/topic→script/Higgsfield/HeyGen/expansão de assets iniciada.
