import { sleep } from "k6";
import { requireEnv, pickToken, publicHealth, call } from "./lib.js";

export const options = {
  vus: 1,
  duration: "1m",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
    checks: ["rate==1"],
  },
};

export function setup() {
  requireEnv();
}

export default function () {
  const token = pickToken();
  publicHealth();
  call("GET", "/me", "getMe", token, undefined, [200]);
  call("GET", "/books", "listBooks", token, undefined, [200]);
  sleep(3);
}
