# PHASE 27B — Visual Polish, Physical Readability & Presenter Performance

Status: **PARTIAL** (honest; see the gates). Nothing has been committed or pushed. Phase27 and Phase27B both remain in the working tree. HEAD is `7de502dc…` (unchanged).

## 1. Summary
The same well pilot, script, voice, relations and proof are re-rendered with generic stylized assemblies, a stylized outdoor backdrop, a diorama-style cinematic cutaway, a presenter arc, and gesture-led camera moves.
- Automated QA: 14 of 14 PASS.
- Artifact visual review: from WEAK to ACCEPTABLE/GOOD on the physical axes.
- Regression: 22/22 commands, 1794 tests, 0 failures.

## 2. What changed (code)
| File | Change |
|---|---|
| `src/engine3d/demonstration-contracts.ts` | Optional `assembly` on a subject. Adds `ASSEMBLY_KINDS` (each assembly is tied to its primitive kind) and `ASSEMBLY_MESHES` (budget). |
| `src/engine3d/demonstration-runtime.ts` | Validates the assembly enum and kind compatibility (fails explicitly before render); mesh budget per assembly. |
| `src/engine3d/assemblies.tsx` (new) | Frame-deterministic stylized assemblies: TERRAIN_SECTION, LIQUID_VOLUME, PIPE (half-section, joints, flow markers), OPEN_BASIN, GABLED_BUILDING, FRAME_PANEL, PANEL, CARRIAGE, DISPLAY_BLOCK. Also ContactShadow and StylizedBackdrop (floor with an opening and a front floor that leaves during the cut, sky gradient shader, hills, hemisphere light). |
| `src/engine3d/demonstration-geometry.tsx` | Dispatches subjects to assemblies; `environmentStyleOf` turns stylized mode on only when assemblies exist. |
| `src/engine3d/directed-renderer.tsx`, `renderer.tsx`, `library.tsx` | Pass the environment style and frame; draw actor and tree contact shadows; adjust light, fog and sky in stylized mode. Legacy output is unchanged. |
| `src/visual-causal/contracts.ts`, `planner.ts` | Entities declare assemblies. The solid terrain block replaces the trench layers. The house is a single GABLED_BUILDING. New three-quarter camera zones; presenter staging; the reveal beat keeps the presenter (REVEAL_SYSTEM); the section closes faster. |
| `src/visual-causal/compile.ts` | Presenter arc: enter→look→point→gesture-led reveal→off-focus→look→turn→wave, all aimed at real targets. Gesture-led camera moves (no cut). LAYER focus framed by the zone. Slow push-in on long holds. |
| `src/visual-causal/qa.ts` | Layer occupancy uses region coverage. |
| `tests/visual-causal.test.ts` | +6 capability tests (assemblies and kind checks, stylized environment gating, presenter targets and reaction, camera follows gesture, no-label artifact, layer framing). |
| `tools/phase27b/*` | Operator harnesses: preview, render, events, compare, pilot, replay, anti-hardcode, integrity, patch scripts. |

There is no topic-specific runtime code: no `ArtesianWellModel` and no `if poço/well/artesian`. The anti-hardcode scan found 0 blockers across 200 files.

## 3. Results
| Metric | Phase27 | Phase27B |
|---|---|---|
| Duration / frames | 25.27 s / 758 | 25.27 s / 758 |
| Script / voice / relations | 64 words / AntonioNeural / 4 | identical |
| Invented relations | 0 | 0 |
| Proof | D1/P1/S2/N0 | D1/P1/S2/N0 |
| Shots / cuts | 9 / 2 | 9 / 2 |
| Longest meaningful stasis | 4.43 s | 4.43 s |
| Automated QA | 13 PASS + 1 PARTIAL | 14 PASS |
| SYSTEM focus extent | 0.26 | 0.40–0.47 |
| Visual review (12 axes) | mostly WEAK/FAIL | 0 FAIL, 5 GOOD, 7 ACCEPTABLE |

## 4. Artifacts
- `out/engine3d/phase27b/final/phase27b-well-final.mp4` (SHA-256 `e7d72e43…e5f9`), plus plan, sequence, QA, `contact-sheet-final.png` (36 frames: 20 evenly spaced plus 16 event frames).
- `out/engine3d/phase27b/review/phase27-vs-phase27b-contact-sheet.png` (9 beats).
- `out/engine3d/phase27b/review/no-label/` and `no-label-sheet.png`.
- `out/engine3d/phase27b/review/visual-review.md`, `final-review.md`, `attempt-log.md` (12 entries, 5 MP4 attempts plus 4 previews), `sfx-audit.md`.
- `out/engine3d/phase27b/baseline/` (Phase27 baseline), `attempts/`, `analysis/` (checks, anti-hardcode, integrity), `replay/`, `provenance/`.

## 5. Verification
- **Replay**: 0 network calls attempted. Well and elevator plans and sequences rebuild equal; the MP4 SHA matches; provenance is verified, with a factual-beat provenance rate of 1.0.
- **Integrity**: HEAD unchanged. 14 historical MP4s unchanged, including Phase25 final and Phase27 final (`51823d2f…`). Registry: Engine3D 50, SFX 8, VISUAL 5. `package-lock` untouched; no security files touched.
- **Regression**: 22/22 commands exit 0, 1794 tests, 0 failures (`analysis/checks-final.tsv`).
- **Secondary probe (elevator)**: ENCLOSURE uses FRAME_PANEL, PANEL, CARRIAGE and DISPLAY_BLOCK. Occupancy PASS, cutaway PASS, presenter continuity PASS. MEANINGFUL_CHANGE FAIL: 11.2 s stasis caused by the 12 s single-relation sentences of its script, not by rendering.

## 6. Gates
| Gate | Requirement | Result |
|---|---|---|
| B1 | HEAD unchanged, no destructive git, no commit/push | PASS |
| B2 | Phase27 architecture preserved (world, beats, proof, zones, replay, provenance) | PASS |
| B3 | Same script/voice/4 relations, 0 invented | PASS |
| B4 | Proof not inflated by polish | PASS (D1/P1/S2/N0) |
| B5 | Generic assemblies, no topic runtime | PASS |
| B6 | Solid forms; transparency only with purpose | PASS |
| B7 | Lighting, contact shadows, sky/background, depth layers | PASS |
| B8 | Terrain cross-section: solid, grass top, vertical face, no geology claims | PASS |
| B9 | Liquid readable, flow inside the pipe with direction | PASS (water layer ACCEPTABLE) |
| B10 | Cinematic WORLD→CUTAWAY, no teleport | PASS |
| B11 | Presenter arc with real targets and a reaction, no lipsync, CAIO only | PASS |
| B12 | Camera–gesture coordination | PASS |
| B13 | SYSTEM occupancy ≥35% | PASS (0.40–0.47) |
| B14 | Stasis ≤8 s (ideal ≤6) | PASS (4.43 s) |
| B15 | Duration not extended; 480×854 at 30 fps; 8–12 shots | PASS (9 shots) |
| B16 | Iteration with attempt log (≤8 attempts) | PASS (5 MP4 + 4 previews) |
| B17 | Frame inspection at 0–100% plus events; ≥20 final frames | PASS |
| B18 | Comparison sheet with ≥6 beats | PASS (9) |
| B19 | No-label visual review | PASS |
| B20 | Automated QA separate from visual review | PASS |
| B21 | SFX audit; use only if approved, otherwise record the gap | PASS (none used; gap recorded) |
| B22 | Elevator probe of generic capabilities | PARTIAL (capabilities PASS; stasis 11.2 s) |
| B23 | Tests for the new capabilities only | PASS (+6) |
| B24 | Replay with zero network; provenance | PASS |
| B25 | Anti-hardcode with 0 runtime blockers | PASS |
| B26 | Full regression and registry 50/8/5 | PASS |
| B27 | Product reads as documentary, recognisable without labels | PARTIAL (well: YES; artesian/pressure: NO; feel ACCEPTABLE) |

**Verdict: PARTIAL**: 25 PASS, 2 PARTIAL (B22, B27). Autonomy remains LEVEL4C+.

## 7. Known limitations / next
- Pressure, the cause, is not visualised; that needs grounded relations, not polish.
- A porous saturated-layer look needs a material/pattern capability.
- There are no approved water or ambient SFX.
- Presenter expressiveness is limited to point/look/wave/turn.
- Scripts made of single-relation sentences still produce long stasis (elevator probe).

Phase28 was not started.
