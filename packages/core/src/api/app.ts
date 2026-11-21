import { Hono } from "hono";
import type { Logger } from "./logger.ts";
import { problemResponse } from "./problem.ts";

export const GATEWAY_HEADER = "x-gateway-secret";
export const REQUEST_ID_HEADER = "x-request-id";

export type ApiDeps = {
  gatewaySecret: string;
  logger: Logger;
  newRequestId: () => string;
  now: () => number;
};

type Env = { Variables: { requestId: string } };

const sameSecret = (a: string, b: string) => {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < left.length; i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i % Math.max(right.length, 1)] ?? 0);
  }
  return diff === 0;
};

export const createApp = (deps: ApiDeps) => {
  const app = new Hono<Env>().basePath("/v1");

  app.use("*", async (c, next) => {
    const requestId = deps.newRequestId();
    c.set("requestId", requestId);
    const started = deps.now();
    const url = new URL(c.req.url);
    let errorName: string | undefined;
    const supplied = c.req.header(GATEWAY_HEADER);
    if (
      deps.gatewaySecret === "" ||
      supplied === undefined ||
      !sameSecret(supplied, deps.gatewaySecret)
    ) {
      c.res = problemResponse(
        403,
        "gateway_rejected",
        "Request did not come through the gateway",
        requestId,
      );
    } else {
      try {
        await next();
      } catch (error) {
        errorName = error instanceof Error ? error.name : "UnknownError";
        c.res = problemResponse(
          500,
          "internal_error",
          "Internal error",
          requestId,
        );
      }
    }
    c.res.headers.set(REQUEST_ID_HEADER, requestId);
    const fields = {
      requestId,
      method: c.req.method,
      path: url.pathname,
      status: c.res.status,
      durationMs: deps.now() - started,
      ...(errorName === undefined ? {} : { errorName }),
    };
    if (c.res.status >= 500) {
      deps.logger.error(fields);
    } else {
      deps.logger.info(fields);
    }
  });

  app.get("/health", (c) => c.json({ status: "ok" as const }));

  app.notFound((c) =>
    problemResponse(404, "not_found", "Not found", c.get("requestId")),
  );

  return app;
};
