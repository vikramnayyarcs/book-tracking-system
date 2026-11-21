import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lintScript } from "./lint-script.ts";

const run = (command: string, args: string[], input?: string) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...(input === undefined ? {} : { input }),
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} failed (${result.status}): ${result.stderr || result.error}`,
    );
  }
  return result.stdout;
};

export const audioSeconds = (audio: string) =>
  Number(
    run("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      audio,
    ]).trim(),
  );

export const joinVideoAndAudio = (
  demo: string,
  audio: string,
  output: string,
) => {
  const seconds = audioSeconds(audio);
  run("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    demo,
    "-i",
    audio,
    "-vf",
    `tpad=stop_mode=clone:stop_duration=${seconds},format=yuv420p`,
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-t",
    String(seconds),
    "-movflags",
    "+faststart",
    output,
  ]);
};

export const narrate = async (
  scriptFile: string,
  model: string,
  output: string,
) => {
  const text = await readFile(scriptFile, "utf8");
  const problems = lintScript(text);
  if (problems.length > 0) {
    throw new Error(problems.join("\n"));
  }
  const piper = (process.env["PIPER_BIN"] ?? "piper").split(" ");
  const [command, ...baseArgs] = piper;
  if (command === undefined) {
    throw new Error("PIPER_BIN is empty");
  }
  run(command, [...baseArgs, "--model", model, "--output_file", output], text);
};

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  const [demo, scriptFile, model, output] = process.argv.slice(2);
  if (!demo || !scriptFile || !model || !output) {
    console.error(
      "Usage: build-video.ts <demo.webm> <script.txt> <voice.onnx> <out.mp4>",
    );
    process.exit(2);
  }
  const work = await mkdtemp(path.join(tmpdir(), "video-"));
  try {
    const wav = path.join(work, "voice.wav");
    await narrate(scriptFile, model, wav);
    joinVideoAndAudio(demo, wav, output);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
