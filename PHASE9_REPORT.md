# Fase 9 — Editorial Plan + Event Map pilot

Concluída em 27/10/2026. Camada editorial implementada; execução antiga preservada. **223 testes rápidos PASS, 46 do check editorial PASS (subconjunto), 1 novo renderStill PASS, 49 recursos preservados.**

## A. Objetivo

Criar uma camada editorial versionada e revisável acima do DirectorPlan. Piloto implementado, sem sistema completo de edição, providers, mixer, overlays ou expansão de recursos. Os quatro relatórios exigidos foram lidos antes da implementação; fontes/implementações do Edit Labs não foram copiadas.

## B. Arquitetura

`Script → EditorialPlan + EditorialEventMap → validação/QA → compilação → DirectorPlan existente → compileDirectorPlan → Engine3D/Remotion`. Código novo em `src/editorial/`; CLIs de evidência em `cli/editorial-pilot.ts` e `cli/editorial-sfx-check.ts`. Engine e Remotion executam decisões já escritas, sem escolher narrativa, SFX ou mídia. Não há rede, filesystem implícito, relógio corrente, IA ou SaaS no compiler.

## C. EditorialPlan

Versão 1: id/title/language/format=vertical_short/canvas/source/cast/safeZone/beats. Cada beat contém staging explícito de recursos atuais, separado de narração/intent/visualGoal. Um beat gera uma scene/shot. O texto fonte deve corresponder à concatenação ordenada dos beats após normalização de espaços. O schema rejeita versão/campo/valor desconhecido e reaproveita planShape sem alterar o contrato antigo.

## D. Narrative Beats

Hook de 6 s, localização de 3 s e número de 4 s: 13 s/390 frames em 480×854/30fps. São durações autorais para inspeção e renderStill; não duração medida de uma nova síntese. Não foi gerado vídeo narrado completo. Staging usa Caio, Winter, Door/Map/Thermometer, OpenDoor/Point/Look, Snow/ColdBreath, câmeras já existentes.

## E. Intent

Enum pequeno: HOOK, SETUP, FACT, NUMBER, ESCALATION, REVEAL, CONTRAST, TRANSITION, CLIMAX, QUESTION e CTA. O piloto usa HOOK/SETUP/FACT. Intent é uma declaração editorial e não chama executor automaticamente.

## F. InformationType

SCENARIO, PERSON, PLACE, OBJECT, ACTION, NUMBER, COMPARISON, QUOTE e ABSTRACT. O valor −63 é FACT + NUMBER; localização é SETUP + PLACE. Não se confundiu PLACE com intenção narrativa.

## G. EventMap

Versão 1, planId e lista discriminada de eventos. Todo evento exige id único, beatId existente, purpose não vazio e anchor validada. IDs, duplicação semântica, referências e conflitos são verificados antes de compilar.

## H. Event types

O piloto tem 13 eventos e demonstra VISUAL_FOCUS, CAMERA_EMPHASIS, TEXT_EMPHASIS, SFX_CUE, HOLD, CUT, ATMOSPHERE e BROLL_REQUEST. Disposition por evento: MAPPED, METADATA ou PLAN_ONLY. Não foram criados eventos de geração/mix que fingem executar trabalho.

## I. Anchors

BEAT_START/BEAT_END/NORMALIZED/WORD/PHRASE. Busca por tokens Unicode NFC em lowercase, sem dependência de locale e sem substring parcial. Correspondência repetida exige occurrence explícita 1-based. Token/phrase ausente ou fora da faixa falha. Posição por pesos de caracteres dos tokens, arredondada à grade de frames. BEAT_END é limite exclusivo; só CUT pode ocupar esse ponto.

## J. Timing confidence

Vocabulário EXACT/MEASURED/ESTIMATED definido no contrato; **todas as âncoras do piloto são ESTIMATED**, inclusive limites baseados nas durações autorais. A divisão proporcional não é alinhamento acústico. Nenhum word boundary, voice, rate, pitch ou cache de edge-tts foi alterado. EXACT/MEASURED ficam reservados a evidência futura.

## K. SFX cues

Roles WHOOSH/IMPACT/RISER/UI/AMBIENT/TRANSITION são necessidades editoriais, não biblioteca aprovada. hook_sfx pede IMPACT na frase “tão brutal”, com intensity=.6, optional=true e purpose. O CLI anexa um candidato TESTED para inspeção; o renderer não o abre nem o toca. optional não autoriza omissão silenciosa.

## L. Asset lifecycle

DISCOVERED=identificado; CURATED=candidato selecionado por regra/humano; TESTED=verificação técnica com evidência; APPROVED=registro humano para contexto exato e evidência técnica; REJECTED=não utilizar. TESTED/APPROVED exigem technicalEvidence com hash/testId. O compiler não promove estados. Referência rejeitada, ref forjada ou asset ausente do catálogo injetado falha. A existência física é verificada pelo CLI técnico, não pelo compiler puro.

## M. SFX pilot

Oito arquivos únicos selecionados dos relatórios da Fase 7: dois WHOOSH (também TRANSITION), dois IMPACT, dois RISER e dois UI (sons de teclado, não beeps presumidos). Limite duro de 12 e deduplicação por audit ID. Somente os oito selecionados foram abertos no pack; não houve varredura, cópia, conversão para produção ou escrita no pack. O critério semântico continua candidato por metadados, sem escuta criativa.

| Candidato | Roles candidatos | Estado |
|---|---|---|
| SFX/SFX Whoosh Flange 02.wav | WHOOSH, TRANSITION | TESTED |
| SFX/Whoosh Airy Swirl 01.wav | WHOOSH, TRANSITION | TESTED |
| SFX/Hit Fast Air Burst 01.wav | IMPACT | TESTED |
| SFX/H2W Fire Blast Processed 01.wav | IMPACT | TESTED |
| SFX/Riser Flashback 01.wav | RISER | TESTED |
| SFX/Riser Short 01.wav | RISER | TESTED |
| SFX/Keyboard Typing 2.mp3 | UI | TESTED |
| SFX/MacKeyboardTypeStd PE262902.wav | UI | TESTED |

## N. Technical validation

8/8 PASS. Existência/containment realpath, tamanho positivo, ffprobe, codec, sample rate, canais e duração finitos; decode integral f32le em memória com FFmpeg -xerror/-err_detect explode; amostras finitas, saída não vazia/alinhada, duração decodificada compatível e stderr vazio. Peak/RMS foram registrados sem alegar aprovação perceptiva. SHA-256/tamanho/mtime dos oito permaneceram iguais antes/depois do teste. Ferramentas já instaladas; nenhuma instalação. Não foi certificado o hash dos outros arquivos do pack, que não foram relidos.

## O. Approval records

asset-approvals.json contém oito registros TESTED por TECHNICAL_CHECK e **zero APPROVED humano**. APPROVED exige reviewer HUMAN, context igual ao eventId, reason/evidence e ref exata. Testes com registros humanos sintéticos existem só em memória e não são evidência real. Sem autenticação, o sistema valida consistência dos registros locais, não prova identidade ou impede alguém de fabricar deliberadamente um arquivo. Status de licença é independente; DECLARED preserva a declaração anterior, não certifica termos.

## P. B-roll requests

place_broll pede futura mídia geográfica verificável, preferredType EITHER, durationHint=2, constraints, purpose e subject. generationAllowed=false e externalProviderAllowed=false são obrigatórios no piloto. Não há mídia pronta, download, substituição de cena ou geração.

## Q. Provider independence

BrollRequest não contém nome de provedor nem cliente externo. Nenhum provider/mock de geração foi criado. STRICT_RENDER rejeita a solicitação sem resolução; PLAN_ONLY mantém todos os dados para revisão. O staging de mapa existente foi autoral, não fallback escolhido para ocultar B-roll.

## R. Camera emphasis

PUSH/PULL/ORBIT/STATIC/PAN com direção explícita/SHAKE mapeiam para os sete IDs atuais. Mapeamento só no início do beat, pois câmera atual atua no shot inteiro. Âncora posterior permanece PLAN_ONLY com motivo, e STRICT_RENDER bloqueia. Conflito de múltiplas câmeras em um beat falha. Sem novas câmeras.

## S. Text emphasis

text/importance/anchor; texto no início sem placement usa onScreenText existente no shot inteiro. importance continua metadata. Texto com âncora posterior/custom placement fica PLAN_ONLY, sem fingir timing/layout que o renderer não implementa. O piloto usa “Snag · Canadá” e “Frio extremo”; −63 vem do termômetro procedural existente.

## T. Atmosphere

COLD/TENSION/MYSTERY/CALM/ENERGY são metadata. O compiler não escolhe Snow/Frost nem assets automaticamente. Snow/ColdBreath foram explicitamente escritos no staging. HOLD significa preservar intervalo sem corte, não congelar ações/câmera; duração não pode ultrapassar o beat.

## U. Compiler

compileEditorial valida inputs + QA, resolve âncoras, traduz somente correspondências suportadas, valida o resultado com compileDirectorPlan e retorna disposições/fingerprint. PLAN_ONLY preserva solicitações e um plano visual rotulado; não é aprovação audiovisual integral. STRICT_RENDER falha com EDITORIAL_UNRESOLVED para SFX/B-roll ou timing/layout não suportado, inclusive SFX aprovado se não houver mixer. createRenderProjection exige exatamente os IDs pendentes e justificativa para o render visual, devolvendo o manifesto de omissões. Não há fallback silencioso.

## V. Fixture

`examples/editorial/cold-pilot.json` é independente da demo antiga. Texto: abertura da porta/frio, Snag no Canadá e sessenta e três graus negativos. Só recursos atuais. Nenhum componente TSX de vídeo, preset ou recurso novo. O arquivo base mantém catálogo/approvals vazios; o CLI de evidência injeta candidatos técnicos e grava pilot-input.json.

## W. Editorial preview

editorial-preview.json/md apresentam por beat narração, intent, informationType, visualGoal, todos os eventos, anchors/frames/confidence, role/status de SFX, solicitação B-roll, disposition/reason e scene/shot de destino. render-projection.json registra as duas omissões: hook_sfx e place_broll.

## X. Editorial QA

Detecta schema/enum inválido, fonte/ordem divergente, órfãos, IDs/semântica duplicados, beat sem foco visual, NUMBER sem foco/texto, purpose/anchor ausentes, âncora não encontrada/ambígua, evento em limite exclusivo, HOLD fora do beat, CUT interno/final/ausente entre beats, câmeras/textos conflitantes, alvo inexistente, área de texto insegura, referência inexistente/divergente/rejeitada, ausência de aprovação válida e decision órfã. QA não avalia beleza, verdade histórica ou qualidade perceptiva; compatibilidade executável é validada pela Engine3D.

## Y. Safe zone

Rect normalizado no plano: x=.08/y=.08/width=.84/height=.72. Escala ao canvas 480×854 ou outra resolução vertical par. Não foram copiados limites 1080×1920 do Edit Labs. Placement deve caber na zona; o rótulo legado só é mapeado se sua região normalizada atual couber. Custom layout não é executado. Não há garantia de bbox de textos arbitrários/captions antigas; nenhum novo overlay foi implementado.

## Z. Determinism

Duas compilações equivalentes geraram o mesmo SHA-256 canônico do DirectorPlan: `aa957a9ed352d3e08e3eec55573ccbd1d0b8c152e068933dc483090b0e180002`. Ordenação das chaves do objeto é por code units, sem locale; ordem de arrays é significativa. O input não é mutado. Não há Math.random/Date.now/mtime/filesystem order na compilação. O renderStill prova execução nesta instalação, não determinismo entre GPUs.

## AA. Fingerprint

Versão `editorial-compiler/1.0.0`; fingerprint `712965c8f4a6abec8f194b342772ce5482522d80656ad004b85d8b614ce7ae96`. Inclui plano, eventMap, compiler version, refs/status/evidência de conteúdo relevantes, aprovações relevantes e decisões. Não inclui raízes absolutas, mtime, máquina ou relógio; timestamps de revisão e candidatos não referenciados não invalidam o resultado. Hashes de conteúdo portáveis entram no fingerprint. Finalidade futura de cache/revisão; nenhum cache novo implementado. Alterar semântica do compiler requer bump da sua versão.

## AB. Decision log

EditorialDecision opcional com eventId/decision/status/reason/attempt inteiro positivo. PROPOSED/ACCEPTED/REJECTED/REVISED; eventos inexistentes falham. A decisão do piloto registra a manutenção do B-roll como plano por limitação de escopo, não inventa aprovação humana de mídia.

## AC. Tests

typecheck PASS. check:engine3d **223 PASS / 0 FAIL** = 177 anteriores preservados + 46 novos testes editoriais. check:editorial **46 PASS / 0 FAIL**, subconjunto dos mesmos 223, não somado novamente. Cobertura de schemas, anchors, lifecycle/contexto, modos, QA, safe zone, mapeamentos, canonical hash, fingerprint e compatibilidade. Sem dependência do pack/rede nos testes rápidos. Logs e checks.json em out/engine3d/phase9.

## AD. Render integration

check:editorial:render **1 PASS / 0 FAIL**. Bundle real de src/index.tsx, selectComposition DirectorSequence e renderStill no frame 300, 480×854. PNG verificado por header/dimensões/tamanho e inspecionado visualmente: Caio/gesto, termômetro −63 °C, título e caption presentes. Arquivo editorial-number.png, SHA-256 `d7adfb1bee601579bfc62c1621230607f870c090d4c2b26012fd75274922a617`. Omissões declaradas hook_sfx/place_broll. Sem áudio sintetizado/mixado, vídeo gerado ou julgamento automático de estética. As quatro integrações antigas não foram reexecutadas nesta fase e seus arquivos permanecem inalterados.

## AE. Registry count

6 characters + 9 environments + 14 props + 10 actions + 7 cameras + 3 VFX + 0 scenePreset = **49 IDs**. engine3d:catalog PASS e contagem exata testada; registry/executors/biblioteca não foram editados.

## AF. Compatibility

SHA-256 comparado com baseline de 33 arquivos preexistentes. A única mudança nesses arquivos foi package.json para adicionar cinco scripts. Engine3D, DirectorPlan/ShotSpec/ProceduralSequence, TTS, captions, CLI antiga, testes anteriores e exemplos antigos têm conteúdo preservado. package-lock/dependências inalterados. Nenhum commit/push/publicação ou cópia do Edit Labs. As modificações anteriores do usuário foram mantidas.

## AG. Limitations

Word timing permanece estimado; durações autorais não substituem medição de TTS. Uma scene/shot por beat; sem cortes internos, eventos gráficos temporizados ou layout custom executável. VISUAL_FOCUS/HOLD/ATMOSPHERE são intenções revisáveis nos limites documentados, sem inteligência autônoma. TESTED não significa criativamente aprovado; nenhum SFX foi mixado. B-roll não gerado; Higgsfield ausente. Assets externos continuam fora da Engine3D. Aprovação humana não foi inventada e registros locais não autenticam humanos. Sem teste automático de estética, sem novo mixer/overlay/MediaAssetRegistry. O pack inteiro não foi rehasheado para alegar integridade não observada.

## AH. Próxima recomendação

Parar ao final da Fase 9. Se o usuário solicitar outra fase, revisar/escutar os candidatos no contexto e definir critérios de aprovação e contrato de mix antes de implementar áudio. Alternativamente, revisar a granularidade de timing do plano. Nenhuma próxima fase, vídeo de 40–60 s, provider, mixer, overlay ou registro de mídia completo foi implementado.
