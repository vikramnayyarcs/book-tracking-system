const COMMAND_START = String.raw`(?:^|[;&|(\n{]|\$\(|\x60)\s*`;
const ENV_ASSIGNMENTS = String.raw`(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*`;
const LAUNCHER = String.raw`(?:sudo\s+)?(?:cmd(?:\.exe)?\s+\/c\s+)?(?:(?:npx|pnpx|bunx)(?:\s+-\S+)*\s+|npm\s+exec\s+(?:--\s+)?)?`;
const PATH_PREFIX = String.raw`(?:[\w.:\\/-]*[\\/])?`;
const GLOBAL_FLAGS = String.raw`(?:\s+--?[\w.-]+(?:[= ](?!-)\S+)?)*`;
const END = String.raw`(?=\s|$|[;&|)}])`;

export const commandPattern = (name: string, subcommands: string[]) =>
  new RegExp(
    `${COMMAND_START}${ENV_ASSIGNMENTS}${LAUNCHER}${PATH_PREFIX}${name}(?:\\.exe|\\.cmd)?${GLOBAL_FLAGS}\\s+(?:${subcommands.join("|")})${END}`,
    "i",
  );

export const stripHeredocBodies = (command: string) =>
  command.replace(
    /<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\s|$)/g,
    "<<heredoc",
  );
