import type { QueryClient } from "@tanstack/react-query";
import { offlineQueueDbName } from "./offline-db.ts";

function deleteDatabase(factory: IDBFactory, name: string) {
  return new Promise<void>((resolve) => {
    const request = factory.deleteDatabase(name);
    for (const event of ["success", "error", "blocked"]) {
      request.addEventListener(event, () => resolve());
    }
  });
}

export async function clearDeviceData(queryClient: QueryClient) {
  queryClient.clear();
  const tasks: Promise<unknown>[] = [];
  if (typeof indexedDB !== "undefined") {
    tasks.push(deleteDatabase(indexedDB, offlineQueueDbName));
  }
  if (typeof caches !== "undefined") {
    tasks.push(
      caches
        .keys()
        .then((names) => Promise.all(names.map((name) => caches.delete(name)))),
    );
  }
  await Promise.all(tasks);
}
