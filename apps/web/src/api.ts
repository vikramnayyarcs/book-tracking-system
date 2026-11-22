import type { paths } from "@book-tracking-system/api-contract/types";
import createClient from "openapi-fetch";
import { env } from "./env.ts";

export const api = createClient<paths>({ baseUrl: env.apiBaseUrl });
