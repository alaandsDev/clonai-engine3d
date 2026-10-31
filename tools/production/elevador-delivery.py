"""Package the authored script, captions and continuous narration. UTF-8 throughout."""
import json, subprocess, wave, shutil
from pathlib import Path
import numpy as np

root = Path('out/engine3d/production/elevador')
seq = json.loads((root / 'directed-sequence.json').read_text(encoding='utf-8'))
tracks = json.loads((root / 'tracks.json').read_text(encoding='utf-8'))
timing = json.loads((root / 'timing.json').read_text(encoding='utf-8'))
ff = shutil.which('ffmpeg')
if not ff:
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
audio = np.zeros((seq['totalFrames'] * 48000 // seq['fps'], 2), np.float32)
for track, win in zip(tracks, timing):
    assert track['sentenceId'] == win['sentenceId']
    pcm = subprocess.check_output([ff, '-v', 'error', '-i', str(Path('public') / track['relativeAudioPath']), '-ar', '48000', '-ac', '2', '-f', 'f32le', '-'])
    pcm = np.frombuffer(pcm, '<f4').reshape(-1, 2)
    start = win['startFrame'] * 48000 // seq['fps']
    assert len(pcm) <= (win['endFrame'] - win['startFrame']) * 48000 // seq['fps']
    audio[start:start + len(pcm)] = pcm
wav = root / 'narracao.wav'
with wave.open(str(wav), 'wb') as out:
    out.setnchannels(2); out.setsampwidth(2); out.setframerate(48000)
    out.writeframes((np.clip(audio, -1, 1) * 32767).astype('<i2').tobytes())
subprocess.run([ff, '-v', 'error', '-y', '-i', str(wav), '-c:a', 'libmp3lame', '-b:a', '160k', str(root / 'narracao.mp3')], check=True)
def stamp(frame):
    ms = round(frame * 1000 / seq['fps'])
    return f'{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}'
(root / 'legendas.srt').write_text('\n\n'.join(f'{i}\n{stamp(c["startFrame"])} --> {stamp(c["endFrame"])}\n{c["text"]}' for i, c in enumerate(seq['captions'], 1)) + '\n', encoding='utf-8')
(root / 'fontes.md').write_text('''# Fontes do roteiro — elevador

Roteiro original escrito para esta produção a partir de documentação dos fabricantes. O vídeo mostra um esquema didático: dimensões, velocidade e formas das peças não são uma instalação técnica. Nenhuma imagem ou música de terceiros é usada.

- [Nidec / Motion Control Engineering — Landing Systems](https://moen.nidec.com/en/elevators/Motion-Control-Engineering/Products/Components-and-Peripherals/Landing-Systems): LS-PROX combina sensores de proximidade sobre a cabine com encoder no motor ou governador para realimentação da posição. LS-QUTE usa referências magnéticas e sensores na cabine. Fundamenta o exemplo principal e a ressalva de que existem arquiteturas diferentes. Deslocamento e velocidade podem ser acompanhados a partir dos sinais de movimento; isso é uma explicação funcional, sem atribuir um algoritmo específico a todos os modelos.
- [Yaskawa — AC Drives for Lift Applications](https://www.yaskawa.eu.com/lp/Lift%20series/Lift%20series%20Version%203): perfis de aceleração/desaceleração, controle de nivelamento e alinhamento do piso da cabine ao piso do andar. Fundamenta a aproximação e o ajuste final.
- [ELGO — Elevator Industry](https://www.elgo.de/en/applications/elevator-industry/): sensor na cabine lê uma fita magnética no poço para obter a posição absoluta. Fundamenta o exemplo alternativo; não se afirma que todos os elevadores combinam essas duas tecnologias.

## Produção e limites

- A passagem automática pelo Script Mode foi preservada em `automatic/`: cobertura visual original 16,7%, sem alegar aprovação do planejador para este tema.
- Direção editorial explícita em JSON, usando o compilador e as montagens existentes. Não foi criado um segundo Planner, Writer, Knowledge Graph ou renderer.
- Não há EvidencePack inventado, pesquisa live do pipeline ou resultados históricos alterados. Fontes editoriais acima consultadas diretamente para esta produção.
- Aproximação contínua entre frases; sensor e índice presos aos respectivos pais; cabo mantém extremidades; pisos terminam alinhados. Conferidos por avaliação de todos os frames.
- Narração pt-BR-AntonioNeural a -3%, sem acelerar o áudio, recortar sílabas ou remontar trechos. Só o silêncio nas bordas recebe o tratamento existente, com guardas de 90 ms.
- Legendas são estimadas por frase, não alinhamento fonético. A audição subjetiva final continua sendo uma avaliação humana.
- Sem trilha ou SFX: as aprovações anteriores de assets eram restritas a outros contextos. Exportação não publica em nenhuma plataforma.
''', encoding='utf-8')
(root / 'publicacao.txt').write_text('''TÍTULO
Como um elevador sabe exatamente em qual andar parar?

DESCRIÇÃO
Você escolhe o andar. Mas como a cabine chega na altura certa? Entenda como posição, sensores e controle de velocidade se combinam até o nivelamento final.

Animação 3D esquemática. Os sistemas variam entre modelos.

Fontes técnicas:
Nidec / MCE — Landing Systems
https://moen.nidec.com/en/elevators/Motion-Control-Engineering/Products/Components-and-Peripherals/Landing-Systems
Yaskawa — AC Drives for Lift Applications
https://www.yaskawa.eu.com/lp/Lift%20series/Lift%20series%20Version%203
ELGO — Elevator Industry
https://www.elgo.de/en/applications/elevator-industry/

#Curiosidades #ComoFunciona #Elevador #Tecnologia #Shorts
''', encoding='utf-8')
print(json.dumps({'narrationSeconds':len(audio)/48000, 'peak':float(np.max(np.abs(audio))), 'captions':len(seq['captions']), 'audio':'CONTINUOUS_UNEDITED_TIMELINE'}))
