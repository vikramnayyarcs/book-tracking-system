import type { components } from "@book-tracking-system/api-contract/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, unwrap } from "./client.ts";

export function useBook(id: string) {
  return useQuery({
    queryKey: ["books", "one", id],
    queryFn: async () =>
      unwrap(await api.GET("/books/{id}", { params: { path: { id } } })),
  });
}

const settledStatuses = new Set(["ready", "failed"]);
const POLL_MS = 1500;

export function useBookSession(id: string) {
  return useQuery({
    queryKey: ["sessions", id],
    queryFn: async () =>
      unwrap(await api.GET("/sessions/{id}", { params: { path: { id } } })),
    refetchInterval: (query) =>
      query.state.data && settledStatuses.has(query.state.data.status)
        ? false
        : POLL_MS,
  });
}

export function useSessionInsights(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ["sessions", id, "insights"],
    enabled,
    queryFn: async () =>
      unwrap(
        await api.GET("/sessions/{id}/insights", {
          params: { path: { id } },
        }),
      ),
  });
}

export function useUpdateSessionNote(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (noteText: string) =>
      unwrap(
        await api.PATCH("/sessions/{id}", {
          params: { path: { id } },
          body: { noteText },
        }),
      ),
    onSuccess: (session) => {
      queryClient.setQueryData(["sessions", id], session);
    },
  });
}

export function useReprocessSession(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST("/sessions/{id}/process", {
          params: { path: { id } },
        }),
      ),
    onSuccess: (session) => {
      queryClient.setQueryData(["sessions", id], session);
    },
  });
}

export function useUpdateInsight(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      body: components["schemas"]["InsightUpdate"];
    }) =>
      unwrap(
        await api.PATCH("/insights/{id}", {
          params: { path: { id: input.id } },
          body: input.body,
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["sessions", sessionId, "insights"],
      }),
  });
}

export function useDeleteInsight(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await api.DELETE("/insights/{id}", {
        params: { path: { id } },
      });
      if (!result.response.ok) {
        throw new ApiError(result.error?.title ?? "The request failed");
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["sessions", sessionId, "insights"],
      }),
  });
}
