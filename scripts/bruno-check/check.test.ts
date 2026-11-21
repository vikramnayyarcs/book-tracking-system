import { describe, expect, it } from "vitest";
import {
  brunoOperationIds,
  contractOperationIds,
  missingRequests,
} from "./check.ts";

const spec = `
paths:
  /health:
    get:
      operationId: getHealth
  /books:
    get:
      operationId: listBooks
    post:
      operationId: createBook
  /books/{id}:
    parameters: []
    delete:
      operationId: deleteBook
`;

describe("bruno check", () => {
  it("lists every operation id in the contract", () => {
    expect(contractOperationIds(spec)).toEqual([
      "getHealth",
      "listBooks",
      "createBook",
      "deleteBook",
    ]);
  });

  it("reads the operation id from the docs block of a request", () => {
    const ids = brunoOperationIds([
      "meta {\n  name: x\n}\n\ndocs {\n  operationId: listBooks\n}\n",
      "meta {\n  name: y\n}\n",
    ]);
    expect([...ids]).toEqual(["listBooks"]);
  });

  it("names the operations without a request", () => {
    expect(
      missingRequests(contractOperationIds(spec), new Set(["getHealth"])),
    ).toEqual(["listBooks", "createBook", "deleteBook"]);
  });
});
