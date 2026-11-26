import type { components } from "@book-tracking-system/api-contract/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "./client.ts";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => unwrap(await api.GET("/me")),
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: ["search", q],
    enabled: q.length > 0,
    queryFn: async () =>
      unwrap(await api.GET("/search", { params: { query: { q } } })),
  });
}

export function useActivity(year: number) {
  return useQuery({
    queryKey: ["activity", year],
    queryFn: async () =>
      unwrap(await api.GET("/activity", { params: { query: { year } } })),
  });
}

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: async () => unwrap(await api.GET("/stats")),
  });
}

export function useReadingBooks() {
  return useQuery({
    queryKey: ["books", "reading"],
    queryFn: async () =>
      unwrap(
        await api.GET("/books", { params: { query: { status: "reading" } } }),
      ),
  });
}

export function useBooks() {
  return useQuery({
    queryKey: ["books", "all"],
    queryFn: async () => unwrap(await api.GET("/books")),
  });
}

export function useUpdateBookStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      body: components["schemas"]["BookUpdate"];
    }) =>
      unwrap(
        await api.PATCH("/books/{id}", {
          params: { path: { id: input.id } },
          body: input.body,
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["books"] }),
  });
}
