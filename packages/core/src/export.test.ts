import { describe, expect, it } from "vitest";
import {
  parseExportFormat,
  renderMarkdown,
  type VaultExport,
} from "./export.ts";

const data: VaultExport = {
  exportedAt: "2026-03-01T10:00:00.000Z",
  books: [
    {
      id: "b1",
      isbn: null,
      title: "An Invented Book",
      author: "Sample Author",
      coverUrl: null,
      pageCount: 100,
      status: "finished",
      startedOn: null,
      finishedOn: "2025-06-01",
      finishedPrecision: "month",
      addedRetrospectively: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      review: { rating: 4, text: "Warm and practical.", summary: null },
      sessions: [
        {
          id: "s1",
          bookId: "b1",
          date: "2026-02-01",
          pageFrom: 1,
          pageTo: 20,
          chapter: "One",
          noteText: "An invented note.",
          noteSource: "typed",
          audioSeconds: null,
          hasAudio: false,
          status: "ready",
          errorCode: null,
          createdAt: "2026-02-01T00:00:00.000Z",
        },
      ],
      insights: [
        {
          id: "i1",
          bookId: "b1",
          sessionId: "s1",
          kind: "quote",
          text: "A short quote",
          originalText: null,
          source: "user",
          page: 9,
          pinned: true,
          createdAt: "2026-02-01T00:00:00.000Z",
        },
      ],
      reflections: [
        { stage: "end", position: 1, question: "What stayed?", answer: null },
      ],
    },
  ],
};

describe("export", () => {
  it("accepts only json and markdown", () => {
    expect(parseExportFormat("json")).toBe("json");
    expect(parseExportFormat("markdown")).toBe("markdown");
    expect(parseExportFormat("zip")).toBeUndefined();
    expect(parseExportFormat(undefined)).toBeUndefined();
  });

  it("writes one section per book", () => {
    const markdown = renderMarkdown(data);
    expect(markdown).toContain("## An Invented Book");
    expect(markdown).toContain(
      "by Sample Author · status: finished · finished: 2025-06 · rating: 4/5",
    );
    expect(markdown).toContain("- > A short quote (p. 9) ★");
    expect(markdown).toContain("#### 2026-02-01 (pp. 1-20)");
    expect(markdown).toContain("_No answer._");
    expect(markdown.endsWith("\n")).toBe(true);
  });
});
