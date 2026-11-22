import { readFileSync, writeFileSync } from "node:fs";
import { readPageLines } from "../src/ai/ocr.ts";
import { groqVision } from "../src/ai/groq.ts";
import { VISION_MODEL } from "../src/ai/models.ts";

const args = process.argv.slice(2);
const out = args.pop();
const model = args[0] ?? VISION_MODEL;
if (!out) throw new Error("usage: generate-ocr.ts [model] <out.json>");
const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) throw new Error("GROQ_API_KEY is not set");

const samples = JSON.parse(
  readFileSync(new URL("./ocr-samples.json", import.meta.url), "utf8"),
) as { id: string; image: string; expected: string[] }[];

const vision = groqVision({ apiKey, model });
const results = [];
for (const sample of samples) {
  const bytes = readFileSync(new URL(`./${sample.image}`, import.meta.url));
  try {
    let output;
    for (let attempt = 1; ; attempt += 1) {
      try {
        output = await readPageLines(
          vision,
          new Blob([bytes], { type: "image/png" }),
        );
        break;
      } catch (error) {
        const limited = (error as { code?: string }).code === "ai_rate_limited";
        if (!limited || attempt === 6) throw error;
        await new Promise((resolve) => setTimeout(resolve, 15000));
      }
    }
    results.push({
      id: sample.id,
      expected: sample.expected,
      output,
      error: null,
    });
  } catch (error) {
    results.push({
      id: sample.id,
      expected: sample.expected,
      output: null,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
writeFileSync(
  out,
  `${JSON.stringify({ model, task: "ocr", results }, null, 2)}\n`,
);
