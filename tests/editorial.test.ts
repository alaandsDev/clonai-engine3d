import { test } from "node:test";
import assert from "node:assert/strict";
import raw from "../examples/editorial/cold-pilot.json";
import { compileEditorial, createRenderProjection, qaEditorial, editorialPlanShape, eventMapShape, inputsShape, resolveAnchor, canonicalJson, jsonHash, editorialFingerprint, safeZonePixels, editorialPreview, previewMarkdown, type EditorialInputs, type EditorialEvent, type AssetStatus } from "../src/editorial";
import { selectSfxCandidates } from "../src/editorial/sfx-selection";
import { compileDirectorPlan } from "../src/engine3d/director";
import { registry } from "../src/engine3d/registry";
const fixture = () => { const x: unknown = structuredClone(raw); inputsShape(x); return x; };
const mutate = (f: (x: any) => void) => { const x = fixture(); f(x); return x; };
const bad = (f: (x: any) => void) => assert.throws(() => compileEditorial(mutate(f)));
function asset(x: EditorialInputs, status: AssetStatus = "TESTED") {
    const ref = { sourceCatalog: "pack-audit-v1", auditId: "AUDIT_demo", relativePath: "SFX/candidate.wav", category: "SFX" as const, status, licenseStatus: "UNKNOWN" as const };
    x.catalog = [{ assetRef: ref, ...(["TESTED", "APPROVED"].includes(status) ? { technicalEvidence: { testId: "test_one", sha256: "a".repeat(64), passed: true as const } } : {}) }];
    const cue = x.eventMap.events.find(e => e.type === "SFX_CUE")!;
    if (cue.type === "SFX_CUE")
        cue.assetRef = structuredClone(ref);
    return ref;
}
test("editorial versioned plan and event schemas accept independent pilot", () => { const x = fixture(); editorialPlanShape(x.plan); eventMapShape(x.eventMap); inputsShape(x); assert(qaEditorial(x).valid); });
for (const field of ["intent", "informationType", "emphasis"])
    test(`editorial rejects invalid ${field}`, () => bad(x => x.plan.beats[0][field] = "NOT_REAL"));
test("editorial rejects unknown fields and versions", () => { bad(x => x.plan.version = 2); bad(x => x.eventMap.version = 2); bad(x => x.plan.hidden = true); bad(x => x.eventMap.events[0].surprise = true); });
test("editorial source narration is complete and ordered", () => bad(x => x.plan.beats.reverse()));
test("editorial rejects non-JSON and nonfinite data before compilation", () => { bad(x => x.plan.beats[0].durationSeconds = NaN); assert.throws(() => canonicalJson({ x: undefined })); assert.throws(() => canonicalJson([Infinity])); const cyc: any = {}; cyc.self = cyc; assert.throws(() => canonicalJson(cyc)); });
test("editorial invalid anchors rejected", () => { for (const a of [{ type: "NOPE" }, { type: "NORMALIZED", value: -0.1 }, { type: "NORMALIZED", value: 1.01 }, { type: "NORMALIZED", value: NaN }, { type: "WORD", value: "missing" }, { type: "WORD", value: "porta", occurrence: 0 }, { type: "WORD", value: "porta", unexpected: 1 }])
    bad(x => x.eventMap.events[0].anchor = a); });
test("editorial anchors resolve start/end/normalized/word/phrase on actual frame grid", () => { const x = fixture(), b = x.plan.beats[0]; const start = resolveAnchor({ type: "BEAT_START" }, b, 30, 20), end = resolveAnchor({ type: "BEAT_END" }, b, 30, 20), mid = resolveAnchor({ type: "NORMALIZED", value: 0.5 }, b, 30, 20); assert.equal(start.timelineFrame, 20); assert.equal(end.timelineFrame, 200); assert.equal(mid.beatFrame, 90); const word = resolveAnchor({ type: "WORD", value: "porta" }, b, 30), phrase = resolveAnchor({ type: "PHRASE", value: "tão brutal" }, b, 30); assert(word.beatFrame > 0); assert(phrase.beatFrame > word.beatFrame); assert.equal(word.timingConfidence, "ESTIMATED"); });
test("editorial word matching uses tokens, accents, occurrences and no substring fallback", () => { const b = fixture().plan.beats[0]; b.narration = "Ação, porta e porta."; assert.throws(() => resolveAnchor({ type: "WORD", value: "porta" }, b, 30)); assert(resolveAnchor({ type: "WORD", value: "porta", occurrence: 2 }, b, 30).beatFrame > 0); assert.equal(resolveAnchor({ type: "WORD", value: "AÇA\u0303O" }, { ...b, narration: "ação" }, 30).beatFrame, 0); assert.throws(() => resolveAnchor({ type: "WORD", value: "port" }, b, 30)); assert.throws(() => resolveAnchor({ type: "WORD", value: "porta", occurrence: 3 }, b, 30)); });
test("editorial orphan events and mismatched plan rejected", () => { bad(x => x.eventMap.events[0].beatId = "missing"); bad(x => x.eventMap.planId = "other"); });
test("editorial duplicate IDs, beats and semantic events rejected", () => { bad(x => x.eventMap.events.push(x.eventMap.events[0])); bad(x => x.plan.beats[1].id = x.plan.beats[0].id); bad(x => x.eventMap.events.push({ ...x.eventMap.events[0], id: "duplicate_meaning" })); });
test("editorial purposes and causal anchor required including SFX and B-roll", () => { bad(x => x.eventMap.events[2].purpose = " "); bad(x => delete x.eventMap.events[8].purpose); bad(x => delete x.eventMap.events[8].request.purpose); bad(x => delete x.eventMap.events[0].anchor); });
test("editorial invalid asset lifecycle status rejected", () => { const x = fixture(); asset(x); (x.catalog[0].assetRef as any).status = "AUTO_APPROVED"; assert.throws(() => compileEditorial(x)); });
test("editorial discovered/curated/tested never auto-promoted", () => { for (const status of ["DISCOVERED", "CURATED", "TESTED"] as const) {
    const x = fixture();
    asset(x, status);
    const before = canonicalJson(x);
    const r = compileEditorial(x);
    assert.equal(canonicalJson(x), before);
    assert(r.unresolvedEventIds.includes("hook_sfx"));
} });
test("editorial TESTED requires technical evidence", () => bad(x => { asset(x); delete x.catalog[0].technicalEvidence; }));
test("editorial APPROVED without human review record fails", () => { const x = fixture(); asset(x, "APPROVED"); assert.throws(() => compileEditorial(x), /APPROVAL_REQUIRED/); });
test("editorial wrong-context and technical-only approval fails", () => { const x = fixture(), ref = asset(x, "APPROVED"); x.approvals = [{ assetRef: ref, status: "APPROVED", context: "another_event", reviewer: { type: "HUMAN", id: "synthetic-test-only" }, reason: "synthetic unit fixture", evidence: "test-only" }]; assert.throws(() => compileEditorial(x), /APPROVAL_REQUIRED/); x.approvals[0].context = "hook_sfx"; x.approvals[0].reviewer.type = "TECHNICAL_CHECK"; assert.throws(() => compileEditorial(x)); });
test("editorial context approval validated but mixer still unavailable", () => { const x = fixture(), ref = asset(x, "APPROVED"); x.approvals = [{ assetRef: ref, status: "APPROVED", context: "hook_sfx", reviewer: { type: "HUMAN", id: "synthetic-unit-fixture" }, reason: "Unit test only, never persisted as actual review", evidence: "test-only" }]; assert(compileEditorial(x).events.find(e => e.event.id === "hook_sfx")!.reason.includes("MIXER_NOT_IMPLEMENTED")); assert.throws(() => compileEditorial(x, "STRICT_RENDER"), /MIXER_NOT_IMPLEMENTED/); });
test("editorial rejected asset reference blocked even optional", () => { const x = fixture(); asset(x, "REJECTED"); assert.throws(() => compileEditorial(x), /ASSET_REJECTED/); });
test("editorial missing catalog asset and forged status/path blocked", () => { const x = fixture(); asset(x); x.catalog = []; assert.throws(() => compileEditorial(x), /ASSET_NOT_FOUND/); const y = fixture(); asset(y); y.catalog[0].assetRef.relativePath = "SFX/other.wav"; assert.throws(() => compileEditorial(y), /ASSET_REF_MISMATCH/); });
test("editorial absolute, traversal and nonportable asset paths rejected", () => { for (const p of ["C:/audio.wav", "/audio.wav", "../audio.wav", "SFX/../audio.wav", "SFX\\audio.wav", "https://host/audio.wav", "SFX/NUL.wav", "SFX/trailing. ", "SFX//x.wav"]) {
    const x = fixture();
    const a = asset(x);
    a.relativePath = p;
    assert.throws(() => compileEditorial(x));
} });
test("editorial unresolved SFX STRICT_RENDER errors even when optional", () => { const x = fixture(); x.eventMap.events = x.eventMap.events.filter(e => e.type !== "BROLL_REQUEST"); x.decisions = []; assert.throws(() => compileEditorial(x, "STRICT_RENDER"), /SFX_UNRESOLVED/); });
test("editorial unresolved SFX PLAN_ONLY preserves role and purpose", () => { const e = compileEditorial(fixture()).events.find(e => e.event.id === "hook_sfx")!; assert.equal(e.disposition, "PLAN_ONLY"); assert.equal(e.event.type, "SFX_CUE"); assert(e.event.purpose); });
test("editorial unresolved B-roll STRICT_RENDER errors", () => { const x = fixture(); x.eventMap.events = x.eventMap.events.filter(e => e.type !== "SFX_CUE"); assert.throws(() => compileEditorial(x, "STRICT_RENDER"), /BROLL_UNRESOLVED/); });
test("editorial B-roll PLAN_ONLY remains provider agnostic and disabled", () => { const e = compileEditorial(fixture()).events.find(e => e.event.type === "BROLL_REQUEST")!; assert.equal(e.disposition, "PLAN_ONLY"); bad(x => x.eventMap.events[8].request.generationAllowed = true); bad(x => x.eventMap.events[8].request.externalProviderAllowed = true); bad(x => x.eventMap.events[8].request.provider = "someone"); });
test("editorial NUMBER QA and beat without focus detect missing communication", () => { const x = fixture(); x.eventMap.events = x.eventMap.events.filter(e => e.beatId !== "number"); const q = qaEditorial(x); assert(q.issues.some(i => i.code === "NUMBER_WITHOUT_EMPHASIS")); assert(q.issues.some(i => i.code === "BEAT_WITHOUT_VISUAL")); });
test("editorial safe zone scales with canvas and rejects outside text", () => { const z = fixture().plan.safeZone; const a = safeZonePixels(z, { width: 480, height: 854 }), b = safeZonePixels(z, { width: 960, height: 1708 }); assert.equal(b.x, 2 * a.x); assert.equal(b.height, 2 * a.height); bad(x => x.plan.safeZone.width = 1); bad(x => x.eventMap.events[7].placement = { x: 0, y: 0, width: 0.5, height: 0.2 }); assert.throws(() => safeZonePixels({ ...z, x: 2 }, { width: 480, height: 854 })); });
test("editorial custom placement and delayed text are PLAN_ONLY, never silently retimed", () => { const x = fixture(); const e = x.eventMap.events.find(e => e.type === "TEXT_EMPHASIS")!; if (e.type === "TEXT_EMPHASIS")
    e.placement = { x: 0.1, y: 0.1, width: 0.5, height: 0.1 }; assert.equal(compileEditorial(x).events.find(r => r.event.id === e.id)!.disposition, "PLAN_ONLY"); e.anchor = { type: "NORMALIZED", value: 0.5 }; assert.equal(compileEditorial(x).events.find(r => r.event.id === e.id)!.disposition, "PLAN_ONLY"); });
test("editorial impossible cuts, conflicting cameras/text, and overflowing holds rejected", () => { bad(x => x.eventMap.events[5].anchor = { type: "NORMALIZED", value: 0.5 }); bad(x => x.eventMap.events.push({ ...x.eventMap.events[5], id: "last_cut", beatId: "number" })); bad(x => x.eventMap.events[4].durationSeconds = 8); bad(x => x.eventMap.events.push({ ...x.eventMap.events[1], id: "camera_conflict" })); bad(x => x.eventMap.events.push({ ...x.eventMap.events[7], id: "text_conflict" })); });
test("editorial unknown focus and end-exclusive events rejected", () => { bad(x => x.eventMap.events[0].targetInstanceId = "no_instance"); bad(x => x.eventMap.events[0].anchor = { type: "BEAT_END" }); });
test("editorial every inter-beat cut must be explicit", () => bad(x => x.eventMap.events = x.eventMap.events.filter((e: any) => e.id !== "hook_cut")));
test("editorial default renderer label cannot escape authored safe zone", () => bad(x => x.plan.safeZone = { x: 0.2, y: 0.3, width: 0.6, height: 0.4 }));
test("editorial frame quantization rejects zero-frame beats", () => bad(x => { x.plan.canvas.fps = 1; x.plan.beats[0].durationSeconds = 0.1; }));
test("editorial sub-shot camera timing stays PLAN_ONLY", () => { const x = fixture(); x.eventMap.events[1].anchor = { type: "NORMALIZED", value: 0.5 }; assert.equal(compileEditorial(x).events.find(e => e.event.id === "hook_camera")!.disposition, "PLAN_ONLY"); });
test("editorial compiler maps all six camera intentions to existing IDs", () => { const ids = { PUSH: "CAM_PUSH_IN_001", PULL: "CAM_PULL_OUT_001", ORBIT: "CAM_ORBIT_001", STATIC: "CAM_STATIC_001", PAN: "CAM_PAN_LEFT_001", SHAKE: "CAM_SHAKE_001" }; for (const [movement, id] of Object.entries(ids)) {
    const x = fixture(), e = x.eventMap.events[1] as Extract<EditorialEvent, {
        type: "CAMERA_EMPHASIS";
    }>;
    e.movement = movement as typeof e.movement;
    if (movement === "PAN")
        e.panDirection = "LEFT";
    assert.equal(compileEditorial(x).directorPlan.scenes[0].shots[0].camera.resourceId, id);
} bad(x => x.eventMap.events[1].movement = "NEW_CAMERA"); });
test("editorial atmosphere never adds VFX implicitly", () => { const x = fixture(), count = x.plan.beats[0].staging.vfx.length; assert.equal(compileEditorial(x).directorPlan.scenes[0].shots[0].vfx.length, count); });
test("editorial explicit visual projection requires every unresolved ID exactly once", () => { const r = compileEditorial(fixture()); assert.throws(() => createRenderProjection(r, { omitEventIds: [], reason: "test" })); assert.throws(() => createRenderProjection(r, { omitEventIds: [...r.unresolvedEventIds, "invented"], reason: "test" })); assert.throws(() => createRenderProjection(r, { omitEventIds: r.unresolvedEventIds, reason: "" })); const p = createRenderProjection(r, { omitEventIds: r.unresolvedEventIds, reason: "visual only" }); assert.equal(p.omittedEvents.length, 2); assert.equal(compileDirectorPlan(p.directorPlan).totalFrames, 390); });
test("editorial pure compilation stable hash, key order independent and input immutable", () => { const x = fixture(), before = canonicalJson(x), a = compileEditorial(x), b = compileEditorial(JSON.parse(before)); assert.equal(jsonHash(a.directorPlan), jsonHash(b.directorPlan)); assert.equal(a.fingerprint, b.fingerprint); assert.equal(canonicalJson(x), before); assert.equal(canonicalJson({ z: 2, a: 1 }), canonicalJson({ a: 1, z: 2 })); });
test("editorial fingerprint changes for narrative, events, relevant status/content and decisions", () => { const x = fixture(); asset(x, "CURATED"); const base = editorialFingerprint(x); for (const change of [(y: EditorialInputs) => { y.plan.title += "!"; }, (y: EditorialInputs) => { y.eventMap.events[0].purpose += "!"; }, (y: EditorialInputs) => { asset(y, "TESTED"); }, (y: EditorialInputs) => { y.decisions![0].reason += "!"; }]) {
    const y = structuredClone(x);
    change(y);
    assert.notEqual(base, editorialFingerprint(y));
} const y = structuredClone(x); y.catalog.push({ assetRef: { ...y.catalog[0].assetRef, auditId: "UNUSED_asset", relativePath: "SFX/unused.wav" } }); assert.equal(base, editorialFingerprint(y)); });
test("editorial invalid execution resources fail through original engine boundary", () => { bad(x => x.plan.beats[0].staging.environment.resourceId = "ENV_UNKNOWN_001"); bad(x => x.plan.cast.guide = "CHAR_BLOB_001"); });
test("editorial strict mode accepts fully executable visual subset", () => { const x = fixture(); x.eventMap.events = x.eventMap.events.filter(e => !["SFX_CUE", "BROLL_REQUEST"].includes(e.type)); x.decisions = []; assert.equal(compileEditorial(x, "STRICT_RENDER").unresolvedEventIds.length, 0); });
test("editorial preview shows mapping, confidence, pending SFX and B-roll", () => { const x = fixture(); const p = editorialPreview(x), md = previewMarkdown(x); assert.equal(p.beats.length, 3); assert(md.includes("ESTIMATED")); assert(md.includes("IMPACT")); assert(md.includes("BROLL_REQUEST")); assert(md.includes("scene_number")); });
test("editorial decision log rejects orphan, invalid state and fractional attempt", () => { bad(x => x.decisions[0].eventId = "missing"); bad(x => x.decisions[0].status = "AUTO"); bad(x => x.decisions[0].attempt = 1.5); });
test("editorial audit shortlist selection is deduplicated bounded and not approved", () => { const row = { id: "AUDIT_one", relativePath: "SFX/example.wav", category: "SFX" }; const recommended = { topSfx: Object.fromEntries(["WHOOSH", "IMPACT", "RISER", "TRANSITION", "UI"].map(role => [role, { candidates: [row] }])) }; const c = selectSfxCandidates(recommended, [row]); assert.equal(c.length, 1); assert.equal(c[0].assetRef.status, "CURATED"); assert.equal(c[0].roles.length, 5); assert.throws(() => selectSfxCandidates(recommended, [])); });
test("editorial pilot preserves exactly 50 registered resources and prior execution semantics", () => { const expected = { character: 6, environment: 9, prop: 15, action: 10, camera: 7, vfx: 3, scenePreset: 0 }; assert.equal(registry.entries.length, 50); for (const [type, count] of Object.entries(expected))
    assert.equal(registry.entries.filter(r => r.type === type).length, count); const r = compileEditorial(fixture()); const seq = compileDirectorPlan(r.directorPlan); assert.equal(seq.width, 480); assert.equal(seq.height, 854); assert.equal(seq.totalFrames, 390); assert(seq.captions.length > 0); assert.equal(seq.shots[2].props[0].parameters?.value, -63); assert.deepEqual(r.unresolvedEventIds, ["hook_sfx", "place_broll"]); });
