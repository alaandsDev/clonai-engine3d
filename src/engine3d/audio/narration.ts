import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, stat, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fail, type NarrationTrack } from "../contracts";
import { spokenText } from "../director";
const run = promisify(execFile);
export interface NarrationConfig {
  voice: string;
  rate: string;
  pitch: string;
}
export const defaultConfig: NarrationConfig = {
  voice: "pt-BR-AntonioNeural",
  rate: "+0%",
  pitch: "+0Hz",
};
export interface NarrationProvider {
  name: string;
  synthesize(
    text: string,
    output: string,
    config: NarrationConfig,
  ): Promise<void>;
}
export class EdgeTtsNarrationProvider implements NarrationProvider {
  name = "edge-tts";
  async synthesize(text: string, output: string, c: NarrationConfig) {
    try {
      await run(
        process.env.PYTHON ?? "python",
        [
          "-m",
          "edge_tts",
          "--text",
          text,
          "--voice",
          c.voice,
          `--rate=${c.rate}`,
          `--pitch=${c.pitch}`,
          "--write-media",
          output,
        ],
        { timeout: 90000 },
      );
    } catch (e) {
      fail("TTS_FAILED", String(e));
    }
  }
}
export class FakeNarrationProvider implements NarrationProvider {
  name = "fake";
  async synthesize(text: string, output: string) {
    const duration = Math.max(0.5, text.length / 15),
      rate = 8000,
      samples = Math.ceil(duration * rate);
    const b = Buffer.alloc(44 + samples * 2);
    b.write("RIFF", 0);
    b.writeUInt32LE(36 + samples * 2, 4);
    b.write("WAVEfmt ", 8);
    b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20);
    b.writeUInt16LE(1, 22);
    b.writeUInt32LE(rate, 24);
    b.writeUInt32LE(rate * 2, 28);
    b.writeUInt16LE(2, 32);
    b.writeUInt16LE(16, 34);
    b.write("data", 36);
    b.writeUInt32LE(samples * 2, 40);
    await writeFile(output, b);
  }
}
export const cacheKey = (
  text: string,
  config: NarrationConfig,
  provider = "edge-tts",
) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        text: spokenText(text),
        ...config,
        provider,
        version: 1,
      }),
    )
    .digest("hex");
export function ffprobePath() {
  return (
    process.env.FFPROBE_PATH ??
    path.resolve("node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe")
  );
}
export async function probeDuration(file: string) {
  try {
    const s = await stat(file);
    if (!s.size) fail("AUDIO_FILE_MISSING", file);
  } catch {
    fail("AUDIO_FILE_MISSING", file);
  }
  let out: string;
  try {
    out = (
      await run(ffprobePath(), [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        file,
      ])
    ).stdout;
  } catch (e) {
    return fail("FFPROBE_FAILED", String(e));
  }
  let duration: number;
  try {
    duration = Number(JSON.parse(out).format.duration);
  } catch {
    return fail("AUDIO_DURATION_INVALID", file);
  }
  if (!Number.isFinite(duration) || duration <= 0)
    fail("AUDIO_DURATION_INVALID", file);
  return duration;
}
export async function narration(
  sceneId: string,
  text: string,
  fps: number,
  provider: NarrationProvider = new EdgeTtsNarrationProvider(),
  config = defaultConfig,
  root = process.cwd(),
): Promise<NarrationTrack> {
  const spoken = spokenText(text);
  if (!spoken) fail("NARRATION_EMPTY", sceneId);
  const key = cacheKey(text, config, provider.name),
    relative = `audio/${key}.${provider.name === "fake" ? "wav" : "mp3"}`,
    file = path.join(root, "public", relative);
  await mkdir(path.dirname(file), { recursive: true });
  let hit = false;
  try {
    hit = (await stat(file)).size > 0;
  } catch {}
  if (!hit) {
    const temporary =
      file + ".tmp." + (provider.name === "fake" ? "wav" : "mp3");
    try {
      await provider.synthesize(spoken, temporary, config);
      await probeDuration(temporary);
      await rename(temporary, file);
    } catch (e) {
      await rm(temporary, { force: true });
      throw e;
    }
  }
  const durationSeconds = await probeDuration(file);
  console.log(`${sceneId}: CACHE ${hit ? "HIT" : "MISS"}`);
  return {
    sceneId,
    text,
    spokenText: spoken,
    provider: provider.name,
    voice: config.voice,
    durationSeconds,
    durationFrames: Math.ceil(durationSeconds * fps),
    relativeAudioPath: relative,
    cacheKey: key,
    timingSource: "estimated_proportional",
  };
}
