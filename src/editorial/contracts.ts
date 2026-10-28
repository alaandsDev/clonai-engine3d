import type { DirectorShot } from "../engine3d/contracts";
export const intents = ["HOOK", "SETUP", "FACT", "NUMBER", "ESCALATION", "REVEAL", "CONTRAST", "TRANSITION", "CLIMAX", "QUESTION", "CTA"] as const;
export const informationTypes = ["SCENARIO", "PERSON", "PLACE", "OBJECT", "ACTION", "NUMBER", "COMPARISON", "QUOTE", "ABSTRACT"] as const;
export const assetStatuses = ["DISCOVERED", "CURATED", "TESTED", "APPROVED", "REJECTED"] as const;
export const sfxRoles = ["WHOOSH", "IMPACT", "RISER", "UI", "AMBIENT", "TRANSITION"] as const;
export type AssetStatus = typeof assetStatuses[number];
export type TimingConfidence = "EXACT" | "MEASURED" | "ESTIMATED";
export type TemporalAnchor = {
    type: "BEAT_START" | "BEAT_END";
} | {
    type: "NORMALIZED";
    value: number;
} | {
    type: "WORD" | "PHRASE";
    value: string;
    occurrence?: number;
};
export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface NarrativeBeat {
    id: string;
    narration: string;
    intent: typeof intents[number];
    informationType: typeof informationTypes[number];
    emphasis: "LOW" | "MEDIUM" | "HIGH";
    visualGoal: string;
    /** Authored duration hint, not an acoustic measurement. Quantized to frames. */
    durationSeconds: number;
    /** Explicit staging, never inferred from prose by the engine. */
    staging: Pick<DirectorShot, "characters" | "props" | "actions" | "vfx" | "camera"> & {
        environment: {
            resourceId: string;
        };
    };
}
export interface EditorialPlan {
    version: 1;
    id: string;
    title: string;
    language: string;
    format: "vertical_short";
    canvas: {
        width: number;
        height: number;
        fps: number;
    };
    source: {
        type: "SCRIPT";
        text: string;
    };
    cast: Record<string, string>;
    safeZone: Rect;
    beats: NarrativeBeat[];
}
export interface EditorialAssetRef {
    sourceCatalog: string;
    auditId: string;
    relativePath: string;
    category: "SFX" | "IMAGE" | "VIDEO";
    status: AssetStatus;
    provenance?: string;
    licenseStatus?: "UNKNOWN" | "DECLARED" | "VERIFIED";
}
export interface AssetCandidate {
    assetRef: EditorialAssetRef;
    technicalEvidence?: {
        testId: string;
        sha256: string;
        passed: true;
    };
}
export interface AssetApproval {
    assetRef: EditorialAssetRef;
    status: AssetStatus;
    /** Exact event ID / usage scope. Approval in another context is insufficient. */
    context: string;
    reviewer: {
        type: "HUMAN" | "TECHNICAL_CHECK";
        id: string;
    };
    reason: string;
    evidence: string;
    timestamp?: string;
}
export interface BrollRequest {
    subject: string;
    purpose: string;
    preferredType: "IMAGE" | "VIDEO" | "EITHER";
    durationHint: number;
    visualConstraints: string[];
    generationAllowed: false;
    externalProviderAllowed: false;
}
interface EventBase {
    id: string;
    beatId: string;
    purpose: string;
    anchor: TemporalAnchor;
}
export type EditorialEvent = EventBase & ({
    type: "VISUAL_LAYER";
    role: "ATMOSPHERE" | "REVEAL" | "EMPHASIS" | "DIRECTION" | "CONNECTION" | "ENERGY" | "DISTORTION";
    durationHint: number;
    intensity: number;
    placement: Rect;
} | {
    type: "VISUAL_FOCUS";
    targetInstanceId: string;
} | {
    type: "CAMERA_EMPHASIS";
    movement: "PUSH" | "PULL" | "ORBIT" | "STATIC" | "PAN" | "SHAKE";
    strength: number;
    panDirection?: "LEFT" | "RIGHT";
} | {
    type: "TEXT_EMPHASIS";
    text: string;
    importance: "LOW" | "MEDIUM" | "HIGH";
    placement?: Rect;
} | {
    type: "SFX_CUE";
    role: typeof sfxRoles[number];
    intensity: number;
    optional: boolean;
    assetRef?: EditorialAssetRef;
} | {
    type: "HOLD";
    durationSeconds: number;
} | {
    type: "CUT";
} | {
    type: "ATMOSPHERE";
    mood: "COLD" | "TENSION" | "MYSTERY" | "CALM" | "ENERGY";
} | {
    type: "BROLL_REQUEST";
    request: BrollRequest;
});
export interface EditorialEventMap {
    version: 1;
    planId: string;
    events: EditorialEvent[];
}
export interface EditorialDecision {
    eventId: string;
    decision: string;
    status: "PROPOSED" | "ACCEPTED" | "REJECTED" | "REVISED";
    reason: string;
    attempt: number;
}
export interface EditorialInputs {
    plan: EditorialPlan;
    eventMap: EditorialEventMap;
    catalog: AssetCandidate[];
    approvals: AssetApproval[];
    decisions?: EditorialDecision[];
}
export interface ResolvedAnchor {
    beatFrame: number;
    timelineFrame: number;
    normalized: number;
    timingConfidence: TimingConfidence;
    basis: "AUTHORED_DURATION_ESTIMATED_PROPORTIONAL";
}
export interface EditorialIssue {
    code: string;
    message: string;
    beatId?: string;
    eventId?: string;
}
