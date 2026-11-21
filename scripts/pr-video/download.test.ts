import { describe, expect, it } from "vitest";
import { pickRun, type Artifact, type Run } from "./download.ts";

const run = (id: number, sha: string, createdAt: string, name = "CI") => ({
  id,
  name,
  status: "completed",
  head_sha: sha,
  created_at: createdAt,
});

const video = (runId: number, expired = false) => ({
  name: "pr-videos",
  expired,
  workflow_run: { id: runId },
});

describe("pickRun", () => {
  it("prefers the newest CI run for the PR's head commit", () => {
    const runs: Run[] = [
      run(1, "head", "2026-11-21T10:00:00Z"),
      run(2, "head", "2026-11-21T11:00:00Z"),
      run(3, "older", "2026-11-21T12:00:00Z"),
    ];
    const artifacts: Artifact[] = [video(1), video(2), video(3)];

    expect(pickRun(runs, artifacts, "head")?.id).toBe(2);
  });

  it("falls back to the newest run with a video when the head has none", () => {
    const runs = [
      run(1, "older", "2026-11-21T10:00:00Z"),
      run(2, "head", "2026-11-21T11:00:00Z"),
    ];

    expect(pickRun(runs, [video(1)], "head")?.id).toBe(1);
  });

  it("ignores expired videos, other artifacts and other workflows", () => {
    const runs = [
      run(1, "head", "2026-11-21T10:00:00Z"),
      run(2, "head", "2026-11-21T11:00:00Z", "PR risk"),
      run(3, "head", "2026-11-21T12:00:00Z"),
    ];
    const artifacts = [
      video(1, true),
      video(2),
      { name: "playwright-report", expired: false, workflow_run: { id: 3 } },
    ];

    expect(pickRun(runs, artifacts, "head")).toBeUndefined();
  });
});
