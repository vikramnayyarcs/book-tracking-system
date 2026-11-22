import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { baseUrl } from "./harness.ts";

const jobsSecret = process.env["JOBS_SECRET"] ?? "";
const admin = postgres(process.env["DATABASE_URL"] ?? "", {
  prepare: false,
  max: 1,
});

const runKey = `test-${crypto.randomUUID()}`;

const callJob = (path: string, headers: Record<string, string>) =>
  fetch(`${baseUrl}/internal/jobs${path}`, { method: "POST", headers });

afterAll(async () => {
  await admin`delete from app.job_runs where run_key = ${runKey}`;
  await admin.end();
});

describe("POST /internal/jobs/{job}", () => {
  it("returns 401 without the jobs secret", async () => {
    const response = await callJob("/heartbeat", {});
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
  });

  it("returns 401 with a wrong secret, and the gateway secret does not open it", async () => {
    const wrong = await callJob("/heartbeat", { "x-jobs-secret": "wrong" });
    expect(wrong.status).toBe(401);
    const gateway = await callJob("/heartbeat", {
      "x-gateway-secret": process.env["GATEWAY_SECRET"] ?? "",
    });
    expect(gateway.status).toBe(401);
  });

  it("returns 404 for an unknown job", async () => {
    const response = await callJob("/nope", { "x-jobs-secret": jobsSecret });
    expect(response.status).toBe(404);
  });

  it("does the work once when the same run happens twice", async () => {
    const headers = { "x-jobs-secret": jobsSecret };
    const first = await callJob(`/heartbeat?run_key=${runKey}`, headers);
    const second = await callJob(`/heartbeat?run_key=${runKey}`, headers);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      job: "heartbeat",
      runKey,
      ran: true,
    });
    expect(await second.json()).toEqual({
      job: "heartbeat",
      runKey,
      ran: false,
    });
    const rows = await admin`
      select count(*)::int as n from app.job_runs
      where job = 'heartbeat' and run_key = ${runKey}
    `;
    expect(rows[0]?.["n"]).toBe(1);
  });
});
