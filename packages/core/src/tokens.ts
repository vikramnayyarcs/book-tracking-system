import type { Sql } from "./api/db.ts";

export const TOKEN_SCOPES = ["sessions:write", "books:read"] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];

export const TOKEN_PREFIX = "btp_";

export type Token = {
  id: string;
  name: string;
  scopes: TokenScope[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type TokenRow = {
  id: string;
  name: string;
  scopes: TokenScope[];
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
};

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

export const isPersonalToken = (token: string) =>
  token.startsWith(TOKEN_PREFIX);

export const generateToken = () =>
  `${TOKEN_PREFIX}${toBase64Url(crypto.getRandomValues(new Uint8Array(32)))}`;

export const hashToken = async (token: string) =>
  toHex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
  );

export const hasScope = (
  granted: readonly TokenScope[] | undefined,
  needed: TokenScope,
) => granted === undefined || granted.includes(needed);

type TokenCreateResult =
  | { ok: true; name: string; scopes: TokenScope[] }
  | { ok: false; detail: string };

export const parseTokenCreate = (body: unknown) => {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {
      ok: false,
      detail: "Body must be an object",
    } satisfies TokenCreateResult;
  }
  const record = body as Record<string, unknown>;
  const extra = Object.keys(record).filter(
    (key) => key !== "name" && key !== "scopes",
  );
  if (extra.length > 0) {
    return { ok: false, detail: "Unknown field" } satisfies TokenCreateResult;
  }
  const { name, scopes } = record;
  if (typeof name !== "string" || name.length < 1 || name.length > 80) {
    return {
      ok: false,
      detail: "name must be 1 to 80 characters",
    } satisfies TokenCreateResult;
  }
  if (
    !Array.isArray(scopes) ||
    scopes.length < 1 ||
    new Set(scopes).size !== scopes.length ||
    !scopes.every((scope) =>
      (TOKEN_SCOPES as readonly unknown[]).includes(scope),
    )
  ) {
    return {
      ok: false,
      detail: `scopes must be a unique, non-empty list of: ${TOKEN_SCOPES.join(", ")}`,
    } satisfies TokenCreateResult;
  }
  return {
    ok: true,
    name,
    scopes: scopes as TokenScope[],
  } satisfies TokenCreateResult;
};

const toToken = (row: TokenRow) =>
  ({
    id: row.id,
    name: row.name,
    scopes: row.scopes,
    createdAt: row.created_at.toISOString(),
    lastUsedAt: row.last_used_at?.toISOString() ?? null,
    revokedAt: row.revoked_at?.toISOString() ?? null,
  }) satisfies Token;

const columns = "id, name, scopes, created_at, last_used_at, revoked_at";

export const createToken = async (
  sql: Sql,
  name: string,
  scopes: TokenScope[],
) => {
  const secret = generateToken();
  const hash = await hashToken(secret);
  const rows = await sql<TokenRow[]>`
    insert into app.api_tokens (name, token_hash, scopes)
    values (${name}, ${hash}, ${scopes})
    returning ${sql.unsafe(columns)}
  `;
  return { ...toToken(rows[0] as TokenRow), token: secret };
};

export const listTokens = async (sql: Sql) => {
  const rows = await sql<TokenRow[]>`
    select ${sql.unsafe(columns)} from app.api_tokens order by created_at desc
  `;
  return rows.map(toToken);
};

export const revokeToken = async (sql: Sql, id: string) => {
  const rows = await sql`
    update app.api_tokens set revoked_at = now()
    where id = ${id} and revoked_at is null
    returning id
  `;
  return rows.length > 0;
};
