import type { components } from "@book-tracking-system/api-contract/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "./client.ts";

type BookCreate = components["schemas"]["BookCreate"];

export function useLookupIsbn() {
  return useMutation({
    mutationFn: async (isbn: string) =>
      unwrap(
        await api.GET("/lookup/isbn/{isbn}", { params: { path: { isbn } } }),
      ),
  });
}

export function useSearchLookupBooks() {
  return useMutation({
    mutationFn: async (q: string) =>
      unwrap(await api.GET("/lookup/books", { params: { query: { q } } })),
  });
}

export function useCreateBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: BookCreate) =>
      unwrap(await api.POST("/books", { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["books"] }),
  });
}
