import { useMutation, useQueryClient } from "@tanstack/react-query";
import { photoExtension } from "../books/book-logic.ts";
import { api, ApiError, unwrap } from "./client.ts";
import { putSignedPhoto } from "./book-hooks.ts";

export function useReadQuotePhoto(bookId: string) {
  return useMutation({
    mutationFn: async (file: File) => {
      if (photoExtension(file.type) === null) {
        throw new ApiError("Choose a JPEG, PNG or WebP photo.");
      }
      const upload = unwrap(
        await api.POST("/books/{id}/quote-photos", {
          params: { path: { id: bookId } },
        }),
      );
      await putSignedPhoto(upload.uploadUrl, file);
      return unwrap(
        await api.POST("/quote-photos/{id}/ocr", {
          params: { path: { id: upload.id } },
        }),
      ).lines;
    },
  });
}

export function useSaveQuote(bookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { text: string; page: number }) =>
      unwrap(
        await api.POST("/books/{id}/insights", {
          params: { path: { id: bookId } },
          body: { kind: "quote", text: input.text, page: input.page },
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["books", bookId, "insights"],
      }),
  });
}
