import postgres from "postgres";
import type { Tier } from "../plans.ts";
import type { TokenScope } from "../tokens.ts";
import type { JobStore } from "../jobs.ts";

export type Sql = postgres.TransactionSql;

export type Db = {
  asUser: <T>(
    userId: string,
    defaultTier: Tier,
    work: (sql: Sql) => Promise<T>,
  ) => Promise<{ result: T; tier: Tier }>;
  lookupToken: (
    hash: string,
  ) => Promise<{ userId: string; scopes: TokenScope[] } | undefined>;
  jobs: JobStore;
};

export const createDb = (connectionString: string) => {
  const pool = postgres(connectionString, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
  });
  return {
    asUser: async (userId, defaultTier, work) =>
      pool.begin(async (sql) => {
        await sql`select set_config('role', 'authenticated', true)`;
        await sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
        const rows = await sql<{ tier: Tier }[]>`
          select app.ensure_user(${defaultTier}) as tier
        `;
        const tier = rows[0]?.tier ?? defaultTier;
        return { result: await work(sql), tier };
      }),
    lookupToken: async (hash) => {
      const rows = await pool<{ user_id: string; scopes: TokenScope[] }[]>`
        select user_id, scopes from app.token_lookup(${hash})
      `;
      const row = rows[0];
      return row === undefined
        ? undefined
        : { userId: row.user_id, scopes: row.scopes };
    },
    jobs: {
      claim: async (job, runKey) => {
        const rows = await pool`
          insert into app.job_runs (job, run_key) values (${job}, ${runKey})
          on conflict do nothing
          returning job
        `;
        return rows.length === 1;
      },
      release: async (job, runKey) => {
        await pool`
          delete from app.job_runs where job = ${job} and run_key = ${runKey}
        `;
      },
    },
  } satisfies Db;
};
