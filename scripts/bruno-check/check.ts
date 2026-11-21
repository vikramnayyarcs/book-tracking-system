import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { parse } from "yaml";

const METHODS = ["get", "put", "post", "delete", "patch"];

export const contractOperationIds = (yaml: string) => {
  const spec = parse(yaml) as {
    paths: Record<string, Record<string, { operationId?: string }>>;
  };
  const ids: string[] = [];
  for (const operations of Object.values(spec.paths)) {
    for (const method of METHODS) {
      const id = operations[method]?.operationId;
      if (id !== undefined) {
        ids.push(id);
      }
    }
  }
  return ids;
};

export const brunoOperationIds = (files: string[]) => {
  const ids = new Set<string>();
  for (const text of files) {
    const match = /docs\s*\{[^}]*operationId:\s*(\w+)/.exec(text);
    if (match?.[1] !== undefined) {
      ids.add(match[1]);
    }
  }
  return ids;
};

export const missingRequests = (contract: string[], bruno: Set<string>) =>
  contract.filter((id) => !bruno.has(id));

const walk = (root: string) => {
  const files: string[] = [];
  const pending = [root];
  for (let dir = pending.pop(); dir !== undefined; dir = pending.pop()) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        pending.push(path);
      } else if (path.endsWith(".bru")) {
        files.push(path);
      }
    }
  }
  return files;
};

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  const contract = contractOperationIds(
    readFileSync("packages/api-contract/openapi.yaml", "utf8"),
  );
  const bruno = brunoOperationIds(
    walk("bruno").map((path) => readFileSync(path, "utf8")),
  );
  const missing = missingRequests(contract, bruno);
  if (missing.length > 0) {
    console.error(`No Bruno request in bruno/ for: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log(`All ${contract.length} operations have a Bruno request.`);
}
