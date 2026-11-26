import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { audioSeconds, narrate } from "./build-video.ts";

type Entry = {
  method: string;
  path: string;
  status: number;
  request: unknown;
  response: unknown;
};

const width = 100;

const defaultFont = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf";

const clip = (text: string) =>
  text.length > width ? `${text.slice(0, width - 3)}...` : text;

export const formatLog = (jsonl: string) =>
  jsonl
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as Entry)
    .flatMap((entry) => {
      const lines = [`${entry.method} ${entry.path}`];
      if (entry.request !== null) {
        lines.push(clip(`  request:  ${JSON.stringify(entry.request)}`));
      }
      lines.push(`  status:   ${entry.status}`);
      if (entry.response !== null) {
        lines.push(clip(`  response: ${JSON.stringify(entry.response)}`));
      }
      return [...lines, ""];
    })
    .join("\n");

const ffmpeg = (args: string[]) => {
  const result = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed (${result.status}): ${result.stderr}`);
  }
};

export const renderLogVideo = (
  textFile: string,
  seconds: number,
  fontFile: string,
  output: string,
) => {
  const filter = [
    `drawtext=fontfile=${fontFile}`,
    `textfile=${textFile}`,
    "expansion=none",
    "fontcolor=white",
    "fontsize=20",
    "line_spacing=6",
    "x=40",
    `y=40-max(0\\,text_h-(h-80))*t/${seconds}`,
  ].join(":");
  ffmpeg([
    "-f",
    "lavfi",
    "-i",
    `color=c=0x101418:s=1280x720:r=25:d=${seconds}`,
    "-vf",
    `${filter},format=yuv420p`,
    "-c:v",
    "libx264",
    output,
  ]);
};

export const buildApiVideo = async (
  logFiles: string[],
  scriptFile: string,
  model: string,
  output: string,
) => {
  const fontFile = process.env["FONT_FILE"] ?? defaultFont;
  const work = await mkdtemp(path.join(tmpdir(), "api-video-"));
  try {
    const parts = await Promise.all(
      logFiles.map((file) => readFile(file, "utf8")),
    );
    const textFile = path.join(work, "log.txt");
    await writeFile(textFile, formatLog(parts.join("\n")));
    const wav = path.join(work, "voice.wav");
    await narrate(scriptFile, model, wav);
    const seconds = audioSeconds(wav);
    const silent = path.join(work, "log.mp4");
    renderLogVideo(textFile, seconds, fontFile, silent);
    ffmpeg([
      "-i",
      silent,
      "-i",
      wav,
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-shortest",
      "-movflags",
      "+faststart",
      output,
    ]);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
};

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  const [scriptFile, model, output, ...logFiles] = process.argv.slice(2);
  if (!scriptFile || !model || !output || logFiles.length === 0) {
    console.error(
      "Usage: build-api-video.ts <script.txt> <voice.onnx> <out.mp4> <log.jsonl>...",
    );
    process.exit(2);
  }
  await buildApiVideo(logFiles, scriptFile, model, output);
}
