import { fail } from "../engine3d/contracts";
import { planShape } from "../engine3d/schema";
import { intents, informationTypes, assetStatuses, sfxRoles, type EditorialPlan, type EditorialEventMap, type EditorialInputs, type EditorialAssetRef, type Rect } from "./contracts";
const error = (message: string): never => fail("EDITORIAL_SCHEMA", message);
function obj(x: any, keys: string[], required = keys): void {
    if (!x || typeof x !== "object" || Array.isArray(x) || ![Object.prototype, null].includes(Object.getPrototypeOf(x)))
        error("expected plain object");
    for (const k of Object.keys(x))
        if (!keys.includes(k))
            error(`unknown field ${k}`);
    for (const k of required)
        if (!Object.hasOwn(x, k) || x[k] === undefined || x[k] === null)
            error(`missing field ${k}`);
}
const text = (x: unknown) => { if (typeof x !== "string" || !x.trim())
    error("expected nonempty string"); };
const one = (x: unknown, values: readonly unknown[]) => { if (!values.includes(x))
    error(`invalid enum ${String(x)}`); };
const num = (x: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => { if (typeof x !== "number" || !Number.isFinite(x) || x < min || x > max)
    error("number out of range"); };
function list(x: unknown): asserts x is any[] { if (!Array.isArray(x))
    error("expected array"); }
const id = (x: unknown) => { text(x); if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,99}$/.test(x as string))
    error("invalid ID"); };
export function relativeAssetPath(x: unknown): asserts x is string {
    text(x);
    if (/^[\/\\]|[\\:\x00-\x1f]|[?*<>|]/.test(x as string) || (x as string).split("/").some(s => !s || s === "." || s === ".." || /[. ]$/.test(s) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s)))
        error("unsafe relative asset path");
}
export function rectShape(r: any): asserts r is Rect {
    obj(r, ["x", "y", "width", "height"]);
    num(r.x, 0, 1);
    num(r.y, 0, 1);
    num(r.width, Number.EPSILON, 1);
    num(r.height, Number.EPSILON, 1);
    if (r.x + r.width > 1 + 1e-12 || r.y + r.height > 1 + 1e-12)
        error("rectangle outside normalized canvas");
}
export function assetRefShape(a: any): asserts a is EditorialAssetRef {
    obj(a, ["sourceCatalog", "auditId", "relativePath", "category", "status", "provenance", "licenseStatus"], ["sourceCatalog", "auditId", "relativePath", "category", "status"]);
    id(a.sourceCatalog);
    id(a.auditId);
    relativeAssetPath(a.relativePath);
    one(a.category, ["SFX", "IMAGE", "VIDEO"]);
    one(a.status, assetStatuses);
    if (Object.hasOwn(a, "provenance"))
        text(a.provenance);
    if (Object.hasOwn(a, "licenseStatus"))
        one(a.licenseStatus, ["UNKNOWN", "DECLARED", "VERIFIED"]);
}
export function editorialPlanShape(p: any): asserts p is EditorialPlan {
    obj(p, ["version", "id", "title", "language", "format", "canvas", "source", "cast", "safeZone", "beats"]);
    one(p.version, [1]);
    id(p.id);
    text(p.title);
    text(p.language);
    one(p.format, ["vertical_short"]);
    rectShape(p.safeZone);
    obj(p.canvas, ["width", "height", "fps"]);
    for (const k of ["width", "height", "fps"]) {
        num(p.canvas[k], 1, 16384);
        if (!Number.isInteger(p.canvas[k]))
            error("canvas requires integers");
    }
    if (p.canvas.width >= p.canvas.height || p.canvas.width % 2 || p.canvas.height % 2)
        error("vertical even canvas required");
    obj(p.source, ["type", "text"]);
    one(p.source.type, ["SCRIPT"]);
    text(p.source.text);
    list(p.beats);
    if (!p.beats.length)
        error("empty beats");
    const ids = new Set();
    for (const b of p.beats) {
        obj(b, ["id", "narration", "intent", "informationType", "emphasis", "visualGoal", "durationSeconds", "staging"]);
        id(b.id);
        if (ids.has(b.id))
            error("duplicate beat");
        ids.add(b.id);
        text(b.narration);
        text(b.visualGoal);
        one(b.intent, intents);
        one(b.informationType, informationTypes);
        one(b.emphasis, ["LOW", "MEDIUM", "HIGH"]);
        num(b.durationSeconds, 0.1, 120);
        if (Math.round(b.durationSeconds * p.canvas.fps) < 1)
            error("beat requires at least one frame");
        obj(b.staging, ["environment", "characters", "props", "actions", "vfx", "camera"]);
    }
    if (p.source.text.replace(/\s+/gu, " ").trim() !== p.beats.map((b: any) => b.narration).join(" ").replace(/\s+/gu, " ").trim())
        error("source text must equal ordered beat narration");
    // Reuse the execution schema as a structural boundary, without altering it.
    planShape({ id: p.id, title: p.title, format: p.canvas, style: "editorial-pilot", timingMode: "fixed", cast: p.cast, scenes: p.beats.map((b: any, i: number) => ({ id: `scene_${b.id}`, order: i, narration: b.narration, environment: b.staging.environment, shots: [{ ...b.staging, environment: undefined, id: `shot_${b.id}`, order: 0, durationSeconds: b.durationSeconds, narrationSegment: b.narration }] })).map((s: any) => { delete s.shots[0].environment; return s; }) });
}
export function eventMapShape(m: any): asserts m is EditorialEventMap {
    obj(m, ["version", "planId", "events"]);
    one(m.version, [1]);
    id(m.planId);
    list(m.events);
    const ids = new Set();
    const fields: Record<string, string[]> = { VISUAL_LAYER:["role","durationHint","intensity","placement"],VISUAL_FOCUS: ["targetInstanceId"], CAMERA_EMPHASIS: ["movement", "strength", "panDirection"], TEXT_EMPHASIS: ["text", "importance", "placement"], SFX_CUE: ["role", "intensity", "optional", "assetRef"], HOLD: ["durationSeconds"], CUT: [], ATMOSPHERE: ["mood"], BROLL_REQUEST: ["request"] };
    for (const e of m.events) {
        if (!e || typeof e !== "object" || !Object.hasOwn(fields, e.type))
            error("invalid event type");
        const base = ["id", "beatId", "purpose", "anchor", "type"];
        obj(e, [...base, ...fields[e.type]], base);
        id(e.id);
        id(e.beatId);
        text(e.purpose);
        if (ids.has(e.id))
            error("duplicate event");
        ids.add(e.id);
        const a = e.anchor;
        if (!a || typeof a !== "object")
            error("missing anchor");
        one(a.type, ["BEAT_START", "BEAT_END", "NORMALIZED", "WORD", "PHRASE"]);
        obj(a, a.type === "WORD" || a.type === "PHRASE" ? ["type", "value", "occurrence"] : a.type === "NORMALIZED" ? ["type", "value"] : ["type"], a.type === "BEAT_START" || a.type === "BEAT_END" ? ["type"] : ["type", "value"]);
        if (a.type === "NORMALIZED")
            num(a.value, 0, 1);
        if (a.type === "WORD" || a.type === "PHRASE") {
            text(a.value);
            if (Object.hasOwn(a, "occurrence")) {
                num(a.occurrence, 1);
                if (!Number.isInteger(a.occurrence))
                    error("occurrence integer required");
            }
        }
        switch (e.type) {
            case "VISUAL_LAYER":
                one(e.role,["ATMOSPHERE","REVEAL","EMPHASIS","DIRECTION","CONNECTION","ENERGY","DISTORTION"]);
                num(e.durationHint,Number.EPSILON,120);num(e.intensity,0,1);rectShape(e.placement);break;
            case "VISUAL_FOCUS":
                text(e.targetInstanceId);
                break;
            case "CAMERA_EMPHASIS":
                one(e.movement, ["PUSH", "PULL", "ORBIT", "STATIC", "PAN", "SHAKE"]);
                num(e.strength, 0, 3);
                if (e.movement === "PAN")
                    one(e.panDirection, ["LEFT", "RIGHT"]);
                else if (Object.hasOwn(e, "panDirection"))
                    error("panDirection only for PAN");
                break;
            case "TEXT_EMPHASIS":
                text(e.text);
                one(e.importance, ["LOW", "MEDIUM", "HIGH"]);
                if (Object.hasOwn(e, "placement"))
                    rectShape(e.placement);
                break;
            case "SFX_CUE":
                one(e.role, sfxRoles);
                num(e.intensity, 0, 1);
                one(e.optional, [true, false]);
                if (Object.hasOwn(e, "assetRef")) {
                    assetRefShape(e.assetRef);
                    one(e.assetRef.category, ["SFX"]);
                }
                break;
            case "HOLD":
                num(e.durationSeconds, Number.EPSILON, 120);
                break;
            case "ATMOSPHERE":
                one(e.mood, ["COLD", "TENSION", "MYSTERY", "CALM", "ENERGY"]);
                break;
            case "BROLL_REQUEST": {
                const b = e.request;
                obj(b, ["subject", "purpose", "preferredType", "durationHint", "visualConstraints", "generationAllowed", "externalProviderAllowed"]);
                text(b.subject);
                text(b.purpose);
                one(b.preferredType, ["IMAGE", "VIDEO", "EITHER"]);
                num(b.durationHint, Number.EPSILON, 120);
                list(b.visualConstraints);
                b.visualConstraints.forEach(text);
                one(b.generationAllowed, [false]);
                one(b.externalProviderAllowed, [false]);
                break;
            }
        }
    }
}
export function inputsShape(x: any): asserts x is EditorialInputs {
    obj(x, ["plan", "eventMap", "catalog", "approvals", "decisions"], ["plan", "eventMap", "catalog", "approvals"]);
    editorialPlanShape(x.plan);
    eventMapShape(x.eventMap);
    list(x.catalog);
    list(x.approvals);
    const keys = new Set();
    for (const c of x.catalog) {
        obj(c, ["assetRef", "technicalEvidence"], ["assetRef"]);
        assetRefShape(c.assetRef);
        const k = `${c.assetRef.sourceCatalog}/${c.assetRef.auditId}`;
        if (keys.has(k))
            error("duplicate asset");
        keys.add(k);
        if (Object.hasOwn(c, "technicalEvidence")) {
            const t = c.technicalEvidence;
            obj(t, ["testId", "sha256", "passed"]);
            id(t.testId);
            if (typeof t.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(t.sha256))
                error("invalid content hash");
            one(t.passed, [true]);
        }
        if (["TESTED", "APPROVED"].includes(c.assetRef.status) && !c.technicalEvidence)
            error("technical evidence required");
    }
    for (const a of x.approvals) {
        obj(a, ["assetRef", "status", "context", "reviewer", "reason", "evidence", "timestamp"], ["assetRef", "status", "context", "reviewer", "reason", "evidence"]);
        assetRefShape(a.assetRef);
        one(a.status, assetStatuses);
        if (a.status !== a.assetRef.status)
            error("approval status mismatch");
        text(a.context);
        text(a.reason);
        text(a.evidence);
        obj(a.reviewer, ["type", "id"]);
        one(a.reviewer.type, ["HUMAN", "TECHNICAL_CHECK"]);
        text(a.reviewer.id);
        if (a.status === "APPROVED" && a.reviewer.type !== "HUMAN")
            error("human review required");
        if (Object.hasOwn(a, "timestamp")) {
            text(a.timestamp);
            if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(a.timestamp) || !Number.isFinite(Date.parse(a.timestamp)))
                error("invalid explicit timestamp");
        }
    }
    if (Object.hasOwn(x, "decisions")) {
        list(x.decisions);
        for (const d of x.decisions) {
            obj(d, ["eventId", "decision", "status", "reason", "attempt"]);
            id(d.eventId);
            text(d.decision);
            text(d.reason);
            one(d.status, ["PROPOSED", "ACCEPTED", "REJECTED", "REVISED"]);
            num(d.attempt, 1);
            if (!Number.isInteger(d.attempt))
                error("attempt integer required");
        }
    }
}
