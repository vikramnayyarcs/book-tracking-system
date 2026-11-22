import { describe, expect, it } from "vitest";
import { EMBEDDING_DIMENSIONS, toVector } from "./embeddings.ts";

describe("toVector", () => {
  it("formats a vector of the right size for pgvector", () => {
    const values = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.5);
    expect(toVector(values)?.startsWith("[0.5,0.5")).toBe(true);
  });

  it("refuses a wrong size or a non-finite value", () => {
    expect(toVector([0.1, 0.2])).toBeUndefined();
    const bad = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.5);
    bad[3] = Number.NaN;
    expect(toVector(bad)).toBeUndefined();
  });
});
