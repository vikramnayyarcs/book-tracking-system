import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { clearDeviceData } from "./clear-device-data.ts";

describe("clearDeviceData", () => {
  it("empties the Query cache and finishes when the runtime has no IndexedDB or caches", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["sessions", "b1"], { note: "seeded note" });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1);

    await clearDeviceData(queryClient);

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
