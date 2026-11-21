import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Tier } from "../plans.ts";
import { bearerToken, type TokenVerifier } from "./auth.ts";
import type { Db, Sql } from "./db.ts";
import {
  createBook,
  deleteBook,
  getBook,
  listBooks,
  parseBookFields,
  storagePathsForBook,
  updateBook,
  BOOK_STATUSES,
  type BookStatus,
} from "../books.ts";
import {
  createToken,
  hasScope,
  hashToken,
  isPersonalToken,
  listTokens,
  parseTokenCreate,
  revokeToken,
  type TokenScope,
} from "../tokens.ts";
import {
  createInsight,
  deleteInsight,
  listBookInsights,
  listSessionInsights,
  parseInsightCreate,
  parseInsightUpdate,
  updateInsight,
} from "../insights.ts";
import {
  audioPath,
  createSession,
  deleteSession,
  getSession,
  listBookSessions,
  mayUploadAudio,
  parseAudioUpload,
  parseSessionCreate,
  parseSessionUpdate,
  sessionAudioPath,
  setSessionAudio,
  updateSession,
} from "../sessions.ts";
import {
  currentPhotoPath,
  finishBook,
  getReview,
  parseFinish,
  parsePhotoUpload,
  photoPath,
  setFinishPhoto,
} from "../finish.ts";
import { collectExport, parseExportFormat, renderMarkdown } from "../export.ts";
import { parseSearch, searchVault } from "../search.ts";
import {
  deletePushSubscription,
  getNudgeSettings,
  parseEndpointQuery,
  parseMeUpdate,
  parsePushSubscription,
  savePushSubscription,
  updateNudgeSettings,
} from "../nudge.ts";
import { lookupIsbn, normalizeIsbn } from "../isbn.ts";
import type { Logger } from "./logger.ts";
import type { ObjectStore } from "./storage.ts";
import type { SpeechToText, TextModel } from "../ai/types.ts";
import {
  loadProcessInfo,
  markStatus,
  planProcessing,
  runProcessing,
} from "../processing.ts";
import { askReflectionQuestions } from "../ai/questions.ts";
import {
  answerReflection,
  listReflections,
  loadReflectionSource,
  parseReflectionAnswer,
  parseReflectionCreate,
  saveQuestions,
} from "../reflections.ts";
import { AiError } from "../ai/types.ts";
import { problemResponse } from "./problem.ts";

export const GATEWAY_HEADER = "x-gateway-secret";
export const REQUEST_ID_HEADER = "x-request-id";

export type ApiDeps = {
  gatewaySecret: string;
  logger: Logger;
  newRequestId: () => string;
  now: () => number;
  verifyToken: TokenVerifier;
  db: Db;
  defaultTier: Tier;
  objects: ObjectStore;
  fetch: typeof fetch;
  openLibraryUrl: string;
  speech: SpeechToText;
  text: TextModel;
  waitUntil: (work: Promise<unknown>) => void;
};

type Env = {
  Variables: {
    requestId: string;
    userId: string;
    withUser: <T>(
      work: (sql: Sql) => Promise<T>,
    ) => Promise<{ result: T; tier: Tier }>;
  };
};

const sameSecret = (a: string, b: string) => {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < left.length; i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i % Math.max(right.length, 1)] ?? 0);
  }
  return diff === 0;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const notFound = (requestId: string) =>
  problemResponse(404, "not_found", "Not found", requestId);

const invalid = (detail: string, requestId: string) =>
  problemResponse(
    400,
    "validation_failed",
    "Invalid request",
    requestId,
    detail,
  );

export const createApp = (deps: ApiDeps) => {
  const app = new Hono<Env>().basePath("/v1");

  const auth = (scope?: TokenScope) =>
    createMiddleware<Env>(async (c, next) => {
      const token = bearerToken(c.req.header("authorization"));
      const caller =
        token === undefined
          ? undefined
          : isPersonalToken(token)
            ? await deps.db.lookupToken(await hashToken(token))
            : await deps.verifyToken(token);
      if (caller === undefined) {
        return problemResponse(
          401,
          "unauthorized",
          "Missing or invalid token",
          c.get("requestId"),
        );
      }
      const personal = token !== undefined && isPersonalToken(token);
      if (
        personal &&
        (scope === undefined || !hasScope(caller.scopes, scope))
      ) {
        return problemResponse(
          403,
          "insufficient_scope",
          "This token cannot use this route",
          c.get("requestId"),
        );
      }
      c.set("userId", caller.userId);
      c.set("withUser", (work) =>
        deps.db.asUser(caller.userId, deps.defaultTier, work),
      );
      await next();
    });
  const authenticated = auth();

  app.use("*", async (c, next) => {
    const requestId = deps.newRequestId();
    c.set("requestId", requestId);
    const started = deps.now();
    const url = new URL(c.req.url);
    let errorName: string | undefined;
    const supplied = c.req.header(GATEWAY_HEADER);
    if (
      deps.gatewaySecret === "" ||
      supplied === undefined ||
      !sameSecret(supplied, deps.gatewaySecret)
    ) {
      c.res = problemResponse(
        403,
        "gateway_rejected",
        "Request did not come through the gateway",
        requestId,
      );
    } else {
      try {
        await next();
      } catch (error) {
        errorName = error instanceof Error ? error.name : "UnknownError";
        c.res = problemResponse(
          500,
          "internal_error",
          "Internal error",
          requestId,
        );
      }
    }
    c.res.headers.set(REQUEST_ID_HEADER, requestId);
    const fields = {
      requestId,
      method: c.req.method,
      path: url.pathname,
      status: c.res.status,
      durationMs: deps.now() - started,
      ...(errorName === undefined ? {} : { errorName }),
    };
    if (c.res.status >= 500) {
      deps.logger.error(fields);
    } else {
      deps.logger.info(fields);
    }
  });

  app.get("/health", (c) => c.json({ status: "ok" as const }));

  app.get("/me", authenticated, async (c) => {
    const { result, tier } = await c.var.withUser(getNudgeSettings);
    return c.json({ id: c.var.userId, tier, ...result });
  });

  app.patch("/me", authenticated, async (c) => {
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = parseMeUpdate(body);
    if (!parsed.ok) {
      return invalid(parsed.detail, c.get("requestId"));
    }
    const { result, tier } = await c.var.withUser((sql) =>
      updateNudgeSettings(sql, parsed.update, deps.now()),
    );
    return c.json({ id: c.var.userId, tier, ...result });
  });

  app.post("/push-subscriptions", authenticated, async (c) => {
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = parsePushSubscription(body);
    if (!parsed.ok) {
      return invalid(parsed.detail, c.get("requestId"));
    }
    const { result } = await c.var.withUser((sql) =>
      savePushSubscription(sql, parsed.subscription),
    );
    return c.json(result, 201);
  });

  app.delete("/push-subscriptions", authenticated, async (c) => {
    const endpoint = parseEndpointQuery(c.req.query("endpoint"));
    if (endpoint === undefined) {
      return invalid("endpoint must be an https URL", c.get("requestId"));
    }
    const { result } = await c.var.withUser((sql) =>
      deletePushSubscription(sql, endpoint),
    );
    return result ? c.body(null, 204) : notFound(c.get("requestId"));
  });

  app.get("/books", auth("books:read"), async (c) => {
    const status = c.req.query("status");
    if (
      status !== undefined &&
      !(BOOK_STATUSES as readonly string[]).includes(status)
    ) {
      return problemResponse(
        400,
        "validation_failed",
        "Invalid status",
        c.get("requestId"),
      );
    }
    const { result } = await c.var.withUser((sql) =>
      listBooks(sql, status as BookStatus | undefined),
    );
    return c.json({ items: result });
  });

  app.post("/books", authenticated, async (c) => {
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = parseBookFields(body, "create");
    if (!parsed.ok) {
      return invalid(parsed.detail, c.get("requestId"));
    }
    const { result } = await c.var.withUser((sql) =>
      createBook(sql, parsed.fields),
    );
    return c.json(result, 201);
  });

  app.get("/books/:id", auth("books:read"), async (c) => {
    const id = c.req.param("id");
    if (!uuid.test(id)) {
      return notFound(c.get("requestId"));
    }
    const { result } = await c.var.withUser((sql) => getBook(sql, id));
    return result === undefined ? notFound(c.get("requestId")) : c.json(result);
  });

  app.patch("/books/:id", authenticated, async (c) => {
    const id = c.req.param("id");
    if (!uuid.test(id)) {
      return notFound(c.get("requestId"));
    }
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = parseBookFields(body, "update");
    if (!parsed.ok) {
      return invalid(parsed.detail, c.get("requestId"));
    }
    const { result } = await c.var.withUser((sql) =>
      updateBook(sql, id, parsed.fields),
    );
    return result === undefined ? notFound(c.get("requestId")) : c.json(result);
  });

  app.delete("/books/:id", authenticated, async (c) => {
    const id = c.req.param("id");
    if (!uuid.test(id)) {
      return notFound(c.get("requestId"));
    }
    const { result: book } = await c.var.withUser((sql) => getBook(sql, id));
    if (book === undefined) {
      return notFound(c.get("requestId"));
    }
    const { result: paths } = await c.var.withUser((sql) =>
      storagePathsForBook(sql, id),
    );
    if (paths.audio.length > 0) {
      await deps.objects.remove("audio", paths.audio);
    }
    if (paths.photos.length > 0) {
      await deps.objects.remove("photos", paths.photos);
    }
    await c.var.withUser((sql) => deleteBook(sql, id));
    return c.body(null, 204);
  });

  app.get("/books/:id/sessions", authenticated, async (c) => {
    const id = c.req.param("id");
    if (!uuid.test(id)) {
      return notFound(c.get("requestId"));
    }
    const { result } = await c.var.withUser(async (sql) =>
      (await getBook(sql, id)) === undefined
        ? undefined
        : listBookSessions(sql, id),
    );
    return result === undefined
      ? notFound(c.get("requestId"))
      : c.json({ items: result });
  });

  app.post("/sessions", auth("sessions:write"), async (c) => {
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = parseSessionCreate(body);
    if (!parsed.ok) {
      return invalid(parsed.detail, c.get("requestId"));
    }
    const { result } = await c.var.withUser((sql) =>
      createSession(sql, parsed.session),
    );
    return result.kind === "missing"
      ? notFound(c.get("requestId"))
      : c.json(result.session, result.kind === "created" ? 201 : 200);
  });

  app.get("/sessions/:id", auth("sessions:write"), async (c) => {
    const id = c.req.param("id");
    if (!uuid.test(id)) {
      return notFound(c.get("requestId"));
    }
    const { result } = await c.var.withUser((sql) => getSession(sql, id));
    return result === undefined ? notFound(c.get("requestId")) : c.json(result);
  });

  app.patch("/sessions/:id", authenticated, async (c) => {
    const id = c.req.param("id");
    if (!uuid.test(id)) {
      return notFound(c.get("requestId"));
    }
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = parseSessionUpdate(body);
    if (!parsed.ok) {
      return invalid(parsed.detail, c.get("requestId"));
    }
    const { result } = await c.var.withUser((sql) =>
      updateSession(sql, id, parsed.fields),
    );
    return result === undefined ? notFound(c.get("requestId")) : c.json(result);
  });

  app.delete("/sessions/:id", authenticated, async (c) => {
    const id = c.req.param("id");
    if (!uuid.test(id)) {
      return notFound(c.get("requestId"));
    }
    const { result: path } = await c.var.withUser(async (sql) =>
      (await getSession(sql, id)) === undefined
        ? undefined
        : { audio: await sessionAudioPath(sql, id) },
    );
    if (path === undefined) {
      return notFound(c.get("requestId"));
    }
    if (path.audio !== null) {
      await deps.objects.remove("audio", [path.audio]);
    }
    await c.var.withUser((sql) => deleteSession(sql, id));
    return c.body(null, 204);
  });

  app.post("/sessions/:id/audio-upload", auth("sessions:write"), async (c) => {
    const id = c.req.param("id");
    if (!uuid.test(id)) {
      return notFound(c.get("requestId"));
    }
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = parseAudioUpload(body);
    if (!parsed.ok) {
      return invalid(parsed.detail, c.get("requestId"));
    }
    const { result: session, tier } = await c.var.withUser((sql) =>
      getSession(sql, id),
    );
    if (session === undefined) {
      return notFound(c.get("requestId"));
    }
    if (!mayUploadAudio(tier, parsed.durationSeconds)) {
      return problemResponse(
        403,
        "tier_limit_reached",
        "This note is longer than your plan allows",
        c.get("requestId"),
      );
    }
    const path = audioPath(c.var.userId, id, parsed.extension);
    const upload = await deps.objects.signedUploadUrl("audio", path);
    await c.var.withUser((sql) =>
      setSessionAudio(sql, id, path, parsed.durationSeconds),
    );
    return c.json({
      uploadUrl: upload.url,
      path,
      expiresInSeconds: upload.expiresInSeconds,
    });
  });

  app.post("/sessions/:id/process", auth("sessions:write"), async (c) => {
    const id = c.req.param("id");
    if (!uuid.test(id)) {
      return notFound(c.get("requestId"));
    }
    const { result: info, tier } = await c.var.withUser((sql) =>
      loadProcessInfo(sql, id),
    );
    if (info === undefined) {
      return notFound(c.get("requestId"));
    }
    const plan = planProcessing(info, tier);
    if (plan.kind === "conflict") {
      return problemResponse(
        409,
        "already_processed",
        "This session is already processed or being processed",
        c.get("requestId"),
      );
    }
    if (plan.kind === "nothing") {
      return problemResponse(
        422,
        "nothing_to_process",
        "The session has no note text and no uploaded audio",
        c.get("requestId"),
      );
    }
    if (plan.kind === "denied") {
      return problemResponse(
        403,
        "tier_limit_reached",
        "Your plan does not allow this voice note",
        c.get("requestId"),
        plan.reason,
      );
    }
    await c.var.withUser((sql) =>
      markStatus(sql, id, plan.transcribe ? "transcribing" : "extracting"),
    );
    const userId = c.var.userId;
    deps.waitUntil(
      runProcessing({
        withUser: async (work) =>
          (await deps.db.asUser(userId, deps.defaultTier, work)).result,
        objects: deps.objects,
        speech: deps.speech,
        text: deps.text,
        tier,
        info,
        transcribe: plan.transcribe,
      }),
    );
    const { result: session } = await c.var.withUser((sql) =>
      getSession(sql, id),
    );
    return c.json(session, 202);
  });

  app.get("/books/:id/reflections", authenticated, async (c) => {
    const id = c.req.param("id");
    if (!uuid.test(id)) {
      return notFound(c.get("requestId"));
    }
    const { result } = await c.var.withUser((sql) => listReflections(sql, id));
    return result === undefined
      ? notFound(c.get("requestId"))
      : c.json({ items: result });
  });

  app.post("/books/:id/reflections", authenticated, async (c) => {
    const id = c.req.param("id");
    if (!uuid.test(id)) {
      return notFound(c.get("requestId"));
    }
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = parseReflectionCreate(body);
    if (!parsed.ok) {
      return invalid(parsed.detail, c.get("requestId"));
    }
    const { result: existing } = await c.var.withUser((sql) =>
      listReflections(sql, id),
    );
    if (existing === undefined) {
      return notFound(c.get("requestId"));
    }
    const same = existing.filter((row) => row.stage === parsed.stage);
    if (same.length > 0) {
      return c.json({ items: same }, 200);
    }
    const { result: source } = await c.var.withUser((sql) =>
      loadReflectionSource(sql, id),
    );
    if (source === undefined) {
      return notFound(c.get("requestId"));
    }
    if (parsed.stage !== "recall" && source.notes.length === 0) {
      return problemResponse(
        422,
        "nothing_to_process",
        "The book has no notes or insights to ask about yet",
        c.get("requestId"),
      );
    }
    let asked;
    try {
      asked = await askReflectionQuestions(
        deps.text,
        parsed.stage,
        source.book,
        source.notes,
      );
    } catch (error) {
      if (error instanceof AiError) {
        return problemResponse(
          502,
          "ai_unavailable",
          "The AI service could not write questions. Try again later.",
          c.get("requestId"),
          error.code,
        );
      }
      throw error;
    }
    const { result: items } = await c.var.withUser(async (sql) => {
      await sql`
        select app.record_usage(
          0, 0, ${asked.usage.inputTokens}::bigint, ${asked.usage.outputTokens}::bigint
        )
      `;
      return saveQuestions(sql, id, parsed.stage, asked.questions);
    });
    return c.json({ items }, 201);
  });

  app.patch("/reflections/:id", authenticated, async (c) => {
    const id = c.req.param("id");
    if (!uuid.test(id)) {
      return notFound(c.get("requestId"));
    }
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = parseReflectionAnswer(body);
    if (!parsed.ok) {
      return invalid(parsed.detail, c.get("requestId"));
    }
    const { result } = await c.var.withUser((sql) =>
      answerReflection(sql, id, parsed.answer),
    );
    return result === undefined ? notFound(c.get("requestId")) : c.json(result);
  });

  app.get("/books/:id/insights", authenticated, async (c) => {
    const id = c.req.param("id");
    if (!uuid.test(id)) {
      return notFound(c.get("requestId"));
    }
    const { result } = await c.var.withUser((sql) => listBookInsights(sql, id));
    return result === undefined
      ? notFound(c.get("requestId"))
      : c.json({ items: result });
  });

  app.post("/books/:id/insights", authenticated, async (c) => {
    const id = c.req.param("id");
    if (!uuid.test(id)) {
      return notFound(c.get("requestId"));
    }
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = parseInsightCreate(body);
    if (!parsed.ok) {
      return invalid(parsed.detail, c.get("requestId"));
    }
    const { result } = await c.var.withUser((sql) =>
      createInsight(sql, id, parsed.insight),
    );
    return result === undefined
      ? notFound(c.get("requestId"))
      : c.json(result, 201);
  });

  app.get("/sessions/:id/insights", authenticated, async (c) => {
    const id = c.req.param("id");
    if (!uuid.test(id)) {
      return notFound(c.get("requestId"));
    }
    const { result } = await c.var.withUser((sql) =>
      listSessionInsights(sql, id),
    );
    return result === undefined
      ? notFound(c.get("requestId"))
      : c.json({ items: result });
  });

  app.patch("/insights/:id", authenticated, async (c) => {
    const id = c.req.param("id");
    if (!uuid.test(id)) {
      return notFound(c.get("requestId"));
    }
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = parseInsightUpdate(body);
    if (!parsed.ok) {
      return invalid(parsed.detail, c.get("requestId"));
    }
    const { result } = await c.var.withUser((sql) =>
      updateInsight(sql, id, parsed.fields),
    );
    return result === undefined ? notFound(c.get("requestId")) : c.json(result);
  });

  app.delete("/insights/:id", authenticated, async (c) => {
    const id = c.req.param("id");
    if (!uuid.test(id)) {
      return notFound(c.get("requestId"));
    }
    const { result } = await c.var.withUser((sql) => deleteInsight(sql, id));
    return result ? c.body(null, 204) : notFound(c.get("requestId"));
  });

  app.get("/search", authenticated, async (c) => {
    const parsed = parseSearch(c.req.query("q"), c.req.query("limit"));
    if (!parsed.ok) {
      return invalid(parsed.detail, c.get("requestId"));
    }
    const { result } = await c.var.withUser((sql) =>
      searchVault(sql, parsed.query, parsed.limit),
    );
    return c.json({ items: result });
  });

  app.get("/export", authenticated, async (c) => {
    const format = parseExportFormat(c.req.query("format"));
    if (format === undefined) {
      return invalid("format must be json or markdown", c.get("requestId"));
    }
    const { result } = await c.var.withUser((sql) =>
      collectExport(sql, new Date(deps.now())),
    );
    const day = result.exportedAt.slice(0, 10);
    if (format === "json") {
      return new Response(JSON.stringify(result), {
        headers: {
          "content-type": "application/json",
          "content-disposition": `attachment; filename="vault-${day}.json"`,
        },
      });
    }
    return new Response(renderMarkdown(result), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="vault-${day}.md"`,
      },
    });
  });

  app.post("/books/:id/finish", authenticated, async (c) => {
    const id = c.req.param("id");
    if (!uuid.test(id)) {
      return notFound(c.get("requestId"));
    }
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = parseFinish(body);
    if (!parsed.ok) {
      return invalid(parsed.detail, c.get("requestId"));
    }
    const today = new Date(deps.now()).toISOString().slice(0, 10);
    const { result } = await c.var.withUser((sql) =>
      finishBook(sql, id, parsed.finish, today),
    );
    return result === undefined ? notFound(c.get("requestId")) : c.json(result);
  });

  app.get("/books/:id/review", authenticated, async (c) => {
    const id = c.req.param("id");
    if (!uuid.test(id)) {
      return notFound(c.get("requestId"));
    }
    const { result } = await c.var.withUser((sql) => getReview(sql, id));
    return result === undefined ? notFound(c.get("requestId")) : c.json(result);
  });

  app.post("/books/:id/finish-photo", authenticated, async (c) => {
    const id = c.req.param("id");
    if (!uuid.test(id)) {
      return notFound(c.get("requestId"));
    }
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = parsePhotoUpload(body);
    if (!parsed.ok) {
      return invalid(parsed.detail, c.get("requestId"));
    }
    const { result: book } = await c.var.withUser((sql) => getBook(sql, id));
    if (book === undefined) {
      return notFound(c.get("requestId"));
    }
    const path = photoPath(c.var.userId, id, parsed.extension);
    const { result: previous } = await c.var.withUser((sql) =>
      currentPhotoPath(sql, id),
    );
    if (previous !== null && previous !== path) {
      await deps.objects.remove("photos", [previous]);
    }
    const upload = await deps.objects.signedUploadUrl("photos", path);
    await c.var.withUser((sql) => setFinishPhoto(sql, id, path));
    return c.json({
      uploadUrl: upload.url,
      path,
      expiresInSeconds: upload.expiresInSeconds,
    });
  });

  app.get("/tokens", authenticated, async (c) => {
    const { result } = await c.var.withUser((sql) => listTokens(sql));
    return c.json({ items: result });
  });

  app.post("/tokens", authenticated, async (c) => {
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = parseTokenCreate(body);
    if (!parsed.ok) {
      return invalid(parsed.detail, c.get("requestId"));
    }
    const { result } = await c.var.withUser((sql) =>
      createToken(sql, parsed.name, parsed.scopes),
    );
    return c.json(result, 201);
  });

  app.delete("/tokens/:id", authenticated, async (c) => {
    const id = c.req.param("id");
    if (!uuid.test(id)) {
      return notFound(c.get("requestId"));
    }
    const { result } = await c.var.withUser((sql) => revokeToken(sql, id));
    return result ? c.body(null, 204) : notFound(c.get("requestId"));
  });

  app.get("/lookup/isbn/:isbn", authenticated, async (c) => {
    const isbn = normalizeIsbn(c.req.param("isbn"));
    if (isbn === undefined) {
      return problemResponse(
        400,
        "isbn_invalid",
        "Not a valid ISBN",
        c.get("requestId"),
      );
    }
    const found = await lookupIsbn(isbn, {
      fetch: deps.fetch,
      baseUrl: deps.openLibraryUrl,
    });
    return found === undefined
      ? problemResponse(
          404,
          "isbn_not_found",
          "No book found for that ISBN",
          c.get("requestId"),
        )
      : c.json(found);
  });

  app.notFound((c) =>
    problemResponse(404, "not_found", "Not found", c.get("requestId")),
  );

  return app;
};
