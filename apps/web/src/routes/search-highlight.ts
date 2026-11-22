export type SnippetPart = { text: string; match: boolean };

export function splitSnippet(snippet: string) {
  const parts: SnippetPart[] = [];
  let rest = snippet;
  while (rest.length > 0) {
    const open = rest.indexOf("[");
    const close = open === -1 ? -1 : rest.indexOf("]", open + 1);
    if (open === -1 || close === -1) {
      parts.push({ text: rest, match: false });
      break;
    }
    if (open > 0) parts.push({ text: rest.slice(0, open), match: false });
    if (close > open + 1) {
      parts.push({ text: rest.slice(open + 1, close), match: true });
    }
    rest = rest.slice(close + 1);
  }
  return parts;
}
