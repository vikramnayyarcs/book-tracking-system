export type LogFields = {
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  errorName?: string;
};

export type Logger = {
  info: (fields: LogFields) => void;
  error: (fields: LogFields) => void;
};

export const jsonLogger = (write: (line: string) => void) =>
  ({
    info: (fields: LogFields) =>
      write(JSON.stringify({ level: "info", ...fields })),
    error: (fields: LogFields) =>
      write(JSON.stringify({ level: "error", ...fields })),
  }) satisfies Logger;
