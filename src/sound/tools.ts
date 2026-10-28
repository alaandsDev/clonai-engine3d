import { execFileSync } from "node:child_process";
export function ffmpegExecutable(): string {
    if (process.env.CLONAI_FFMPEG)
        return process.env.CLONAI_FFMPEG;
    try {
        execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
        return "ffmpeg";
    }
    catch { }
    // Discover an existing installation only; never install packages or download tools.
    return execFileSync(process.env.PYTHON ?? "python", ["-c", "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf8" }).trim();
}
