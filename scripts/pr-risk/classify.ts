import { text } from "node:stream/consumers";

export type ChangedFile = {
  filename: string;
  previous_filename?: string;
  additions: number;
  deletions: number;
};

export type Colour = "red" | "yellow" | "green";

const MAX_GREEN_LINES = 300;

const RED = [
  /^infra\//,
  /^\.github\//,
  /^scripts\/claude-hooks\//,
  /^scripts\/git-hooks\//,
  /^scripts\/pr-risk\//,
  /^supabase\/migrations\//,
  /^\.claude\/settings[^/]*\.json$/,
  /^\.mcp\.json$/,
  /^scripts\/cloud-setup\.sh$/,
  /^CLAUDE\.md$/,
  /^docs\/secrets\.md$/,
];

const DEPLOYS = [/^infra\//, /^\.github\//, /^supabase\/migrations\//];

const GREEN = [
  /^README\.md$/,
  /^\.claude\/skills\//,
  /^docs\/(?!adr\/|briefs\/|secrets\.md$|requirements\.md$)/,
];

const pathsOf = (file: ChangedFile) =>
  file.previous_filename
    ? [file.filename, file.previous_filename]
    : [file.filename];

export const classify = (files: ChangedFile[], base: string) => {
  const paths = files.flatMap(pathsOf);
  const red = paths.filter((path) => RED.some((rule) => rule.test(path)));
  if (red.length > 0) {
    return {
      colour: "red" as Colour,
      deploys: paths.some((path) => DEPLOYS.some((rule) => rule.test(path))),
      reasons: red.map((path) => `\`${path}\` is guarded`),
    };
  }
  const notGreen = paths.filter(
    (path) => !GREEN.some((rule) => rule.test(path)),
  );
  const lines = files.reduce(
    (sum, file) => sum + file.additions + file.deletions,
    0,
  );
  const reasons = [
    ...notGreen.map((path) => `\`${path}\` is not documentation`),
    ...(lines > MAX_GREEN_LINES
      ? [`${lines} lines changed (green allows ${MAX_GREEN_LINES})`]
      : []),
    ...(base === "main" ? [] : [`targets \`${base}\`, not \`main\``]),
    ...(files.length === 0 ? ["no changed files"] : []),
  ];
  return {
    colour: (reasons.length === 0 ? "green" : "yellow") as Colour,
    deploys: false,
    reasons: reasons.length === 0 ? ["documentation only"] : reasons,
  };
};

if (import.meta.main) {
  const input = JSON.parse(await text(process.stdin)) as {
    base: string;
    files: ChangedFile[];
  };
  console.log(JSON.stringify(classify(input.files, input.base)));
}
