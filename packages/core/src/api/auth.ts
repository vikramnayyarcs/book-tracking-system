import { createRemoteJWKSet, jwtVerify } from "jose";

export type Caller = { userId: string };

export type TokenVerifier = (token: string) => Promise<Caller | undefined>;

export const clerkVerifier = (issuer: string): TokenVerifier => {
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, jwks, { issuer });
      return typeof payload.sub === "string" && payload.sub !== ""
        ? { userId: payload.sub }
        : undefined;
    } catch {
      return undefined;
    }
  };
};

export const bearerToken = (header: string | undefined) => {
  const match = /^Bearer (\S+)$/.exec(header ?? "");
  return match?.[1];
};
