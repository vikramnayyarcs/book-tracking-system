import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { groqVision } from "./ai/groq.ts";
import { parseLines, readPageLines } from "./ai/ocr.ts";
import recorded from "./ai/fixtures/groq-chat-ocr.json" with { type: "json" };
import {
  OCR_MAX_BYTES,
  quotePhotoPath,
  readQuotePhoto,
} from "./quote-photos.ts";
import type { ObjectStore } from "./api/storage.ts";

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const page = new Blob([new Uint8Array(pngSignature)], { type: "image/png" });

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const completions = "https://api.groq.com/openai/v1/chat/completions";

const useRecorded = () => {
  const seen: { model: string; image: string }[] = [];
  server.use(
    http.post(completions, async ({ request }) => {
      const body = (await request.json()) as {
        model: string;
        messages: { content: unknown }[];
      };
      const parts = body.messages[1]?.content as {
        type: string;
        image_url?: { url: string };
      }[];
      seen.push({
        model: body.model,
        image: parts.find((p) => p.type === "image_url")?.image_url?.url ?? "",
      });
      return HttpResponse.json(recorded);
    }),
  );
  return seen;
};

const holder = (blob: Blob | undefined) => {
  const stored = new Map<string, Blob>();
  const removed: string[] = [];
  if (blob !== undefined) {
    stored.set(quotePhotoPath("user-a", "photo-1"), blob);
  }
  const objects: ObjectStore = {
    download: (_bucket, path) => {
      const found = stored.get(path);
      return found === undefined
        ? Promise.reject(new Error("missing"))
        : Promise.resolve(found);
    },
    remove: (_bucket, paths) => {
      removed.push(...paths);
      for (const path of paths) stored.delete(path);
      return Promise.resolve();
    },
    signedUploadUrl: () => Promise.reject(new Error("not used")),
  };
  return { objects, removed, stored };
};

describe("parseLines", () => {
  it("trims, drops empty lines and caps the list", () => {
    expect(parseLines({ lines: [" a ", "", "  ", "b"] })).toEqual(["a", "b"]);
    expect(parseLines({ lines: [] })).toEqual([]);
    expect(
      parseLines({ lines: Array.from({ length: 300 }, () => "x") }),
    ).toHaveLength(200);
  });

  it("rejects output that is not a list of strings", () => {
    expect(() => parseLines({ lines: "text" })).toThrow("ai_bad_output");
    expect(() => parseLines({ lines: [1] })).toThrow("ai_bad_output");
    expect(() => parseLines(null)).toThrow("ai_bad_output");
  });
});

describe("groq vision client", () => {
  it("sends the image as a data URL and reads lines from a recorded response", async () => {
    const seen = useRecorded();
    const vision = groqVision({ apiKey: "test", model: "recorded" });
    const result = await readPageLines(vision, page);
    expect(result.lines).toEqual([
      "The lighthouse keeper of Marrowick counted tides",
      "the way other people counted coins. Each evening",
      "he wrote one number in a blue ledger and closed it.",
      "Nobody asked him why. The sea, he said, kept",
      "better accounts than any bank in the valley.",
    ]);
    expect(result.usage.inputTokens).toBeGreaterThan(0);
    expect(seen[0]?.model).toBe("recorded");
    expect(seen[0]?.image.startsWith("data:image/png;base64,iVBOR")).toBe(true);
  });

  it("maps 429 to ai_rate_limited", async () => {
    server.use(
      http.post(completions, () => new HttpResponse(null, { status: 429 })),
    );
    const vision = groqVision({ apiKey: "test", model: "m" });
    await expect(readPageLines(vision, page)).rejects.toMatchObject({
      code: "ai_rate_limited",
    });
  });
});

describe("readQuotePhoto", () => {
  const vision = groqVision({ apiKey: "test", model: "recorded" });

  it("returns lines and deletes the photo", async () => {
    useRecorded();
    const { objects, removed, stored } = holder(page);
    const result = await readQuotePhoto(
      { objects, vision },
      "user-a",
      "photo-1",
    );
    expect(result.status).toBe("ok");
    expect(removed).toEqual([quotePhotoPath("user-a", "photo-1")]);
    expect(stored.size).toBe(0);
  });

  it("deletes the photo when the provider fails", async () => {
    server.use(
      http.post(completions, () => new HttpResponse(null, { status: 500 })),
    );
    const { objects, stored } = holder(page);
    await expect(
      readQuotePhoto({ objects, vision }, "user-a", "photo-1"),
    ).rejects.toMatchObject({ code: "ai_provider_error" });
    expect(stored.size).toBe(0);
  });

  it("deletes a photo that is too large or not an image, without calling the provider", async () => {
    const big = holder(
      new Blob([new Uint8Array(OCR_MAX_BYTES + 1)], { type: "image/png" }),
    );
    expect(
      (
        await readQuotePhoto(
          { objects: big.objects, vision },
          "user-a",
          "photo-1",
        )
      ).status,
    ).toBe("invalid");
    expect(big.stored.size).toBe(0);

    const text = holder(new Blob(["hello"], { type: "text/plain" }));
    expect(
      (
        await readQuotePhoto(
          { objects: text.objects, vision },
          "user-a",
          "photo-1",
        )
      ).status,
    ).toBe("invalid");
    expect(text.stored.size).toBe(0);
  });

  it("says not found for a photo that is not in the caller's folder", async () => {
    const { objects, stored } = holder(page);
    const result = await readQuotePhoto(
      { objects, vision },
      "user-b",
      "photo-1",
    );
    expect(result.status).toBe("not_found");
    expect(stored.size).toBe(1);
  });
});
