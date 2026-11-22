import { useEffect, useState } from "react";
import type { QueueEntry } from "./queue-logic.ts";
import { listEntries, subscribeQueue } from "./queue-store.ts";

export function useQueueEntries() {
  const [entries, setEntries] = useState<QueueEntry[] | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      listEntries().then(
        (all) => {
          if (active) setEntries(all);
        },
        () => {
          if (active) setEntries([]);
        },
      );
    };
    load();
    const unsubscribe = subscribeQueue(load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return entries;
}
