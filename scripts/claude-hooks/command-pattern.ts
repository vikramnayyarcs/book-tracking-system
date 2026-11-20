const COMMAND_START = String.raw`(?:^|[;&|(\n{]|(?<!\\)\$\(|(?<!\\)\x60)\s*`;
const ENV_ASSIGNMENTS = String.raw`(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*`;
const LAUNCHER = String.raw`(?:sudo\s+)?(?:cmd(?:\.exe)?\s+\/c\s+)?(?:(?:npx|pnpx|bunx)(?:\s+-\S+)*\s+|npm\s+exec\s+(?:--\s+)?)?`;
const PATH_PREFIX = String.raw`(?:[\w.:\\/-]*[\\/])?`;
const GLOBAL_FLAGS = String.raw`(?:\s+--?[\w.-]+(?:[= ](?!-)\S+)?)*`;
const END = String.raw`(?=\s|$|[;&|)}])`;

export const commandPattern = (
  name: string,
  subcommands: string[],
  flags = "i",
) =>
  new RegExp(
    `${COMMAND_START}${ENV_ASSIGNMENTS}${LAUNCHER}${PATH_PREFIX}${name}(?:\\.exe|\\.cmd)?${GLOBAL_FLAGS}\\s+(?:${subcommands.join("|")})${END}`,
    flags,
  );

export const stripHeredocBodies = (command: string) =>
  command.replace(
    /<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\s|$)/g,
    "<<heredoc",
  );

export const segmentsMatching = (command: string, pattern: RegExp) =>
  Array.from(command.matchAll(pattern), (match) => {
    const rest = command.slice(match.index + match[0].length);
    const end = rest.search(/[;&|\n]/);
    return match[0] + (end === -1 ? rest : rest.slice(0, end));
  });
