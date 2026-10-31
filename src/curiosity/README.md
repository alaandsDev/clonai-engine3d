# Causal process knowledge and curiosity stories

This is a deterministic, opt-in layer over Research v2–v4, not a new Research
version. Set `sourcePolicy.mechanismVersion: 2` only for `PROCESS` requests.
Without that field the historical extractor, queries, policy and Writer remain
available for their original replays.

`extractMechanismV2` uses the bilingual rules in `research/mechanism-language`.
It admits literal source relations with complete sentence support windows.
Negation, unresolved references, unsupported quantities/formulae and uncertain
document scope abstain. Explicit aliases supply scope proof, not an inferred
factual subject. A source title alone never creates a component relationship.

`buildMechanismKnowledge(pack)` validates/rederives the EvidencePack, then
includes only policy-admitted mechanism facts with source, snapshot hash, exact
span, context, origin, modality, temporal context and fact IDs. Coverage requires
an explicit physical mechanism plus a complementary dimension. No category is
universally mandatory.

`buildCuriosityStoryPlan(pack)` returns knowledge, a literal construction graph,
and a story plan. Shared-participant links are editorial navigation, not inferred
causal edges. Editorial order is not source chronology. A new problem / next
solution can be marked only when the three explicit SOLVES/CAUSES/SOLVES
relations share the necessary literal participants. No historical invention or
naive attempt is synthesized. Missing support remains a GAP.

`writeCausalCuriosity(pack)` is the `CAUSAL_CURIOSITY_PROCESS` Writer route. It
retains complete source sentences and one non-assertive hook; it never pads an
undersized script. `SCRIPT_GROUNDED` is narrative eligibility, not visual or MP4
eligibility. The typed semantic handoff preserves every selected relation and
its proof, alongside the original Semantic Engine graph. Unsupported legacy
relations remain explicit. In particular the legacy Semantic Engine is pt-BR;
English extraction and source realization do not imply English visual execution.

## Progressive story investigation (Phase28)

`sourcePolicy.progressiveStory: true` additionally requires Research v4,
`mechanismVersion: 2`, `contextualMechanisms: true` and a factual PROCESS request.
Absent opt-in preserves the preceding extraction, story and Writer replays.
Use the existing CLI with `--progressive`; an optional recorded session supplies
an entire verified historical acquisition. Its snapshots, original queries and
fetches remain labelled historical, rather than newly discovered evidence.

`buildStoryNeeds` records questions, desired roles/predicates, dependencies,
support and unsupported/skipped/editorial slots. Research v4 stores the whole
need and the exact prior pack/knowledge/source IDs **before** invoking a search
provider. Two questions per round, configured query/fetch/byte/time limits,
deduplication, provider/source 403/429/timeouts, sufficient connected knowledge
and zero knowledge gain bound the acquisition. No new Research version or
scraper exists. Questions, editorial intent and missing roles never emit facts.

`groundedProgression` indexes existing admitted relation IDs. Exact shared
arguments allow planning continuity; bare shared subjects, subtype similarity,
purpose and proximity do not imply causal or temporal edges. A bounded path
search reports whether it completed. State descriptions retain UNKNOWN before
states and source-backed functional propositions, not simulated physics.
Repair requires an explicit target matching a named admitted problem;
PREVENTS remains prevention. The pre-existing SOLVES/CAUSES/SOLVES construction
can identify a grounded new-problem/next-solution role branch without claiming
a historical chronology or final whole-system success.

The same Writer orders supported steps after system setup, preserves full
qualifications, omits nonasserted backbone claims and compresses only bounded
unqualified definitions. Otherwise it omits an uncompressible low-density
unit. Each combined sentence cites all its selected relation evidence IDs.
The handoff measures the selected Writer subset, not the full knowledge graph.

The existing visual adapter/planner carries role/state/problem references.
An explicit `allowGroundedPreview` can inspect a supported but limited candidate;
the plan is marked `previewOnly` and the existing compiler refuses production.
It never turns a Writer limitation into render eligibility or physical proof.

`KnowledgeLossTrace.needTraces` joins need → pre-query context → search/fetch →
passage/candidate/admission → Writer → visual beats. Existing guard/span traces
remain available. Coupled subject/relation extraction failures stay UNKNOWN at
their unobserved substages; diagnostic passages are not recall ground truth or
manual evidence. `verifyProgressiveQuestions` re-derives contexts, queries,
search traces and iteration gains, including after re-signing attempts.

Offline coverage: `npm run check:progressive-curiosity`. Phase28 operators,
finite manual reviews and recorded acquisitions live under `tools/phase28/`
and ignored `out/engine3d/phase28/`. Benchmark names and verdicts never enter
runtime admission or planning.

## Existing process route

The handoff contains presenter/world/persistent-system intents, without assets,
coordinates, a new renderer or invented visual proof.

General entry point (the only required input is a factual process topic):

```text
npm run curiosity:run -- "<topic>" [outputDirectory] [recordedSession.json]
```

The optional session path enables offline reprocessing. Its hash and exact
acquired snapshots are checked before rebuilding knowledge. `verifyCuriosityWriter`
and `verifyCuriosityArtifacts` rebuild derived content, detecting re-signed
tampering as well as fingerprint mismatches. Network and filesystem access are
outside the pure builders. Large acquired/derived artifacts stay under ignored
`out/`; provenance in Git alone does not transport their raw snapshots.

Current limitation: closed grammars and conservative scope have low real-world
recall. Source-exact realization is honest but is not a fluent general paraphrase
engine. StoryPotential is a support heuristic, not an editorial quality verdict.
# Phase28B opt-in

`npm run curiosity:run -- "<topic>" <output-directory> --contextual-parser`
enables the existing progressive pipeline with `sourcePolicy.contextualParser: 1`.
The JSON policy flag is also accepted by the existing research commands. The
default and historical policy paths retain their previous extraction behavior.
Search relevance selects candidates only; it does not supply facts or aliases.
The bounded clause parser exposes local actor, trigger, argument, qualifier and
route proofs. Ambiguous subjects, unsupported comparisons and negation may refuse.
`tools/phase28b/diagnose.ts <pack.json> <sourceId>` inspects a validated snapshot
without creating Evidence. KnowledgeLossTrace attaches observed parser diagnostics
under this policy; unobserved legacy stages remain nullable.
