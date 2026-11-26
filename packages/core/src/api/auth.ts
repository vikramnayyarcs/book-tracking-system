import { createRemoteJWKSet, jwtVerify } from "jose";
import type { TokenScope } from "../tokens.ts";
import { freshestVerification } from "../account.ts";

export type Caller = {
  userId: string;
  scopes?: readonly TokenScope[];
  verifiedMinutesAgo?: number;
};

export type TokenVerifier = (token: string) => Promise<Caller | undefined>;

const optionalAge = (age: number | undefined) =>
  age === undefined ? {} : { verifiedMinutesAgo: age };

export const clerkVerifier = (issuer: string) => {
  let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
  return (async (token) => {
    try {
      jwks ??= createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
      const { payload } = await jwtVerify(token, jwks, { issuer });
      return typeof payload.sub === "string" && payload.sub !== ""
        ? {
            userId: payload.sub,
            ...optionalAge(freshestVerification(payload["fva"])),
          }
        : undefined;
    } catch {
      return undefined;
    }
  }) satisfies TokenVerifier;
};

export const bearerToken = (header: string | undefined) => {
  const match = /^Bearer (\S+)$/.exec(header ?? "");
  return match?.[1];
};
