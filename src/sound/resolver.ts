import { compileEditorial, type EditorialCompilation } from "../editorial/compiler";
import type { EditorialInputs } from "../editorial/contracts";
import { canonicalJson, jsonHash } from "../editorial/fingerprint";
import { fail } from "../engine3d/contracts";
import { eventMapShape } from "../editorial/schema";
import { MediaAssetRegistry, validateApprovals, object, str, number, hash, soundFail } from "./registry";
import type { CueSelection, Ducking, ResolvedSfxCue, SfxApproval, SoundDesignPlan } from "./contracts";
export const defaultDucking: Ducking = { enabled: true, amountDb: 6, attack: 0.03, release: 0.15, thresholdDb: -45 };
export function duckingShape(d: any): asserts d is Ducking { object(d, ["enabled", "amountDb", "attack", "release", "thresholdDb"]); if (typeof d.enabled !== "boolean")
    soundFail("duck enabled boolean"); number(d.amountDb, 0, 24); number(d.attack, 0.001, 2); number(d.release, 0.001, 5); number(d.thresholdDb, -80, -10); }
export function cueShape(c: any, duration: number) {
    object(c, ["eventId", "assetId", "role", "context", "sourceHash", "anchor", "anchorFrame", "anchorSeconds", "timingConfidence", "resolvedStart", "sourceIn", "sourceOut", "windowPolicy", "gainDb", "fadeIn", "fadeOut", "ducking", "purpose", "approvalRef"]);
    for (const k of ["eventId", "assetId", "context", "purpose", "approvalRef"])
        str(c[k]);
    hash(c.sourceHash);
    number(c.sourceIn, 0);
    number(c.sourceOut, Number.EPSILON);
    if (c.sourceOut <= c.sourceIn)
        soundFail("invalid source window");
    number(c.resolvedStart, 0);
    number(c.anchorFrame, 0);
    if (!Number.isInteger(c.anchorFrame))
        soundFail("anchor frame integer");
    number(c.anchorSeconds, 0);
    number(c.gainDb, -30, 0);
    number(c.fadeIn, 0, c.sourceOut - c.sourceIn);
    number(c.fadeOut, 0, c.sourceOut - c.sourceIn);
    if (c.fadeIn + c.fadeOut > c.sourceOut - c.sourceIn)
        soundFail("fades overlap");
    duckingShape(c.ducking);
    if (c.context !== c.eventId)
        soundFail("approval context must be exact event ID");
    eventMapShape({ version: 1, planId: "sound", events: [{ id: "check", beatId: "beat", type: "SFX_CUE", anchor: c.anchor, purpose: c.purpose, role: c.role, intensity: 0, optional: true }] });
    if (!["EXACT", "MEASURED", "ESTIMATED"].includes(c.timingConfidence) || !["EXPLICIT", "FULL_SOURCE"].includes(c.windowPolicy))
        soundFail("timing/window policy");
    if (c.resolvedStart + c.sourceOut - c.sourceIn > duration + 1e-9)
        soundFail("cue outside timeline");
}
export function soundPlanShape(p: any): asserts p is SoundDesignPlan { object(p, ["version", "editorialFingerprint", "fps", "durationSeconds", "mode", "cues", "unresolved"]); if (p.version !== 1 || !["PLAN_ONLY", "STRICT_RENDER"].includes(p.mode))
    soundFail("sound plan version/mode"); hash(p.editorialFingerprint); number(p.fps, 1, 240); if (!Number.isInteger(p.fps))
    soundFail("fps integer"); number(p.durationSeconds, Number.EPSILON, 120); if (!Array.isArray(p.cues) || !Array.isArray(p.unresolved))
    soundFail("cue lists"); const ids = new Set(); for (const c of p.cues) {
    cueShape(c, p.durationSeconds);
    if (Math.abs(c.anchorFrame / p.fps - c.anchorSeconds) > 1e-9 || c.anchorSeconds !== c.resolvedStart)
        soundFail("anchor seconds/frame/start mismatch");
    if (ids.has(c.eventId))
        soundFail("duplicate resolved cue");
    ids.add(c.eventId);
} for (const u of p.unresolved) {
    object(u, ["eventId", "status", "reason"]);
    str(u.eventId);
    str(u.reason);
    if (!["PLAN_ONLY", "OMITTED_OPTIONAL"].includes(u.status) || ids.has(u.eventId))
        soundFail("unresolved status/duplicate");
    ids.add(u.eventId);
} canonicalJson(p); }
export function resolveSoundDesign(input: EditorialInputs, registry: MediaAssetRegistry, approvals: SfxApproval[], selections: CueSelection[], mode: "PLAN_ONLY" | "STRICT_RENDER"): SoundDesignPlan {
    validateApprovals(approvals, registry);
    if (!["PLAN_ONLY", "STRICT_RENDER"].includes(mode))
        soundFail("mode");
    const compiled = compileEditorial(input, "PLAN_ONLY");
    return resolveCompiledSound(compiled, input.plan.canvas.fps, input.plan.beats.reduce((s, b) => s + Math.round(b.durationSeconds * input.plan.canvas.fps) / input.plan.canvas.fps, 0), registry, approvals, selections, mode);
}
export function resolveCompiledSound(compiled: EditorialCompilation, fps: number, duration: number, registry: MediaAssetRegistry, approvals: SfxApproval[], selections: CueSelection[], mode: "PLAN_ONLY" | "STRICT_RENDER"): SoundDesignPlan {
    validateApprovals(approvals, registry);
    if (!Array.isArray(selections) || new Set(selections.map(s => s.eventId)).size !== selections.length)
        soundFail("duplicate/invalid selection");
    const p: SoundDesignPlan = { version: 1, editorialFingerprint: compiled.fingerprint, fps, durationSeconds: duration, mode, cues: [], unresolved: [] };
    for (const s of selections) {
        object(s, ["eventId", "assetId", "approvalId", "context", "sourceIn", "sourceOut", "gainDb", "fadeIn", "fadeOut", "ducking"], ["sourceIn", "sourceOut", "gainDb", "fadeIn", "fadeOut", "ducking"]);
        if (!compiled.events.some(e => e.event.type === "SFX_CUE" && e.event.id === s.eventId))
            soundFail("orphan selection");
    }
    for (const r of compiled.events) {
        const e = r.event;
        if (e.type !== "SFX_CUE")
            continue;
        const s = selections.find(s => s.eventId === e.id);
        let asset = s ? registry.get(s.assetId) : undefined;
        const approval = s && approvals.find(a => a.id === s.approvalId);
        if (asset?.lifecycleStatus === "REJECTED")
            soundFail("rejected asset");
        if (asset && e.assetRef && (asset.sourceAuditId !== e.assetRef.auditId || asset.sourceCatalog !== e.assetRef.sourceCatalog || asset.relativePath !== e.assetRef.relativePath))
            soundFail("selected asset contradicts editorial reference");
        if (s && (!approval || s.context !== e.id || approval.assetId !== s.assetId || approval.role !== e.role || approval.context !== s.context || approval.sourceHash !== asset!.contentHash || !asset!.roleTags.includes(e.role)))
            soundFail("selection approval/hash/role/context mismatch");
        if (approval?.status === "REJECTED")
            soundFail("context rejected");
        if (!s || !asset || !["TESTED", "APPROVED"].includes(asset.lifecycleStatus) || approval?.status !== "APPROVED") {
            if (mode === "STRICT_RENDER" && !e.optional)
                fail("SFX_REQUIRED_UNRESOLVED", e.id);
            p.unresolved.push({ eventId: e.id, status: mode === "STRICT_RENDER" ? "OMITTED_OPTIONAL" : "PLAN_ONLY", reason: "No explicit context-approved selection" });
            continue;
        }
        const sourceIn = s.sourceIn ?? 0, sourceOut = s.sourceOut ?? asset.technicalMetadata.duration;
        if (sourceOut > asset.technicalMetadata.duration)
            soundFail("window beyond asset duration");
        const cue: ResolvedSfxCue = { eventId: e.id, assetId: asset.id, role: e.role, context: s.context, sourceHash: asset.contentHash, anchor: e.anchor, anchorFrame: r.anchor.timelineFrame, anchorSeconds: r.anchor.timelineFrame / fps, timingConfidence: r.anchor.timingConfidence, resolvedStart: r.anchor.timelineFrame / fps, sourceIn, sourceOut, windowPolicy: s.sourceIn === undefined && s.sourceOut === undefined ? "FULL_SOURCE" : "EXPLICIT", gainDb: s.gainDb ?? -24, fadeIn: s.fadeIn ?? 0.005, fadeOut: s.fadeOut ?? 0.02, ducking: s.ducking ?? { ...defaultDucking }, purpose: e.purpose, approvalRef: approval.id };
        cueShape(cue, duration);
        p.cues.push(cue);
    }
    soundPlanShape(p);
    return p;
}
export const MIXER_VERSION = "sound-mixer/1.0.0";
export function mixFingerprint(plan: SoundDesignPlan, voiceHash: string, assets: {
    id: string;
    contentHash: string;
}[]) { soundPlanShape(plan); hash(voiceHash); return jsonHash({ mixerVersion: MIXER_VERSION, plan, voiceHash, assets: assets.filter(a => plan.cues.some(c => c.assetId === a.id)).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0), sampleRate: 48000, channels: 2, policy: { peakLimit: 0.98, silenceRms: 1e-8, voiceWindowSamples: 960 } }); }
