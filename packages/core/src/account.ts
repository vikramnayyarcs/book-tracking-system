import type { Sql } from "./api/db.ts";
import type { ObjectStore } from "./api/storage.ts";

export const DELETE_CONFIRMATION = "delete";
export const REVERIFY_WITHIN_MINUTES = 10;
export const DELETE_RETRY_DELAYS_MS = [500, 1000, 2000, 4000] as const;

export type IdentityStore = {
  configured: boolean;
  deleteUser: (userId: string) => Promise<void>;
};

export const parseMeDelete = (body: unknown) => {
  const valid =
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body) &&
    Object.keys(body).length === 1 &&
    (body as Record<string, unknown>)["confirmation"] === DELETE_CONFIRMATION;
  return valid
    ? ({ ok: true } as const)
    : ({
        ok: false,
        detail: `Send {"confirmation": "${DELETE_CONFIRMATION}"}`,
      } as const);
};

export const isRecentlyVerified = (minutesAgo: number | undefined) =>
  minutesAgo !== undefined &&
  Number.isFinite(minutesAgo) &&
  minutesAgo >= 0 &&
  minutesAgo <= REVERIFY_WITHIN_MINUTES;

export const freshestVerification = (fva: unknown) => {
  if (!Array.isArray(fva)) {
    return undefined;
  }
  const ages = fva.filter(
    (age): age is number => typeof age === "number" && age >= 0,
  );
  return ages.length === 0 ? undefined : Math.min(...ages);
};

export const recordDeletionAttempt = async (sql: Sql) => {
  const rows = await sql<{ allowed: boolean }[]>`
    select app.record_deletion_attempt() as allowed
  `;
  return rows[0]?.allowed === true;
};

type Paths = { audio: string[]; photos: string[] };

export const collectStoragePaths = async (sql: Sql) => {
  const rows = await sql<{ bucket: "audio" | "photos"; path: string }[]>`
    select bucket_id as bucket, name as path from storage.objects
    where bucket_id in ('audio', 'photos')
    union
    select 'audio', audio_path from app.sessions where audio_path is not null
    union
    select 'photos', photo_path from app.reviews where photo_path is not null
  `;
  return {
    audio: rows.filter((row) => row.bucket === "audio").map((r) => r.path),
    photos: rows.filter((row) => row.bucket === "photos").map((r) => r.path),
  } satisfies Paths;
};

export const deleteUserRows = async (sql: Sql) => {
  const rows = await sql<{ id: string }[]>`
    delete from app.users where id = app.current_user_id() returning id
  `;
  return rows.length === 1;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export const retryUntilDone = async (
  work: () => Promise<void>,
  delaysMs: readonly number[] = DELETE_RETRY_DELAYS_MS,
  wait: (ms: number) => Promise<void> = sleep,
) => {
  for (const delay of delaysMs) {
    try {
      await work();
      return;
    } catch {
      await wait(delay);
    }
  }
  await work();
};

export const removeUserObjects = async (store: ObjectStore, paths: Paths) => {
  if (paths.audio.length > 0) {
    await retryUntilDone(() => store.remove("audio", paths.audio));
  }
  if (paths.photos.length > 0) {
    await retryUntilDone(() => store.remove("photos", paths.photos));
  }
};
