import { createApp, jsonLogger } from "../../../packages/core/src/api/index.ts";

const app = createApp({
  gatewaySecret: Deno.env.get("GATEWAY_SECRET") ?? "",
  logger: jsonLogger((line) => console.log(line)),
  newRequestId: () => crypto.randomUUID(),
  now: () => Date.now(),
});

Deno.serve((request) => {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/^\/api(?=\/)/, "");
  return app.fetch(new Request(url, request));
});
