import { fail, type DirectorPlan } from "../engine3d/contracts";
import { compileDirectorPlan } from "../engine3d/director";
import { inputsShape } from "./schema";
import { resolveAnchor } from "./timing";
import { canonicalJson, COMPILER_VERSION, jsonHash } from "./fingerprint";
import type { EditorialInputs, EditorialEvent, EditorialIssue, ResolvedAnchor, Rect, EditorialAssetRef } from "./contracts";
export const assetKey = (a: EditorialAssetRef) => `${a.sourceCatalog}/${a.auditId}`;
const sameRef = (a: EditorialAssetRef, b: EditorialAssetRef) => canonicalJson(a) === canonicalJson(b);
export const within = (r: Rect, z: Rect) => r.x >= z.x && r.y >= z.y && r.x + r.width <= z.x + z.width + 1e-12 && r.y + r.height <= z.y + z.height + 1e-12;
export function safeZonePixels(zone: Rect, canvas: {
    width: number;
    height: number;
}) {
    // Validation is shared with the public input boundary.
    const vals = [zone.x, zone.y, zone.width, zone.height, canvas.width, canvas.height];
    if (vals.some(n => !Number.isFinite(n)) || zone.x < 0 || zone.y < 0 || zone.width <= 0 || zone.height <= 0 || zone.x + zone.width > 1 || zone.y + zone.height > 1 || canvas.width <= 0 || canvas.height <= 0)
        fail("EDITORIAL_SAFE_ZONE", "invalid zone/canvas");
    return { x: zone.x * canvas.width, y: zone.y * canvas.height, width: zone.width * canvas.width, height: zone.height * canvas.height };
}
export interface EventResolution {
    event: EditorialEvent;
    anchor: ResolvedAnchor;
    disposition: "MAPPED" | "METADATA" | "PLAN_ONLY";
    mapping: string;
    reason: string;
}
export interface EditorialCompilation {
    compilerVersion: string;
    mode: "PLAN_ONLY" | "STRICT_RENDER";
    directorPlan: DirectorPlan;
    events: EventResolution[];
    unresolvedEventIds: string[];
    fingerprint: string;
    qa: {
        valid: boolean;
        issues: EditorialIssue[];
    };
}
export function qaEditorial(input: unknown): {
    valid: boolean;
    issues: EditorialIssue[];
} {
    const issues: EditorialIssue[] = [];
    try {
        inputsShape(input);
        canonicalJson(input);
    }
    catch (e) {
        return { valid: false, issues: [{ code: "SCHEMA", message: String(e) }] };
    }
    const x = input as EditorialInputs;
    const issue = (code: string, message: string, event?: EditorialEvent, beatId?: string) => issues.push({ code, message, ...(event ? { eventId: event.id, beatId: event.beatId } : beatId ? { beatId } : {}) });
    if (x.eventMap.planId !== x.plan.id)
        issue("PLAN_MISMATCH", "eventMap references another plan");
    const approved = (a: EditorialAssetRef, context?: string) => x.approvals.some(r => sameRef(r.assetRef, a) && r.status === "APPROVED" && r.reviewer.type === "HUMAN" && (!context || r.context === context));
    for (const c of x.catalog)
        if (c.assetRef.status === "APPROVED" && !approved(c.assetRef))
            issue("APPROVAL_REQUIRED", `no review record for ${assetKey(c.assetRef)}`);
    for (const a of x.approvals)
        if (!x.catalog.some(c => sameRef(c.assetRef, a.assetRef)))
            issue("APPROVAL_ASSET_MISMATCH", "approval not matched by catalog");
    for (const d of x.decisions ?? [])
        if (!x.eventMap.events.some(e => e.id === d.eventId))
            issue("ORPHAN_DECISION", d.eventId);
    let start = 0;
    for (let i = 0; i < x.plan.beats.length; i++) {
        const b = x.plan.beats[i], events = x.eventMap.events.filter(e => e.beatId === b.id), frames = Math.round(b.durationSeconds * x.plan.canvas.fps);
        if (!events.some(e => e.type === "VISUAL_FOCUS"))
            issue("BEAT_WITHOUT_VISUAL", "beat needs visual focus", undefined, b.id);
        if (i < x.plan.beats.length - 1 && !events.some(e => e.type === "CUT"))
            issue("MISSING_BOUNDARY_CUT", "explicit CUT required before next beat", undefined, b.id);
        if (b.informationType === "NUMBER" && !events.some(e => e.type === "VISUAL_FOCUS" || e.type === "TEXT_EMPHASIS"))
            issue("NUMBER_WITHOUT_EMPHASIS", "number needs visual/text emphasis", undefined, b.id);
        for (const kind of ["CAMERA_EMPHASIS", "TEXT_EMPHASIS", "CUT"]) {
            if (events.filter(e => e.type === kind).length > 1)
                issue("EVENT_CONFLICT", `multiple ${kind} in one-shot beat`, undefined, b.id);
        }
        const signatures = new Set<string>();
        for (const e of events) {
            const { id, ...meaning } = e;
            const sig = canonicalJson(meaning);
            if (signatures.has(sig))
                issue("DUPLICATE_EVENT", "same event meaning", e);
            signatures.add(sig);
            let a: ResolvedAnchor;
            try {
                a = resolveAnchor(e.anchor, b, x.plan.canvas.fps, start);
            }
            catch (err) {
                issue("ANCHOR_INVALID", String(err), e);
                continue;
            }
            if (e.type !== "CUT" && a.beatFrame >= frames)
                issue("EVENT_AT_EXCLUSIVE_END", "event cannot occur after beat's final visible frame", e);
            if (e.type === "CUT" && (a.beatFrame !== frames || i === x.plan.beats.length - 1))
                issue("IMPOSSIBLE_CUT", "CUT only at an authored boundary before a next beat", e);
            if (e.type === "HOLD" && a.beatFrame + Math.ceil(e.durationSeconds * x.plan.canvas.fps) > frames)
                issue("HOLD_OUTSIDE_BEAT", "hold extends beyond beat", e);
            if (e.type === "VISUAL_FOCUS" && ![...b.staging.characters, ...b.staging.props].some(t => t.instanceId === e.targetInstanceId))
                issue("FOCUS_TARGET_MISSING", "focus target does not exist", e);
            if (e.type === "TEXT_EMPHASIS" && e.placement && !within(e.placement, x.plan.safeZone))
                issue("UNSAFE_TEXT_ZONE", "text box outside authored safe zone", e);
            if (e.type === "TEXT_EMPHASIS" && !e.placement && !within({ x: 0.08, y: 0.09, width: 0.84, height: 0.1 }, x.plan.safeZone))
                issue("UNSUPPORTED_TEXT_ZONE", "existing onScreenText anchor region outside authored safe zone; no layout override implemented", e);
            if (e.type === "SFX_CUE" && e.assetRef) {
                const c = x.catalog.find(c => assetKey(c.assetRef) === assetKey(e.assetRef!));
                if (!c)
                    issue("ASSET_NOT_FOUND", "asset missing from injected catalog", e);
                else if (!sameRef(c.assetRef, e.assetRef))
                    issue("ASSET_REF_MISMATCH", "path/category/status/provenance differs from catalog", e);
                if (e.assetRef.status === "REJECTED")
                    issue("ASSET_REJECTED", "rejected asset cannot be used", e);
                if (e.assetRef.status === "APPROVED" && !approved(e.assetRef, e.id))
                    issue("APPROVAL_REQUIRED", "exact event context must be approved by a human", e);
            }
        }
        start += frames;
    }
    for (const e of x.eventMap.events)
        if (!x.plan.beats.some(b => b.id === e.beatId))
            issue("ORPHAN_EVENT", "event references absent beat", e);
    return { valid: issues.length === 0, issues };
}
export function editorialFingerprint(x: EditorialInputs): string {
    inputsShape(x);
    const refs = x.eventMap.events.flatMap(e => e.type === "SFX_CUE" && e.assetRef ? [e.assetRef] : []), keys = new Set(refs.map(assetKey));
    const catalog = x.catalog.filter(c => keys.has(assetKey(c.assetRef))).sort((a, b) => assetKey(a.assetRef) < assetKey(b.assetRef) ? -1 : 1);
    const approvals = x.approvals.filter(a => keys.has(assetKey(a.assetRef))).map(a => ({ assetRef: a.assetRef, status: a.status, context: a.context, reviewer: a.reviewer, reason: a.reason, evidence: a.evidence })).sort((a, b) => canonicalJson(a) < canonicalJson(b) ? -1 : canonicalJson(a) > canonicalJson(b) ? 1 : 0);
    return jsonHash({ compilerVersion: COMPILER_VERSION, plan: x.plan, eventMap: x.eventMap, catalog, approvals, decisions: x.decisions ?? [] });
}
export function compileEditorial(input: unknown, mode: "PLAN_ONLY" | "STRICT_RENDER" = "PLAN_ONLY"): EditorialCompilation {
    if (!["PLAN_ONLY", "STRICT_RENDER"].includes(mode))
        fail("EDITORIAL_MODE", "unknown compiler mode");
    const qa = qaEditorial(input);
    if (!qa.valid)
        fail("EDITORIAL_QA", JSON.stringify(qa.issues));
    const x = input as EditorialInputs;
    const events: EventResolution[] = [];
    const directorPlan: DirectorPlan = { id: x.plan.id, title: x.plan.title, format: { ...x.plan.canvas }, style: "editorial-pilot", cast: { ...x.plan.cast }, timingMode: "fixed", scenes: [] };
    let start = 0;
    x.plan.beats.forEach((b, i) => {
        const staging = JSON.parse(canonicalJson(b.staging)) as typeof b.staging;
        const { environment, ...fields } = staging;
        const shot = { ...fields, id: `shot_${b.id}`, order: 0, durationSeconds: Math.round(b.durationSeconds * x.plan.canvas.fps) / x.plan.canvas.fps, narrationSegment: b.narration, visualIntent: b.visualGoal, onScreenText: undefined as string | undefined, transition: undefined as string | undefined };
        for (const e of x.eventMap.events.filter(e => e.beatId === b.id)) {
            const anchor = resolveAnchor(e.anchor, b, x.plan.canvas.fps, start);
            let disposition: EventResolution['disposition'] = "METADATA", mapping = "editorial metadata", reason = "Preserved for review; no implicit executor.";
            switch (e.type) {
                case "VISUAL_LAYER":
                    disposition="PLAN_ONLY";mapping="visual compositor sidecar";reason="External visual layer requires contextual approval and VisualCompositionPlan; no procedural fallback.";break;
                case "VISUAL_FOCUS":
                    mapping = `existing instance ${e.targetInstanceId}`;
                    reason = "Staging is explicit; focus does not retarget the camera automatically.";
                    break;
                case "CAMERA_EMPHASIS": {
                    if (anchor.beatFrame !== 0) {
                        disposition = "PLAN_ONLY";
                        reason = "Existing camera acts for the whole shot; sub-shot camera timing unsupported.";
                        break;
                    }
                    const cams = { PUSH: "CAM_PUSH_IN_001", PULL: "CAM_PULL_OUT_001", ORBIT: "CAM_ORBIT_001", STATIC: "CAM_STATIC_001", PAN: e.panDirection === "LEFT" ? "CAM_PAN_LEFT_001" : "CAM_PAN_RIGHT_001", SHAKE: "CAM_SHAKE_001" };
                    shot.camera = { resourceId: cams[e.movement], parameters: { strength: e.strength } };
                    disposition = "MAPPED";
                    mapping = `shot.camera=${shot.camera.resourceId}`;
                    reason = "Explicit whole-beat camera emphasis.";
                    break;
                }
                case "TEXT_EMPHASIS":
                    if (anchor.beatFrame !== 0 || e.placement) {
                        disposition = "PLAN_ONLY";
                        reason = "Existing onScreenText is whole-shot with fixed renderer layout; timed/custom placement unsupported.";
                        break;
                    }
                    shot.onScreenText = e.text;
                    disposition = "MAPPED";
                    mapping = "shot.onScreenText";
                    reason = "Existing whole-shot label; importance remains metadata.";
                    break;
                case "CUT":
                    shot.transition = "CUT";
                    disposition = "MAPPED";
                    mapping = "authored beat boundary / CUT";
                    reason = "One scene/shot per beat; no internal cut invented.";
                    break;
                case "HOLD":
                    mapping = "retain authored shot interval";
                    reason = "Hold requests no cut during this interval; does not freeze motion/pose.";
                    break;
                case "ATMOSPHERE":
                    mapping = `metadata ${e.mood}`;
                    reason = "No automatic VFX or external asset selection.";
                    break;
                case "SFX_CUE":
                    disposition = "PLAN_ONLY";
                    reason = e.assetRef?.status === "APPROVED" ? "SFX_MIXER_NOT_IMPLEMENTED: approved intention still not executable." : "SFX_UNRESOLVED: no context-approved asset; optional does not authorize silent omission.";
                    break;
                case "BROLL_REQUEST":
                    disposition = "PLAN_ONLY";
                    reason = "BROLL_UNRESOLVED: no media/provider resolution in Phase 9; generation disabled.";
                    break;
            }
            events.push({ event: e, anchor, disposition, mapping, reason });
        }
        const clean = Object.fromEntries(Object.entries(shot).filter(([, v]) => v !== undefined)) as typeof shot;
        directorPlan.scenes.push({ id: `scene_${b.id}`, order: i, narration: b.narration, environment, shots: [clean] });
        start += Math.round(b.durationSeconds * x.plan.canvas.fps);
    });
    // Validate against the actual engine and existing 49 resources, including captions.
    compileDirectorPlan(directorPlan);
    const unresolvedEventIds = events.filter(e => e.disposition === "PLAN_ONLY").map(e => e.event.id);
    if (mode === "STRICT_RENDER" && unresolvedEventIds.length)
        fail("EDITORIAL_UNRESOLVED", events.filter(e => e.disposition === "PLAN_ONLY").map(e => `${e.event.id}: ${e.reason}`).join("; "));
    return { compilerVersion: COMPILER_VERSION, mode, directorPlan, events, unresolvedEventIds, fingerprint: editorialFingerprint(x), qa };
}
/** Explicit acknowledgement of every omitted event. No waiver is inferred from optional=true. */
export function createRenderProjection(result: EditorialCompilation, options: {
    omitEventIds: string[];
    reason: string;
}) {
    if (!options.reason?.trim() || new Set(options.omitEventIds).size !== options.omitEventIds.length || canonicalJson([...options.omitEventIds].sort()) !== canonicalJson([...result.unresolvedEventIds].sort()))
        fail("EDITORIAL_OMISSIONS", "acknowledge exactly all PLAN_ONLY event IDs with reason");
    compileDirectorPlan(result.directorPlan);
    return { directorPlan: JSON.parse(canonicalJson(result.directorPlan)) as DirectorPlan, omittedEvents: result.events.filter(e => e.disposition === "PLAN_ONLY"), reason: options.reason, fingerprint: result.fingerprint };
}
