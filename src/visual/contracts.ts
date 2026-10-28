import type { AssetStatus, Rect, TimingConfidence } from "../editorial/contracts";
export const visualRoles = ["ATMOSPHERE", "REVEAL", "EMPHASIS", "DIRECTION", "CONNECTION", "ENERGY", "DISTORTION"] as const;
export const compositionModes = ["ALPHA", "SCREEN", "ADD", "MULTIPLY", "NORMAL", "CHROMA"] as const;
export const alphaClasses = ["TRUE_ALPHA", "OPAQUE", "BLACK_BACKGROUND", "WHITE_BACKGROUND", "CHROMA_REQUIRED", "BLEND_REQUIRED", "UNKNOWN"] as const;
export type VisualRole = typeof visualRoles[number];
export type CompositionMode = typeof compositionModes[number];
export interface VisualMediaAsset {
    id: string;
    version: 1;
    type: "OVERLAY" | "LIGHT_LEAK" | "DUST" | "GRAPHIC_ELEMENT";
    subtype: "IMAGE" | "VIDEO" | "ARROW" | "LINE" | "ICON" | "STICKER" | "EMOJI";
    roleTags: VisualRole[];
    relativePath: string;
    sourceCatalog: string;
    sourceAuditId: string;
    contentHash: string;
    technicalMetadata: {
        kind: "IMAGE" | "VIDEO";
        format: string;
        codec: string;
        width: number;
        height: number;
        fps: number;
        duration: number;
        frameCount: number;
        sizeBytes: number;
        alphaClass: typeof alphaClasses[number];
        alphaEvidence: {
            method: string;
            min: number;
            max: number;
        };
        decodeVerified: true;
    };
    semanticMetadata: {
        description: string;
        evidence: string;
        safeZoneSuitability?: "REQUIRES_PLACEMENT_CHECK" | "FULL_FRAME_BELOW_CAPTIONS";
    };
    compositionMode: CompositionMode;
    lifecycleStatus: AssetStatus;
    licenseStatus: "UNKNOWN" | "DECLARED" | "VERIFIED";
    provenance: string;
}
export interface VisualApproval {
    id: string;
    assetId: string;
    context: string;
    role: VisualRole;
    sourceHash: string;
    compositionMode: CompositionMode;
    status: "APPROVED" | "REJECTED";
    reviewer: {
        type: "HUMAN";
        id: string;
    };
    reason: string;
    evidence: string;
    reviewDerivativeHash: string;
    reviewedMotion: boolean;
}
export interface VisualSelection {
    eventId: string;
    assetId: string;
    approvalId: string;
    compositionMode: CompositionMode;
    transform: {
        scale: number;
        rotation: number;
    };
    zOrder: "ATMOSPHERE" | "GRAPHIC";
    order: number;
    loopPolicy: "NONE" | "LOOP" | "HOLD_LAST";
    fadeInFrames: number;
    fadeOutFrames: number;
    allowUnsafePlacement: boolean;
    allowCaptionOverlap: boolean;
    crop?: Rect;
}
export interface VisualLayer {
    eventId: string;
    assetId: string;
    sourceHash: string;
    role: VisualRole;
    assetType: VisualMediaAsset['type'];
    kind: "IMAGE" | "VIDEO";
    sourceDuration: number;
    startFrame: number;
    endFrame: number;
    timingConfidence: TimingConfidence;
    compositionMode: CompositionMode;
    opacity: number;
    transform: Rect & {
        scale: number;
        rotation: number;
    };
    crop?: Rect;
    loopPolicy: VisualSelection['loopPolicy'];
    fadeInFrames: number;
    fadeOutFrames: number;
    zOrder: VisualSelection['zOrder'];
    order: number;
    allowUnsafePlacement: boolean;
    allowCaptionOverlap: boolean;
    approvalRef: string;
    purpose: string;
}
export interface VisualCompositionPlan {
    version: 1;
    compositorVersion: "visual-compositor/1.0.0";
    editorialFingerprint: string;
    fps: number;
    canvas: {
        width: number;
        height: number;
    };
    totalFrames: number;
    safeZone: Rect;
    captionZone: Rect;
    layers: VisualLayer[];
    unresolved: {
        eventId: string;
        reason: string;
    }[];
}
export interface VisualBinding {
    eventId: string;
    assetId: string;
    kind: "IMAGE" | "VIDEO";
    frames: string[];
    derivativeFingerprint: string;
    sourceHash: string;
}
export const COMPOSITOR_VERSION = "visual-compositor/1.0.0" as const;
