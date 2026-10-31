# PHASE29 REPORT: External Script → Autonomous 3D Video (Script Mode)

Base `3290fb2756013d0dfc9d69f6dbff701634bba31d` · `main` · **UNCOMMITTED**. Phase28, Phase28B and Phase29 are all in the working tree; there was no commit and no push.

## Executive Summary
**Yes: ClonAI received a .txt and returned a video.**
- **One command, no manual JSON, no Research:** `npm run clonai:script -- --script <file.txt>` turns a pasted script into a 480×854, 30 fps H.264/AAC MP4.
- **The pilot works:** the hydraulic-turbine script was materialized as a user `.txt` and went through Script Mode from scratch. The result is `out/engine3d/phase29/final/phase29-script-mode-final.mp4`: 48.77 s, SHA-256 `fb9e6334…f6a1`, 100% script coverage, 0 factual additions and a longest meaningful stasis of 6.83 s.
- **A second domain works:** a bicycle script, with no code change, produced a valid 14.9 s MP4.

**Technical status: COMPLETE (S1–S30 PASS).**
**Product quality: ACCEPTABLE, not POSTABLE.** The visuals **demonstrate** the script: water runs from a high reservoir down a penstock into a turbine whose rotor spins, then to a lower basin whose level rises. It still looks like a toy diorama, has no sound design, and the second-domain visuals are abstract blocks.

## Product Goal
The pipeline is UserScript → Understanding → Direction → Video. The user's script is the editorial source (`USER_SCRIPT`). Its explicit statements may drive factual visuals; the system adds no technical facts.

## Starting State
`main` at HEAD `3290fb27…` (verified before any change). The working tree was DIRTY with Phase28 and Phase28B, as expected. None of their files were reset or rewritten: integrity confirms all 146 Phase28B preservation hashes are unchanged, and every `src/research/*` and `src/writer/*` file has an mtime earlier than the first Phase29 file. I read CLONAI_HANDOFF and the PHASE27, 27B, 28 and 28B reports, then audited the code.

## Architecture Audit
| Component | Finding | Decision |
|---|---|---|
| Semantic Claim Engine (`src/semantics`) | pt-BR, closed noun vocabulary (water, car, temperature). It found no turbine, rotor or vanes in the pilot. | Audited and kept unchanged; it is not suited to an open-vocabulary script. |
| Mechanism parser (`src/research/mechanism-parser.ts`, Phase28B) and `mechanismRules` | Pure, deterministic, open vocabulary; it extracted the pilot's route relations with exact qualified spans. | **Reused as a library** (no change; no web/research modules imported). |
| VisualCausalPlanner / PlannerInput | Well and elevator templates only, but PlannerInput is the one point where any story becomes a plan. | **Convergence point**: Script Mode builds the same PlannerInput. |
| CausalVisualBeat, PersistentWorld, VisualProof, compile → DirectedSequence, QA, verify | Generic contracts. | Reused, with small generic extensions (below). |
| Engine3D / Remotion / media (edge-tts, captions, mux, validation) | Working render path. | Reused unchanged. |

## Reuse Before Create
**Reused:**
- the mechanism parser and lexicon; the PlannerInput, plan, beat, world, proof, compile, QA and verify contracts;
- `renderMp4`, `validateMp4`, `synthesize` (edge-tts and its cache), captions, contact sheets;
- the existing assemblies (OPEN_BASIN, PIPE, PANEL, DISPLAY_BLOCK);
- the CHAR_CAIO_001 presenter and the ENV_FOREST_001 environment.

**Created:**
- `src/script-mode/` with 7 files: contracts, ingest, lexicon, understand, input, report, generate;
- `src/visual-causal/script-world.ts`, a generic MECHANISM_STAGE world plus beats;
- three generic assemblies: ROTOR, VANE_RING, RAISED_GROUND;
- `cli/script-mode.ts`, the `clonai:script` and `check:script-mode` npm scripts, and `tools/phase29/`.

No new registry resources (registry stays Engine3D 50 / SFX 8 / VISUAL 5), no dependency, no LLM, no SaaS.

## Script Mode Architecture
`script.txt → ingest (normalize whitespace only, fingerprint) → segments → discourse roles → claims (mechanism parser first; script clause grammar completes or adds) → entity inventory (persistence) → visual actions → plannerInputFromScript → planVisualCausal (dispatches to planScriptWorld) → validateVisualPlan → compileVisualPlan → DirectedSequence → edge-tts → captions → Remotion → MP4 + artifacts`.

Mode A (Script) and Mode B (Autonomous) **converge at `PlannerInput`**:
- Evidence-backed relations carry `evidenceIds`.
- Script-backed relations carry `source:'USER_SCRIPT'`, `scriptSpans` and `evidenceIds:[]`.

There is no third graph and no fake Evidence.

## Trust Boundary
Status classes:
- **SCRIPT_ASSERTED:** a script assertion; it may drive a factual visual.
- **QUESTION/HYPOTHETICAL:** never a fact.
- **NEGATED:** never shown as an affirmative event.
- **UNSUPPORTED_EXTENSION:** refused by `refuseUnsupported`, which requires every cited span to be literal script text from an assertion.

Two kinds of inference are tagged separately:
- **System-inferred links** (a cue word like "rotação" linked to the rotor named elsewhere) are capped at SYMBOLIC.
- **Visual/editorial inference** (camera, layout, terrain step, colours, presenter) never carries a relation or proof; the validator enforces this.

## Script Ingestion
- **Input:** a `.txt` or `.md` file, or `--script-text`.
- **Normalization:** BOM, CRLF, tabs and NBSP, repeated spaces, line trims and blank lines only, each recorded. No words are rewritten.
- **Copies kept:** the exact input in `final/script.txt` (byte-identical to the input) and the normalized text in `script-normalized.txt`.
- **Segmentation:** sentences with exact UTF-16 offsets; decimals are not split.

## Script Provenance
`script-provenance.json` follows each claim through this chain: script span (subject, trigger, arguments, offsets, `verified:true`) → claim → segment → visual beats (proof) → demonstration steps → shots. `webProvenance: null`, `evidence: []`. All factual beats have script spans.

## Semantic Understanding
For each clause it extracts: subject, predicate, object, source, path, destination, state; modality (asserted, conditional or negated); and subject resolution (explicit, ellipsis, or relative-pronoun antecedent, e.g. "o motor gira a engrenagem, **que** abre a comporta"). A long sentence becomes several clauses or beats.

## Questions vs Assertions
- "Você consegue acompanhar…?" → QUESTION/HOOK (editorial).
- "E se removêssemos a válvula?" and "Então seria só abrir a válvula?" → HYPOTHESIS; their claims are QUESTION status.
- "Então o líquido escaparia" → SCRIPT_ASSERTED with modality CONDITIONAL. It is named, never shown as a real state change.

## Problems/Causes/Solutions
These are detected only from script wording: PROBLEM ("problema", "porém"), CAUSE ("porque", "isso acontece"), SOLUTION ("para resolver"), STATE_CHANGE ("agora", "passa a", "instalado"), GOAL, ATTEMPT, RESULT. The progressive format is used when present and not required (HOOK → EXPLANATION → RESULT works). Tested with an explicit problem → cause → solution → state-change script.

## State Changes
STATE claims ("está fechada", "permanece fechada", "is closed") become an initial pose, shown DIRECT via an `observed: INITIAL_STATE` operation. OPEN/CLOSE become a ROTATE of the gate. Rotation is a sustained ROTATE until the end. Fill level only increases. The validator checks monotonic state and inverse operations.

## Entity Inventory
Roles: SYSTEM, ROTATING, VANES, GATE, CONDUIT, CONTAINER, FLUID, ABSTRACT, ACTOR, BODY.

**How roles are assigned:**
- From syntactic slot: a path argument is a conduit; the source or destination of a fluid move is a container.
- From generic cue tables.
- From what the script says happens: whatever an asserted clause says rotates is ROTATING.

**Main subject:** the most frequent concrete head, with definitions weighted ("turbina"). No topic input is needed.

**Pilot result:** 9 entities, 7 visual entities; water and energy are not objects.

## Entity Persistence
Mentions merge across sentences when they share a head and a role class without a level conflict (HIGH vs LOW) or a stage conflict (upstream vs downstream). In the pilot:
- "reservatório ou canal inferior" and "canal de nível mais baixo" are one entity.
- "duto, o tubo de sucção" (downstream) and "duto fechado" (upstream) stay two entities.

## Visual Story Graph
No new graph is created. The ordered segments, claims, entities and actions form the Script Mode understanding, which feeds the existing VisualCausalPlan beat structure.

## VisualCausalPlanner
`planVisualCausal` dispatches to `planScriptWorld` when the input carries `scriptUnderstanding`; otherwise the Phase27/28 path is untouched. Replay proves the Phase27B final plan and sequence and the three Phase28B plans rebuild bit-identically.

## PersistentWorld
A MECHANISM_STAGE world is built from the inventory: stations in route order (source containers → upstream conduits → machine → downstream conduits → destination containers), with conduits linking adjacent stations. A conduit leaving an elevated container runs down the outside of its support. Camera zones are computed from the layout. The world is built once and persists.

## Asset Resolution
The lookup order is registry → existing assembly → new generic assembly. The mapping:
- container → OPEN_BASIN;
- conduit → PIPE;
- gate → PANEL;
- other bodies → DISPLAY_BLOCK;
- a system with vanes or a rotor → VANE_RING plus ROTOR;
- an elevated source → RAISED_GROUND (editorial).

New assemblies are generic, frame-deterministic, and validated against their primitive kind. There is no `renderTurbine()` or other topic renderer.

## Actions
FLOW, ARRIVE (fill increase), DEPART (focus), SPIN (sustained ROTATE), OPEN/CLOSE (ROTATE), SET_STATE (initial pose), MOVE (translate), IDENTIFY (label + highlight), HIGHLIGHT_CAUSE, NAME_ONLY (gap). Each action is mapped to existing Operation values.

## Physical Demonstration
In the pilot, water fills and flows through both ducts with moving markers, the rotor spins continuously, the low basin's level rises twice, and the height difference is physical. Proof counts: DIRECT 5 · PARTIAL 1 · SYMBOLIC 3 · NONE 0. No visualizable claim is reduced to a label only.

## Presenter
Caio (CHAR_CAIO_001) is reused: he enters, observes, points at the system, observes on the identity beat, leaves focus during the mechanism, and returns for the payoff. He stands beside the system, not between the camera and it.

## Camera
WORLD → SYSTEM → ACTION/RESULT/COMPONENT → WORLD. Script-world framing extensions:
- a path is framed with the things at its two ends;
- the subject sits in the upper-middle, from a slightly raised viewpoint;
- a repeated focus gets an alternate angle.

These are gated to MECHANISM_STAGE, so legacy plans are unchanged. The pilot has 15 shots and 9 cuts.

## DirectedSequence
The existing contract and validators are used. Two generic BeatOperation flags were added:
- `sustain`: the step runs to the end of the video;
- `observed`: a later beat shows motion already running or the initial state, with no new step. The validator requires a basis for it (`OBSERVED_WITHOUT_BASIS`).

## TTS
Existing edge-tts `pt-BR-AntonioNeural`, one track per sentence, cached by hash; numbers use the existing `spokenText`. It is the only external service (a Python subprocess). The pilot's 5 sentences were synthesized once, in the first run of attempt 1; every later attempt hit the cache.

## Captions
The existing lower-third dark pill with short chunks; one top label on identity beats.

## Audio
Narration only. There is no approved water SFX and no music dependency, so silence was chosen over wrong sound. Audio QA passes.

## First Render
Attempt 1's first run crashed before the MP4 (the network guard blocked Remotion's local port probe), and was fixed generically. Its re-run produced a 48.77 s MP4 with **all automated QA PASS**, yet its frames were the weakest: the inlet duct was hidden in the hill, Caio was cut off, and many shots were the same.

## Visual Review
See `out/engine3d/phase29/final/visual-review.md`. The ratings are GOOD on fidelity, world, system readability, physical demonstration, ground contact and captions, and ACCEPTABLE on the rest.
- TikTok feel: **PARTIAL**.
- Without audio: **PARTIAL**.
- Visuals: **DEMONSTRATE**.

## Attempt 1
`2834f292…`: the inlet flow was invisible (duct inside the hill), Caio was cut off in the SYSTEM shot, and the hill wall dominated frames. Fixes: visible penstock routing, presenter placement and framing, path-with-ends framing, alternate angle.

## Attempt 2
`02190632…`: the flow was visible, but the ACTION shots were about one-third empty sky and some basin shots were identical. Fixes: raised viewpoint with the subject upper-middle, and an alternating azimuth for a repeated focus.

## Attempt 3
`371a93e1…`: varied angles. One defect: the pipe into the low basin crossed the whole basin. Fix: the inlet sits on the rim facing the incoming route.

## Attempt 4
`fb9e6334…`: accepted. Only polish issues remain. The final is a byte-identical copy.

## Attempt 5
Not used: the defects left were cosmetic, not wrong subjects or actions. Full log: `out/engine3d/phase29/final/attempt-log.md`.

## Final Artifact
`out/engine3d/phase29/final/`:
- `phase29-script-mode-final.mp4` (SHA-256 `fb9e6334eaaa29dc8b8f36ced853a8f68da34db960a97e1d23f9cc7649ccf6a1`, 48.77 s, 1463 frames, 480×854, 30 fps, H.264 + AAC 48 kHz stereo, validated by full decode);
- `script.txt` (exact), `script-normalized.txt`;
- `semantic-claims.json`, `planner-input.json`, `visual-plan.json`, `directed-sequence.json`, `qa.json`, `coverage.json`, `script-provenance.json`, `tracks.json`, `summary.json`;
- `contact-sheet.png` (21 frames, 0–100%) and `contact-sheet-beats.png` (15 event frames);
- `visual-review.md`, `attempt-log.md`, `factual-additions-review.md`.

## Script Coverage
5 of 5 segments are represented, **100%**: DIRECT 3, PARTIAL 0, SYMBOLIC 1 (the definition/purpose sentence), EDITORIAL 1 (the hook question), UNREPRESENTED 0; important unrepresented 0. There are no visual gaps.

## Visual Proof
Beats: DIRECT 5 · PARTIAL 1 · SYMBOLIC 3 · NONE 0. Proof here means how much the video demonstrates the script's statement, not external truth.

## Factual Additions Review
**0 factual additions** (`factual-additions-review.md`). There is one borderline editorial item: generic blade geometry on the rotor, with no label or narration claiming it.

## Second-Domain Probe
The probe is a bicycle (transport), not well, elevator or turbine: "Como uma bicicleta anda? Quando você pedala, os pedais giram a coroa. A corrente transmite o movimento para a roda traseira. A roda traseira gira e empurra a bicicleta para frente."
- **Technical result: PASS.** Plan valid, sequence valid, MP4 `7e658920…` (14.9 s), coverage 100%, QA all PASS, stasis 4.2 s.
- **What it shows:** the chainring and rear wheel spin because the script says they rotate (with no bicycle vocabulary in the runtime), and the bicycle block moves forward.
- **Visual quality: WEAK.** Pedals, chain and bicycle are abstract blocks, the wheels read as propellers, and Caio is oversized in one shot.

## Determinism
The same script and config give the same understanding, plan, sequence and render plan (tests plus replay). All animation is frame-based; there is no clock or unseeded randomness.

## Replay
`tools/phase29/replay.ts` denies all network, including loopback. Final and probe: understanding, plan and sequence are equal, provenance is verified, and the MP4 SHA matches. Legacy checks: Phase27B final plan and sequence, and Phase28B well, elevator and turbine plans, are identical. **PASS, 0 network calls.**

## Security
- **The script is untrusted text:** it is never executed. Prompt-injection text, URLs and shell commands stay narrative (tested).
- **Path safety for `--script`:** the file must be inside the project, be `.txt` or `.md`, not be a symlink, and be size-bounded (tested).
- **Network guard:** the generation path refuses in-process external network; in-process external calls were 0.
- **TTS:** text goes to edge-tts as an `execFile` argument, never through a shell.
- **Untouched:** no Phase28 security or web files, and no `package-lock` change.

## Anti-hardcode
`tools/phase29/anti-hardcode.ts` scanned 12 Phase29 runtime files: **0 blockers**, and the negative control is detected. No turbine, hydraulic, suction, elevator, well or bicycle terms, and no pilot phrases. Bicycle words initially present in the ROTATING lexicon were found and removed. Generic cue words that also appear in the pilot (água, duto, reservatório, rotor…) are listed transparently.

## Performance
**Final (attempt-4 run, TTS cached):**

| Stage | Time |
|---|---|
| Ingestion | 2 ms |
| Semantics | 30 ms |
| TTS | 0.16 s |
| Planning and compile | 0.30 s |
| Render (MP4 + validation) | 60.6 s |
| Total | 90.1 s |

**Probe (TTS uncached, 4 sentences):** TTS 14.8 s, render 26.9 s, total 55.0 s.

## Regression
**PASS.** All 25 commands exit 0 with 0 failures (`out/engine3d/phase29/analysis/checks-final.tsv`). Test counts:
- 2008 test executions across all suites.
- `check:engine3d` alone runs every `tests/*.test.ts`: 1092 unique tests, up from 985 at Phase27B (the delta is Phase28/28B's and Phase29's new tests).

The 25 commands are the 22 historical ones, Phase28's `check:progressive-curiosity` (43) and `check:contextual-parser` (47), and the new `check:script-mode` (17). The typecheck is clean.

## Registry
Engine3D 50 / SFX 8 / VISUAL 5, unchanged. 15 historical MP4s are unchanged, including the Phase25, 27 and 27B finals.

## Product Assessment
| Question | Answer |
|---|---|
| SCRIPT → MP4 | YES |
| RESEARCH REQUIRED | NO |
| MANUAL JSON REQUIRED | NO |
| SECOND SCRIPT GENERALIZATION | PASS (technical; visuals weak) |
| VISUALS | DEMONSTRATE |
| WITHOUT AUDIO COMPREHENSION | PARTIAL |
| 3D CURIOSITY VIDEO FEEL | PARTIAL |
| WOULD SHIP | NO (not yet) |
| PRODUCT QUALITY | ACCEPTABLE |

## Remaining Visible Defects
1. On diagonal pipe segments the open half-shell can hide the water.
2. The turbine reads partly as a fan or water wheel.
3. Penstock flow shots are wide, so the pipe is small.
4. There are 9 hard cuts, plus two consecutive rotor close-ups.
5. Caio is stiff, with no lipsync.
6. No SFX or music.
7. The second domain uses abstract blocks: no vehicle or chain shapes.

## Next Product Recommendation
Keep the loop "watch → list visible defects → generic fix → re-render", and spend the next round on recognisability across domains. Add a small set of generic object shapes (vehicle body, chain/belt loop, spiral housing, wheel with spokes) and a pipe material that always shows its water. Then try a third script with only the script swapped.

## Gates
| Gate | Requirement | Result |
|---|---|---|
| S1 | Correct committed base; dirty Phase28/28B preserved | PASS |
| S2 | Script Mode has an explicit architecture boundary | PASS |
| S3 | External script requires no Research | PASS |
| S4 | No web Evidence required | PASS |
| S5 | Script provenance works | PASS |
| S6 | Questions remain questions | PASS |
| S7 | Script assertions drive factual visuals | PASS |
| S8 | Unsupported factual extensions refused | PASS |
| S9 | Entity persistence | PASS |
| S10 | World persistence | PASS |
| S11 | Semantic beats not 1:1 with sentences | PASS (5 sentences → 15 beats) |
| S12 | Physical actions map to visual operations | PASS |
| S13 | State changes map to visual states | PASS |
| S14 | Visual/editorial inference separated | PASS |
| S15 | One-command script generation | PASS |
| S16 | Real turbine external script ingested | PASS |
| S17 | Turbine MP4 rendered | PASS |
| S18 | Final MP4 technically valid | PASS |
| S19 | Script coverage measured | PASS (100%) |
| S20 | No important action segment silently unrepresented | PASS (0) |
| S21 | Longest meaningful stasis ≤ 8 s | PASS (6.83 s) |
| S22 | Continuity PASS | PASS (0 issues) |
| S23 | 0 invented factual additions | PASS |
| S24 | Second-domain probe | PASS (technical) |
| S25 | No turbine-specific runtime hardcode | PASS |
| S26 | Replay | PASS |
| S27 | Replay network calls = 0 | PASS |
| S28 | Security | PASS |
| S29 | Full regression | PASS (25/25 commands, 0 failures) |
| S30 | Final artifact reviewed from decoded frames | PASS |

Phase30 was not started.
