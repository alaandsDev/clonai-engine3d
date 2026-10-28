import { fail, type ProceduralSequence } from "./contracts";
import { fields, list, text, finite, trackShape, object } from "./schema";
import { resolveShot } from "./validation";
/** Runtime inputProps are an independent trust boundary, including Studio/direct renderer use. */
export function validateSequence(s: ProceduralSequence): ProceduralSequence {
  fields(
    s,
    [
      "id",
      "title",
      "fps",
      "width",
      "height",
      "totalDuration",
      "totalFrames",
      "scenes",
      "shots",
      "captions",
    ],
    "sequence",
  );
  text(s.id, "sequence.id");
  text(s.title, "sequence.title");
  for (const key of ["fps", "width", "height", "totalFrames"] as const) {
    finite(s[key], key, 1);
    if (!Number.isInteger(s[key])) fail("INVALID_PARAMETER", "sequence " + key);
  }
  if (s.width % 2 || s.height % 2)
    fail("INVALID_PARAMETER", "sequence dimensions");
  finite(s.totalDuration, "totalDuration", 0);
  if (Math.abs(s.totalDuration - s.totalFrames / s.fps) > 1e-8)
    fail("INVALID_DURATION", "sequence duration");
  list(s.shots, "shots");
  list(s.scenes, "scenes");
  list(s.captions, "captions");
  let frame = 0;
  const ids = new Set<string>();
  for (const shot of s.shots) {
    object(shot, "sequence shot");
    const { sceneId, startFrame, endFrame, durationFrames, ...spec } = shot;
    text(sceneId, "sceneId");
    for (const n of [startFrame, endFrame, durationFrames])
      if (!Number.isInteger(n) || n < 0)
        fail("INVALID_TIMING", "sequence shot");
    if (
      startFrame !== frame ||
      durationFrames < 1 ||
      endFrame !== startFrame + durationFrames ||
      Math.abs(spec.durationSeconds - durationFrames / s.fps) > 1e-8
    )
      fail("INVALID_TIMING", "shot timeline");
    if (ids.has(shot.id)) fail("INVALID_PARAMETER", "duplicate shot id");
    ids.add(shot.id);
    resolveShot(spec);
    frame = endFrame;
  }
  if (frame !== s.totalFrames)
    fail("INVALID_DURATION", "shots must fill sequence");
  frame = 0;
  const scenes = new Set<string>();
  for (const scene of s.scenes) {
    fields(
      scene,
      ["id", "narration", "startFrame", "durationFrames", "audio"],
      "scene",
    );
    text(scene.id, "scene.id");
    if (typeof scene.narration !== "string")
      fail("INVALID_PARAMETER", "narration");
    if (scenes.has(scene.id)) fail("INVALID_PARAMETER", "duplicate scene");
    scenes.add(scene.id);
    if (
      !Number.isInteger(scene.startFrame) ||
      !Number.isInteger(scene.durationFrames) ||
      scene.durationFrames < 1 ||
      scene.startFrame !== frame
    )
      fail("INVALID_TIMING", "scene timeline");
    frame += scene.durationFrames;
    if (scene.audio) {
      trackShape(scene.audio);
      if (scene.audio.sceneId !== scene.id)
        fail("INVALID_PARAMETER", "audio sceneId");
    }
  }
  if (s.scenes.length && frame !== s.totalFrames)
    fail("INVALID_DURATION", "scenes must fill sequence");
  let end = 0;
  for (const cue of s.captions) {
    fields(cue, ["text", "startFrame", "endFrame"], "caption");
    text(cue.text, "caption.text");
    if (
      !Number.isInteger(cue.startFrame) ||
      !Number.isInteger(cue.endFrame) ||
      cue.startFrame < end ||
      cue.endFrame <= cue.startFrame ||
      cue.endFrame > s.totalFrames
    )
      fail("INVALID_TIMING", "caption");
    end = cue.endFrame;
  }
  return s;
}
