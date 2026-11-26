import { requireEnv, pickToken, readFlow, logFlow, askFlow } from "./lib.js";

const readRate = Number(__ENV.READ_RPS || 25);
const logRate = Number(__ENV.LOG_RPS || 2);
const aiPerMinute = Number(__ENV.AI_PER_MINUTE || 6);
const duration = __ENV.DURATION || "5m";

export const options = {
  scenarios: {
    reads: {
      executor: "constant-arrival-rate",
      exec: "reads",
      rate: readRate,
      timeUnit: "1s",
      duration,
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
    logging: {
      executor: "constant-arrival-rate",
      exec: "logging",
      rate: logRate,
      timeUnit: "1s",
      duration,
      preAllocatedVUs: 5,
      maxVUs: 30,
    },
    ai: {
      executor: "constant-arrival-rate",
      exec: "ai",
      rate: aiPerMinute,
      timeUnit: "1m",
      duration,
      preAllocatedVUs: 2,
      maxVUs: 5,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{scenario:reads}": ["p(95)<800"],
    "http_req_duration{scenario:logging}": ["p(95)<1200"],
    "http_req_duration{scenario:ai}": ["p(95)<15000"],
    checks: ["rate>0.99"],
  },
};

export function setup() {
  requireEnv();
}

export function reads() {
  readFlow(pickToken());
}

export function logging() {
  logFlow(pickToken());
}

export function ai() {
  askFlow(pickToken());
}
