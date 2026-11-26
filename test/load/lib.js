import http from "k6/http";
import { check } from "k6";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

const baseUrl = (__ENV.BASE_URL || "").replace(/\/$/, "");
const tokens = (__ENV.LOAD_TOKENS || "").split(",").filter(Boolean);
const gatewaySecret = __ENV.GATEWAY_SECRET || "";

export function requireEnv() {
  if (!baseUrl || tokens.length === 0) {
    throw new Error("BASE_URL and LOAD_TOKENS are required");
  }
}

function gatewayHeaders() {
  return gatewaySecret ? { "x-gateway-secret": gatewaySecret } : {};
}

export function pickToken() {
  return tokens[(__VU - 1) % tokens.length];
}

export function call(method, path, name, token, body, expected) {
  const response = http.request(
    method,
    `${baseUrl}/v1${path}`,
    body === undefined ? null : JSON.stringify(body),
    {
      headers: {
        ...gatewayHeaders(),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      tags: { name },
      responseCallback: http.expectedStatuses(...expected),
    },
  );
  check(response, {
    [`${name} status ok`]: (r) => expected.includes(r.status),
  });
  return response;
}

export function publicHealth() {
  const response = http.get(`${baseUrl}/v1/health`, {
    headers: gatewayHeaders(),
    tags: { name: "getHealth" },
  });
  check(response, { "getHealth status ok": (r) => r.status === 200 });
  return response;
}

export function readFlow(token) {
  call("GET", "/me", "getMe", token, undefined, [200]);
  call("GET", "/books", "listBooks", token, undefined, [200]);
  call("GET", "/stats", "getStats", token, undefined, [200]);
  call("GET", "/activity", "getActivity", token, undefined, [200]);
  call("GET", "/search?q=routine", "searchVault", token, undefined, [200]);
}

export function logFlow(token) {
  const book = call(
    "POST",
    "/books",
    "createBook",
    token,
    { title: "Load Test Sample Book", author: "Sample Author", pageCount: 96 },
    [201],
  );
  if (book.status !== 201) {
    return;
  }
  const bookId = book.json("id");
  const sessionId = uuidv4();
  call(
    "POST",
    "/sessions",
    "createSession",
    token,
    {
      id: sessionId,
      bookId,
      date: new Date().toISOString().slice(0, 10),
      pageFrom: 1,
      pageTo: 12,
      noteText: "Invented load test note about an invented sample book.",
    },
    [200, 201],
  );
  call(
    "GET",
    `/books/${bookId}/sessions`,
    "listBookSessions",
    token,
    undefined,
    [200],
  );
  call("GET", `/sessions/${sessionId}`, "getSession", token, undefined, [200]);
  call(
    "DELETE",
    `/books/${bookId}`,
    "deleteBook",
    token,
    undefined,
    [200, 204],
  );
}

export function askFlow(token) {
  call(
    "POST",
    "/ask",
    "askVault",
    token,
    { question: "What did I note about morning routines?" },
    [200, 429],
  );
}
