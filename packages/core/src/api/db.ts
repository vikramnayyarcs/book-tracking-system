import postgres from "postgres";
import type { Tier } from "../plans.ts";

export type Sql = postgres.TransactionSql;

export type Db = {
  asUser: <T>(
    userId: string,
    defaultTier: Tier,
    work: (sql: Sql) => Promise<T>,
  ) => Promise<{ result: T; tier: Tier }>;
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
  } satisfies Db;
};
