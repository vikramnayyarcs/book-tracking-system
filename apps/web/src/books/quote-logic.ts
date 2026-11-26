export function parseQuotePage(value: string) {
  const text = value.trim();
  if (!/^\d+$/.test(text)) return null;
  const page = Number(text);
  return Number.isSafeInteger(page) && page >= 1 ? page : null;
}

export function passageFrom(lines: string[], selected: string[]) {
  const chosen = new Set(selected);
  return lines
    .filter((_, index) => chosen.has(String(index)))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function checkQuote(
  lines: string[],
  selected: string[],
  pageText: string,
) {
  const text = passageFrom(lines, selected);
  if (text.length === 0) return { error: "Select at least one line." };
  if (text.length > 5000) {
    return { error: "The passage is too long. Select fewer lines." };
  }
  const page = parseQuotePage(pageText);
  if (page === null) {
    return { error: "Enter the page number as a whole number, 1 or more." };
  }
  return { text, page };
}
