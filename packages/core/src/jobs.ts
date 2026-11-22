export const JOBS_HEADER = "x-jobs-secret";

export type JobStore = {
  claim: (job: string, runKey: string) => Promise<boolean>;
  release: (job: string, runKey: string) => Promise<void>;
};

export type Job = {
  bucketMinutes: number;
  run: () => Promise<void>;
};

export type JobResult = { job: string; runKey: string; ran: boolean };

const RUN_KEY = /^[A-Za-z0-9:_.-]{1,100}$/;

export const parseRunKey = (value: string | undefined) =>
  value !== undefined && RUN_KEY.test(value) ? value : undefined;

export const bucketRunKey = (nowMs: number, bucketMinutes: number) => {
  const size = bucketMinutes * 60_000;
  return new Date(Math.floor(nowMs / size) * size).toISOString();
};

export const JOBS: Record<string, Job> = {
  heartbeat: { bucketMinutes: 15, run: () => Promise.resolve() },
};

export const runJob = async (
  store: JobStore,
  jobs: Record<string, Job>,
  name: string,
  nowMs: number,
  runKey?: string,
) => {
  const job = Object.hasOwn(jobs, name) ? jobs[name] : undefined;
  if (job === undefined) {
    return undefined;
  }
  const key = runKey ?? bucketRunKey(nowMs, job.bucketMinutes);
  if (!(await store.claim(name, key))) {
    return { job: name, runKey: key, ran: false } satisfies JobResult;
  }
  try {
    await job.run();
  } catch (error) {
    await store.release(name, key);
    throw error;
  }
  return { job: name, runKey: key, ran: true } satisfies JobResult;
};
