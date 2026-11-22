import { offlineQueueDbName } from "../offline-db.ts";
import type { QueueEntry } from "./queue-logic.ts";

const storeName = "entries";

const listeners = new Set<() => void>();

export function subscribeQueue(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  for (const listener of listeners) listener();
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(offlineQueueDbName, 1);
    request.addEventListener("upgradeneeded", () => {
      request.result.createObjectStore(storeName, { keyPath: "id" });
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const request = action(transaction.objectStore(storeName));
      transaction.addEventListener("complete", () => resolve(request.result));
      transaction.addEventListener("error", () => reject(transaction.error));
      transaction.addEventListener("abort", () => reject(transaction.error));
    });
  } finally {
    db.close();
  }
}

export async function listEntries() {
  const entries = await run("readonly", (store) => store.getAll());
  return (entries as QueueEntry[]).toSorted(
    (a, b) => a.createdAt - b.createdAt,
  );
}

export async function getEntry(id: string) {
  const entry = await run("readonly", (store) => store.get(id));
  return entry as QueueEntry | undefined;
}

export async function putEntry(entry: QueueEntry) {
  await run("readwrite", (store) => store.put(entry));
  notify();
}

export async function removeEntry(id: string) {
  await run("readwrite", (store) => store.delete(id));
  notify();
}
