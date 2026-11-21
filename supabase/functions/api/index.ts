import {
  clerkVerifier,
  createApp,
  createDb,
  jsonLogger,
} from "../../../packages/core/src/api/index.ts";
import { parseTier } from "../../../packages/core/src/plans.ts";

const app = createApp({
  gatewaySecret: Deno.env.get("GATEWAY_SECRET") ?? "",
  logger: jsonLogger((line) => console.log(line)),
  newRequestId: () => crypto.randomUUID(),
  now: () => Date.now(),
  verifyToken: clerkVerifier(Deno.env.get("CLERK_ISSUER") ?? ""),
  db: createDb(
    Deno.env.get("DATABASE_URL") ?? Deno.env.get("SUPABASE_DB_URL") ?? "",
  ),
  objects: {
    remove: async (bucket, paths) => {
      const response = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/${bucket}`,
        {
          method: "DELETE",
          headers: {
            authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ prefixes: paths }),
        },
      );
      if (!response.ok) {
        throw new Error(`Storage delete returned ${response.status}`);
      }
    },
  },
  fetch: (input, init) => fetch(input, init),
  openLibraryUrl: Deno.env.get("OPEN_LIBRARY_URL") ?? "https://openlibrary.org",
  defaultTier: parseTier(Deno.env.get("DEFAULT_TIER")) ?? "free",
});

Deno.serve((request) => {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/^\/api(?=\/)/, "");
  return app.fetch(new Request(url, request));
});
