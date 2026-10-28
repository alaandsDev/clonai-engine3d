import { MediaAssetRegistry } from "../sound/registry";
import { compileEditorial } from "../editorial/compiler";
import { jsonHash, canonicalJson } from "../editorial/fingerprint";
import type { EditorialInputs } from "../editorial/contracts";
import { visualApprovalShape, visualPlanShape, invalid, object } from "./schema";
import { COMPOSITOR_VERSION, type VisualApproval, type VisualMediaAsset, type VisualSelection, type VisualCompositionPlan } from "./contracts";
export function validateVisualApprovals(records: unknown, registry: MediaAssetRegistry<VisualMediaAsset>): asserts records is VisualApproval[] {
    if (!Array.isArray(records))
        invalid("approval list");
    const ids = new Set(), contexts = new Set();
    for (const r of records as unknown[]) {
        visualApprovalShape(r);
        if (ids.has(r.id))
            invalid("duplicate approval");
        ids.add(r.id);
        const k = `${r.assetId}/${r.role}/${r.context}`;
        if (contexts.has(k))
            invalid("ambiguous context review");
        contexts.add(k);
        const a = registry.get(r.assetId);
        if (a.contentHash !== r.sourceHash || !a.roleTags.includes(r.role) || a.compositionMode !== r.compositionMode)
            invalid("approval/source/mode/role mismatch");
        if (a.technicalMetadata.kind === "VIDEO" && !r.reviewedMotion)
            invalid("video requires moving preview review; contact sheet is insufficient");
    }
}
export function resolveVisual(input: EditorialInputs, registry: MediaAssetRegistry<VisualMediaAsset>, approvals: VisualApproval[], selections: VisualSelection[], mode: "PLAN_ONLY" | "STRICT_RENDER"): VisualCompositionPlan {
    validateVisualApprovals(approvals, registry);
    if (!["PLAN_ONLY", "STRICT_RENDER"].includes(mode) || !Array.isArray(selections))
        invalid("mode/selections");
    const compiled = compileEditorial(input, "PLAN_ONLY");
    const p: VisualCompositionPlan = { version: 1, compositorVersion: COMPOSITOR_VERSION, editorialFingerprint: compiled.fingerprint, fps: input.plan.canvas.fps, canvas: { width: input.plan.canvas.width, height: input.plan.canvas.height }, totalFrames: input.plan.beats.reduce((n, b) => n + Math.round(b.durationSeconds * input.plan.canvas.fps), 0), safeZone: input.plan.safeZone, captionZone: { x: .07, y: .72, width: .86, height: .2 }, layers: [], unresolved: [] };
    if (new Set(selections.map(s => s.eventId)).size !== selections.length)
        invalid("duplicate visual selections");
    for (const s of selections) {
        object(s, ["eventId", "assetId", "approvalId", "compositionMode", "transform", "zOrder", "order", "loopPolicy", "fadeInFrames", "fadeOutFrames", "allowUnsafePlacement", "allowCaptionOverlap", "crop"], ["crop"]);
        object(s.transform, ["scale", "rotation"]);
        if (!compiled.events.some(e => e.event.type === "VISUAL_LAYER" && e.event.id === s.eventId))
            invalid("orphan visual selection");
    }
    for (const r of compiled.events) {
        const e = r.event;
        if (e.type !== "VISUAL_LAYER")
            continue;
        const s = selections.find(s => s.eventId === e.id);
        if (!s) {
            p.unresolved.push({ eventId: e.id, reason: "No explicitly approved visual selection" });
            continue;
        }
        const a = registry.get(s.assetId), review = approvals.find(a => a.id === s.approvalId);
        if (!review || review.status !== "APPROVED" || review.context !== e.id || review.assetId !== a.id || review.role !== e.role || review.compositionMode !== s.compositionMode || a.compositionMode !== s.compositionMode || !["TESTED", "APPROVED"].includes(a.lifecycleStatus))
            invalid("unapproved/rejected/contextual visual asset");
        if (s.compositionMode === "CHROMA") {
            p.unresolved.push({ eventId: e.id, reason: "CHROMA recognized but no safe executor in Phase11" });
            continue;
        }
        p.layers.push({ eventId: e.id, assetId: a.id, sourceHash: a.contentHash, role: e.role, assetType: a.type, kind: a.technicalMetadata.kind, sourceDuration: a.technicalMetadata.duration, startFrame: r.anchor.timelineFrame, endFrame: r.anchor.timelineFrame + Math.round(e.durationHint * p.fps), timingConfidence: r.anchor.timingConfidence, compositionMode: s.compositionMode, opacity: e.intensity, transform: { ...e.placement, ...s.transform }, ...(s.crop ? { crop: s.crop } : {}), loopPolicy: s.loopPolicy, fadeInFrames: s.fadeInFrames, fadeOutFrames: s.fadeOutFrames, zOrder: s.zOrder, order: s.order, allowUnsafePlacement: s.allowUnsafePlacement, allowCaptionOverlap: s.allowCaptionOverlap, approvalRef: review!.id, purpose: e.purpose });
    }
    visualPlanShape(p);
    if (mode === "STRICT_RENDER" && p.unresolved.length)
        invalid("unresolved visual layers: " + p.unresolved.map(u => u.eventId).join(","));
    return p;
}
export function visualFingerprint(plan: VisualCompositionPlan, approvals: VisualApproval[], derivatives: unknown) { visualPlanShape(plan); return jsonHash({ compositorVersion: COMPOSITOR_VERSION, plan, approvals: approvals.filter(a => plan.layers.some(l => l.approvalRef === a.id)).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0), derivatives }); }
