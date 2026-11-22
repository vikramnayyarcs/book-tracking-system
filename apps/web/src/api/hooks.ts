import { useQuery } from "@tanstack/react-query";
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
