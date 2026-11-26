export type LogFields = {
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  errorName?: string;
};

export type AccountEvent = {
  event: "account_deleted" | "account_delete_failed";
  userId: string;
  at: string;
};

export type Logger = {
  account: (fields: AccountEvent) => void;
  info: (fields: LogFields) => void;
  error: (fields: LogFields) => void;
};

export const jsonLogger = (write: (line: string) => void) =>
  ({
    account: (fields: AccountEvent) =>
      write(JSON.stringify({ level: "info", ...fields })),
    info: (fields: LogFields) =>
      write(JSON.stringify({ level: "info", ...fields })),
    error: (fields: LogFields) =>
      write(JSON.stringify({ level: "error", ...fields })),
  }) satisfies Logger;
