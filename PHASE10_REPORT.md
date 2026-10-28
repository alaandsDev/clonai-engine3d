# Fase 10 — Media Asset Registry + Sound Design Engine

Concluída em 27/10/2026. **Oito SFX registrados, um uso aprovado pelo usuário e master real com voz + SFX produzido.**

## A. Objetivo

Implementado o primeiro fluxo real de sound design: intenção editorial → referência estável → aprovação de contexto → plano → mix → master. Escopo limitado aos oito SFX TESTED da Fase 9. Sem música, overlays, mídia visual externa, B-roll, Higgsfield, recursos 3D novos ou mudança no edge-tts.

## B. Arquitetura

Código novo em `src/sound/`: contracts/registry/resolver/mixer/tools. Intenção continua em src/editorial; MediaAssetRegistry cataloga; seleção explícita liga evento/approval/asset; resolver escreve decisões; mixer executa somente o plano; Remotion renderiza visuais/captions e voice-only; FFmpeg muxa o mix final copiando o stream de vídeo. A camada editorial antiga e o renderer não escolhem sons. Os relatórios exigidos e contratos atuais foram revisados; conceitos foram reimplementados sem copiar Edit Labs.

## C. MediaAssetRegistry

Registro versionado separado da Engine3D, somente type=AUDIO/subtype=SFX. Campos: id/version/type/subtype/roleTags/relativePath/sourceCatalog/sourceAuditId/contentHash/technicalMetadata/semanticMetadata/lifecycleStatus/licenseStatus/provenance. Validação de campos fechados, enums, valores técnicos finitos/positivos e snapshots sem mutação por getters. Nenhuma descoberta automática, scan ou promoção de lifecycle.

## D. Stable IDs

IDs atribuídos explicitamente: SFX_WHOOSH_001/002, SFX_IMPACT_001/002, SFX_RISER_001/002 e SFX_UI_001/002. Não derivam de filename ou raiz. Um movimento futuro altera relativePath; alteração de bytes exige hash/revisão explícitos e invalida approvals antigos. sourceAuditId preserva a associação com a evidência anterior.

## E. External root

CLONAI_MEDIA_ROOT configura a raiz externa em runtime; CLONAI_FFMPEG pode indicar ferramenta existente. Não há raiz deste computador hardcoded nos módulos ou identidade dos assets. media-root-check.json registra somente configuração/resultado, sem persistir o caminho absoluto. O fallback de descoberta encontra FFmpeg já existente, sem instalar nada.

## F. Path security

Rejeita paths absolutos, drive/UNC, null byte, separadores hostis, traversal e device names por validação de path relativo. Resolução checa containment lexical e realpath contra symlink/junction escape, existência, tipo de arquivo, tamanho e SHA-256. Outputs e PCM auxiliar passam pelo helper de segurança sob out/engine3d/phase10. FFmpeg usa argumentos estruturados, sem shell de filename. Limitação: não é sandbox de OS contra troca concorrente de links/arquivos entre check e uso.

## G. Registered assets

Exatamente os oito caminhos autorizados. IDs, hashes e metadata vieram dos catálogos/TESTED da Fase 9; nenhuma enumeração dos 5,69 GB. UI são candidatos de teclado, não beeps presumidos. WHOOSH compartilha role TRANSITION de áudio, sem implementar transições visuais. Nenhuma mídia original foi colocada em src/public.

| ID | Fonte relativa | Lifecycle |
|---|---|---|
| SFX_WHOOSH_001 | SFX/SFX Whoosh Flange 02.wav | TESTED |
| SFX_WHOOSH_002 | SFX/Whoosh Airy Swirl 01.wav | TESTED |
| SFX_IMPACT_001 | SFX/Hit Fast Air Burst 01.wav | TESTED |
| SFX_IMPACT_002 | SFX/H2W Fire Blast Processed 01.wav | TESTED |
| SFX_RISER_001 | SFX/Riser Flashback 01.wav | TESTED |
| SFX_RISER_002 | SFX/Riser Short 01.wav | TESTED |
| SFX_UI_001 | SFX/Keyboard Typing 2.mp3 | TESTED |
| SFX_UI_002 | SFX/MacKeyboardTypeStd PE262902.wav | TESTED |

## H. Lifecycle

DISCOVERED/CURATED/TESTED/APPROVED/REJECTED preservados. As oito entradas do registry continuam TESTED. Uso aprovado é overlay contextual em sfx-approvals.json, não approved=true global. Rejeição do asset/contexto, hash divergente, lifecycle não testado ou role/contexto incompatível bloqueiam resolução/execução. Licença permanece DECLARED, independente da validação técnica/criativa.

## I. Review workflow

npm run sound:review gera oito WAVs individuais 48k/stereo, normalizados somente para escuta em −20 LUFS/−3 dBTP, com até os primeiros 10 s. sfx-review-manifest.json registra filename/roles/duração/status/notas, trim, hashes source→derivative e QA. Originais não são normalizados nem alterados. Sons IMPACT foram apresentados em áudio nesta conversa antes da pergunta de aprovação.

## J. Approval model

O arquivo começou vazio. CLI approve/reject exige explicitamente reviewer-type HUMAN, reviewer-id, asset, role, context, reason, sourceHash, evidence e ID da decisão. Código não preenche HUMAN por teste ou default. Contexto é o eventId exato. A decisão atual de um asset/role/contexto pode ser substituída/revogada explicitamente. Registros locais validam consistência, não autenticam identidade nem impedem falsificação deliberada de um arquivo por alguém com acesso.

## K. SoundDesignPlan

Versão 1 com editorialFingerprint/fps/durationSeconds/mode/cues/unresolved. Cue contém eventId/assetId/role/context/sourceHash/anchor/anchorFrame/anchorSeconds/timingConfidence/resolvedStart/sourceIn/sourceOut/windowPolicy/gainDb/fades/ducking/purpose/approvalRef. Campo adicional/valor inválido falha. O plano real tem uma cue e zero unresolved de áudio; B-roll é excluído explicitamente na projeção visual, não tratado como som.

## L. Resolver

Determinístico e sem filesystem/rede/IA. Prefere event → seleção explícita → approval específico → asset específico. Caso o piloto tenha várias reviews aprovadas para hook_sfx/IMPACT, a CLI escolhe o menor approval ID em ordem code-unit e registra qual usou. Required sem approval em STRICT_RENDER falha; optional sem resolução vira OMITTED_OPTIONAL. PLAN_ONLY guarda pendência sem exigir mix. Seleção fornecida mas incompatível/rejeitada falha mesmo se optional.

## M. Timing

Áudio real por beat é medido pelo provider atual; durações editoriais são ajustadas à grade de 30 fps, e âncoras da Fase 9 são resolvidas novamente. hook_sfx ficou no frame 74, 2.466667 s. **ESTIMATED** continua ESTIMATED: não é word boundary real nem detecção de transiente. Nenhum timing novo foi implementado no edge-tts/captions.

## N. Source windows

FULL_SOURCE é a política explícita na ausência de override. No piloto: sourceIn=0, sourceOut=2.045208 s. Overrides ficam EXPLICIT. Exige valores finitos, 0≤in<out≤metadata duration, janela audível no decode e cue inteira dentro da timeline. O mixer converte os limites a amostras de 48k e checa novamente a extensão decodificada. Não há clamp ou trim silencioso; MP3 com padding pode exigir janela explícita menor.

## O. Gain

Faixa −30 a 0 dB, sem ganho positivo. Default −24 dB é atenuação conservadora do arquivo, não alvo de dBFS nem garantia de relação perceptiva com a fala. É documentado como ponto inicial para proteger a narração; intensity editorial não vira automaticamente ganho. Voz não recebe normalização/ganho no somador. Mudanças de ganho precisam ser explícitas no plano.

## P. Fades

Default de 5 ms entrada/20 ms saída; valores finitos/não negativos e soma sem sobrepor/ultrapassar a janela. Rampas lineares entram antes da soma. Cues curtas incompatíveis exigem override explícito, não ajuste oculto.

## Q. Loudness

Medições reais de peak/RMS/ebur128 LUFS/true peak para voice, stem SFX, mix e master. Voz: -20.4 LUFS; SFX pós-ganho/ducking: -40.3 LUFS; mix: -20.4 LUFS; master AAC: -20.4 LUFS. Peak master 0.499675, true peak -6 dBFS. Sem perseguir alvo de masterização automática ou mascarar clipping com limiter.

## R. Ducking

Somente SFX é atenuado. Envelope determinístico sobre blocos RMS estéreo de 20 ms da voz, threshold −45 dBFS, amount=6 dB, attack=30 ms, release=150 ms. Valores constam no plano; enabled pode ser false explicitamente. Sem ML. Fala continua stem dominante; métricas não substituem escuta de inteligibilidade.

## S. Mixer

Decoder FFmpeg já instalado → PCM float32 48k/stereo → somador float64 → WAV float32, com trim, gain, fades e ducking por cue. Mixer não resolve aprovação nem escolhe timbre. Valida fontes, approvals, hash, formato, timeline, finitude, silêncio, duração e peak. Sample peak >0,98 falha sem limiter; true peak medido >0 dBFS também falha. Stem vazio é permitido apenas quando não há cues intencionalmente. Narração é padronizada à grade por padding de cauda explícito, não por mudança do provider.

## T. Cache/fingerprint

Mixer sound-mixer/1.0.0; fingerprint `b51186348bda8f70f5b5a65d88c415e5a63e1fe62298fca0d105d952c28092a2`. Inclui voice hash, source hashes/IDs relevantes, plano com janelas/ganho/fades/ducking/timing/approvalRef, formato e política numérica/versão. Exclui roots absolutos, mtime e nome da máquina. Cache verifica approvals e fontes atuais antes de aceitar hit, hash dos derivados mix/stem e decode/QA do mix. Repeat HIT=True, mesmo fingerprint=True. Integração verifica invalidadores de ganho e recuperação de cache corrompido. Não há lock concorrente nem promessa bitwise entre versões FFmpeg/CPUs.

## U. Audio QA

Hash/existência/metadata dos oito em pack-validation; validade de approval/role/context/source-window/timing no resolver e mixer; PCM finito, audível e dentro da duração; 48k/stereo; peaks/RMS/LUFS; verificação A/V do master. Cache guarda hashes dos derivados e métricas por stem. Testes com ondas sintéticas cobrem silêncio/NaN/clipping/curto/ausente e contexto inválido. Não se mede beleza ou qualidade criativa automaticamente.

## V. Pack validation

check:sound:pack separado: 8/8 PASS, native metadata confirmada por ffprobe, decode completo para memória, hashes/tamanhos conferidos e originais mantidos. Não revarreu o pack; não instalou fontes/plugins, não abriu outros sons/músicas e não copiou originais para produção. Integridade alegada é dos oito selecionados e ausência de operações de escrita sobre o pack, não hash integral dos 5,69 GB.

## W. Human approvals

Aprovação real recebida nesta conversa: **“Aprovo SFX_IMPACT_001 para esse contexto”**. Registrada para IMPACT / hook_sfx com ID HUMAN_hook_sfx_IMPACT_001, reviewer current-user e hash 9a59e9b3dfee99ca8fac94b626a5c3b6eb8fb809000437022674154ad4a6bb0f. Não foi inferida do silêncio ou dos testes. Os outros sete sons continuam sem aprovação de uso. Registros HUMAN sintéticos usados em memória nos testes referem-se somente a waveforms controladas, nunca aos arquivos do pack.

## X. Pilot

Piloto do frio: porta/frio; Snag, Canadá; sessenta e três graus negativos. Três beats com áudio real edge-tts. B-roll permanece explicitamente excluído. Um IMPACT real aprovado pontua “tão brutal”. O ganho/ducking conservador resulta em efeito discreto; a aprovação do candidato/contexto não é uma avaliação automática da mix final.

## Y. Render

Master real produzido após aprovação, com Engine3D/Remotion e captions atuais. Preservados voice-only.mp4 e sound-design.mp4 para comparação. Visual é o mesmo stream H.264 copiado na mux final; AAC vem do WAV mixado. Arquivos e hashes em master-files.json. Frame 2,5 s foi extraído e inspecionado: personagem/porta e caption “é tão brutal” visíveis.

## Z. Master verification

ffprobe: H.264/AAC, 480×854, 30/1 fps, 377 frames, timeline 12.566667 s, áudio 48k/stereo. Diferença das durações dos streams A/V: 0.667 ms, abaixo de um frame + um frame AAC (54,667 ms). O decode AAC mede 12.586667 s e inclui ~20 ms de padding de codec além da timeline; isso foi registrado, sem confundir com a duração do contêiner. QA passou, sem clipping numérico detectado.

## AA. Tests

typecheck PASS. check:engine3d 257 PASS = 223 anteriores + 34 novos testes rápidos de som. check:editorial 46 PASS (subconjunto preservado). check:sound 35 PASS = os mesmos 34 rápidos + 1 integração WAV controlada, sem pack/rede. A integração testa FFmpeg real, formatos, QA, cache HIT/invalidação/corrupção e hash/revogação. check:sound:pack 8/8 PASS. check:sound:render PASS com aprovação real, não SKIP. Sem approval o código escreve SKIPPED/HUMAN_APPROVED missing. Não somar os subconjuntos como testes distintos; 258 testes distintos nessas duas suítes principais. Suítes antigas de render não foram reexecutadas nesta fase.

## AB. Registry counts

Engine3D preservado: 6 Characters, 9 Environments, 14 Props, 10 Actions, 7 Cameras, 3 VFX, 0 Presets = **49**. MediaAssetRegistry possui **8 AUDIO/SFX separados**. engine3d:catalog e teste de contagens continuam PASS.

## AC. Compatibility

Comparação SHA-256 de 47 arquivos preexistentes: apenas package.json alterado para adicionar seis comandos. Engine3D, edge-tts/provider/voice/rate/pitch/cache, captions, src/editorial, CLI antiga, testes/fixtures anteriores e lockfile têm conteúdo preservado. Cache TTS normal permanece em public/audio; é infraestrutura anterior, não cópia de SFX. Derivados de som/master/review ficam em phase10. Nenhuma dependência instalada/atualizada; alterações anteriores do usuário foram preservadas.

## AD. Limitations

Âncoras de palavras continuam estimadas; não há detecção automática de transiente, seleção semântica autônoma, garantia de estética/inteligibilidade ou autenticação de reviewers. No máximo 120 s/arquivos e PCM em memória com limites; piloto é 12,57 s, não vídeo completo de 40–60 s. Ganho/ducking conservadores e sem masterização profissional. Full-window MP3 pode exigir ajuste explícito pela diferença de padding. Segurança de paths não elimina TOCTOU externo. Cache sem lock concorrente/certificação cross-machine. Licença permanece declarada, sem certificação independente. Nenhuma mídia visual externa/música/provedor foi integrada.

## AE. Next recommendation

Encerrar a Fase 10. Revisar auditivamente voice-only versus sound-design e o timing/balanço do efeito antes de qualquer expansão. Próxima fase só mediante novo pedido; não foram implementados overlays, light leaks, transições visuais, música, B-roll, Higgsfield, registry para o pack inteiro ou vídeo de 40–60 s.
