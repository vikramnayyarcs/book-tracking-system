import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const maxWordsPerSentence = 20;

const contraction = /\b\w+(n't|'re|'ll|'ve|'d|'m)\b/i;
const joinedInstructions = /;|\band then\b|\bthen\b/i;

export const splitSentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

export const lintScript = (text: string) => {
  const problems: string[] = [];
  for (const sentence of splitSentences(text)) {
    const words = sentence.split(/\s+/).length;
    if (words > maxWordsPerSentence) {
      problems.push(
        `Too long (${words} words, maximum ${maxWordsPerSentence}): ${sentence}`,
      );
    }
    if (joinedInstructions.test(sentence)) {
      problems.push(`More than one instruction in one sentence: ${sentence}`);
    }
    if (contraction.test(sentence)) {
      problems.push(`Do not use contractions: ${sentence}`);
    }
    if (sentence.includes("?")) {
      problems.push(`Do not ask questions: ${sentence}`);
    }
  }
  return problems;
};

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: lint-script.ts <script.txt>...");
    process.exit(2);
  }
  let failed = false;
  for (const file of files) {
    const problems = lintScript(await readFile(file, "utf8"));
    for (const problem of problems) {
      console.error(`${file}: ${problem}`);
    }
    failed ||= problems.length > 0;
  }
  process.exit(failed ? 1 : 0);
}
