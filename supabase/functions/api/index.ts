import {
  clerkVerifier,
  createApp,
  createDb,
  jsonLogger,
} from "../../../packages/core/src/api/index.ts";
import {
  groqSpeech,
  groqText,
  groqVision,
  httpEmbedder,
  INSIGHT_MODEL,
  VISION_MODEL,
} from "../../../packages/core/src/ai/index.ts";
import { brand } from "../../../packages/core/src/brand.ts";
import type { Embedder } from "../../../packages/core/src/ai/types.ts";
import { parseTier } from "../../../packages/core/src/plans.ts";

declare const EdgeRuntime: { waitUntil: (work: Promise<unknown>) => void };
declare const Supabase: {
  ai: {
    Session: new (model: string) => {
      run: (
        input: string,
        options: { mean_pool: boolean; normalize: boolean },
      ) => Promise<unknown>;
    };
  };
};

const groqKey = Deno.env.get("GROQ_API_KEY") ?? "";
const groqUrl = Deno.env.get("GROQ_URL") ?? undefined;

const embeddingsUrl = Deno.env.get("EMBEDDINGS_URL");
const gteSession =
  embeddingsUrl === undefined
    ? new Supabase.ai.Session("gte-small")
    : undefined;

const embedder: Embedder =
  embeddingsUrl === undefined
    ? {
        embed: async (texts) =>
          Promise.all(
            texts.map(
              async (text) =>
                (await gteSession?.run(text, {
                  mean_pool: true,
                  normalize: true,
                })) as number[],
            ),
          ),
      }
    : httpEmbedder({ url: embeddingsUrl });

const app = createApp({
  allowedOrigins: (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== ""),
  embedder,
  speech: groqSpeech({ apiKey: groqKey, baseUrl: groqUrl }),
  text: groqText({ apiKey: groqKey, model: INSIGHT_MODEL, baseUrl: groqUrl }),
  vision: groqVision({
    apiKey: groqKey,
    model: VISION_MODEL,
    baseUrl: groqUrl,
  }),
  waitUntil: (work) => EdgeRuntime.waitUntil(work),
  gatewaySecret: Deno.env.get("GATEWAY_SECRET") ?? "",
  jobsSecret: Deno.env.get("JOBS_SECRET") ?? "",
  logger: jsonLogger((line) => console.log(line)),
  newRequestId: () => crypto.randomUUID(),
  now: () => Date.now(),
  verifyToken: clerkVerifier(Deno.env.get("CLERK_ISSUER") ?? ""),
  db: createDb(
    Deno.env.get("DATABASE_URL") ?? Deno.env.get("SUPABASE_DB_URL") ?? "",
  ),
  objects: {
    signedUploadUrl: async (bucket, path) => {
      const response = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/upload/sign/${bucket}/${path}`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "content-type": "application/json",
          },
          body: "{}",
        },
      );
      if (!response.ok) {
        throw new Error(`Storage sign returned ${response.status}`);
      }
      const { url } = (await response.json()) as { url: string };
      const publicBase =
        Deno.env.get("STORAGE_PUBLIC_URL") ??
        `${Deno.env.get("SUPABASE_URL")}/storage/v1`;
      return { url: `${publicBase}${url}`, expiresInSeconds: 7200 };
    },
    download: async (bucket, path) => {
      const response = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/${bucket}/${path}`,
        {
          headers: {
            authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
        },
      );
      if (!response.ok) {
        throw new Error(`Storage download returned ${response.status}`);
      }
      return response.blob();
    },
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
  vapidPublicKey: Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
  vapidPrivateKey: Deno.env.get("VAPID_PRIVATE_KEY") ?? "",
  vapidSubject: Deno.env.get("VAPID_SUBJECT") ?? `https://${brand.domain}`,
  defaultTier: parseTier(Deno.env.get("DEFAULT_TIER")) ?? "free",
});

Deno.serve((request) => {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/^\/api(?=\/)/, "");
  return app.fetch(new Request(url, request));
});
