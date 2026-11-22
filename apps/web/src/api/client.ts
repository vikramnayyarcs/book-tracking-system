import type { paths } from "@book-tracking-system/api-contract/types";
import createClient from "openapi-fetch";
import { env } from "../env.ts";

type TokenProvider = () => Promise<string | null>;

let tokenProvider: TokenProvider = () => Promise.resolve(null);

export function setTokenProvider(provider: TokenProvider) {
  tokenProvider = provider;
}

export const api = createClient<paths>({ baseUrl: `${env.apiBaseUrl}/v1` });

api.use({
  async onRequest({ request }) {
    const token = await tokenProvider();
    if (token) request.headers.set("Authorization", `Bearer ${token}`);
    return request;
  },
});

export class ApiError extends Error {}

export function unwrap<T>(result: { data?: T; error?: { title?: string } }) {
  if (result.data === undefined) {
    throw new ApiError(result.error?.title ?? "The request failed");
  }
  return result.data;
}
