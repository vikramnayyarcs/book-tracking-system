import {
  faro,
  getWebInstrumentations,
  initializeFaro,
} from "@grafana/faro-web-sdk";
import { env } from "../env.ts";
import { routePattern, scrubItem } from "./scrub.ts";

let started = false;

export function startTelemetry() {
  if (started || env.faroCollectorUrl === "") return;
  started = true;
  initializeFaro({
    url: env.faroCollectorUrl,
    app: { name: "web" },
    instrumentations: getWebInstrumentations({
      captureConsole: false,
      enablePerformanceInstrumentation: false,
      enableContentSecurityPolicyInstrumentation: false,
    }),
    beforeSend: scrubItem,
  });
}

export function reportRoute(fullPath: string) {
  if (!started) return;
  faro.api.setView({ name: routePattern(fullPath) });
}
