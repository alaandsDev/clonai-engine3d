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
