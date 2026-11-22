import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { localDate } from "../../packages/core/src/nudge.ts";
import { sessionTokenFor } from "./clerk.ts";
import { call, expectMatchesContract } from "./harness.ts";

const admin = postgres(process.env["DATABASE_URL"] ?? "", {
  prepare: false,
  max: 1,
});

type TestUser = { userId: string; token: string };
let alice: TestUser;
let bob: TestUser;

const as = (user: TestUser) => ({ authorization: `Bearer ${user.token}` });
const endpointOf = (name: string) => `https://push.example.test/nudge-${name}`;

type MeBody = {
  timeZone: string;
  nudgeTime: string | null;
  notReadingUntil: string | null;
};

const patch = (user: TestUser, json: unknown) =>
  call("/me", { method: "PATCH", headers: as(user), json });

const subscribe = (user: TestUser, name: string, p256dh = "invented-key") =>
  call("/push-subscriptions", {
    method: "POST",
    headers: as(user),
    json: { endpoint: endpointOf(name), keys: { p256dh, auth: "invented" } },
  });

const clean = () =>
  admin`delete from app.push_subscriptions where endpoint like 'https://push.example.test/nudge-%'`;

beforeAll(async () => {
  alice = await sessionTokenFor("bt-test-alice");
  bob = await sessionTokenFor("bt-test-bob");
  await call("/me", { headers: as(alice) });
  await call("/me", { headers: as(bob) });
  await clean();
});

afterAll(async () => {
  await clean();
  await admin`update app.users set time_zone = 'UTC', nudge_time = null, not_reading_until = null where id in ${admin([alice.userId, bob.userId])}`;
  await admin.end();
});

describe("PATCH /v1/me", () => {
  it("needs a token", async () => {
    const response = await call("/me", { method: "PATCH", json: {} });
    expect(response.status).toBe(401);
    await expectMatchesContract(response, "PATCH", "/me");
  });

  it("sets the nudge time and zone, and null turns nudges off", async () => {
    const set = await patch(alice, {
      timeZone: "Europe/London",
      nudgeTime: "20:30",
    });
    expect(set.status).toBe(200);
    expect(await expectMatchesContract(set, "PATCH", "/me")).toMatchObject({
      timeZone: "Europe/London",
      nudgeTime: "20:30",
    });
    const read = await call("/me", { headers: as(alice) });
    expect(await expectMatchesContract(read, "GET", "/me")).toMatchObject({
      nudgeTime: "20:30",
    });
    const off = await patch(alice, { nudgeTime: null });
    expect(await expectMatchesContract(off, "PATCH", "/me")).toMatchObject({
      timeZone: "Europe/London",
      nudgeTime: null,
    });
  });

  it("silences nudges through today in the user's zone, and clears it", async () => {
    const zone = "Pacific/Kiritimati";
    const before = localDate(Date.now(), zone);
    const response = await patch(alice, {
      timeZone: zone,
      notReadingToday: true,
    });
    const after = localDate(Date.now(), zone);
    expect(response.status).toBe(200);
    const body = (await expectMatchesContract(
      response,
      "PATCH",
      "/me",
    )) as MeBody;
    expect([before, after]).toContain(body.notReadingUntil);
    const cleared = await patch(alice, { notReadingToday: false });
    expect(
      ((await expectMatchesContract(cleared, "PATCH", "/me")) as MeBody)
        .notReadingUntil,
    ).toBeNull();
  });

  it("rejects bad bodies", async () => {
    for (const json of [
      {},
      { nudgeTime: "25:00" },
      { timeZone: "Mars/Olympus" },
      { notReadingToday: "yes" },
      { tier: "plus" },
    ]) {
      const response = await patch(alice, json);
      expect(response.status).toBe(400);
      const body = (await expectMatchesContract(response, "PATCH", "/me")) as {
        code: string;
      };
      expect(body.code).toBe("validation_failed");
    }
  });

  it("changes only the caller's settings", async () => {
    await patch(alice, { nudgeTime: "07:15" });
    await patch(bob, { nudgeTime: "21:45" });
    const a = (await (
      await call("/me", { headers: as(alice) })
    ).json()) as MeBody;
    const b = (await (
      await call("/me", { headers: as(bob) })
    ).json()) as MeBody;
    expect(a.nudgeTime).toBe("07:15");
    expect(b.nudgeTime).toBe("21:45");
  });

  it("is refused for a personal access token", async () => {
    const made = await call("/tokens", {
      method: "POST",
      headers: as(alice),
      json: { name: "Invented nudge test", scopes: ["books:read"] },
    });
    const { token } = (await made.json()) as { token: string };
    const response = await call("/me", {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}` },
      json: { nudgeTime: null },
    });
    expect(response.status).toBe(403);
    await admin`delete from app.api_tokens where name = 'Invented nudge test'`;
  });
});

describe("push subscriptions", () => {
  it("needs a token", async () => {
    const response = await call("/push-subscriptions", {
      method: "POST",
      json: {},
    });
    expect(response.status).toBe(401);
    await expectMatchesContract(response, "POST", "/push-subscriptions");
  });

  it("saves a subscription, and the same endpoint again updates its keys", async () => {
    const first = await subscribe(alice, "a1");
    expect(first.status).toBe(201);
    const saved = (await expectMatchesContract(
      first,
      "POST",
      "/push-subscriptions",
    )) as { id: string };
    const again = await subscribe(alice, "a1", "invented-new-key");
    expect(again.status).toBe(201);
    const second = (await expectMatchesContract(
      again,
      "POST",
      "/push-subscriptions",
    )) as { id: string };
    expect(second.id).toBe(saved.id);
    const rows =
      await admin`select p256dh from app.push_subscriptions where endpoint = ${endpointOf("a1")}`;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.["p256dh"]).toBe("invented-new-key");
  });

  it("rejects a bad body", async () => {
    for (const json of [
      {},
      {
        endpoint: "http://push.example.test/x",
        keys: { p256dh: "a", auth: "b" },
      },
      { endpoint: endpointOf("bad"), keys: { p256dh: "a" } },
    ]) {
      const response = await call("/push-subscriptions", {
        method: "POST",
        headers: as(alice),
        json,
      });
      expect(response.status).toBe(400);
      await expectMatchesContract(response, "POST", "/push-subscriptions");
    }
  });

  it("deletes the caller's subscription, then 404s", async () => {
    await subscribe(alice, "a2");
    const url = `/push-subscriptions?endpoint=${encodeURIComponent(endpointOf("a2"))}`;
    const gone = await call(url, { method: "DELETE", headers: as(alice) });
    expect(gone.status).toBe(204);
    const missing = await call(url, { method: "DELETE", headers: as(alice) });
    expect(missing.status).toBe(404);
    await expectMatchesContract(missing, "DELETE", "/push-subscriptions");
  });

  it("rejects a delete without a valid endpoint", async () => {
    const response = await call("/push-subscriptions", {
      method: "DELETE",
      headers: as(alice),
    });
    expect(response.status).toBe(400);
    await expectMatchesContract(response, "DELETE", "/push-subscriptions");
  });

  it("lets user B not delete user A's subscription", async () => {
    await subscribe(alice, "a3", "alice-key");
    const url = `/push-subscriptions?endpoint=${encodeURIComponent(endpointOf("a3"))}`;
    const denied = await call(url, { method: "DELETE", headers: as(bob) });
    expect(denied.status).toBe(404);
    const stillThere =
      await admin`select p256dh, user_id from app.push_subscriptions where endpoint = ${endpointOf("a3")}`;
    expect(stillThere).toHaveLength(1);
    expect(stillThere[0]?.["user_id"]).toBe(alice.userId);
    expect(stillThere[0]?.["p256dh"]).toBe("alice-key");
  });
});
