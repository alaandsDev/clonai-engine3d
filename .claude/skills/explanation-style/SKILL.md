---
name: explanation-style
description: Style bible and workflow for ClonAI explainer shorts in the "Como funciona / Como se constrói X" reference style (vertical low-poly 3D, one-word captions, failure-then-fix storytelling). Use when writing a script, planning, rendering or reviewing a ClonAI video that should look like the references in references/explanation-style/, or when the user asks for "um vídeo igual / nesse estilo" about a topic (e.g. "como funciona a energia solar").
---

# Explanation style (reference: references/explanation-style/*.mp4)

Mapped from 3 reference videos (muro de arrimo 142.8 s, estádio 140.3 s, casa 168.6 s) by frame study
(one frame every 2 s, 225 frames) and measured pacing. The narration audio was **not** transcribed (no
local speech-to-text); spoken structure is inferred from the burned-in one-word captions and the visuals.

## 1. Format
- Vertical 1080×1920, 30 fps, 2:20–2:50 long, Portuguese (BR) narration, one continuous story per video.
- Measured pace: 16–24 strong visual changes per minute at 2 s sampling → a new picture roughly every
  2.5–3.5 s (lower bound; real cuts/moves are often faster). No shot holds still for more than ~3 s.

## 2. Visual language
- **World:** stylized low-poly 3D with flat/toon shading, saturated colours, bright blue sky with puffy
  clouds, green grass, everyday props (houses with tiled roofs, cars, fences, trees, poles). Friendly,
  toy-like, never photoreal.
- **Host / viewer proxy:** a chunky character (yellow hard hat in the construction videos) who stands,
  points, reacts (surprised, worried) and is at human scale to give size. Crowds of the same rig when a
  place is used by people (stadium).
- **Cutaways are the core device:** the ground, a wall or a structure is sliced open to show hidden layers
  (soil, footing, rebar, drainage, pipes). Inside and outside stay in one continuous space.
- **Invisible things made visible:** water/moisture = blue dot particles; heat/cold = colour tint;
  forces = bold **red arrows** (push, weight, pressure); support/correct direction = **green arrows**;
  flow direction = blue arrow. Particles move along real paths (through gravel, pipes, holes).
- **Labels:** small rounded white "pill" tags with a coloured dot naming a part or state
  ("TERRA FIRME", "SAPATA", "MANTA", "ÁGUA PASSA", "SEM DRENO"), placed next to the thing. Key jargon gets
  a bigger **yellow outlined label** ("SISTEMA DE DRENAGEM", "IMPERMEABILIZAÇÃO", "JUNTA DE DILATAÇÃO").
  Occasional mini-infographic card (CIMENTO + AREIA + ÁGUA) and a green check ✓ for "correct".
- **Time transitions:** ▶▶ (fast-forward) or ◀◀ (rewind) icon top-right with horizontal speed lines
  over the frame, used to jump to "months later" or to rewind after a failure.
- **Captions:** ONE word at a time, centred in the lower-middle of the frame, white bold with dark
  outline, synced to speech; the key technical word of a sentence turns **yellow**. Labels never cover
  the caption band.

## 3. Story structure (failure → fix)
1. **Hook** — a concrete everyday situation or question ("Como uma casa fica de pé?", a slope next to a
   house, a dirt pitch full of holes).
2. **Naive attempt** — someone does the obvious thing (cut the slope, stack bricks on loose soil, play on
   bare earth).
3. **Failure, shown dramatically** — collapse, cracks, crushed car, flooding, mould, twisted ankle. The
   picture shows *why* (red force arrows, water particles, a label naming the cause).
4. **◀◀ Rewind** — back to the start.
5. **The correct method, one step at a time** — each step is built on screen and explicitly answers the
   failure just seen (footing, rebar, concrete, drainage holes, gravel, membrane, gutter…). Each new part
   is introduced with a pill label and its action (arrows/particles).
6. **Repeat the failure check per missing piece** — "sem dreno → …" shows what happens if one step is
   skipped, then the fix.
7. **▶▶ Time passes** — the finished thing works in rain/use over months.
8. **Payoff** — wide shot of the complete result, every part now readable; short closing line.

Rules: every claim has a picture; every new term gets a label; every cause gets an arrow or particles;
the same place and props persist through the whole video (no unrelated stock shots).

## 4. Script template (write this before planning)
```
[HOOK] Pergunta ou situação concreta em 1–2 frases.
[TENTATIVA ÓBVIA] O que alguém faria sem saber.
[FALHA] O que dá errado e POR QUÊ (causa física dita explicitamente).
[VOLTA] "Vamos voltar." / "Então como se faz?"
[PASSO 1..N] Cada passo: o que é + o que faz + que falha ele evita.
[E SE FALTAR?] Uma peça removida → consequência → volta.
[TEMPO PASSA] O resultado funcionando depois de meses/anos.
[PAYOFF] Uma frase que fecha a pergunta do hook.
```
Sentences short (6–14 words), one physical action per sentence, subject + verb + object stated (the
ClonAI parser only demonstrates what is explicitly said: name the part, the material and where it goes).

## 5. Producing it with ClonAI
1. Write the script with the template (the frozen Curiosity Writer V3 may draft facts; keep its facts).
   - Start the failure part with "Imagine que…" / "E se…" / "Suponha que…" and end it with "Vamos voltar." — the engine
     shows what the hypothesis states (marked hypothetical, red labels) and then undoes it with a ◀◀ rewind.
   - Time jumps the engine marks with ▶▶: "meses depois", "com o tempo", "mais tarde", "ao meio-dia", "à noite"…
   - Name each part with an article and keep subject + verb + object explicit ("O X recebe a Y e transforma em Z").
2. `npm run clonai:script -- --script <file>.txt --style explainer --hd`
   (`--style explainer` = one-word captions, key word in yellow, part labels, ◀◀/▶▶ marks; `--hd` = 1080×1920).
   One pass; do not tune the engine to the topic.
3. Review: `tsx tools/reference-sheets.ts <out>/video.mp4 <out>/study 2 8` (1 frame / 2 s sheets) and the summary lines
   `demo QA`, `readability`, `meaningful stasis`. Compare the sheet against sections 2 and 3.

## 6. What the engine can and cannot match today
Can: low-poly toon world, persistent objects, presenter, cutaways, particles along paths, colour state tints, force
arrows, containment class (nested/rotating containers, pass-through openings, pumps), energy-flow class (radiant
source → collector → charge carriers → conductor → converter → distribution/consumers → grid/meter), one-word captions
with highlighted key words, pill/term labels on parts, ◀◀/▶▶ marks, hypothesis → rewind → fix, house exterior with a
neutral neighborhood, 1080×1920 output, demonstration QA gates.
Cannot yet:
- Dramatic failure physics (collapses, crushed cars, cracks) — a hypothesis only shows the states the script names.
- Crowds, vehicles and weather (rain) composed per scene. (Night works: "à noite" fades the light source and the sky,
  fog and lights darken with it.)
- Mini-infographic cards (A + B + C) and check marks.
- Mechanism classes beyond containment and energy flow (levers/gears, chemistry, biology, structures) fall back to
  generic blocks — the demonstration QA flags them.
- Narration audio of the references was never transcribed (no local speech-to-text).
Always state these gaps when promising a video "igual" to the references.

## 7. How energy-flow shots are framed (so a script can rely on it)
- A part's first appearance opens on where it is, with the main object (house), then pushes in to the part.
- Close-ups are centred on the action; the wall/roof the part sits on is cropped around it, while a neighbour (a tree
  giving shade) stays whole.
- A part that moves to a new place is framed with its start and its destination together (the camera does not ride along).
- Light from the sky is framed where it arrives (rays as a beam + particles), so the source itself is often off-frame.
