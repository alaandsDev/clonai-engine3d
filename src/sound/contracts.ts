import type { AssetStatus, TemporalAnchor, TimingConfidence, sfxRoles } from "../editorial/contracts";
export type SfxRole = typeof sfxRoles[number];
export interface MediaAsset {
    id: string;
    version: 1;
    type: "AUDIO";
    subtype: "SFX";
    roleTags: SfxRole[];
    relativePath: string;
    sourceCatalog: string;
    sourceAuditId: string;
    contentHash: string;
    technicalMetadata: {
        codec: string;
        sampleRate: number;
        channels: number;
        duration: number;
        sizeBytes: number;
    };
    semanticMetadata: {
        description: string;
        evidence: string;
    };
    lifecycleStatus: AssetStatus;
    licenseStatus: "UNKNOWN" | "DECLARED" | "VERIFIED";
    provenance: string;
}
export interface MediaCatalog {
    version: 1;
    assets: MediaAsset[];
}
export interface SfxApproval {
    id: string;
    assetId: string;
    role: SfxRole;
    context: string;
    status: "APPROVED" | "REJECTED";
    reviewer: {
        type: "HUMAN";
        id: string;
    };
    reason: string;
    sourceHash: string;
    evidence: string;
}
export interface Ducking {
    enabled: boolean;
    amountDb: number;
    attack: number;
    release: number;
    thresholdDb: number;
}
export interface CueSelection {
    eventId: string;
    assetId: string;
    approvalId: string;
    context: string;
    sourceIn?: number;
    sourceOut?: number;
    gainDb?: number;
    fadeIn?: number;
    fadeOut?: number;
    ducking?: Ducking;
}
export interface ResolvedSfxCue {
    eventId: string;
    assetId: string;
    role: SfxRole;
    context: string;
    sourceHash: string;
    anchor: TemporalAnchor;
    anchorFrame: number;
    anchorSeconds: number;
    timingConfidence: TimingConfidence;
    resolvedStart: number;
    sourceIn: number;
    sourceOut: number;
    windowPolicy: "EXPLICIT" | "FULL_SOURCE";
    gainDb: number;
    fadeIn: number;
    fadeOut: number;
    ducking: Ducking;
    purpose: string;
    approvalRef: string;
}
export interface SoundDesignPlan {
    version: 1;
    editorialFingerprint: string;
    fps: number;
    durationSeconds: number;
    mode: "PLAN_ONLY" | "STRICT_RENDER";
    cues: ResolvedSfxCue[];
    unresolved: {
        eventId: string;
        status: "PLAN_ONLY" | "OMITTED_OPTIONAL";
        reason: string;
    }[];
}
