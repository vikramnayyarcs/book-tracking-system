import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { audioSeconds } from "./build-video.ts";
import { formatLog, renderLogVideo } from "./build-api-video.ts";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "api-video-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const entry = (route: string, request: unknown, response: unknown) =>
  JSON.stringify({
    method: "GET",
    path: route,
    status: 200,
    request,
    response,
  });

describe("formatLog", () => {
  it("shows the request, status and response of each call", () => {
    const text = formatLog(
      [
        entry("/v1/books", { title: "Invented book" }, { id: "abc" }),
        entry("/v1/lists", null, { items: [] }),
      ].join("\n"),
    );
    expect(text).toContain("GET /v1/books");
    expect(text).toContain('request:  {"title":"Invented book"}');
    expect(text).toContain("status:   200");
    expect(text).toContain('response: {"id":"abc"}');
    expect(text.split("GET /v1/lists")[1]).not.toContain("request:");
  });
});

describe("renderLogVideo", () => {
  it("draws a long log into a video as long as the narration", async () => {
    const textFile = path.join(dir, "log.txt");
    const output = path.join(dir, "log.mp4");
    const lines = Array.from({ length: 30 }, (_, i) =>
      entry(`/v1/books/${i}`, null, { title: "Invented 100%" }),
    );
    await writeFile(textFile, formatLog(lines.join("\n")));
    const font =
      process.env["FONT_FILE"] ??
      "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf";
    renderLogVideo(textFile, 3, font, output);
    expect((await stat(output)).size).toBeGreaterThan(0);
    expect(audioSeconds(output)).toBeCloseTo(3, 0);
  });
});
