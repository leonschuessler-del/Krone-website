/**
 * Minimal VP8/WebM encoder wrapper around an ffmpeg binary.
 *
 * Frames are rendered deterministically (one screenshot per frame) and piped
 * in as JPEG (image2pipe + mjpeg), which works with the reduced ffmpeg build
 * that ships with Playwright (libvpx VP8 + mjpeg only).
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function candidates(): string[] {
  const out: string[] = [];
  if (process.env.FFMPEG_PATH) out.push(process.env.FFMPEG_PATH);
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, join(homedir(), ".cache", "ms-playwright"), join(homedir(), "Library", "Caches", "ms-playwright")].filter(
    (p): p is string => !!p,
  );
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const dir of readdirSync(root).filter((d) => d.startsWith("ffmpeg")).sort().reverse()) {
      for (const bin of ["ffmpeg-linux", "ffmpeg-mac", "ffmpeg-win64.exe", "ffmpeg"]) out.push(join(root, dir, bin));
    }
  }
  out.push("ffmpeg");
  return out;
}

let resolved: string | null = null;

export function ffmpegPath(): string {
  if (resolved) return resolved;
  for (const c of candidates()) {
    if (c !== "ffmpeg" && !existsSync(c)) continue;
    const r = spawnSync(c, ["-hide_banner", "-encoders"], { encoding: "utf8" });
    if (r.status === 0 && /libvpx/.test(r.stdout)) {
      resolved = c;
      return c;
    }
  }
  throw new Error("No ffmpeg with libvpx found. Set FFMPEG_PATH or install Playwright's ffmpeg (npx playwright install ffmpeg).");
}

export interface EncoderOptions {
  fps: number;
  /** Target / cap bitrate, e.g. "1400k". */
  bitrate: string;
  /** libvpx constant-quality level (lower = better, 4..63). */
  crf: number;
  /** Keyframe interval in frames. */
  gop?: number;
}

export class WebmEncoder {
  private readonly proc: ChildProcess;
  private readonly done: Promise<void>;
  private stderr = "";

  constructor(outFile: string, o: EncoderOptions) {
    const args = [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "image2pipe",
      "-framerate",
      String(o.fps),
      "-c:v",
      "mjpeg",
      "-i",
      "-",
      "-an",
      "-c:v",
      "libvpx",
      "-pix_fmt",
      "yuv420p",
      "-b:v",
      o.bitrate,
      "-maxrate",
      o.bitrate,
      "-bufsize",
      o.bitrate,
      "-crf",
      String(o.crf),
      "-qmin",
      "2",
      "-qmax",
      "50",
      "-deadline",
      "good",
      "-cpu-used",
      "1",
      "-auto-alt-ref",
      "1",
      "-lag-in-frames",
      "16",
      "-g",
      String(o.gop ?? o.fps * 4),
      "-threads",
      "4",
      "-f",
      "webm",
      outFile,
    ];
    this.proc = spawn(ffmpegPath(), args, { stdio: ["pipe", "ignore", "pipe"] });
    this.proc.stderr?.on("data", (d: Buffer) => {
      this.stderr += d.toString();
    });
    this.done = new Promise((resolve, reject) => {
      this.proc.on("error", reject);
      this.proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}: ${this.stderr.slice(-2000)}`))));
    });
  }

  async write(jpeg: Buffer): Promise<void> {
    const stdin = this.proc.stdin;
    if (!stdin) throw new Error("ffmpeg stdin closed");
    if (!stdin.write(jpeg)) await new Promise<void>((resolve) => stdin.once("drain", () => resolve()));
  }

  async finish(): Promise<void> {
    this.proc.stdin?.end();
    await this.done;
  }
}
