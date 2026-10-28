import React, { useMemo } from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { SequenceRenderer } from "../engine3d/renderer";
import { validateSequence } from "../engine3d/sequence-validation";
import type { ProceduralSequence } from "../engine3d/contracts";
import { COMPOSITION_Z } from "../composition-layers";
import { visualPlanShape, invalid, object,sha,text } from "./schema";
import type { VisualCompositionPlan, VisualBinding, VisualLayer } from "./contracts";
export function layerFrame(layer: VisualLayer, frame: number, count: number) { const local = frame - layer.startFrame; if (local < 0 || frame >= layer.endFrame)
    return null; if (count < 1)
    invalid("empty derivative binding"); if (layer.kind === "IMAGE")
    return 0; if (local < count)
    return local; if (layer.loopPolicy === "LOOP")
    return local % count; if (layer.loopPolicy === "HOLD_LAST")
    return count - 1; return invalid("video exhausted without explicit loop/hold"); }
export function layerOpacity(layer: VisualLayer, frame: number) { if (frame < layer.startFrame || frame >= layer.endFrame)
    return 0; const f = frame - layer.startFrame, n = layer.endFrame - layer.startFrame; return layer.opacity * Math.min(1, layer.fadeInFrames ? f / layer.fadeInFrames : 1, layer.fadeOutFrames ? (n - 1 - f) / layer.fadeOutFrames : 1); }
export function validateVisualPayload(sequence: ProceduralSequence, plan: VisualCompositionPlan, bindings: VisualBinding[]) {
    validateSequence(sequence);
    visualPlanShape(plan);
    if (plan.unresolved.length || plan.fps !== sequence.fps || plan.canvas.width !== sequence.width || plan.canvas.height !== sequence.height || plan.totalFrames !== sequence.totalFrames)
        invalid("render plan/sequence mismatch");
    if (!Array.isArray(bindings) || bindings.length !== plan.layers.length || new Set(bindings.map(b => b.eventId)).size !== bindings.length)
        invalid("duplicate/extra bindings");
    for(const b of bindings){object(b,["eventId","assetId","kind","frames","derivativeFingerprint","sourceHash"]);text(b.eventId);text(b.assetId);sha(b.derivativeFingerprint);sha(b.sourceHash);if(!Array.isArray(b.frames)||!b.frames.length||b.frames.some(f=>typeof f!=="string"))invalid("frame path array required");}
    for (const l of plan.layers) {
        if (l.compositionMode === "CHROMA")
            invalid("CHROMA is not executed");
        const b = bindings.find(b => b.eventId === l.eventId && b.assetId === l.assetId);
        if (!b || b.kind !== l.kind || b.sourceHash !== l.sourceHash || !b.frames.length || !/^([a-f0-9]{64})$/.test(b.derivativeFingerprint) || b.frames.length > 7200 || b.kind === "IMAGE" && b.frames.length !== 1 || b.frames.some(f => !/^cache\/[a-f0-9]{64}\/frame-\d{6}\.png$/.test(f) || !f.startsWith(`cache/${b.derivativeFingerprint}/`)))
            invalid("invalid render binding");
        if (l.kind === "VIDEO" && l.loopPolicy === "NONE" && b!.frames.length < l.endFrame - l.startFrame)
            invalid("short derivative without explicit loop/hold");
    }
}
export function VisualLayers({ plan, bindings }: {
    plan: VisualCompositionPlan;
    bindings: VisualBinding[];
}) {
    const frame = useCurrentFrame();
    const ordered = useMemo(() => [...plan.layers].sort((a, b) => COMPOSITION_Z[a.zOrder] - COMPOSITION_Z[b.zOrder] || a.order - b.order), [plan]);
    return <>{ordered.map(layer => {
            const binding = bindings.find(b => b.eventId === layer.eventId)!;
            const index = layerFrame(layer, frame, binding.frames.length);
            if (index === null)
                return null;
            const t = layer.transform, crop = layer.crop ?? { x: 0, y: 0, width: 1, height: 1 };
            const blend = { ALPHA: "normal", NORMAL: "normal", SCREEN: "screen", ADD: "plus-lighter", MULTIPLY: "multiply", CHROMA: "normal" } as const;
            return <AbsoluteFill key={layer.eventId} style={{ zIndex: COMPOSITION_Z[layer.zOrder], pointerEvents: "none", mixBlendMode: blend[layer.compositionMode], opacity: layerOpacity(layer, frame) }}><div style={{ position: "absolute", left: `${t.x * 100}%`, top: `${t.y * 100}%`, width: `${t.width * 100}%`, height: `${t.height * 100}%`, transform: `scale(${t.scale}) rotate(${t.rotation}deg)`, transformOrigin: "center", overflow: "hidden" }}><Img src={staticFile(binding.frames[index])} alt={layer.purpose} style={{ position: "absolute", width: `${100 / crop.width}%`, height: `${100 / crop.height}%`, left: `${-crop.x / crop.width * 100}%`, top: `${-crop.y / crop.height * 100}%`, maxWidth: "none" }}/></div></AbsoluteFill>;
        })}</>;
}
export function EditorialVisualRenderer({ sequence, visualPlan, bindings }: {
    sequence: ProceduralSequence;
    visualPlan: VisualCompositionPlan;
    bindings: VisualBinding[];
}) {
    useMemo(() => validateVisualPayload(sequence, visualPlan, bindings), [sequence, visualPlan, bindings]);
    return <SequenceRenderer sequence={sequence} editorialLayers={<VisualLayers plan={visualPlan} bindings={bindings}/>}/>;
}
