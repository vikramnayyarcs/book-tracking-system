import { spawnSync } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { audioSeconds, joinVideoAndAudio } from "./build-video.ts";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "video-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const ffmpeg = (...args: string[]) => {
  const result = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
  expect(result.status).toBe(0);
};

describe("joinVideoAndAudio", () => {
  it("makes an MP4 as long as the narration when the demo is shorter", async () => {
    const demo = path.join(dir, "demo.webm");
    const audio = path.join(dir, "voice.wav");
    const output = path.join(dir, "out.mp4");
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "color=c=white:s=320x180:d=1",
      "-c:v",
      "libvpx",
      demo,
    );
    ffmpeg("-f", "lavfi", "-i", "sine=frequency=440:duration=4", audio);

    joinVideoAndAudio(demo, audio, output);

    expect((await stat(output)).size).toBeGreaterThan(0);
    expect(audioSeconds(output)).toBeCloseTo(4, 0);
  });
});
