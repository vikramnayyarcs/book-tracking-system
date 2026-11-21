import { readFileSync, writeFileSync } from "node:fs";
import { groqText } from "../src/ai/groq.ts";
import { INSIGHT_MODEL } from "../src/ai/models.ts";
import { extractInsights } from "../src/ai/insights.ts";

const args = process.argv.slice(2);
const out = args.pop();
const model = args[0] ?? INSIGHT_MODEL;
if (!out) throw new Error("usage: generate.ts [model] <out.json>");
const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) throw new Error("GROQ_API_KEY is not set");

const samples = JSON.parse(
  readFileSync(new URL("./samples.json", import.meta.url), "utf8"),
) as {
  id: string;
  book: { title: string; author: string | null };
  note: string;
  expectQuotes: boolean;
}[];

const text = groqText({ apiKey, model });
const results = [];
for (const sample of samples) {
  try {
    const result = await extractInsights(text, sample.note, sample.book);
    results.push({ ...sample, output: result, error: null });
  } catch (error) {
    results.push({
      ...sample,
      output: null,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
writeFileSync(out, `${JSON.stringify({ model, results }, null, 2)}\n`);
