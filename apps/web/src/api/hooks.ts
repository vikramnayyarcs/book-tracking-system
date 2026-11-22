import type { components } from "@book-tracking-system/api-contract/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "./client.ts";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => unwrap(await api.GET("/me")),
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
