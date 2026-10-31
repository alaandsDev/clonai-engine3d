import json,re,hashlib,collections
from pathlib import Path
R=Path('out/engine3d/script-mode/roteiro-panela-product-pass')
def get(n):return json.loads((R/n).read_text('utf-8-sig'))
def save(n,x):(R/n).write_text(json.dumps(x,ensure_ascii=False,indent=2),'utf-8')
def table(h,rows):return '\n'.join(['| '+' | '.join(h)+' |','| '+' | '.join(['---']*len(h))+' |']+['| '+' | '.join(str(x).replace('|','/') for x in row)+' |' for row in rows])
b=get('baseline/summary.json');a=get('audio-after.json');m=get('direction-metrics.json');integrity=get('integrity.json');s=get('product-summary.json');qa=get('qa.json');p=get('visual-plan.json');seq=get('directed-sequence.json');tracks=get('tracks.json');inp=get('planner-input.json');u=get('semantic-claims.json');ledger=get('render-ledger.json')
assert len(ledger)==3 and all(r['status']=='RENDERED' for r in ledger) and s['media']['passed'] and 45<=a['videoDuration']<=60 and not integrity['changed'] and integrity['scriptShaBefore']==integrity['scriptShaAfter'] and m['understandingIdentical'] and m['continuityPassed']
assert 'fail 0' in Path('out/product-relevant-final.log').read_text('utf-8-sig') and 'tests 199' in Path('out/product-relevant-final.log').read_text('utf-8-sig')
assert 'fail 0' in Path('out/product-regression-final.log').read_text('utf-8-sig')
rawQuiet=b['boundarySilence']+b['systemPadding'];newQuiet=a['boundarySilence']+a['systemPadding'];sha=s['media']['sha256']
review={'productPass':'COMPLETE','visualQuality':'GOOD','postableCertified':False,'pinReadability':'GOOD','steamReadability':'GOOD','cameraMotivation':'GOOD','cameraRepetition':'ACCEPTABLE','presenterHierarchy':'GOOD','mechanismFocus':'GOOD','withoutAudio':'YES for the principal physical sequence; not the full pressure/temperature explanation','shortFormFeel':'YES','focusOccupancy':'GOOD for mechanism and closeups','backgroundWaste':'ACCEPTABLE; forest/stylized context remains','presenterCompetition':'GOOD; presenter absent in 22 mechanism beats','componentReadability':'GOOD; distinct moving stem and stationary control','floatingAttachedComponents':0,'narrationSingleSession':'PARTIAL','auditoryReview':'User heard continuous +0% excerpt and called it almost perfect but fast. Final -3% synthesis follows that feedback; no confirmed human listening of the final -3% master. This agent has no audio-input capability and does not claim to have listened.','biggestRemainingVisibleDefect':'Steam is still visibly a stack of translucent primitive spheres','nextAction':'Listen to the complete final master to close the cadence assessment','fullResolutionFramesReviewed':[990,1107,1434,1577],'scope':'Manual contact/event/full-resolution frame review plus deterministic evaluation, not a pixel-perfect or human-motion quality certification'}
save('manual-review.json',review);s.update({'productPass':'COMPLETE','review':review,'report':'PRODUCT_PASS_REPORT.md','tests':{'focusedSubset':45,'productSpecific':10,'finalRelevant':199,'earlierRootSuite':1119,'allPassed':True},'git':'UNCOMMITTED','commit':False,'push':False});save('product-summary.json',s)
# Full after-timeline: speech windows, semantic spans, beats, shots, captions and cameras remain separate.
timeline=[]
for kind,items in [('script_segment',inp['timing']),('semantic_beat',u['segments']),('semantic_claim',u['claims']),('visual_beat',p['beats']),('shot',seq['shots']),('caption',seq['captions']),('TTS_clip',tracks),('camera_transition',seq['cameraSegments'])]:
 for item in items:
  sid=item.get('sentenceId') or item.get('segmentId') or (item.get('id') if kind in ['semantic_beat'] else None);win=next((x for x in inp['timing'] if x['sentenceId']==sid),None);start=item.get('startFrame',win['startFrame'] if win else 0);end=item.get('endFrame',win['endFrame'] if win else start);tr=next((x for x in tracks if x['sentenceId']==sid),None)
  if kind=='TTS_clip':end=start+tr['pacing']['durationSeconds']*seq['fps']
  speech=[t for t in tracks if any(w['sentenceId']==t['sentenceId'] and w['startFrame']<end and start<w['endFrame'] for w in inp['timing'])]
  timeline.append({'kind':kind,'id':item.get('id',sid),'start':start/seq['fps'],'end':end/seq['fps'],'duration':(end-start)/seq['fps'],'sentences':[t['text'] for t in speech],'sentenceIds':[t['sentenceId'] for t in speech],'speechDuration':sum(t['pacing']['durationSeconds'] for t in speech),'padding':(end-start)/seq['fps']-tr['pacing']['durationSeconds'] if kind=='script_segment' and tr else 0,'pauseKind':tr['pacing']['pauseKind'] if tr else None,'minimumDurationApplied':'12 frame draft partition inside existing window; not additive' if kind=='visual_beat' else '1 frame caption validity, proportional partition; not additive' if kind=='caption' else 'No additive minimum','transitionDuration':(end-start)/seq['fps'] if kind=='camera_transition' else 1/seq['fps'] if kind=='shot' and item.get('transition')=='CUT' else 0})
save('timeline-after.json',timeline)
text=f'''# PRODUCT PASS — Short-form pacing + cinematic direction

**PRODUCT PASS: COMPLETE — metas técnicas e visuais desta rodada.** Qualidade visual **GOOD**, não certificada como POSTABLE. A pergunta sobre uma narração gravada em sessão única permanece **PARTIAL**, com a ressalva auditiva abaixo.

## Resultado

Mesmo `roteiro-panela.txt`, 180 palavras, 20 segmentos. **77,00 → 59,10 s**, sem cortar fatos ou palavras. O ideal 50–58 s foi preterido por uma cadência um pouco mais calma após feedback do usuário; o alvo obrigatório 45–60 s passa.

MP4: `{(R/'video.mp4').resolve().as_posix()}`

SHA256: `{sha}`

H.264, 480×854, 30 fps, 1773 frames; AAC 48 kHz estéreo. Decode completo, A/V e audio QA PASS. Três renders completos, versões preservadas em attempts/01–03. Não foi feito um quarto render.

## Imutabilidade e escopo

SCRIPT SHA BEFORE: `{integrity['scriptShaBefore']}`  
SCRIPT SHA AFTER: `{integrity['scriptShaAfter']}`  
SCRIPT UNCHANGED: **YES**. UNDERSTANDING CHANGED: **NO**, inclusive JSON semantic-claims idêntico ao baseline. Coverage 95%, 8 segmentos DIRECT, 0 gaps, sem promover cobertura.

Research, Evidence, StoryNeed, Retrieval, parser, understand.ts, lexicon, pronomes e verbos: **NONE**. Os **{integrity['protectedFiles']} arquivos protegidos** (incluindo históricos Phase27/27B/28/28B/29, o vídeo anterior e Research/understanding) mantêm seus hashes. Não foram adicionados domínio, roteiro, LLM, modelo, SaaS, backend, dependência, lipsync, música, SFX ou UI. Catálogo consultado: recursos/assemblies existentes reutilizados, sem novo ID de recurso.

## Auditoria dos 77 segundos, antes de implementar

O baseline tem 20 clipes. A soma do PCM decodificado é **71,52 s**; os windows totalizam 77,00 s. A diferença **5,48 s** é padding/quantização do sistema: 19 pausas de 8 frames (5,067 s) mais arredondamento dos clipes. Não havia mínimo de 4–5 s por frase. O mínimo de 12 frames por draft visual divide o window de fala, não aumenta sua duração. Captions também repartem o window, com guard de validade de um frame; não adicionam padding. Transições ocupam a mesma timeline.

Além do padding, os próprios clipes contêm **20,67 s** de silêncio nas bordas. A soma de conteúdo entre as bordas silenciosas é **50,85 s**, incluindo suas pausas internas. Portanto, o problema não exigia acelerar a voz.

Diagnóstico linha a linha: `baseline/timeline.json` registra script segment, semantic beat, visual beat, shot, caption, TTS clip e camera transition, com start/end/duration, frases associadas, fala, mínimos, padding e duração de transição. `baseline/audio-clips.json` contém os 20 clipes. `timeline-after.json` mantém essas camadas separadas e também inclui semantic claims.

## Áudio — BEFORE vs AFTER

'''+table(['Métrica','BEFORE','AFTER'],[
['TOTAL VIDEO DURATION',f"{b['videoDuration']:.3f}s",f"{a['videoDuration']:.3f}s"],
['RAW TTS CONTENT DURATION',f"{b['rawTtsContentDuration']:.3f}s",f"{a['rawTtsContentDuration']:.3f}s"],
['Conteúdo entre bordas quietas, com pausas internas',f"{b['rawSpeechDurationExcludingBoundarySilence']:.3f}s",f"{a['rawSpeechDurationExcludingBoundarySilence']:.3f}s"],
['Trimmed clips duration','Não aplicado',f"{a['trimmedTtsDuration']:.3f}s"],
['TOTAL DETECTED SILENCE',f"{b['totalDetectedSilence']:.3f}s",f"{a['totalDetectedSilence']:.3f}s"],
['SEGMENT_BOUNDARY_SILENCE',f"{b['boundarySilence']:.3f}s",f"{a['boundarySilence']:.3f}s"],
['NATURAL_SPEECH_PAUSE — quiet interno',f"{b['naturalSpeechPause']:.3f}s",f"{a['naturalSpeechPause']:.3f}s"],
['SYSTEM_PADDING',f"{b['systemPadding']:.3f}s",f"{a['systemPadding']:.3f}s"],
['NON-SPEECH PADDING — bordas + sistema',f"{rawQuiet:.3f}s",f"{newQuiet:.3f}s"],
['SPEECH OCCUPANCY',f"{b['speechOccupancy']:.2f}%",f"{a['speechOccupancy']:.2f}%"],
['MEAN INTER-SEGMENT PAUSE',f"{b['meanInterSegmentPause']:.3f}s",f"{a['meanInterSegmentPause']:.3f}s"],
['MEDIAN INTER-SEGMENT PAUSE',f"{b['medianInterSegmentPause']:.3f}s",f"{a['medianInterSegmentPause']:.3f}s"],
['MAX INTER-SEGMENT PAUSE',f"{b['maxInterSegmentPause']:.3f}s",f"{a['maxInterSegmentPause']:.3f}s"],
['INITIAL SILENCE',f"{b['initialSilence']:.3f}s",f"{a['initialSilence']:.3f}s"],
['FINAL SILENCE',f"{b['finalSilence']:.3f}s",f"{a['finalSilence']:.3f}s"],
['VOICE RATE','+0%','−3% na síntese; nenhum atempo/time stretch']])+f'''

Medição de quiet acústico: RMS em 10 ms, abaixo de −45 dBFS, duração mínima 60 ms. Não é alinhamento de fonemas nem reconhecimento de respiração. Pequenas diferenças de soma vêm das janelas de análise, AAC e arredondamento. RAW TTS CONTENT inclui silêncio técnico: seu valor acima de 60 s não significa mais de 60 s de fala natural. Aumento de conteúdo entre bordas na versão final vem da voz ligeiramente mais lenta, sem remoção de palavras.

## Trim e pausas automáticos, para futuros roteiros

O Script Mode agora executa automaticamente TTS → boundary trim → controlled pause → narration windows → visual synchronization → mix. `src/engine3d/audio/pacing.ts` conserva 90 ms de margem nas bordas e não remove nada entre a primeira e a última atividade detectada. Os WAVs ficam em cache separado; MP3s TTS originais são preservados. Clipes silenciosos falham antes do render.

Pausas acústicas desejadas calibradas: NORMAL_CONTINUATION 220 ms, SHORT_PAUSE 290 ms, PARAGRAPH_PAUSE 420 ms, DRAMATIC_PAUSE 600 ms. Os guards retidos e o arredondamento são descontados antes de inserir a pausa: não somar trailing + leading + padding cegamente. A seleção usa parágrafo e ações/participantes já extraídos; não adiciona entendimento. Pontuação e pausas internas permanecem. A taxa −3% foi aplicada à síntese após feedback; o default de outros modos continua +0%.

Cada um dos 20 segmentos entra **uma vez**, na mesma ordem, sem overlap. A timeline inteira (ações, captions e câmeras) foi recompilada das durações medidas. Não houve multiplicação global de timestamps por 0,7 nem aceleração cega de animações.

## Revisão auditiva — limite e correção da amostra

A primeira amostra de auditoria foi mal montada: concatenou excertos sobrepostos e produziu repetição/cortes no próprio montage. Ela não representava o mix integral. O usuário identificou isso; a amostra foi substituída por trecho contínuo sem recortes. O usuário chamou a segunda amostra de quase perfeita, mas rápida. A síntese final foi reduzida para −3%, e o master possui 59,10 s.

**Pareceria narração contínua gravada em uma única sessão? PARTIAL.** Há feedback humano sobre a amostra contínua anterior, mas não foi recebida confirmação auditiva do master final −3%. Este agente não dispõe de entrada de áudio e não afirma ter escutado a versão final. A inspeção acústica confirma ausência de overlap/duplicação de clipes e preservação do conteúdo interno; não substitui percepção humana da prosódia. `narration-final.wav` é o áudio do MP4 final; `continuous-audition.wav` é um excerto contínuo. A antiga boundary-audition.wav é somente diagnóstico inválido, não áudio final.

## Continuidade e parent-child

`parentId` no contrato de mundo/programa define transform local. O evaluator compõe **parent × local** e entrega poses mundiais a render, câmera e QA. Movimento do pai não exige MOVE duplicado no filho. Parentes ausentes e ciclos falham explicitamente. Há testes de translação, rotação, escala, hierarquia e visibilidade.

Os controles do closure são anexados a ele pela composição de assembly já existente. O emissor usa o participante da ação de escape já identificado, em vez do primeiro objeto encontrado. Movimento vertical próprio do stem continua local, com curso de staging limitado pela dimensão do componente. STEM e CONTROL usam proporções/silhuetas distintas. Apoios genéricos do queimador conectam visualmente base e recipiente; foram mantidos os budgets, reduzindo a quantidade de pequenos meshes de chama, sem aumentar limites.

ATTACHED COMPONENTS: **{m['attachedComponents']}**, mais **{m['attachedEmitters']} emissor**. Parent-child discontinuities **0**. Foram comparadas matrizes esperadas e observadas em **{m['framesChecked']} frames**, com erro máximo zero neste vídeo. Floating attached components: **0**, também conferido nos frames de fechamento, movimento do stem e abertura.

## Direção visual e métricas

'''+table(['Métrica','AFTER'],[
['SHOTS',m['shots']],['HARD CUTS',m['hardCuts']],['CONTINUOUS CAMERA TRANSITIONS',m['continuousCameraTransitions']],['COMPONENT CLOSEUPS',m['componentCloseups']],['ACTION FOLLOWS',m['actionFollows']],['CUTAWAYS — beats em section view existente',m['cutaways']],['PRESENTER VISIBLE BEATS',m['presenterVisibleBeats']],['MECHANISM ONLY BEATS',m['mechanismOnlyBeats']],['MEAN SHOT DURATION',f"{m['meanShotDuration']:.3f}s"],['MEDIAN SHOT DURATION',f"{m['medianShotDuration']:.3f}s"],['LONGEST SHOT',f"{m['longestShot']:.3f}s"],['LONGEST MEANINGFUL STASIS',f"{qa['longestMeaningfulStasisSeconds']:.3f}s"]])+f'''

20 frases/clipes e 25 beats não obrigam 25 shots: a sequência agora tem cinco planos que podem conter vários beats/frases. O shot mais longo contém câmera/ações contínuas, não 18,5 s de imagem estática. Os 34 segmentos contínuos incluem reframes e pushes discretos, não 34 cortes. Closeups seguem foco/ação/região, e FOLLOW reutiliza o executor existente. Movimentos físicos demasiado rápidos para follow seguro recebem um enquadramento mais amplo da ação completa, sem câmera violenta. Nenhuma órbita infinita.

Presenter aparece na abertura e no payoff; fica ausente dos 22 beats de mecanismo. A câmera aproxima o componente mencionado. O efeito de gás usa seu emissor como contexto e reserva a parte inferior para captions. Os três CUTAWAY beats são tomadas da seção já existente no assembly, não três novas aberturas animadas do objeto. A pressão não foi materializada como objeto móvel.

## Antes/depois visual e inspeção

CURRENT 77,0 s → PRODUCT PASS 59,1 s. CURRENT cortes: briefing informa 9; o directed-sequence baseline declara 2 CUTs e 25 blocos de shot. A divergência foi registrada, sem alterar o histórico nem tratar definições diferentes como uma medição idêntica. PRODUCT PASS: 4 CUTs declarados, 5 shots contínuos.

CURRENT floating lid children: YES informado no briefing; código mantinha trackers independentes. PRODUCT PASS: **NO**, transform local comprovado e conferido visualmente. Câmera repetitiva: **PARTIAL/ACCEPTABLE** agora; repetição do close do stem acompanha o ciclo narrado, sem voltar ao mesmo medium entre cada frase. Presenter competition: **GOOD/ausente durante mecanismo**.

Inspecionados contact sheet, event sheet e frames 480×854 de stem, saída de gás, chama desligando e closure em movimento. FOCUS_OCCUPANCY GOOD; BACKGROUND_WASTE ACCEPTABLE; PRESENTER_COMPETITION GOOD; COMPONENT_READABILITY GOOD. As avaliações são manuais/estimadas e não percentuais de pixels inventados. QA estrutural final: {', '.join(k+'='+v for k,v in qa['dims'].items())}.

## Três renders, sem exceder o limite

1. 56,10 s, voz +0%: confirmou closeups/parenting e revelou emissor incorreto, contraste do efeito e falta de apoios visuais no queimador.
2. 59,10 s, voz −3%: corrigiu essas questões e respondeu ao feedback de cadência; revelou caption cobrindo o emissor.
3. 59,10 s: enquadrou o gás com o emissor acima da região de captions, sem mudar áudio, roteiro ou entendimento. **Final selecionado; parar após este render.**

O silêncio/câmera foram diagnosticados antes de implementar. Testes sintéticos também expuseram um follow demasiado rápido e fixtures antigas que esperavam trackers independentes; foram corrigidos sem alterar o roteiro/entendimento do benchmark. Nenhuma renderização extra foi usada para esses casos sintéticos.

## Perguntas de sucesso e limites

A. Mais Short e menos slides? **YES** — duração menor, ações sobrepostas à fala, múltiplas frases por plano.

B. Mecanismo protagonista? **YES** — 22/25 beats sem presenter.

C. Câmera mostra o narrado? **YES** para as ações representadas; 95% de coverage preservada, sem alegar 100%.

D. Peças continuam anexadas? **YES** — parenting local e comparação frame a frame.

E. Até 60 s sem mutilar roteiro? **YES** — 59,10 s, SHA e 180 palavras iguais; voz desacelerada, não acelerada.

F. Sem áudio, sequência física principal compreensível? **YES**, por sequência de eventos/frames e continuidade; isso não garante compreender pressão/temperatura somente pela imagem.

PIN READABILITY GOOD; STEAM READABILITY GOOD; CAMERA MOTIVATION GOOD; CAMERA REPETITION ACCEPTABLE; PRESENTER HIERARCHY GOOD; MECHANISM FOCUS GOOD; SHORT-FORM FEEL YES; VISUAL QUALITY **GOOD**, não POSTABLE certificada.

Maior defeito visível restante: o gás ainda tem aspecto de esferas translúcidas empilhadas. A estética permanece de ilustração/maquete. Próxima ação única: ouvir o master integral para fechar a avaliação da cadência final. Nenhuma nova fase será iniciada nesta entrega.

## Verificação e Git

FOCUSED TESTS: **PASS, 45 casos** (10 Product Pass + 35 Script Mode), incluídos no último conjunto relevante.

REGRESSION: **PASS**, suíte raiz 1119 casos; após o último ajuste de câmera, **199 casos relevantes** passaram (Product Pass, Script Mode, visual causal, motion/directed, demonstration, sound e visual). Há sobreposição entre execuções: não somar as contagens. Typecheck e git diff --check PASS. Testes são offline; o único serviço da geração é o edge-tts existente. A etapa de render/mux não fez chamadas externas em processo.

ANTI-HARDCODE: PASS — {integrity['antiHardcode']['scannedRuntimeFiles']} arquivos src examinados; zero nova condição por panela, pressure cooker, roteiro ou pinOnLid. Novos helpers e linhas alteradas comparados ao backup pré-edição; Research/understanding protegidos por hashes. Não se alega que o código legado não possua vocabulário de objetos.

Base main: `{integrity['base']}`. GIT **UNCOMMITTED**, índice vazio; COMMIT **NO**, PUSH **NO**. Sem reset/clean/stash, alteração de remote, publicação ou mudança de históricos. Artefatos preservados em attempts/01, attempts/02 e attempts/03. O produto usa JSON e o renderer Three/R3F/Remotion existente.
'''
Path('PRODUCT_PASS_REPORT.md').write_text(text,'utf-8');(R/'PRODUCT_PASS_REPORT.md').write_text(text,'utf-8')
print(json.dumps({'productPass':'COMPLETE','duration':a['videoDuration'],'sha256':sha,'renders':len(ledger),'report':'PRODUCT_PASS_REPORT.md','speechOccupancy':a['speechOccupancy'],'nonSpeechPadding':newQuiet,'narrationSingleSession':'PARTIAL','git':'UNCOMMITTED'}))
