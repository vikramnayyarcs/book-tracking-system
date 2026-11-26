import { readFileSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

const fixture = (name: string) =>
  readFileSync(
    new URL(`../../packages/core/src/ai/fixtures/${name}`, import.meta.url),
    "utf8",
  );

const transcription = fixture("groq-transcription.json");
const extraction = fixture("groq-chat-extraction.json");
const questions = fixture("groq-chat-questions.json");
const summary = fixture("groq-chat-summary.json");

export const STAND_IN_PORT = Number(
  process.env["GROQ_STAND_IN_PORT"] ?? "54390",
);

export type SeenRequest =
  | {
      kind: "transcription";
      model: string;
      fileName: string;
      fileBytes: number;
    }
  | { kind: "chat"; userMessage: string };

const readBody = async (req: IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
};

const reply = (res: ServerResponse, json: string) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(json);
};

export const startGroqStandIn = async () => {
  const seen: SeenRequest[] = [];
  const server = createServer((req, res) => {
    void (async () => {
      const body = await readBody(req);
      if (req.url === "/openai/v1/audio/transcriptions") {
        const form = await new Response(body, {
          headers: { "content-type": req.headers["content-type"] ?? "" },
        }).formData();
        const file = form.get("file");
        seen.push({
          kind: "transcription",
          model: String(form.get("model")),
          fileName: file instanceof File ? file.name : "",
          fileBytes: file instanceof File ? file.size : 0,
        });
        reply(res, transcription);
      } else if (req.url === "/openai/v1/chat/completions") {
        const parsed = JSON.parse(body.toString("utf8")) as {
          messages: { role: string; content: string }[];
        };
        const system =
          parsed.messages.find((m) => m.role === "system")?.content ?? "";
        seen.push({
          kind: "chat",
          userMessage:
            parsed.messages.find((m) => m.role === "user")?.content ?? "",
        });
        reply(
          res,
          system.includes("write a short summary of a book")
            ? summary
            : system.includes("write reflection questions") ||
                system.includes("remember a book")
              ? questions
              : extraction,
        );
      } else {
        res.writeHead(404);
        res.end();
      }
    })();
  });
  await new Promise<void>((resolve) =>
    server.listen(STAND_IN_PORT, "0.0.0.0", resolve),
  );
  return {
    seen,
    stop: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
};
