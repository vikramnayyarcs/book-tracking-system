import type { components } from "@book-tracking-system/api-contract/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { api, unwrap } from "./client.ts";
import { uploadFinishPhoto } from "./book-hooks.ts";

type BookCreate = components["schemas"]["BookCreate"];
type Book = components["schemas"]["Book"];

export interface PastBookInput {
  body: BookCreate;
  rating: number | null;
  photo: File | null;
}

export function useAddPastBook() {
  const queryClient = useQueryClient();
  const created = useRef<Book | null>(null);
  return useMutation({
    mutationFn: async (input: PastBookInput) => {
      created.current ??= unwrap(
        await api.POST("/books", { body: input.body }),
      );
      const book = created.current;
      if (input.rating === null && input.photo === null) return book;
      if (input.photo) await uploadFinishPhoto(book.id, input.photo);
      const result = unwrap(
        await api.POST("/books/{id}/finish", {
          params: { path: { id: book.id } },
          body: {
            ...(input.rating === null ? {} : { rating: input.rating }),
            ...(input.body.finishedOn
              ? { finishedOn: input.body.finishedOn }
              : {}),
            ...(input.body.finishedPrecision
              ? { finishedPrecision: input.body.finishedPrecision }
              : {}),
          },
        }),
      );
      return result.book;
    },
    onSuccess: () => {
      created.current = null;
      return queryClient.invalidateQueries({ queryKey: ["books"] });
    },
  });
}
