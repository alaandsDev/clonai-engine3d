// Browser-safe validators: no filesystem, crypto or Node dependencies in the render graph.
import { fail } from "../engine3d/contracts";
import { relativeAssetPath, rectShape } from "../editorial/schema";
import { assetStatuses } from "../editorial/contracts";
import { visualRoles, compositionModes, alphaClasses, COMPOSITOR_VERSION, type VisualMediaAsset, type VisualApproval, type VisualCompositionPlan, type VisualLayer } from "./contracts";
export const invalid = (s: string): never => fail("VISUAL_INVALID", s);
export function object(x: any, keys: string[], optional: string[] = []) { if (!x || typeof x !== "object" || Array.isArray(x))
    invalid("object required"); for (const k of Object.keys(x))
    if (!keys.includes(k))
        invalid(`unknown field ${k}`); for (const k of keys)
    if (!optional.includes(k) && (!Object.hasOwn(x, k) || x[k] === undefined || x[k] === null))
        invalid(`missing ${k}`); }
export function text(x: any) { if (typeof x !== "string" || !x.trim())
    invalid("text required"); }
export function num(x: any, min: number, max = Number.MAX_SAFE_INTEGER) { if (typeof x !== "number" || !Number.isFinite(x) || x < min || x > max)
    invalid("number range"); }
export function integer(x: any, min: number, max = Number.MAX_SAFE_INTEGER) { num(x, min, max); if (!Number.isInteger(x))
    invalid("integer required"); }
export function sha(x: any) { if (typeof x !== "string" || !/^[a-f0-9]{64}$/.test(x))
    invalid("SHA256 required"); }
export function visualAssetShape(a: any): asserts a is VisualMediaAsset {
    object(a, ["id", "version", "type", "subtype", "roleTags", "relativePath", "sourceCatalog", "sourceAuditId", "contentHash", "technicalMetadata", "semanticMetadata", "compositionMode", "lifecycleStatus", "licenseStatus", "provenance"]);
    if (!/^(DUST|LIGHTLEAK|OVERLAY|GRAPHIC_(ARROW|LINE|ICON|STICKER|EMOJI))_\d{3}$/.test(a.id) || a.version !== 1)
        invalid("visual ID/version");
    if (!["DUST", "LIGHT_LEAK", "OVERLAY", "GRAPHIC_ELEMENT"].includes(a.type))
        invalid("visual type");
    if (a.type === "GRAPHIC_ELEMENT" ? !["ARROW", "LINE", "ICON", "STICKER", "EMOJI"].includes(a.subtype) : !["IMAGE", "VIDEO"].includes(a.subtype))
        invalid("visual subtype");
    const prefix = a.type === "GRAPHIC_ELEMENT" ? `GRAPHIC_${a.subtype}` : a.type === "LIGHT_LEAK" ? "LIGHTLEAK" : a.type;
    if (!a.id.startsWith(prefix + "_"))
        invalid("ID/type mismatch");
    if (!Array.isArray(a.roleTags) || !a.roleTags.length || new Set(a.roleTags).size !== a.roleTags.length || a.roleTags.some((r: any) => !visualRoles.includes(r)))
        invalid("roles");
    relativeAssetPath(a.relativePath);
    if (a.relativePath.includes('"'))
        invalid("path");
    sha(a.contentHash);
    for (const k of ["sourceCatalog", "sourceAuditId", "provenance"])
        text(a[k]);
    if (!assetStatuses.includes(a.lifecycleStatus) || !["UNKNOWN", "DECLARED", "VERIFIED"].includes(a.licenseStatus) || !compositionModes.includes(a.compositionMode))
        invalid("state/mode");
    const t = a.technicalMetadata;
    object(t, ["kind", "format", "codec", "width", "height", "fps", "duration", "frameCount", "sizeBytes", "alphaClass", "alphaEvidence", "decodeVerified"]);
    if (!["IMAGE", "VIDEO"].includes(t.kind) || t.decodeVerified !== true)
        invalid("kind/decode");
    text(t.format);
    text(t.codec);
    integer(t.width, 1, 16384);
    integer(t.height, 1, 16384);
    integer(t.sizeBytes, 1, 100 * 1024 * 1024);
    integer(t.frameCount, 1, 10000);
    if (t.kind === "VIDEO") {
        num(t.fps, 1, 120);
        num(t.duration, Number.EPSILON, 120);
        if (a.subtype !== "VIDEO")
            invalid("video subtype");
    }
    else {
        if (t.fps !== 0 || t.duration !== 0 || t.frameCount !== 1)
            invalid("image timing");
        if (a.type !== "GRAPHIC_ELEMENT" && a.subtype !== "IMAGE")
            invalid("image subtype");
    }
    if (!alphaClasses.includes(t.alphaClass))
        invalid("alpha class");
    object(t.alphaEvidence, ["method", "min", "max"]);
    text(t.alphaEvidence.method);
    integer(t.alphaEvidence.min, 0, 255);
    integer(t.alphaEvidence.max, t.alphaEvidence.min, 255);
    if (t.alphaClass === "TRUE_ALPHA" && t.alphaEvidence.min === 255)
        invalid("alpha not evidenced");
    if (a.compositionMode === "ALPHA" && t.alphaClass !== "TRUE_ALPHA")
        invalid("ALPHA requires measured transparency");
    if (["OPAQUE", "BLACK_BACKGROUND", "WHITE_BACKGROUND", "CHROMA_REQUIRED", "BLEND_REQUIRED"].includes(t.alphaClass) && (t.alphaEvidence.min !== 255 || t.alphaEvidence.max !== 255))
        invalid("opaque alpha classification contradicts measurements");
    object(a.semanticMetadata, ["description", "evidence", "safeZoneSuitability"],["safeZoneSuitability"]);
    text(a.semanticMetadata.description);
    text(a.semanticMetadata.evidence);
    if(a.semanticMetadata.safeZoneSuitability!==undefined&&!["REQUIRES_PLACEMENT_CHECK","FULL_FRAME_BELOW_CAPTIONS"].includes(a.semanticMetadata.safeZoneSuitability))invalid("safe-zone suitability");
}
export function visualApprovalShape(a: any): asserts a is VisualApproval { object(a, ["id", "assetId", "context", "role", "sourceHash", "compositionMode", "status", "reviewer", "reason", "evidence", "reviewDerivativeHash", "reviewedMotion"]); for (const k of ["id", "assetId", "context", "reason", "evidence"])
    text(a[k]); if (!visualRoles.includes(a.role) || !compositionModes.includes(a.compositionMode) || !["APPROVED", "REJECTED"].includes(a.status))
    invalid("approval enums"); sha(a.sourceHash); sha(a.reviewDerivativeHash); object(a.reviewer, ["type", "id"]); if (a.reviewer.type !== "HUMAN")
    invalid("explicit HUMAN required"); text(a.reviewer.id); if (typeof a.reviewedMotion !== "boolean")
    invalid("motion review flag"); }
export function bounds(l: VisualLayer, canvas: {
    width: number;
    height: number;
}) { const r = l.transform, c = Math.abs(Math.cos(r.rotation * Math.PI / 180)), s = Math.abs(Math.sin(r.rotation * Math.PI / 180)), w = r.width * r.scale * c + r.height * r.scale * s * canvas.height / canvas.width, h = r.height * r.scale * c + r.width * r.scale * s * canvas.width / canvas.height; return { x: r.x + r.width / 2 - w / 2, y: r.y + r.height / 2 - h / 2, width: w, height: h }; }
const inside = (a: any, b: any) => a.x >= b.x - 1e-9 && a.y >= b.y - 1e-9 && a.x + a.width <= b.x + b.width + 1e-9 && a.y + a.height <= b.y + b.height + 1e-9;
const overlap = (a: any, b: any) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
export function visualPlanShape(p: any): asserts p is VisualCompositionPlan {
    object(p, ["version", "compositorVersion", "editorialFingerprint", "fps", "canvas", "totalFrames", "safeZone", "captionZone", "layers", "unresolved"]);
    if (p.version !== 1 || p.compositorVersion !== COMPOSITOR_VERSION)
        invalid("composition version");
    sha(p.editorialFingerprint);
    integer(p.fps, 1, 60);
    object(p.canvas, ["width", "height"]);
    integer(p.canvas.width, 2, 8192);
    integer(p.canvas.height, 2, 8192);
    integer(p.totalFrames, 1, 7200);
    rectShape(p.safeZone);
    rectShape(p.captionZone);
    if (!Array.isArray(p.layers) || !Array.isArray(p.unresolved))
        invalid("layer lists");
    const ids = new Set(), orders = new Set();
    for (const l of p.layers) {
        object(l, ["eventId", "assetId", "sourceHash", "role", "assetType", "kind", "sourceDuration", "startFrame", "endFrame", "timingConfidence", "compositionMode", "opacity", "transform", "crop", "loopPolicy", "fadeInFrames", "fadeOutFrames", "zOrder", "order", "allowUnsafePlacement", "allowCaptionOverlap", "approvalRef", "purpose"], ["crop"]);
        for (const k of ["eventId", "assetId", "approvalRef", "purpose"])
            text(l[k]);
        if (ids.has(l.eventId))
            invalid("duplicate layer ID");
        ids.add(l.eventId);
        sha(l.sourceHash);
        if (!visualRoles.includes(l.role) || !["GRAPHIC_ELEMENT", "DUST", "LIGHT_LEAK", "OVERLAY"].includes(l.assetType) || !["IMAGE", "VIDEO"].includes(l.kind) || !["EXACT", "MEASURED", "ESTIMATED"].includes(l.timingConfidence))
            invalid("layer enums");
        if (!compositionModes.includes(l.compositionMode))
            invalid("blend mode");
        num(l.opacity, 0, 1);
        integer(l.startFrame, 0, p.totalFrames - 1);
        integer(l.endFrame, l.startFrame + 1, p.totalFrames);
        num(l.sourceDuration, 0, 120);
        integer(l.fadeInFrames, 0, l.endFrame - l.startFrame);
        integer(l.fadeOutFrames, 0, l.endFrame - l.startFrame);
        if (l.fadeInFrames + l.fadeOutFrames > l.endFrame - l.startFrame)
            invalid("fades overlap");
        object(l.transform, ["x", "y", "width", "height", "scale", "rotation"]);
        rectShape({ x: l.transform.x, y: l.transform.y, width: l.transform.width, height: l.transform.height });
        num(l.transform.scale, 0.01, 4);
        num(l.transform.rotation, -360, 360);
        if (l.crop)
            rectShape(l.crop);
        if (!["NONE", "LOOP", "HOLD_LAST"].includes(l.loopPolicy) || !["ATMOSPHERE", "GRAPHIC"].includes(l.zOrder) || typeof l.allowUnsafePlacement !== "boolean" || typeof l.allowCaptionOverlap !== "boolean")
            invalid("loop/z-order/override");
        integer(l.order, 0, 99);
        const order = `${l.zOrder}/${l.order}`;
        if (orders.has(order))
            invalid("ambiguous z-order");
        orders.add(order);
        if (l.assetType === "GRAPHIC_ELEMENT") {
            const box = bounds(l, p.canvas);
            if (l.zOrder !== "GRAPHIC")
                invalid("graphics must use GRAPHIC z-order");
            if (!l.allowUnsafePlacement && !inside(box, p.safeZone))
                invalid("outside safe zone");
            if (!l.allowCaptionOverlap && overlap(box, p.captionZone))
                invalid("caption occlusion");
        }
        else if (l.zOrder !== "ATMOSPHERE")
            invalid("atmosphere must remain below graphics/text/caption");
        if (l.kind === "VIDEO" && l.loopPolicy === "NONE" && (l.endFrame - l.startFrame) > Math.ceil(l.sourceDuration * p.fps))
            invalid("video too short without explicit loop/hold");
    }
    for (const u of p.unresolved) {
        object(u, ["eventId", "reason"]);
        text(u.eventId);
        text(u.reason);
        if (ids.has(u.eventId))
            invalid("duplicate pending event");
        ids.add(u.eventId);
    }
    const points = p.layers.flatMap((l: VisualLayer) => [{ f: l.startFrame, d: 1 }, { f: l.endFrame, d: -1 }]).sort((a: any, b: any) => a.f - b.f || a.d - b.d);
    let simultaneous = 0;
    for (const point of points) {
        simultaneous += point.d;
        if (simultaneous > 3)
            invalid("more than three simultaneous external layers");
    }
}
