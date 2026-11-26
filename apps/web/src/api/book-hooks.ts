import type { components } from "@book-tracking-system/api-contract/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { photoExtension } from "../books/book-logic.ts";
import { api, ApiError, unwrap } from "./client.ts";

type FinishCreate = components["schemas"]["FinishCreate"];

export function useBookSessions(id: string) {
  return useQuery({
    queryKey: ["books", id, "sessions"],
    queryFn: async () =>
      unwrap(
        await api.GET("/books/{id}/sessions", { params: { path: { id } } }),
      ),
  });
}

export function useBookInsights(id: string) {
  return useQuery({
    queryKey: ["books", id, "insights"],
    queryFn: async () =>
      unwrap(
        await api.GET("/books/{id}/insights", { params: { path: { id } } }),
      ),
  });
}

const SUMMARY_POLLS = 10;
const SUMMARY_POLL_MS = 3000;

export function useBookReview(
  id: string,
  enabled: boolean,
  waitForSummary = false,
) {
  return useQuery({
    queryKey: ["books", id, "review"],
    enabled,
    queryFn: async () =>
      unwrap(await api.GET("/books/{id}/review", { params: { path: { id } } })),
    refetchInterval: (query) =>
      waitForSummary &&
      query.state.data?.summary == null &&
      query.state.dataUpdateCount < SUMMARY_POLLS
        ? SUMMARY_POLL_MS
        : false,
  });
}

export function useRegenerateSummary(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST("/books/{id}/summary", { params: { path: { id } } }),
      ),
    onSuccess: (review) =>
      queryClient.setQueryData(["books", id, "review"], review),
  });
}

export function useBookReflections(id: string) {
  return useQuery({
    queryKey: ["books", id, "reflections"],
    queryFn: async () =>
      unwrap(
        await api.GET("/books/{id}/reflections", { params: { path: { id } } }),
      ),
  });
}

export function useAskReflections(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stage: "mid" | "end" | "recall") =>
      unwrap(
        await api.POST("/books/{id}/reflections", {
          params: { path: { id } },
          body: { stage },
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["books", id, "reflections"],
      }),
  });
}

export function useAnswerReflection(bookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; answer: string | null }) =>
      unwrap(
        await api.PATCH("/reflections/{id}", {
          params: { path: { id: input.id } },
          body: { answer: input.answer },
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["books", bookId, "reflections"],
      }),
  });
}

export async function uploadFinishPhoto(bookId: string, file: File) {
  const extension = photoExtension(file.type);
  if (extension === null) {
    throw new ApiError("Choose a JPEG, PNG or WebP photo.");
  }
  const signed = unwrap(
    await api.POST("/books/{id}/finish-photo", {
      params: { path: { id: bookId } },
      body: { extension },
    }),
  );
  await putSignedPhoto(signed.uploadUrl, file);
}

export async function putSignedPhoto(uploadUrl: string, file: File) {
  const form = new FormData();
  form.set("cacheControl", "3600");
  form.set("", file);
  const response = await fetch(uploadUrl, { method: "PUT", body: form });
  if (!response.ok) throw new ApiError("The photo did not upload. Try again.");
}

export function useFinishBook(bookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { body: FinishCreate; photo: File | null }) => {
      if (input.photo) await uploadFinishPhoto(bookId, input.photo);
      return unwrap(
        await api.POST("/books/{id}/finish", {
          params: { path: { id: bookId } },
          body: input.body,
        }),
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["books"] }),
  });
}
