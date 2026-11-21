export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    const upstream = new URL(
      `${env.UPSTREAM_URL}${incoming.pathname}${incoming.search}`,
    );
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.set("x-gateway-secret", env.GATEWAY_SECRET);
    return fetch(
      new Request(upstream, {
        method: request.method,
        headers,
        body: request.body,
        redirect: "manual",
      }),
    );
  },
};
