import { readFileSync, writeFileSync } from "node:fs";
import { askReflectionQuestions } from "../src/ai/questions.ts";
import { groqText } from "../src/ai/groq.ts";
import { INSIGHT_MODEL } from "../src/ai/models.ts";

const args = process.argv.slice(2);
const out = args.pop();
const model = args[0] ?? INSIGHT_MODEL;
if (!out) throw new Error("usage: generate-questions.ts [model] <out.json>");
const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) throw new Error("GROQ_API_KEY is not set");

const samples = JSON.parse(
  readFileSync(new URL("./reflection-samples.json", import.meta.url), "utf8"),
) as {
  id: string;
  stage: "mid" | "end";
  book: { title: string; author: string | null };
  notes: string[];
}[];

const text = groqText({ apiKey, model });
const results = [];
for (const sample of samples) {
  try {
    const output = await askReflectionQuestions(
      text,
      sample.stage,
      sample.book,
      sample.notes,
    );
    results.push({ ...sample, output, error: null });
  } catch (error) {
    results.push({
      ...sample,
      output: null,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
writeFileSync(
  out,
  `${JSON.stringify({ model, task: "questions", results }, null, 2)}\n`,
);
