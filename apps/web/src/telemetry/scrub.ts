import type { TransportItem } from "@grafana/faro-web-sdk";

const numeric = /^-?\d+(\.\d+)?$/;
const keptContextKeys = new Set(["rating", "navigation_type"]);
const keptMeasurementTypes = new Set(["web-vitals"]);

export function routePattern(fullPath: string) {
  return fullPath.replace(/\$(\w+)/g, ":$1");
}

function pickNumeric(record: Record<string, string> | undefined) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(record ?? {})) {
    if (numeric.test(String(value))) out[key] = String(value);
  }
  return out;
}

function pickContext(record: Record<string, string> | undefined) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(record ?? {})) {
    if (keptContextKeys.has(key) || numeric.test(String(value))) {
      out[key] = String(value);
    }
  }
  return out;
}

export function scrubItem(item: TransportItem) {
  const pattern = item.meta.view?.name ?? "/";
  const meta: TransportItem["meta"] = {
    ...(item.meta.sdk ? { sdk: item.meta.sdk } : {}),
    ...(item.meta.app ? { app: item.meta.app } : {}),
    ...(item.meta.session?.id ? { session: { id: item.meta.session.id } } : {}),
    ...(item.meta.browser ? { browser: item.meta.browser } : {}),
    page: { url: pattern },
    view: { name: pattern },
  };
  const payload = item.payload as unknown as Record<string, unknown>;

  switch (item.type) {
    case "exception": {
      const frames = (
        (payload["stacktrace"] as { frames?: { filename: string }[] })
          ?.frames ?? []
      ).map((frame) => ({
        ...frame,
        filename: frame.filename.replace(/^https?:\/\/[^/]+/, "").split("?")[0],
      }));
      return {
        type: item.type,
        meta,
        payload: {
          timestamp: payload["timestamp"],
          type: payload["type"],
          value: "[redacted]",
          ...(frames.length > 0 ? { stacktrace: { frames } } : {}),
        } as unknown as TransportItem["payload"],
      };
    }
    case "measurement": {
      if (!keptMeasurementTypes.has(String(payload["type"]))) return null;
      return {
        type: item.type,
        meta,
        payload: {
          timestamp: payload["timestamp"],
          type: payload["type"],
          values: payload["values"],
          context: pickContext(
            payload["context"] as Record<string, string> | undefined,
          ),
        } as unknown as TransportItem["payload"],
      };
    }
    case "event": {
      if (!String(payload["name"]).startsWith("faro.")) return null;
      return {
        type: item.type,
        meta,
        payload: {
          timestamp: payload["timestamp"],
          name: payload["name"],
          attributes: pickNumeric(
            payload["attributes"] as Record<string, string> | undefined,
          ),
        } as unknown as TransportItem["payload"],
      };
    }
    default:
      return null;
  }
}
