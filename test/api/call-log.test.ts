import { describe, expect, it } from "vitest";
import { redact } from "./call-log.ts";

describe("redact", () => {
  it("keeps listed fields and hides note text, transcripts and links", () => {
    const result = redact({
      title: "Invented book",
      noteText: "invented private words",
      items: [{ id: "a1", transcript: "invented spoken words", pageFrom: 3 }],
      upload: { url: "https://example.test/signed?token=secret" },
    });
    expect(result).toEqual({
      title: "Invented book",
      noteText: "[hidden]",
      items: [{ id: "a1", transcript: "[hidden]", pageFrom: 3 }],
      upload: { url: "[hidden]" },
    });
  });
});
