import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

export const EMBED_STAND_IN_PORT = Number(
  process.env["EMBED_STAND_IN_PORT"] ?? "54391",
);

export const standInVector = (text: string) => {
  const values = Array.from({ length: 384 }, (_, i) => {
    let hash = 2166136261 + i;
    for (const char of text) {
      hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    }
    return (hash >>> 0) / 4294967295 - 0.5;
  });
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  return values.map((v) => v / norm);
};

const readBody = async (req: IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
};

const reply = (res: ServerResponse, json: unknown) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(json));
};

export const startEmbedStandIn = async () => {
  const requests: number[] = [];
  const server = createServer((req, res) => {
    void (async () => {
      const { input } = JSON.parse(await readBody(req)) as { input: string[] };
      requests.push(input.length);
      reply(res, { embeddings: input.map(standInVector) });
    })();
  });
  await new Promise<void>((resolve) =>
    server.listen(EMBED_STAND_IN_PORT, "127.0.0.1", resolve),
  );
  return {
    url: `http://127.0.0.1:${EMBED_STAND_IN_PORT}/embed`,
    requests,
    stop: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
};
