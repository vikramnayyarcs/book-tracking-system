import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import formatsModule from "ajv-formats";
import { parse } from "yaml";

type Json = Record<string, unknown>;

const specPath = fileURLToPath(
  new URL("../../packages/api-contract/openapi.yaml", import.meta.url),
);
const spec = parse(readFileSync(specPath, "utf8")) as Json;

const ajv = new Ajv2020({ strict: false, allErrors: true });
const addFormats = formatsModule as unknown as typeof formatsModule.default;
addFormats(ajv);
ajv.addSchema({ $id: "spec", ...spec });

export const baseUrl = process.env["API_BASE_URL"] ?? "";
export const gatewaySecret = process.env["GATEWAY_SECRET"] ?? "";

export const call = (
  path: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    json?: unknown;
  } = {},
) =>
  fetch(`${baseUrl}/v1${path}`, {
    method: init.method ?? "GET",
    headers: {
      "x-gateway-secret": gatewaySecret,
      ...(init.json === undefined
        ? {}
        : { "content-type": "application/json" }),
      ...init.headers,
    },
    ...(init.json === undefined ? {} : { body: JSON.stringify(init.json) }),
  });

const lookup = (method: string, path: string, status: number) => {
  const paths = spec["paths"] as Record<string, Record<string, Json>>;
  const operation = paths[path]?.[method.toLowerCase()];
  if (operation === undefined) {
    throw new Error(`No operation ${method} ${path} in the contract`);
  }
  const responses = operation["responses"] as Record<string, Json>;
  const chosen = (responses[String(status)] ?? responses["default"]) as Json;
  const refName =
    String(chosen["$ref"] ?? "")
      .split("/")
      .pop() ?? "";
  const shared = (spec["components"] as Record<string, Record<string, Json>>)[
    "responses"
  ];
  const response = refName === "" ? chosen : (shared?.[refName] ?? chosen);
  const content = (response["content"] ?? {}) as Record<
    string,
    { schema: Json }
  >;
  return content;
};

const resolveRef = (schema: Json) => {
  const ref = schema["$ref"];
  return typeof ref === "string" ? { $ref: `spec${ref}` } : schema;
};

export const expectMatchesContract = async (
  response: Response,
  method: string,
  path: string,
) => {
  const mediaType = (response.headers.get("content-type") ?? "").split(";")[0];
  const content = lookup(method, path, response.status);
  const entry = mediaType === undefined ? undefined : content[mediaType];
  if (entry === undefined) {
    throw new Error(
      `Response ${response.status} ${mediaType} is not in the contract for ${method} ${path}`,
    );
  }
  const validate = ajv.compile(resolveRef(entry.schema));
  const body: unknown = await response.json();
  if (!validate(body)) {
    throw new Error(
      `Response does not match the contract: ${ajv.errorsText(validate.errors)}`,
    );
  }
  return body;
};
