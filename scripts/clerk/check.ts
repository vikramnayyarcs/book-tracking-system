import { fileURLToPath } from "node:url";
import {
  evaluate,
  type ClerkEnvironment,
  type ClerkInstance,
} from "./expected.ts";

const getJson = async (url: string, headers: Record<string, string> = {}) => {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GET ${new URL(url).pathname} failed: ${response.status}`);
  }
  return response.json();
};

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  const secretKey = process.env["CLERK_SECRET_KEY"];
  const frontendApiUrl = process.env["CLERK_FRONTEND_API_URL"];
  if (!secretKey || !frontendApiUrl) {
    console.error("Set CLERK_SECRET_KEY and CLERK_FRONTEND_API_URL.");
    process.exit(2);
  }
  const instance = (await getJson("https://api.clerk.com/v1/instance", {
    authorization: `Bearer ${secretKey}`,
  })) as ClerkInstance;
  const environment = (await getJson(
    new URL("/v1/environment", frontendApiUrl).toString(),
  )) as ClerkEnvironment;

  const findings = evaluate(environment, instance);
  if (findings.length === 0) {
    console.log("Clerk dev instance matches infra/clerk-checklist.md.");
  } else {
    for (const finding of findings) {
      console.error(
        `Mismatch: ${finding.setting}: expected ${finding.expected}, found ${finding.actual}`,
      );
    }
    process.exit(1);
  }
}
