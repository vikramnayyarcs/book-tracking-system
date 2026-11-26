# Load testing (k6)

Owner-run. Sessions never run these against dev or production (ADR 0012, production review item 2).

## Traffic model

Beta is about 10 invited people (ADR 0012). Assume each person makes about 12 requests a minute at peak, so beta is about 2 requests a second. The dev test runs at about 10 times that on non-AI routes.

| Scenario | Rate | Routes |
| --- | --- | --- |
| reads | 25 per second | `/me`, `/books`, `/stats`, `/activity`, `/search` |
| logging | 2 flows per second | create book, create session, list sessions, get session, delete book |
| ai | 6 per minute | `POST /ask` only (real Groq spend; a 429 counts as a pass) |

Defaults last 5 minutes. Override with `READ_RPS`, `LOG_RPS`, `AI_PER_MINUTE` and `DURATION`. Thresholds are first guesses; tune them after the first baseline.

## Setup

1. Install k6 (https://grafana.com/docs/k6/latest/set-up/install-k6/).
2. Use seeded test users only, never real accounts. Create one personal access token per user with `POST /v1/tokens` and put them in your environment as `BT_LOAD_TOKENS` (comma separated). Use more than one user so per-user limits are not the bottleneck.
3. Set `BT_GATEWAY_SECRET` for the target environment.
4. The test creates and deletes sample books named "Load Test Sample Book". It sends invented text only and logs no request or response bodies.

## Dev (before each release)

The Cloudflare IP rate limit may block this traffic. Requirements call for a dev-only WAF allow rule; if it is not in Terraform yet, add it in a separate PR first.

```sh
k6 run \
  -e BASE_URL=https://api-gateway-dev.<workers-subdomain>.workers.dev \
  -e LOAD_TOKENS="$BT_LOAD_TOKENS" \
  -e GATEWAY_SECRET="$BT_GATEWAY_SECRET" \
  test/load/dev.js
```

Check the script without sending traffic: `k6 inspect test/load/dev.js`.

## Production smoke test (1 minute)

One user, reads only: `/health`, `/me`, `/books`, about one round every 3 seconds. Use one seeded production test user's token.

```sh
k6 run \
  -e BASE_URL=<production api url> \
  -e LOAD_TOKENS="$BT_PROD_SMOKE_TOKEN" \
  -e GATEWAY_SECRET="$BT_PROD_GATEWAY_SECRET" \
  test/load/smoke.js
```

A pass means every check passed, under 1% failed requests and p95 under 1.5 seconds.
