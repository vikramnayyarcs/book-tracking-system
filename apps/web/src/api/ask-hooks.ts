import { useMutation } from "@tanstack/react-query";
import { api, unwrap } from "./client.ts";

export function useAskVault() {
  return useMutation({
    mutationFn: async (question: string) =>
      unwrap(await api.POST("/ask", { body: { question } })),
  });
}
