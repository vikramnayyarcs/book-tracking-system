import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { failedKeys, type KeyResult } from "./expiry.ts";
import {
  checkClerk,
  checkCloudflare,
  checkGithubApp,
  checkGrafana,
  checkGroq,
  checkR2State,
  checkSupabase,
} from "./providers.ts";

const guarded = async (name: string, run: () => Promise<KeyResult>) => {
  try {
    return await run();
  } catch {
    return {
      name,
      ok: false,
      reason: "check could not run",
    } satisfies KeyResult;
  }
};

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  const env = process.env;
  const now = new Date();
  const results = await Promise.all([
    guarded("CLOUDFLARE_API_TOKEN", () => checkCloudflare(env, now)),
    guarded("TF_GITHUB_APP_PRIVATE_KEY", () => checkGithubApp(env)),
    guarded("TF_STATE_R2_ACCESS_KEY_ID, TF_STATE_R2_SECRET_ACCESS_KEY", () =>
      checkR2State(env, now),
    ),
    guarded("DEV_SUPABASE_ACCESS_TOKEN", () => checkSupabase(env)),
    guarded("GRAFANA_CLOUD_ACCESS_POLICY_TOKEN", () => checkGrafana(env, now)),
    guarded("DEV_CLERK_SECRET_KEY", () => checkClerk(env)),
    guarded("DEV_GROQ_API_KEY", () => checkGroq(env)),
  ]);

  for (const result of results) {
    console.log(
      `${result.ok ? "ok  " : "FAIL"} ${result.name}${result.reason ? `: ${result.reason}` : ""}`,
    );
  }
  const outFile = env["KEY_CHECK_RESULTS"];
  if (outFile) writeFileSync(outFile, JSON.stringify(results));
  if (failedKeys(results).length > 0) process.exit(1);
}
