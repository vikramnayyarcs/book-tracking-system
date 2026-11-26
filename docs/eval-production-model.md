# DeepEval run against production's model

**DRAFT, owner review.** Phase 5 item 3 (ADR 0012, "Production review").

## Status: not run (2026-11-26)

A cloud session tried to run the full set. It could not finish: the Groq free tier answered with a rate limit (8,000 tokens per minute on `openai/gpt-oss-20b`) while the model under test or the judge was running, and `run_evals.py` correctly refused to score ("Evals NOT run: Groq free-tier rate limit"). No scores exist, so none are claimed here. The session did not retry in a loop. See the `needs-owner` issue linked in the PR.

`GROQ_API_KEY` and the `api.groq.com` domain were available; the blocker is the rate limit, not a missing secret.

## What production uses

From `packages/core/src/ai/models.ts` (the one place the models are named; the Edge Function imports it):

| Job | Model | Eval set |
| --- | --- | --- |
| Insights, reflection questions, recall prompts, book summaries, vault answers | `openai/gpt-oss-20b` (`INSIGHT_MODEL`) | `samples.json`, `reflection-samples.json`, `recall-samples.json`, `summary-samples.json`, `ask-samples.json` |
| Page photo reading (OCR) | `qwen/qwen3.8-27b` (`VISION_MODEL`) | `ocr-samples.json` |
| Judge (not production) | `openai/gpt-oss-120b` (`EVAL_JUDGE_MODEL`) | all |

The generators in `packages/core/evals/` import these constants, so a run always uses the model in the code. Speech-to-text (Whisper) and embeddings are not covered by DeepEval.

## How to run it

Option A, in CI (no local setup): open a PR that changes `packages/core/evals/run_evals.py`, `requirements.txt` or `.github/workflows/evals.yml`; any of these selects all sets. The `AI evals` workflow then runs all five generated sets plus OCR against the code's models with `DEV_GROQ_API_KEY`. Run it when the key has a paid or developer tier, or at a quiet hour: a free-tier limit shows as a yellow warning, not a pass.

Option B, locally, from the repo root with `GROQ_API_KEY` set (Windows: from your `BT_` variable):

```sh
python -m pip install -r packages/core/evals/requirements.txt requests
export DEEPEVAL_TELEMETRY_OPT_OUT=YES RUNNER_TEMP=$(mktemp -d)
cd packages/core/evals
J=openai/gpt-oss-120b
node generate.ts           "$RUNNER_TEMP/insights.json" && python3 run_evals.py "$RUNNER_TEMP/insights.json" $J
node generate-questions.ts "$RUNNER_TEMP/questions.json" && python3 run_evals.py "$RUNNER_TEMP/questions.json" $J
node generate-questions.ts --recall "$RUNNER_TEMP/recall.json" && python3 run_evals.py "$RUNNER_TEMP/recall.json" $J
node generate-summary.ts   "$RUNNER_TEMP/summary.json" && python3 run_evals.py "$RUNNER_TEMP/summary.json" $J
node generate-ask.ts       "$RUNNER_TEMP/ask.json" && python3 run_evals.py "$RUNNER_TEMP/ask.json" $J
node generate-ocr.ts       "$RUNNER_TEMP/ocr.json" && python3 run_evals.py "$RUNNER_TEMP/ocr.json" $J
```

Each `run_evals.py` call exits non-zero on a real failure (faithfulness, counts, quotes, usefulness mean below 0.5, see `docs/GOTCHAS.md`). A rate-limit message means the set was not scored: run it again later, do not treat it as a pass. Test data is invented; no real notes are used.

## Results

Fill one row per set from the printed scores. Record the date, the model constants in `models.ts` at that commit, and the commit SHA.

| Date | Commit | Set | Model | Faithfulness | Usefulness mean | Result |
| --- | --- | --- | --- | --- | --- | --- |
| | | insights | `openai/gpt-oss-20b` | | | |
| | | reflection | `openai/gpt-oss-20b` | | | |
| | | recall | `openai/gpt-oss-20b` | | | |
| | | summary | `openai/gpt-oss-20b` | | | |
| | | ask | `openai/gpt-oss-20b` | | | |
| | | ocr | `qwen/qwen3.8-27b` | | | |
