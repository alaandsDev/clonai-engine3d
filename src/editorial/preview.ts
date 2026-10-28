import type { EditorialInputs } from "./contracts";
import { compileEditorial } from "./compiler";
export function editorialPreview(input: EditorialInputs) {
    const result = compileEditorial(input, "PLAN_ONLY");
    return { compilerVersion: result.compilerVersion, fingerprint: result.fingerprint, mode: result.mode, unresolvedEventIds: result.unresolvedEventIds, safeZone: input.plan.safeZone, beats: input.plan.beats.map(b => ({ beatId: b.id, narration: b.narration, intent: b.intent, informationType: b.informationType, visualGoal: b.visualGoal, timingConfidence: "ESTIMATED", events: result.events.filter(e => e.event.beatId === b.id), directorScene: result.directorPlan.scenes.find(s => s.id === `scene_${b.id}`) })) };
}
export function previewMarkdown(input: EditorialInputs): string {
    const p = editorialPreview(input);
    return `# Editorial preview — ${input.plan.title}\n\nFingerprint: ${p.fingerprint}\n\nTiming ESTIMATED; word/phrase anchors are proportional estimates, not TTS boundaries.\n\nPLAN_ONLY: ${p.unresolvedEventIds.join(", ") || "none"}\n\n` + p.beats.map(b => `## ${b.beatId}: ${b.intent} / ${b.informationType}\n\n${b.narration}\n\n${b.visualGoal}\n\n` + b.events.map(r => `- ${r.event.id} / ${r.event.type}: ${JSON.stringify(r.event.anchor)} → frame ${r.anchor.timelineFrame}, ${r.anchor.timingConfidence}; ${r.disposition}. ${r.mapping}. ${r.reason} Purpose: ${r.event.purpose}.` + (r.event.type === "SFX_CUE" ? ` Role: ${r.event.role}; asset status: ${r.event.assetRef?.status ?? "UNRESOLVED"}.` : r.event.type === "BROLL_REQUEST" ? ` Request: ${JSON.stringify(r.event.request)}.` : "")).join("\n") + `\n\nDirectorPlan: ${b.directorScene?.id} / ${b.directorScene?.shots[0].id}.\n`).join("\n");
}
