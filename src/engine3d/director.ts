import {
  fail,
  type DirectorPlan,
  type NarrationTrack,
  type ProceduralSequence,
  type CaptionCue,
} from "./contracts";
import { resolveShot, resource } from "./validation";
import { planShape } from "./schema";
export const spokenText = (text: string) =>
  text
    .replace(
      /\[(intenso|misterioso|suave|tenso|surpreso|reflexivo|impactado|provocador|curioso)\]/gi,
      "",
    )
    .replace(/\(PAUSA\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
export function captions(
  text: string,
  startFrame: number,
  durationFrames: number,
): CaptionCue[] {
  const words = spokenText(text).split(/\s+/).filter(Boolean);
  const groups = Array.from({ length: Math.ceil(words.length / 3) }, (_, i) =>
    words.slice(i * 3, i * 3 + 3).join(" "),
  );
  return groups
    .map((text, i) => ({
      text,
      startFrame: startFrame + Math.floor((i * durationFrames) / groups.length),
      endFrame:
        startFrame + Math.floor(((i + 1) * durationFrames) / groups.length),
    }))
    .filter((c) => c.endFrame > c.startFrame);
}
export function compileDirectorPlan(
  p: DirectorPlan,
  audio: NarrationTrack[] = [],
): ProceduralSequence {
  planShape(p);
  if (!/^[a-zA-Z0-9_-]+$/.test(p.id))
    fail("INVALID_PARAMETER", "plan.id must be filename-safe");
  const { fps, width, height } = p.format;
  if (
    ![fps, width, height].every((n) => Number.isInteger(n) && n > 0) ||
    width % 2 ||
    height % 2
  )
    fail(
      "INVALID_PARAMETER",
      "format requires positive integers and even dimensions",
    );
  if (!["fixed", "narration"].includes(p.timingMode))
    fail("INVALID_PARAMETER", "timingMode");
  for (const id of Object.values(p.cast)) resource(id, "character");
  const seq: ProceduralSequence = {
    id: p.id,
    title: p.title,
    fps,
    width,
    height,
    totalFrames: 0,
    totalDuration: 0,
    scenes: [],
    shots: [],
    captions: [],
  };
  const continuity = new Map<
    string,
    { id: string; state: Record<string, number> }
  >();
  const ids = new Set<string>();
  const ordered = <T extends { id: string; order: number }>(items: T[]) => {
    if (!items.length) fail("INVALID_PARAMETER", "empty scene/shot list");
    const orders = new Set<number>();
    return [...items]
      .sort((a, b) => a.order - b.order)
      .map((x) => {
        if (ids.has(x.id) || orders.has(x.order) || !Number.isFinite(x.order))
          fail("INVALID_PARAMETER", "duplicate id/order");
        ids.add(x.id);
        orders.add(x.order);
        return x;
      });
  };
  for (const scene of ordered(p.scenes)) {
    if (!spokenText(scene.narration)) fail("NARRATION_EMPTY", scene.id);
    resource(scene.environment.resourceId, "environment");
    const track = audio.find((a) => a.sceneId === scene.id);
    if (p.timingMode === "narration" && !track)
      fail("AUDIO_FILE_MISSING", scene.id);
    if (
      track &&
      (!Number.isFinite(track.durationSeconds) || track.durationSeconds <= 0)
    )
      fail("AUDIO_DURATION_INVALID", scene.id);
    const shots = ordered(scene.shots);
    const start = seq.totalFrames;
    const weights = shots.map((s) =>
      Math.max(1, spokenText(s.narrationSegment ?? "").length),
    );
    const weightSum = weights.reduce((a, b) => a + b, 0);
    let usedWeight = 0;
    const narrationFrames = track ? Math.ceil(track.durationSeconds * fps) : 0;
    if (p.timingMode === "narration" && narrationFrames < shots.length)
      fail("INVALID_DURATION", "audio too short");
    for (let n = 0; n < shots.length; n++) {
      const s = shots[n];
      if (s.transition && s.transition !== "CUT")
        fail("UNSUPPORTED_TRANSITION", s.transition);
      if (!(s.durationSeconds > 0 && Number.isFinite(s.durationSeconds)))
        fail("INVALID_DURATION", s.id);
      const characters = s.characters.map((c) => {
        const id = p.cast[c.castId] ?? fail("RESOURCE_NOT_FOUND", c.castId);
        if (c.resourceId && c.resourceId !== id) fail("CAST_SWITCH", c.castId);
        return { ...c, resourceId: id };
      });
      if (
        s.narrationSegment &&
        !spokenText(scene.narration).includes(spokenText(s.narrationSegment))
      )
        fail("INVALID_PARAMETER", "narrationSegment not in scene");
      const distributableFrames = narrationFrames - shots.length;
      const before = Math.round((usedWeight / weightSum) * distributableFrames);
      usedWeight += weights[n];
      const durationFrames =
        p.timingMode === "narration"
          ? 1 +
            Math.round((usedWeight / weightSum) * distributableFrames) -
            before
          : Math.max(1, Math.round(s.durationSeconds * fps));
      const { order, transition, ...shotFields } = s;
      const spec = resolveShot({
        ...shotFields,
        characters: characters.map(({ castId, ...c }) => c),
        environment: s.environment ?? scene.environment,
        durationSeconds: durationFrames / fps,
      });
      for (const prop of spec.props) {
        if (!prop.continuityKey) continue;
        const prev = continuity.get(prop.continuityKey);
        const initial = { ...prop.parameters, ...prop.initialState };
        if (
          prev &&
          (prev.id !== prop.resourceId ||
            Object.entries(prev.state).some(([k, v]) => initial[k] !== v))
        )
          fail("CONTINUITY_MISMATCH", prop.continuityKey);
        continuity.set(prop.continuityKey, {
          id: prop.resourceId,
          state: { ...initial, ...prop.finalState },
        });
      }
      seq.shots.push({
        ...spec,
        sceneId: scene.id,
        startFrame: seq.totalFrames,
        endFrame: seq.totalFrames + durationFrames,
        durationFrames,
      });
      seq.totalFrames += durationFrames;
    }
    const durationFrames = seq.totalFrames - start;
    if (
      track &&
      p.timingMode === "fixed" &&
      track.durationFrames > durationFrames
    )
      fail("AUDIO_DURATION_INVALID", "audio exceeds fixed scene");
    seq.scenes.push({
      id: scene.id,
      narration: scene.narration,
      startFrame: start,
      durationFrames,
      audio: track,
    });
    seq.captions.push(...captions(scene.narration, start, durationFrames));
  }
  seq.totalDuration = seq.totalFrames / fps;
  return seq;
}
